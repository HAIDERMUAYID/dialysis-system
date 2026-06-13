import React from 'react';
import { Alert, Button, Typography } from 'antd';
import { CameraOutlined } from '@ant-design/icons';

const { Text } = Typography;

export interface FaceMissingPatient {
  id: number;
  fullName: string;
  hasFaceEnrolled?: boolean;
}

interface Props {
  patient: FaceMissingPatient;
  isMobile: boolean;
  onEnroll: () => void;
  /** نص إضافي للموبايل بعد الإرسال */
  footerHint?: string;
}

const DialysisFaceMissingPrompt: React.FC<Props> = ({
  patient,
  isMobile,
  onEnroll,
  footerHint,
}) => {
  if (isMobile) {
    return (
      <div className="d-session-face-missing-card" role="alert">
        <div className="d-session-face-missing-card__head">
          <span className="d-session-face-missing-card__icon" aria-hidden>
            <CameraOutlined />
          </span>
          <div className="d-session-face-missing-card__text">
            <Text strong className="d-session-face-missing-card__title">
              {patient.fullName} — بلا بصمة وجه
            </Text>
            <Text type="secondary" className="d-session-face-missing-card__desc">
              سجّل الوجه الآن لتسريع الجلسات القادمة عبر المسح التلقائي.
            </Text>
          </div>
        </div>
        <Button
          type="primary"
          size="large"
          block
          className="d-session-face-missing-card__btn"
          icon={<CameraOutlined />}
          onClick={onEnroll}
        >
          تسجيل بصمة الوجه الآن
        </Button>
        {footerHint ? (
          <Text type="secondary" className="d-session-face-footer-hint" style={{ marginTop: 8 }}>
            {footerHint}
          </Text>
        ) : null}
      </div>
    );
  }

  return (
    <Alert
      type="warning"
      showIcon
      className="d-session-face-missing-alert"
      style={{ marginBottom: 12 }}
      message="هذا المريض بلا بصمة وجه"
      description="سجّل الوجه الآن لتسريع الجلسات القادمة عبر المسح التلقائي."
      action={
        <Button size="small" type="primary" icon={<CameraOutlined />} onClick={onEnroll}>
          تسجيل الآن
        </Button>
      }
    />
  );
};

export default DialysisFaceMissingPrompt;
