import { Empty, Typography } from 'antd';
import { useI18n } from '../i18n/context.js';
import { MotionPanel } from './MotionPanel.js';

export function EmptyWorkbench({ title, description }: { title?: string; description?: string }) {
  const { t } = useI18n();

  return (
    <MotionPanel className="empty-workbench">
      <Empty description={false} />
      <Typography.Title level={3}>{title ?? t('workbench.title')}</Typography.Title>
      <Typography.Paragraph type="secondary">{description ?? t('workbench.description')}</Typography.Paragraph>
    </MotionPanel>
  );
}
