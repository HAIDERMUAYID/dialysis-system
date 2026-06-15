import React, { lazy, Suspense, useCallback, useRef, useState } from 'react';
import { Spin } from 'antd';
import { useDialysisContext } from '../dialysisContext';
import { useDialysisMobile } from '../useDialysisMobile';
import DialysisPullRefresh from '../DialysisPullRefresh';
import './dialysis-reports.css';

const ReportsReportsPanel = lazy(() => import('./reports/ReportsReportsPanel'));
const ReportsStatisticsPanel = lazy(() => import('./reports/ReportsStatisticsPanel'));

const panelFallback = (
  <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
    <Spin size="large" />
  </div>
);

const ReportsPage: React.FC<{ variant?: 'reports' | 'statistics' }> = ({ variant = 'reports' }) => {
  const { hospitalId } = useDialysisContext();
  const isMobile = useDialysisMobile();
  const [overlayLocked, setOverlayLocked] = useState(false);
  const refreshRef = useRef<(() => void | Promise<void>) | null>(null);

  const handleRegisterRefresh = useCallback((refresh: () => void | Promise<void>) => {
    refreshRef.current = refresh;
  }, []);

  const handlePullRefresh = useCallback(async () => {
    await refreshRef.current?.();
  }, []);

  const panelProps = {
    onOverlayLockChange: setOverlayLocked,
    onRegisterRefresh: handleRegisterRefresh,
  };

  const panel =
    variant === 'reports' ? (
      <ReportsReportsPanel {...panelProps} />
    ) : (
      <ReportsStatisticsPanel {...panelProps} />
    );

  const content = <Suspense fallback={panelFallback}>{panel}</Suspense>;

  if (isMobile) {
    return (
      <DialysisPullRefresh
        onRefresh={handlePullRefresh}
        disabled={hospitalId == null || overlayLocked}
      >
        {content}
      </DialysisPullRefresh>
    );
  }

  return content;
};

export default ReportsPage;
