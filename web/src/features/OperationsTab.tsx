import { Button, Card, Form, Input, Modal, Select, Space, Typography } from 'antd';
import { useEffect } from 'react';
import { api, type DatabaseStatus, type ManagedDatabase } from '../api.js';
import { MotionPanel } from '../components/MotionPanel.js';
import { confirmDanger } from '../components/confirmDanger.js';
import type { NoticeApi } from '../types.js';

export function OperationsTab({
  database,
  notice,
  onRefreshDatabases
}: {
  database: ManagedDatabase;
  notice: NoticeApi;
  onRefreshDatabases: () => Promise<void>;
}) {
  const [form] = Form.useForm<{ name: string; note: string; status: Exclude<DatabaseStatus, 'deleted'> }>();

  useEffect(() => {
    form.setFieldsValue({
      name: database.name,
      note: database.note || '',
      status: database.status === 'disabled' ? 'disabled' : 'active'
    });
  }, [database, form]);

  async function save(values: { name: string; note: string; status: Exclude<DatabaseStatus, 'deleted'> }) {
    try {
      await api.updateDatabase(database.id, values);
      notice.success('数据库基础信息已更新');
      await onRefreshDatabases();
    } catch (error) {
      notice.error(error instanceof Error ? error.message : '保存失败');
    }
  }

  async function rotateKey() {
    try {
      const response = await api.rotateKey(database.id);
      Modal.success({ title: '新 key 已生成', content: response.key, centered: true });
      await onRefreshDatabases();
    } catch (error) {
      notice.error(error instanceof Error ? error.message : '轮换 key 失败');
    }
  }

  function softDelete() {
    confirmDanger({
      title: `软删除 ${database.name}`,
      content: '数据库会从默认列表隐藏，外部 key 立即不可用，SQLite 文件仍保留。',
      okText: '软删除',
      onOk: async () => {
        await api.softDeleteDatabase(database.id);
        notice.success('数据库已软删除');
        await onRefreshDatabases();
      }
    });
  }

  async function restore() {
    try {
      await api.restoreDatabase(database.id);
      notice.success('数据库已恢复');
      await onRefreshDatabases();
    } catch (error) {
      notice.error(error instanceof Error ? error.message : '恢复失败');
    }
  }

  function permanentDelete() {
    let confirmName = '';
    Modal.confirm({
      title: `永久删除 ${database.name}`,
      content: (
        <div className="danger-confirm-content">
          <Typography.Paragraph>此操作会删除元数据和 SQLite 文件。请输入数据库名称确认。</Typography.Paragraph>
          <Input placeholder={database.name} onChange={(event) => { confirmName = event.target.value; }} />
        </div>
      ),
      okText: '永久删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      centered: true,
      onOk: async () => {
        await api.permanentlyDeleteDatabase(database.id, confirmName);
        notice.success('数据库已永久删除');
        await onRefreshDatabases();
      }
    });
  }

  return (
    <MotionPanel className="workspace-panel">
      <div className="section-title-row">
        <div>
          <Typography.Text className="eyebrow">Operations</Typography.Text>
          <Typography.Title level={3}>数据库操作</Typography.Title>
        </div>
      </div>

      <div className="two-column-grid">
        <Card title="基础信息" className="admin-card">
          <Form form={form} layout="vertical" onFinish={save} disabled={database.status === 'deleted'} requiredMark={false}>
            <Form.Item label="名称" name="name" rules={[{ required: true, message: '请输入数据库名称' }]}>
              <Input />
            </Form.Item>
            <Form.Item label="备注" name="note">
              <Input.TextArea rows={4} />
            </Form.Item>
            <Form.Item label="状态" name="status">
              <Select options={[{ label: 'active', value: 'active' }, { label: 'disabled', value: 'disabled' }]} />
            </Form.Item>
            <Button type="primary" htmlType="submit">保存</Button>
          </Form>
        </Card>

        <Card title="敏感操作" className="admin-card danger-zone">
          <Typography.Paragraph type="secondary">key 只在创建或轮换时展示，站点数据库只保存摘要。</Typography.Paragraph>
          <Space wrap>
            <Button disabled={database.status === 'deleted'} onClick={rotateKey}>轮换 key</Button>
            {database.status === 'deleted' ? <Button type="primary" onClick={restore}>恢复数据库</Button> : <Button danger onClick={softDelete}>软删除</Button>}
            <Button danger type="primary" onClick={permanentDelete}>永久删除</Button>
          </Space>
        </Card>
      </div>
    </MotionPanel>
  );
}