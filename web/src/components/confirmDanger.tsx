import { Modal } from 'antd';
import type { NoticeApi } from '../types.js';
import { beginOperation, notifyError } from '../utils/feedback.js';

export function confirmDanger(input: {
  title: string;
  content: string;
  okText?: string;
  cancelText?: string;
  notice?: NoticeApi;
  action?: string;
  onOk: () => Promise<void> | void;
}) {
  Modal.confirm({
    title: input.title,
    content: input.content,
    okText: input.okText || input.title,
    okButtonProps: { danger: true },
    cancelText: input.cancelText || 'Cancel',
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
