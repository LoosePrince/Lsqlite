import type { NextFunction, Request, Response } from 'express';

export class HttpError extends Error {
  constructor(
    message: string,
    readonly status = 500,
    readonly code = 'INTERNAL_ERROR',
    readonly detail?: unknown
  ) {
    super(message);
  }
}

export function notFound(_request: Request, _response: Response, next: NextFunction) {
  next(new HttpError('route not found', 404, 'NOT_FOUND'));
}

export function errorHandler(error: unknown, _request: Request, response: Response, _next: NextFunction) {
  const err = normalizeError(error);
  response.status(err.status).json({
    ok: false,
    error: {
      code: err.code,
      message: err.message,
      detail: err.detail
    }
  });
}

export function asyncRoute(handler: (request: Request, response: Response, next: NextFunction) => Promise<unknown> | unknown) {
  return (request: Request, response: Response, next: NextFunction) => {
    Promise.resolve(handler(request, response, next)).catch(next);
  };
}

export function normalizeError(error: unknown): HttpError {
  if (error instanceof HttpError) {
    return error;
  }

  if (error instanceof Error) {
    const maybeStatus = (error as Error & { status?: number }).status;
    return new HttpError(error.message, maybeStatus || 500, maybeStatus ? 'REQUEST_ERROR' : 'INTERNAL_ERROR');
  }

  return new HttpError('unknown error', 500, 'INTERNAL_ERROR', error);
}