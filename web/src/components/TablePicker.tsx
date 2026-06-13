import { Button, Space, Typography } from 'antd';
import { useI18n } from '../i18n/context.js';
import type { TableInfo } from '../api.js';

export function TablePicker({
  tables,
  selectedTableName,
  onSelect,
  emptyText
}: {
  tables: TableInfo[];
  selectedTableName: string | null;
  onSelect: (name: string) => void;
  emptyText?: string;
}) {
  const { t } = useI18n();

  if (tables.length === 0) {
    return <Typography.Text type="secondary">{emptyText ?? t('browse.selectTable')}</Typography.Text>;
  }

  return (
    <Space wrap>
      {tables.map((table) => (
        <Button key={table.name} type={selectedTableName === table.name ? 'primary' : 'default'} onClick={() => onSelect(table.name)}>
          {table.name}
        </Button>
      ))}
    </Space>
  );
}
