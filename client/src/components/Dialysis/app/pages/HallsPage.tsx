import React from 'react';
import { Typography } from 'antd';
import { ALL_MY_HOSPITALS, useDialysisContext } from '../dialysisContext';
import { usePermission } from '../../../../hooks/usePermission';
import { DialysisPickHospitalScope } from '../DialysisPickHospitalScope';
import DialysisStructurePanel from '../../DialysisStructurePanel';

const { Text } = Typography;

const HallsPage: React.FC = () => {
  const { hospitalId } = useDialysisContext();
  const canManage = usePermission('dialysis:location:manage');
  if (hospitalId == null) return null;
  return (
    <>
      <div className="d-page-header">
        <h2>القاعات والأسرة</h2>
        <Text className="sub">
          هنا تُعرض قاعات الغسل وأسرة كل قاعة كما ستظهر عند جدولة المرضى وتسجيل الجلسات.
        </Text>
      </div>
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
