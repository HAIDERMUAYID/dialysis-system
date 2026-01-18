/**
 * Theme Toggle Component
 * زر تبديل وضع الظلام/الفاتح
 */

import React from 'react';
import { Button, Tooltip } from 'antd';
import { MoonOutlined, SunOutlined } from '@ant-design/icons';
import { useTheme } from '../../context/ThemeContext';
import './ThemeToggle.css';

export const ThemeToggle: React.FC = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <Tooltip title={theme === 'light' ? 'تفعيل الوضع الداكن' : 'تفعيل الوضع الفاتح'}>
      <Button
        type="text"
        icon={theme === 'light' ? <MoonOutlined /> : <SunOutlined />}
        onClick={toggleTheme}
        className="theme-toggle-btn"
        size="large"
      />
    </Tooltip>
  );
};
