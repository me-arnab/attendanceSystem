import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/authMiddleware';
import { sendError } from '../utils/response';
import {
  getDirectory,
  sendConnectionRequest,
  acceptConnectionRequest,
  declineConnectionRequest,
  cancelOutgoingRequest,
  getIncomingRequests,
  getOutgoingRequests,
  getConnections,
  unfriendConnection,
  getConversations,
  getMessages,
  sendMessage,
  editMessage,
  deleteForMe,
  deleteForEveryone,
  toggleReaction,
  markMessagesRead,
  updateConversationPreferences,
  searchMessages,
  getNotifications,
  markNotificationsRead,
} from '../controllers/chatController';

const router = Router();

// Ensure user is authenticated and is NOT Super Admin
const chatAuth = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) {
    sendError(res, 'Authentication required', 401);
    return;
  }
  if (req.user.role === 'SUPER_ADMIN') {
    sendError(res, 'Super Admin cannot participate in company chat', 403);
    return;
  }
  if (req.user.status !== 'active') {
    sendError(res, 'Deactivated account cannot participate in chat', 403);
    return;
  }
  if (!req.user.companyId) {
    sendError(res, 'User is not associated with any company', 403);
    return;
  }
  next();
};

router.use(authenticate, chatAuth);

// 1. Employee Directory
router.get('/directory', getDirectory);

// 2. Connection Requests
router.post('/connections/request', sendConnectionRequest);
router.post('/connections/:id/accept', acceptConnectionRequest);
router.post('/connections/:id/decline', declineConnectionRequest);
router.delete('/connections/:id/cancel', cancelOutgoingRequest);
router.get('/connections/incoming', getIncomingRequests);
router.get('/connections/outgoing', getOutgoingRequests);
router.get('/connections', getConnections);
router.delete('/connections/:id', unfriendConnection);

// 3. Conversations
router.get('/conversations', getConversations);
router.get('/conversations/:id/messages', getMessages);
router.post('/messages', sendMessage);
router.patch('/messages/:id', editMessage);
router.delete('/messages/:id/me', deleteForMe);
router.delete('/messages/:id/everyone', deleteForEveryone);
router.post('/messages/:id/reaction', toggleReaction);
router.post('/conversations/:id/read', markMessagesRead);
router.patch('/conversations/:id/preferences', updateConversationPreferences);
router.get('/messages/search', searchMessages);

// 4. Notifications
router.get('/notifications', getNotifications);
router.post('/notifications/read-all', markNotificationsRead);

export default router;
