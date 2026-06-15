import React from 'react';
import { Typography } from 'antd';
import './dialysis-page-header.css';

const { Text } = Typography;

interface Props {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
}

const DialysisPageHeader: React.FC<Props> = ({ title, subtitle, actions, className }) => (
  <div className={`d-page-header d-dialysis-page-header${className ? ` ${className}` : ''}`}>
    <div className="d-dialysis-page-header__main">
      <h2>{title}</h2>
      {subtitle ? <Text className="sub">{subtitle}</Text> : null}
    </div>
    {actions ? <div className="d-dialysis-page-header__actions">{actions}</div> : null}
  </div>
);

export default DialysisPageHeader;
