import { Button, Card, Form, Input, Modal, Select, Space, Table, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useEffect, useMemo, useState } from 'react';
import { api, type ColumnInput, type ManagedDatabase, type TableInfo } from '../api.js';
import { JsonEditor } from '../components/JsonEditor.js';
import { MotionPanel } from '../components/MotionPanel.js';
import { confirmDanger } from '../components/confirmDanger.js';
import { useI18n } from '../i18n/context.js';
import type { NoticeApi } from '../types.js';
import { beginOperation, notifyError, notifySuccess } from '../utils/feedback.js';
import { parseJsonArray, parseJsonObject } from '../utils/json.js';

const typeOptions = ['integer', 'real', 'text', 'blob', 'numeric', 'boolean', 'datetime'].map((value) => ({ label: value, value }));

export function StructureTab({
  database,
  tables,
  selectedTable,
  selectedTableName,
  notice,
  onSelectTable,
  onRefreshTables,
  onOpenCreateTable,
  onOpenAddColumn,
  onOpenCreateIndex
}: {
  database: ManagedDatabase;
  tables: TableInfo[];
  selectedTable: TableInfo | null;
  selectedTableName: string | null;
  notice: NoticeApi;
  onSelectTable: (name: string) => void;
  onRefreshTables: () => Promise<void>;
  onOpenCreateTable: () => void;
  onOpenAddColumn: () => void;
  onOpenCreateIndex: () => void;
}) {
  const { t } = useI18n();
  const [quickTableOpen, setQuickTableOpen] = useState(false);
  const [quickColumnOpen, setQuickColumnOpen] = useState(false);
  const [tableForm] = Form.useForm<{ name: string; columnsText: string }>();
  const [columnForm] = Form.useForm<ColumnInput>();

  useEffect(() => {
    tableForm.setFieldsValue({
      name: 'items',
      columnsText: '[{"name":"id","type":"integer","primaryKey":true},{"name":"name","type":"text","notNull":true}]'
    });
    columnForm.setFieldsValue({ name: 'created_at', type: 'text', defaultValue: 'CURRENT_TIMESTAMP' });
  }, [columnForm, tableForm]);

  const columnColumns: ColumnsType<Record<string, unknown> & { name: string }> = [
    { title: t('common.column'), dataIndex: 'name', fixed: 'left', width: 180 },
    { title: t('common.type'), dataIndex: 'type', width: 130, render: (value) => String(value || '-') },
    { title: t('common.notNull'), dataIndex: 'notnull', width: 110, render: (value) => value ? t('common.yes') : t('common.no') },
    { title: t('common.defaultValue'), dataIndex: 'dflt_value', render: (value) => value === null || value === undefined ? '-' : String(value) },
    { title: t('common.primaryKey'), dataIndex: 'pk', width: 100, render: (value) => value ? t('common.yes') : t('common.no') }
  ];

  const indexColumns: ColumnsType<Record<string, unknown> & { name: string; columns?: unknown[] }> = [
    { title: t('common.index'), dataIndex: 'name' },
    { title: t('common.column'), dataIndex: 'columns', render: (value) => Array.isArray(value) ? value.join(', ') : '-' },
    { title: t('common.unique'), dataIndex: 'unique', width: 100, render: (value) => value ? t('common.yes') : t('common.no') },
    {
      title: t('common.actions'),
      width: 120,
      render: (_, index) => (
        <Button danger size="small" onClick={() => dropIndex(index.name)}>{t('common.delete')}</Button>
      )
    }
  ];

  const tableRows = useMemo(() => tables.map((table) => ({ ...table, key: table.name })), [tables]);

  async function createTable(values: { name: string; columnsText: string }) {
    beginOperation(notice);
    try {
      const columns = parseJsonArray<ColumnInput>(values.columnsText, t('json.columnDef'));
      await api.createTable(database.id, { name: values.name, columns });
      notifySuccess(notice, t('structure.tableCreated', { name: values.name }));
      setQuickTableOpen(false);
      await onRefreshTables();
    } catch (error) {
      notifyError(notice, t('structure.jsonCreateTableAction'), error, t);
    }
  }

  async function addColumn(values: ColumnInput) {
    if (!selectedTableName) return;
    beginOperation(notice);
    try {
      await api.addColumn(database.id, selectedTableName, values);
      notifySuccess(notice, t('structure.columnAdded', { name: values.name }));
      setQuickColumnOpen(false);
      await onRefreshTables();
    } catch (error) {
      notifyError(notice, t('structure.quickAddColumnAction'), error, t);
    }
  }

  function dropTable() {
    if (!selectedTableName) return;
    confirmDanger({
      title: t('structure.dropTableTitle', { name: selectedTableName }),
      content: t('structure.dropTableContent'),
      okText: t('structure.dropTableOk'),
      cancelText: t('common.cancel'),
      notice,
      action: t('structure.dropTableAction'),
      onOk: async () => {
        await api.dropTable(database.id, selectedTableName, selectedTableName);
        notifySuccess(notice, t('structure.tableDropped', { name: selectedTableName }));
        await onRefreshTables();
      }
    });
  }

  function dropIndex(indexName: string) {
    if (!selectedTableName) return;
    confirmDanger({
      title: t('structure.dropIndexTitle', { name: indexName }),
      content: t('structure.dropIndexContent'),
      okText: t('structure.dropIndexOk'),
      cancelText: t('common.cancel'),
      notice,
      action: t('structure.dropIndexAction'),
      onOk: async () => {
        await api.dropIndex(database.id, selectedTableName, indexName);
        notifySuccess(notice, t('structure.indexDropped', { name: indexName }));
        await onRefreshTables();
      }
    });
  }

  async function createIndexFromJson(text: string) {
    if (!selectedTableName) return;
    beginOperation(notice);
    try {
      const input = parseJsonObject(text, t('json.indexDef')) as { name: string; columns: string[]; unique?: boolean };
      await api.createIndex(database.id, selectedTableName, input);
      notifySuccess(notice, t('structure.indexCreated', { name: input.name }));
      await onRefreshTables();
    } catch (error) {
      notifyError(notice, t('structure.createIndexAction'), error, t);
    }
  }

  return (
    <MotionPanel className="workspace-panel">
      <div className="section-title-row">
        <div>
          <Typography.Text className="eyebrow">{t('tabs.structure')}</Typography.Text>
          <Typography.Title level={3}>{t('structure.title')}</Typography.Title>
        </div>
        <Space wrap>
          <Button type="primary" onClick={onOpenCreateTable}>{t('structure.createTable')}</Button>
          <Button onClick={() => setQuickTableOpen(true)}>{t('structure.jsonCreateTable')}</Button>
          <Button disabled={!selectedTableName} onClick={onOpenAddColumn}>{t('structure.addColumn')}</Button>
          <Button disabled={!selectedTableName} onClick={onOpenCreateIndex}>{t('structure.createIndex')}</Button>
          <Button disabled={!selectedTableName} danger onClick={dropTable}>{t('structure.dropTable')}</Button>
        </Space>
      </div>

      <div className="two-column-grid structure-grid">
        <Card title={t('structure.tableList')} className="admin-card">
          <Table
            rowKey="name"
            size="small"
            dataSource={tableRows}
            pagination={false}
            onRow={(record) => ({ onClick: () => onSelectTable(record.name) })}
            rowClassName={(record) => record.name === selectedTableName ? 'selected-row' : ''}
            columns={[
              { title: t('common.name'), dataIndex: 'name' },
              { title: t('common.type'), dataIndex: 'type', width: 90 },
              { title: t('common.rowCount'), dataIndex: 'rowCount', width: 90, render: (value) => value ?? '-' },
              { title: t('common.columns'), dataIndex: 'columns', width: 90, render: (value: unknown[]) => value.length }
            ]}
          />
        </Card>

        <Card
          title={selectedTable ? t('structure.tableTitle', { name: selectedTable.name }) : t('structure.noTableSelected')}
          className="admin-card"
        >
          <Typography.Title level={5}>{t('common.columns')}</Typography.Title>
          <Table rowKey="name" size="small" dataSource={selectedTable?.columns || []} columns={columnColumns} pagination={false} scroll={{ x: 720 }} />
          <div className="section-spacer" />
          <Typography.Title level={5}>{t('common.indexes')}</Typography.Title>
          <Table rowKey="name" size="small" dataSource={selectedTable?.indexes || []} columns={indexColumns} pagination={false} />
          <div className="section-spacer" />
          <Typography.Title level={5}>{t('structure.rawSql')}</Typography.Title>
          <pre className="inline-sql">{selectedTable?.sql || t('common.none')}</pre>
        </Card>
      </div>

      <Modal title={t('structure.jsonCreateTableModal')} open={quickTableOpen} onCancel={() => setQuickTableOpen(false)} footer={null} destroyOnHidden>
        <Form form={tableForm} layout="vertical" onFinish={createTable} requiredMark={false}>
          <Form.Item label={t('structure.tableName')} name="name" rules={[{ required: true, message: t('structure.tableNameRequired') }]}><Input /></Form.Item>
          <Form.Item label={t('structure.columnDefJson')} name="columnsText" rules={[{ required: true, message: t('structure.columnDefRequired') }]}><JsonEditor value={tableForm.getFieldValue('columnsText') || ''} onChange={(value) => tableForm.setFieldValue('columnsText', value)} rows={7} /></Form.Item>
          <Button type="primary" htmlType="submit">{t('common.create')}</Button>
        </Form>
      </Modal>

      <Modal title={t('structure.quickAddColumn')} open={quickColumnOpen} onCancel={() => setQuickColumnOpen(false)} footer={null} destroyOnHidden>
        <Form form={columnForm} layout="vertical" onFinish={addColumn} requiredMark={false}>
          <Form.Item label={t('structure.columnName')} name="name" rules={[{ required: true, message: t('structure.columnNameRequired') }]}><Input /></Form.Item>
          <Form.Item label={t('common.type')} name="type" rules={[{ required: true, message: t('structure.typeRequired') }]}><Select options={typeOptions} /></Form.Item>
          <Form.Item label={t('common.defaultValue')} name="defaultValue"><Input /></Form.Item>
          <Button type="primary" htmlType="submit">{t('common.add')}</Button>
        </Form>
      </Modal>

      <Card title={t('structure.indexJsonShortcut')} className="admin-card compact-card">
        <IndexJsonBox disabled={!selectedTableName} onSubmit={createIndexFromJson} createLabel={t('structure.createIndex')} />
      </Card>
    </MotionPanel>
  );
}

function IndexJsonBox({ disabled, onSubmit, createLabel }: { disabled: boolean; onSubmit: (text: string) => void; createLabel: string }) {
  const [text, setText] = useState('{"name":"idx_items_name","columns":["name"]}');
  return (
    <Space direction="vertical" className="full-width">
      <JsonEditor value={text} onChange={setText} rows={4} />
      <Button disabled={disabled} onClick={() => onSubmit(text)}>{createLabel}</Button>
    </Space>
  );
}
