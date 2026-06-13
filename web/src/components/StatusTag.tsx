import { Tag } from 'antd';
import type { ManagedDatabase } from '../api.js';
import { statusColor, statusText } from '../utils/format.js';

export function StatusTag({ status }: { status: ManagedDatabase['status'] }) {
  return <Tag color={statusColor(status)}>{statusText(status)}</Tag>;
}