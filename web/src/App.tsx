import { useEffect, useMemo, useState } from 'react';
import { api, type ManagedDatabase } from './api.js';

type Notice = { type: 'success' | 'error'; message: string } | null;

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

  if (!admin) {
    return <Login onLogin={setAdmin} notice={notice} setNotice={setNotice} />;
  }

  return <Dashboard admin={admin} setAdmin={setAdmin} notice={notice} setNotice={setNotice} />;
}

function Login({ onLogin, notice, setNotice }: { onLogin: (admin: { username: string }) => void; notice: Notice; setNotice: (notice: Notice) => void }) {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');

  async function submit(event: React.FormEvent) {
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
        <label>
          管理员
          <input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" />
        </label>
        <label>
          管理员密码
          <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" />
        </label>
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
  const selected = useMemo(() => databases.find((item) => item.id === selectedId) || databases[0] || null, [databases, selectedId]);

  async function refresh() {
    const result = await api.listDatabases();
    setDatabases(result.databases);
    if (!selectedId && result.databases[0]) setSelectedId(result.databases[0].id);
  }

  useEffect(() => {
    refresh().catch((error) => setNotice({ type: 'error', message: error instanceof Error ? error.message : '加载失败' }));
  }, []);

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
        <div className="admin-box">
          <span>{admin.username}</span>
          <button className="secondary" onClick={logout}>退出</button>
        </div>
      </header>

      {notice && <p className={`notice ${notice.type}`}>{notice.message}</p>}

      <section className="grid">
        <aside className="panel">
          <CreateDatabase onCreated={(message) => { setNotice({ type: 'success', message }); refresh(); }} onError={(message) => setNotice({ type: 'error', message })} />
          <h2>数据库</h2>
          <div className="db-list">
            {databases.map((database) => (
              <button
                key={database.id}
                className={`db-item ${selected?.id === database.id ? 'active' : ''}`}
                onClick={() => setSelectedId(database.id)}
              >
                <strong>{database.name}</strong>
                <span>{database.status} · {database.filename}</span>
              </button>
            ))}
            {databases.length === 0 && <p className="muted">还没有数据库。</p>}
          </div>
        </aside>

        <section className="panel detail">
          {selected ? (
            <DatabaseDetail database={selected} refresh={refresh} setNotice={setNotice} />
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

  async function submit(event: React.FormEvent) {
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
  const [schema, setSchema] = useState<unknown[]>([]);
  const [sql, setSql] = useState('select name, type, sql from sqlite_schema where name not like \'sqlite_%\' order by type, name;');
  const [result, setResult] = useState<unknown>(null);

  useEffect(() => {
    api
      .schema(database.id)
      .then((response) => setSchema(response.schema))
      .catch((error) => setNotice({ type: 'error', message: error instanceof Error ? error.message : '读取 schema 失败' }));
  }, [database.id]);

  async function runSql() {
    try {
      const response = await api.query(database.id, sql);
      setResult(response.results);
    } catch (error) {
      setNotice({ type: 'error', message: error instanceof Error ? error.message : '执行失败' });
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

  async function toggleStatus() {
    try {
      await api.updateDatabase(database.id, { status: database.status === 'active' ? 'disabled' : 'active' });
      await refresh();
    } catch (error) {
      setNotice({ type: 'error', message: error instanceof Error ? error.message : '更新失败' });
    }
  }

  return (
    <div>
      <div className="detail-head">
        <div>
          <p className="eyebrow">{database.status}</p>
          <h2>{database.name}</h2>
          <p className="muted">{database.absolutePath}</p>
        </div>
        <div className="actions">
          <button className="secondary" onClick={rotateKey}>轮换 key</button>
          <button className="secondary" onClick={toggleStatus}>{database.status === 'active' ? '禁用' : '启用'}</button>
        </div>
      </div>

      <section className="subgrid">
        <div>
          <h3>结构</h3>
          <pre className="code-box">{JSON.stringify(schema, null, 2)}</pre>
        </div>
        <div>
          <h3>SQL 控制台</h3>
          <textarea className="sql-editor" value={sql} onChange={(event) => setSql(event.target.value)} />
          <button onClick={runSql}>执行 SQL</button>
          <pre className="code-box result">{result ? JSON.stringify(result, null, 2) : '暂无结果'}</pre>
        </div>
      </section>
    </div>
  );
}