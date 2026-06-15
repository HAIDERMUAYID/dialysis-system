import React from 'react';
import { ALL_MY_HOSPITALS, useDialysisContext } from '../dialysisContext';
import { usePermission } from '../../../../hooks/usePermission';
import { DialysisPickHospitalScope } from '../DialysisPickHospitalScope';
import DialysisShiftTemplatesPanel from '../../DialysisShiftTemplatesPanel';
import DialysisPageHeader from '../DialysisPageHeader';

const ShiftsPage: React.FC = () => {
  const { hospitalId } = useDialysisContext();
  const canManage = usePermission('dialysis:location:manage');
  if (hospitalId == null) return null;
  return (
    <>
      <DialysisPageHeader
        title="شفتات الغسل"
        subtitle="تعريف فترات العمل (مثل صباحي ومسائي) وربط كل منها بأيام الأسبوع؛ تُستخدم لاحقاً عند جدولة المرضى وتسجيل الجلسات."
      />
      {hospitalId === ALL_MY_HOSPITALS ? (
        <div className="d-card" style={{ padding: '16px 14px' }}>
          <DialysisPickHospitalScope
            title="اختر المستشفى أولاً"
            description="عرض «كل المستشفيات معاً» لا يصلح لتعديل الشفتات لأن كل مستشفى له جدول شفتاته. اختر أدناه المستشفى الذي تريد تجهيزه أو مراجعته."
          />
        </div>
      ) : (
        <div className="d-card">
          <DialysisShiftTemplatesPanel hospitalId={hospitalId} canManage={canManage} />
        </div>
      )}
    </>
  );
};

export default ShiftsPage;
