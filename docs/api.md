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

认证方式：

```http
Authorization: Bearer <database_key>
```

### 执行 SQL

`POST /api/query`

请求体：

```json
{
  "sql": "select * from users where id = ?",
  "params": [1],
  "mode": "auto"
}
```

字段：

- `sql`：SQLite SQL，可包含多条语句；参数只绑定第一条语句。
- `params`：数组参数或命名参数对象。
- `mode`：`auto`、`read`、`write`。`read` 会拒绝写语句。

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
      "statement": "select * from users where id = ?",
      "rows": [{ "id": 1, "name": "Ada" }],
      "rowCount": 1,
      "elapsedMs": 1.2
    }
  ]
}
```

### 执行事务

`POST /api/transaction`

请求体：

```json
{
  "statements": [
    { "sql": "insert into users(name) values (?)", "params": ["Ada"] },
    { "sql": "insert into logs(message) values (?)", "params": ["created Ada"] }
  ]
}
```

同一请求内任意语句失败时，事务整体回滚。

### 健康检查

`GET /api/health`

```json
{
  "ok": true,
  "service": "lsqlite"
}
```

## 管理后台 API

后台 API 使用 cookie session。推荐通过内置 React 后台使用。

- `POST /admin/login`
- `POST /admin/logout`
- `GET /admin/me`
- `GET /admin/databases`
- `POST /admin/databases`
- `PATCH /admin/databases/:id`
- `POST /admin/databases/:id/rotate-key`
- `GET /admin/databases/:id/schema`
- `POST /admin/databases/:id/query`

## 安全限制

外部 key 默认禁止：

- `ATTACH`
- `DETACH`
- `VACUUM INTO`
- `PRAGMA writable_schema`
- `load_extension()`

外部 key 无法访问站点数据库，只能访问 key 对应的独立 SQLite 文件。