import React from 'react';
import { Alert } from 'antd';
import { CloudSyncOutlined, WifiOutlined } from '@ant-design/icons';
import { useDialysisOffline } from './useDialysisOffline';
import './dialysis-offline.css';

const DialysisOfflineBanner: React.FC = () => {
  const { online, servingCache, pendingEnrollCount, flushing } = useDialysisOffline();

  if (online && !servingCache && pendingEnrollCount === 0 && !flushing) {
    return null;
  }

  let type: 'warning' | 'info' | 'success' = 'warning';
  let message = 'وضع بدون اتصال — تعرض بيانات محفوظة للقراءة فقط';
  let description: React.ReactNode =
    'المرضى والجلسات من آخر مزامنة. لا يمكن الحفظ أو التعديل حتى يعود الاتصال.';

  if (online && servingCache) {
    type = 'info';
    message = 'اتصال ضعيف — بيانات من الذاكرة المحلية';
    description = 'جاري محاولة التحديث من الخادم عند استقرار الشبكة.';
  }

  if (online && flushing) {
    type = 'info';
    message = 'جاري مزامنة بصمات الوجه المحفوظة…';
    description = null;
  }

  if (online && pendingEnrollCount > 0 && !flushing) {
    type = 'warning';
    message = `${pendingEnrollCount} بصمة وجه بانتظار الرفع`;
    description = 'ستُرفع تلقائياً عند نجاح الاتصال بالخادم.';
  }

  return (
    <Alert
      className="d-offline-banner"
      type={type}
      showIcon
      icon={online ? <CloudSyncOutlined /> : <WifiOutlined />}
      message={message}
      description={description}
      banner
    />
  );
};

export default DialysisOfflineBanner;
