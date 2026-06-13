import type { Request, Response, NextFunction } from 'express';
import { HttpError } from './http.js';

export function getSessionAdmin(request: Request) {
  const session = request.session as { admin?: { username: string } } | undefined;
  return session?.admin || null;
}

export function setSessionAdmin(request: Request, username: string) {
  request.session = request.session || {};
  (request.session as { admin?: { username: string } }).admin = { username };
}

export function clearSession(request: Request) {
  request.session = null;
}

export function requireAdmin(request: Request, _response: Response, next: NextFunction) {
  if (!getSessionAdmin(request)) {
    next(new HttpError('admin login required', 401, 'ADMIN_LOGIN_REQUIRED'));
    return;
  }
  next();
}

export function readBearerToken(request: Request) {
  const auth = request.header('authorization') || '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}