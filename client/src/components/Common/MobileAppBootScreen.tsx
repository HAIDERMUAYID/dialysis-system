import React, { useEffect, useMemo, useState } from 'react';
import './MobileAppBootScreen.css';

interface MobileAppBootScreenProps {
  text?: string;
}

const MobileAppBootScreen: React.FC<MobileAppBootScreenProps> = ({
  text = 'جاري تجهيز التطبيق...',
}) => {
  const stages = useMemo(
    () => ['تهيئة واجهة التطبيق...', 'التحقق من الجلسة والصلاحيات...', text],
    [text]
  );
  const [stageIndex, setStageIndex] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setStageIndex((prev) => (prev < stages.length - 1 ? prev + 1 : prev));
    }, 520);
    return () => window.clearInterval(timer);
  }, [stages.length]);

  const progressPct = ((stageIndex + 1) / stages.length) * 100;

  return (
    <div className="mobile-app-boot" role="status" aria-live="polite">
      <div className="mobile-app-boot__card">
        <img
          src="/images/ministry-logo.png"
          alt="شعار وزارة الصحة"
          className="mobile-app-boot__logo"
        />
        <h2>D-IRS</h2>
        <p>{stages[stageIndex]}</p>
        <div className="mobile-app-boot__progress" aria-hidden>
          <span style={{ width: `${progressPct}%` }} />
        </div>
      </div>
    </div>
  );
};

export default MobileAppBootScreen;
