import { Card, Typography } from 'antd';
import type { ManagedDatabase, TableInfo } from '../api.js';
import { CodeBlock } from '../components/CodeBlock.js';
import { MotionPanel } from '../components/MotionPanel.js';
import type { NoticeApi } from '../types.js';

export function ApiExamplesTab({ database, table, notice }: { database: ManagedDatabase; table: TableInfo | null; notice: NoticeApi }) {
  const tableName = table?.name || 'items';
  const externalQuery = `curl -X POST http://localhost:3000/api/query \\\n  -H "Authorization: Bearer <database_key>" \\\n  -H "Content-Type: application/json" \\\n  -d "{\"sql\":\"select * from ${tableName} limit 50\",\"mode\":\"read\"}"`;
  const externalTransaction = `curl -X POST http://localhost:3000/api/transaction \\\n  -H "Authorization: Bearer <database_key>" \\\n  -H "Content-Type: application/json" \\\n  -d "{\"statements\":[{\"sql\":\"insert into ${tableName}(name) values (?)\",\"params\":[\"demo\"]}]}"`;
  const adminRows = `GET /admin/databases/${database.id}/tables/${tableName}/rows?limit=50&offset=0&orderBy=id&order=desc`;
  const adminInsert = `POST /admin/databases/${database.id}/tables/${tableName}/rows\n{ "values": { "name": "demo" } }`;
  const fetchExample = `await fetch('/api/query', {\n  method: 'POST',\n  headers: {\n    'content-type': 'application/json',\n    authorization: 'Bearer <database_key>'\n  },\n  body: JSON.stringify({\n    sql: 'select * from ${tableName} limit ?',\n    params: [50],\n    mode: 'read'\n  })\n});`;

  async function copy(value: string) {
    await navigator.clipboard.writeText(value);
    notice.success('示例已复制');
  }

  return (
    <MotionPanel className="workspace-panel">
      <div className="section-title-row">
        <div>
          <Typography.Text className="eyebrow">API Examples</Typography.Text>
          <Typography.Title level={3}>接口示例</Typography.Title>
        </div>
      </div>
      <div className="two-column-grid">
        <Card title="外部 key API" className="admin-card">
          <CodeBlock title="查询" value={externalQuery} onCopy={() => copy(externalQuery)} />
          <CodeBlock title="事务" value={externalTransaction} onCopy={() => copy(externalTransaction)} />
          <CodeBlock title="fetch" value={fetchExample} onCopy={() => copy(fetchExample)} />
        </Card>
        <Card title="管理接口" className="admin-card">
          <CodeBlock title="表列表" value={`GET /admin/databases/${database.id}/tables`} onCopy={() => copy(`GET /admin/databases/${database.id}/tables`)} />
          <CodeBlock title="分页行数据" value={adminRows} onCopy={() => copy(adminRows)} />
          <CodeBlock title="插入行" value={adminInsert} onCopy={() => copy(adminInsert)} />
        </Card>
      </div>
    </MotionPanel>
  );
}