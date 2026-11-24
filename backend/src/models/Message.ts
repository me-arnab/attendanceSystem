import mongoose, { Document, Schema, Types } from 'mongoose';

export type DeliveryStatus = 'sent' | 'delivered' | 'read';

export interface IEmojiReaction {
  userId: Types.ObjectId;
  emoji: string; // '👍' | '❤️' | '😂' | '😮' | '😢' | '👏'
  createdAt: Date;
}

export interface IReplyTo {
  messageId: Types.ObjectId;
  senderId: Types.ObjectId;
  content: string;
  isDeleted: boolean;
}

export interface IMessage extends Document {
  companyId: Types.ObjectId;
  conversationId: Types.ObjectId;
  senderId: Types.ObjectId;
  recipientId: Types.ObjectId;
  content: string;
  status: DeliveryStatus;
  isEdited: boolean;
  editedAt?: Date | null;
  isDeletedForEveryone: boolean;
  deletedForEveryoneAt?: Date | null;
  deletedForUsers: Types.ObjectId[]; // List of userIds who chose "Delete for me"
  replyTo?: IReplyTo | null;
  reactions: IEmojiReaction[];
  deliveredAt?: Date | null;
  readAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const EmojiReactionSchema = new Schema<IEmojiReaction>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    emoji: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const ReplyToSchema = new Schema<IReplyTo>(
  {
    messageId: { type: Schema.Types.ObjectId, ref: 'Message', required: true },
    senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, default: '' },
    isDeleted: { type: Boolean, default: false },
  },
  { _id: false }
);

const MessageSchema = new Schema<IMessage>(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
      index: true,
    },
    senderId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    recipientId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['sent', 'delivered', 'read'],
      default: 'sent',
      index: true,
    },
    isEdited: {
      type: Boolean,
      default: false,
    },
    editedAt: {
      type: Date,
      default: null,
    },
    isDeletedForEveryone: {
      type: Boolean,
      default: false,
    },
    deletedForEveryoneAt: {
      type: Date,
      default: null,
    },
    deletedForUsers: {
      type: [Schema.Types.ObjectId],
      ref: 'User',
      default: [],
    },
    replyTo: {
      type: ReplyToSchema,
      default: null,
    },
    reactions: {
      type: [EmojiReactionSchema],
      default: [],
    },
    deliveredAt: {
      type: Date,
      default: null,
    },
    readAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

MessageSchema.index({ conversationId: 1, createdAt: -1 });
MessageSchema.index({ companyId: 1, recipientId: 1, status: 1 });
MessageSchema.index({ companyId: 1, conversationId: 1, createdAt: 1 });

export const Message = mongoose.model<IMessage>('Message', MessageSchema);
