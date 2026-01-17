import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Form, Input, Button, Typography, Alert, Space, Row, Col } from 'antd';
import { 
  UserOutlined, 
  LockOutlined,
  SafetyCertificateOutlined,
  MedicineBoxOutlined,
  TeamOutlined,
  FileTextOutlined,
  ExperimentOutlined,
  ShoppingOutlined,
  HeartOutlined,
  SecurityScanOutlined,
  RocketOutlined,
  CheckCircleOutlined
} from '@ant-design/icons';
import { useAuth } from '../../context/AuthContext';
import './LoginModern.css';

const { Title, Text, Paragraph } = Typography;

const LoginModern: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [currentFeature, setCurrentFeature] = useState(0);

  const features = [
    {
      icon: <TeamOutlined />,
      title: 'إدارة المرضى',
      description: 'نظام شامل لإدارة بيانات المرضى والسجلات الطبية'
    },
    {
      icon: <ExperimentOutlined />,
      title: 'المختبر',
      description: 'إدارة التحاليل المخبرية والنتائج بشكل احترافي'
    },
    {
      icon: <ShoppingOutlined />,
      title: 'الصيدلية',
      description: 'نظام متكامل لإدارة الأدوية والوصفات الطبية'
    },
    {
      icon: <HeartOutlined />,
      title: 'التشخيص الطبي',
      description: 'تسجيل التشخيصات والملاحظات الطبية بسهولة'
    },
    {
      icon: <FileTextOutlined />,
      title: 'التقارير الشاملة',
      description: 'تقارير طبية مفصلة ومطبوعة للمرضى'
    },
    {
      icon: <SecurityScanOutlined />,
      title: 'الأمان والحماية',
      description: 'نظام آمن ومشفر لحماية البيانات الحساسة'
    }
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentFeature((prev) => (prev + 1) % features.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = async (values: { username: string; password: string }) => {
    setError('');
    setLoading(true);

    try {
      await login(values.username, values.password);
      
      // Get dashboard route based on user role
      const getDashboardRoute = (role: string): string => {
        switch (role) {
          case 'admin':
            return '/admin';
          case 'inquiry':
            return '/inquiry';
          case 'lab':
          case 'lab_manager':
            return '/lab';
          case 'pharmacist':
          case 'pharmacy_manager':
            return '/pharmacist';
          case 'doctor':
            return '/doctor';
          default:
            return '/login';
        }
      };

      // Wait a bit for state to update, then navigate
      setTimeout(() => {
        // Navigate to root, which will redirect based on user state
        navigate('/', { replace: true });
      }, 100);
    } catch (err: any) {
      setError(err.message || 'فشل تسجيل الدخول. تحقق من بيانات الاعتماد');
      setLoading(false);
    }
  };

  return (
    <div className="login-modern-container">
      {/* Animated Background */}
      <div className="login-modern-background">
        <div className="gradient-mesh"></div>
        <div className="floating-shapes">
          <div className="shape shape-1"></div>
          <div className="shape shape-2"></div>
          <div className="shape shape-3"></div>
          <div className="shape shape-4"></div>
        </div>
        <div className="particles-layer">
          {[...Array(50)].map((_, i) => (
            <div key={i} className="particle" style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 8}s`,
              animationDuration: `${12 + Math.random() * 8}s`
            }}></div>
          ))}
        </div>
      </div>

      {/* Main Content - Horizontal Layout */}
      <div className="login-modern-content">
        <Row gutter={0} className="login-row">
          {/* Left Side - Branding & Features */}
          <Col xs={24} lg={14} className="login-left-panel">
            <div className="login-branding-section">
              {/* Logo */}
              <div className="login-logo-container">
                <div className="logo-glow-effect"></div>
                <img 
                  src="/images/ministry-logo.png" 
                  alt="شعار وزارة الصحة العراقية"
                  className="login-logo-img"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    const fallback = target.nextElementSibling as HTMLElement;
                    if (fallback) fallback.style.display = 'flex';
                  }}
                />
                <div className="login-logo-fallback" style={{ display: 'none' }}>
                  🏥
                </div>
              </div>

              {/* Ministry Info */}
              <div className="ministry-info">
                <Title level={1} className="ministry-title">
                  وزارة الصحة العراقية
                </Title>
                <Title level={3} className="directorate-title">
                  دائرة صحة النجف الاشرف
                </Title>
                <Title level={4} className="hospital-title">
                  مستشفى الحكيم العام
                </Title>
                <Text className="subtitle-text">
                  شعبة الكلية الصناعية
                </Text>
              </div>

              {/* System Description */}
              <div className="system-description">
                <div className="description-icon">
                  <RocketOutlined />
                </div>
                <Title level={4} className="description-title">
                  نظام إدارة طبي متكامل
                </Title>
                <Paragraph className="description-text">
                  نظام متطور وشامل لإدارة جميع العمليات الطبية في المستشفى، 
                  من تسجيل المرضى إلى إدارة التحاليل والصيدلية والتشخيصات الطبية. 
                  يوفر النظام واجهة سهلة الاستخدام وأمان عالي لحماية البيانات الحساسة.
                </Paragraph>
              </div>

              {/* Features Carousel */}
              <div className="features-carousel">
                <div className="features-wrapper">
                  {features.map((feature, index) => (
                    <div
                      key={index}
                      className={`feature-card ${index === currentFeature ? 'active' : ''}`}
                    >
                      <div className="feature-icon">{feature.icon}</div>
                      <Title level={5} className="feature-title">
                        {feature.title}
                      </Title>
                      <Text className="feature-description">
                        {feature.description}
                      </Text>
                    </div>
                  ))}
                </div>
                <div className="feature-indicators">
                  {features.map((_, index) => (
                    <div
                      key={index}
                      className={`indicator ${index === currentFeature ? 'active' : ''}`}
                      onClick={() => setCurrentFeature(index)}
                    ></div>
                  ))}
                </div>
              </div>
            </div>
          </Col>

          {/* Right Side - Login Form */}
          <Col xs={24} lg={10} className="login-right-panel">
            <div className="login-form-container">
              <div className="login-form-card">
                {/* Form Header */}
                <div className="form-header">
                  <div className="form-logo-wrapper">
                    <div className="form-logo-glow"></div>
                    <img 
                      src="/images/ministry-logo.png" 
                      alt="شعار وزارة الصحة العراقية"
                      className="form-logo-img"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        const fallback = target.nextElementSibling as HTMLElement;
                        if (fallback) fallback.style.display = 'flex';
                      }}
                    />
                    <div className="form-logo-fallback" style={{ display: 'none' }}>
                      🏥
                    </div>
                  </div>
                  <Title level={2} className="form-title">
                    تسجيل الدخول
                  </Title>
                  <Text className="form-subtitle">
                    أدخل بيانات الاعتماد للوصول إلى النظام
                  </Text>
                </div>

                {/* Error Alert */}
                {error && (
                  <Alert
                    message="خطأ في تسجيل الدخول"
                    description={error}
                    type="error"
                    showIcon
                    closable
                    onClose={() => setError('')}
                    className="error-alert"
                  />
                )}

                {/* Login Form */}
                <Form
                  form={form}
                  name="login"
                  onFinish={handleSubmit}
                  layout="vertical"
                  size="large"
                  className="login-form"
                  autoComplete="off"
                >
                  <Form.Item
                    name="username"
                    rules={[{ required: true, message: 'يرجى إدخال اسم المستخدم' }]}
                  >
                    <Input
                      prefix={<UserOutlined className="input-icon" />}
                      placeholder="اسم المستخدم"
                      className="modern-input"
                      autoFocus
                    />
                  </Form.Item>

                  <Form.Item
                    name="password"
                    rules={[{ required: true, message: 'يرجى إدخال كلمة المرور' }]}
                  >
                    <Input.Password
                      prefix={<LockOutlined className="input-icon" />}
                      placeholder="كلمة المرور"
                      className="modern-input"
                    />
                  </Form.Item>

                  <Form.Item>
                    <Button
                      type="primary"
                      htmlType="submit"
                      loading={loading}
                      block
                      className="submit-button"
                      size="large"
                      icon={!loading && <RocketOutlined />}
                    >
                      {loading ? 'جاري تسجيل الدخول...' : 'تسجيل الدخول'}
                    </Button>
                  </Form.Item>
                </Form>

                {/* Security Features */}
                <div className="security-features">
                  <Space size="middle" className="security-badges">
                    <div className="security-badge">
                      <SecurityScanOutlined />
                      <Text>آمن</Text>
                    </div>
                    <div className="security-badge">
                      <CheckCircleOutlined />
                      <Text>موثوق</Text>
                    </div>
                    <div className="security-badge">
                      <MedicineBoxOutlined />
                      <Text>احترافي</Text>
                    </div>
                  </Space>
                </div>
              </div>

              {/* Footer */}
              <div className="login-footer">
                <Text className="footer-text">
                  © 2026 مستشفى الحكيم العام - جميع الحقوق محفوظة
                </Text>
                <Text className="footer-version">
                  نظام إدارة طبي متكامل v2.0
                </Text>
              </div>
            </div>
          </Col>
        </Row>
      </div>
    </div>
  );
};

export default LoginModern;
