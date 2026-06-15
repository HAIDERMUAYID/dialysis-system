import React from 'react';
import { CameraOutlined, BulbOutlined, AimOutlined } from '@ant-design/icons';
import { FACE_IS_STAFF_MODE, FACE_STAFF_GUIDE_STEPS } from './dialysisFaceConfig';

const ICONS = [CameraOutlined, BulbOutlined, AimOutlined];

const DialysisFaceStaffGuide: React.FC<{ compact?: boolean }> = ({ compact }) => {
  if (!FACE_IS_STAFF_MODE) return null;

  return (
    <div className={`d-face-staff-guide${compact ? ' d-face-staff-guide--compact' : ''}`}>
      <div className="d-face-staff-guide__title">دليل سريع للموظف</div>
      <ol className="d-face-staff-guide__list">
        {FACE_STAFF_GUIDE_STEPS.map((step, i) => {
          const Icon = ICONS[i] ?? CameraOutlined;
          return (
            <li key={step.title} className="d-face-staff-guide__item">
              <span className="d-face-staff-guide__icon" aria-hidden>
                <Icon />
              </span>
              <span>
                <strong>{step.title}</strong>
                {!compact ? <span className="d-face-staff-guide__detail"> — {step.detail}</span> : null}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
};

export default DialysisFaceStaffGuide;
