import { Button, Space, Typography } from 'antd';
import type { AdminUser } from '../types.js';
import type { ManagedDatabase, TableInfo } from '../api.js';
import { StatusTag } from '../components/StatusTag.js';

export function AdminTopbar({
  admin,
  database,
  table,
  onRefresh,
  onLogout,
  onOpenMobileExplorer
}: {
  admin: AdminUser;
  database: ManagedDatabase | null;
  table: TableInfo | null;
  onRefresh: () => void;
  onLogout: () => void;
  onOpenMobileExplorer: () => void;
}) {
  return (
    <header className="admin-topbar">
      <Button className="mobile-only" onClick={onOpenMobileExplorer}>资源</Button>
      <div className="brand-block">
        <Typography.Text className="eyebrow">Lsqlite Admin</Typography.Text>
        <Typography.Title level={3}>专业数据库管理台</Typography.Title>
      </div>
      <div className="context-block">
        {database ? (
          <>
            <span className="context-name">{database.name}</span>
            <StatusTag status={database.status} />
            {table ? <span className="context-table">表：{table.name}</span> : null}
          </>
        ) : <span className="context-table">未选择数据库</span>}
      </div>
      <Space className="topbar-actions">
        <span className="admin-name">{admin.username}</span>
        <Button onClick={onRefresh}>刷新</Button>
        <Button danger onClick={onLogout}>退出</Button>
      </Space>
    </header>
  );
}