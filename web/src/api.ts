export type ManagedDatabase = {
  id: string;
  name: string;
  filename: string;
  absolutePath: string;
  status: 'active' | 'disabled';
  note: string | null;
  createdAt: string;
  updatedAt: string;
  lastAccessAt: string | null;
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

export const api = {
  me: () => request<{ admin: { username: string } | null }>('/admin/me'),
  login: (username: string, password: string) =>
    request<{ admin: { username: string } }>('/admin/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    }),
  logout: () => request<Record<string, never>>('/admin/logout', { method: 'POST' }),
  listDatabases: () => request<{ databases: ManagedDatabase[] }>('/admin/databases'),
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
  rotateKey: (id: string, key?: string) =>
    request<{ database: ManagedDatabase; key: string }>(`/admin/databases/${id}/rotate-key`, {
      method: 'POST',
      body: JSON.stringify({ key })
    }),
  schema: (id: string) => request<{ database: ManagedDatabase; schema: unknown[] }>(`/admin/databases/${id}/schema`),
  query: (id: string, sql: string) =>
    request<{ results: unknown[] }>(`/admin/databases/${id}/query`, {
      method: 'POST',
      body: JSON.stringify({ sql, mode: 'auto' })
    })
};