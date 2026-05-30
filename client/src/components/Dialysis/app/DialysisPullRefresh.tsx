import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ReloadOutlined } from '@ant-design/icons';
import { dialysisHaptic, prefersReducedMotion } from './useDialysisHaptic';
import './dialysis-pull-refresh.css';

const THRESHOLD = 76;
const MAX_PULL = 120;

interface DialysisPullRefreshProps {
  children: React.ReactNode;
  onRefresh: () => Promise<void>;
  disabled?: boolean;
}

/** تفعيل السحب للتحديث على الشاشات اللمسية فقط — لا يعطّل التمرير بالماوس */
function useCoarsePointer(): boolean {
  const [coarse, setCoarse] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(hover: none) and (pointer: coarse)').matches
      : false
  );

  useEffect(() => {
    const mq = window.matchMedia('(hover: none) and (pointer: coarse)');
    const sync = () => setCoarse(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  return coarse;
}

const DialysisPullRefresh: React.FC<DialysisPullRefreshProps> = ({
  children,
  onRefresh,
  disabled = false,
}) => {
  const touchUi = useCoarsePointer();
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const pulling = useRef(false);

  const ready = pull >= THRESHOLD && !refreshing;
  const active = touchUi && !disabled;

  const runRefresh = useCallback(async () => {
    setRefreshing(true);
    dialysisHaptic('success');
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
      setPull(0);
    }
  }, [onRefresh]);

  const onTouchStart = (e: React.TouchEvent) => {
    if (!active || refreshing || window.scrollY > 4) return;
    startY.current = e.touches[0].clientY;
    pulling.current = true;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!pulling.current || !active || refreshing) return;

    if (window.scrollY > 4) {
      pulling.current = false;
      setPull(0);
      return;
    }

    const dy = e.touches[0].clientY - startY.current;
    if (dy <= 0) {
      setPull(0);
      return;
    }

    const damped = Math.min(MAX_PULL, dy * 0.45);
    setPull(damped);

    if (damped > 12 && e.cancelable) {
      e.preventDefault();
    }
  };

  const onTouchEnd = async () => {
    if (!pulling.current) return;
    pulling.current = false;
    if (pull >= THRESHOLD && !refreshing) {
      await runRefresh();
    } else {
      setPull(0);
    }
  };

  const indicatorStyle = prefersReducedMotion()
    ? undefined
    : {
        transform: `translateY(${refreshing ? 48 : pull}px) rotate(${refreshing ? 360 : pull * 2.2}deg)`,
        opacity: refreshing || pull > 8 ? 1 : 0,
      };

  if (!active) {
    return <>{children}</>;
  }

  return (
    <div
      className={`d-pull-refresh${refreshing ? ' is-refreshing' : ''}${ready ? ' is-ready' : ''}`}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
    >
      <div className="d-pull-refresh__indicator" style={indicatorStyle} aria-hidden>
        <ReloadOutlined spin={refreshing} />
        <span>{refreshing ? 'جاري التحديث…' : ready ? 'أفلت للتحديث' : 'اسحب للتحديث'}</span>
      </div>
      <div
        className="d-pull-refresh__content"
        style={
          prefersReducedMotion() || refreshing
            ? undefined
            : { transform: pull > 0 ? `translateY(${pull * 0.35}px)` : undefined }
        }
      >
        {children}
      </div>
    </div>
  );
};

export default DialysisPullRefresh;
