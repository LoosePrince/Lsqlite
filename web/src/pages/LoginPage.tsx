import { Button, Card, Form, Input, Typography } from 'antd';
import { motion } from 'framer-motion';
import { useState } from 'react';
import { api } from '../api.js';
import type { AdminUser, NoticeApi } from '../types.js';

export function LoginPage({ onLogin, notice }: { onLogin: (admin: AdminUser) => void; notice: NoticeApi }) {
  const [submitting, setSubmitting] = useState(false);

  async function submit(values: { username: string; password: string }) {
    setSubmitting(true);
    try {
      const result = await api.login(values.username, values.password);
      notice.success('已登录后台');
      onLogin(result.admin);
    } catch (error) {
      notice.error(error instanceof Error ? error.message : '登录失败');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-shell">
      <motion.div initial={{ opacity: 0, y: 18, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.28 }}>
        <Card className="login-card-pro">
          <Typography.Text className="eyebrow">Lsqlite Admin</Typography.Text>
          <Typography.Title level={1}>数据库服务后台</Typography.Title>
          <Typography.Paragraph type="secondary">以 phpMyAdmin 风格管理 SQLite 数据库、表结构、行数据和 SQL。</Typography.Paragraph>
          <Form layout="vertical" initialValues={{ username: 'admin' }} onFinish={submit} requiredMark={false}>
            <Form.Item label="管理员" name="username" rules={[{ required: true, message: '请输入管理员账号' }]}>
              <Input autoComplete="username" size="large" />
            </Form.Item>
            <Form.Item label="管理员密码" name="password" rules={[{ required: true, message: '请输入管理员密码' }]}>
              <Input.Password autoComplete="current-password" size="large" />
            </Form.Item>
            <Button type="primary" htmlType="submit" size="large" block loading={submitting}>登录</Button>
          </Form>
        </Card>
      </motion.div>
    </main>
  );
}