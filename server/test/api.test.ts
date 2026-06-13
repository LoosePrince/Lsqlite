import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
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
});