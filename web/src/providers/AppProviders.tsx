import { App as AntdApp, ConfigProvider, theme } from 'antd';
import enUS from 'antd/locale/en_US';
import zhCN from 'antd/locale/zh_CN';
import type { ReactNode } from 'react';
import { I18nProvider, useI18n } from '../i18n/context.js';
import { ThemeProvider, useTheme } from '../theme/context.js';

function AppThemeConfig({ children }: { children: ReactNode }) {
  const { locale } = useI18n();
  const { isDark } = useTheme();

  return (
    <ConfigProvider
      locale={locale === 'zh' ? zhCN : enUS}
      theme={{
        algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
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
          Table: {
            headerBg: isDark ? '#1a2332' : '#eef5ff',
            rowHoverBg: isDark ? '#1f2a3d' : '#f6faff'
          },
          Tabs: { itemSelectedColor: '#1f5fbf', inkBarColor: '#1f5fbf' }
        }
      }}
    >
      <AntdApp>{children}</AntdApp>
    </ConfigProvider>
  );
}

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <I18nProvider>
      <ThemeProvider>
        <AppThemeConfig>{children}</AppThemeConfig>
      </ThemeProvider>
    </I18nProvider>
  );
}
