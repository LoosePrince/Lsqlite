import { Button, Card, Form, Input, Modal, Select, Space, Table, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useEffect, useMemo, useState } from 'react';
import { api, type ColumnInput, type ManagedDatabase, type TableInfo } from '../api.js';
import { JsonEditor } from '../components/JsonEditor.js';
import { MotionPanel } from '../components/MotionPanel.js';
import { TablePicker } from '../components/TablePicker.js';
import { confirmDanger } from '../components/confirmDanger.js';
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
    { title: '字段', dataIndex: 'name', fixed: 'left', width: 180 },
    { title: '类型', dataIndex: 'type', width: 130, render: (value) => String(value || '-') },
    { title: '非空', dataIndex: 'notnull', width: 110, render: (value) => value ? '是' : '否' },
    { title: '默认值', dataIndex: 'dflt_value', render: (value) => value === null || value === undefined ? '-' : String(value) },
    { title: '主键', dataIndex: 'pk', width: 100, render: (value) => value ? '是' : '否' }
  ];

  const indexColumns: ColumnsType<Record<string, unknown> & { name: string; columns?: unknown[] }> = [
    { title: '索引', dataIndex: 'name' },
    { title: '字段', dataIndex: 'columns', render: (value) => Array.isArray(value) ? value.join(', ') : '-' },
    { title: '唯一', dataIndex: 'unique', width: 100, render: (value) => value ? '是' : '否' },
    {
      title: '操作',
      width: 120,
      render: (_, index) => (
        <Button danger size="small" onClick={() => dropIndex(index.name)}>删除</Button>
      )
    }
  ];

  const tableRows = useMemo(() => tables.map((table) => ({ ...table, key: table.name })), [tables]);

  async function createTable(values: { name: string; columnsText: string }) {
    beginOperation(notice);
    try {
      const columns = parseJsonArray<ColumnInput>(values.columnsText, '字段定义');
      await api.createTable(database.id, { name: values.name, columns });
      notifySuccess(notice, `表 ${values.name} 已创建`);
      setQuickTableOpen(false);
      await onRefreshTables();
    } catch (error) {
      notifyError(notice, 'JSON 建表', error);
    }
  }

  async function addColumn(values: ColumnInput) {
    if (!selectedTableName) return;
    beginOperation(notice);
    try {
      await api.addColumn(database.id, selectedTableName, values);
      notifySuccess(notice, `字段 ${values.name} 已添加`);
      setQuickColumnOpen(false);
      await onRefreshTables();
    } catch (error) {
      notifyError(notice, '快速添加字段', error);
    }
  }

  function dropTable() {
    if (!selectedTableName) return;
    confirmDanger({
      title: `删除表 ${selectedTableName}`,
      content: '删除表会移除结构和数据，此操作不可从后台恢复。',
      okText: '删除表',
      notice,
      action: '删除表',
      onOk: async () => {
        await api.dropTable(database.id, selectedTableName, selectedTableName);
        notifySuccess(notice, `表 ${selectedTableName} 已删除`);
        await onRefreshTables();
      }
    });
  }

  function dropIndex(indexName: string) {
    if (!selectedTableName) return;
    confirmDanger({
      title: `删除索引 ${indexName}`,
      content: '索引删除后可能影响查询性能，但不会删除表数据。',
      okText: '删除索引',
      notice,
      action: '删除索引',
      onOk: async () => {
        await api.dropIndex(database.id, selectedTableName, indexName);
        notifySuccess(notice, `索引 ${indexName} 已删除`);
        await onRefreshTables();
      }
    });
  }

  async function createIndexFromJson(text: string) {
    if (!selectedTableName) return;
    beginOperation(notice);
    try {
      const input = parseJsonObject(text, '索引定义') as { name: string; columns: string[]; unique?: boolean };
      await api.createIndex(database.id, selectedTableName, input);
      notifySuccess(notice, `索引 ${input.name} 已创建`);
      await onRefreshTables();
    } catch (error) {
      notifyError(notice, '创建索引', error);
    }
  }

  return (
    <MotionPanel className="workspace-panel">
      <div className="section-title-row">
        <div>
          <Typography.Text className="eyebrow">结构</Typography.Text>
          <Typography.Title level={3}>表结构</Typography.Title>
        </div>
        <Space wrap>
          <Button type="primary" onClick={onOpenCreateTable}>创建表</Button>
          <Button onClick={() => setQuickTableOpen(true)}>JSON 建表</Button>
          <Button disabled={!selectedTableName} onClick={onOpenAddColumn}>添加字段</Button>
          <Button disabled={!selectedTableName} onClick={onOpenCreateIndex}>创建索引</Button>
          <Button disabled={!selectedTableName} danger onClick={dropTable}>删除表</Button>
        </Space>
      </div>

      <div className="two-column-grid structure-grid">
        <Card title="表列表" className="admin-card">
          <Table
            rowKey="name"
            size="small"
            dataSource={tableRows}
            pagination={false}
            onRow={(record) => ({ onClick: () => onSelectTable(record.name) })}
            rowClassName={(record) => record.name === selectedTableName ? 'selected-row' : ''}
            columns={[
              { title: '名称', dataIndex: 'name' },
              { title: '类型', dataIndex: 'type', width: 90 },
              { title: '行数', dataIndex: 'rowCount', width: 90, render: (value) => value ?? '-' },
              { title: '字段', dataIndex: 'columns', width: 90, render: (value: unknown[]) => value.length }
            ]}
          />
        </Card>

        <Card
          title={selectedTable ? `表：${selectedTable.name}` : '未选择表'}
          className="admin-card"
          extra={<TablePicker tables={tables} selectedTableName={selectedTableName} onSelect={onSelectTable} />}
        >
          <Typography.Title level={5}>字段</Typography.Title>
          <Table rowKey="name" size="small" dataSource={selectedTable?.columns || []} columns={columnColumns} pagination={false} scroll={{ x: 720 }} />
          <div className="section-spacer" />
          <Typography.Title level={5}>索引</Typography.Title>
          <Table rowKey="name" size="small" dataSource={selectedTable?.indexes || []} columns={indexColumns} pagination={false} />
          <div className="section-spacer" />
          <Typography.Title level={5}>原始 SQL</Typography.Title>
          <pre className="inline-sql">{selectedTable?.sql || '无'}</pre>
        </Card>
      </div>

      <Modal title="JSON 建表" open={quickTableOpen} onCancel={() => setQuickTableOpen(false)} footer={null} destroyOnHidden>
        <Form form={tableForm} layout="vertical" onFinish={createTable} requiredMark={false}>
          <Form.Item label="表名" name="name" rules={[{ required: true, message: '请输入表名' }]}><Input /></Form.Item>
          <Form.Item label="字段定义 JSON" name="columnsText" rules={[{ required: true, message: '请输入字段定义' }]}><JsonEditor value={tableForm.getFieldValue('columnsText') || ''} onChange={(value) => tableForm.setFieldValue('columnsText', value)} rows={7} /></Form.Item>
          <Button type="primary" htmlType="submit">创建</Button>
        </Form>
      </Modal>

      <Modal title="快速添加字段" open={quickColumnOpen} onCancel={() => setQuickColumnOpen(false)} footer={null} destroyOnHidden>
        <Form form={columnForm} layout="vertical" onFinish={addColumn} requiredMark={false}>
          <Form.Item label="字段名" name="name" rules={[{ required: true, message: '请输入字段名' }]}><Input /></Form.Item>
          <Form.Item label="类型" name="type" rules={[{ required: true, message: '请选择类型' }]}><Select options={typeOptions} /></Form.Item>
          <Form.Item label="默认值" name="defaultValue"><Input /></Form.Item>
          <Button type="primary" htmlType="submit">添加</Button>
        </Form>
      </Modal>

      <Card title="索引 JSON 快捷入口" className="admin-card compact-card">
        <IndexJsonBox disabled={!selectedTableName} onSubmit={createIndexFromJson} />
      </Card>
    </MotionPanel>
  );
}

function IndexJsonBox({ disabled, onSubmit }: { disabled: boolean; onSubmit: (text: string) => void }) {
  const [text, setText] = useState('{"name":"idx_items_name","columns":["name"]}');
  return (
    <Space direction="vertical" className="full-width">
      <JsonEditor value={text} onChange={setText} rows={4} />
      <Button disabled={disabled} onClick={() => onSubmit(text)}>创建索引</Button>
    </Space>
  );
}