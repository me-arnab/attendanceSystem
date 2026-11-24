import { api } from './api';
import {
  IDirectoryUser,
  IConnectionRequestItem,
  IConnectedPerson,
  IConversationItem,
  IMessageItem,
  IChatNotificationItem,
} from '../types/chat';

export const chatService = {
  // Directory & Search
  getDirectory: (search?: string, departmentId?: string) => {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (departmentId) params.append('departmentId', departmentId);
    const query = params.toString() ? `?${params.toString()}` : '';
    return api.get<IDirectoryUser[]>(`/chat/directory${query}`);
  },

  // Connection Requests
  sendConnectionRequest: (recipientId: string) => {
    return api.post('/chat/connections/request', { recipientId });
  },

  acceptConnectionRequest: (connectionId: string) => {
    return api.post(`/chat/connections/${connectionId}/accept`);
  },

  declineConnectionRequest: (connectionId: string) => {
    return api.post(`/chat/connections/${connectionId}/decline`);
  },

  cancelOutgoingRequest: (connectionId: string) => {
    return api.delete(`/chat/connections/${connectionId}/cancel`);
  },

  getIncomingRequests: () => {
    return api.get<IConnectionRequestItem[]>('/chat/connections/incoming');
  },

  getOutgoingRequests: () => {
    return api.get<IConnectionRequestItem[]>('/chat/connections/outgoing');
  },

  getConnections: () => {
    return api.get<IConnectedPerson[]>('/chat/connections');
  },

  unfriendConnection: (connectionId: string) => {
    return api.delete(`/chat/connections/${connectionId}`);
  },

  // Conversations & Messages
  getConversations: () => {
    return api.get<IConversationItem[]>('/chat/conversations');
  },

  getMessages: (conversationId: string, page = 1, limit = 50) => {
    return api.get<{
      messages: IMessageItem[];
      pagination: { page: number; limit: number; total: number; pages: number };
    }>(`/chat/conversations/${conversationId}/messages?page=${page}&limit=${limit}`);
  },

  sendMessage: (conversationId: string, content: string, replyToMessageId?: string) => {
    return api.post<IMessageItem>('/chat/messages', {
      conversationId,
      content,
      replyToMessageId,
    });
  },

  editMessage: (messageId: string, content: string) => {
    return api.patch(`/chat/messages/${messageId}`, { content });
  },

  deleteForMe: (messageId: string) => {
    return api.delete(`/chat/messages/${messageId}/me`);
  },

  deleteForEveryone: (messageId: string) => {
    return api.delete(`/chat/messages/${messageId}/everyone`);
  },

  toggleReaction: (messageId: string, emoji: string) => {
    return api.post(`/chat/messages/${messageId}/reaction`, { emoji });
  },

  markConversationRead: (conversationId: string) => {
    return api.post(`/chat/conversations/${conversationId}/read`);
  },

  updatePreferences: (
    conversationId: string,
    prefs: { isPinned?: boolean; isArchived?: boolean; isMuted?: boolean }
  ) => {
    return api.patch(`/chat/conversations/${conversationId}/preferences`, prefs);
  },

  searchMessages: (q: string, conversationId?: string) => {
    const params = new URLSearchParams({ q });
    if (conversationId) params.append('conversationId', conversationId);
    return api.get<IMessageItem[]>(`/chat/messages/search?${params.toString()}`);
  },

  getNotifications: () => {
    return api.get<{ notifications: IChatNotificationItem[]; unreadCount: number }>(
      '/chat/notifications'
    );
  },

  markNotificationsRead: () => {
    return api.post('/chat/notifications/read-all');
  },
};
