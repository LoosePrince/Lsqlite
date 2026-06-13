# Lsqlite

Lsqlite 是一个 Node.js + SQLite 数据库服务。管理员通过后台创建和管理多个数据库；外部调用方通过数据库 key 使用 HTTP API 执行 SQLite SQL。

## 功能

- 环境变量指定站点数据库、管理员账号、管理员密码、数据目录。
- React 管理后台：创建数据库、编辑名称备注、启用/禁用、软删除、恢复、永久删除、轮换 key。
- 可视化数据库管理：表结构查看、建表、删表、添加字段、创建/删除索引、表数据分页浏览和 CRUD。
- 每个外部数据库都是独立 SQLite 文件。
- 外部 API 使用 `Authorization: Bearer <database_key>` 访问对应数据库。
- SQL 保持 SQLite 语义，并提供有限 MySQL/PostgreSQL 写法兼容。
- key 使用摘要存储，不保存明文 key。
- 提供面向调用方 AI 的可分发 Skill：`skills/lsqlite-client`。

## 快速启动

```bash
npm install
copy .env.example .env
npm run dev
```

默认服务：

- 后端 API：`http://localhost:3000`
- 前端后台：`http://localhost:5173`

## 环境变量

| 变量 | 说明 |
| --- | --- |
| `SITE_DB_PATH` | 站点数据库路径，保存数据库清单、key 摘要和审计记录 |
| `DATA_DIR` | 外部数据库文件目录 |
| `ADMIN_USER` | 管理员账号 |
| `ADMIN_PASSWORD` | 管理员密码，至少 8 位 |
| `SESSION_SECRET` | 后台 session 密钥，至少 16 位 |
| `PORT` | Node.js 服务端口，默认 `3000` |
| `CORS_ORIGIN` | 后台开发地址，默认允许当前来源 |

## 管理能力

后台按数据库维度管理独立 SQLite 文件：

1. 创建数据库并生成或指定 key。
2. 修改名称、备注和状态。
3. 软删除、恢复、永久删除。
4. 查看文件大小、最后访问时间、表数量和行数概览。
5. 管理表结构和索引。
6. 浏览和编辑表数据。
7. 使用 SQL 控制台做高级维护。
8. 查看审计日志。

## 生产构建

```bash
npm run build
npm run start
```

构建后 Node.js 会同时提供 API 和 `dist/web` 中的后台页面。

## 外部调用示例

```bash
curl -X POST http://localhost:3000/api/query \
  -H "Authorization: Bearer <database_key>" \
  -H "Content-Type: application/json" \
  -d "{\"sql\":\"select sqlite_version() as version\",\"mode\":\"read\"}"
```

事务写入：

```bash
curl -X POST http://localhost:3000/api/transaction \
  -H "Authorization: Bearer <database_key>" \
  -H "Content-Type: application/json" \
  -d "{\"statements\":[{\"sql\":\"insert into logs(message) values (?)\",\"params\":[\"hello\"],\"mode\":\"write\"}]}"
```

更多接口见 `docs/api.md`，后台使用说明见 `docs/admin.md`。