export type DatabaseStatus = 'active' | 'disabled' | 'deleted';

export type ManagedDatabase = {
  id: string;
  name: string;
  filename: string;
  absolutePath: string;
  fileSize: number;
  status: DatabaseStatus;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  lastAccessAt: string | null;
  deletedAt: string | null;
};

export type ColumnInput = {
  name: string;
  type: 'integer' | 'real' | 'text' | 'blob' | 'numeric' | 'boolean' | 'datetime';
  primaryKey?: boolean;
  notNull?: boolean;
  unique?: boolean;
  defaultValue?: string;
};

export type TableInfo = {
  name: string;
  type: 'table' | 'view';
  sql: string | null;
  rowCount: number | null;
  columns: Array<Record<string, unknown> & { name: string }>;
  indexes: Array<Record<string, unknown> & { name: string; columns?: unknown[] }>;
};

export type RowsResult = {
  table: string;
  total: number;
  limit: number;
  offset: number;
  rows: Array<Record<string, unknown>>;
};

export type AuditLog = {
  id: string;
  databaseId: string | null;
  actor: string;
  action: string;
  detail: unknown;
  createdAt: string;
};

export type ApiResult<T> = T & { ok: true };

async function request<T>(url: string, options: RequestInit = {}): Promise<ApiResult<T>> {
  const response = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'content-type': 'application/json',
      ...(options.headers || {})
    }
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.ok) {
    throw new Error(body?.error?.message || `HTTP ${response.status}`);
  }
  return body;
}

const qs = (input: Record<string, string | number | undefined>) => {
  const params = new URLSearchParams();
  Object.entries(input).forEach(([key, value]) => {
    if (value !== undefined) params.set(key, String(value));
  });
  const text = params.toString();
  return text ? `?${text}` : '';
};

export const api = {
  me: () => request<{ admin: { username: string } | null }>('/admin/me'),
  login: (username: string, password: string) =>
    request<{ admin: { username: string } }>('/admin/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    }),
  logout: () => request<Record<string, never>>('/admin/logout', { method: 'POST' }),
  auditLogs: (databaseId?: string) => request<{ logs: AuditLog[] }>(`/admin/audit-logs${qs({ databaseId })}`),
  listDatabases: (status: DatabaseStatus | 'all' = 'active') => request<{ databases: ManagedDatabase[] }>(`/admin/databases${qs({ status })}`),
  createDatabase: (input: { name: string; key?: string; note?: string }) =>
    request<{ database: ManagedDatabase; key: string }>('/admin/databases', {
      method: 'POST',
      body: JSON.stringify(input)
    }),
  updateDatabase: (id: string, input: Partial<Pick<ManagedDatabase, 'name' | 'note' | 'status'>>) =>
    request<{ database: ManagedDatabase }>(`/admin/databases/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input)
    }),
  softDeleteDatabase: (id: string) => request<{ database: ManagedDatabase }>(`/admin/databases/${id}`, { method: 'DELETE' }),
  restoreDatabase: (id: string) => request<{ database: ManagedDatabase }>(`/admin/databases/${id}/restore`, { method: 'POST' }),
  permanentlyDeleteDatabase: (id: string, confirmName: string) =>
    request<{ database: ManagedDatabase }>(`/admin/databases/${id}/permanent`, {
      method: 'DELETE',
      body: JSON.stringify({ confirmName })
    }),
  rotateKey: (id: string, key?: string) =>
    request<{ database: ManagedDatabase; key: string }>(`/admin/databases/${id}/rotate-key`, {
      method: 'POST',
      body: JSON.stringify({ key })
    }),
  schema: (id: string) => request<{ database: ManagedDatabase; schema: TableInfo[] }>(`/admin/databases/${id}/schema`),
  stats: (id: string) => request<{ stats: unknown }>(`/admin/databases/${id}/stats`),
  tables: (id: string) => request<{ tables: TableInfo[] }>(`/admin/databases/${id}/tables`),
  table: (id: string, table: string) => request<{ table: TableInfo }>(`/admin/databases/${id}/tables/${table}`),
  createTable: (id: string, input: { name: string; columns: ColumnInput[]; ifNotExists?: boolean }) =>
    request<{ table: TableInfo }>(`/admin/databases/${id}/tables`, {
      method: 'POST',
      body: JSON.stringify(input)
    }),
  dropTable: (id: string, table: string, confirmName: string) =>
    request<{ result: unknown }>(`/admin/databases/${id}/tables/${table}`, {
      method: 'DELETE',
      body: JSON.stringify({ confirmName })
    }),
  addColumn: (id: string, table: string, input: ColumnInput) =>
    request<{ table: TableInfo }>(`/admin/databases/${id}/tables/${table}/columns`, {
      method: 'POST',
      body: JSON.stringify(input)
    }),
  createIndex: (id: string, table: string, input: { name: string; columns: string[]; unique?: boolean }) =>
    request<{ table: TableInfo }>(`/admin/databases/${id}/tables/${table}/indexes`, {
      method: 'POST',
      body: JSON.stringify(input)
    }),
  dropIndex: (id: string, table: string, index: string) =>
    request<{ table: TableInfo }>(`/admin/databases/${id}/tables/${table}/indexes/${index}`, { method: 'DELETE' }),
  rows: (id: string, table: string, input: { limit?: number; offset?: number; orderBy?: string; order?: 'asc' | 'desc' }) =>
    request<{ result: RowsResult }>(`/admin/databases/${id}/tables/${table}/rows${qs(input)}`),
  insertRow: (id: string, table: string, values: Record<string, unknown>) =>
    request<{ result: unknown }>(`/admin/databases/${id}/tables/${table}/rows`, {
      method: 'POST',
      body: JSON.stringify({ values })
    }),
  updateRows: (id: string, table: string, input: { values: Record<string, unknown>; where: Record<string, unknown> }) =>
    request<{ result: unknown }>(`/admin/databases/${id}/tables/${table}/rows`, {
      method: 'PATCH',
      body: JSON.stringify(input)
    }),
  deleteRows: (id: string, table: string, where: Record<string, unknown>) =>
    request<{ result: unknown }>(`/admin/databases/${id}/tables/${table}/rows`, {
      method: 'DELETE',
      body: JSON.stringify({ where })
    }),
  query: (id: string, sql: string) =>
    request<{ results: unknown[] }>(`/admin/databases/${id}/query`, {
      method: 'POST',
      body: JSON.stringify({ sql, mode: 'auto' })
    })
};