import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import type { AppConfig } from './config.js';
import type { DatabaseStatus, ManagedDatabase } from './types.js';
import { nowIso, randomKey, sha256, toSlug } from './utils.js';

export type DatabaseListStatus = DatabaseStatus | 'all';

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
  fileSize: number;
};

export type AuditLogRecord = {
  id: string;
  databaseId: string | null;
  actor: string;
  action: string;
  detail: unknown;
  createdAt: string;
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

    if (this.getByKey(key, { includeDeleted: true })) {
      throw Object.assign(new Error('database key already exists'), { status: 409 });
    }

    new Database(dbPath).close();

    this.db
      .prepare(
        `insert into databases (
          id, name, filename, path, key_hash, status, note, created_at, updated_at, last_access_at, deleted_at
        ) values (?, ?, ?, ?, ?, 'active', ?, ?, ?, null, null)`
      )
      .run(id, input.name.trim(), filename, dbPath, sha256(key), input.note?.trim() || null, now, now);

    return {
      database: this.toPublic(this.getByIdRequired(id)),
      key
    };
  }

  listDatabases(status: DatabaseListStatus = 'active'): PublicDatabaseRecord[] {
    const rows = status === 'all'
      ? (this.db.prepare('select * from databases order by created_at desc').all() as unknown[])
      : (this.db.prepare('select * from databases where status = ? order by created_at desc').all(status) as unknown[]);

    return rows.map((row: unknown) => this.toPublic(this.fromRow(row)));
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

  getByKey(key: string, options: { includeDeleted?: boolean } = {}): ManagedDatabase | null {
    const row = options.includeDeleted
      ? this.db.prepare('select * from databases where key_hash = ?').get(sha256(key))
      : this.db.prepare("select * from databases where key_hash = ? and status != 'deleted'").get(sha256(key));
    return row ? this.fromRow(row) : null;
  }

  rotateKey(id: string, key?: string) {
    const current = this.getByIdRequired(id);
    if (current.status === 'deleted') {
      throw Object.assign(new Error('deleted database cannot rotate key'), { status: 409 });
    }

    const nextKey = key?.trim() || randomKey();
    const existing = this.getByKey(nextKey, { includeDeleted: true });
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

  updateDatabase(id: string, input: { name?: string; note?: string | null; status?: Exclude<DatabaseStatus, 'deleted'> }) {
    const current = this.getByIdRequired(id);
    if (current.status === 'deleted') {
      throw Object.assign(new Error('deleted database must be restored before editing'), { status: 409 });
    }

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

  softDeleteDatabase(id: string) {
    const current = this.getByIdRequired(id);
    if (current.status === 'deleted') {
      return this.toPublic(current);
    }

    const now = nowIso();
    this.db
      .prepare("update databases set status = 'deleted', deleted_at = ?, updated_at = ? where id = ?")
      .run(now, now, id);
    return this.toPublic(this.getByIdRequired(id));
  }

  restoreDatabase(id: string) {
    const current = this.getByIdRequired(id);
    if (current.status !== 'deleted') {
      return this.toPublic(current);
    }

    const now = nowIso();
    this.db
      .prepare("update databases set status = 'active', deleted_at = null, updated_at = ? where id = ?")
      .run(now, id);
    return this.toPublic(this.getByIdRequired(id));
  }

  permanentlyDeleteDatabase(id: string, confirmName: string) {
    const current = this.getByIdRequired(id);
    if (confirmName !== current.name) {
      throw Object.assign(new Error('database name confirmation does not match'), { status: 400 });
    }

    const dbPath = current.path;
    this.db.prepare('delete from audit_logs where database_id = ?').run(id);
    this.db.prepare('delete from databases where id = ?').run(id);

    if (fs.existsSync(dbPath)) {
      fs.rmSync(dbPath, { force: true });
      for (const suffix of ['-wal', '-shm']) {
        const sidecar = `${dbPath}${suffix}`;
        if (fs.existsSync(sidecar)) fs.rmSync(sidecar, { force: true });
      }
    }

    return this.toPublic(current);
  }

  markAccess(id: string) {
    this.db.prepare('update databases set last_access_at = ? where id = ?').run(nowIso(), id);
  }

  audit(input: { databaseId?: string | null; actor: string; action: string; detail?: unknown }) {
    try {
      this.db
        .prepare('insert into audit_logs (id, database_id, actor, action, detail, created_at) values (?, ?, ?, ?, ?, ?)')
        .run(cryptoRandomId(), input.databaseId || null, input.actor, input.action, JSON.stringify(input.detail ?? null), nowIso());
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[lsqlite] audit log write failed: ${message}`);
    }
  }

  listAuditLogs(input: { databaseId?: string; limit?: number } = {}): AuditLogRecord[] {
    const limit = Math.min(Math.max(input.limit || 50, 1), 200);
    const rows = input.databaseId
      ? (this.db.prepare('select * from audit_logs where database_id = ? order by created_at desc limit ?').all(input.databaseId, limit) as unknown[])
      : (this.db.prepare('select * from audit_logs order by created_at desc limit ?').all(limit) as unknown[]);

    return rows.map((row) => {
      const item = row as Record<string, string | null>;
      return {
        id: String(item.id),
        databaseId: item.database_id ?? null,
        actor: String(item.actor),
        action: String(item.action),
        detail: safeJsonParse(item.detail ?? null),
        createdAt: String(item.created_at)
      };
    });
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
      fileSize: getFileSize(database.path),
      status: database.status,
      note: database.note,
      createdAt: database.createdAt,
      updatedAt: database.updatedAt,
      lastAccessAt: database.lastAccessAt,
      deletedAt: database.deletedAt
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
        status text not null check (status in ('active', 'disabled', 'deleted')),
        note text,
        created_at text not null,
        updated_at text not null,
        last_access_at text,
        deleted_at text
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

    this.addColumnIfMissing('databases', 'deleted_at', 'text');
    this.rebuildDatabasesStatusConstraintIfNeeded();
    this.rebuildAuditLogsForeignKeyIfNeeded();
    this.dropLegacyDatabasesTableIfPresent();
  }

  private tableExists(table: string) {
    const row = this.db.prepare("select 1 from sqlite_schema where type = 'table' and name = ?").get(table);
    return Boolean(row);
  }

  private withForeignKeysDisabled(action: () => void) {
    const enabled = Number(this.db.pragma('foreign_keys', { simple: true })) === 1;
    this.db.pragma('foreign_keys = OFF');
    try {
      action();
    } finally {
      this.db.pragma(`foreign_keys = ${enabled ? 'ON' : 'OFF'}`);
    }
  }

  private addColumnIfMissing(table: string, column: string, definition: string) {
    const columns = this.db.prepare(`pragma table_info(${table})`).all() as Array<{ name: string }>;
    if (!columns.some((item) => item.name === column)) {
      this.db.exec(`alter table ${table} add column ${column} ${definition}`);
    }
  }

  private rebuildDatabasesStatusConstraintIfNeeded() {
    const ddl = this.db.prepare("select sql from sqlite_schema where type = 'table' and name = 'databases'").get() as { sql?: string } | undefined;
    if (ddl?.sql?.includes("'deleted'")) return;

    this.withForeignKeysDisabled(() => {
      this.db.exec(`
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
        insert into databases (id, name, filename, path, key_hash, status, note, created_at, updated_at, last_access_at, deleted_at)
        select id, name, filename, path, key_hash, status, note, created_at, updated_at, last_access_at, deleted_at from databases_old;
        drop table databases_old;
      `);
    });
  }

  private rebuildAuditLogsForeignKeyIfNeeded() {
    const ddl = this.db.prepare("select sql from sqlite_schema where type = 'table' and name = 'audit_logs'").get() as { sql?: string } | undefined;
    if (!ddl?.sql || !ddl.sql.includes('databases_old')) return;

    this.withForeignKeysDisabled(() => {
      this.db.exec(`
        alter table audit_logs rename to audit_logs_old;
        create table audit_logs (
          id text primary key,
          database_id text,
          actor text not null,
          action text not null,
          detail text,
          created_at text not null,
          foreign key (database_id) references databases(id) on delete set null
        );
        insert into audit_logs (id, database_id, actor, action, detail, created_at)
        select id, database_id, actor, action, detail, created_at from audit_logs_old;
        drop table audit_logs_old;
      `);
    });
  }

  private dropLegacyDatabasesTableIfPresent() {
    if (!this.tableExists('databases_old')) return;
    this.withForeignKeysDisabled(() => {
      this.db.exec('drop table databases_old');
    });
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
      lastAccessAt: item.last_access_at ?? null,
      deletedAt: item.deleted_at ?? null
    };
  }
}

function cryptoRandomId() {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 16);
}

function getFileSize(filePath: string) {
  try {
    return fs.statSync(filePath).size;
  } catch {
    return 0;
  }
}

function safeJsonParse(value: string | null) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}