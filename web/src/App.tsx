import { Spin, message } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { api } from './api.js';
import { useI18n } from './i18n/context.js';
import { AdminDashboard } from './pages/AdminDashboard.js';
import { LoginPage } from './pages/LoginPage.js';
import type { AdminUser, NoticeApi } from './types.js';

export function App() {
  const { t } = useI18n();
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [messageApi, contextHolder] = message.useMessage();

  const notice = useMemo<NoticeApi>(() => ({
    success: (content) => {
      messageApi.destroy();
      messageApi.success(content);
    },
    error: (content) => {
      messageApi.destroy();
      messageApi.error(content);
    },
    info: (content) => {
      messageApi.destroy();
      messageApi.info(content);
    },
    clear: () => messageApi.destroy()
  }), [messageApi]);

  useEffect(() => {
    api
      .me()
      .then((result) => setAdmin(result.admin))
      .catch(() => setAdmin(null))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      {contextHolder}
      {loading ? (
        <main className="loading-screen"><Spin size="large" tip={t('common.loadingAdmin')} /></main>
      ) : admin ? (
        <AdminDashboard admin={admin} setAdmin={setAdmin} notice={notice} />
      ) : (
        <LoginPage onLogin={setAdmin} notice={notice} />
      )}
    </>
  );
}
