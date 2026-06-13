import { Modal } from 'antd';

export function confirmDanger(input: { title: string; content: string; okText?: string; onOk: () => Promise<void> | void }) {
  Modal.confirm({
    title: input.title,
    content: input.content,
    okText: input.okText || '确认',
    okButtonProps: { danger: true },
    cancelText: '取消',
    centered: true,
    onOk: input.onOk
  });
}