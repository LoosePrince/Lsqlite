export type AdminUser = { username: string };

export type NoticeApi = {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
};

export type WorkspaceTab = 'overview' | 'structure' | 'browse' | 'sql' | 'operations' | 'api' | 'audit';

export type DrawerMode = 'create-database' | 'create-table' | 'add-column' | 'create-index' | 'insert-row' | 'edit-row' | null;

export type RowRecord = Record<string, unknown>;