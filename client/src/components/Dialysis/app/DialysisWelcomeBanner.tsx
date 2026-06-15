import React, { useEffect, useMemo, useState } from 'react';
import { Button } from 'antd';
import { CloseOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useAuth } from '../../../context/AuthContext';
import { ALL_MY_HOSPITALS, useDialysisContext } from './dialysisContext';
import { getHospitalScopeLabel, DIALYSIS_MINISTRY_LINE, MINISTRY_LOGO_URL } from './dialysisBrand';
import './dialysis-welcome.css';

const STORAGE_KEY = 'd-irs-welcome-dismissed';

function getTimeGreeting(): string {
  const hour = dayjs().hour();
  if (hour >= 5 && hour < 12) return 'صباح الخير';
  if (hour >= 12 && hour < 17) return 'مساء الخير';
  return 'مساء الخير';
}

function getDialysisRoleLabel(role: string | undefined, permissions: string[] | undefined): string {
  if (role === 'admin') return 'مدير النظام';
  if (role === 'dialysis_staff') return 'طاقم وحدة الغسل الكلوي';
  const perms = permissions ?? [];
  if (perms.includes('dialysis:access:manage')) return 'إدارة وحدة الغسل';
  if (perms.some((p) => p.startsWith('dialysis:pharmacy:'))) return 'صيدلية الغسل الكلوي';
  if (perms.includes('dialysis:view')) return 'موظف وحدة الغسل الكلوي';
  return 'مستخدم النظام';
}

interface Props {
  isMobile?: boolean;
}

const DialysisWelcomeBanner: React.FC<Props> = ({ isMobile = false }) => {
  const { user } = useAuth();
  const { hospitals, hospitalId } = useDialysisContext();
  const [visible, setVisible] = useState(false);

  const storageId = user?.id != null ? `${STORAGE_KEY}-${user.id}` : STORAGE_KEY;

  useEffect(() => {
    if (!user) {
      setVisible(false);
      return;
    }
    try {
      const dismissed = sessionStorage.getItem(storageId) === '1';
      setVisible(!dismissed);
    } catch {
      setVisible(true);
    }
  }, [user, storageId]);

  const greeting = useMemo(() => getTimeGreeting(), []);
  const displayName = user?.name?.trim() || user?.username || 'زميلنا';
  const roleLabel = getDialysisRoleLabel(user?.role, user?.permissions);
  const hospitalLabel = getHospitalScopeLabel(hospitalId, hospitals);
  const todayLabel = dayjs().format('YYYY-MM-DD');

  const dismiss = () => {
    try {
      sessionStorage.setItem(storageId, '1');
    } catch {
      /* ignore */
    }
    setVisible(false);
  };

  if (!visible || !user) return null;

  return (
    <section
      className={`d-welcome${isMobile ? ' d-welcome--mobile' : ''}`}
      role="region"
      aria-label="ترحيب بالموظف"
      data-tour="dialysis-welcome"
    >
      <div className="d-welcome__mesh" aria-hidden />
      <div className="d-welcome__inner">
        <div className="d-welcome__brand">
          <img src={MINISTRY_LOGO_URL} alt="" className="d-welcome__logo" />
          <div className="d-welcome__brand-text">
            <span className="d-welcome__ministry">{DIALYSIS_MINISTRY_LINE}</span>
            <span className="d-welcome__system">وحدة الغسل الكلوي — D-IRS</span>
          </div>
        </div>

        <div className="d-welcome__main">
          <p className="d-welcome__greeting">{greeting}</p>
          <h2 className="d-welcome__name">{displayName}</h2>
          {!isMobile && (
            <p className="d-welcome__lead">
              مرحباً بك في نظام إدارة الغسل الكلوي. يمكنك متابعة الجلسات والمرضى والمخزون من لوحة
              التحكم.
            </p>
          )}
          <div className="d-welcome__meta">
            <span className="d-welcome__chip">
              <SafetyCertificateOutlined />
              {roleLabel}
            </span>
            {!isMobile && hospitalId != null && hospitalId !== ALL_MY_HOSPITALS ? (
              <span className="d-welcome__chip d-welcome__chip--scope">{hospitalLabel}</span>
            ) : null}
            {isMobile && hospitalId != null ? (
              <span className="d-welcome__chip d-welcome__chip--muted">
                {hospitalId === ALL_MY_HOSPITALS
                  ? 'جميع المستشفيات'
                  : hospitals.find((h) => h.id === hospitalId)?.code || 'المستشفى الحالي'}
              </span>
            ) : null}
            <span className="d-welcome__chip d-welcome__chip--muted">{todayLabel}</span>
          </div>
        </div>

        <Button
          type="text"
          className="d-welcome__close"
          icon={<CloseOutlined />}
          aria-label="إخفاء الترحيب"
          onClick={dismiss}
        />
      </div>
    </section>
  );
};

export default DialysisWelcomeBanner;
