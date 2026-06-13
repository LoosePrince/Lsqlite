import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { AppConfig } from '../src/config.js';
import { SiteStore } from '../src/site-store.js';

let root: string;
let store: SiteStore;
let app: ReturnType<typeof createApp>;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'lsqlite-'));
  const config: AppConfig = {
    PORT: 3000,
    SITE_DB_PATH: path.join(root, 'site.sqlite'),
    DATA_DIR: path.join(root, 'dbs'),
    ADMIN_USER: 'admin',
    ADMIN_PASSWORD: 'password123',
    SESSION_SECRET: 'test-secret-test-secret',
    siteDbPath: path.join(root, 'site.sqlite'),
    dataDir: path.join(root, 'dbs')
  };
  store = new SiteStore(config);
  app = createApp({ config, store });
});

afterEach(() => {
  store.close();
  fs.rmSync(root, { recursive: true, force: true });
});

describe('Lsqlite API', () => {
  it('creates a database from admin and accesses it by key', async () => {
    const agent = request.agent(app);

    await agent.post('/admin/login').send({ username: 'admin', password: 'password123' }).expect(200);

    const created = await agent.post('/admin/databases').send({ name: 'demo' }).expect(201);
    const key = created.body.key as string;

    await request(app)
      .post('/api/query')
      .set('Authorization', `Bearer ${key}`)
      .send({ sql: 'create table users(id integer primary key autoincrement, name text not null)', mode: 'write' })
      .expect(200);

    await request(app)
      .post('/api/query')
      .set('Authorization', `Bearer ${key}`)
      .send({ sql: 'insert into users(name) values (?)', params: ['Ada'], mode: 'write' })
      .expect(200);

    const queried = await request(app)
      .post('/api/query')
      .set('Authorization', `Bearer ${key}`)
      .send({ sql: 'select id, name from users', mode: 'read' })
      .expect(200);

    expect(queried.body.results[0].rows).toEqual([{ id: 1, name: 'Ada' }]);
  });

  it('rejects invalid keys and dangerous external sql', async () => {
    const agent = request.agent(app);
    await agent.post('/admin/login').send({ username: 'admin', password: 'password123' }).expect(200);
    const created = await agent.post('/admin/databases').send({ name: 'safe' }).expect(201);

    await request(app).post('/api/query').send({ sql: 'select 1' }).expect(401);

    await request(app)
      .post('/api/query')
      .set('Authorization', `Bearer ${created.body.key}`)
      .send({ sql: "attach database 'x.sqlite' as x" })
      .expect(403);
  });

  it('keeps database files isolated by key', async () => {
    const agent = request.agent(app);
    await agent.post('/admin/login').send({ username: 'admin', password: 'password123' }).expect(200);
    const first = await agent.post('/admin/databases').send({ name: 'first' }).expect(201);
    const second = await agent.post('/admin/databases').send({ name: 'second' }).expect(201);

    await request(app)
      .post('/api/query')
      .set('Authorization', `Bearer ${first.body.key}`)
      .send({ sql: 'create table marker(value text); insert into marker(value) values (\'first\')' })
      .expect(200);

    const isolated = await request(app)
      .post('/api/query')
      .set('Authorization', `Bearer ${second.body.key}`)
      .send({ sql: "select name from sqlite_schema where type = 'table' and name = 'marker'", mode: 'read' })
      .expect(200);

    expect(isolated.body.results[0].rows).toEqual([]);
  });

  it('manages database metadata, deletion lifecycle, and key accessibility', async () => {
    const agent = request.agent(app);
    await agent.post('/admin/login').send({ username: 'admin', password: 'password123' }).expect(200);

    const created = await agent.post('/admin/databases').send({ name: 'lifecycle', note: 'first note' }).expect(201);
    const id = created.body.database.id as string;
    const key = created.body.key as string;
    const filePath = created.body.database.absolutePath as string;

    const updated = await agent.patch(`/admin/databases/${id}`).send({ name: 'lifecycle renamed', note: 'updated note', status: 'disabled' }).expect(200);
    expect(updated.body.database).toMatchObject({ name: 'lifecycle renamed', note: 'updated note', status: 'disabled' });

    await request(app)
      .post('/api/query')
      .set('Authorization', `Bearer ${key}`)
      .send({ sql: 'select 1', mode: 'read' })
      .expect(403);

    await agent.patch(`/admin/databases/${id}`).send({ status: 'active' }).expect(200);
    await agent.delete(`/admin/databases/${id}`).expect(200);

    const deletedList = await agent.get('/admin/databases?status=deleted').expect(200);
    expect(deletedList.body.databases).toHaveLength(1);
    expect(deletedList.body.databases[0]).toMatchObject({ id, status: 'deleted' });

    await request(app)
      .post('/api/query')
      .set('Authorization', `Bearer ${key}`)
      .send({ sql: 'select 1', mode: 'read' })
      .expect(403);

    const restored = await agent.post(`/admin/databases/${id}/restore`).expect(200);
    expect(restored.body.database.status).toBe('active');

    await request(app)
      .post('/api/query')
      .set('Authorization', `Bearer ${key}`)
      .send({ sql: 'select 1 as ok', mode: 'read' })
      .expect(200);

    await agent.delete(`/admin/databases/${id}/permanent`).send({ confirmName: 'wrong name' }).expect(400);
    await agent.delete(`/admin/databases/${id}/permanent`).send({ confirmName: 'lifecycle renamed' }).expect(200);

    const allList = await agent.get('/admin/databases?status=all').expect(200);
    expect(allList.body.databases.some((database: { id: string }) => database.id === id)).toBe(false);
    expect(fs.existsSync(filePath)).toBe(false);
  });

  it('manages table schema and table rows through admin APIs', async () => {
    const agent = request.agent(app);
    await agent.post('/admin/login').send({ username: 'admin', password: 'password123' }).expect(200);

    const created = await agent.post('/admin/databases').send({ name: 'managed' }).expect(201);
    const id = created.body.database.id as string;

    const table = await agent
      .post(`/admin/databases/${id}/tables`)
      .send({
        name: 'items',
        columns: [
          { name: 'id', type: 'integer', primaryKey: true },
          { name: 'name', type: 'text', notNull: true }
        ]
      })
      .expect(201);
    expect(table.body.table.name).toBe('items');

    await agent.post(`/admin/databases/${id}/tables/items/columns`).send({ name: 'note', type: 'text' }).expect(201);
    await agent.post(`/admin/databases/${id}/tables/items/indexes`).send({ name: 'idx_items_name', columns: ['name'] }).expect(201);

    const tables = await agent.get(`/admin/databases/${id}/tables`).expect(200);
    expect(tables.body.tables[0]).toMatchObject({ name: 'items', type: 'table', rowCount: 0 });
    expect(tables.body.tables[0].columns.map((column: { name: string }) => column.name)).toContain('note');
    expect(tables.body.tables[0].indexes.map((index: { name: string }) => index.name)).toContain('idx_items_name');

    const inserted = await agent.post(`/admin/databases/${id}/tables/items/rows`).send({ values: { name: 'Ada', note: 'first' } }).expect(201);
    expect(inserted.body.result.changes).toBe(1);

    const rows = await agent.get(`/admin/databases/${id}/tables/items/rows?limit=10&offset=0&orderBy=id&order=desc`).expect(200);
    expect(rows.body.result.total).toBe(1);
    expect(rows.body.result.rows[0]).toMatchObject({ id: 1, name: 'Ada', note: 'first' });

    await agent.patch(`/admin/databases/${id}/tables/items/rows`).send({ values: { note: 'updated' }, where: { id: 1 } }).expect(200);
    const updated = await agent.get(`/admin/databases/${id}/tables/items/rows?limit=10&offset=0`).expect(200);
    expect(updated.body.result.rows[0]).toMatchObject({ id: 1, note: 'updated' });

    await agent.patch(`/admin/databases/${id}/tables/items/rows`).send({ values: { note: 'blocked' }, where: {} }).expect(400);
    await agent.delete(`/admin/databases/${id}/tables/items/rows`).send({ where: {} }).expect(400);
    await agent.delete(`/admin/databases/${id}/tables/items/rows`).send({ where: { id: 1 } }).expect(200);

    const empty = await agent.get(`/admin/databases/${id}/tables/items/rows?limit=10&offset=0`).expect(200);
    expect(empty.body.result.total).toBe(0);

    await agent.delete(`/admin/databases/${id}/tables/items/indexes/idx_items_name`).expect(200);
    await agent.delete(`/admin/databases/${id}/tables/items`).send({ confirmName: 'items' }).expect(200);
    await agent.get(`/admin/databases/${id}/tables`).expect(200).expect((response) => {
      expect(response.body.tables).toEqual([]);
    });
  });

  it('repairs legacy audit foreign key references to databases_old', async () => {
    store.close();

    const legacyDb = new Database(path.join(root, 'site.sqlite'));
    legacyDb.pragma('foreign_keys = OFF');
    legacyDb.exec(`
      alter table databases rename to databases_old;
      create table databases (
        id text primary key,
        name text not null,
        filename text not null unique,
        path text not null unique,
        key_hash text not null unique,
        status text not null check (status in ('active', 'disabled', 'deleted')),
        note text,
        created_at text not null,
        updated_at text not null,
        last_access_at text,
        deleted_at text
      );
      drop table databases_old;
    `);
    legacyDb.close();

    const config: AppConfig = {
      PORT: 3000,
      SITE_DB_PATH: path.join(root, 'site.sqlite'),
      DATA_DIR: path.join(root, 'dbs'),
      ADMIN_USER: 'admin',
      ADMIN_PASSWORD: 'password123',
      SESSION_SECRET: 'test-secret-test-secret',
      siteDbPath: path.join(root, 'site.sqlite'),
      dataDir: path.join(root, 'dbs')
    };
    store = new SiteStore(config);
    app = createApp({ config, store });

    const agent = request.agent(app);
    await agent.post('/admin/login').send({ username: 'admin', password: 'password123' }).expect(200);
    const created = await agent.post('/admin/databases').send({ name: 'legacy repaired' }).expect(201);
    const id = created.body.database.id as string;

    await agent
      .post(`/admin/databases/${id}/tables`)
      .send({ name: 'items', columns: [{ name: 'id', type: 'integer', primaryKey: true }] })
      .expect(201);

    const checkDb = new Database(path.join(root, 'site.sqlite'), { readonly: true });
    const auditDdl = checkDb.prepare("select sql from sqlite_schema where type = 'table' and name = 'audit_logs'").get() as { sql: string };
    const oldTable = checkDb.prepare("select name from sqlite_schema where type = 'table' and name = 'databases_old'").get();
    checkDb.close();

    expect(auditDdl.sql).toContain('references databases(id)');
    expect(auditDdl.sql).not.toContain('databases_old');
    expect(oldTable).toBeUndefined();
  });

  it('returns database statistics and audit logs', async () => {
    const agent = request.agent(app);
    await agent.post('/admin/login').send({ username: 'admin', password: 'password123' }).expect(200);
    const created = await agent.post('/admin/databases').send({ name: 'observable' }).expect(201);
    const id = created.body.database.id as string;

    await agent
      .post(`/admin/databases/${id}/tables`)
      .send({ name: 'events', columns: [{ name: 'id', type: 'integer', primaryKey: true }, { name: 'message', type: 'text' }] })
      .expect(201);
    await agent.post(`/admin/databases/${id}/tables/events/rows`).send({ values: { message: 'created' } }).expect(201);

    const stats = await agent.get(`/admin/databases/${id}/stats`).expect(200);
    expect(stats.body.stats.tableCount).toBe(1);
    expect(stats.body.stats.rows).toEqual([{ name: 'events', rowCount: 1 }]);

    const logs = await agent.get(`/admin/audit-logs?databaseId=${id}`).expect(200);
    expect(logs.body.logs.map((log: { action: string }) => log.action)).toEqual(expect.arrayContaining(['database.create', 'table.create', 'table.row.insert']));
  });
});