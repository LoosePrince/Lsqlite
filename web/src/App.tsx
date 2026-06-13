import { App as AntdApp, ConfigProvider, Spin, message, theme } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { api } from './api.js';
import { AdminDashboard } from './pages/AdminDashboard.js';
import { LoginPage } from './pages/LoginPage.js';
import type { AdminUser, NoticeApi } from './types.js';

export function App() {
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
    <ConfigProvider
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          colorPrimary: '#2f6fda',
          colorSuccess: '#148a5b',
          colorWarning: '#c27803',
          colorError: '#d92d20',
          borderRadius: 10,
          fontFamily: 'Outfit, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
        },
        components: {
          Card: { borderRadiusLG: 16 },
          Button: { controlHeight: 38, borderRadius: 10 },
          Table: { headerBg: '#eef5ff', rowHoverBg: '#f6faff' },
          Tabs: { itemSelectedColor: '#1f5fbf', inkBarColor: '#1f5fbf' }
        }
      }}
    >
      <AntdApp>
        {contextHolder}
        {loading ? (
          <main className="loading-screen"><Spin size="large" tip="加载后台" /></main>
        ) : admin ? (
          <AdminDashboard admin={admin} setAdmin={setAdmin} notice={notice} />
        ) : (
          <LoginPage onLogin={setAdmin} notice={notice} />
        )}
      </AntdApp>
    </ConfigProvider>
  );
}