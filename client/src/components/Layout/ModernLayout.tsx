import React from 'react';
import { Layout } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import WelcomeMessage from '../Welcome/WelcomeMessage';
import NotificationBell from '../Notifications/NotificationBell';
import './ModernLayout.css';

const { Header, Content } = Layout;

interface ModernLayoutProps {
  children: React.ReactNode;
  title: string;
  icon?: React.ReactNode;
  extra?: React.ReactNode;
}

const ModernLayout: React.FC<ModernLayoutProps> = ({ 
  children, 
  title, 
  icon,
  extra 
}) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <Layout className="modern-layout">
      <Header className="modern-header">
        <div className="modern-header-content">
          <div className="modern-header-left">
            {icon && <span className="modern-header-icon">{icon}</span>}
            <h1 className="modern-header-title">{title}</h1>
          </div>
          <div className="modern-header-right">
            {extra}
            <NotificationBell />
            <div className="modern-user-info">
              <span className="modern-user-name">{user?.name || user?.username}</span>
            </div>
            <button 
              className="modern-logout-btn"
              onClick={logout}
            >
              تسجيل الخروج
            </button>
          </div>
        </div>
      </Header>
      <Content className="modern-content">
        <WelcomeMessage />
        {children}
      </Content>
    </Layout>
  );
};

export default ModernLayout;
