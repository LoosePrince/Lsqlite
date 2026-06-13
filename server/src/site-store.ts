import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import type { AppConfig } from './config.js';
import type { DatabaseStatus, ManagedDatabase } from './types.js';
import { nowIso, randomKey, sha256, toSlug } from './utils.js';

export type CreateDatabaseInput = {
  name: string;
  key?: string;
  note?: string;
};

export type CreateDatabaseResult = {
  database: PublicDatabaseRecord;
  key: string;
};

export type PublicDatabaseRecord = Omit<ManagedDatabase, 'path' | 'keyHash'> & {
  absolutePath: string;
};

export class SiteStore {
  private readonly db: Database.Database;

  constructor(private readonly config: AppConfig) {
    fs.mkdirSync(path.dirname(config.siteDbPath), { recursive: true });
    fs.mkdirSync(config.dataDir, { recursive: true });
    this.db = new Database(config.siteDbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.migrate();
  }

  close() {
    this.db.close();
  }

  createDatabase(input: CreateDatabaseInput): CreateDatabaseResult {
    const now = nowIso();
    const id = cryptoRandomId();
    const slug = toSlug(input.name) || 'database';
    const filename = `${slug}-${id}.sqlite`;
    const dbPath = this.resolveDatabasePath(filename);
    const key = input.key?.trim() || randomKey();

    if (this.getByKey(key)) {
      throw Object.assign(new Error('database key already exists'), { status: 409 });
    }

    new Database(dbPath).close();

    this.db
      .prepare(
        `insert into databases (
          id, name, filename, path, key_hash, status, note, created_at, updated_at, last_access_at
        ) values (?, ?, ?, ?, ?, 'active', ?, ?, ?, null)`
      )
      .run(id, input.name.trim(), filename, dbPath, sha256(key), input.note?.trim() || null, now, now);

    return {
      database: this.toPublic(this.getByIdRequired(id)),
      key
    };
  }

  listDatabases(): PublicDatabaseRecord[] {
    return (this.db
      .prepare('select * from databases order by created_at desc')
      .all() as unknown[])
      .map((row: unknown) => this.toPublic(this.fromRow(row)));
  }

  getById(id: string): ManagedDatabase | null {
    const row = this.db.prepare('select * from databases where id = ?').get(id);
    return row ? this.fromRow(row) : null;
  }

  getByIdRequired(id: string): ManagedDatabase {
    const found = this.getById(id);
    if (!found) {
      throw Object.assign(new Error('database not found'), { status: 404 });
    }
    return found;
  }

  getByKey(key: string): ManagedDatabase | null {
    const row = this.db.prepare('select * from databases where key_hash = ?').get(sha256(key));
    return row ? this.fromRow(row) : null;
  }

  rotateKey(id: string, key?: string) {
    const nextKey = key?.trim() || randomKey();
    const existing = this.getByKey(nextKey);
    if (existing && existing.id !== id) {
      throw Object.assign(new Error('database key already exists'), { status: 409 });
    }
    const now = nowIso();
    const result = this.db
      .prepare('update databases set key_hash = ?, updated_at = ? where id = ?')
      .run(sha256(nextKey), now, id);
    if (result.changes === 0) {
      throw Object.assign(new Error('database not found'), { status: 404 });
    }
    return { database: this.toPublic(this.getByIdRequired(id)), key: nextKey };
  }

  updateDatabase(id: string, input: { name?: string; note?: string | null; status?: DatabaseStatus }) {
    const current = this.getByIdRequired(id);
    const next = {
      name: input.name?.trim() || current.name,
      note: input.note === undefined ? current.note : input.note?.trim() || null,
      status: input.status || current.status,
      updatedAt: nowIso()
    };
    this.db
      .prepare('update databases set name = ?, note = ?, status = ?, updated_at = ? where id = ?')
      .run(next.name, next.note, next.status, next.updatedAt, id);
    return this.toPublic(this.getByIdRequired(id));
  }

  markAccess(id: string) {
    this.db.prepare('update databases set last_access_at = ? where id = ?').run(nowIso(), id);
  }

  audit(input: { databaseId?: string | null; actor: string; action: string; detail?: unknown }) {
    this.db
      .prepare('insert into audit_logs (id, database_id, actor, action, detail, created_at) values (?, ?, ?, ?, ?, ?)')
      .run(cryptoRandomId(), input.databaseId || null, input.actor, input.action, JSON.stringify(input.detail ?? null), nowIso());
  }

  resolveDatabasePath(filename: string) {
    const resolved = path.resolve(this.config.dataDir, filename);
    const dataRoot = path.resolve(this.config.dataDir);
    if (!resolved.startsWith(dataRoot + path.sep)) {
      throw Object.assign(new Error('database path escaped data directory'), { status: 400 });
    }
    return resolved;
  }

  toPublic(database: ManagedDatabase): PublicDatabaseRecord {
    return {
      id: database.id,
      name: database.name,
      filename: database.filename,
      absolutePath: database.path,
      status: database.status,
      note: database.note,
      createdAt: database.createdAt,
      updatedAt: database.updatedAt,
      lastAccessAt: database.lastAccessAt
    };
  }

  private migrate() {
    this.db.exec(`
      create table if not exists databases (
        id text primary key,
        name text not null,
        filename text not null unique,
        path text not null unique,
        key_hash text not null unique,
        status text not null check (status in ('active', 'disabled')),
        note text,
        created_at text not null,
        updated_at text not null,
        last_access_at text
      );

      create table if not exists audit_logs (
        id text primary key,
        database_id text,
        actor text not null,
        action text not null,
        detail text,
        created_at text not null,
        foreign key (database_id) references databases(id) on delete set null
      );
    `);
  }

  private fromRow(row: unknown): ManagedDatabase {
    const item = row as Record<string, string | null>;
    return {
      id: String(item.id),
      name: String(item.name),
      filename: String(item.filename),
      path: String(item.path),
      keyHash: String(item.key_hash),
      status: item.status as DatabaseStatus,
      note: item.note ?? null,
      createdAt: String(item.created_at),
      updatedAt: String(item.updated_at),
      lastAccessAt: item.last_access_at ?? null
    };
  }
}

function cryptoRandomId() {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 16);
}
