import React from 'react';
import { Typography } from 'antd';
import { ALL_MY_HOSPITALS, useDialysisContext } from '../dialysisContext';
import { usePermission } from '../../../../hooks/usePermission';
import { DialysisPickHospitalScope } from '../DialysisPickHospitalScope';
import DialysisInventoryPanel from '../../DialysisInventoryPanel';

const { Text } = Typography;

const InventoryPage: React.FC = () => {
  const { hospitalId } = useDialysisContext();
  const canManage = usePermission('dialysis:location:manage');
  if (hospitalId == null) return null;
  return (
    <>
      <div className="d-page-header">
        <h2>المستودع والمواد</h2>
        <Text className="sub">
          مستودع المستلزمات العامة (فلاتر، أكياس، مستهلكات…) — منفصل عن مخزن أدوية صيدلية الغسل.
        </Text>
      </div>
      {hospitalId === ALL_MY_HOSPITALS ? (
        <div className="d-card" style={{ padding: '16px 14px' }}>
          <DialysisPickHospitalScope
            title="اختر المستشفى أولاً"
            description="عرض «كل المستشفيات معاً» لا يصلح لإدارة المستودع لأن كل مستشفى له أصنافه ودفعاته. اختر أدناه المستشفى المطلوب."
          />
        </div>
      ) : (
        <div className="d-card">
          <DialysisInventoryPanel hospitalId={hospitalId} canManage={canManage} />
        </div>
      )}
    </>
  );
};

export default InventoryPage;
