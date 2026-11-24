import mongoose, { Document, Schema, Types } from 'mongoose';

export type ChatNotificationType =
  | 'CONNECTION_REQUEST_RECEIVED'
  | 'CONNECTION_REQUEST_ACCEPTED'
  | 'CONNECTION_REQUEST_DECLINED'
  | 'CONNECTION_CLOSED'
  | 'NEW_MESSAGE'
  | 'NEW_REPLY';

export interface IChatNotification extends Document {
  companyId: Types.ObjectId;
  recipientId: Types.ObjectId;
  senderId: Types.ObjectId;
  type: ChatNotificationType;
  title: string;
  message: string;
  data?: {
    connectionId?: string;
    conversationId?: string;
    messageId?: string;
  };
  isRead: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ChatNotificationSchema = new Schema<IChatNotification>(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    recipientId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    senderId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    type: {
      type: String,
      enum: [
        'CONNECTION_REQUEST_RECEIVED',
        'CONNECTION_REQUEST_ACCEPTED',
        'CONNECTION_REQUEST_DECLINED',
        'CONNECTION_CLOSED',
        'NEW_MESSAGE',
        'NEW_REPLY',
      ],
      required: true,
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    data: {
      type: Schema.Types.Mixed,
      default: {},
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

ChatNotificationSchema.index({ companyId: 1, recipientId: 1, isRead: 1, createdAt: -1 });

export const ChatNotification = mongoose.model<IChatNotification>(
  'ChatNotification',
  ChatNotificationSchema
);
