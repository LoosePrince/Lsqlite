import { Button, Card, Input, Modal, Select, Space, Table, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, type ManagedDatabase, type RowsResult, type TableInfo } from '../api.js';
import { JsonEditor } from '../components/JsonEditor.js';
import { MotionPanel } from '../components/MotionPanel.js';
import { TablePicker } from '../components/TablePicker.js';
import { confirmDanger } from '../components/confirmDanger.js';
import { useI18n } from '../i18n/context.js';
import type { NoticeApi, RowRecord } from '../types.js';
import { parseJsonObject, prettyJson } from '../utils/json.js';
import { primaryWhere, tableColumns, writableValues } from '../utils/schema.js';
import { beginOperation, notifyError, notifySuccess } from '../utils/feedback.js';
import { valuePreview } from '../utils/format.js';

export function BrowseTab({
  database,
  tables,
  selectedTable,
  selectedTableName,
  notice,
  onSelectTable,
  onOpenInsertRow,
  refreshSignal = 0
}: {
  database: ManagedDatabase;
  tables: TableInfo[];
  selectedTable: TableInfo | null;
  selectedTableName: string | null;
  notice: NoticeApi;
  onSelectTable: (name: string) => void;
  onOpenInsertRow: () => void;
  refreshSignal?: number;
}) {
  const { t } = useI18n();
  const [rowsResult, setRowsResult] = useState<RowsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [limit, setLimit] = useState(50);
  const [offset, setOffset] = useState(0);
  const [orderBy, setOrderBy] = useState<string | undefined>();
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const [editOpen, setEditOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<RowRecord | null>(null);
  const [valuesText, setValuesText] = useState('{}');
  const [whereText, setWhereText] = useState('{}');

  const tableOnly = useMemo(() => tables.filter((table) => table.type === 'table'), [tables]);
  const dataRows = rowsResult?.rows || [];
  const visibleColumns = tableColumns(selectedTable, dataRows);

  const refreshRows = useCallback(
    async (nextOffset = offset) => {
      if (!selectedTableName) {
        setRowsResult(null);
        return;
      }
      setLoading(true);
      try {
        const result = await api.rows(database.id, selectedTableName, { limit, offset: nextOffset, orderBy, order });
        setRowsResult(result.result);
        setOffset(nextOffset);
      } catch (error) {
        notifyError(notice, t('browse.loadRowsAction'), error, t);
      } finally {
        setLoading(false);
      }
    },
    [database.id, limit, notice, offset, order, orderBy, selectedTableName, t]
  );

  useEffect(() => {
    setOffset(0);
    refreshRows(0).catch(() => undefined);
  }, [selectedTableName, limit, orderBy, order, refreshSignal]);

  const columns: ColumnsType<RowRecord> = [
    ...visibleColumns.map((name) => ({
      title: name,
      dataIndex: name,
      ellipsis: true,
      render: (value: unknown) => <span className="cell-value">{valuePreview(value)}</span>
    })),
    {
      title: t('common.actions'),
      key: 'actions',
      fixed: 'right' as const,
      width: 150,
      render: (_, row) => (
        <Space>
          <Button size="small" onClick={() => openEdit(row)}>{t('common.edit')}</Button>
          <Button size="small" danger onClick={() => deleteRow(row)}>{t('common.delete')}</Button>
        </Space>
      )
    }
  ];

  function openEdit(row: RowRecord) {
    const where = primaryWhere(selectedTable, row);
    setEditingRow(row);
    setValuesText(prettyJson(writableValues(row)));
    setWhereText(prettyJson(where));
    setEditOpen(true);
  }

  async function updateRow() {
    if (!selectedTableName) return;
    beginOperation(notice);
    try {
      await api.updateRows(database.id, selectedTableName, {
        values: parseJsonObject(valuesText, t('json.updateValues')),
        where: parseJsonObject(whereText, t('json.updateWhere'))
      });
      notifySuccess(notice, t('browse.rowUpdated'));
      setEditOpen(false);
      await refreshRows();
    } catch (error) {
      notifyError(notice, t('browse.updateRowAction'), error, t);
    }
  }

  function deleteRow(row: RowRecord) {
    if (!selectedTableName) return;
    const where = primaryWhere(selectedTable, row);
    confirmDanger({
      title: t('browse.deleteRow'),
      content: t('browse.deleteRowContent', { where: JSON.stringify(where) }),
      okText: t('browse.deleteRowOk'),
      cancelText: t('common.cancel'),
      notice,
      action: t('browse.deleteRowAction'),
      onOk: async () => {
        await api.deleteRows(database.id, selectedTableName, where);
        notifySuccess(notice, t('browse.rowDeleted'));
        await refreshRows();
      }
    });
  }

  const total = rowsResult?.total || 0;
  const canPrev = offset > 0;
  const canNext = offset + limit < total;

  return (
    <MotionPanel className="workspace-panel">
      <div className="section-title-row">
        <div>
          <Typography.Text className="eyebrow">{t('tabs.browse')}</Typography.Text>
          <Typography.Title level={3}>{t('browse.title')}</Typography.Title>
        </div>
        <Space wrap>
          <Button type="primary" disabled={!selectedTableName} onClick={onOpenInsertRow}>{t('browse.insertRow')}</Button>
          <Button disabled={!selectedTableName} onClick={() => refreshRows()}>{t('common.refresh')}</Button>
        </Space>
      </div>

      <Card className="admin-card browse-toolbar">
        <Space wrap>
          <TablePicker tables={tableOnly} selectedTableName={selectedTableName} onSelect={onSelectTable} emptyText={t('browse.noBrowsableTables')} />
          <Select className="mini-select" value={limit} onChange={setLimit} options={[25, 50, 100, 200].map((value) => ({ label: t('browse.rowsPerPage', { count: value }), value }))} />
          <Select
            className="mini-select"
            allowClear
            placeholder={t('browse.orderByPlaceholder')}
            value={orderBy}
            onChange={setOrderBy}
            options={visibleColumns.map((name) => ({ label: name, value: name }))}
          />
          <Select className="mini-select" value={order} onChange={setOrder} options={[{ label: t('common.desc'), value: 'desc' }, { label: t('common.asc'), value: 'asc' }]} />
          <Button disabled={!canPrev} onClick={() => refreshRows(Math.max(0, offset - limit))}>{t('common.prevPage')}</Button>
          <Button disabled={!canNext} onClick={() => refreshRows(offset + limit)}>{t('common.nextPage')}</Button>
          <Typography.Text type="secondary">{t('browse.totalRows', { total, offset })}</Typography.Text>
        </Space>
      </Card>

      <Card className="admin-card data-card">
        <Table
          rowKey={(_, index) => `${selectedTableName || 'row'}-${offset}-${index}`}
          size="small"
          loading={loading}
          dataSource={dataRows}
          columns={columns}
          pagination={false}
          scroll={{ x: Math.max(900, visibleColumns.length * 180), y: 520 }}
          locale={{ emptyText: selectedTableName ? t('browse.emptyPage') : t('browse.selectTable') }}
        />
      </Card>

      <Modal title={t('browse.editRow')} open={editOpen} onCancel={() => setEditOpen(false)} onOk={updateRow} width={760} okText={t('common.save')} destroyOnHidden>
        <Typography.Text type="secondary">{t('browse.editHint')}</Typography.Text>
        <div className="modal-json-grid">
          <div>
            <Typography.Title level={5}>{t('browse.updateValues')}</Typography.Title>
            <JsonEditor value={valuesText} onChange={setValuesText} rows={10} />
          </div>
          <div>
            <Typography.Title level={5}>{t('browse.updateWhere')}</Typography.Title>
            <JsonEditor value={whereText} onChange={setWhereText} rows={10} />
          </div>
        </div>
        {editingRow ? <Input.TextArea className="raw-row-preview" value={prettyJson(editingRow)} rows={5} readOnly /> : null}
      </Modal>
    </MotionPanel>
  );
}
