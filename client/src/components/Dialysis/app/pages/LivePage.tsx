import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Button, Tag, Empty, message, Typography, Spin } from 'antd';
import {
  ReloadOutlined,
  StopOutlined,
  FileSearchOutlined,
  ClockCircleOutlined,
  ThunderboltOutlined,
  DesktopOutlined,
} from '@ant-design/icons';
import { Link } from 'react-router-dom';
import axios from 'axios';
import dayjs from 'dayjs';
import { ALL_MY_HOSPITALS, useDialysisContext, useEffectiveDialysisHospitalId } from '../dialysisContext';
import { useDialysisMobile } from '../useDialysisMobile';
import { usePermission } from '../../../../hooks/usePermission';
import { useDialysisLiveSync, type DialysisLiveTransport } from '../hooks/useDialysisLiveSync';
import DialysisPullRefresh from '../DialysisPullRefresh';
import DialysisSessionClinicalDrawer from '../../DialysisSessionClinicalDrawer';
import DialysisMergedScopeBanner from '../DialysisMergedScopeBanner';
import DialysisPageHeader from '../DialysisPageHeader';
import DialysisMobileFab from '../DialysisMobileFab';
import { confirmEndDialysisSession } from '../dialysisConfirmEndSession';
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
  const { hospitalId, hospitals } = useDialysisContext();
  const effectiveHospitalId = useEffectiveDialysisHospitalId();
  const mergedScope = hospitalId === ALL_MY_HOSPITALS;
  const isMobile = useDialysisMobile();
  const canEdit = usePermission('dialysis:session:edit');
  const [rows, setRows] = useState<ActiveRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [liveTransport, setLiveTransport] = useState<DialysisLiveTransport>('socket');
  const [openId, setOpenId] = useState<number | null>(null);
  const [openHospitalId, setOpenHospitalId] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const loadErrorShownRef = useRef(false);

  const load = useCallback(async () => {
    if (hospitalId == null) return;
    setLoading(true);
    try {
      const { data } = await axios.get<ActiveRow[]>('/api/dialysis/sessions/active', {
        params: { hospital_id: hospitalId },
      });
      setRows(data);
      loadErrorShownRef.current = false;
    } catch {
      if (!loadErrorShownRef.current) {
        loadErrorShownRef.current = true;
        message.error('تعذر تحديث القاعة — تحقق من الاتصال');
      }
    } finally {
      setLoading(false);
    }
  }, [hospitalId]);

  useDialysisLiveSync({
    hospitalId,
    hospitals,
    onChange: load,
    enabled: hospitalId != null,
    onTransportChange: setLiveTransport,
  });

  useEffect(() => {
    load();
  }, [load]);

  const liveSubtitle =
    liveTransport === 'poll'
      ? 'جلسات قيد التشغيل — تحديث احتياطي كل دقيقة (اتصال مباشر غير متاح).'
      : liveTransport === 'sse'
        ? 'جلسات قيد التشغيل — تحديث فوري عبر البث المباشر.'
        : 'جلسات قيد التشغيل — تحديث فوري عند أي تغيير في القاعة.';

  const requestEndSession = (id: number, patientName?: string | null, rowHospitalId?: number) => {
    const hid = rowHospitalId ?? (typeof hospitalId === 'number' ? hospitalId : effectiveHospitalId);
    confirmEndDialysisSession({
      sessionId: id,
      patientName,
      hospitalId: hid,
      onDone: load,
    });
  };

  const renderCard = (s: ActiveRow) => (
    <article
      key={s.id}
      className={isMobile ? 'd-live-card' : 'd-card d-live-desktop-card'}
    >
      <div className={isMobile ? 'd-live-card__head' : 'd-live-desktop-card__head'}>
        <Title
          level={5}
          className={isMobile ? 'd-live-card__name' : 'd-live-desktop-card__title'}
        >
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
      <div className={isMobile ? 'd-live-card__actions' : 'd-live-desktop-card__actions'}>
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
            onClick={() => requestEndSession(s.id, s.dialysisPatient?.fullName, s.hospitalId)}
          >
            إنهاء
          </Button>
        )}
      </div>
    </article>
  );

  const body = (
    <div className={isMobile ? 'd-live-page' : undefined}>
      <DialysisPageHeader
        title="القاعة الآن"
        subtitle={liveSubtitle}
      />

      <DialysisMergedScopeBanner />

      <div className="d-toolbar">
        <Tag
          color="red"
          className={isMobile ? 'd-live-page__badge' : 'd-live-toolbar-badge'}
        >
          <ThunderboltOutlined /> {rows.length} جلسة نشطة
        </Tag>
        {!isMobile && <span className="grow" />}
        <Link to="/dialysis/live/tv" target="_blank" rel="noopener noreferrer">
          <Button icon={<DesktopOutlined />} size={isMobile ? 'large' : 'middle'}>
            شاشة TV
          </Button>
        </Link>
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
          <div className={isMobile ? 'd-live-cards' : 'd-live-cards--desktop'}>
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
      <>
        <DialysisPullRefresh onRefresh={load} disabled={hospitalId == null}>
          {body}
        </DialysisPullRefresh>
        <DialysisMobileFab
          icon={<ReloadOutlined />}
          ariaLabel="تحديث القاعة النشطة"
          onClick={() => void load()}
          visible={!loading}
        />
      </>
    );
  }

  return body;
};

export default LivePage;
