import React from 'react';

interface DialysisMobileSkeletonProps {
  rows?: number;
  variant?: 'card' | 'stat';
}

const DialysisMobileSkeleton: React.FC<DialysisMobileSkeletonProps> = ({
  rows = 3,
  variant = 'card',
}) => (
  <div
    className={`d-mobile-skeleton${variant === 'stat' ? ' d-mobile-skeleton--stats' : ''}`}
    aria-hidden
  >
    {Array.from({ length: rows }, (_, i) => (
      <div key={i} className={`d-mobile-skeleton__row d-mobile-skeleton__row--${variant}`} />
    ))}
  </div>
);

export default DialysisMobileSkeleton;
