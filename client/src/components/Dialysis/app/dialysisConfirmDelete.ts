import { Modal } from 'antd';
import type { ReactNode } from 'react';

export function confirmDialysisDelete(opts: {
  title: string;
  content: ReactNode;
  onOk: () => Promise<void>;
  okText?: string;
}): void {
  Modal.confirm({
    title: opts.title,
    content: opts.content,
    okText: opts.okText ?? 'حذف',
    okType: 'danger',
    cancelText: 'إلغاء',
    centered: true,
    onOk: opts.onOk,
  });
}
