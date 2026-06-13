import { Button, Space, Typography } from 'antd';
import type { TableInfo } from '../api.js';

export function TablePicker({
  tables,
  selectedTableName,
  onSelect,
  emptyText = '暂无表'
}: {
  tables: TableInfo[];
  selectedTableName: string | null;
  onSelect: (name: string) => void;
  emptyText?: string;
}) {
  if (tables.length === 0) return <Typography.Text type="secondary">{emptyText}</Typography.Text>;
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