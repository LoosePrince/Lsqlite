import type { TableInfo } from '../api.js';
import type { RowRecord } from '../types.js';

export function tableColumns(table: TableInfo | null | undefined, rows: RowRecord[] = []) {
  const schemaNames = table?.columns?.map((column) => column.name).filter(Boolean) || [];
  const rowNames = rows.flatMap((row) => Object.keys(row));
  return Array.from(new Set([...schemaNames, ...rowNames]));
}

export function primaryWhere(table: TableInfo | null | undefined, row: RowRecord) {
  const primary = table?.columns?.find((column) => {
    const record = column as Record<string, unknown>;
    return record.pk === 1 || record.pk === true || record.primaryKey === true;
  });

  if (primary?.name && Object.prototype.hasOwnProperty.call(row, primary.name)) {
    return { [primary.name]: row[primary.name] };
  }

  if (Object.prototype.hasOwnProperty.call(row, 'id')) return { id: row.id };
  const firstKey = Object.keys(row)[0];
  return firstKey ? { [firstKey]: row[firstKey] } : {};
}

export function writableValues(row: RowRecord) {
  return Object.fromEntries(Object.entries(row).filter(([, value]) => value !== undefined));
}