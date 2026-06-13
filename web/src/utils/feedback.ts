import type { NoticeApi } from '../types.js';

export function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (typeof error === 'string' && error.trim()) return error;
  return '未知错误';
}

export function beginOperation(notice: NoticeApi) {
  notice.clear();
}

export function notifySuccess(notice: NoticeApi, message: string) {
  notice.success(message);
}

export function notifyError(notice: NoticeApi, action: string, error: unknown) {
  notice.error(`${action}失败：${getErrorMessage(error)}`);
}

export async function runOperation<T>(notice: NoticeApi, action: string, operation: () => Promise<T>) {
  beginOperation(notice);
  try {
    return await operation();
  } catch (error) {
    notifyError(notice, action, error);
    throw error;
  }
}