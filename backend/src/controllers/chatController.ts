import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { User } from '../models/User';
import { Connection } from '../models/Connection';
import { Conversation } from '../models/Conversation';
import { Message } from '../models/Message';
import { ChatNotification } from '../models/ChatNotification';
import { sendSuccess, sendError } from '../utils/response';
import { isUserOnline, getUserLastSeen, emitToUser } from '../socket';
import {
  directorySearchSchema,
  sendRequestSchema,
  sendMessageSchema,
  editMessageSchema,
  reactionSchema,
  conversationPreferenceSchema,
} from '../validators/chatValidators';

// Helper: sort pair of ObjectIds
const sortUserIds = (id1: Types.ObjectId, id2: Types.ObjectId): [Types.ObjectId, Types.ObjectId] => {
  return id1.toString() < id2.toString() ? [id1, id2] : [id2, id1];
};

/**
 * 1. Employee Directory Search
 */
export const getDirectory = async (req: Request, res: Response): Promise<void> => {
  try {
    const currentUser = req.user!;
    const companyId = req.user!.companyId!;

    const parsed = directorySearchSchema.parse(req.query);
    const search = parsed.search?.trim();

    // Query active users in the same company excluding the current user and Super Admin
    const filter: any = {
      companyId,
      status: 'active',
      role: { $in: ['EMPLOYEE', 'COMPANY_ADMIN'] },
      _id: { $ne: currentUser._id },
    };

    if (search) {
      filter.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { employeeId: { $regex: search, $options: 'i' } },
        { designation: { $regex: search, $options: 'i' } },
      ];
    }

    if (parsed.departmentId) {
      filter.departmentId = new Types.ObjectId(parsed.departmentId);
    }

    const employees = await User.find(filter)
      .select('fullName employeeId designation departmentId role status')
      .populate('departmentId', 'name')
      .lean();

    // Fetch all connections involving currentUser in this company
    const connections = await Connection.find({
      companyId,
      users: currentUser._id,
    }).lean();

    const connectionMap = new Map<string, any>();
    for (const conn of connections) {
      const otherId = conn.users.find((u: any) => u.toString() !== currentUser._id.toString())?.toString();
      if (otherId) {
        connectionMap.set(otherId, conn);
      }
    }

    const now = new Date();
    const result = employees.map((emp) => {
      const conn = connectionMap.get(emp._id.toString());
      let connectionStatus: 'NONE' | 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'CLOSED' = 'NONE';
      let isRequester = false;
      let canSendRequest = true;
      let declineCooloffExpiresAt: Date | null = null;

      if (conn) {
        connectionStatus = conn.status;
        isRequester = conn.requesterId.toString() === currentUser._id.toString();

        if (conn.status === 'PENDING') {
          canSendRequest = false;
        } else if (conn.status === 'ACCEPTED') {
          canSendRequest = false;
        } else if (conn.status === 'DECLINED') {
          // If declined, check 24-hour cooloff
          // The cooloff applies to the person who sent the request that was declined
          const declinedAt = conn.declinedAt ? new Date(conn.declinedAt) : new Date(conn.updatedAt);
          const expires = new Date(declinedAt.getTime() + 24 * 60 * 60 * 1000);
          if (now < expires) {
            // Within 24 hours
            if (conn.requesterId.toString() === currentUser._id.toString()) {
              canSendRequest = false;
              declineCooloffExpiresAt = expires;
            }
          }
        } else if (conn.status === 'CLOSED') {
          canSendRequest = true;
        }
      }

      return {
        _id: emp._id,
        fullName: emp.fullName,
        employeeId: emp.employeeId,
        designation: emp.designation,
        department: (emp.departmentId as any)?.name || 'General',
        role: emp.role,
        isOnline: isUserOnline(emp._id),
        lastSeen: getUserLastSeen(emp._id),
        connectionStatus,
        isRequester,
        canSendRequest,
        declineCooloffExpiresAt,
        connectionId: conn?._id || null,
      };
    });

    sendSuccess(res, result);
  } catch (error: any) {
    sendError(res, error.message || 'Failed to search directory', 400);
  }
};

/**
 * 2. Send Connection Request
 */
export const sendConnectionRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const currentUser = req.user!;
    const companyId = req.user!.companyId!;
    const { recipientId } = sendRequestSchema.parse(req.body);

    if (recipientId === currentUser._id.toString()) {
      sendError(res, 'You cannot send a connection request to yourself', 400);
      return;
    }

    // Verify recipient belongs to same company, is active, and is not Super Admin
    const recipient = await User.findOne({
      _id: recipientId,
      companyId,
      status: 'active',
      role: { $in: ['EMPLOYEE', 'COMPANY_ADMIN'] },
    });

    if (!recipient) {
      sendError(res, 'Recipient not found or is not eligible for chat', 404);
      return;
    }

    const users = sortUserIds(currentUser._id, new Types.ObjectId(recipientId));
    const pairKey = `${users[0].toString()}:${users[1].toString()}`;

    // Check existing connection record
    let connection = await Connection.findOne({
      companyId,
      pairKey,
    });

    const now = new Date();

    if (connection) {
      if (connection.status === 'ACCEPTED') {
        sendError(res, 'You are already connected with this user', 400);
        return;
      }

      if (connection.status === 'PENDING') {
        if (connection.recipientId.toString() === currentUser._id.toString()) {
          // User B already has an incoming pending request from User A.
          // Like Facebook: B cannot send a new request to A while A's request is waiting for B's decision.
          // B must explicitly Accept or Decline A's incoming request.
          sendError(
            res,
            'This user has already sent you a connection request. Please accept or decline their request.',
            400,
            { incomingRequestId: connection._id }
          );
          return;
        } else {
          // User A already has an outgoing pending request to User B.
          sendError(res, 'A connection request is already pending', 400);
          return;
        }
      }

      if (connection.status === 'DECLINED') {
        // Check 24-hour restriction
        const declinedAt = connection.declinedAt ? new Date(connection.declinedAt) : new Date(connection.updatedAt);
        const expires = new Date(declinedAt.getTime() + 24 * 60 * 60 * 1000);
        if (connection.requesterId.toString() === currentUser._id.toString() && now < expires) {
          sendError(
            res,
            `Cannot send request yet. Please wait until ${expires.toLocaleString()} (24-hour cooloff after decline).`,
            400
          );
          return;
        }
      }

      // Re-open request
      connection.status = 'PENDING';
      connection.requesterId = currentUser._id;
      connection.recipientId = recipient._id;
      connection.declinedAt = null;
      connection.declinedBy = null;
      connection.closedAt = null;
      connection.closedBy = null;
      await connection.save();
    } else {
      // Create new connection
      connection = await Connection.create({
        companyId,
        requesterId: currentUser._id,
        recipientId: recipient._id,
        pairKey,
        users,
        status: 'PENDING',
      });
    }

    // Create Notification
    const notif = await ChatNotification.create({
      companyId,
      recipientId: recipient._id,
      senderId: currentUser._id,
      type: 'CONNECTION_REQUEST_RECEIVED',
      title: 'New Connection Request',
      message: `${currentUser.fullName} sent you a connection request.`,
      data: { connectionId: connection._id.toString() },
    });

    emitToUser(recipient._id, 'connection:request_received', {
      connection,
      requester: {
        _id: currentUser._id,
        fullName: currentUser.fullName,
        designation: currentUser.designation,
      },
      notification: notif,
    });

    sendSuccess(res, connection, 'Connection request sent successfully');
  } catch (error: any) {
    sendError(res, error.message || 'Failed to send connection request', 400);
  }
};

/**
 * 3. Accept Connection Request
 */
export const acceptConnectionRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const currentUser = req.user!;
    const companyId = req.user!.companyId!;
    const { id } = req.params;

    const connection = await Connection.findOne({
      _id: id,
      companyId,
      recipientId: currentUser._id,
      status: 'PENDING',
    });

    if (!connection) {
      sendError(res, 'Pending connection request not found or unauthorized', 404);
      return;
    }

    connection.status = 'ACCEPTED';
    connection.declinedAt = null;
    connection.declinedBy = null;
    await connection.save();

    // Ensure conversation exists
    const users = connection.users;
    const pairKey = `${users[0].toString()}:${users[1].toString()}`;
    let conv = await Conversation.findOne({
      companyId,
      pairKey,
    });

    if (!conv) {
      conv = await Conversation.create({
        companyId,
        pairKey,
        participants: connection.users,
        userPreferences: [
          { userId: connection.users[0], isPinned: false, isArchived: false, isMuted: false },
          { userId: connection.users[1], isPinned: false, isArchived: false, isMuted: false },
        ],
      });
    }

    // Create Notification for the requester
    const notif = await ChatNotification.create({
      companyId,
      recipientId: connection.requesterId,
      senderId: currentUser._id,
      type: 'CONNECTION_REQUEST_ACCEPTED',
      title: 'Connection Accepted',
      message: `${currentUser.fullName} accepted your connection request.`,
      data: { connectionId: connection._id.toString(), conversationId: conv._id.toString() },
    });

    emitToUser(connection.requesterId, 'connection:accepted', {
      connection,
      acceptedBy: {
        _id: currentUser._id,
        fullName: currentUser.fullName,
      },
      conversationId: conv._id,
      notification: notif,
    });

    sendSuccess(res, { connection, conversationId: conv._id }, 'Connection request accepted');
  } catch (error: any) {
    sendError(res, error.message || 'Failed to accept connection request', 400);
  }
};

/**
 * 4. Decline Connection Request
 */
export const declineConnectionRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const currentUser = req.user!;
    const companyId = req.user!.companyId!;
    const { id } = req.params;

    const connection = await Connection.findOne({
      _id: id,
      companyId,
      recipientId: currentUser._id,
      status: 'PENDING',
    });

    if (!connection) {
      sendError(res, 'Pending connection request not found or unauthorized', 404);
      return;
    }

    connection.status = 'DECLINED';
    connection.declinedAt = new Date();
    connection.declinedBy = currentUser._id;
    await connection.save();

    // Notification for requester
    const notif = await ChatNotification.create({
      companyId,
      recipientId: connection.requesterId,
      senderId: currentUser._id,
      type: 'CONNECTION_REQUEST_DECLINED',
      title: 'Connection Declined',
      message: `${currentUser.fullName} declined your connection request.`,
      data: { connectionId: connection._id.toString() },
    });

    emitToUser(connection.requesterId, 'connection:declined', {
      connectionId: connection._id,
      declinedBy: {
        _id: currentUser._id,
        fullName: currentUser.fullName,
      },
      notification: notif,
    });

    sendSuccess(res, connection, 'Connection request declined');
  } catch (error: any) {
    sendError(res, error.message || 'Failed to decline connection request', 400);
  }
};

/**
 * 5. Cancel Outgoing Pending Request
 */
export const cancelOutgoingRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const currentUser = req.user!;
    const companyId = req.user!.companyId!;
    const { id } = req.params;

    const connection = await Connection.findOne({
      _id: id,
      companyId,
      requesterId: currentUser._id,
      status: 'PENDING',
    });

    if (!connection) {
      sendError(res, 'Pending outgoing request not found or unauthorized', 404);
      return;
    }

    const recipientId = connection.recipientId;
    // Mark CLOSED so it can be re-sent anytime without 24h penalty
    connection.status = 'CLOSED';
    connection.closedAt = new Date();
    connection.closedBy = currentUser._id;
    await connection.save();

    emitToUser(recipientId, 'connection:request_cancelled', { connectionId: connection._id });

    sendSuccess(res, connection, 'Connection request cancelled');
  } catch (error: any) {
    sendError(res, error.message || 'Failed to cancel connection request', 400);
  }
};

/**
 * 6. List Incoming Requests
 */
export const getIncomingRequests = async (req: Request, res: Response): Promise<void> => {
  try {
    const currentUser = req.user!;
    const companyId = req.user!.companyId!;

    const requests = await Connection.find({
      companyId,
      recipientId: currentUser._id,
      status: 'PENDING',
    })
      .populate('requesterId', 'fullName employeeId designation departmentId role status')
      .populate({
        path: 'requesterId',
        populate: { path: 'departmentId', select: 'name' },
      })
      .sort({ updatedAt: -1 })
      .lean();

    sendSuccess(res, requests);
  } catch (error: any) {
    sendError(res, error.message || 'Failed to fetch incoming requests', 400);
  }
};

/**
 * 7. List Outgoing Requests
 */
export const getOutgoingRequests = async (req: Request, res: Response): Promise<void> => {
  try {
    const currentUser = req.user!;
    const companyId = req.user!.companyId!;

    const requests = await Connection.find({
      companyId,
      requesterId: currentUser._id,
      status: 'PENDING',
    })
      .populate('recipientId', 'fullName employeeId designation departmentId role status')
      .populate({
        path: 'recipientId',
        populate: { path: 'departmentId', select: 'name' },
      })
      .sort({ updatedAt: -1 })
      .lean();

    sendSuccess(res, requests);
  } catch (error: any) {
    sendError(res, error.message || 'Failed to fetch outgoing requests', 400);
  }
};

/**
 * 8. List Connected People
 */
export const getConnections = async (req: Request, res: Response): Promise<void> => {
  try {
    const currentUser = req.user!;
    const companyId = req.user!.companyId!;

    const connections = await Connection.find({
      companyId,
      users: currentUser._id,
      status: 'ACCEPTED',
    })
      .populate('users', 'fullName employeeId designation departmentId role status')
      .populate({
        path: 'users',
        populate: { path: 'departmentId', select: 'name' },
      })
      .sort({ updatedAt: -1 })
      .lean();

    const result = connections.map((conn) => {
      const otherUser: any = (conn.users as any[]).find(
        (u: any) => u._id.toString() !== currentUser._id.toString()
      );

      return {
        _id: conn._id,
        user: otherUser
          ? {
              _id: otherUser._id,
              fullName: otherUser.fullName,
              employeeId: otherUser.employeeId,
              designation: otherUser.designation,
              department: otherUser.departmentId?.name || 'General',
              role: otherUser.role,
              status: otherUser.status,
              isOnline: isUserOnline(otherUser._id),
              lastSeen: getUserLastSeen(otherUser._id),
            }
          : null,
        connectedAt: conn.updatedAt,
      };
    });

    sendSuccess(res, result);
  } catch (error: any) {
    sendError(res, error.message || 'Failed to fetch connections', 400);
  }
};

/**
 * 9. Unfriend / Close Connection
 */
export const unfriendConnection = async (req: Request, res: Response): Promise<void> => {
  try {
    const currentUser = req.user!;
    const companyId = req.user!.companyId!;
    const { id } = req.params;

    const connection = await Connection.findOne({
      _id: id,
      companyId,
      users: currentUser._id,
      status: 'ACCEPTED',
    });

    if (!connection) {
      sendError(res, 'Active connection not found', 404);
      return;
    }

    connection.status = 'CLOSED';
    connection.closedAt = new Date();
    connection.closedBy = currentUser._id;
    await connection.save();

    const otherUserId = connection.users.find(
      (u) => u.toString() !== currentUser._id.toString()
    );

    if (otherUserId) {
      // Create notification
      const notif = await ChatNotification.create({
        companyId,
        recipientId: otherUserId,
        senderId: currentUser._id,
        type: 'CONNECTION_CLOSED',
        title: 'Connection Ended',
        message: `${currentUser.fullName} ended the connection.`,
        data: { connectionId: connection._id.toString() },
      });

      emitToUser(otherUserId, 'connection:closed', {
        connectionId: connection._id,
        closedBy: currentUser._id,
        notification: notif,
      });
    }

    sendSuccess(res, connection, 'Connection successfully ended');
  } catch (error: any) {
    sendError(res, error.message || 'Failed to unfriend connection', 400);
  }
};

/**
 * 10. List User Conversations
 */
export const getConversations = async (req: Request, res: Response): Promise<void> => {
  try {
    const currentUser = req.user!;
    const companyId = req.user!.companyId!;

    const conversations = await Conversation.find({
      companyId,
      participants: currentUser._id,
    })
      .populate('participants', 'fullName employeeId designation departmentId role status')
      .populate({
        path: 'participants',
        populate: { path: 'departmentId', select: 'name' },
      })
      .sort({ lastActivityAt: -1 })
      .lean();

    // Also get active connections to attach connection status
    const connections = await Connection.find({
      companyId,
      users: currentUser._id,
    }).lean();

    const connectionMap = new Map<string, any>();
    for (const c of connections) {
      const other = c.users.find((u: any) => u.toString() !== currentUser._id.toString())?.toString();
      if (other) connectionMap.set(other, c);
    }

    // Build conversation list
    const result = await Promise.all(
      conversations.map(async (conv) => {
        const otherParticipant: any = (conv.participants as any[]).find(
          (p: any) => p._id.toString() !== currentUser._id.toString()
        );

        if (!otherParticipant) return null;

        const myPref = conv.userPreferences?.find(
          (p) => p.userId.toString() === currentUser._id.toString()
        ) || {
          isPinned: false,
          isArchived: false,
          isMuted: false,
        };

        // Calculate unread count
        const unreadCount = await Message.countDocuments({
          conversationId: conv._id,
          recipientId: currentUser._id,
          status: { $ne: 'read' },
          deletedForUsers: { $ne: currentUser._id },
        });

        const activeConn = connectionMap.get(otherParticipant._id.toString());
        const isConnected = activeConn?.status === 'ACCEPTED';

        // Check if lastMessage is deleted for everyone or for me
        let displayLastMessage = null;
        if (conv.lastMessage) {
          const isDeletedForEveryone = conv.lastMessage.isDeletedForEveryone;
          displayLastMessage = {
            ...conv.lastMessage,
            content: isDeletedForEveryone
              ? 'This message was deleted.'
              : conv.lastMessage.content,
          };
        }

        return {
          _id: conv._id,
          participant: {
            _id: otherParticipant._id,
            fullName: otherParticipant.fullName,
            employeeId: otherParticipant.employeeId,
            designation: otherParticipant.designation,
            department: otherParticipant.departmentId?.name || 'General',
            role: otherParticipant.role,
            status: otherParticipant.status,
            isOnline: isUserOnline(otherParticipant._id),
            lastSeen: getUserLastSeen(otherParticipant._id),
          },
          lastMessage: displayLastMessage,
          lastActivityAt: conv.lastActivityAt,
          unreadCount,
          isPinned: myPref.isPinned || false,
          isArchived: myPref.isArchived || false,
          isMuted: myPref.isMuted || false,
          isConnected,
          connectionStatus: activeConn?.status || 'NONE',
          connectionId: activeConn?._id || null,
        };
      })
    );

    sendSuccess(res, result.filter(Boolean));
  } catch (error: any) {
    sendError(res, error.message || 'Failed to list conversations', 400);
  }
};

/**
 * 11. Get Paginated Messages in a Conversation
 */
export const getMessages = async (req: Request, res: Response): Promise<void> => {
  try {
    const currentUser = req.user!;
    const companyId = req.user!.companyId!;
    const { id } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const skip = (page - 1) * limit;

    // Verify participant
    const conversation = await Conversation.findOne({
      _id: id,
      companyId,
      participants: currentUser._id,
    });

    if (!conversation) {
      sendError(res, 'Conversation not found or access denied', 404);
      return;
    }

    // Filter out messages deleted for me
    const filter = {
      conversationId: conversation._id,
      companyId,
      deletedForUsers: { $ne: currentUser._id },
    };

    const total = await Message.countDocuments(filter);
    const messages = await Message.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('senderId', 'fullName designation')
      .lean();

    // Format messages: if isDeletedForEveryone, mask content
    const formatted = messages.reverse().map((msg) => {
      const isDeletedForEveryone = msg.isDeletedForEveryone;
      return {
        _id: msg._id,
        conversationId: msg.conversationId,
        senderId: (msg.senderId as any)._id,
        senderName: (msg.senderId as any).fullName,
        recipientId: msg.recipientId,
        content: isDeletedForEveryone ? 'This message was deleted.' : msg.content,
        status: msg.status,
        isEdited: msg.isEdited,
        editedAt: msg.editedAt,
        isDeletedForEveryone,
        replyTo: msg.replyTo
          ? {
              messageId: msg.replyTo.messageId,
              senderId: msg.replyTo.senderId,
              content: msg.replyTo.isDeleted
                ? 'This message was deleted.'
                : msg.replyTo.content,
              isDeleted: msg.replyTo.isDeleted,
            }
          : null,
        reactions: msg.reactions || [],
        deliveredAt: msg.deliveredAt,
        readAt: msg.readAt,
        createdAt: msg.createdAt,
      };
    });

    sendSuccess(res, {
      messages: formatted,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    sendError(res, error.message || 'Failed to get messages', 400);
  }
};

/**
 * 12. Send Message
 */
export const sendMessage = async (req: Request, res: Response): Promise<void> => {
  try {
    const currentUser = req.user!;
    const companyId = req.user!.companyId!;
    const { conversationId, content, replyToMessageId } = sendMessageSchema.parse(req.body);

    const conversation = await Conversation.findOne({
      _id: conversationId,
      companyId,
      participants: currentUser._id,
    });

    if (!conversation) {
      sendError(res, 'Conversation not found or access denied', 404);
      return;
    }

    const recipientId = conversation.participants.find(
      (p) => p.toString() !== currentUser._id.toString()
    )!;

    // Check that recipient account is still active
    const recipientUser = await User.findById(recipientId);
    if (!recipientUser || recipientUser.status !== 'active') {
      sendError(res, 'Recipient account is deactivated or unavailable', 400);
      return;
    }

    // Verify active connection between users
    const connection = await Connection.findOne({
      companyId,
      users: { $all: [currentUser._id, recipientId] },
      status: 'ACCEPTED',
    });

    if (!connection) {
      sendError(res, 'You can only message active connections. Please reconnect first.', 403);
      return;
    }

    // If replyToMessageId provided, verify it belongs to this conversation
    let replyToData = null;
    if (replyToMessageId) {
      const origMsg = await Message.findOne({
        _id: replyToMessageId,
        conversationId: conversation._id,
        companyId,
      });

      if (origMsg) {
        replyToData = {
          messageId: origMsg._id,
          senderId: origMsg.senderId,
          content: origMsg.isDeletedForEveryone ? 'This message was deleted.' : origMsg.content,
          isDeleted: origMsg.isDeletedForEveryone,
        };
      }
    }

    // Check if recipient is currently online to mark delivered
    const recipientOnline = isUserOnline(recipientId);
    const initialStatus = recipientOnline ? 'delivered' : 'sent';
    const now = new Date();

    const message = await Message.create({
      companyId,
      conversationId: conversation._id,
      senderId: currentUser._id,
      recipientId,
      content,
      status: initialStatus,
      deliveredAt: recipientOnline ? now : null,
      replyTo: replyToData,
      reactions: [],
      deletedForUsers: [],
    });

    // Update conversation lastMessage & lastActivityAt
    conversation.lastMessage = {
      messageId: message._id,
      senderId: currentUser._id,
      content,
      createdAt: now,
      isDeletedForEveryone: false,
    };
    conversation.lastActivityAt = now;
    await conversation.save();

    // Emit real-time message event to both users
    const payload = {
      _id: message._id,
      conversationId: conversation._id,
      senderId: currentUser._id,
      senderName: currentUser.fullName,
      recipientId,
      content: message.content,
      status: message.status,
      isEdited: false,
      editedAt: null,
      isDeletedForEveryone: false,
      replyTo: replyToData,
      reactions: [],
      deliveredAt: message.deliveredAt,
      readAt: null,
      createdAt: message.createdAt,
    };

    emitToUser(currentUser._id, 'message:new', payload);
    emitToUser(recipientId, 'message:new', payload);

    // Create Notification if not muted
    const recipientPref = conversation.userPreferences?.find(
      (p) => p.userId.toString() === recipientId.toString()
    );
    if (!recipientPref?.isMuted) {
      const notif = await ChatNotification.create({
        companyId,
        recipientId,
        senderId: currentUser._id,
        type: replyToData ? 'NEW_REPLY' : 'NEW_MESSAGE',
        title: replyToData ? `Reply from ${currentUser.fullName}` : `New message from ${currentUser.fullName}`,
        message: content.length > 50 ? `${content.substring(0, 47)}...` : content,
        data: {
          conversationId: conversation._id.toString(),
          messageId: message._id.toString(),
        },
      });

      emitToUser(recipientId, 'notification:new', notif);
    }

    sendSuccess(res, payload, 'Message sent', 201);
  } catch (error: any) {
    sendError(res, error.message || 'Failed to send message', 400);
  }
};

/**
 * 13. Edit Message (15-minute window)
 */
export const editMessage = async (req: Request, res: Response): Promise<void> => {
  try {
    const currentUser = req.user!;
    const companyId = req.user!.companyId!;
    const { id } = req.params;
    const { content } = editMessageSchema.parse(req.body);

    const message = await Message.findOne({
      _id: id,
      companyId,
      senderId: currentUser._id,
    });

    if (!message) {
      sendError(res, 'Message not found or you are not authorized to edit it', 404);
      return;
    }

    if (message.isDeletedForEveryone) {
      sendError(res, 'Cannot edit a deleted message', 400);
      return;
    }

    // Check 15-minute restriction
    const now = new Date();
    const diffMinutes = (now.getTime() - new Date(message.createdAt).getTime()) / (1000 * 60);
    if (diffMinutes > 15) {
      sendError(res, 'Editing is only permitted within 15 minutes of sending', 403);
      return;
    }

    message.content = content;
    message.isEdited = true;
    message.editedAt = now;
    await message.save();

    // Update conversation lastMessage if this was the last message
    await Conversation.updateOne(
      { _id: message.conversationId, 'lastMessage.messageId': message._id },
      { $set: { 'lastMessage.content': content } }
    );

    const payload = {
      messageId: message._id,
      conversationId: message.conversationId,
      content,
      isEdited: true,
      editedAt: now,
    };

    emitToUser(message.senderId, 'message:edited', payload);
    emitToUser(message.recipientId, 'message:edited', payload);

    sendSuccess(res, payload, 'Message edited successfully');
  } catch (error: any) {
    sendError(res, error.message || 'Failed to edit message', 400);
  }
};

/**
 * 14. Delete Message (For Me)
 */
export const deleteForMe = async (req: Request, res: Response): Promise<void> => {
  try {
    const currentUser = req.user!;
    const companyId = req.user!.companyId!;
    const { id } = req.params;

    const message = await Message.findOne({
      _id: id,
      companyId,
      $or: [{ senderId: currentUser._id }, { recipientId: currentUser._id }],
    });

    if (!message) {
      sendError(res, 'Message not found or unauthorized', 404);
      return;
    }

    if (!message.deletedForUsers.some((u) => u.toString() === currentUser._id.toString())) {
      message.deletedForUsers.push(currentUser._id);
      await message.save();
    }

    sendSuccess(res, { messageId: message._id }, 'Message removed for you');
  } catch (error: any) {
    sendError(res, error.message || 'Failed to delete message', 400);
  }
};

/**
 * 15. Delete Message (For Everyone)
 */
export const deleteForEveryone = async (req: Request, res: Response): Promise<void> => {
  try {
    const currentUser = req.user!;
    const companyId = req.user!.companyId!;
    const { id } = req.params;

    const message = await Message.findOne({
      _id: id,
      companyId,
      senderId: currentUser._id,
    });

    if (!message) {
      sendError(res, 'Message not found or you are not authorized to delete it for everyone', 404);
      return;
    }

    const now = new Date();
    message.isDeletedForEveryone = true;
    message.deletedForEveryoneAt = now;
    message.content = 'This message was deleted.';
    message.reactions = [];
    await message.save();

    // Update conversation lastMessage if this was the last message
    await Conversation.updateOne(
      { _id: message.conversationId, 'lastMessage.messageId': message._id },
      {
        $set: {
          'lastMessage.content': 'This message was deleted.',
          'lastMessage.isDeletedForEveryone': true,
        },
      }
    );

    const payload = {
      messageId: message._id,
      conversationId: message.conversationId,
      isDeletedForEveryone: true,
      deletedForEveryoneAt: now,
    };

    emitToUser(message.senderId, 'message:deleted_for_everyone', payload);
    emitToUser(message.recipientId, 'message:deleted_for_everyone', payload);

    sendSuccess(res, payload, 'Message deleted for everyone');
  } catch (error: any) {
    sendError(res, error.message || 'Failed to delete message', 400);
  }
};

/**
 * 16. Emoji Reaction
 */
export const toggleReaction = async (req: Request, res: Response): Promise<void> => {
  try {
    const currentUser = req.user!;
    const companyId = req.user!.companyId!;
    const { id } = req.params;
    const { emoji } = reactionSchema.parse(req.body);

    const message = await Message.findOne({
      _id: id,
      companyId,
      $or: [{ senderId: currentUser._id }, { recipientId: currentUser._id }],
    });

    if (!message) {
      sendError(res, 'Message not found or access denied', 404);
      return;
    }

    if (message.isDeletedForEveryone) {
      sendError(res, 'Cannot react to a deleted message', 400);
      return;
    }

    const existingIdx = message.reactions.findIndex(
      (r) => r.userId.toString() === currentUser._id.toString()
    );

    if (existingIdx >= 0) {
      if (message.reactions[existingIdx].emoji === emoji) {
        // Remove reaction
        message.reactions.splice(existingIdx, 1);
      } else {
        // Change reaction
        message.reactions[existingIdx].emoji = emoji;
        message.reactions[existingIdx].createdAt = new Date();
      }
    } else {
      // Add reaction
      message.reactions.push({
        userId: currentUser._id,
        emoji,
        createdAt: new Date(),
      });
    }

    await message.save();

    const payload = {
      messageId: message._id,
      conversationId: message.conversationId,
      reactions: message.reactions,
    };

    emitToUser(message.senderId, 'message:reaction_update', payload);
    emitToUser(message.recipientId, 'message:reaction_update', payload);

    sendSuccess(res, payload, 'Reaction updated');
  } catch (error: any) {
    sendError(res, error.message || 'Failed to update reaction', 400);
  }
};

/**
 * 17. Mark Messages as Read
 */
export const markMessagesRead = async (req: Request, res: Response): Promise<void> => {
  try {
    const currentUser = req.user!;
    const companyId = req.user!.companyId!;
    const { id } = req.params; // conversationId

    const conversation = await Conversation.findOne({
      _id: id,
      companyId,
      participants: currentUser._id,
    });

    if (!conversation) {
      sendError(res, 'Conversation not found', 404);
      return;
    }

    const now = new Date();
    const unreadMsgs = await Message.find({
      conversationId: conversation._id,
      recipientId: currentUser._id,
      status: { $ne: 'read' },
    }).select('_id');

    if (unreadMsgs.length > 0) {
      const messageIds = unreadMsgs.map((m) => m._id.toString());
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

      const otherUserId = conversation.participants.find(
        (p) => p.toString() !== currentUser._id.toString()
      );

      if (otherUserId) {
        emitToUser(otherUserId, 'message:read_receipt', {
          conversationId: conversation._id,
          readBy: currentUser._id,
          readAt: now,
          messageIds,
        });
      }

      sendSuccess(res, { markedCount: unreadMsgs.length, messageIds }, 'Messages marked as read');
    } else {
      sendSuccess(res, { markedCount: 0, messageIds: [] }, 'No unread messages');
    }
  } catch (error: any) {
    sendError(res, error.message || 'Failed to mark messages as read', 400);
  }
};

/**
 * 18. Pin / Archive / Mute Conversation
 */
export const updateConversationPreferences = async (req: Request, res: Response): Promise<void> => {
  try {
    const currentUser = req.user!;
    const companyId = req.user!.companyId!;
    const { id } = req.params;
    const body = conversationPreferenceSchema.parse(req.body);

    const conversation = await Conversation.findOne({
      _id: id,
      companyId,
      participants: currentUser._id,
    });

    if (!conversation) {
      sendError(res, 'Conversation not found', 404);
      return;
    }

    let pref = conversation.userPreferences.find(
      (p) => p.userId.toString() === currentUser._id.toString()
    );

    if (!pref) {
      pref = {
        userId: currentUser._id,
        isPinned: false,
        isArchived: false,
        isMuted: false,
      };
      conversation.userPreferences.push(pref);
    }

    if (body.isPinned !== undefined) pref.isPinned = body.isPinned;
    if (body.isArchived !== undefined) pref.isArchived = body.isArchived;
    if (body.isMuted !== undefined) pref.isMuted = body.isMuted;

    await conversation.save();

    sendSuccess(res, pref, 'Preferences updated successfully');
  } catch (error: any) {
    sendError(res, error.message || 'Failed to update preferences', 400);
  }
};

/**
 * 19. Search Messages within a conversation or across conversations
 */
export const searchMessages = async (req: Request, res: Response): Promise<void> => {
  try {
    const currentUser = req.user!;
    const companyId = req.user!.companyId!;
    const { conversationId, q } = req.query;

    if (!q || typeof q !== 'string' || !q.trim()) {
      sendSuccess(res, []);
      return;
    }

    const filter: any = {
      companyId,
      isDeletedForEveryone: false,
      deletedForUsers: { $ne: currentUser._id },
      content: { $regex: q.trim(), $options: 'i' },
    };

    if (conversationId) {
      // Verify participation
      const conv = await Conversation.findOne({
        _id: conversationId,
        companyId,
        participants: currentUser._id,
      });
      if (!conv) {
        sendError(res, 'Conversation not found', 404);
        return;
      }
      filter.conversationId = conv._id;
    } else {
      // Across all conversations the user is in
      const userConvs = await Conversation.find({
        companyId,
        participants: currentUser._id,
      }).select('_id');
      filter.conversationId = { $in: userConvs.map((c) => c._id) };
    }

    const messages = await Message.find(filter)
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('senderId', 'fullName')
      .lean();

    sendSuccess(res, messages);
  } catch (error: any) {
    sendError(res, error.message || 'Failed to search messages', 400);
  }
};

/**
 * 20. List In-App Chat Notifications
 */
export const getNotifications = async (req: Request, res: Response): Promise<void> => {
  try {
    const currentUser = req.user!;
    const companyId = req.user!.companyId!;

    const notifications = await ChatNotification.find({
      companyId,
      recipientId: currentUser._id,
    })
      .sort({ createdAt: -1 })
      .limit(30)
      .lean();

    const unreadCount = await ChatNotification.countDocuments({
      companyId,
      recipientId: currentUser._id,
      isRead: false,
    });

    sendSuccess(res, { notifications, unreadCount });
  } catch (error: any) {
    sendError(res, error.message || 'Failed to get notifications', 400);
  }
};

/**
 * 21. Mark Notifications as Read
 */
export const markNotificationsRead = async (req: Request, res: Response): Promise<void> => {
  try {
    const currentUser = req.user!;
    const companyId = req.user!.companyId!;

    await ChatNotification.updateMany(
      {
        companyId,
        recipientId: currentUser._id,
        isRead: false,
      },
      {
        $set: { isRead: true },
      }
    );

    sendSuccess(res, { success: true }, 'All notifications marked as read');
  } catch (error: any) {
    sendError(res, error.message || 'Failed to mark notifications as read', 400);
  }
};
