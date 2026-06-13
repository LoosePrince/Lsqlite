import type { ManagedDatabase } from '../api.js';
import type { Locale } from '../i18n/types.js';

export function formatBytes(value: number | null | undefined) {
  const size = Number(value || 0);
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

export function formatDate(value: string | null | undefined, noneLabel = '—', locale: Locale = 'zh') {
  if (!value) return noneLabel;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(locale === 'zh' ? 'zh-CN' : 'en-US');
}

export function statusColor(status: ManagedDatabase['status']) {
  return ({ active: 'success', disabled: 'warning', deleted: 'error' } as const)[status];
}

export function valuePreview(value: unknown) {
  if (value === null) return 'NULL';
  if (value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export function safeStringify(value: unknown) {
  return JSON.stringify(value, null, 2);
}

export function databaseSubtitle(database: ManagedDatabase) {
  return `${database.filename} · ${formatBytes(database.fileSize)}`;
}
