import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Form, Input, Button, Card, Typography, Alert, Space, Divider, Tag } from 'antd';
import { UserOutlined, LockOutlined, MedicineBoxOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { useAuth } from '../../context/AuthContext';
import './Login.css';

const { Title, Text, Paragraph } = Typography;

const Login: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form] = Form.useForm();

  const handleSubmit = async (values: { username: string; password: string }) => {
    setError('');
    setLoading(true);

    try {
      await login(values.username, values.password);
      const role = values.username === 'admin' ? 'admin' :
                   values.username === 'inquiry' ? 'inquiry' : 
                   values.username === 'lab' ? 'lab' : 
                   values.username === 'pharmacist' ? 'pharmacist' : 
                   values.username === 'doctor' ? 'doctor' : 'inquiry';
      
      navigate(`/${role === 'pharmacist' ? 'pharmacist' : role}`);
    } catch (err: any) {
      setError(err.message || 'فشل تسجيل الدخول. تحقق من بيانات الاعتماد');
    } finally {
      setLoading(false);
    }
  };

  const quickLogin = (username: string, password: string) => {
    form.setFieldsValue({ username, password });
    form.submit();
  };

  return (
    <div className="login-container">
      <div className="login-background">
        <div className="login-gradient-overlay" />
        <div className="login-shapes">
          <div className="shape shape-1" />
          <div className="shape shape-2" />
          <div className="shape shape-3" />
        </div>
      </div>

      <div className="login-content">
        <Card 
          className="login-card"
          variant="borderless"
          style={{
            boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
            borderRadius: '16px',
            overflow: 'hidden'
          }}
        >
          <div className="login-card-header">
            <div className="login-logo">
              <MedicineBoxOutlined style={{ fontSize: '48px', color: '#1890ff' }} />
            </div>
            <Title level={2} style={{ margin: '16px 0 8px', textAlign: 'center' }}>
              مستشفى الحكيم
            </Title>
            <Paragraph style={{ textAlign: 'center', marginBottom: 0, color: '#8c8c8c' }}>
              شعبة الكلية الصناعية
            </Paragraph>
            <Tag 
              icon={<SafetyCertificateOutlined />} 
              color="blue" 
              style={{ marginTop: '12px' }}
            >
              نظام إدارة طبي متكامل
            </Tag>
          </div>

          <Divider style={{ margin: '24px 0' }} />

          {error && (
            <Alert
              message="خطأ في تسجيل الدخول"
              description={error}
              type="error"
              showIcon
              closable
              onClose={() => setError('')}
              style={{ marginBottom: '24px' }}
            />
          )}

          <Form
            form={form}
            name="login"
            onFinish={handleSubmit}
            layout="vertical"
            size="large"
            autoComplete="off"
          >
            <Form.Item
              name="username"
              rules={[
                { required: true, message: 'يرجى إدخال اسم المستخدم' },
                { min: 3, message: 'اسم المستخدم يجب أن يكون 3 أحرف على الأقل' }
              ]}
            >
              <Input
                prefix={<UserOutlined style={{ color: '#bfbfbf' }} />}
                placeholder="اسم المستخدم"
                autoFocus
              />
            </Form.Item>

            <Form.Item
              name="password"
              rules={[
                { required: true, message: 'يرجى إدخال كلمة المرور' },
                { min: 6, message: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' }
              ]}
            >
              <Input.Password
                prefix={<LockOutlined style={{ color: '#bfbfbf' }} />}
                placeholder="كلمة المرور"
              />
            </Form.Item>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                block
                size="large"
                style={{
                  height: '48px',
                  fontSize: '16px',
                  fontWeight: 600,
                  borderRadius: '8px'
                }}
              >
                {loading ? 'جاري تسجيل الدخول...' : 'تسجيل الدخول'}
              </Button>
            </Form.Item>
          </Form>

          <Divider style={{ margin: '24px 0' }}>
            <Text type="secondary" style={{ fontSize: '14px' }}>حسابات تجريبية</Text>
          </Divider>

          <div className="quick-login-buttons">
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <Button
                type="default"
                block
                onClick={() => quickLogin('admin', 'admin123')}
                style={{ textAlign: 'right', height: '40px' }}
              >
                <Space>
                  <Tag color="red">مدير</Tag>
                  <Text>admin / admin123</Text>
                </Space>
              </Button>
              <Button
                type="default"
                block
                onClick={() => quickLogin('inquiry', 'inquiry123')}
                style={{ textAlign: 'right', height: '40px' }}
              >
                <Space>
                  <Tag color="blue">استعلامات</Tag>
                  <Text>inquiry / inquiry123</Text>
                </Space>
              </Button>
              <Button
                type="default"
                block
                onClick={() => quickLogin('lab', 'lab123')}
                style={{ textAlign: 'right', height: '40px' }}
              >
                <Space>
                  <Tag color="green">تحاليل</Tag>
                  <Text>lab / lab123</Text>
                </Space>
              </Button>
              <Button
                type="default"
                block
                onClick={() => quickLogin('pharmacist', 'pharmacist123')}
                style={{ textAlign: 'right', height: '40px' }}
              >
                <Space>
                  <Tag color="orange">صيدلية</Tag>
                  <Text>pharmacist / pharmacist123</Text>
                </Space>
              </Button>
              <Button
                type="default"
                block
                onClick={() => quickLogin('doctor', 'doctor123')}
                style={{ textAlign: 'right', height: '40px' }}
              >
                <Space>
                  <Tag color="purple">طبيب</Tag>
                  <Text>doctor / doctor123</Text>
                </Space>
              </Button>
            </Space>
          </div>

          <div style={{ marginTop: '24px', textAlign: 'center' }}>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              نظام آمن ومشفر • جميع الحقوق محفوظة © 2024
            </Text>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Login;
