# Lsqlite Client Skill

## 目标

当用户要求你使用 Lsqlite 数据库服务读写数据时，使用本 Skill。Lsqlite 是一个通过 HTTP API 暴露 SQLite 能力的数据库服务，每个数据库通过独立 key 访问。

## 必要上下文

调用前需要确认：

- `LSQLITE_BASE_URL`：服务地址，例如 `http://localhost:3000`。
- `LSQLITE_DATABASE_KEY`：数据库 key。
- 用户是否允许写入、更新、删除或建表。

如果缺少服务地址或数据库 key，先向用户索取，不要猜测。

## 认证

所有数据库请求都使用：

```http
Authorization: Bearer <LSQLITE_DATABASE_KEY>
Content-Type: application/json
```

## API

### 查询或执行单组 SQL

`POST /api/query`

```json
{
  "sql": "select * from users where id = ?",
  "params": [1],
  "mode": "read"
}
```

`mode`：

- `read`：只允许读取。
- `write`：用于写入意图。
- `auto`：由服务判断。

### 事务

`POST /api/transaction`

```json
{
  "statements": [
    { "sql": "insert into users(name) values (?)", "params": ["Ada"] },
    { "sql": "insert into logs(message) values (?)", "params": ["created Ada"] }
  ]
}
```

## 默认行为

1. 对未知数据库，先查询结构：

```sql
select name, type, sql
from sqlite_schema
where name not like 'sqlite_%'
order by type, name;
```

2. 生成 SQL 时默认使用 SQLite 语法。
3. 优先使用参数绑定，不要拼接用户输入。
4. 写操作前向用户说明影响范围。
5. 除非用户明确要求，不执行 `drop`、`delete without where`、全表更新、迁移破坏性操作。
6. 遇到 MySQL/PostgreSQL 写法时，只使用 SQLite 支持或服务兼容层支持的部分。
7. 如果接口返回错误，先解释错误含义，再给出最小修正 SQL。

## 安全边界

不要尝试访问站点数据库、文件系统、其他数据库文件或扩展加载能力。服务会拒绝 `ATTACH`、`DETACH`、`VACUUM INTO`、`PRAGMA writable_schema`、`load_extension()` 等语句。