import React from 'react';
import { ConfigProvider, ThemeConfig } from 'antd';
import arEG from 'antd/locale/ar_EG';
import dayjs from 'dayjs';
import 'dayjs/locale/ar';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import localizedFormat from 'dayjs/plugin/localizedFormat';
import relativeTime from 'dayjs/plugin/relativeTime';

// Configure dayjs
dayjs.extend(customParseFormat);
dayjs.extend(localizedFormat);
dayjs.extend(relativeTime);
dayjs.locale('ar');

// Ant Design theme configuration - Modern 2024/2025 Design
export const antdTheme: ThemeConfig = {
  token: {
    // Primary Color - Modern Purple-Blue Gradient
    colorPrimary: '#667eea',
    colorSuccess: '#10b981',
    colorWarning: '#f59e0b',
    colorError: '#ef4444',
    colorInfo: '#3b82f6',
    
    // Dark mode support
    colorBgContainer: 'var(--bg-primary-light, #ffffff)',
    colorBgElevated: 'var(--bg-elevated, #ffffff)',
    colorBgLayout: 'var(--bg-secondary-light, #f8fafc)',
    colorText: 'var(--text-primary-light, #0f172a)',
    colorTextSecondary: 'var(--text-secondary-light, #475569)',
    colorBorder: 'var(--border-light, #e2e8f0)',
    colorBorderSecondary: 'var(--border-light, #e2e8f0)',
    
    // Border Radius - More rounded, modern look
    borderRadius: 12,
    borderRadiusLG: 16,
    borderRadiusSM: 8,
    borderRadiusXS: 4,
    
    // Typography - Modern font sizes
    fontFamily: "'Cairo', 'Segoe UI', 'Arial', 'Tahoma', sans-serif",
    fontSize: 14,
    fontSizeLG: 16,
    fontSizeSM: 12,
    fontSizeXL: 18,
    
    // Spacing - More generous spacing
    padding: 16,
    paddingLG: 24,
    paddingSM: 12,
    paddingXS: 8,
    margin: 16,
    marginLG: 24,
    marginSM: 12,
    marginXS: 8,
    
    // Shadows - Modern depth
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
    boxShadowSecondary: '0 8px 24px rgba(0, 0, 0, 0.12)',
    
    // Control Height - Touch-friendly
    controlHeight: 40,
    controlHeightLG: 48,
    controlHeightSM: 32,
    
    // Line Height - Better readability
    lineHeight: 1.6,
    
    // Motion - Smooth animations
    motionDurationFast: '150ms',
    motionDurationMid: '300ms',
    motionDurationSlow: '500ms',
    motionEaseInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
  },
  components: {
    Menu: {
      itemBorderRadius: 10,
      itemMarginInline: 4,
      itemHoverBg: 'rgba(102, 126, 234, 0.1)',
    },
    Button: {
      borderRadius: 10,
      fontWeight: 600,
      controlHeight: 40,
      boxShadow: '0 2px 8px rgba(102, 126, 234, 0.2)',
      primaryShadow: '0 4px 16px rgba(102, 126, 234, 0.3)',
    },
    Card: {
      borderRadius: 16,
      paddingLG: 24,
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.06)',
      headerBg: 'transparent',
    },
    Table: {
      borderRadius: 16,
      headerBg: '#f8fafc',
      headerColor: '#0f172a',
      headerSortHoverBg: '#f1f5f9',
      rowHoverBg: '#f8fafc',
    },
    Input: {
      borderRadius: 10,
      controlHeight: 40,
      hoverBorderColor: '#667eea',
      activeBorderColor: '#667eea',
      activeShadow: '0 0 0 3px rgba(102, 126, 234, 0.1)',
    },
    Select: {
      borderRadius: 10,
      controlHeight: 40,
    },
    Modal: {
      borderRadius: 20,
      paddingContentHorizontal: 24,
      paddingContentVertical: 24,
    },
    Drawer: {
      borderRadius: 20,
    },
    Tag: {
      borderRadius: 8,
      fontSizeSM: 12,
    },
    Badge: {
      textFontSize: 12,
    },
    Tabs: {
      itemActiveColor: '#667eea',
      itemHoverColor: '#8b5cf6',
      itemSelectedColor: '#667eea',
      inkBarColor: '#667eea',
      borderRadius: 12,
    },
    Form: {
      labelFontSize: 14,
      verticalLabelPadding: '0 0 8px',
    },
    Switch: {
      borderRadius: 12,
    },
    Checkbox: {
      borderRadius: 4,
    },
    Radio: {
      radioSize: 18,
      dotSize: 10,
    },
    DatePicker: {
      borderRadius: 10,
      controlHeight: 40,
    },
  },
};

interface AntdConfigProps {
  children: React.ReactNode;
}

export const AntdConfig: React.FC<AntdConfigProps> = ({ children }) => {
  return (
    <ConfigProvider
      locale={arEG}
      theme={antdTheme}
      direction="rtl"
    >
      {children}
    </ConfigProvider>
  );
};

export default antdTheme;
