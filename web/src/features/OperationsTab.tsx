import { Button, Card, Form, Input, Modal, Select, Space, Typography } from 'antd';
import { useEffect } from 'react';
import { api, type DatabaseStatus, type ManagedDatabase } from '../api.js';
import { MotionPanel } from '../components/MotionPanel.js';
import { confirmDanger } from '../components/confirmDanger.js';
import { useI18n } from '../i18n/context.js';
import { beginOperation, notifyError, notifySuccess } from '../utils/feedback.js';
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
  const { t } = useI18n();
  const [form] = Form.useForm<{ name: string; note: string; status: Exclude<DatabaseStatus, 'deleted'> }>();

  useEffect(() => {
    form.setFieldsValue({
      name: database.name,
      note: database.note || '',
      status: database.status === 'disabled' ? 'disabled' : 'active'
    });
  }, [database, form]);

  async function save(values: { name: string; note: string; status: Exclude<DatabaseStatus, 'deleted'> }) {
    beginOperation(notice);
    try {
      await api.updateDatabase(database.id, values);
      notifySuccess(notice, t('operations.infoUpdated'));
      await onRefreshDatabases();
    } catch (error) {
      notifyError(notice, t('operations.saveInfoAction'), error, t);
    }
  }

  async function rotateKey() {
    beginOperation(notice);
    try {
      const response = await api.rotateKey(database.id);
      Modal.success({ title: t('operations.keyRotated'), content: response.key, centered: true });
      await onRefreshDatabases();
    } catch (error) {
      notifyError(notice, t('operations.rotateKeyAction'), error, t);
    }
  }

  function softDelete() {
    confirmDanger({
      title: t('operations.softDeleteTitle', { name: database.name }),
      content: t('operations.softDeleteContent'),
      okText: t('operations.softDeleteOk'),
      cancelText: t('common.cancel'),
      notice,
      action: t('operations.softDeleteAction'),
      onOk: async () => {
        await api.softDeleteDatabase(database.id);
        notifySuccess(notice, t('operations.softDeleted', { name: database.name }));
        await onRefreshDatabases();
      }
    });
  }

  async function restore() {
    beginOperation(notice);
    try {
      await api.restoreDatabase(database.id);
      notifySuccess(notice, t('operations.restored', { name: database.name }));
      await onRefreshDatabases();
    } catch (error) {
      notifyError(notice, t('operations.restoreAction'), error, t);
    }
  }

  function permanentDelete() {
    let confirmName = '';
    Modal.confirm({
      title: t('operations.permanentDeleteTitle', { name: database.name }),
      content: (
        <div className="danger-confirm-content">
          <Typography.Paragraph>{t('operations.permanentDeleteContent')}</Typography.Paragraph>
          <Input placeholder={database.name} onChange={(event) => { confirmName = event.target.value; }} />
        </div>
      ),
      okText: t('operations.permanentDeleteOk'),
      okButtonProps: { danger: true },
      cancelText: t('common.cancel'),
      centered: true,
      onOk: async () => {
        await api.permanentlyDeleteDatabase(database.id, confirmName);
        notice.success(t('operations.permanentlyDeleted'));
        await onRefreshDatabases();
      }
    });
  }

  return (
    <MotionPanel className="workspace-panel">
      <div className="section-title-row">
        <div>
          <Typography.Text className="eyebrow">{t('tabs.operations')}</Typography.Text>
          <Typography.Title level={3}>{t('operations.title')}</Typography.Title>
        </div>
      </div>

      <div className="two-column-grid">
        <Card title={t('operations.basicInfo')} className="admin-card">
          <Form form={form} layout="vertical" onFinish={save} disabled={database.status === 'deleted'} requiredMark={false}>
            <Form.Item label={t('common.name')} name="name" rules={[{ required: true, message: t('operations.dbNameRequired') }]}>
              <Input />
            </Form.Item>
            <Form.Item label={t('common.note')} name="note">
              <Input.TextArea rows={4} />
            </Form.Item>
            <Form.Item label={t('common.status')} name="status">
              <Select options={[{ label: t('common.active'), value: 'active' }, { label: t('common.disabled'), value: 'disabled' }]} />
            </Form.Item>
            <Button type="primary" htmlType="submit">{t('common.save')}</Button>
          </Form>
        </Card>

        <Card title={t('operations.sensitiveOps')} className="admin-card danger-zone">
          <Typography.Paragraph type="secondary">{t('operations.sensitiveHint')}</Typography.Paragraph>
          <Space wrap>
            <Button disabled={database.status === 'deleted'} onClick={rotateKey}>{t('operations.rotateKey')}</Button>
            {database.status === 'deleted'
              ? <Button type="primary" onClick={restore}>{t('operations.restoreDatabase')}</Button>
              : <Button danger onClick={softDelete}>{t('operations.softDelete')}</Button>}
            <Button danger type="primary" onClick={permanentDelete}>{t('operations.permanentDelete')}</Button>
          </Space>
        </Card>
      </div>
    </MotionPanel>
  );
}
