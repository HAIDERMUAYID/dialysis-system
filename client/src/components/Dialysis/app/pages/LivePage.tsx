import React, { useEffect, useState, useCallback } from 'react';
import { Button, Tag, Space, Empty, message, Typography } from 'antd';
import {
  ReloadOutlined,
  StopOutlined,
  FileSearchOutlined,
  ClockCircleOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';
import { ALL_MY_HOSPITALS, useDialysisContext, useEffectiveDialysisHospitalId } from '../dialysisContext';
import { usePermission } from '../../../../hooks/usePermission';
import DialysisSessionClinicalDrawer from '../../DialysisSessionClinicalDrawer';

const { Text, Title } = Typography;

interface ActiveRow {
  id: number;
  hospitalId?: number;
  hospital?: { id: number; name: string; code?: string | null };
  startedAt?: string | null;
  dialysisPatient?: { fullName: string };
  location?: { hallName: string; bedCode: string } | null;
  preSystolic?: number | null;
  preDiastolic?: number | null;
  weightPreKg?: string | null;
}

const LivePage: React.FC = () => {
  const { hospitalId } = useDialysisContext();
  const effectiveHospitalId = useEffectiveDialysisHospitalId();
  const mergedScope = hospitalId === ALL_MY_HOSPITALS;
  const canEdit = usePermission('dialysis:session:edit');
  const [rows, setRows] = useState<ActiveRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);
  const [openHospitalId, setOpenHospitalId] = useState<number | null>(null);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    if (hospitalId == null) return;
    setLoading(true);
    try {
      const { data } = await axios.get<ActiveRow[]>('/api/dialysis/sessions/active', {
        params: { hospital_id: hospitalId },
      });
      setRows(data);
    } catch {
      /* keep silent — يحدث كل 15 ثانية */
    } finally {
      setLoading(false);
    }
  }, [hospitalId]);

  useEffect(() => {
    load();
    const t = window.setInterval(load, 15_000);
    return () => window.clearInterval(t);
  }, [load]);

  const endSession = async (id: number, rowHospitalId?: number) => {
    try {
      const hid =
        rowHospitalId ?? (typeof hospitalId === 'number' ? hospitalId : effectiveHospitalId);
      await axios.patch(
        `/api/dialysis/sessions/${id}`,
        { status: 'COMPLETED', ended_at: new Date().toISOString() },
        { params: hid ? { hospital_id: hid } : {} }
      );
      message.success('تم إنهاء الجلسة');
      load();
    } catch {
      message.error('فشل الإنهاء');
    }
  };

  return (
    <>
      <div className="d-page-header">
        <h2>القاعة الآن</h2>
        <Text className="sub">جلسات قيد التشغيل. يتم تحديث البيانات كل 15 ثانية.</Text>
      </div>

      <div className="d-toolbar">
        <Tag color="red" style={{ fontSize: 13, padding: '4px 10px' }}>
          <ThunderboltOutlined /> {rows.length} جلسة نشطة
        </Tag>
        <span className="grow" />
        <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>
          تحديث
        </Button>
      </div>

      {rows.length === 0 ? (
        <div className="d-card">
          <Empty description="لا توجد جلسات نشطة" />
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 12,
          }}
        >
          {rows.map((s) => (
            <div key={s.id} className="d-card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <Title level={5} style={{ margin: 0 }}>
                  {s.dialysisPatient?.fullName || `#${s.id}`}
                </Title>
                <Space size={4} wrap>
                  {mergedScope && s.hospital?.name ? (
                    <Tag color="geekblue">{s.hospital.name}</Tag>
                  ) : null}
                  <Tag color="red">نشطة</Tag>
                </Space>
              </div>
              <Text type="secondary">
                {s.location ? `${s.location.hallName} — سرير ${s.location.bedCode}` : 'بدون موقع محدد'}
              </Text>
              <Space size="small" wrap style={{ marginTop: 4 }}>
                <Tag color="blue">
                  <ClockCircleOutlined /> {s.startedAt ? dayjs(s.startedAt).format('HH:mm') : '—'}
                </Tag>
                {s.preSystolic && s.preDiastolic && (
                  <Tag color="purple">ضغط: {s.preSystolic}/{s.preDiastolic}</Tag>
                )}
                {s.weightPreKg && <Tag color="cyan">وزن: {s.weightPreKg}كغ</Tag>}
              </Space>
              <Space direction="vertical" size="small" style={{ width: '100%', marginTop: 8 }}>
                <Button
                  block
                  icon={<FileSearchOutlined />}
                  onClick={() => {
                    setOpenId(s.id);
                    setOpenHospitalId(s.hospitalId ?? null);
                    setOpen(true);
                  }}
                >
                  سجل كامل
                </Button>
                {canEdit && (
                  <Button
                    type="primary"
                    danger
                    block
                    icon={<StopOutlined />}
                    onClick={() => endSession(s.id, s.hospitalId)}
                  >
                    إنهاء
                  </Button>
                )}
              </Space>
            </div>
          ))}
        </div>
      )}

      <DialysisSessionClinicalDrawer
        open={open}
        sessionId={openId}
        hospitalId={
          openHospitalId ??
          (typeof hospitalId === 'number' ? hospitalId : effectiveHospitalId)
        }
        canEdit={canEdit}
        onClose={() => {
          setOpen(false);
          setOpenId(null);
          setOpenHospitalId(null);
        }}
        onSaved={() => load()}
      />
    </>
  );
};

export default LivePage;
