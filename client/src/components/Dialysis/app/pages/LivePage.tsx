import React, { useEffect, useState, useCallback } from 'react';
import { Button, Tag, Empty, message, Typography, Spin } from 'antd';
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
import { useDialysisMobile } from '../useDialysisMobile';
import { usePermission } from '../../../../hooks/usePermission';
import DialysisPullRefresh from '../DialysisPullRefresh';
import DialysisSessionClinicalDrawer from '../../DialysisSessionClinicalDrawer';
import './live-page.css';

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
  const isMobile = useDialysisMobile();
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
      /* يحدث كل 15 ثانية */
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

  const renderCard = (s: ActiveRow) => (
    <article key={s.id} className={isMobile ? 'd-live-card' : 'd-card'} style={isMobile ? undefined : { display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div className={isMobile ? 'd-live-card__head' : undefined} style={isMobile ? undefined : { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <Title level={5} className={isMobile ? 'd-live-card__name' : undefined} style={isMobile ? undefined : { margin: 0 }}>
          {s.dialysisPatient?.fullName || `#${s.id}`}
        </Title>
        <div className={isMobile ? 'd-live-card__tags' : undefined}>
          {mergedScope && s.hospital?.name ? <Tag color="geekblue">{s.hospital.name}</Tag> : null}
          <Tag color="red">نشطة</Tag>
        </div>
      </div>
      <Text type="secondary" className={isMobile ? 'd-live-card__location' : undefined}>
        {s.location ? `${s.location.hallName} — سرير ${s.location.bedCode}` : 'بدون موقع محدد'}
      </Text>
      <div className={isMobile ? 'd-live-card__vitals' : undefined}>
        <Tag color="blue">
          <ClockCircleOutlined /> {s.startedAt ? dayjs(s.startedAt).format('HH:mm') : '—'}
        </Tag>
        {s.preSystolic && s.preDiastolic && (
          <Tag color="purple">
            ضغط: {s.preSystolic}/{s.preDiastolic}
          </Tag>
        )}
        {s.weightPreKg && <Tag color="cyan">وزن: {s.weightPreKg}كغ</Tag>}
      </div>
      <div className={isMobile ? 'd-live-card__actions' : undefined} style={isMobile ? undefined : { width: '100%', marginTop: 8 }}>
        <Button
          block
          icon={<FileSearchOutlined />}
          size={isMobile ? 'large' : 'middle'}
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
            size={isMobile ? 'large' : 'middle'}
            icon={<StopOutlined />}
            onClick={() => endSession(s.id, s.hospitalId)}
          >
            إنهاء
          </Button>
        )}
      </div>
    </article>
  );

  const body = (
    <div className={isMobile ? 'd-live-page' : undefined}>
      <div className="d-page-header">
        <h2>القاعة الآن</h2>
        <Text className="sub">جلسات قيد التشغيل. يتم تحديث البيانات كل 15 ثانية.</Text>
      </div>

      <div className="d-toolbar">
        <Tag
          color="red"
          className={isMobile ? 'd-live-page__badge' : undefined}
          style={isMobile ? undefined : { fontSize: 13, padding: '4px 10px' }}
        >
          <ThunderboltOutlined /> {rows.length} جلسة نشطة
        </Tag>
        {!isMobile && <span className="grow" />}
        <Button icon={<ReloadOutlined />} onClick={load} loading={loading} size={isMobile ? 'large' : 'middle'}>
          تحديث
        </Button>
      </div>

      <Spin spinning={loading && rows.length > 0}>
        {rows.length === 0 && !loading ? (
          <div className="d-card">
            <Empty description="لا توجد جلسات نشطة" />
          </div>
        ) : (
          <div
            className={isMobile ? 'd-live-cards' : undefined}
            style={
              isMobile
                ? undefined
                : {
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                    gap: 12,
                  }
            }
          >
            {rows.map(renderCard)}
          </div>
        )}
      </Spin>

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
    </div>
  );

  if (isMobile) {
    return (
      <DialysisPullRefresh onRefresh={load} disabled={hospitalId == null}>
        {body}
      </DialysisPullRefresh>
    );
  }

  return body;
};

export default LivePage;
