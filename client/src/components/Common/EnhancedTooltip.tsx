/**
 * Enhanced Tooltip Component
 * تلميحات محسّنة مع معلومات مفيدة
 */

import React from 'react';
import { Tooltip } from 'antd';
import type { TooltipProps } from 'antd';
import './EnhancedTooltip.css';

interface EnhancedTooltipProps extends Omit<TooltipProps, 'title'> {
  title: React.ReactNode;
  shortcut?: string;
  description?: string;
}

export const EnhancedTooltip: React.FC<EnhancedTooltipProps> = ({
  title,
  shortcut,
  description,
  children,
  ...props
}) => {
  const tooltipTitle = (
    <div className="enhanced-tooltip-content">
      <div className="tooltip-title">{title}</div>
      {description && (
        <div className="tooltip-description">{description}</div>
      )}
      {shortcut && (
        <div className="tooltip-shortcut">
          <kbd>{shortcut}</kbd>
        </div>
      )}
    </div>
  );

  return (
    <Tooltip title={tooltipTitle} {...props}>
      {children}
    </Tooltip>
  );
};

// Tooltip wrapper with default props
export const HelpTooltip: React.FC<{
  content: React.ReactNode;
  children: React.ReactNode;
  placement?: TooltipProps['placement'];
}> = ({ content, children, placement = 'top' }) => {
  return (
    <EnhancedTooltip
      title={content}
      placement={placement}
      mouseEnterDelay={0.5}
    >
      {children}
    </EnhancedTooltip>
  );
};

// Button with tooltip wrapper
export const TooltipButton: React.FC<{
  tooltip: string;
  shortcut?: string;
  description?: string;
  children: React.ReactNode;
  [key: string]: any;
}> = ({ tooltip, shortcut, description, children, ...buttonProps }) => {
  return (
    <EnhancedTooltip
      title={tooltip}
      shortcut={shortcut}
      description={description}
    >
      {React.cloneElement(children as React.ReactElement, buttonProps)}
    </EnhancedTooltip>
  );
};
