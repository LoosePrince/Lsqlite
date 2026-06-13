import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieSession from 'cookie-session';
import path from 'node:path';
import fs from 'node:fs';
import type { AppConfig } from './config.js';
import { SiteStore } from './site-store.js';
import { clearSession, getSessionAdmin, readBearerToken, requireAdmin, setSessionAdmin } from './auth.js';
import { asyncRoute, errorHandler, HttpError, notFound } from './http.js';
import { createDatabaseSchema, loginSchema, querySchema, rotateKeySchema, transactionSchema, updateDatabaseSchema } from './schemas.js';
import { executeSql, executeTransaction, getSchema } from './sqlite-service.js';
import { safeCompare } from './utils.js';

export type AppContext = {
  config: AppConfig;
  store: SiteStore;
};

export function createApp(context: AppContext) {
  const app = express();

  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(
    cors({
      origin: context.config.CORS_ORIGIN || true,
      credentials: true
    })
  );
  app.use(express.json({ limit: '2mb' }));
  app.use(
    cookieSession({
      name: 'lsqlite_session',
      keys: [context.config.SESSION_SECRET],
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      maxAge: 1000 * 60 * 60 * 8
    })
  );

  app.get('/api/health', (_request, response) => {
    response.json({ ok: true, service: 'lsqlite' });
  });

  app.post(
    '/admin/login',
    asyncRoute((request, response) => {
      const body = loginSchema.parse(request.body);
      const userOk = safeCompare(body.username, context.config.ADMIN_USER);
      const passwordOk = safeCompare(body.password, context.config.ADMIN_PASSWORD);
      if (!userOk || !passwordOk) {
        throw new HttpError('invalid admin credentials', 401, 'INVALID_CREDENTIALS');
      }
      setSessionAdmin(request, body.username);
      context.store.audit({ actor: body.username, action: 'admin.login' });
      response.json({ ok: true, admin: { username: body.username } });
    })
  );

  app.post('/admin/logout', requireAdmin, (request, response) => {
    clearSession(request);
    response.json({ ok: true });
  });

  app.get('/admin/me', (request, response) => {
    response.json({ ok: true, admin: getSessionAdmin(request) });
  });

  app.get('/admin/databases', requireAdmin, (_request, response) => {
    response.json({ ok: true, databases: context.store.listDatabases() });
  });

  app.post(
    '/admin/databases',
    requireAdmin,
    asyncRoute((request, response) => {
      const body = createDatabaseSchema.parse(request.body);
      const result = context.store.createDatabase(body);
      context.store.audit({ databaseId: result.database.id, actor: 'admin', action: 'database.create', detail: { name: body.name } });
      response.status(201).json({ ok: true, ...result });
    })
  );

  app.patch(
    '/admin/databases/:id',
    requireAdmin,
    asyncRoute((request, response) => {
      const body = updateDatabaseSchema.parse(request.body);
      const database = context.store.updateDatabase(getRouteParam(request, 'id'), body);
      context.store.audit({ databaseId: database.id, actor: 'admin', action: 'database.update', detail: body });
      response.json({ ok: true, database });
    })
  );

  app.post(
    '/admin/databases/:id/rotate-key',
    requireAdmin,
    asyncRoute((request, response) => {
      const body = rotateKeySchema.parse(request.body);
      const result = context.store.rotateKey(getRouteParam(request, 'id'), body.key);
      context.store.audit({ databaseId: result.database.id, actor: 'admin', action: 'database.rotate_key' });
      response.json({ ok: true, ...result });
    })
  );

  app.get(
    '/admin/databases/:id/schema',
    requireAdmin,
    asyncRoute((request, response) => {
      const database = context.store.getByIdRequired(getRouteParam(request, 'id'));
      response.json({ ok: true, database: context.store.toPublic(database), schema: getSchema(database) });
    })
  );

  app.post(
    '/admin/databases/:id/query',
    requireAdmin,
    asyncRoute((request, response) => {
      const body = querySchema.parse(request.body);
      const database = context.store.getByIdRequired(getRouteParam(request, 'id'));
      const results = executeSql(database, { ...body, allowDangerous: true });
      context.store.audit({ databaseId: database.id, actor: 'admin', action: 'database.query', detail: { sql: body.sql } });
      response.json({ ok: true, results });
    })
  );

  app.post(
    '/api/query',
    asyncRoute((request, response) => {
      const database = requireDatabaseByKey(context, request);
      const body = querySchema.parse(request.body);
      const results = executeSql(database, body);
      context.store.markAccess(database.id);
      response.json({ ok: true, database: { id: database.id, name: database.name }, results });
    })
  );

  app.post(
    '/api/transaction',
    asyncRoute((request, response) => {
      const database = requireDatabaseByKey(context, request);
      const body = transactionSchema.parse(request.body);
      const results = executeTransaction(database, body);
      context.store.markAccess(database.id);
      response.json({ ok: true, database: { id: database.id, name: database.name }, results });
    })
  );

  const webDir = path.resolve(process.cwd(), 'dist/web');
  if (fs.existsSync(webDir)) {
    app.use(express.static(webDir));
    app.use((request, response, next) => {
      if (request.method !== 'GET' || request.path.startsWith('/api') || request.path.startsWith('/admin')) {
        next();
        return;
      }
      response.sendFile(path.join(webDir, 'index.html'));
    });
  }

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

function requireDatabaseByKey(context: AppContext, request: express.Request) {
  const token = readBearerToken(request);
  if (!token) {
    throw new HttpError('database key is required', 401, 'DATABASE_KEY_REQUIRED');
  }
  const database = context.store.getByKey(token);
  if (!database || database.status !== 'active') {
    throw new HttpError('database key is invalid or disabled', 403, 'DATABASE_KEY_INVALID');
  }
  return database;
}

function getRouteParam(request: express.Request, name: string) {
  const value = request.params[name];
  if (typeof value !== 'string' || !value) {
    throw new HttpError(`route param ${name} is required`, 400, 'ROUTE_PARAM_REQUIRED');
  }
  return value;
}