import { Modal } from 'antd';
import type { NoticeApi } from '../types.js';
import { beginOperation, notifyError } from '../utils/feedback.js';

export function confirmDanger(input: {
  title: string;
  content: string;
  okText?: string;
  notice?: NoticeApi;
  action?: string;
  onOk: () => Promise<void> | void;
}) {
  Modal.confirm({
    title: input.title,
    content: input.content,
    okText: input.okText || '确认',
    okButtonProps: { danger: true },
    cancelText: '取消',
    centered: true,
    onOk: async () => {
      if (input.notice) beginOperation(input.notice);
      try {
        await input.onOk();
      } catch (error) {
        if (input.notice) notifyError(input.notice, input.action || input.okText || input.title, error);
        throw error;
      }
    }
  });
}