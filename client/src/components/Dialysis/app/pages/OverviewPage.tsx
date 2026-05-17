import React, { useEffect, useState, useCallback } from 'react';
import { Spin, Typography, Tag, Empty } from 'antd';
import {
  TeamOutlined,
  ApartmentOutlined,
  ClockCircleOutlined,
  HddOutlined,
  ThunderboltOutlined,
  CalendarOutlined,
} from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';
import { ALL_MY_HOSPITALS, useDialysisContext } from '../dialysisContext';
import { Link } from 'react-router-dom';

const { Title, Text } = Typography;

interface ActiveRow {
  id: number;
  hospital?: { name: string; code?: string | null };
  startedAt?: string | null;
  dialysisPatient?: { fullName: string };
  location?: { hallName: string; bedCode: string } | null;
}

const STAT_COLORS: Record<string, string> = {
  patients: 'linear-gradient(135deg,#3b82f6,#2563eb)',
  locations: 'linear-gradient(135deg,#22c55e,#16a34a)',
  slots: 'linear-gradient(135deg,#f59e0b,#d97706)',
  machines: 'linear-gradient(135deg,#06b6d4,#0891b2)',
  active: 'linear-gradient(135deg,#ef4444,#b91c1c)',
  today: 'linear-gradient(135deg,#8b5cf6,#7c3aed)',
};

const OverviewPage: React.FC = () => {
  const { hospitalId } = useDialysisContext();
  const mergedScope = hospitalId === ALL_MY_HOSPITALS;
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({
    patients: 0,
    locations: 0,
    slots: 0,
    machines: 0,
    active: 0,
    today: 0,
  });
  const [active, setActive] = useState<ActiveRow[]>([]);

  const load = useCallback(async () => {
    if (hospitalId == null) return;
    setLoading(true);
    try {
      const today = dayjs().format('YYYY-MM-DD');
      const params = { hospital_id: hospitalId };
      const [pat, locs, slots, machs, act, todayS] = await Promise.all([
        axios.get('/api/dialysis/patients', { params }),
        axios.get('/api/dialysis/locations', { params }),
        axios.get('/api/dialysis/shift-slots', { params }),
        axios.get('/api/dialysis/machines', { params }),
        axios.get('/api/dialysis/sessions/active', { params }),
        axios.get('/api/dialysis/sessions', { params: { ...params, date: today } }),
      ]);
      setStats({
        patients: Array.isArray(pat.data) ? pat.data.length : 0,
        locations: Array.isArray(locs.data) ? locs.data.length : 0,
        slots: Array.isArray(slots.data) ? slots.data.length : 0,
        machines: Array.isArray(machs.data) ? machs.data.length : 0,
        active: Array.isArray(act.data) ? act.data.length : 0,
        today: Array.isArray(todayS.data) ? todayS.data.length : 0,
      });
      setActive(Array.isArray(act.data) ? act.data.slice(0, 6) : []);
    } catch {
      /* تجاهل، البطاقات تبقى صفرية */
    } finally {
      setLoading(false);
    }
  }, [hospitalId]);

  useEffect(() => {
    load();
    const t = window.setInterval(load, 30_000);
    return () => window.clearInterval(t);
  }, [load]);

  const cards = [
    { key: 'patients', label: 'مرضى مسجّلون', value: stats.patients, icon: <TeamOutlined />, link: '/dialysis/patients' },
    { key: 'active', label: 'جلسات نشطة الآن', value: stats.active, icon: <ThunderboltOutlined />, link: '/dialysis/live' },
    { key: 'today', label: `جلسات اليوم (${dayjs().format('YYYY-MM-DD')})`, value: stats.today, icon: <CalendarOutlined />, link: '/dialysis/sessions' },
    { key: 'locations', label: 'أسرة/قاعات', value: stats.locations, icon: <ApartmentOutlined />, link: '/dialysis/halls' },
    { key: 'slots', label: 'شفتات معرّفة', value: stats.slots, icon: <ClockCircleOutlined />, link: '/dialysis/shifts' },
    { key: 'machines', label: 'أجهزة الغسل', value: stats.machines, icon: <HddOutlined />, link: '/dialysis/machines' },
  ];

  return (
    <Spin spinning={loading}>
      <div className="d-page-header">
        <h2>نظرة عامة</h2>
        <Text className="sub">حركة وحدة الغسل الكلوي اللحظية وتحديث تلقائي كل 30 ثانية.</Text>
      </div>

      <div className="d-stat-grid">
        {cards.map((c) => (
          <Link key={c.key} to={c.link} className="d-stat" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="d-stat-info">
              <span className="d-stat-label">{c.label}</span>
              <span className="d-stat-value">{c.value}</span>
            </div>
            <span className="d-stat-icon" style={{ background: STAT_COLORS[c.key] }}>
              {c.icon}
            </span>
          </Link>
        ))}
      </div>

      <div className="d-card" style={{ marginTop: 18 }}>
        <Title level={5} className="d-card-title">جلسات قيد التشغيل</Title>
        {active.length === 0 ? (
          <Empty description="لا توجد جلسات نشطة الآن" />
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {active.map((s) => (
              <div
                key={s.id}
                className="d-active-summary-row"
                style={{
                  padding: '10px 12px',
                  border: '1px solid #eef0f4',
                  borderRadius: 10,
                  background: '#fafbff',
                }}
              >
                <div>
                  {mergedScope && s.hospital?.name ? (
                    <Tag color="geekblue" style={{ marginInlineEnd: 6 }}>
                      {s.hospital.name}
                    </Tag>
                  ) : null}
                  <Tag color="red">نشطة</Tag>
                  <strong>{s.dialysisPatient?.fullName ?? `#${s.id}`}</strong>
                  {s.location && (
                    <Text type="secondary">
                      {s.location.hallName} — سرير {s.location.bedCode}
                    </Text>
                  )}
                </div>
                <Text type="secondary">
                  {s.startedAt ? `بدأت ${dayjs(s.startedAt).format('HH:mm')}` : '—'}
                </Text>
              </div>
            ))}
            <Link to="/dialysis/live" style={{ alignSelf: 'flex-end' }}>
              عرض جميع الجلسات النشطة ←
            </Link>
          </div>
        )}
      </div>
    </Spin>
  );
};

export default OverviewPage;
