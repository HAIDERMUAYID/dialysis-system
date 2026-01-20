import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../../App.css';

interface Notification {
  id: number;
  title: string;
  message: string;
  status: string;
  created_at: string;
  visit_number?: string;
}

const NotificationBell: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    fetchNotifications();
    fetchUnreadCount();
    const interval = setInterval(() => {
      fetchNotifications();
      fetchUnreadCount();
    }, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchNotifications = async () => {
    try {
      const response = await axios.get('/api/notifications?status=unread');
      setNotifications(response.data.slice(0, 5)); // Show only 5 most recent
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  const fetchUnreadCount = async () => {
    try {
      const response = await axios.get('/api/notifications/unread-count');
      setUnreadCount(response.data.count);
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  };

  const markAsRead = async (id: number) => {
    try {
      await axios.patch(`/api/notifications/${id}/read`);
      fetchNotifications();
      fetchUnreadCount();
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await axios.patch('/api/notifications/mark-all-read');
      fetchNotifications();
      fetchUnreadCount();
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  return (
    <div style={{ position: 'relative', zIndex: 10001 }}>
      <button
        className="modern-header-notification-btn"
        onClick={() => setShowDropdown(!showDropdown)}
        style={{ position: 'relative' }}
      >
        <span style={{ fontSize: '1.4rem', display: 'block' }}>🔔</span>
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: '-4px',
              right: '-4px',
              background: '#ef4444',
              color: 'white',
              borderRadius: '50%',
              width: '20px',
              height: '20px',
              fontSize: '0.65rem',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(239, 68, 68, 0.6), 0 0 0 2px rgba(255, 255, 255, 0.8)',
              border: '2px solid white',
              animation: 'pulse 2s ease-in-out infinite'
            }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {showDropdown && (
        <>
          {/* Backdrop to close dropdown when clicking outside */}
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 9999,
              background: 'transparent'
            }}
            onClick={() => setShowDropdown(false)}
          />
          <div
            style={{
              position: 'fixed',
              top: '70px',
              right: '20px',
              background: 'white',
              border: '1px solid rgba(0, 0, 0, 0.1)',
              borderRadius: 'var(--radius-2xl)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2), 0 4px 16px rgba(0, 0, 0, 0.15)',
              minWidth: '380px',
              maxWidth: '420px',
              maxHeight: '600px',
              overflowY: 'auto',
              zIndex: 10000,
              animation: 'fadeInDown 0.3s ease-out'
            }}
            onClick={(e) => e.stopPropagation()}
          >
          <div style={{ 
            padding: 'var(--space-5)', 
            borderBottom: '2px solid var(--gray-100)', 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            background: 'linear-gradient(135deg, var(--gray-50) 0%, var(--bg-primary) 100%)',
            borderRadius: 'var(--radius-2xl) var(--radius-2xl) 0 0'
          }}>
            <strong style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-bold)', color: 'var(--text-primary)' }}>الإشعارات</strong>
            {unreadCount > 0 && (
              <button 
                className="modern-header-action-btn"
                style={{ 
                  height: '32px',
                  padding: '0 var(--space-3)',
                  fontSize: 'var(--text-xs)',
                  background: 'var(--primary-500)',
                  color: 'white',
                  border: 'none'
                }} 
                onClick={markAllAsRead}
              >
                تحديد الكل كمقروء
              </button>
            )}
          </div>
          {notifications.length === 0 ? (
            <div style={{ 
              padding: 'var(--space-12)', 
              textAlign: 'center', 
              color: 'var(--text-secondary)',
              fontSize: 'var(--text-base)'
            }}>
              لا توجد إشعارات جديدة
            </div>
          ) : (
            <div>
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  style={{
                    padding: 'var(--space-5)',
                    borderBottom: '1px solid var(--gray-100)',
                    cursor: 'pointer',
                    background: notification.status === 'unread' ? 'var(--primary-50)' : 'white',
                    transition: 'all var(--transition-base)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = notification.status === 'unread' ? 'var(--primary-100)' : 'var(--gray-50)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = notification.status === 'unread' ? 'var(--primary-50)' : 'white';
                  }}
                  onClick={() => {
                    if (notification.status === 'unread') {
                      markAsRead(notification.id);
                    }
                  }}
                >
                  <div style={{ 
                    fontWeight: notification.status === 'unread' ? 'var(--font-bold)' : 'var(--font-medium)',
                    fontSize: 'var(--text-base)',
                    color: 'var(--text-primary)',
                    marginBottom: 'var(--space-2)'
                  }}>
                    {notification.status === 'unread' && (
                      <span style={{
                        display: 'inline-block',
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: 'var(--primary-500)',
                        marginLeft: 'var(--space-2)',
                        verticalAlign: 'middle'
                      }}></span>
                    )}
                    {notification.title}
                  </div>
                  <div style={{ 
                    fontSize: 'var(--text-sm)', 
                    color: 'var(--text-secondary)', 
                    marginBottom: 'var(--space-2)',
                    lineHeight: 'var(--line-height-relaxed)'
                  }}>
                    {notification.message}
                  </div>
                  <div style={{ 
                    fontSize: 'var(--text-xs)', 
                    color: 'var(--text-tertiary)'
                  }}>
                    {new Date(notification.created_at).toLocaleString('ar-SA')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        </>
      )}
    </div>
  );
};

export default NotificationBell;
