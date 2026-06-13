# HTTP API 文档

## 通用响应

成功：

```json
{
  "ok": true
}
```

失败：

```json
{
  "ok": false,
  "error": {
    "code": "REQUEST_ERROR",
    "message": "错误说明"
  }
}
```

## 外部数据库 API

外部接口面向数据库调用方。每个数据库使用独立 key 访问，key 创建或轮换时只展示一次，服务端只保存摘要。

认证方式：

```http
Authorization: Bearer <database_key>
Content-Type: application/json
```

### 健康检查

`GET /api/health`

```json
{
  "ok": true,
  "service": "lsqlite"
}
```

### 执行 SQL

`POST /api/query`

请求体：

```json
{
  "sql": "select * from users where id = ?",
  "params": [1],
  "mode": "read"
}
```

字段：

- `sql`：SQLite SQL，可包含多条语句；参数只绑定第一条语句。
- `params`：数组参数或命名参数对象。
- `mode`：`auto`、`read`、`write`。`read` 会拒绝写语句。

curl 示例：

```bash
curl -X POST http://localhost:3000/api/query \
  -H "Authorization: Bearer <database_key>" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "read",
    "sql": "select id, name from users where id = ?",
    "params": [1]
  }'
```

响应：

```json
{
  "ok": true,
  "database": {
    "id": "db_id",
    "name": "example"
  },
  "results": [
    {
      "statement": "select id, name from users where id = ?",
      "rows": [{ "id": 1, "name": "Ada" }],
      "rowCount": 1,
      "elapsedMs": 1.2
    }
  ]
}
```

### 查询表结构

外部 key 没有单独 schema 路由，使用 SQLite 自身结构表：

```bash
curl -X POST http://localhost:3000/api/query \
  -H "Authorization: Bearer <database_key>" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "read",
    "sql": "select name, type, sql from sqlite_schema where name not like '\''sqlite_%'\'' order by type, name"
  }'
```

单表字段：

```json
{
  "mode": "read",
  "sql": "pragma table_info(users)"
}
```

分页查询：

```json
{
  "mode": "read",
  "sql": "select id, name, created_at from users order by id desc limit ? offset ?",
  "params": [50, 0]
}
```

参数绑定写入：

```json
{
  "mode": "write",
  "sql": "insert into users(name) values (?)",
  "params": ["Ada"]
}
```

### 执行事务

`POST /api/transaction`

请求体：

```json
{
  "statements": [
    { "sql": "insert into users(name) values (?)", "params": ["Ada"], "mode": "write" },
    { "sql": "insert into logs(message) values (?)", "params": ["created Ada"], "mode": "write" }
  ]
}
```

同一请求内任意语句失败时，事务整体回滚。

## 管理后台 API

后台 API 使用 cookie session。推荐通过内置 React 后台使用；以下接口用于真实路由对接和自动化管理。

### 会话

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `POST` | `/admin/login` | 登录，提交 `username`、`password` |
| `POST` | `/admin/logout` | 退出 |
| `GET` | `/admin/me` | 当前登录状态 |

### 数据库管理

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/admin/databases?status=active` | 数据库列表，`status` 支持 `active`、`disabled`、`deleted`、`all` |
| `POST` | `/admin/databases` | 创建数据库，提交 `name`、可选 `key`、可选 `note` |
| `PATCH` | `/admin/databases/:id` | 修改名称、备注、状态 |
| `DELETE` | `/admin/databases/:id` | 软删除，文件保留，外部 key 立即不可用 |
| `POST` | `/admin/databases/:id/restore` | 恢复软删除数据库 |
| `DELETE` | `/admin/databases/:id/permanent` | 永久删除元数据和 SQLite 文件，提交 `confirmName` |
| `POST` | `/admin/databases/:id/rotate-key` | 轮换 key，可提交指定 `key` |
| `GET` | `/admin/databases/:id/stats` | 数据库统计 |
| `GET` | `/admin/audit-logs?databaseId=:id&limit=50` | 审计日志 |

创建数据库：

```bash
curl -X POST http://localhost:3000/admin/databases \
  -H "Content-Type: application/json" \
  -b cookies.txt -c cookies.txt \
  -d '{"name":"demo","note":"example"}'
```

更新名称和备注：

```json
{
  "name": "demo-renamed",
  "note": "new note",
  "status": "active"
}
```

永久删除确认：

```json
{
  "confirmName": "demo-renamed"
}
```

### 表结构管理

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/admin/databases/:id/tables` | 列出表、视图、字段、索引、行数 |
| `GET` | `/admin/databases/:id/tables/:table` | 单表结构详情 |
| `POST` | `/admin/databases/:id/tables` | 建表 |
| `DELETE` | `/admin/databases/:id/tables/:table` | 删表，提交 `confirmName` |
| `POST` | `/admin/databases/:id/tables/:table/columns` | 添加字段 |
| `POST` | `/admin/databases/:id/tables/:table/indexes` | 创建索引 |
| `DELETE` | `/admin/databases/:id/tables/:table/indexes/:index` | 删除索引 |

建表：

```json
{
  "name": "items",
  "columns": [
    { "name": "id", "type": "integer", "primaryKey": true },
    { "name": "name", "type": "text", "notNull": true },
    { "name": "created_at", "type": "text", "defaultValue": "CURRENT_TIMESTAMP" }
  ]
}
```

添加字段：

```json
{
  "name": "note",
  "type": "text"
}
```

创建索引：

```json
{
  "name": "idx_items_name",
  "columns": ["name"]
}
```

### 表数据管理

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/admin/databases/:id/tables/:table/rows?limit=50&offset=0&orderBy=id&order=desc` | 分页读取数据 |
| `POST` | `/admin/databases/:id/tables/:table/rows` | 插入一行 |
| `PATCH` | `/admin/databases/:id/tables/:table/rows` | 按条件更新 |
| `DELETE` | `/admin/databases/:id/tables/:table/rows` | 按条件删除 |

插入：

```json
{
  "values": {
    "name": "demo",
    "note": "hello"
  }
}
```

更新：

```json
{
  "values": {
    "note": "updated"
  },
  "where": {
    "id": 1
  }
}
```

删除：

```json
{
  "where": {
    "id": 1
  }
}
```

表数据管理接口只接受当前表中存在的字段，值使用参数绑定。更新和删除必须提供非空 `where`。

### 管理员 SQL 控制台

`POST /admin/databases/:id/query`

```json
{
  "sql": "select name, type, sql from sqlite_schema where name not like 'sqlite_%' order by type, name",
  "mode": "read"
}
```

管理员 SQL 控制台允许更高权限语句，适合维护和迁移；破坏性操作应优先使用后台二次确认入口。

## 安全限制

外部 key 默认禁止：

- `ATTACH`
- `DETACH`
- `VACUUM INTO`
- `PRAGMA writable_schema`
- `load_extension()`

外部 key 无法访问站点数据库，只能访问 key 对应的独立 SQLite 文件。`disabled` 和 `deleted` 数据库无法通过外部 key 访问。