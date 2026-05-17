import React from 'react';
import { MINISTRY_LOGO_URL, DIALYSIS_SYSTEM_TITLE } from './dialysisBrand';
import './dialysis-brand.css';

export type DialysisBrandLogoSize = 'sm' | 'md' | 'lg' | 'xl';

interface DialysisBrandLogoProps {
  size?: DialysisBrandLogoSize;
  className?: string;
  /** إيقاف الحركة (مثلاً في معاينة ثابتة) */
  static?: boolean;
}

const DialysisBrandLogo: React.FC<DialysisBrandLogoProps> = ({
  size = 'md',
  className = '',
  static: noMotion = false,
}) => (
  <span
    className={`d-brand-logo d-brand-logo--${size}${className ? ` ${className}` : ''}`}
    aria-hidden={false}
  >
    {!noMotion && <span className="d-brand-logo__ring" aria-hidden />}
    <img
      className="d-brand-logo__img"
      src={MINISTRY_LOGO_URL}
      alt={DIALYSIS_SYSTEM_TITLE}
      width={size === 'xl' ? 72 : size === 'lg' ? 56 : size === 'md' ? 44 : 32}
      height={size === 'xl' ? 72 : size === 'lg' ? 56 : size === 'md' ? 44 : 32}
    />
  </span>
);

export default DialysisBrandLogo;
