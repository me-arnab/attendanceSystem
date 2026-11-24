import { Types } from 'mongoose';
import { AuditLog } from '../models/AuditLog';

export interface CreateAuditLogParams {
  companyId?: string | Types.ObjectId | null;
  actorId: string | Types.ObjectId;
  actorName: string;
  actorRole: string;
  action: string;
  entityType: string;
  entityId: string;
  details?: Record<string, any>;
  ipAddress?: string;
}

export const logAudit = async (params: CreateAuditLogParams): Promise<void> => {
  try {
    await AuditLog.create({
      companyId: params.companyId ? new Types.ObjectId(params.companyId.toString()) : null,
      actorId: new Types.ObjectId(params.actorId.toString()),
      actorName: params.actorName,
      actorRole: params.actorRole,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      details: params.details || {},
      ipAddress: params.ipAddress || '',
    });
  } catch (error) {
    console.error('[AuditLog] Failed to record audit log:', error);
  }
};
