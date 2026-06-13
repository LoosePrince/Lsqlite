import { Button, Card, Input, Modal, Select, Space, Table, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, type ManagedDatabase, type RowsResult, type TableInfo } from '../api.js';
import { JsonEditor } from '../components/JsonEditor.js';
import { MotionPanel } from '../components/MotionPanel.js';
import { TablePicker } from '../components/TablePicker.js';
import { confirmDanger } from '../components/confirmDanger.js';
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
        notifyError(notice, '读取行数据', error);
      } finally {
        setLoading(false);
      }
    },
    [database.id, limit, notice, offset, order, orderBy, selectedTableName]
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
      title: '操作',
      key: 'actions',
      fixed: 'right',
      width: 150,
      render: (_, row) => (
        <Space>
          <Button size="small" onClick={() => openEdit(row)}>编辑</Button>
          <Button size="small" danger onClick={() => deleteRow(row)}>删除</Button>
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
        values: parseJsonObject(valuesText, '更新值'),
        where: parseJsonObject(whereText, '更新条件')
      });
      notifySuccess(notice, '行数据已更新');
      setEditOpen(false);
      await refreshRows();
    } catch (error) {
      notifyError(notice, '更新行数据', error);
    }
  }

  function deleteRow(row: RowRecord) {
    if (!selectedTableName) return;
    const where = primaryWhere(selectedTable, row);
    confirmDanger({
      title: '删除行',
      content: `将按条件删除：${JSON.stringify(where)}`,
      okText: '删除行',
      notice,
      action: '删除行数据',
      onOk: async () => {
        await api.deleteRows(database.id, selectedTableName, where);
        notifySuccess(notice, '行数据已删除');
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
          <Typography.Text className="eyebrow">浏览</Typography.Text>
          <Typography.Title level={3}>数据浏览</Typography.Title>
        </div>
        <Space wrap>
          <Button type="primary" disabled={!selectedTableName} onClick={onOpenInsertRow}>插入行</Button>
          <Button disabled={!selectedTableName} onClick={() => refreshRows()}>刷新</Button>
        </Space>
      </div>

      <Card className="admin-card browse-toolbar">
        <Space wrap>
          <TablePicker tables={tableOnly} selectedTableName={selectedTableName} onSelect={onSelectTable} emptyText="暂无可浏览的数据表" />
          <Select className="mini-select" value={limit} onChange={setLimit} options={[25, 50, 100, 200].map((value) => ({ label: `${value} 行`, value }))} />
          <Select
            className="mini-select"
            allowClear
            placeholder="排序字段"
            value={orderBy}
            onChange={setOrderBy}
            options={visibleColumns.map((name) => ({ label: name, value: name }))}
          />
          <Select className="mini-select" value={order} onChange={setOrder} options={[{ label: '降序', value: 'desc' }, { label: '升序', value: 'asc' }]} />
          <Button disabled={!canPrev} onClick={() => refreshRows(Math.max(0, offset - limit))}>上一页</Button>
          <Button disabled={!canNext} onClick={() => refreshRows(offset + limit)}>下一页</Button>
          <Typography.Text type="secondary">共 {total} 行 · 偏移 {offset}</Typography.Text>
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
          locale={{ emptyText: selectedTableName ? '当前页没有数据' : '请选择数据表' }}
        />
      </Card>

      <Modal title="编辑行" open={editOpen} onCancel={() => setEditOpen(false)} onOk={updateRow} width={760} okText="保存" destroyOnHidden>
        <Typography.Text type="secondary">按 where 条件更新。请保持条件足够精确。</Typography.Text>
        <div className="modal-json-grid">
          <div>
            <Typography.Title level={5}>更新值</Typography.Title>
            <JsonEditor value={valuesText} onChange={setValuesText} rows={10} />
          </div>
          <div>
            <Typography.Title level={5}>更新条件</Typography.Title>
            <JsonEditor value={whereText} onChange={setWhereText} rows={10} />
          </div>
        </div>
        {editingRow ? <Input.TextArea className="raw-row-preview" value={prettyJson(editingRow)} rows={5} readOnly /> : null}
      </Modal>
    </MotionPanel>
  );
}