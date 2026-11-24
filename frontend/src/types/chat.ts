export type ConnectionStatus = 'NONE' | 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'CLOSED';

export interface IDirectoryUser {
  _id: string;
  fullName: string;
  employeeId?: string;
  designation?: string;
  department: string;
  role: 'COMPANY_ADMIN' | 'EMPLOYEE';
  isOnline: boolean;
  lastSeen?: string | null;
  connectionStatus: ConnectionStatus;
  isRequester: boolean;
  canSendRequest: boolean;
  declineCooloffExpiresAt?: string | null;
  connectionId?: string | null;
}

export interface IConnectionRequestItem {
  _id: string;
  companyId: string;
  requesterId: any;
  recipientId: any;
  status: ConnectionStatus;
  createdAt: string;
  updatedAt: string;
}

export interface IConnectedPerson {
  _id: string; // connectionId
  user: {
    _id: string;
    fullName: string;
    employeeId?: string;
    designation?: string;
    department: string;
    role: string;
    status: string;
    isOnline: boolean;
    lastSeen?: string | null;
  } | null;
  connectedAt: string;
}

export interface IEmojiReaction {
  userId: string;
  emoji: string;
  createdAt: string;
}

export interface IReplyToPreview {
  messageId: string;
  senderId: string;
  content: string;
  isDeleted: boolean;
}

export interface IMessageItem {
  _id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  recipientId: string;
  content: string;
  status: 'sent' | 'delivered' | 'read';
  isEdited: boolean;
  editedAt?: string | null;
  isDeletedForEveryone: boolean;
  replyTo?: IReplyToPreview | null;
  reactions: IEmojiReaction[];
  deliveredAt?: string | null;
  readAt?: string | null;
  createdAt: string;
}

export interface IConversationItem {
  _id: string;
  participant: {
    _id: string;
    fullName: string;
    employeeId?: string;
    designation?: string;
    department: string;
    role: string;
    status: string;
    isOnline: boolean;
    lastSeen?: string | null;
  };
  lastMessage?: {
    messageId: string;
    senderId: string;
    content: string;
    createdAt: string;
    isDeletedForEveryone: boolean;
  } | null;
  lastActivityAt: string;
  unreadCount: number;
  isPinned: boolean;
  isArchived: boolean;
  isMuted: boolean;
  isConnected: boolean;
  connectionStatus: ConnectionStatus;
  connectionId?: string | null;
}

export interface IChatNotificationItem {
  _id: string;
  recipientId: string;
  senderId: string;
  type: string;
  title: string;
  message: string;
  data?: any;
  isRead: boolean;
  createdAt: string;
}
