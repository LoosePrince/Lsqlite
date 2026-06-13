import { Button, Card, Select, Space, Table, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useMemo, useState } from 'react';
import { api, type ManagedDatabase, type TableInfo } from '../api.js';
import { CodeBlock } from '../components/CodeBlock.js';
import { JsonEditor } from '../components/JsonEditor.js';
import { MotionPanel } from '../components/MotionPanel.js';
import type { NoticeApi, RowRecord } from '../types.js';
import { prettyJson } from '../utils/json.js';
import { valuePreview } from '../utils/format.js';

export function SqlConsoleTab({ database, table, notice }: { database: ManagedDatabase; table: TableInfo | null; notice: NoticeApi }) {
  const tableName = table?.name || 'items';
  const examples = useMemo(() => [
    { label: 'Schema', sql: "select name, type, sql from sqlite_schema where name not like 'sqlite_%' order by type, name;" },
    { label: '分页查询', sql: `select * from ${tableName} limit 50;` },
    { label: '插入', sql: `insert into ${tableName}(name) values ('demo');` },
    { label: '更新', sql: `update ${tableName} set name = 'updated' where id = 1;` },
    { label: '删除', sql: `delete from ${tableName} where id = 1;` }
  ], [tableName]);
  const [sql, setSql] = useState(examples[0]?.sql || 'select 1;');
  const [results, setResults] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(false);

  async function runSql() {
    setLoading(true);
    try {
      const response = await api.query(database.id, sql);
      setResults(response.results);
      notice.success('SQL 已执行');
    } catch (error) {
      notice.error(error instanceof Error ? error.message : 'SQL 执行失败');
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
          <Typography.Text className="eyebrow">SQL</Typography.Text>
          <Typography.Title level={3}>SQL 控制台</Typography.Title>
        </div>
        <Space wrap>
          <Select
            className="example-select"
            placeholder="选择示例"
            options={examples.map((item) => ({ label: item.label, value: item.sql }))}
            onChange={setSql}
          />
          <Button type="primary" loading={loading} onClick={runSql}>执行 SQL</Button>
        </Space>
      </div>

      <Card className="admin-card sql-card">
        <JsonEditor value={sql} onChange={setSql} rows={10} />
      </Card>

      <div className="two-column-grid">
        <Card title="表格结果预览" className="admin-card">
          <Table rowKey={(_, index) => `sql-${index}`} size="small" dataSource={firstRows} columns={columns} pagination={{ pageSize: 10 }} scroll={{ x: 800 }} />
        </Card>
        <Card title="原始结果" className="admin-card">
          <CodeBlock value={results.length ? prettyJson(results) : '暂无结果'} />
        </Card>
      </div>
    </MotionPanel>
  );
}