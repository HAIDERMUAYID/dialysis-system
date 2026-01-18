/**
 * Enhanced Loading Components
 * مكونات تحميل محسّنة مع أنيميشنات جميلة
 */

import React from 'react';
import { Spin, Skeleton } from 'antd';
import { LoadingOutlined } from '@ant-design/icons';
import './EnhancedLoading.css';

interface EnhancedLoadingProps {
  size?: 'small' | 'default' | 'large';
  tip?: string;
  fullScreen?: boolean;
}

export const EnhancedLoading: React.FC<EnhancedLoadingProps> = ({
  size = 'large',
  tip = 'جاري التحميل...',
  fullScreen = false,
}) => {
  const antIcon = <LoadingOutlined style={{ fontSize: 24 }} spin />;

  if (fullScreen) {
    return (
      <div className="enhanced-loading-fullscreen">
        <div className="loading-content">
          <Spin indicator={antIcon} size={size} tip={tip} />
          <div className="loading-pulse"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="enhanced-loading-container">
      <Spin indicator={antIcon} size={size} tip={tip} />
    </div>
  );
};

interface SkeletonLoadingProps {
  rows?: number;
  avatar?: boolean;
  active?: boolean;
}

export const SkeletonLoading: React.FC<SkeletonLoadingProps> = ({
  rows = 3,
  avatar = false,
  active = true,
}) => {
  return (
    <div className="skeleton-loading-container">
      <Skeleton
        avatar={avatar}
        active={active}
        paragraph={{ rows }}
        title
      />
    </div>
  );
};

interface ProgressLoadingProps {
  percent: number;
  status?: 'success' | 'exception' | 'active' | 'normal';
  showInfo?: boolean;
}

export const ProgressLoading: React.FC<ProgressLoadingProps> = ({
  percent,
  status = 'active',
  showInfo = true,
}) => {
  return (
    <div className="progress-loading-container">
      <div className="progress-wrapper">
        <div className="progress-bar" style={{ width: `${percent}%` }}></div>
      </div>
      {showInfo && (
        <div className="progress-info">{percent}%</div>
      )}
    </div>
  );
};
