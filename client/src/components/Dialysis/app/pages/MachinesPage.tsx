import React from 'react';
import { ALL_MY_HOSPITALS, useDialysisContext } from '../dialysisContext';
import { usePermission } from '../../../../hooks/usePermission';
import { DialysisPickHospitalScope } from '../DialysisPickHospitalScope';
import DialysisMachinesPanel from '../../DialysisMachinesPanel';
import DialysisPageHeader from '../DialysisPageHeader';

const MachinesPage: React.FC = () => {
  const { hospitalId } = useDialysisContext();
  const canManage = usePermission('dialysis:location:manage');
  if (hospitalId == null) return null;
  return (
    <>
      <DialysisPageHeader
        title="أجهزة الغسل"
        subtitle="سجل أجهزة الغسل وربطها بالأسرة عند الحاجة؛ يُستخدم ذلك عند تسجيل الجلسات ومتابعة ساعات التشغيل."
      />
      {hospitalId === ALL_MY_HOSPITALS ? (
        <div className="d-card" style={{ padding: '16px 14px' }}>
          <DialysisPickHospitalScope
            title="اختر المستشفى أولاً"
            description="عرض «كل المستشفيات معاً» لا يصلح لإدارة الأجهزة لأن كل مستشفى له سجل أجهزته. اختر أدناه المستشفى الذي تريد مراجعته أو تجهيزه."
          />
        </div>
      ) : (
        <div className="d-card">
          <DialysisMachinesPanel hospitalId={hospitalId} canManage={canManage} />
        </div>
      )}
    </>
  );
};

export default MachinesPage;
