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

// Ant Design theme configuration
export const antdTheme: ThemeConfig = {
  token: {
    colorPrimary: '#1890ff',
    borderRadius: 6,
    fontFamily: "'Cairo', 'Segoe UI', 'Arial', 'Tahoma', sans-serif",
  },
  components: {
    Menu: {
      itemBorderRadius: 8,
    },
    Button: {
      borderRadius: 6,
    },
    Card: {
      borderRadius: 8,
      boxShadow: '0 2px 8px rgba(0,0,0,0.09)',
    },
    Table: {
      borderRadius: 8,
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
