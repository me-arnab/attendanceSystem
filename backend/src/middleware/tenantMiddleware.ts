import { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { sendError } from '../utils/response';

declare global {
  namespace Express {
    interface Request {
      tenantCompanyId?: Types.ObjectId;
    }
  }
}

/**
 * Ensures request belongs strictly to the authenticated company tenant.
 * Discards any incoming companyId in query or body, binding strictly to token's companyId.
 */
export const requireTenant = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) {
    sendError(res, 'Authentication required.', 401);
    return;
  }

  if (req.user.role === 'SUPER_ADMIN') {
    // Super admins can explicitly pass companyId in params if required
    next();
    return;
  }

  if (!req.user.companyId) {
    sendError(res, 'Access denied: User does not belong to any tenant company.', 403);
    return;
  }

  if (!req.company || req.company.status !== 'active') {
    sendError(res, 'Access denied: Company is inactive or suspended.', 403);
    return;
  }

  req.tenantCompanyId = req.user.companyId;

  // Never trust user-supplied companyId
  if (req.body && typeof req.body === 'object') {
    req.body.companyId = req.user.companyId;
  }
  if (req.query && typeof req.query === 'object') {
    req.query.companyId = req.user.companyId.toString();
  }

  next();
};
