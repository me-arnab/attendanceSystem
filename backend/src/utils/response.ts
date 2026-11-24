import { Response } from 'express';

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  errors?: any;
}

export const sendSuccess = <T>(
  res: Response,
  data?: T,
  message?: string,
  statusCode = 200
): Response => {
  const payload: ApiResponse<T> = {
    success: true,
  };
  if (message) payload.message = message;
  if (data !== undefined) payload.data = data;
  return res.status(statusCode).json(payload);
};

export const sendError = (
  res: Response,
  error: string,
  statusCode = 400,
  errors?: any
): Response => {
  const payload: ApiResponse = {
    success: false,
    error,
  };
  if (errors) payload.errors = errors;
  return res.status(statusCode).json(payload);
};
