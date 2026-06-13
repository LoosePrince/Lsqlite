# Lsqlite Client Skill

## 目标

当用户要求你使用 Lsqlite 数据库服务读写数据时，使用本 Skill。Lsqlite 是一个通过 HTTP API 暴露 SQLite 能力的数据库服务，每个数据库通过独立 key 访问。

本 Skill 面向“使用数据库服务的 AI”，不是面向 Lsqlite 项目开发者。

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
    { "sql": "insert into users(name) values (?)", "params": ["Ada"], "mode": "write" },
    { "sql": "insert into logs(message) values (?)", "params": ["created Ada"], "mode": "write" }
  ]
}
```

## 推荐操作流程

1. 对未知数据库，先查询结构：

```sql
select name, type, sql
from sqlite_schema
where name not like 'sqlite_%'
order by type, name;
```

2. 需要字段详情时查询：

```sql
pragma table_info(table_name);
```

3. 读取数据时默认分页：

```sql
select *
from table_name
order by id desc
limit ? offset ?;
```

4. 写入、更新、删除必须使用参数绑定。
5. 写操作前向用户说明影响范围。
6. 除非用户明确要求，不执行 `drop`、无条件 `delete`、全表更新、破坏性迁移。
7. 遇到 MySQL/PostgreSQL 写法时，只使用 SQLite 支持或服务兼容层支持的部分。
8. 如果接口返回错误，先解释错误含义，再给出最小修正 SQL。

## 响应处理

读取响应中的数据位置：

```text
response.results[0].rows
```

写入响应中的影响行数位置：

```text
response.results[0].changes
```

事务响应会返回多条执行结果，按提交顺序对应每条语句。

## 安全边界

不要尝试访问站点数据库、文件系统、其他数据库文件或扩展加载能力。服务会拒绝 `ATTACH`、`DETACH`、`VACUUM INTO`、`PRAGMA writable_schema`、`load_extension()` 等语句。

如果数据库被管理员禁用或软删除，外部 key 会返回不可访问错误。