import React from 'react';
import { ScanOutlined, UserOutlined, SyncOutlined } from '@ant-design/icons';
import { DIALYSIS_FACE_ENABLED } from '../face/dialysisFaceConfig';

interface Props {
  patientsWithoutFace: number;
  patientsNeedsReenroll?: number;
  totalPatients?: number;
  className?: string;
}

const DialysisFaceStatusBanner: React.FC<Props> = ({
  patientsWithoutFace,
  patientsNeedsReenroll = 0,
  totalPatients,
  className,
}) => {
  if (!DIALYSIS_FACE_ENABLED) return null;

  const allOk = patientsWithoutFace === 0 && patientsNeedsReenroll === 0;
  const tone = allOk ? 'ok' : patientsWithoutFace > 0 ? 'warn' : 'info';

  return (
    <div
      className={`d-face-status-banner d-face-status-banner--${tone}${className ? ` ${className}` : ''}`}
      role="status"
      aria-live="polite"
      data-tour="dialysis-face-banner"
    >
      <span className="d-face-status-banner__icon" aria-hidden>
        <ScanOutlined />
      </span>
      <div className="d-face-status-banner__body">
        <div className="d-face-status-banner__title">
          <span>تعرف الوجه — كاميرا أمامية أو خلفية</span>
          {patientsWithoutFace > 0 ? (
            <span className="d-face-status-banner__tag d-face-status-banner__tag--warn">
              {patientsWithoutFace} بدون بصمة
            </span>
          ) : (
            <span className="d-face-status-banner__tag d-face-status-banner__tag--ok">
              لا يوجد بدون بصمة
            </span>
          )}
          {patientsNeedsReenroll > 0 ? (
            <span className="d-face-status-banner__tag d-face-status-banner__tag--info">
              <SyncOutlined aria-hidden /> {patientsNeedsReenroll} يحتاج تحديث
            </span>
          ) : null}
          {totalPatients != null ? (
            <span className="d-face-status-banner__tag d-face-status-banner__tag--muted">
              <UserOutlined aria-hidden /> {totalPatients} مريض
            </span>
          ) : null}
        </div>
        <p className="d-face-status-banner__desc">
          {allOk
            ? 'الموظف يصوّر المريض — مسح سريع عند إنشاء الجلسة (أمامية أو خلفية).'
            : patientsWithoutFace > 0
              ? 'سجّل البصمة عند أول جلسة — يُفتح التسجيل تلقائياً.'
              : 'بعض البصمات قديمة — أعد التسجيل من مسافة مريحة.'}
        </p>
      </div>
    </div>
  );
};

export default DialysisFaceStatusBanner;
