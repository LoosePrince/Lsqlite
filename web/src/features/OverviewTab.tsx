import { Button, Card, Descriptions, Space, Statistic, Typography } from 'antd';
import type { ManagedDatabase, TableInfo } from '../api.js';
import { MotionPanel } from '../components/MotionPanel.js';
import { StatusTag } from '../components/StatusTag.js';
import { useI18n } from '../i18n/context.js';
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
  const { t, locale } = useI18n();
  const tableCount = tables.filter((table) => table.type === 'table').length;
  const viewCount = tables.filter((table) => table.type === 'view').length;
  const knownRows = tables.reduce((sum, table) => sum + (table.rowCount || 0), 0);
  const noneLabel = t('common.none');

  return (
    <MotionPanel className="workspace-panel">
      <div className="section-title-row">
        <div>
          <Typography.Text className="eyebrow">{t('tabs.overview')}</Typography.Text>
          <Typography.Title level={3}>{database.name}</Typography.Title>
        </div>
        <Space wrap>
          <Button type="primary" onClick={onCreateTable}>{t('overview.createTable')}</Button>
          <Button onClick={onCreateIndex}>{t('overview.createIndex')}</Button>
          <Button onClick={() => onSwitchTab('sql')}>{t('overview.openSql')}</Button>
        </Space>
      </div>

      <div className="stats-grid">
        <Card><Statistic title={t('common.tables')} value={tableCount} /></Card>
        <Card><Statistic title={t('common.views')} value={viewCount} /></Card>
        <Card><Statistic title={t('overview.knownRows')} value={knownRows} /></Card>
        <Card><Statistic title={t('overview.fileSize')} value={formatBytes(database.fileSize)} /></Card>
      </div>

      <Card title={t('overview.dbInfo')} className="admin-card">
        <Descriptions column={{ xs: 1, sm: 1, md: 2 }} bordered size="small">
          <Descriptions.Item label={t('common.status')}><StatusTag status={database.status} /></Descriptions.Item>
          <Descriptions.Item label={t('common.filename')}>{database.filename}</Descriptions.Item>
          <Descriptions.Item label={t('common.path')} span={2}>{database.absolutePath}</Descriptions.Item>
          <Descriptions.Item label={t('common.note')} span={2}>{database.note || noneLabel}</Descriptions.Item>
          <Descriptions.Item label={t('overview.createdAt')}>{formatDate(database.createdAt, noneLabel, locale)}</Descriptions.Item>
          <Descriptions.Item label={t('overview.updatedAt')}>{formatDate(database.updatedAt, noneLabel, locale)}</Descriptions.Item>
          <Descriptions.Item label={t('overview.lastAccessAt')}>{formatDate(database.lastAccessAt, noneLabel, locale)}</Descriptions.Item>
          <Descriptions.Item label={t('overview.deletedAt')}>{formatDate(database.deletedAt, noneLabel, locale)}</Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title={t('overview.tableOverview')} className="admin-card compact-card">
        <div className="table-chip-grid">
          {tables.map((table) => (
            <button key={table.name} className="table-chip" type="button" onClick={() => onSwitchTab('structure')}>
              <strong>{table.name}</strong>
              <span>{t('overview.tableChip', { type: table.type, rows: table.rowCount ?? '-', columns: table.columns.length })}</span>
            </button>
          ))}
          {tables.length === 0 ? <Typography.Text type="secondary">{t('overview.noTables')}</Typography.Text> : null}
        </div>
      </Card>
    </MotionPanel>
  );
}
