import React from 'react';
import { Typography } from 'antd';
import { ALL_MY_HOSPITALS, useDialysisContext } from '../dialysisContext';
import { usePermission } from '../../../../hooks/usePermission';
import { DialysisPickHospitalScope } from '../DialysisPickHospitalScope';
import DialysisMachinesPanel from '../../DialysisMachinesPanel';

const { Text } = Typography;

const MachinesPage: React.FC = () => {
  const { hospitalId } = useDialysisContext();
  const canManage = usePermission('dialysis:location:manage');
  if (hospitalId == null) return null;
  return (
    <>
      <div className="d-page-header">
        <h2>أجهزة الغسل</h2>
        <Text className="sub">
          سجل أجهزة الغسل وربطها بالأسرة عند الحاجة؛ يُستخدم ذلك عند تسجيل الجلسات ومتابعة ساعات التشغيل.
        </Text>
      </div>
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
