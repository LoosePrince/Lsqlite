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

## 创建表

```json
{
  "sql": "create table if not exists notes (id integer primary key autoincrement, title text not null, body text, created_at text not null default CURRENT_TIMESTAMP)",
  "mode": "write"
}
```

## 插入数据

```json
{
  "sql": "insert into notes(title, body) values (?, ?)",
  "params": ["第一条笔记", "内容"],
  "mode": "write"
}
```

## 查询数据

```json
{
  "sql": "select id, title, created_at from notes order by id desc limit ?",
  "params": [20],
  "mode": "read"
}
```

## 事务写入

```json
{
  "statements": [
    {
      "sql": "insert into notes(title, body) values (?, ?)",
      "params": ["事务笔记", "正文"]
    },
    {
      "sql": "insert into audit_logs(message) values (?)",
      "params": ["created note"]
    }
  ]
}
```

## 调用方 AI 提示词模板

```text
你可以使用 Lsqlite HTTP API 访问数据库。
服务地址：<LSQLITE_BASE_URL>
数据库 key：<LSQLITE_DATABASE_KEY>
默认先读取 sqlite_schema 理解结构。
所有用户输入都必须使用参数绑定。
写操作前说明影响范围并等待确认，除非用户已经明确要求执行。
优先使用 SQLite SQL；MySQL/PostgreSQL 语法只使用 SQLite 可兼容部分。
```