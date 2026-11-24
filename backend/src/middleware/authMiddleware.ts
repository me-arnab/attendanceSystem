import { Request, Response, NextFunction } from 'express';
import { verifyToken, TokenPayload } from '../utils/jwt';
import { User, IUser } from '../models/User';
import { Company, ICompany } from '../models/Company';
import { sendError } from '../utils/response';

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      user?: IUser;
      company?: ICompany | null;
      tokenPayload?: TokenPayload;
    }
  }
}

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      sendError(res, 'Authentication required. No token provided.', 401);
      return;
    }

    const token = authHeader.split(' ')[1];
    let payload: TokenPayload;
    try {
      payload = verifyToken(token);
    } catch (err: any) {
      sendError(res, 'Invalid or expired token.', 401);
      return;
    }

    req.tokenPayload = payload;

    // Fetch user from DB
    const user = await User.findById(payload.userId);
    if (!user) {
      sendError(res, 'User account not found.', 401);
      return;
    }

    if (user.status !== 'active') {
      sendError(res, 'User account is deactivated. Contact administrator.', 403);
      return;
    }

    req.user = user;

    // If non-super-admin user, validate company
    if (user.role !== 'SUPER_ADMIN') {
      if (!user.companyId) {
        sendError(res, 'Account is not associated with any company.', 403);
        return;
      }

      const company = await Company.findById(user.companyId);
      if (!company) {
        sendError(res, 'Associated company does not exist.', 403);
        return;
      }

      if (company.status === 'suspended') {
        sendError(res, 'Company account is currently suspended. Access denied.', 403);
        return;
      }

      req.company = company;
    } else {
      req.company = null;
    }

    next();
  } catch (error: any) {
    console.error('[AuthMiddleware] Error:', error);
    sendError(res, 'Authentication failure.', 500);
  }
};
