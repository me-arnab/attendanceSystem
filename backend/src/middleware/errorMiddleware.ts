import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { sendError } from '../utils/response';

export const errorHandler = (
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  console.error('[Error Middleware]', err);

  // Handle Zod Validation Errors
  if (err instanceof ZodError) {
    const formattedErrors = err.issues.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    sendError(res, 'Validation error', 422, formattedErrors);
    return;
  }

  // Handle Mongoose Duplicate Key Error (E11000)
  if (err.code === 11000) {
    const keys = Object.keys(err.keyValue || {});
    const key = keys[0] || 'field';
    const val = err.keyValue ? err.keyValue[key] : '';
    sendError(res, `A duplicate record already exists for ${key}: "${val}".`, 409);
    return;
  }

  // Handle CastError (invalid ObjectId)
  if (err.name === 'CastError') {
    sendError(res, `Invalid ID format for ${err.path}.`, 400);
    return;
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    sendError(res, 'Invalid authentication token.', 401);
    return;
  }

  if (err.name === 'TokenExpiredError') {
    sendError(res, 'Authentication token has expired.', 401);
    return;
  }

  // Default internal server error
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal server error';
  sendError(res, message, statusCode);
};
