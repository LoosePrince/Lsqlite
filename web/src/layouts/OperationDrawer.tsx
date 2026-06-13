import { Button, Checkbox, Drawer, Form, Input, Modal, Select } from 'antd';
import { api, type ColumnInput, type ManagedDatabase, type TableInfo } from '../api.js';
import { JsonEditor } from '../components/JsonEditor.js';
import { useI18n } from '../i18n/context.js';
import type { DrawerMode, NoticeApi } from '../types.js';
import { beginOperation, notifyError, notifySuccess } from '../utils/feedback.js';
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
  const { t } = useI18n();
  const [form] = Form.useForm();
  const open = mode !== null;

  function close() {
    form.resetFields();
    onClose();
  }

  async function submit(values: Record<string, unknown>) {
    const action = drawerAction(mode, t);
    beginOperation(notice);
    try {
      if (mode === 'create-database') {
        const result = await api.createDatabase({
          name: String(values.name || ''),
          key: values.key ? String(values.key) : undefined,
          note: values.note ? String(values.note) : undefined
        });
        Modal.success({ title: t('drawer.dbCreated'), content: t('drawer.accessKey', { key: result.key }), centered: true });
        await onRefreshDatabases();
        onDatabaseCreated(result.database.id);
      }

      if (mode === 'create-table' && database) {
        const columns = parseJsonArray<ColumnInput>(String(values.columns || '[]'), t('json.columnDef'));
        await api.createTable(database.id, { name: String(values.name || ''), columns, ifNotExists: Boolean(values.ifNotExists) });
        notifySuccess(notice, t('drawer.tableCreated', { name: String(values.name || '') }));
        await onRefreshTables();
      }

      if (mode === 'add-column' && database && table) {
        await api.addColumn(database.id, table.name, values as ColumnInput);
        notifySuccess(notice, t('drawer.columnAdded', { name: String(values.name || '') }));
        await onRefreshTables();
      }

      if (mode === 'create-index' && database && table) {
        const columns = String(values.columns || '').split(',').map((item) => item.trim()).filter(Boolean);
        await api.createIndex(database.id, table.name, { name: String(values.name || ''), columns, unique: Boolean(values.unique) });
        notifySuccess(notice, t('drawer.indexCreated', { name: String(values.name || '') }));
        await onRefreshTables();
      }

      if (mode === 'insert-row' && database && table) {
        const row = parseJsonObject(String(values.values || '{}'), t('json.rowData'));
        await api.insertRow(database.id, table.name, row);
        notifySuccess(notice, t('drawer.rowInserted', { table: table.name }));
        onRowsChanged();
      }

      close();
    } catch (error) {
      notifyError(notice, action, error, t);
    }
  }

  return (
    <Drawer title={drawerTitle(mode, table, t)} open={open} onClose={close} width={520} destroyOnHidden>
      <Form form={form} layout="vertical" onFinish={submit} requiredMark={false} initialValues={initialValues(mode)}>
        {mode === 'create-database' ? (
          <>
            <Form.Item label={t('drawer.dbName')} name="name" rules={[{ required: true, message: t('drawer.dbNameRequired') }]}><Input /></Form.Item>
            <Form.Item label={t('drawer.customKey')} name="key"><Input placeholder={t('drawer.keyAutoPlaceholder')} /></Form.Item>
            <Form.Item label={t('common.note')} name="note"><Input.TextArea rows={4} /></Form.Item>
          </>
        ) : null}

        {mode === 'create-table' ? (
          <>
            <Form.Item label={t('drawer.tableName')} name="name" rules={[{ required: true, message: t('structure.tableNameRequired') }]}><Input /></Form.Item>
            <Form.Item name="ifNotExists" valuePropName="checked"><Checkbox>IF NOT EXISTS</Checkbox></Form.Item>
            <Form.Item label={t('drawer.columnDefJson')} name="columns" rules={[{ required: true, message: t('drawer.columnDefRequired') }]}>
              <JsonField rows={10} />
            </Form.Item>
          </>
        ) : null}

        {mode === 'add-column' ? (
          <>
            <Form.Item label={t('drawer.columnName')} name="name" rules={[{ required: true, message: t('drawer.columnNameRequired') }]}><Input /></Form.Item>
            <Form.Item label={t('common.type')} name="type" rules={[{ required: true, message: t('drawer.typeRequired') }]}><Select options={columnTypes} /></Form.Item>
            <Form.Item name="primaryKey" valuePropName="checked"><Checkbox>Primary Key</Checkbox></Form.Item>
            <Form.Item name="notNull" valuePropName="checked"><Checkbox>Not Null</Checkbox></Form.Item>
            <Form.Item name="unique" valuePropName="checked"><Checkbox>Unique</Checkbox></Form.Item>
            <Form.Item label={t('common.defaultValue')} name="defaultValue"><Input placeholder={t('drawer.defaultPlaceholder')} /></Form.Item>
          </>
        ) : null}

        {mode === 'create-index' ? (
          <>
            <Form.Item label={t('drawer.indexName')} name="name" rules={[{ required: true, message: t('drawer.indexNameRequired') }]}><Input /></Form.Item>
            <Form.Item label={t('drawer.columnList')} name="columns" rules={[{ required: true, message: t('drawer.columnListRequired') }]}><Input placeholder="name, created_at" /></Form.Item>
            <Form.Item name="unique" valuePropName="checked"><Checkbox>Unique Index</Checkbox></Form.Item>
          </>
        ) : null}

        {mode === 'insert-row' ? (
          <Form.Item label={t('drawer.rowDataJson')} name="values" rules={[{ required: true, message: t('drawer.rowDataRequired') }]}>
            <JsonField rows={12} />
          </Form.Item>
        ) : null}

        <Button type="primary" htmlType="submit" block>{t('common.submit')}</Button>
      </Form>
    </Drawer>
  );
}

function JsonField({ value, onChange, rows }: { value?: string; onChange?: (value: string) => void; rows: number }) {
  return <JsonEditor value={value || ''} onChange={(next) => onChange?.(next)} rows={rows} />;
}

function drawerAction(mode: DrawerMode, t: (key: string) => string) {
  if (!mode) return t('drawer.createDatabaseAction');
  const map = {
    'create-database': t('drawer.createDatabaseAction'),
    'create-table': t('drawer.createTableAction'),
    'add-column': t('drawer.addColumnAction'),
    'create-index': t('drawer.createIndexAction'),
    'insert-row': t('drawer.insertRowAction'),
    'edit-row': t('drawer.editRowAction')
  } as const satisfies Record<Exclude<DrawerMode, null>, string>;
  return map[mode];
}

function drawerTitle(mode: DrawerMode, table: TableInfo | null, t: (key: string, values?: Record<string, string | number>) => string) {
  if (!mode) return t('drawer.createDatabase');
  switch (mode) {
    case 'create-database':
      return t('drawer.createDatabase');
    case 'create-table':
      return t('drawer.createTable');
    case 'add-column':
      return table ? t('drawer.addColumnFor', { table: table.name }) : t('drawer.addColumn');
    case 'create-index':
      return table ? t('drawer.createIndexFor', { table: table.name }) : t('drawer.createIndex');
    case 'insert-row':
      return table ? t('drawer.insertRowFor', { table: table.name }) : t('drawer.insertRow');
    case 'edit-row':
      return t('drawer.editRow');
    default: {
      const unexpected: never = mode;
      throw new Error(`Unsupported drawer mode: ${unexpected}`);
    }
  }
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
