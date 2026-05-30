import React, { useEffect, useMemo, useState } from 'react';
import './MobileAppBootScreen.css';

interface MobileAppBootScreenProps {
  text?: string;
}

const MINISTRY_LINE = 'وزارة الصحة — دائرة صحة النجف الأشرف';
const SYSTEM_LINE = 'وحدة الغسل الكلوي';

const MobileAppBootScreen: React.FC<MobileAppBootScreenProps> = ({
  text = 'جاري تجهيز التطبيق...',
}) => {
  const stages = useMemo(
    () => ['تهيئة الواجهة...', 'التحقق من الجلسة...', text],
    [text]
  );
  const [stageIndex, setStageIndex] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setStageIndex((prev) => (prev < stages.length - 1 ? prev + 1 : prev));
    }, 680);
    return () => window.clearInterval(timer);
  }, [stages.length]);

  const progressPct = Math.min(100, 18 + ((stageIndex + 1) / stages.length) * 82);

  return (
    <div className="mobile-app-boot" role="status" aria-live="polite" aria-busy="true">
      <div className="mobile-app-boot__mesh" aria-hidden />
      <div className="mobile-app-boot__orb mobile-app-boot__orb--1" aria-hidden />
      <div className="mobile-app-boot__orb mobile-app-boot__orb--2" aria-hidden />

      <div className="mobile-app-boot__card">
        <div className="mobile-app-boot__logo-wrap">
          <span className="mobile-app-boot__ring mobile-app-boot__ring--outer" aria-hidden />
          <span className="mobile-app-boot__ring mobile-app-boot__ring--inner" aria-hidden />
          <img
            src="/images/ministry-logo.png"
            alt=""
            className="mobile-app-boot__logo"
          />
        </div>

        <p className="mobile-app-boot__ministry">{MINISTRY_LINE}</p>
        <h1 className="mobile-app-boot__title">D-IRS</h1>
        <p className="mobile-app-boot__subtitle">{SYSTEM_LINE}</p>

        <p className="mobile-app-boot__status" key={stageIndex}>
          {stages[stageIndex]}
        </p>

        <div className="mobile-app-boot__dots" aria-hidden>
          {stages.map((_, i) => (
            <span
              key={i}
              className={`mobile-app-boot__dot${i === stageIndex ? ' is-active' : ''}${i < stageIndex ? ' is-done' : ''}`}
            />
          ))}
        </div>

        <div className="mobile-app-boot__progress" aria-hidden>
          <span
            className="mobile-app-boot__progress-fill"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>
    </div>
  );
};

export default MobileAppBootScreen;
