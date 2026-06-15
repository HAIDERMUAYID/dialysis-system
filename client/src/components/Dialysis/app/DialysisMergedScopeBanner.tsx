import React from 'react';
import { BankOutlined } from '@ant-design/icons';
import { ALL_MY_HOSPITALS, useDialysisContext } from './dialysisContext';
import './dialysis-merged-scope-banner.css';

interface Props {
  className?: string;
}

/** يظهر عند «جميع المستشفيات» — الإنشاء يتطلب مستشفى واحداً */
const DialysisMergedScopeBanner: React.FC<Props> = ({ className }) => {
  const { hospitalId } = useDialysisContext();
  if (hospitalId !== ALL_MY_HOSPITALS) return null;

  return (
    <div
      className={`d-merged-scope-banner${className ? ` ${className}` : ''}`}
      role="status"
      aria-live="polite"
    >
      <BankOutlined className="d-merged-scope-banner__icon" aria-hidden />
      <span>
        للإضافة أو التعديل، اختر <strong>مستشفى واحداً</strong> من قائمة «نطاق العمل» ☰ في الأعلى.
      </span>
    </div>
  );
};

export default DialysisMergedScopeBanner;
