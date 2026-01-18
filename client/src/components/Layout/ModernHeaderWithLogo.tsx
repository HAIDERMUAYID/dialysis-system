import React, { useState } from 'react';
import { Layout } from 'antd';
import { LogoutOutlined, UserOutlined } from '@ant-design/icons';
import NotificationBell from '../Notifications/NotificationBell';
import ChangePasswordModal from '../Common/ChangePasswordModal';
import { ThemeToggle } from '../Common/ThemeToggle';
import './ModernHeaderWithLogo.css';

const { Header } = Layout;

interface ModernHeaderWithLogoProps {
  roleName: string;
  user?: { name?: string } | null;
  onLogout: () => void;
  centerActions?: React.ReactNode;
  className?: string;
}

const ModernHeaderWithLogo: React.FC<ModernHeaderWithLogoProps> = ({
  roleName,
  user,
  onLogout,
  centerActions,
  className = ''
}) => {
  const [changePasswordVisible, setChangePasswordVisible] = useState(false);

  return (
    <Header className={`modern-header-with-logo ${className}`}>
      <div className="modern-header-content">
        <div className="modern-header-left">
          <div className="modern-header-logo-wrapper">
            <img 
              src="/images/ministry-logo.png" 
              alt="شعار وزارة الصحة العراقية"
              className="modern-header-logo"
              onError={(e) => {
                // Fallback to icon if image not found
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                const fallback = target.nextElementSibling as HTMLElement;
                if (fallback) fallback.style.display = 'flex';
              }}
            />
            <div className="modern-header-logo-fallback" style={{ display: 'none' }}>
              🏥
            </div>
          </div>
          <div className="modern-header-title-section">
            <h1 className="modern-header-ministry">وزارة الصحة العراقية</h1>
            <h2 className="modern-header-directorate">دائرة صحة النجف الاشرف</h2>
            <h3 className="modern-header-hospital">مستشفى الحكيم العام</h3>
            <p className="modern-header-subtitle">{roleName}</p>
          </div>
        </div>
        
        {centerActions && (
          <div className="modern-header-center">
            {centerActions}
          </div>
        )}
        
        <div className="modern-header-right">
          <ThemeToggle />
          <div className="modern-header-notification-wrapper">
            <NotificationBell />
          </div>
          <div 
            className="modern-header-user-section"
            onClick={() => setChangePasswordVisible(true)}
            style={{ cursor: 'pointer' }}
          >
            <div className="modern-header-user-avatar">
              <UserOutlined />
            </div>
            <span className="modern-header-user-name">{user?.name}</span>
          </div>
          
          <ChangePasswordModal
            open={changePasswordVisible}
            onClose={() => setChangePasswordVisible(false)}
          />
          <button
            className="modern-header-logout-btn"
            onClick={onLogout}
          >
            <LogoutOutlined />
            <span>تسجيل الخروج</span>
          </button>
        </div>
      </div>
    </Header>
  );
};

export default ModernHeaderWithLogo;
