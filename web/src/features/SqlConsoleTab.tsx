import { Button, Card, Select, Space, Table, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useMemo, useState } from 'react';
import { api, type ManagedDatabase, type TableInfo } from '../api.js';
import { CodeBlock } from '../components/CodeBlock.js';
import { JsonEditor } from '../components/JsonEditor.js';
import { MotionPanel } from '../components/MotionPanel.js';
import { useI18n } from '../i18n/context.js';
import type { NoticeApi, RowRecord } from '../types.js';
import { prettyJson } from '../utils/json.js';
import { valuePreview } from '../utils/format.js';

export function SqlConsoleTab({ database, table, notice }: { database: ManagedDatabase; table: TableInfo | null; notice: NoticeApi }) {
  const { t } = useI18n();
  const tableName = table?.name || 'items';
  const examples = useMemo(() => [
    { label: t('common.schema'), sql: "select name, type, sql from sqlite_schema where name not like 'sqlite_%' order by type, name;" },
    { label: t('sql.paginatedQuery'), sql: `select * from ${tableName} limit 50;` },
    { label: t('common.insert'), sql: `insert into ${tableName}(name) values ('demo');` },
    { label: t('common.update'), sql: `update ${tableName} set name = 'updated' where id = 1;` },
    { label: t('common.delete'), sql: `delete from ${tableName} where id = 1;` }
  ], [tableName, t]);
  const [sql, setSql] = useState(examples[0]?.sql || 'select 1;');
  const [results, setResults] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(false);

  async function runSql() {
    setLoading(true);
    try {
      const response = await api.query(database.id, sql);
      setResults(response.results);
      notice.success(t('sql.executed'));
    } catch (error) {
      notice.error(error instanceof Error ? error.message : t('sql.failed'));
    } finally {
      setLoading(false);
    }
  }

  const firstRows = Array.isArray(results[0]) ? results[0] as RowRecord[] : [];
  const rowColumns = Array.from(new Set(firstRows.flatMap((row) => Object.keys(row))));
  const columns: ColumnsType<RowRecord> = rowColumns.map((name) => ({
    title: name,
    dataIndex: name,
    ellipsis: true,
    render: (value: unknown) => valuePreview(value)
  }));

  return (
    <MotionPanel className="workspace-panel">
      <div className="section-title-row">
        <div>
          <Typography.Text className="eyebrow">{t('tabs.sql')}</Typography.Text>
          <Typography.Title level={3}>{t('sql.title')}</Typography.Title>
        </div>
        <Space wrap>
          <Select
            className="example-select"
            placeholder={t('sql.selectExample')}
            options={examples.map((item) => ({ label: item.label, value: item.sql }))}
            onChange={setSql}
          />
          <Button type="primary" loading={loading} onClick={runSql}>{t('sql.runSql')}</Button>
        </Space>
      </div>

      <Card className="admin-card sql-card">
        <JsonEditor value={sql} onChange={setSql} rows={10} />
      </Card>

      <div className="two-column-grid">
        <Card title={t('sql.tablePreview')} className="admin-card">
          <Table rowKey={(_, index) => `sql-${index}`} size="small" dataSource={firstRows} columns={columns} pagination={{ pageSize: 10 }} scroll={{ x: 800 }} />
        </Card>
        <Card title={t('sql.rawResult')} className="admin-card">
          <CodeBlock value={results.length ? prettyJson(results) : t('sql.noResult')} />
        </Card>
      </div>
    </MotionPanel>
  );
}
