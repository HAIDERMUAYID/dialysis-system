import { Modal, message } from 'antd';
import axios from 'axios';

export function confirmEndDialysisSession(opts: {
  sessionId: number;
  patientName?: string | null;
  hospitalId?: number | null;
  onDone?: () => void;
}): void {
  const name = opts.patientName?.trim() || `#${opts.sessionId}`;
  Modal.confirm({
    title: 'إنهاء الجلسة؟',
    content: `تأكيد إنهاء جلسة الغسل للمريض: ${name}`,
    okText: 'إنهاء الجلسة',
    okType: 'danger',
    cancelText: 'إلغاء',
    onOk: async () => {
      try {
        await axios.patch(
          `/api/dialysis/sessions/${opts.sessionId}`,
          { status: 'COMPLETED', ended_at: new Date().toISOString() },
          { params: opts.hospitalId ? { hospital_id: opts.hospitalId } : {} }
        );
        message.success('تم إنهاء الجلسة');
        opts.onDone?.();
      } catch {
        message.error('فشل إنهاء الجلسة');
        throw new Error('end session failed');
      }
    },
  });
}
