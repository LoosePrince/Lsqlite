import { Button, Card, Descriptions, Space, Statistic, Typography } from 'antd';
import type { ManagedDatabase, TableInfo } from '../api.js';
import { MotionPanel } from '../components/MotionPanel.js';
import { StatusTag } from '../components/StatusTag.js';
import { formatBytes, formatDate } from '../utils/format.js';
import type { WorkspaceTab } from '../types.js';

export function OverviewTab({
  database,
  tables,
  onCreateTable,
  onCreateIndex,
  onSwitchTab
}: {
  database: ManagedDatabase;
  tables: TableInfo[];
  onCreateTable: () => void;
  onCreateIndex: () => void;
  onSwitchTab: (tab: WorkspaceTab) => void;
}) {
  const tableCount = tables.filter((table) => table.type === 'table').length;
  const viewCount = tables.filter((table) => table.type === 'view').length;
  const knownRows = tables.reduce((sum, table) => sum + (table.rowCount || 0), 0);

  return (
    <MotionPanel className="workspace-panel">
      <div className="section-title-row">
        <div>
          <Typography.Text className="eyebrow">Overview</Typography.Text>
          <Typography.Title level={3}>{database.name}</Typography.Title>
        </div>
        <Space wrap>
          <Button type="primary" onClick={onCreateTable}>创建表</Button>
          <Button onClick={onCreateIndex}>创建索引</Button>
          <Button onClick={() => onSwitchTab('sql')}>打开 SQL</Button>
        </Space>
      </div>

      <div className="stats-grid">
        <Card><Statistic title="表" value={tableCount} /></Card>
        <Card><Statistic title="视图" value={viewCount} /></Card>
        <Card><Statistic title="已知行数" value={knownRows} /></Card>
        <Card><Statistic title="文件大小" value={formatBytes(database.fileSize)} /></Card>
      </div>

      <Card title="数据库信息" className="admin-card">
        <Descriptions column={{ xs: 1, sm: 1, md: 2 }} bordered size="small">
          <Descriptions.Item label="状态"><StatusTag status={database.status} /></Descriptions.Item>
          <Descriptions.Item label="文件名">{database.filename}</Descriptions.Item>
          <Descriptions.Item label="路径" span={2}>{database.absolutePath}</Descriptions.Item>
          <Descriptions.Item label="备注" span={2}>{database.note || '无'}</Descriptions.Item>
          <Descriptions.Item label="创建时间">{formatDate(database.createdAt)}</Descriptions.Item>
          <Descriptions.Item label="更新时间">{formatDate(database.updatedAt)}</Descriptions.Item>
          <Descriptions.Item label="最后访问">{formatDate(database.lastAccessAt)}</Descriptions.Item>
          <Descriptions.Item label="删除时间">{formatDate(database.deletedAt)}</Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title="表概览" className="admin-card compact-card">
        <div className="table-chip-grid">
          {tables.map((table) => (
            <button key={table.name} className="table-chip" type="button" onClick={() => onSwitchTab('structure')}>
              <strong>{table.name}</strong>
              <span>{table.type} · {table.rowCount ?? '-'} rows · {table.columns.length} columns</span>
            </button>
          ))}
          {tables.length === 0 ? <Typography.Text type="secondary">还没有表，可从 Structure 创建。</Typography.Text> : null}
        </div>
      </Card>
    </MotionPanel>
  );
}