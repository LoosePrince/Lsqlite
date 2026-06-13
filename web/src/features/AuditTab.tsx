import { Button, Card, Table, Typography } from 'antd';
import { useEffect, useState } from 'react';
import { api, type AuditLog, type ManagedDatabase } from '../api.js';
import { MotionPanel } from '../components/MotionPanel.js';
import { useI18n } from '../i18n/context.js';
import type { NoticeApi } from '../types.js';
import { formatDate } from '../utils/format.js';

export function AuditTab({ database, notice }: { database: ManagedDatabase; notice: NoticeApi }) {
  const { t, locale } = useI18n();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const noneLabel = t('common.none');

  async function refresh() {
    setLoading(true);
    try {
      const result = await api.auditLogs(database.id);
      setLogs(result.logs);
    } catch (error) {
      notice.error(error instanceof Error ? error.message : t('audit.loadFailed'));
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
          <Typography.Text className="eyebrow">{t('tabs.audit')}</Typography.Text>
          <Typography.Title level={3}>{t('audit.title')}</Typography.Title>
        </div>
        <Button onClick={refresh}>{t('common.refresh')}</Button>
      </div>
      <Card className="admin-card">
        <Table
          rowKey="id"
          size="small"
          loading={loading}
          dataSource={logs}
          pagination={{ pageSize: 12 }}
          columns={[
            { title: t('common.time'), dataIndex: 'createdAt', render: (value: string) => formatDate(value, noneLabel, locale), width: 190 },
            { title: t('common.actor'), dataIndex: 'actor', width: 130 },
            { title: t('audit.action'), dataIndex: 'action', width: 210 },
            { title: t('common.detail'), dataIndex: 'detail', render: (value: unknown) => <pre className="inline-json">{JSON.stringify(value, null, 2)}</pre> }
          ]}
        />
      </Card>
    </MotionPanel>
  );
}
