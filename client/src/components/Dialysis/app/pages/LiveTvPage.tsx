import React, { useCallback, useEffect, useState } from 'react';
import { Button, Empty, Spin, Typography } from 'antd';
import {
  ArrowLeftOutlined,
  FullscreenExitOutlined,
  FullscreenOutlined,
} from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { ALL_MY_HOSPITALS, useDialysisContext } from '../dialysisContext';
import { useDialysisLiveSync } from '../hooks/useDialysisLiveSync';
import { usePermission } from '../../../../hooks/usePermission';
import {
  DIALYSIS_MINISTRY_LINE,
  DIALYSIS_SYSTEM_TITLE_SHORT,
  getHospitalScopeLabel,
  MINISTRY_LOGO_URL,
} from '../dialysisBrand';
import './live-tv-page.css';

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

function formatElapsed(startedAt: string | null | undefined): string {
  if (!startedAt) return '—';
  const mins = Math.max(0, dayjs().diff(dayjs(startedAt), 'minute'));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0) return `${h}س ${m}د`;
  return `${m} د`;
}

const LiveTvPage: React.FC = () => {
  const navigate = useNavigate();
  const canView = usePermission('dialysis:view');
  const { hospitalId, hospitals } = useDialysisContext();
  const [rows, setRows] = useState<ActiveRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => dayjs());
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    if (!canView) {
      navigate('/dialysis', { replace: true });
    }
  }, [canView, navigate]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(dayjs()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const acquire = async () => {
      try {
        const nav = navigator as Navigator & {
          wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> };
        };
        if (nav.wakeLock) {
          lock = await nav.wakeLock.request('screen');
        }
      } catch {
        /* optional */
      }
    };
    void acquire();
    return () => {
      void lock?.release();
    };
  }, []);

  useEffect(() => {
    const onFullscreen = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFullscreen);
    return () => document.removeEventListener('fullscreenchange', onFullscreen);
  }, []);

  const load = useCallback(async () => {
    if (hospitalId == null) return;
    setLoading(true);
    try {
      const { data } = await axios.get<ActiveRow[]>('/api/dialysis/sessions/active', {
        params: { hospital_id: hospitalId },
      });
      setRows(Array.isArray(data) ? data : []);
    } catch {
      /* keep last snapshot on TV */
    } finally {
      setLoading(false);
    }
  }, [hospitalId]);

  useDialysisLiveSync({
    hospitalId,
    hospitals,
    onChange: load,
    enabled: hospitalId != null,
  });

  useEffect(() => {
    void load();
  }, [load]);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      /* ignore */
    }
  };

  if (hospitalId == null) {
    return (
      <div className="d-live-tv d-live-tv--empty">
        <Typography.Title level={3} className="d-live-tv__empty-title">
          اختر المستشفى أولاً
        </Typography.Title>
        <Typography.Paragraph type="secondary">
          افتح التطبيق العادي وحدّد نطاق العمل، ثم أعد فتح وضع الشاشة الكبيرة.
        </Typography.Paragraph>
        <Button type="primary" size="large" onClick={() => navigate('/dialysis/live')}>
          العودة للقاعة
        </Button>
      </div>
    );
  }

  const mergedScope = hospitalId === ALL_MY_HOSPITALS;
  const scopeLabel = getHospitalScopeLabel(hospitalId, hospitals);

  return (
    <div className="d-live-tv" role="main" aria-label="شاشة قاعة الغسل للعرض">
      <header className="d-live-tv__header">
        <div className="d-live-tv__brand">
          <img src={MINISTRY_LOGO_URL} alt="" className="d-live-tv__logo" />
          <div>
            <div className="d-live-tv__title">قاعة الغسل — الجلسات النشطة</div>
            <div className="d-live-tv__hospital">{scopeLabel}</div>
            <div className="d-live-tv__ministry">{DIALYSIS_MINISTRY_LINE}</div>
          </div>
        </div>
        <div className="d-live-tv__clock" aria-live="off">
          <div className="d-live-tv__time">{now.format('HH:mm:ss')}</div>
          <div className="d-live-tv__date">{now.format('YYYY-MM-DD')}</div>
        </div>
        <div className="d-live-tv__stats">
          <span className="d-live-tv__count">{rows.length}</span>
          <span className="d-live-tv__count-label">جلسة نشطة</span>
        </div>
        <div className="d-live-tv__toolbar">
          <Button
            type="text"
            className="d-live-tv__btn"
            aria-label={fullscreen ? 'الخروج من ملء الشاشة' : 'ملء الشاشة'}
            icon={fullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
            onClick={() => void toggleFullscreen()}
          />
          <Button
            type="text"
            className="d-live-tv__btn"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/dialysis/live')}
          >
            خروج
          </Button>
        </div>
      </header>

      <main className="d-live-tv__main">
        <Spin spinning={loading && rows.length === 0}>
          {rows.length === 0 && !loading ? (
            <Empty description="لا توجد جلسات نشطة الآن" className="d-live-tv__empty" />
          ) : (
            <div className="d-live-tv__grid">
              {rows.map((s) => (
                <article key={s.id} className="d-live-tv__card">
                  <div className="d-live-tv__card-name">
                    {s.dialysisPatient?.fullName || `جلسة #${s.id}`}
                  </div>
                  {mergedScope && s.hospital?.name ? (
                    <div className="d-live-tv__card-hospital">{s.hospital.name}</div>
                  ) : null}
                  <div className="d-live-tv__card-location">
                    {s.location
                      ? `${s.location.hallName} — سرير ${s.location.bedCode}`
                      : 'بدون موقع محدد'}
                  </div>
                  <div className="d-live-tv__card-meta">
                    <span>بدء {s.startedAt ? dayjs(s.startedAt).format('HH:mm') : '—'}</span>
                    <span className="d-live-tv__card-elapsed">{formatElapsed(s.startedAt)}</span>
                  </div>
                  {(s.preSystolic && s.preDiastolic) || s.weightPreKg ? (
                    <div className="d-live-tv__card-vitals">
                      {s.preSystolic && s.preDiastolic ? (
                        <span>
                          ضغط {s.preSystolic}/{s.preDiastolic}
                        </span>
                      ) : null}
                      {s.weightPreKg ? <span>وزن {s.weightPreKg} كغ</span> : null}
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </Spin>
      </main>

      <footer className="d-live-tv__footer">
        <span className="d-live-tv__footer-brand">{DIALYSIS_SYSTEM_TITLE_SHORT}</span>
        <span>للعرض فقط — لا تُنفَّذ إجراءات من هذه الشاشة</span>
      </footer>
    </div>
  );
};

export default LiveTvPage;
