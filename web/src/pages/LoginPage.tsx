import { Button, Card, Form, Input, Typography } from 'antd';
import { motion } from 'framer-motion';
import { useState } from 'react';
import { api } from '../api.js';
import { PreferencesControls } from '../components/PreferencesControls.js';
import { useI18n } from '../i18n/context.js';
import type { AdminUser, NoticeApi } from '../types.js';

export function LoginPage({ onLogin, notice }: { onLogin: (admin: AdminUser) => void; notice: NoticeApi }) {
  const { t } = useI18n();
  const [submitting, setSubmitting] = useState(false);

  async function submit(values: { username: string; password: string }) {
    setSubmitting(true);
    try {
      const result = await api.login(values.username, values.password);
      notice.success(t('login.success'));
      onLogin(result.admin);
    } catch (error) {
      notice.error(error instanceof Error ? error.message : t('login.failed'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-shell">
      <motion.div initial={{ opacity: 0, y: 18, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.28 }}>
        <Card className="login-card-pro">
          <div className="login-preferences">
            <PreferencesControls />
          </div>
          <Typography.Text className="eyebrow">{t('topbar.eyebrow')}</Typography.Text>
          <Typography.Title level={1}>{t('login.title')}</Typography.Title>
          <Typography.Paragraph type="secondary">{t('login.subtitle')}</Typography.Paragraph>
          <Form layout="vertical" initialValues={{ username: 'admin' }} onFinish={submit} requiredMark={false}>
            <Form.Item label={t('login.username')} name="username" rules={[{ required: true, message: t('login.usernameRequired') }]}>
              <Input autoComplete="username" size="large" />
            </Form.Item>
            <Form.Item label={t('login.password')} name="password" rules={[{ required: true, message: t('login.passwordRequired') }]}>
              <Input.Password autoComplete="current-password" size="large" />
            </Form.Item>
            <Button type="primary" htmlType="submit" size="large" block loading={submitting}>{t('login.submit')}</Button>
          </Form>
        </Card>
      </motion.div>
    </main>
  );
}
