import React from 'react';
import { Alert, Space } from 'antd';
import {
  CameraOutlined,
  MedicineBoxOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { useQuery } from 'react-query';
import axios from 'axios';
import { ALL_MY_HOSPITALS, useDialysisContext } from './dialysisContext';
import { useDialysisFaceStats } from './hooks';
import { usePermission } from '../../../hooks/usePermission';
import { DIALYSIS_FACE_ENABLED } from '../face/dialysisFaceConfig';
import './dialysis-operational-alerts.css';

interface PharmacyOverviewKpis {
  expiring_batches_within_30_days?: number;
}

const DialysisOperationalAlerts: React.FC = () => {
  const { hospitalId } = useDialysisContext();
  const canView = usePermission('dialysis:view');
  const canPharmacy = usePermission('dialysis:pharmacy:view');
  const singleHospital = typeof hospitalId === 'number';

  const { withoutFace, needsReenroll } = useDialysisFaceStats(hospitalId);
  const showFace = DIALYSIS_FACE_ENABLED && canView && singleHospital;

  const pharmacyQuery = useQuery(
    ['dialysis', 'pharmacy-alert-kpis', hospitalId],
    async () => {
      const { data } = await axios.get<{ kpis: PharmacyOverviewKpis | null }>(
        '/api/dialysis/pharmacy/inventory/overview',
        { params: { hospital_id: hospitalId } }
      );
      return data.kpis;
    },
    {
      enabled: canPharmacy && singleHospital,
      staleTime: 60_000,
      refetchInterval: 120_000,
    }
  );

  if (hospitalId == null || hospitalId === ALL_MY_HOSPITALS) {
    return null;
  }

  const expiring = pharmacyQuery.data?.expiring_batches_within_30_days ?? 0;
  const alerts: React.ReactNode[] = [];

  if (showFace && withoutFace > 0) {
    alerts.push(
      <Alert
        key="face-missing"
        type="warning"
        showIcon
        icon={<CameraOutlined />}
        message={`${withoutFace} مريض بدون بصمة وجه`}
        description={<Link to="/dialysis/patients">عرض قائمة المرضى وتسجيل البصمة</Link>}
      />
    );
  }

  if (showFace && needsReenroll > 0) {
    alerts.push(
      <Alert
        key="face-reenroll"
        type="info"
        showIcon
        icon={<SyncOutlined />}
        message={`${needsReenroll} مريض يحتاج تحديث بصمة`}
        description={<Link to="/dialysis/patients">عرض قائمة المرضى</Link>}
      />
    );
  }

  if (canPharmacy && expiring > 0) {
    alerts.push(
      <Alert
        key="stock-expiring"
        type="error"
        showIcon
        icon={<MedicineBoxOutlined />}
        message={`${expiring} دفعة تنتهي خلال 30 يوماً`}
        description={<Link to="/dialysis/pharmacy-stock">مراجعة مخزن الصيدلية</Link>}
      />
    );
  }

  if (alerts.length === 0) return null;

  return (
    <section className="d-op-alerts" aria-label="تنبيهات تشغيلية">
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        {alerts}
      </Space>
    </section>
  );
};

export default DialysisOperationalAlerts;
