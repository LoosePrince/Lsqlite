import { Button, Drawer, Form, Input, Select, Space } from 'antd';
import { useEffect } from 'react';
import { api, type ColumnInput, type ManagedDatabase, type TableInfo } from '../api.js';
import { JsonEditor } from '../components/JsonEditor.js';
import type { DrawerMode, NoticeApi, RowRecord } from '../types.js';
import { parseJsonArray, parseJsonObject } from '../utils/json.js';

const typeOptions = ['integer', 'real', 'text', 'blob', 'numeric', 'boolean', 'datetime'].map((value) => ({ label: value, value }));

export function AdminActionDrawer({
  mode,
  database,
  table,
  notice,
  onClose,
  onRefreshDatabases,
  onRefreshTables,
  onRowsChanged
}: {
  mode: DrawerMode;
  database: ManagedDatabase | null;
  table: TableInfo | null;
  notice: NoticeApi;
  onClose: () => void;
  onRefreshDatabases: () => Promise<void>;
  onRefreshTables: () => Promise<void>;
  onRowsChanged: () => void;
}) {
  const [form] = Form.useForm();
  const open = Boolean(mode);

  useEffect(() => {
    if (!open) return;
    if (mode === 'create-database') {
      form.setFieldsValue({ name: '', key: '', note: '' });
    }
    if (mode === 'create-table') {
      form.setFieldsValue({ name: 'items', columnsText: '[{"name":"id","type":"integer","primaryKey":true},{"name":"name","type":"text","notNull":true}]' });
    }
    if (mode === 'add-column') {
      form.setFieldsValue({ name: 'created_at', type: 'text', defaultValue: 'CURRENT_TIMESTAMP' });
    }
    if (mode === 'create-index') {
      form.setFieldsValue({ name: table ? `idx_${table.name}_name` : 'idx_items_name', columnsText: '["name"]', unique: 'false' });
    }
    if (mode === 'insert-row') {
      const firstTextColumn = table?.columns?.find((column) => String(column.type || '').toLowerCase().includes('text'))?.name;
      const values: RowRecord = firstTextColumn ? { [firstTextColumn]: 'demo' } : { name: 'demo' };
      form.setFieldsValue({ valuesText: JSON.stringify(values, null, 2) });
    }
  }, [form, mode, open, table]);

  async function submit(values: Record<string, unknown>) {
    try {
      if (mode === 'create-database') {
        const response = await api.createDatabase({
          name: String(values.name || ''),
          key: values.key ? String(values.key) : undefined,
          note: values.note ? String(values.note) : undefined
        });
        notice.success(`数据库已创建，key：${response.key}`);
        await onRefreshDatabases();
      }

      if (mode === 'create-table' && database) {
        await api.createTable(database.id, {
          name: String(values.name || ''),
          columns: parseJsonArray<ColumnInput>(String(values.columnsText || '[]'), '字段定义')
        });
        notice.success('表已创建');
        await onRefreshTables();
      }

      if (mode === 'add-column' && database && table) {
        await api.addColumn(database.id, table.name, {
          name: String(values.name || ''),
          type: values.type as ColumnInput['type'],
          defaultValue: values.defaultValue ? String(values.defaultValue) : undefined
        });
        notice.success('字段已添加');
        await onRefreshTables();
      }

      if (mode === 'create-index' && database && table) {
        await api.createIndex(database.id, table.name, {
          name: String(values.name || ''),
          columns: parseJsonArray<string>(String(values.columnsText || '[]'), '索引字段'),
          unique: values.unique === true || values.unique === 'true'
        });
        notice.success('索引已创建');
        await onRefreshTables();
      }

      if (mode === 'insert-row' && database && table) {
        await api.insertRow(database.id, table.name, parseJsonObject(String(values.valuesText || '{}'), '行数据'));
        notice.success('行已插入');
        onRowsChanged();
      }

      onClose();
    } catch (error) {
      notice.error(error instanceof Error ? error.message : '操作失败');
    }
  }

  return (
    <Drawer title={drawerTitle(mode)} open={open} onClose={onClose} width={520} destroyOnHidden>
      <Form form={form} layout="vertical" onFinish={submit} requiredMark={false}>
        {mode === 'create-database' ? <CreateDatabaseFields /> : null}
        {mode === 'create-table' ? <CreateTableFields form={form} /> : null}
        {mode === 'add-column' ? <AddColumnFields /> : null}
        {mode === 'create-index' ? <CreateIndexFields form={form} /> : null}
        {mode === 'insert-row' ? <InsertRowFields form={form} /> : null}
        <Space>
          <Button type="primary" htmlType="submit">提交</Button>
          <Button onClick={onClose}>取消</Button>
        </Space>
      </Form>
    </Drawer>
  );
}

function CreateDatabaseFields() {
  return (
    <>
      <Form.Item label="数据库名称" name="name" rules={[{ required: true, message: '请输入数据库名称' }]}><Input /></Form.Item>
      <Form.Item label="指定 key" name="key"><Input placeholder="留空自动生成" /></Form.Item>
      <Form.Item label="备注" name="note"><Input.TextArea rows={4} /></Form.Item>
    </>
  );
}

function CreateTableFields({ form }: { form: ReturnType<typeof Form.useForm>[0] }) {
  return (
    <>
      <Form.Item label="表名" name="name" rules={[{ required: true, message: '请输入表名' }]}><Input /></Form.Item>
      <Form.Item label="字段定义 JSON" name="columnsText" rules={[{ required: true, message: '请输入字段定义' }]}>
        <JsonEditor value={form.getFieldValue('columnsText') || ''} onChange={(value) => form.setFieldValue('columnsText', value)} rows={9} />
      </Form.Item>
    </>
  );
}

function AddColumnFields() {
  return (
    <>
      <Form.Item label="字段名" name="name" rules={[{ required: true, message: '请输入字段名' }]}><Input /></Form.Item>
      <Form.Item label="类型" name="type" rules={[{ required: true, message: '请选择字段类型' }]}><Select options={typeOptions} /></Form.Item>
      <Form.Item label="默认值" name="defaultValue"><Input /></Form.Item>
    </>
  );
}

function CreateIndexFields({ form }: { form: ReturnType<typeof Form.useForm>[0] }) {
  return (
    <>
      <Form.Item label="索引名" name="name" rules={[{ required: true, message: '请输入索引名' }]}><Input /></Form.Item>
      <Form.Item label="字段数组 JSON" name="columnsText" rules={[{ required: true, message: '请输入字段数组' }]}>
        <JsonEditor value={form.getFieldValue('columnsText') || ''} onChange={(value) => form.setFieldValue('columnsText', value)} rows={4} />
      </Form.Item>
      <Form.Item label="唯一索引" name="unique"><Select options={[{ label: '否', value: 'false' }, { label: '是', value: 'true' }]} /></Form.Item>
    </>
  );
}

function InsertRowFields({ form }: { form: ReturnType<typeof Form.useForm>[0] }) {
  return (
    <Form.Item label="行数据 JSON" name="valuesText" rules={[{ required: true, message: '请输入行数据' }]}>
      <JsonEditor value={form.getFieldValue('valuesText') || ''} onChange={(value) => form.setFieldValue('valuesText', value)} rows={10} />
    </Form.Item>
  );
}

function drawerTitle(mode: DrawerMode) {
  return ({
    'create-database': '创建数据库',
    'create-table': '创建表',
    'add-column': '添加字段',
    'create-index': '创建索引',
    'insert-row': '插入行',
    'edit-row': '编辑行'
  } as Record<Exclude<DrawerMode, null>, string>)[mode || 'create-database'];
}