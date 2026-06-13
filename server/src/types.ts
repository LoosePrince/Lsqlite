export type DatabaseStatus = 'active' | 'disabled';

export type ManagedDatabase = {
  id: string;
  name: string;
  filename: string;
  path: string;
  keyHash: string;
  status: DatabaseStatus;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  lastAccessAt: string | null;
};

export type QueryMode = 'auto' | 'read' | 'write';

export type SqlResult = {
  statement: string;
  rows?: unknown[];
  rowCount?: number;
  changes?: number;
  lastInsertRowid?: number | string;
  elapsedMs: number;
};