import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Tour, type TourProps } from 'antd';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../../context/AuthContext';
import { isOnboardingTourDone, markOnboardingTourDone } from './dialysisOnboardingStorage';
import './dialysis-onboarding-tour.css';

function tourTarget(selector: string): () => HTMLElement {
  return () =>
    (document.querySelector(selector) as HTMLElement | null) ??
    (document.querySelector('[data-tour="dialysis-header"]') as HTMLElement);
}

const STEP_ROUTES: Array<string | null> = [
  '/dialysis',
  '/dialysis',
  '/dialysis/patients',
  '/dialysis/sessions',
  '/dialysis/live',
  '/dialysis/patients',
];

interface Props {
  enabled: boolean;
  isMobile: boolean;
  /** يُستدعى من قائمة الحساب لإعادة الجولة */
  restartNonce?: number;
}

const DialysisOnboardingTour: React.FC<Props> = ({ enabled, isMobile, restartNonce = 0 }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState(0);
  const autoStartedRef = useRef(false);
  const lastRestartRef = useRef(restartNonce);

  const steps: TourProps['steps'] = useMemo(
    () => [
      {
        title: 'مرحباً في D-IRS',
        description: isMobile
          ? 'نظام وحدة الغسل الكلوي — من هنا تتابع المرضى والجلسات والقاعة. الجولة تستغرق نحو 5 دقائق. يمكنك إغلاقها من ✕ في أي وقت.'
          : 'نظام وحدة الغسل الكلوي — من الشريط الجانبي تنتقل بين الأقسام. الجولة تستغرق نحو 5 دقائق. يمكنك إغلاقها من ✕ في أي وقت.',
        nextButtonProps: { children: 'ابدأ' },
        target: tourTarget('[data-tour="dialysis-welcome"], [data-tour="dialysis-header"]'),
        placement: 'bottom',
      },
      {
        title: 'نطاق العمل',
        description: isMobile
          ? 'اختر المستشفى من «نطاق العمل» في قائمة المزيد (☰) أو من حسابك — كل البيانات تُعرض حسب المستشفى المحدد.'
          : 'اختر المستشفى من «نطاق العمل» في الشريط الجانبي. كل القوائم والتقارير تتبع المستشفى المحدد.',
        target: tourTarget('[data-tour="dialysis-hospital-scope"]'),
        placement: isMobile ? 'top' : 'right',
      },
      {
        title: 'المرضى',
        description:
          'سجّل مريضاً جديداً أو ابحث بالاسم/الملف. يمكنك تصفية من لديهم بصمة وجه أو يحتاجون تحديثاً.',
        target: tourTarget(
          '[data-tour="dialysis-nav-patients"], .d-tour-nav-patients, .ant-menu-item.d-tour-nav-patients'
        ),
        placement: isMobile ? 'top' : 'right',
      },
      {
        title: 'الجلسات',
        description:
          'أنشئ جلسة غسل جديدة، راقب الحالة (مجدولة / جارية / منتهية)، واستخدم الفلاتر لمعرفة الغسلات الطارئة أو غير المجدولة.',
        target: tourTarget(
          '[data-tour="dialysis-nav-sessions"], .d-tour-nav-sessions, .ant-menu-item.d-tour-nav-sessions'
        ),
        placement: isMobile ? 'top' : 'right',
      },
      {
        title: 'قاعة الغسل الحية',
        description:
          'شاشة القاعة تعرض الجلسات الجارية الآن — مفيدة للممرض على الجوال أثناء الوردية.',
        target: tourTarget(
          '[data-tour="dialysis-nav-live"], .d-tour-nav-live, .ant-menu-item.d-tour-nav-live'
        ),
        placement: isMobile ? 'top' : 'right',
      },
      {
        title: 'بصمة الوجه',
        description:
          'سجّل وجه المريض مرة واحدة ثم استخدم «تعرف بالوجه» عند بدء الجلسة. الشريط أعلاه يذكّرك بمن يحتاج تسجيلاً أو تحديثاً.',
        target: tourTarget('[data-tour="dialysis-face-banner"], [data-tour="dialysis-nav-patients"]'),
        placement: 'bottom',
      },
    ],
    [isMobile]
  );

  const goToStepRoute = useCallback(
    (stepIndex: number) => {
      const route = STEP_ROUTES[stepIndex];
      if (!route) return;
      const onOverview = location.pathname === '/dialysis' || location.pathname === '/dialysis/';
      if (route === '/dialysis') {
        if (!onOverview) navigate('/dialysis');
        return;
      }
      if (!location.pathname.startsWith(route)) {
        navigate(route);
      }
    },
    [location.pathname, navigate]
  );

  const finish = useCallback(() => {
    setOpen(false);
    markOnboardingTourDone(user?.id);
  }, [user?.id]);

  const startTour = useCallback(() => {
    setCurrent(0);
    navigate('/dialysis');
    window.setTimeout(() => setOpen(true), 400);
  }, [navigate]);

  useEffect(() => {
    if (!enabled || restartNonce === lastRestartRef.current) return;
    lastRestartRef.current = restartNonce;
    if (restartNonce > 0) startTour();
  }, [enabled, restartNonce, startTour]);

  useEffect(() => {
    if (!enabled || !user?.id || autoStartedRef.current) return;
    if (isOnboardingTourDone(user.id)) return;
    const onOverview =
      location.pathname === '/dialysis' || location.pathname === '/dialysis/';
    if (!onOverview) return;
    autoStartedRef.current = true;
    const timer = window.setTimeout(() => setOpen(true), 1200);
    return () => window.clearTimeout(timer);
  }, [enabled, user?.id, location.pathname]);

  const handleChange = (next: number) => {
    goToStepRoute(next);
    window.setTimeout(() => setCurrent(next), 280);
  };

  if (!enabled) return null;

  return (
    <Tour
      open={open}
      current={current}
      steps={steps}
      onClose={finish}
      onFinish={finish}
      onChange={handleChange}
      rootClassName="d-onboarding-tour"
      indicatorsRender={(currentStep, total) => (
        <span className="d-onboarding-tour__progress" aria-live="polite">
          {currentStep + 1} / {total}
        </span>
      )}
    />
  );
};

export default DialysisOnboardingTour;
