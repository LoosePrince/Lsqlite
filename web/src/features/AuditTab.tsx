import { Button, Card, Table, Typography } from 'antd';
import { useEffect, useState } from 'react';
import { api, type AuditLog, type ManagedDatabase } from '../api.js';
import { MotionPanel } from '../components/MotionPanel.js';
import type { NoticeApi } from '../types.js';
import { formatDate } from '../utils/format.js';

export function AuditTab({ database, notice }: { database: ManagedDatabase; notice: NoticeApi }) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const result = await api.auditLogs(database.id);
      setLogs(result.logs);
    } catch (error) {
      notice.error(error instanceof Error ? error.message : '读取审计日志失败');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh().catch(() => undefined);
  }, [database.id]);

  return (
    <MotionPanel className="workspace-panel">
      <div className="section-title-row">
        <div>
          <Typography.Text className="eyebrow">Audit</Typography.Text>
          <Typography.Title level={3}>审计日志</Typography.Title>
        </div>
        <Button onClick={refresh}>刷新</Button>
      </div>
      <Card className="admin-card">
        <Table
          rowKey="id"
          size="small"
          loading={loading}
          dataSource={logs}
          pagination={{ pageSize: 12 }}
          columns={[
            { title: '时间', dataIndex: 'createdAt', render: (value: string) => formatDate(value), width: 190 },
            { title: '操作者', dataIndex: 'actor', width: 130 },
            { title: '动作', dataIndex: 'action', width: 210 },
            { title: '详情', dataIndex: 'detail', render: (value: unknown) => <pre className="inline-json">{JSON.stringify(value, null, 2)}</pre> }
          ]}
        />
      </Card>
    </MotionPanel>
  );
}