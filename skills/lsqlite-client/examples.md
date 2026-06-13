# Lsqlite Client Examples

## 读取数据库结构

```bash
curl -X POST "$LSQLITE_BASE_URL/api/query" \
  -H "Authorization: Bearer $LSQLITE_DATABASE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "read",
    "sql": "select name, type, sql from sqlite_schema where name not like '\''sqlite_%'\'' order by type, name"
  }'
```

## 读取单表字段

```bash
curl -X POST "$LSQLITE_BASE_URL/api/query" \
  -H "Authorization: Bearer $LSQLITE_DATABASE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "read",
    "sql": "pragma table_info(notes)"
  }'
```

## 创建表

```json
{
  "sql": "create table if not exists notes (id integer primary key autoincrement, title text not null, body text, created_at text not null default CURRENT_TIMESTAMP)",
  "mode": "write"
}
```

## 参数绑定插入数据

```json
{
  "sql": "insert into notes(title, body) values (?, ?)",
  "params": ["第一条笔记", "内容"],
  "mode": "write"
}
```

## 分页查询数据

```json
{
  "sql": "select id, title, created_at from notes order by id desc limit ? offset ?",
  "params": [20, 0],
  "mode": "read"
}
```

## 参数绑定更新数据

```json
{
  "sql": "update notes set title = ? where id = ?",
  "params": ["更新后的标题", 1],
  "mode": "write"
}
```

## 参数绑定删除数据

```json
{
  "sql": "delete from notes where id = ?",
  "params": [1],
  "mode": "write"
}
```

## 事务写入

```json
{
  "statements": [
    {
      "sql": "insert into notes(title, body) values (?, ?)",
      "params": ["事务笔记", "正文"],
      "mode": "write"
    },
    {
      "sql": "insert into audit_logs(message) values (?)",
      "params": ["created note"],
      "mode": "write"
    }
  ]
}
```

## fetch 调用示例

```js
const response = await fetch(`${process.env.LSQLITE_BASE_URL}/api/query`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${process.env.LSQLITE_DATABASE_KEY}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    mode: 'read',
    sql: 'select id, title from notes order by id desc limit ? offset ?',
    params: [20, 0]
  })
});

const payload = await response.json();
const rows = payload.results[0].rows;
```

## 调用方 AI 提示词模板

```text
你可以使用 Lsqlite HTTP API 访问数据库。
服务地址：<LSQLITE_BASE_URL>
数据库 key：<LSQLITE_DATABASE_KEY>
默认先读取 sqlite_schema 理解结构。
所有用户输入都必须使用参数绑定。
读取数据默认分页。
写操作前说明影响范围并等待确认，除非用户已经明确要求执行。
优先使用 SQLite SQL；MySQL/PostgreSQL 语法只使用 SQLite 可兼容部分。
不要访问站点数据库、其他数据库文件或文件系统。
```