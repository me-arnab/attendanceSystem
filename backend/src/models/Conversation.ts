import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IUserChatPreference {
  userId: Types.ObjectId;
  isPinned: boolean;
  isArchived: boolean;
  isMuted: boolean;
  lastReadAt?: Date | null;
  clearHistoryBefore?: Date | null;
}

export interface IConversation extends Document {
  companyId: Types.ObjectId;
  pairKey: string; // Unique string "userA:userB" with userA < userB
  participants: [Types.ObjectId, Types.ObjectId]; // Sorted pair [userA, userB]
  lastMessage?: {
    messageId: Types.ObjectId;
    senderId: Types.ObjectId;
    content: string;
    createdAt: Date;
    isDeletedForEveryone: boolean;
  };
  lastActivityAt: Date;
  userPreferences: IUserChatPreference[];
  createdAt: Date;
  updatedAt: Date;
}

const UserChatPreferenceSchema = new Schema<IUserChatPreference>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    isPinned: { type: Boolean, default: false },
    isArchived: { type: Boolean, default: false },
    isMuted: { type: Boolean, default: false },
    lastReadAt: { type: Date, default: null },
    clearHistoryBefore: { type: Date, default: null },
  },
  { _id: false }
);

const ConversationSchema = new Schema<IConversation>(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    pairKey: {
      type: String,
      required: true,
    },
    participants: {
      type: [Schema.Types.ObjectId],
      ref: 'User',
      required: true,
    },
    lastMessage: {
      messageId: { type: Schema.Types.ObjectId, ref: 'Message' },
      senderId: { type: Schema.Types.ObjectId, ref: 'User' },
      content: { type: String, default: '' },
      createdAt: { type: Date },
      isDeletedForEveryone: { type: Boolean, default: false },
    },
    lastActivityAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    userPreferences: {
      type: [UserChatPreferenceSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

ConversationSchema.index({ companyId: 1, pairKey: 1 }, { unique: true });
ConversationSchema.index({ companyId: 1, participants: 1 });
ConversationSchema.index({ companyId: 1, 'userPreferences.userId': 1, lastActivityAt: -1 });

export const Conversation = mongoose.model<IConversation>('Conversation', ConversationSchema);
