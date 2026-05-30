import React from 'react';
import { createPortal } from 'react-dom';
import { dialysisHaptic } from './useDialysisHaptic';

interface DialysisMobileFabProps {
  icon: React.ReactNode;
  label?: string;
  onClick: () => void;
  visible?: boolean;
  ariaLabel: string;
}

const DialysisMobileFab: React.FC<DialysisMobileFabProps> = ({
  icon,
  label,
  onClick,
  visible = true,
  ariaLabel,
}) => {
  if (!visible || typeof document === 'undefined') return null;

  return createPortal(
    <button
      type="button"
      className="d-mobile-fab"
      aria-label={ariaLabel}
      onClick={() => {
        dialysisHaptic('tap');
        onClick();
      }}
    >
      <span className="d-mobile-fab__icon">{icon}</span>
      {label ? <span className="d-mobile-fab__label">{label}</span> : null}
    </button>,
    document.body
  );
};

export default DialysisMobileFab;
