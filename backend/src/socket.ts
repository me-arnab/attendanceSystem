import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { verifyToken, TokenPayload } from './utils/jwt';
import { User } from './models/User';
import { Company } from './models/Company';
import { Connection } from './models/Connection';
import { Conversation } from './models/Conversation';
import { Message } from './models/Message';
import { ChatNotification } from './models/ChatNotification';
import { Types } from 'mongoose';

// Map of userId -> Set of socketIds (for multi-device / multi-tab support)
const userSockets = new Map<string, Set<string>>();
// Map of userId -> lastSeen Date
const userLastSeen = new Map<string, Date>();

let ioInstance: Server | null = null;

export const getIO = (): Server => {
  if (!ioInstance) {
    throw new Error('Socket.IO is not initialized yet');
  }
  return ioInstance;
};

export const isUserOnline = (userId: string | Types.ObjectId): boolean => {
  const sockets = userSockets.get(userId.toString());
  return !!(sockets && sockets.size > 0);
};

export const getUserLastSeen = (userId: string | Types.ObjectId): Date | null => {
  return userLastSeen.get(userId.toString()) || null;
};

export const emitToUser = (userId: string | Types.ObjectId, event: string, data: any) => {
  if (!ioInstance) return;
  const sockets = userSockets.get(userId.toString());
  if (sockets && sockets.size > 0) {
    for (const socketId of sockets) {
      ioInstance.to(socketId).emit(event, data);
    }
  }
};

export const emitToCompany = (companyId: string | Types.ObjectId, event: string, data: any) => {
  if (!ioInstance) return;
  ioInstance.to(`company:${companyId.toString()}`).emit(event, data);
};

export const initSocketIO = (httpServer: HttpServer, frontendUrl: string): Server => {
  const io = new Server(httpServer, {
    cors: {
      origin: [frontendUrl, 'http://localhost:5173', 'http://127.0.0.1:5173'],
      credentials: true,
      methods: ['GET', 'POST'],
    },
  });

  ioInstance = io;

  // Socket authentication middleware
  io.use(async (socket: Socket, next) => {
    try {
      const authHeader = socket.handshake.auth?.token || socket.handshake.headers?.authorization;
      if (!authHeader) {
        return next(new Error('Authentication required'));
      }

      const token = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : authHeader;
      let payload: TokenPayload;
      try {
        payload = verifyToken(token);
      } catch (err) {
        return next(new Error('Invalid token'));
      }

      const user = await User.findById(payload.userId);
      if (!user) {
        return next(new Error('User not found'));
      }

      if (user.status !== 'active') {
        return next(new Error('User account is deactivated'));
      }

      if (user.role === 'SUPER_ADMIN') {
        return next(new Error('Super Admin cannot participate in company chat'));
      }

      if (!user.companyId) {
        return next(new Error('User not associated with a company'));
      }

      const company = await Company.findById(user.companyId);
      if (!company || company.status === 'suspended') {
        return next(new Error('Company suspended or invalid'));
      }

      // Attach to socket data
      socket.data.user = user;
      socket.data.companyId = user.companyId.toString();
      socket.data.userId = user._id.toString();

      next();
    } catch (err: any) {
      next(new Error('Internal socket authentication failure'));
    }
  });

  io.on('connection', async (socket: Socket) => {
    const userId = socket.data.userId as string;
    const companyId = socket.data.companyId as string;
    const user = socket.data.user;

    // Track active socket
    if (!userSockets.has(userId)) {
      userSockets.set(userId, new Set());
    }
    const hadZero = userSockets.get(userId)!.size === 0;
    userSockets.get(userId)!.add(socket.id);

    // Join company room
    socket.join(`company:${companyId}`);
    // Join personal user room
    socket.join(`user:${userId}`);

    // Notify company peers of online status if this is the first active connection
    if (hadZero) {
      io.to(`company:${companyId}`).emit('user:presence', {
        userId,
        status: 'online',
        lastSeen: new Date(),
      });
    }

    // Send the connecting client a snapshot of currently online users in their company
    const onlineUserIds: string[] = [];
    for (const [uid, sockets] of userSockets.entries()) {
      if (sockets && sockets.size > 0 && uid !== userId) {
        onlineUserIds.push(uid);
      }
    }
    // Filter to same company users
    if (onlineUserIds.length > 0) {
      User.find({
        _id: { $in: onlineUserIds.map((id) => new Types.ObjectId(id)) },
        companyId: new Types.ObjectId(companyId),
        status: 'active',
      })
        .select('_id')
        .lean()
        .then((companyUsers) => {
          const verifiedOnlineIds = companyUsers.map((u) => u._id.toString());
          socket.emit('presence:snapshot', { onlineUserIds: verifiedOnlineIds });
        })
        .catch(() => {
          // ignore
        });
    } else {
      socket.emit('presence:snapshot', { onlineUserIds: [] });
    }

    // Typing start
    socket.on('typing:start', async (data: { conversationId: string }) => {
      try {
        if (!data?.conversationId) return;
        const conv = await Conversation.findOne({
          _id: data.conversationId,
          companyId,
          participants: new Types.ObjectId(userId),
        });
        if (!conv) return;

        // Check that connection is still ACCEPTED
        const conn = await Connection.findOne({
          companyId,
          users: { $all: conv.participants },
          status: 'ACCEPTED',
        });
        if (!conn) return;

        const otherUserId = conv.participants
          .find((p) => p.toString() !== userId)
          ?.toString();

        if (otherUserId) {
          emitToUser(otherUserId, 'typing:update', {
            conversationId: data.conversationId,
            userId,
            userName: user.fullName,
            isTyping: true,
          });
        }
      } catch (e) {
        // Safe ignore
      }
    });

    // Typing stop
    socket.on('typing:stop', async (data: { conversationId: string }) => {
      try {
        if (!data?.conversationId) return;
        const conv = await Conversation.findOne({
          _id: data.conversationId,
          companyId,
          participants: new Types.ObjectId(userId),
        });
        if (!conv) return;

        const otherUserId = conv.participants
          .find((p) => p.toString() !== userId)
          ?.toString();

        if (otherUserId) {
          emitToUser(otherUserId, 'typing:update', {
            conversationId: data.conversationId,
            userId,
            userName: user.fullName,
            isTyping: false,
          });
        }
      } catch (e) {
        // Safe ignore
      }
    });

    // Mark messages as read via socket or sync
    socket.on('message:mark_read', async (data: { conversationId: string }) => {
      try {
        if (!data?.conversationId) return;
        const conv = await Conversation.findOne({
          _id: data.conversationId,
          companyId,
          participants: new Types.ObjectId(userId),
        });
        if (!conv) return;

        // Find unread messages to extract their IDs
        const unreadMsgs = await Message.find({
          conversationId: conv._id,
          recipientId: new Types.ObjectId(userId),
          status: { $ne: 'read' },
        }).select('_id');

        if (unreadMsgs.length === 0) return;

        const messageIds = unreadMsgs.map((m) => m._id.toString());
        const now = new Date();

        await Message.updateMany(
          {
            _id: { $in: unreadMsgs.map((m) => m._id) },
          },
          {
            $set: {
              status: 'read',
              readAt: now,
            },
          }
        );

        const otherUserId = conv.participants
          .find((p) => p.toString() !== userId)
          ?.toString();

        if (otherUserId) {
          emitToUser(otherUserId, 'message:read_receipt', {
            conversationId: data.conversationId,
            readBy: userId,
            readAt: now,
            messageIds,
          });
        }
      } catch (e) {
        // Safe ignore
      }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      const userSet = userSockets.get(userId);
      if (userSet) {
        userSet.delete(socket.id);
        if (userSet.size === 0) {
          userSockets.delete(userId);
          const lastSeen = new Date();
          userLastSeen.set(userId, lastSeen);

          io.to(`company:${companyId}`).emit('user:presence', {
            userId,
            status: 'offline',
            lastSeen,
          });
        }
      }
    });
  });

  return io;
};
