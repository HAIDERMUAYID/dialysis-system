import React, { useState, useEffect } from 'react';
import { Card, Typography, Space, Button } from 'antd';
import { 
  HeartOutlined, 
  MedicineBoxOutlined, 
  TeamOutlined,
  RocketOutlined,
  CheckCircleOutlined
} from '@ant-design/icons';
import { useAuth } from '../../context/AuthContext';
import dayjs from 'dayjs';
import './WelcomeMessage.css';

const { Title, Text, Paragraph } = Typography;

const WelcomeMessage: React.FC = () => {
  const { user } = useAuth();
  const [greeting, setGreeting] = useState('');
  const [showWelcome, setShowWelcome] = useState(true);

  useEffect(() => {
    const hour = dayjs().hour();
    if (hour >= 5 && hour < 12) {
      setGreeting('صباح الخير');
    } else if (hour >= 12 && hour < 17) {
      setGreeting('مساء الخير');
    } else {
      setGreeting('مساء الخير');
    }
  }, []);

  if (!showWelcome || !user) return null;

  const getRoleName = (role: string) => {
    const roles: { [key: string]: string } = {
      admin: 'المدير',
      doctor: 'الطبيب',
      inquiry: 'موظف الاستعلامات',
      lab: 'موظف التحليلات',
      lab_manager: 'مدير المختبر',
      pharmacist: 'الصيدلي',
      pharmacy_manager: 'مدير الصيدلية'
    };
    return roles[role] || role;
  };

  return (
    <div className="welcome-container">
      <Card className="welcome-card" variant="borderless">
        <div className="welcome-content">
          <div className="welcome-header">
            <div className="welcome-icon-container">
              <HeartOutlined className="welcome-icon" />
            </div>
            <div className="welcome-text">
              <div className="welcome-title">
                {greeting}، <strong>{user.name || user.username}</strong> 👋
              </div>
              <div className="welcome-subtitle">
                {getRoleName(user.role)} • {dayjs().format('YYYY-MM-DD')}
              </div>
            </div>
            <Button 
              type="text" 
              onClick={() => setShowWelcome(false)}
              className="close-welcome-btn"
              size="small"
            >
              ✕
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default WelcomeMessage;
