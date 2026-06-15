import React from 'react';
import { ALL_MY_HOSPITALS, useDialysisContext } from '../dialysisContext';
import { usePermission } from '../../../../hooks/usePermission';
import { DialysisPickHospitalScope } from '../DialysisPickHospitalScope';
import DialysisStructurePanel from '../../DialysisStructurePanel';
import DialysisPageHeader from '../DialysisPageHeader';

const HallsPage: React.FC = () => {
  const { hospitalId } = useDialysisContext();
  const canManage = usePermission('dialysis:location:manage');
  if (hospitalId == null) return null;
  return (
    <>
      <DialysisPageHeader
        title="القاعات والأسرة"
        subtitle="هنا تُعرض قاعات الغسل وأسرة كل قاعة كما ستظهر عند جدولة المرضى وتسجيل الجلسات."
      />
      {hospitalId === ALL_MY_HOSPITALS ? (
        <div className="d-card" style={{ padding: '16px 14px' }}>
          <DialysisPickHospitalScope
            title="اختر المستشفى أولاً"
            description="عرض «كل المستشفيات معاً» لا يصلح لتعديل القاعات لأن كل مستشفى له قاعاته الخاصة. اختر أدناه المستشفى الذي تريد تجهيزه أو مراجعته."
          />
        </div>
      ) : (
        <div className="d-card">
          <DialysisStructurePanel hospitalId={hospitalId} canManage={canManage} />
        </div>
      )}
    </>
  );
};

export default HallsPage;
