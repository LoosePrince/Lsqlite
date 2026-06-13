import { Button, Space, Typography } from 'antd';
import type { ManagedDatabase, TableInfo } from '../api.js';
import { PreferencesControls } from '../components/PreferencesControls.js';
import { StatusTag } from '../components/StatusTag.js';
import { useI18n } from '../i18n/context.js';
import type { AdminUser } from '../types.js';

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
  const { t } = useI18n();

  return (
    <header className="admin-topbar">
      <Button className="mobile-only" onClick={onOpenMobileExplorer}>{t('common.resources')}</Button>
      <div className="brand-block">
        <Typography.Text className="eyebrow">{t('topbar.eyebrow')}</Typography.Text>
        <Typography.Title level={3}>{t('topbar.title')}</Typography.Title>
      </div>
      <div className="context-block">
        {database ? (
          <>
            <span className="context-name">{database.name}</span>
            <StatusTag status={database.status} />
            {table ? <span className="context-table">{t('topbar.tablePrefix', { name: table.name })}</span> : null}
          </>
        ) : <span className="context-table">{t('topbar.noDatabase')}</span>}
      </div>
      <Space className="topbar-actions">
        <PreferencesControls />
        <span className="admin-name">{admin.username}</span>
        <Button onClick={onRefresh}>{t('common.refresh')}</Button>
        <Button danger onClick={onLogout}>{t('common.logout')}</Button>
      </Space>
    </header>
  );
}
