import React, { useEffect } from 'react';
import { Spin, Typography, Tag, Empty, message } from 'antd';
import {
  TeamOutlined,
  ApartmentOutlined,
  ClockCircleOutlined,
  HddOutlined,
  ThunderboltOutlined,
  CalendarOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { ALL_MY_HOSPITALS, useDialysisContext } from '../dialysisContext';
import { useDialysisMobile } from '../useDialysisMobile';
import { useDialysisOverview } from '../hooks';
import DialysisPullRefresh from '../DialysisPullRefresh';
import DialysisMobileSkeleton from '../DialysisMobileSkeleton';
import DialysisPageHeader from '../DialysisPageHeader';
import DialysisOperationalAlerts from '../DialysisOperationalAlerts';
import { Link } from 'react-router-dom';
import './overview-page.css';

const { Title, Text } = Typography;

const OverviewPage: React.FC = () => {
  const { hospitalId } = useDialysisContext();
  const isMobile = useDialysisMobile();
  const mergedScope = hospitalId === ALL_MY_HOSPITALS;

  const { stats, active, loading, isSuccess, refetch, error } = useDialysisOverview(hospitalId);

  useEffect(() => {
    if (error) {
      message.error('تعذر تحميل ملخص النظام. تحقق من الاتصال وأعد المحاولة.');
    }
  }, [error]);

  const showMobileSkeleton = isMobile && loading && !isSuccess;

  const cards = [
    { key: 'patients', label: 'مرضى مسجّلون', value: stats.patients, icon: <TeamOutlined />, link: '/dialysis/patients' },
    { key: 'active', label: 'جلسات نشطة الآن', value: stats.active, icon: <ThunderboltOutlined />, link: '/dialysis/live' },
    { key: 'today', label: `جلسات اليوم (${dayjs().format('YYYY-MM-DD')})`, value: stats.today, icon: <CalendarOutlined />, link: '/dialysis/sessions' },
    { key: 'locations', label: 'أسرة/قاعات', value: stats.locations, icon: <ApartmentOutlined />, link: '/dialysis/halls' },
    { key: 'slots', label: 'شفتات معرّفة', value: stats.slots, icon: <ClockCircleOutlined />, link: '/dialysis/shifts' },
    { key: 'machines', label: 'أجهزة الغسل', value: stats.machines, icon: <HddOutlined />, link: '/dialysis/machines' },
  ] as const;

  const body = (
    <Spin spinning={loading && !isMobile}>
      <DialysisPageHeader
        title="نظرة عامة"
        subtitle="ملخص بيانات وحدة الغسل الكلوي. يتم تحديث البيانات كل 30 ثانية."
      />

      <DialysisOperationalAlerts />

      {showMobileSkeleton ? (
        <DialysisMobileSkeleton rows={6} variant="stat" />
      ) : (
        <div className={`d-stat-grid${isMobile && loading ? ' d-stat-grid--refresh' : ''}`}>
          {cards.map((c) => (
            <Link key={c.key} to={c.link} className="d-stat">
              <div className="d-stat-info">
                <span className="d-stat-label">{c.label}</span>
                <span className="d-stat-value">{c.value}</span>
              </div>
              <span className={`d-stat-icon d-stat-icon--${c.key}`}>{c.icon}</span>
            </Link>
          ))}
        </div>
      )}

      <div className="d-card d-overview-active-section">
        <Title level={5} className="d-card-title">
          جلسات قيد التشغيل
        </Title>
        {active.length === 0 ? (
          <Empty description="لا توجد جلسات نشطة الآن" />
        ) : (
          <div className="d-overview-active-list">
            {active.map((s) => (
              <div key={s.id} className="d-active-summary-row d-active-summary-row--boxed">
                <div>
                  {mergedScope && s.hospital?.name ? (
                    <Tag color="geekblue" className="d-overview-scope-tag">
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
            <Link to="/dialysis/live" className="d-overview-active-more">
              عرض جميع الجلسات النشطة ←
            </Link>
          </div>
        )}
      </div>
    </Spin>
  );

  const handleRefresh = async () => {
    await refetch();
  };

  if (isMobile) {
    return (
      <DialysisPullRefresh onRefresh={handleRefresh} disabled={hospitalId == null}>
        {body}
      </DialysisPullRefresh>
    );
  }

  return body;
};

export default OverviewPage;
