import { Select, Space, Tooltip } from 'antd';
import { useI18n } from '../i18n/context.js';
import { useTheme } from '../theme/context.js';
import type { Locale } from '../i18n/types.js';
import type { ThemeMode } from '../theme/types.js';

export function PreferencesControls({ size = 'small' }: { size?: 'small' | 'middle' | 'large' }) {
  const { locale, setLocale, t } = useI18n();
  const { mode, setMode } = useTheme();

  return (
    <Space size={4} className="preferences-controls">
      <Tooltip title={t('preferences.language')}>
        <Select<Locale>
          size={size}
          value={locale}
          onChange={setLocale}
          popupMatchSelectWidth={false}
          options={[
            { value: 'zh', label: t('preferences.localeZh') },
            { value: 'en', label: t('preferences.localeEn') }
          ]}
        />
      </Tooltip>
      <Tooltip title={t('preferences.theme')}>
        <Select<ThemeMode>
          size={size}
          value={mode}
          onChange={setMode}
          popupMatchSelectWidth={false}
          options={[
            { value: 'light', label: t('preferences.themeLight') },
            { value: 'dark', label: t('preferences.themeDark') },
            { value: 'auto', label: t('preferences.themeAuto') }
          ]}
        />
      </Tooltip>
    </Space>
  );
}
