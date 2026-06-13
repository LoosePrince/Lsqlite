import { Button, Checkbox, Drawer, Form, Input, Modal, Select } from 'antd';
import { api, type ColumnInput, type ManagedDatabase, type TableInfo } from '../api.js';
import { JsonEditor } from '../components/JsonEditor.js';
import type { DrawerMode, NoticeApi } from '../types.js';
import { parseJsonArray, parseJsonObject } from '../utils/json.js';

const columnTypes = ['integer', 'real', 'text', 'blob', 'numeric', 'boolean', 'datetime'].map((value) => ({ label: value, value }));

export function OperationDrawer({
  mode,
  database,
  table,
  notice,
  onClose,
  onDatabaseCreated,
  onRefreshDatabases,
  onRefreshTables,
  onRowsChanged
}: {
  mode: DrawerMode;
  database: ManagedDatabase | null;
  table: TableInfo | null;
  notice: NoticeApi;
  onClose: () => void;
  onDatabaseCreated: (id: string) => void;
  onRefreshDatabases: () => Promise<void>;
  onRefreshTables: () => Promise<void>;
  onRowsChanged: () => void;
}) {
  const [form] = Form.useForm();
  const open = mode !== null;

  function close() {
    form.resetFields();
    onClose();
  }

  async function submit(values: Record<string, unknown>) {
    try {
      if (mode === 'create-database') {
        const result = await api.createDatabase({
          name: String(values.name || ''),
          key: values.key ? String(values.key) : undefined,
          note: values.note ? String(values.note) : undefined
        });
        Modal.success({ title: '数据库已创建', content: `key：${result.key}`, centered: true });
        await onRefreshDatabases();
        onDatabaseCreated(result.database.id);
      }

      if (mode === 'create-table' && database) {
        const columns = parseJsonArray<ColumnInput>(String(values.columns || '[]'), '字段定义');
        await api.createTable(database.id, { name: String(values.name || ''), columns, ifNotExists: Boolean(values.ifNotExists) });
        notice.success('表已创建');
        await onRefreshTables();
      }

      if (mode === 'add-column' && database && table) {
        await api.addColumn(database.id, table.name, values as ColumnInput);
        notice.success('字段已添加');
        await onRefreshTables();
      }

      if (mode === 'create-index' && database && table) {
        const columns = String(values.columns || '').split(',').map((item) => item.trim()).filter(Boolean);
        await api.createIndex(database.id, table.name, { name: String(values.name || ''), columns, unique: Boolean(values.unique) });
        notice.success('索引已创建');
        await onRefreshTables();
      }

      if (mode === 'insert-row' && database && table) {
        const row = parseJsonObject(String(values.values || '{}'), '行数据');
        await api.insertRow(database.id, table.name, row);
        notice.success('行已插入');
        onRowsChanged();
      }

      close();
    } catch (error) {
      notice.error(error instanceof Error ? error.message : '操作失败');
    }
  }

  return (
    <Drawer title={drawerTitle(mode, table)} open={open} onClose={close} width={520} destroyOnHidden>
      <Form form={form} layout="vertical" onFinish={submit} requiredMark={false} initialValues={initialValues(mode)}>
        {mode === 'create-database' ? (
          <>
            <Form.Item label="数据库名称" name="name" rules={[{ required: true, message: '请输入数据库名称' }]}><Input /></Form.Item>
            <Form.Item label="指定 key" name="key"><Input placeholder="留空自动生成" /></Form.Item>
            <Form.Item label="备注" name="note"><Input.TextArea rows={4} /></Form.Item>
          </>
        ) : null}

        {mode === 'create-table' ? (
          <>
            <Form.Item label="表名" name="name" rules={[{ required: true, message: '请输入表名' }]}><Input /></Form.Item>
            <Form.Item name="ifNotExists" valuePropName="checked"><Checkbox>IF NOT EXISTS</Checkbox></Form.Item>
            <Form.Item label="字段定义 JSON" name="columns" rules={[{ required: true, message: '请输入字段定义' }]}>
              <JsonField rows={10} />
            </Form.Item>
          </>
        ) : null}

        {mode === 'add-column' ? (
          <>
            <Form.Item label="字段名" name="name" rules={[{ required: true, message: '请输入字段名' }]}><Input /></Form.Item>
            <Form.Item label="类型" name="type" rules={[{ required: true, message: '请选择类型' }]}><Select options={columnTypes} /></Form.Item>
            <Form.Item name="primaryKey" valuePropName="checked"><Checkbox>Primary Key</Checkbox></Form.Item>
            <Form.Item name="notNull" valuePropName="checked"><Checkbox>Not Null</Checkbox></Form.Item>
            <Form.Item name="unique" valuePropName="checked"><Checkbox>Unique</Checkbox></Form.Item>
            <Form.Item label="默认值" name="defaultValue"><Input placeholder="例如 CURRENT_TIMESTAMP" /></Form.Item>
          </>
        ) : null}

        {mode === 'create-index' ? (
          <>
            <Form.Item label="索引名" name="name" rules={[{ required: true, message: '请输入索引名' }]}><Input /></Form.Item>
            <Form.Item label="字段列表" name="columns" rules={[{ required: true, message: '请输入字段列表' }]}><Input placeholder="name, created_at" /></Form.Item>
            <Form.Item name="unique" valuePropName="checked"><Checkbox>Unique Index</Checkbox></Form.Item>
          </>
        ) : null}

        {mode === 'insert-row' ? (
          <Form.Item label="行数据 JSON" name="values" rules={[{ required: true, message: '请输入行数据' }]}>
            <JsonField rows={12} />
          </Form.Item>
        ) : null}

        <Button type="primary" htmlType="submit" block>提交</Button>
      </Form>
    </Drawer>
  );
}

function JsonField({ value, onChange, rows }: { value?: string; onChange?: (value: string) => void; rows: number }) {
  return <JsonEditor value={value || ''} onChange={(next) => onChange?.(next)} rows={rows} />;
}

function drawerTitle(mode: DrawerMode, table: TableInfo | null) {
  return ({
    'create-database': '创建数据库',
    'create-table': '创建表',
    'add-column': `添加字段${table ? `：${table.name}` : ''}`,
    'create-index': `创建索引${table ? `：${table.name}` : ''}`,
    'insert-row': `插入行${table ? `：${table.name}` : ''}`,
    'edit-row': '编辑行'
  } as Record<Exclude<DrawerMode, null>, string>)[mode || 'create-database'];
}

function initialValues(mode: DrawerMode) {
  if (mode === 'create-table') {
    return {
      name: 'items',
      ifNotExists: true,
      columns: '[{"name":"id","type":"integer","primaryKey":true},{"name":"name","type":"text","notNull":true}]'
    };
  }
  if (mode === 'add-column') return { name: 'created_at', type: 'text', defaultValue: 'CURRENT_TIMESTAMP' };
  if (mode === 'create-index') return { name: 'idx_items_name', columns: 'name', unique: false };
  if (mode === 'insert-row') return { values: '{"name":"demo"}' };
  return {};
}