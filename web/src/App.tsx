import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { api, type ColumnInput, type DatabaseStatus, type ManagedDatabase, type RowsResult, type TableInfo } from './api.js';

type Notice = { type: 'success' | 'error'; message: string } | null;
type Tab = 'info' | 'schema' | 'data' | 'sql' | 'audit' | 'api';

export function App() {
  const [admin, setAdmin] = useState<{ username: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<Notice>(null);

  useEffect(() => {
    api
      .me()
      .then((result) => setAdmin(result.admin))
      .catch(() => setAdmin(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <main className="center-card">加载中...</main>;
  if (!admin) return <Login onLogin={setAdmin} notice={notice} setNotice={setNotice} />;
  return <Dashboard admin={admin} setAdmin={setAdmin} notice={notice} setNotice={setNotice} />;
}

function Login({ onLogin, notice, setNotice }: { onLogin: (admin: { username: string }) => void; notice: Notice; setNotice: (notice: Notice) => void }) {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      const result = await api.login(username, password);
      setNotice({ type: 'success', message: '已登录后台' });
      onLogin(result.admin);
    } catch (error) {
      setNotice({ type: 'error', message: error instanceof Error ? error.message : '登录失败' });
    }
  }

  return (
    <main className="center-card">
      <form className="login-card" onSubmit={submit}>
        <p className="eyebrow">Lsqlite Admin</p>
        <h1>数据库服务后台</h1>
        <label>管理员<input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" /></label>
        <label>管理员密码<input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" /></label>
        <button type="submit">登录</button>
        {notice && <p className={`notice ${notice.type}`}>{notice.message}</p>}
      </form>
    </main>
  );
}

function Dashboard({
  admin,
  setAdmin,
  notice,
  setNotice
}: {
  admin: { username: string };
  setAdmin: (admin: { username: string } | null) => void;
  notice: Notice;
  setNotice: (notice: Notice) => void;
}) {
  const [databases, setDatabases] = useState<ManagedDatabase[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [status, setStatus] = useState<DatabaseStatus | 'all'>('active');
  const selected = useMemo(() => databases.find((item) => item.id === selectedId) || databases[0] || null, [databases, selectedId]);

  async function refresh(nextStatus = status) {
    const result = await api.listDatabases(nextStatus);
    setDatabases(result.databases);
    if (!result.databases.some((item) => item.id === selectedId)) setSelectedId(result.databases[0]?.id || null);
  }

  useEffect(() => {
    refresh().catch((error) => setNotice({ type: 'error', message: error instanceof Error ? error.message : '加载失败' }));
  }, [status]);

  async function logout() {
    await api.logout();
    setAdmin(null);
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Lsqlite Admin</p>
          <h1>数据库服务后台</h1>
        </div>
        <div className="admin-box"><span>{admin.username}</span><button className="secondary" onClick={logout}>退出</button></div>
      </header>

      {notice && <p className={`notice ${notice.type}`}>{notice.message}</p>}

      <section className="grid">
        <aside className="panel">
          <CreateDatabase onCreated={(message) => { setNotice({ type: 'success', message }); refresh(); }} onError={(message) => setNotice({ type: 'error', message })} />
          <div className="row-between"><h2>数据库</h2><select value={status} onChange={(event) => setStatus(event.target.value as DatabaseStatus | 'all')}><option value="active">active</option><option value="disabled">disabled</option><option value="deleted">deleted</option><option value="all">all</option></select></div>
          <div className="db-list">
            {databases.map((database) => (
              <button key={database.id} className={`db-item ${selected?.id === database.id ? 'active' : ''}`} onClick={() => setSelectedId(database.id)}>
                <strong>{database.name}</strong>
                <span>{database.status} · {formatBytes(database.fileSize)} · {database.filename}</span>
              </button>
            ))}
            {databases.length === 0 && <p className="muted">当前筛选下没有数据库。</p>}
          </div>
        </aside>

        <section className="panel detail">
          {selected ? (
            <DatabaseDetail database={selected} refresh={() => refresh()} setNotice={setNotice} />
          ) : (
            <div className="empty">创建一个数据库后即可生成 key 并开放 HTTP SQL API。</div>
          )}
        </section>
      </section>
    </main>
  );
}

function CreateDatabase({ onCreated, onError }: { onCreated: (message: string) => void; onError: (message: string) => void }) {
  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [note, setNote] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      const result = await api.createDatabase({ name, key: key || undefined, note: note || undefined });
      setName('');
      setKey('');
      setNote('');
      onCreated(`数据库已创建，key：${result.key}`);
    } catch (error) {
      onError(error instanceof Error ? error.message : '创建失败');
    }
  }

  return (
    <form className="create-form" onSubmit={submit}>
      <h2>创建数据库</h2>
      <input placeholder="数据库名称" value={name} onChange={(event) => setName(event.target.value)} required />
      <input placeholder="指定 key，可留空自动生成" value={key} onChange={(event) => setKey(event.target.value)} />
      <textarea placeholder="备注" value={note} onChange={(event) => setNote(event.target.value)} />
      <button type="submit">创建</button>
    </form>
  );
}

function DatabaseDetail({ database, refresh, setNotice }: { database: ManagedDatabase; refresh: () => Promise<void>; setNotice: (notice: Notice) => void }) {
  const [tab, setTab] = useState<Tab>('info');

  return (
    <div>
      <div className="detail-head">
        <div><p className="eyebrow">{database.status}</p><h2>{database.name}</h2><p className="muted">{database.absolutePath}</p></div>
      </div>
      <div className="tabs">
        {(['info', 'schema', 'data', 'sql', 'audit', 'api'] as Tab[]).map((item) => <button key={item} className={tab === item ? 'active' : 'secondary'} onClick={() => setTab(item)}>{tabText(item)}</button>)}
      </div>
      {tab === 'info' && <InfoTab database={database} refresh={refresh} setNotice={setNotice} />}
      {tab === 'schema' && <SchemaTab database={database} setNotice={setNotice} />}
      {tab === 'data' && <DataTab database={database} setNotice={setNotice} />}
      {tab === 'sql' && <SqlTab database={database} setNotice={setNotice} />}
      {tab === 'audit' && <AuditTab database={database} setNotice={setNotice} />}
      {tab === 'api' && <ApiTab database={database} />}
    </div>
  );
}

function InfoTab({ database, refresh, setNotice }: { database: ManagedDatabase; refresh: () => Promise<void>; setNotice: (notice: Notice) => void }) {
  const [name, setName] = useState(database.name);
  const [note, setNote] = useState(database.note || '');
  const [status, setStatus] = useState<Exclude<DatabaseStatus, 'deleted'>>(database.status === 'disabled' ? 'disabled' : 'active');

  useEffect(() => {
    setName(database.name);
    setNote(database.note || '');
    setStatus(database.status === 'disabled' ? 'disabled' : 'active');
  }, [database.id, database.name, database.note, database.status]);

  async function save() {
    try {
      await api.updateDatabase(database.id, { name, note, status });
      setNotice({ type: 'success', message: '基础信息已更新' });
      await refresh();
    } catch (error) {
      setNotice({ type: 'error', message: error instanceof Error ? error.message : '保存失败' });
    }
  }

  async function rotateKey() {
    try {
      const response = await api.rotateKey(database.id);
      setNotice({ type: 'success', message: `新 key：${response.key}` });
      await refresh();
    } catch (error) {
      setNotice({ type: 'error', message: error instanceof Error ? error.message : '轮换失败' });
    }
  }

  async function softDelete() {
    if (!confirm(`确认删除数据库 ${database.name}？可恢复，外部 key 会立即不可用。`)) return;
    await api.softDeleteDatabase(database.id);
    setNotice({ type: 'success', message: '数据库已软删除' });
    await refresh();
  }

  async function restore() {
    await api.restoreDatabase(database.id);
    setNotice({ type: 'success', message: '数据库已恢复' });
    await refresh();
  }

  async function permanentDelete() {
    const confirmName = prompt(`永久删除会移除 SQLite 文件。请输入数据库名称确认：${database.name}`);
    if (!confirmName) return;
    await api.permanentlyDeleteDatabase(database.id, confirmName);
    setNotice({ type: 'success', message: '数据库已永久删除' });
    await refresh();
  }

  return (
    <section className="card-grid">
      <div className="mini-panel">
        <h3>基础信息</h3>
        <label>名称<input value={name} disabled={database.status === 'deleted'} onChange={(event) => setName(event.target.value)} /></label>
        <label>备注<textarea value={note} disabled={database.status === 'deleted'} onChange={(event) => setNote(event.target.value)} /></label>
        <label>状态<select value={status} disabled={database.status === 'deleted'} onChange={(event) => setStatus(event.target.value as Exclude<DatabaseStatus, 'deleted'>)}><option value="active">active</option><option value="disabled">disabled</option></select></label>
        <button disabled={database.status === 'deleted'} onClick={save}>保存</button>
      </div>
      <div className="mini-panel">
        <h3>管理操作</h3>
        <p className="muted">文件大小：{formatBytes(database.fileSize)}</p>
        <p className="muted">最后访问：{database.lastAccessAt || '无'}</p>
        <div className="actions wrap">
          <button className="secondary" disabled={database.status === 'deleted'} onClick={rotateKey}>轮换 key</button>
          {database.status === 'deleted' ? <button onClick={restore}>恢复</button> : <button className="danger" onClick={softDelete}>删除</button>}
          <button className="danger" onClick={permanentDelete}>永久删除</button>
        </div>
      </div>
    </section>
  );
}

function SchemaTab({ database, setNotice }: { database: ManagedDatabase; setNotice: (notice: Notice) => void }) {
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [selected, setSelected] = useState('');
  const [tableName, setTableName] = useState('items');
  const [columnsJson, setColumnsJson] = useState('[{"name":"id","type":"integer","primaryKey":true},{"name":"name","type":"text","notNull":true}]');
  const [columnJson, setColumnJson] = useState('{"name":"created_at","type":"text","defaultValue":"CURRENT_TIMESTAMP"}');
  const [indexJson, setIndexJson] = useState('{"name":"idx_items_name","columns":["name"]}');
  const [dropIndexName, setDropIndexName] = useState('');

  async function refresh() {
    const result = await api.tables(database.id);
    setTables(result.tables);
    if (!selected && result.tables[0]) setSelected(result.tables[0].name);
  }

  useEffect(() => { refresh().catch((error) => setNotice({ type: 'error', message: error instanceof Error ? error.message : '读取表结构失败' })); }, [database.id]);

  async function createTable() {
    try {
      await api.createTable(database.id, { name: tableName, columns: JSON.parse(columnsJson) as ColumnInput[] });
      setNotice({ type: 'success', message: '表已创建' });
      await refresh();
    } catch (error) { setNotice({ type: 'error', message: error instanceof Error ? error.message : '建表失败' }); }
  }

  async function addColumn() {
    if (!selected) return;
    try {
      await api.addColumn(database.id, selected, JSON.parse(columnJson) as ColumnInput);
      setNotice({ type: 'success', message: '字段已添加' });
      await refresh();
    } catch (error) { setNotice({ type: 'error', message: error instanceof Error ? error.message : '添加字段失败' }); }
  }

  async function createIndex() {
    if (!selected) return;
    try {
      await api.createIndex(database.id, selected, JSON.parse(indexJson));
      setNotice({ type: 'success', message: '索引已创建' });
      await refresh();
    } catch (error) { setNotice({ type: 'error', message: error instanceof Error ? error.message : '创建索引失败' }); }
  }

  async function dropIndex() {
    if (!selected || !dropIndexName || !confirm(`确认删除索引 ${dropIndexName}？`)) return;
    try {
      await api.dropIndex(database.id, selected, dropIndexName);
      setDropIndexName('');
      setNotice({ type: 'success', message: '索引已删除' });
      await refresh();
    } catch (error) { setNotice({ type: 'error', message: error instanceof Error ? error.message : '删除索引失败' }); }
  }

  async function dropTable() {
    if (!selected || !confirm(`确认删除表 ${selected}？`)) return;
    await api.dropTable(database.id, selected, selected);
    setNotice({ type: 'success', message: '表已删除' });
    setSelected('');
    await refresh();
  }

  const current = tables.find((table) => table.name === selected);

  return (
    <section className="subgrid">
      <div className="mini-panel">
        <h3>表</h3>
        <div className="db-list">{tables.map((table) => <button key={table.name} className={`db-item ${selected === table.name ? 'active' : ''}`} onClick={() => setSelected(table.name)}><strong>{table.name}</strong><span>{table.type} · {table.rowCount ?? '-'} rows</span></button>)}</div>
        <h3>建表</h3>
        <input value={tableName} onChange={(event) => setTableName(event.target.value)} />
        <textarea value={columnsJson} onChange={(event) => setColumnsJson(event.target.value)} />
        <button onClick={createTable}>创建表</button>
      </div>
      <div className="mini-panel">
        <div className="row-between"><h3>{selected || '未选择表'}</h3>{selected && <button className="danger" onClick={dropTable}>删表</button>}</div>
        <pre className="code-box compact">{current ? JSON.stringify(current, null, 2) : '暂无表'}</pre>
        <h3>添加字段</h3><textarea value={columnJson} onChange={(event) => setColumnJson(event.target.value)} /><button disabled={!selected} onClick={addColumn}>添加字段</button>
        <h3>创建索引</h3><textarea value={indexJson} onChange={(event) => setIndexJson(event.target.value)} /><button disabled={!selected} onClick={createIndex}>创建索引</button>
        <h3>删除索引</h3><input placeholder="索引名称" value={dropIndexName} onChange={(event) => setDropIndexName(event.target.value)} /><button className="danger" disabled={!selected || !dropIndexName} onClick={dropIndex}>删除索引</button>
      </div>
    </section>
  );
}

function DataTab({ database, setNotice }: { database: ManagedDatabase; setNotice: (notice: Notice) => void }) {
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [selected, setSelected] = useState('');
  const [rows, setRows] = useState<RowsResult | null>(null);
  const [offset, setOffset] = useState(0);
  const [valuesJson, setValuesJson] = useState('{"name":"demo"}');
  const [whereJson, setWhereJson] = useState('{"id":1}');

  async function refreshTables() {
    const result = await api.tables(database.id);
    const tableOnly = result.tables.filter((table) => table.type === 'table');
    setTables(tableOnly);
    if (!selected && tableOnly[0]) setSelected(tableOnly[0].name);
  }

  async function refreshRows(nextOffset = offset) {
    if (!selected) return;
    const result = await api.rows(database.id, selected, { limit: 50, offset: nextOffset });
    setRows(result.result);
    setOffset(nextOffset);
  }

  useEffect(() => { refreshTables().catch((error) => setNotice({ type: 'error', message: error instanceof Error ? error.message : '读取表失败' })); }, [database.id]);
  useEffect(() => { refreshRows(0).catch(() => undefined); }, [selected]);

  async function insertRow() {
    try {
      await api.insertRow(database.id, selected, JSON.parse(valuesJson));
      setNotice({ type: 'success', message: '行已插入' });
      await refreshRows();
    } catch (error) { setNotice({ type: 'error', message: error instanceof Error ? error.message : '插入失败' }); }
  }

  async function updateRow() {
    try {
      await api.updateRows(database.id, selected, { values: JSON.parse(valuesJson), where: JSON.parse(whereJson) });
      setNotice({ type: 'success', message: '行已更新' });
      await refreshRows();
    } catch (error) { setNotice({ type: 'error', message: error instanceof Error ? error.message : '更新失败' }); }
  }

  async function deleteRow() {
    if (!confirm('确认删除匹配 where 的行？')) return;
    try {
      await api.deleteRows(database.id, selected, JSON.parse(whereJson));
      setNotice({ type: 'success', message: '行已删除' });
      await refreshRows();
    } catch (error) { setNotice({ type: 'error', message: error instanceof Error ? error.message : '删除失败' }); }
  }

  return (
    <section className="subgrid">
      <div className="mini-panel">
        <h3>数据表</h3>
        <div className="db-list">{tables.map((table) => <button key={table.name} className={`db-item ${selected === table.name ? 'active' : ''}`} onClick={() => setSelected(table.name)}><strong>{table.name}</strong><span>{table.rowCount ?? 0} rows</span></button>)}</div>
        <div className="actions wrap"><button disabled={!selected || offset === 0} onClick={() => refreshRows(Math.max(0, offset - 50))}>上一页</button><button disabled={!selected || !rows || offset + 50 >= rows.total} onClick={() => refreshRows(offset + 50)}>下一页</button><button disabled={!selected} onClick={() => refreshRows()}>刷新</button></div>
      </div>
      <div className="mini-panel">
        <h3>行数据</h3>
        <pre className="code-box compact">{rows ? JSON.stringify(rows, null, 2) : '请选择数据表'}</pre>
        <h3>插入 / 更新值</h3><textarea value={valuesJson} onChange={(event) => setValuesJson(event.target.value)} />
        <h3>更新 / 删除条件</h3><textarea value={whereJson} onChange={(event) => setWhereJson(event.target.value)} />
        <div className="actions wrap"><button disabled={!selected} onClick={insertRow}>插入</button><button disabled={!selected} onClick={updateRow}>按条件更新</button><button className="danger" disabled={!selected} onClick={deleteRow}>按条件删除</button></div>
      </div>
    </section>
  );
}

function SqlTab({ database, setNotice }: { database: ManagedDatabase; setNotice: (notice: Notice) => void }) {
  const [sql, setSql] = useState('select name, type, sql from sqlite_schema where name not like \'sqlite_%\' order by type, name;');
  const [result, setResult] = useState<unknown>(null);
  const examples = [
    'select name, type, sql from sqlite_schema where name not like \'sqlite_%\' order by type, name;',
    'select * from items limit 50;',
    'insert into items(name) values (\'demo\');',
    'update items set name = \'updated\' where id = 1;',
    'delete from items where id = 1;'
  ];

  async function runSql() {
    try {
      const response = await api.query(database.id, sql);
      setResult(response.results);
    } catch (error) {
      setNotice({ type: 'error', message: error instanceof Error ? error.message : '执行失败' });
    }
  }

  return <section className="mini-panel"><h3>SQL 控制台</h3><div className="actions wrap">{examples.map((item) => <button key={item} className="secondary" onClick={() => setSql(item)}>示例</button>)}</div><textarea className="sql-editor" value={sql} onChange={(event) => setSql(event.target.value)} /><button onClick={runSql}>执行 SQL</button><pre className="code-box result">{result ? JSON.stringify(result, null, 2) : '暂无结果'}</pre></section>;
}

function AuditTab({ database, setNotice }: { database: ManagedDatabase; setNotice: (notice: Notice) => void }) {
  const [logs, setLogs] = useState<unknown[]>([]);
  useEffect(() => { api.auditLogs(database.id).then((result) => setLogs(result.logs)).catch((error) => setNotice({ type: 'error', message: error instanceof Error ? error.message : '读取审计失败' })); }, [database.id]);
  return <section className="mini-panel"><h3>审计日志</h3><pre className="code-box">{JSON.stringify(logs, null, 2)}</pre></section>;
}

function ApiTab({ database }: { database: ManagedDatabase }) {
  const external = {
    query: `curl -X POST http://localhost:3000/api/query -H "Authorization: Bearer <database_key>" -H "Content-Type: application/json" -d "{\"sql\":\"select * from items limit 50\",\"mode\":\"read\"}"`,
    transaction: `curl -X POST http://localhost:3000/api/transaction -H "Authorization: Bearer <database_key>" -H "Content-Type: application/json" -d "{\"statements\":[{\"sql\":\"insert into items(name) values (?)\",\"params\":[\"demo\"]}]}"`
  };
  const admin = {
    tables: `GET /admin/databases/${database.id}/tables`,
    rows: `GET /admin/databases/${database.id}/tables/items/rows?limit=50&offset=0&orderBy=id&order=desc`,
    insert: `POST /admin/databases/${database.id}/tables/items/rows\n{ "values": { "name": "demo" } }`,
    update: `PATCH /admin/databases/${database.id}/tables/items/rows\n{ "values": { "name": "updated" }, "where": { "id": 1 } }`,
    delete: `DELETE /admin/databases/${database.id}/tables/items/rows\n{ "where": { "id": 1 } }`
  };

  return <section className="subgrid"><div className="mini-panel"><h3>外部 key API</h3><pre className="code-box compact">{JSON.stringify(external, null, 2)}</pre></div><div className="mini-panel"><h3>管理实际接口</h3><pre className="code-box compact">{JSON.stringify(admin, null, 2)}</pre></div></section>;
}

function tabText(tab: Tab) {
  return ({ info: '基础信息', schema: '表结构', data: '数据浏览', sql: 'SQL 控制台', audit: '审计日志', api: '接口示例' } as Record<Tab, string>)[tab];
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}