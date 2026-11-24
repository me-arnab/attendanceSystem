import mongoose, { Document, Schema, Types } from 'mongoose';

export type ConnectionStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'CLOSED';

export interface IConnection extends Document {
  companyId: Types.ObjectId;
  requesterId: Types.ObjectId; // User who initiated the latest request
  recipientId: Types.ObjectId; // User who was sent the latest request
  pairKey: string; // Unique string "userA:userB" with userA < userB
  users: [Types.ObjectId, Types.ObjectId]; // Pair [userA, userB]
  status: ConnectionStatus;
  declinedAt?: Date | null;
  declinedBy?: Types.ObjectId | null;
  closedAt?: Date | null;
  closedBy?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const ConnectionSchema = new Schema<IConnection>(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    requesterId: {
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
    pairKey: {
      type: String,
      required: true,
    },
    users: {
      type: [Schema.Types.ObjectId],
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: ['PENDING', 'ACCEPTED', 'DECLINED', 'CLOSED'],
      default: 'PENDING',
      required: true,
      index: true,
    },
    declinedAt: {
      type: Date,
      default: null,
    },
    declinedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    closedAt: {
      type: Date,
      default: null,
    },
    closedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// One unique relationship record per company + pairKey
ConnectionSchema.index({ companyId: 1, pairKey: 1 }, { unique: true });
ConnectionSchema.index({ companyId: 1, users: 1 });
ConnectionSchema.index({ companyId: 1, requesterId: 1, status: 1 });
ConnectionSchema.index({ companyId: 1, recipientId: 1, status: 1 });
ConnectionSchema.index({ companyId: 1, status: 1 });

export const Connection = mongoose.model<IConnection>('Connection', ConnectionSchema);
