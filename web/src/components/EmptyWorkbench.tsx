import { Empty, Typography } from 'antd';
import { MotionPanel } from './MotionPanel.js';

export function EmptyWorkbench({ title = '请选择数据库', description = '从左侧数据库树选择一个数据库，或先创建新的数据库。' }: { title?: string; description?: string }) {
  return (
    <MotionPanel className="empty-workbench">
      <Empty description={false} />
      <Typography.Title level={3}>{title}</Typography.Title>
      <Typography.Paragraph type="secondary">{description}</Typography.Paragraph>
    </MotionPanel>
  );
}