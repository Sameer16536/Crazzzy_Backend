import { Request, Response, NextFunction } from 'express';

export interface CustomError extends Error {
  statusCode?: number;
  status?: number;
}

/**
 * 404 Not Found handler — must be placed AFTER all routes.
 */
export function notFound(req: Request, res: Response, next: NextFunction) {
  const err = new Error(`Route not found: ${req.method} ${req.originalUrl}`) as CustomError;
  err.statusCode = 404;
  next(err);
}

/**
 * Centralised error handler — must be last middleware (4 args).
 * Formats all thrown/forwarded errors into a consistent JSON response.
 */
export function errorHandler(err: CustomError, req: Request, res: Response, next: NextFunction) {
  const statusCode = err.statusCode || err.status || 500;
  const isDev      = process.env.NODE_ENV !== 'production';

  console.error(`[Error] ${statusCode} - ${err.message}`, isDev ? err.stack : '');

  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal Server Error',
    ...(isDev && { stack: err.stack }),
  });
}

/**
 * Helper: create a custom error with a status code.
 * Usage: throw createError(400, 'Bad request message')
 */
export function createError(statusCode: number, message: string): CustomError {
  const err      = new Error(message) as CustomError;
  err.statusCode = statusCode;
  return err;
}
