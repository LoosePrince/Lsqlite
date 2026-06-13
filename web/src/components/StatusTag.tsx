import { Tag } from 'antd';
import type { ManagedDatabase } from '../api.js';
import { useI18n } from '../i18n/context.js';
import { statusColor } from '../utils/format.js';

export function StatusTag({ status }: { status: ManagedDatabase['status'] }) {
  const { t } = useI18n();
  const label = t(`status.${status}`);
  return <Tag color={statusColor(status)}>{label}</Tag>;
}
