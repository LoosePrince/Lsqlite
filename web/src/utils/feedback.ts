import type { TranslateFn } from '../i18n/types.js';
import type { NoticeApi } from '../types.js';

export function getErrorMessage(error: unknown, t?: TranslateFn) {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (typeof error === 'string' && error.trim()) return error;
  return t ? t('common.unknownError') : 'Unknown error';
}

export function beginOperation(notice: NoticeApi) {
  notice.clear();
}

export function notifySuccess(notice: NoticeApi, message: string) {
  notice.success(message);
}

export function notifyError(notice: NoticeApi, action: string, error: unknown, t?: TranslateFn) {
  const text = t
    ? t('common.actionFailed', { action, error: getErrorMessage(error, t) })
    : `${action} failed: ${getErrorMessage(error)}`;
  notice.error(text);
}

export async function runOperation<T>(notice: NoticeApi, action: string, operation: () => Promise<T>, t?: TranslateFn) {
  beginOperation(notice);
  try {
    return await operation();
  } catch (error) {
    notifyError(notice, action, error, t);
    throw error;
  }
}
