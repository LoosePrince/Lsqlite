import Database from 'better-sqlite3';
import type { ManagedDatabase, QueryMode, SqlResult } from './types.js';
import { normalizeSql, splitSqlStatements, validateSql } from './sql.js';

export type ExecuteInput = {
  sql: string;
  params?: unknown[] | Record<string, unknown>;
  mode?: QueryMode;
  allowDangerous?: boolean;
};

export type TransactionInput = {
  statements: ExecuteInput[];
  allowDangerous?: boolean;
};

export function getSchema(database: ManagedDatabase) {
  const db = openDatabase(database.path);
  try {
    const tables = db
      .prepare(
        `select name, type, sql
         from sqlite_schema
         where type in ('table', 'view') and name not like 'sqlite_%'
         order by type, name`
      )
      .all() as Array<{ name: string; type: string; sql: string | null }>;

    return tables.map((table) => ({
      ...table,
      columns: db.prepare(`pragma table_info(${quoteIdentifier(table.name)})`).all(),
      indexes: table.type === 'table' ? db.prepare(`pragma index_list(${quoteIdentifier(table.name)})`).all() : []
    }));
  } finally {
    db.close();
  }
}

export function executeSql(database: ManagedDatabase, input: ExecuteInput): SqlResult[] {
  const statements = splitSqlStatements(input.sql).map(normalizeSql);
  const db = openDatabase(database.path);
  try {
    return statements.map((statement, index) => {
      validateSql(statement, { allowDangerous: Boolean(input.allowDangerous) });
      const params = index === 0 ? input.params : undefined;
      return runStatement(db, statement, params, input.mode || 'auto');
    });
  } finally {
    db.close();
  }
}

export function executeTransaction(database: ManagedDatabase, input: TransactionInput): SqlResult[] {
  const db = openDatabase(database.path);
  try {
    const transaction = db.transaction(() =>
      input.statements.flatMap((item) => {
        const statements = splitSqlStatements(item.sql).map(normalizeSql);
        return statements.map((statement, index) => {
          validateSql(statement, { allowDangerous: Boolean(input.allowDangerous || item.allowDangerous) });
          const params = index === 0 ? item.params : undefined;
          return runStatement(db, statement, params, item.mode || 'auto');
        });
      })
    );
    return transaction();
  } finally {
    db.close();
  }
}

function openDatabase(filePath: string) {
  const db = new Database(filePath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}

function runStatement(
  db: Database.Database,
  statement: string,
  params: unknown[] | Record<string, unknown> | undefined,
  mode: QueryMode
): SqlResult {
  const start = performance.now();
  const prepared = db.prepare(statement);
  const readonly = prepared.reader;

  if (mode === 'read' && !readonly) {
    throw Object.assign(new Error('read mode only accepts query statements'), { status: 400 });
  }

  if (readonly) {
    const rows = params === undefined ? prepared.all() : prepared.all(params as never);
    return {
      statement,
      rows,
      rowCount: rows.length,
      elapsedMs: Math.round((performance.now() - start) * 100) / 100
    };
  }

  const result = params === undefined ? prepared.run() : prepared.run(params as never);
  return {
    statement,
    changes: result.changes,
    lastInsertRowid: typeof result.lastInsertRowid === 'bigint' ? result.lastInsertRowid.toString() : result.lastInsertRowid,
    elapsedMs: Math.round((performance.now() - start) * 100) / 100
  };
}

function quoteIdentifier(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}