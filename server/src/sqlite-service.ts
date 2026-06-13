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

export type CreateTableInput = {
  name: string;
  columns: Array<{
    name: string;
    type: string;
    primaryKey?: boolean;
    notNull?: boolean;
    unique?: boolean;
    defaultValue?: string;
  }>;
  ifNotExists?: boolean;
};

export type AddColumnInput = CreateTableInput['columns'][number];

export type CreateIndexInput = {
  name: string;
  columns: string[];
  unique?: boolean;
};

export type RowQueryInput = {
  limit?: number;
  offset?: number;
  orderBy?: string;
  order?: 'asc' | 'desc';
};

export type RowMutationInput = {
  values: Record<string, unknown>;
  where?: Record<string, unknown>;
};

export function getSchema(database: ManagedDatabase) {
  const db = openDatabase(database.path);
  try {
    return listTablesInternal(db);
  } finally {
    db.close();
  }
}

export function listTables(database: ManagedDatabase) {
  const db = openDatabase(database.path);
  try {
    return listTablesInternal(db);
  } finally {
    db.close();
  }
}

export function getTable(database: ManagedDatabase, tableName: string) {
  const db = openDatabase(database.path);
  try {
    assertTableExists(db, tableName);
    return describeTable(db, tableName);
  } finally {
    db.close();
  }
}

export function getDatabaseStats(database: ManagedDatabase) {
  const db = openDatabase(database.path);
  try {
    const tables = listTablesInternal(db).filter((table) => table.type === 'table');
    return {
      tableCount: tables.length,
      viewCount: listTablesInternal(db).filter((table) => table.type === 'view').length,
      rows: tables.map((table) => ({ name: table.name, rowCount: table.rowCount }))
    };
  } finally {
    db.close();
  }
}

export function createTable(database: ManagedDatabase, input: CreateTableInput) {
  const db = openDatabase(database.path);
  try {
    assertIdentifier(input.name, 'table name');
    if (input.columns.length === 0) {
      throw Object.assign(new Error('at least one column is required'), { status: 400 });
    }

    const columnsSql = input.columns.map(columnDefinition).join(', ');
    const exists = input.ifNotExists === false ? '' : ' if not exists';
    db.prepare(`create table${exists} ${quoteIdentifier(input.name)} (${columnsSql})`).run();
    return describeTable(db, input.name);
  } finally {
    db.close();
  }
}

export function dropTable(database: ManagedDatabase, tableName: string, confirmName: string) {
  const db = openDatabase(database.path);
  try {
    assertTableExists(db, tableName);
    if (confirmName !== tableName) {
      throw Object.assign(new Error('table name confirmation does not match'), { status: 400 });
    }
    db.prepare(`drop table ${quoteIdentifier(tableName)}`).run();
    return { table: tableName, dropped: true };
  } finally {
    db.close();
  }
}

export function addColumn(database: ManagedDatabase, tableName: string, input: AddColumnInput) {
  const db = openDatabase(database.path);
  try {
    assertTableExists(db, tableName);
    db.prepare(`alter table ${quoteIdentifier(tableName)} add column ${columnDefinition(input)}`).run();
    return describeTable(db, tableName);
  } finally {
    db.close();
  }
}

export function createIndex(database: ManagedDatabase, tableName: string, input: CreateIndexInput) {
  const db = openDatabase(database.path);
  try {
    assertTableExists(db, tableName);
    assertIdentifier(input.name, 'index name');
    const columns = getColumnNames(db, tableName);
    if (input.columns.length === 0) {
      throw Object.assign(new Error('at least one index column is required'), { status: 400 });
    }
    for (const column of input.columns) {
      if (!columns.includes(column)) {
        throw Object.assign(new Error(`column not found: ${column}`), { status: 400 });
      }
    }
    const unique = input.unique ? 'unique ' : '';
    const columnSql = input.columns.map(quoteIdentifier).join(', ');
    db.prepare(`create ${unique}index ${quoteIdentifier(input.name)} on ${quoteIdentifier(tableName)} (${columnSql})`).run();
    return describeTable(db, tableName);
  } finally {
    db.close();
  }
}

export function dropIndex(database: ManagedDatabase, tableName: string, indexName: string) {
  const db = openDatabase(database.path);
  try {
    assertTableExists(db, tableName);
    assertIdentifier(indexName, 'index name');
    const indexes = getIndexes(db, tableName).map((item) => item.name);
    if (!indexes.includes(indexName)) {
      throw Object.assign(new Error('index not found'), { status: 404 });
    }
    db.prepare(`drop index ${quoteIdentifier(indexName)}`).run();
    return describeTable(db, tableName);
  } finally {
    db.close();
  }
}

export function queryRows(database: ManagedDatabase, tableName: string, input: RowQueryInput) {
  const db = openDatabase(database.path);
  try {
    assertTableExists(db, tableName);
    const columns = getColumnNames(db, tableName);
    const limit = Math.min(Math.max(input.limit || 50, 1), 500);
    const offset = Math.max(input.offset || 0, 0);
    const defaultOrderBy = columns[0];
    if (!defaultOrderBy) {
      throw Object.assign(new Error('table has no columns'), { status: 400 });
    }
    const orderBy = input.orderBy && columns.includes(input.orderBy) ? input.orderBy : defaultOrderBy;
    const order = input.order === 'desc' ? 'desc' : 'asc';
    const total = (db.prepare(`select count(*) as count from ${quoteIdentifier(tableName)}`).get() as { count: number }).count;
    const sql = `select * from ${quoteIdentifier(tableName)} order by ${quoteIdentifier(orderBy)} ${order} limit ? offset ?`;
    const rows = db.prepare(sql).all(limit, offset);
    return { table: tableName, total, limit, offset, rows };
  } finally {
    db.close();
  }
}

export function insertRow(database: ManagedDatabase, tableName: string, values: Record<string, unknown>) {
  const db = openDatabase(database.path);
  try {
    assertTableExists(db, tableName);
    const safeValues = filterKnownColumns(db, tableName, values);
    if (Object.keys(safeValues).length === 0) {
      throw Object.assign(new Error('row values are required'), { status: 400 });
    }
    const columns = Object.keys(safeValues);
    const placeholders = columns.map(() => '?').join(', ');
    const sql = `insert into ${quoteIdentifier(tableName)} (${columns.map(quoteIdentifier).join(', ')}) values (${placeholders})`;
    const result = db.prepare(sql).run(...columns.map((column) => safeValues[column]));
    return { changes: result.changes, lastInsertRowid: stringifyRowId(result.lastInsertRowid) };
  } finally {
    db.close();
  }
}

export function updateRows(database: ManagedDatabase, tableName: string, input: RowMutationInput) {
  const db = openDatabase(database.path);
  try {
    assertTableExists(db, tableName);
    const values = filterKnownColumns(db, tableName, input.values);
    const where = filterKnownColumns(db, tableName, input.where || {});
    if (Object.keys(values).length === 0) {
      throw Object.assign(new Error('update values are required'), { status: 400 });
    }
    if (Object.keys(where).length === 0) {
      throw Object.assign(new Error('where is required for update'), { status: 400 });
    }
    const setColumns = Object.keys(values);
    const whereColumns = Object.keys(where);
    const sql = `update ${quoteIdentifier(tableName)} set ${setColumns.map((column) => `${quoteIdentifier(column)} = ?`).join(', ')} where ${whereColumns.map((column) => `${quoteIdentifier(column)} = ?`).join(' and ')}`;
    const result = db.prepare(sql).run(...setColumns.map((column) => values[column]), ...whereColumns.map((column) => where[column]));
    return { changes: result.changes };
  } finally {
    db.close();
  }
}

export function deleteRows(database: ManagedDatabase, tableName: string, where: Record<string, unknown>) {
  const db = openDatabase(database.path);
  try {
    assertTableExists(db, tableName);
    const safeWhere = filterKnownColumns(db, tableName, where);
    if (Object.keys(safeWhere).length === 0) {
      throw Object.assign(new Error('where is required for delete'), { status: 400 });
    }
    const whereColumns = Object.keys(safeWhere);
    const sql = `delete from ${quoteIdentifier(tableName)} where ${whereColumns.map((column) => `${quoteIdentifier(column)} = ?`).join(' and ')}`;
    const result = db.prepare(sql).run(...whereColumns.map((column) => safeWhere[column]));
    return { changes: result.changes };
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

function listTablesInternal(db: Database.Database) {
  const tables = db
    .prepare(
      `select name, type, sql
       from sqlite_schema
       where type in ('table', 'view') and name not like 'sqlite_%'
       order by type, name`
    )
    .all() as Array<{ name: string; type: 'table' | 'view'; sql: string | null }>;

  return tables.map((table) => describeTable(db, table.name, table));
}

function describeTable(db: Database.Database, tableName: string, base?: { name: string; type: 'table' | 'view'; sql: string | null }) {
  const table = base || (db.prepare("select name, type, sql from sqlite_schema where name = ? and type in ('table', 'view')").get(tableName) as { name: string; type: 'table' | 'view'; sql: string | null } | undefined);
  if (!table) {
    throw Object.assign(new Error('table not found'), { status: 404 });
  }
  const rowCount = table.type === 'table'
    ? (db.prepare(`select count(*) as count from ${quoteIdentifier(tableName)}`).get() as { count: number }).count
    : null;

  return {
    ...table,
    rowCount,
    columns: db.prepare(`pragma table_info(${quoteIdentifier(table.name)})`).all(),
    indexes: table.type === 'table' ? getIndexes(db, table.name) : []
  };
}

function getIndexes(db: Database.Database, tableName: string) {
  const indexes = db.prepare(`pragma index_list(${quoteIdentifier(tableName)})`).all() as Array<{ name: string }>;
  return indexes.map((index) => ({
    ...index,
    columns: db.prepare(`pragma index_info(${quoteIdentifier(index.name)})`).all()
  }));
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
    lastInsertRowid: stringifyRowId(result.lastInsertRowid),
    elapsedMs: Math.round((performance.now() - start) * 100) / 100
  };
}

function columnDefinition(column: AddColumnInput) {
  assertIdentifier(column.name, 'column name');
  const type = normalizeColumnType(column.type);
  const parts = [quoteIdentifier(column.name), type];
  if (column.primaryKey) parts.push('primary key');
  if (column.notNull) parts.push('not null');
  if (column.unique) parts.push('unique');
  if (column.defaultValue !== undefined && column.defaultValue !== '') parts.push(`default ${column.defaultValue}`);
  return parts.join(' ');
}

function normalizeColumnType(type: string) {
  const normalized = type.trim().toLowerCase();
  const allowed = new Set(['integer', 'real', 'text', 'blob', 'numeric', 'boolean', 'datetime']);
  if (!allowed.has(normalized)) {
    throw Object.assign(new Error(`unsupported column type: ${type}`), { status: 400 });
  }
  return normalized === 'boolean' ? 'integer' : normalized;
}

function assertTableExists(db: Database.Database, tableName: string) {
  assertIdentifier(tableName, 'table name');
  const found = db.prepare("select name from sqlite_schema where name = ? and type = 'table'").get(tableName);
  if (!found) {
    throw Object.assign(new Error('table not found'), { status: 404 });
  }
}

function getColumnNames(db: Database.Database, tableName: string) {
  return (db.prepare(`pragma table_info(${quoteIdentifier(tableName)})`).all() as Array<{ name: string }>).map((column) => column.name);
}

function filterKnownColumns(db: Database.Database, tableName: string, values: Record<string, unknown>) {
  const columns = getColumnNames(db, tableName);
  return Object.fromEntries(Object.entries(values).filter(([key]) => columns.includes(key)));
}

function assertIdentifier(value: string, label: string) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
    throw Object.assign(new Error(`invalid ${label}`), { status: 400 });
  }
}

function quoteIdentifier(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function stringifyRowId(value: number | bigint) {
  return typeof value === 'bigint' ? value.toString() : value;
}