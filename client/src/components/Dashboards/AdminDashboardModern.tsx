import React, { useState, useEffect } from 'react';
import {
  Layout,
  Card,
  Row,
  Col,
  Statistic,
  Table,
  Tag,
  Button,
  Space,
  Typography,
  Tabs,
  Badge,
  Avatar,
  Tooltip,
  Modal,
  Form,
  Input,
  Select,
  Switch,
  message,
  Empty,
  Spin,
  DatePicker,
  Progress
} from 'antd';
import {
  UserOutlined,
  TeamOutlined,
  FileTextOutlined,
  MedicineBoxOutlined,
  ExperimentOutlined,
  AuditOutlined,
  BellOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  ReloadOutlined,
  ExportOutlined,
  SearchOutlined,
  CalendarOutlined,
  DashboardOutlined,
  SettingOutlined,
  LogoutOutlined,
  TrophyOutlined,
  RiseOutlined,
  FallOutlined,
  FileSearchOutlined,
  ClockCircleOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import NotificationBell from '../Notifications/NotificationBell';
import WelcomeMessage from '../Welcome/WelcomeMessage';
import PatientSearchModal from '../Common/PatientSearchModal';
import { Stats, Visit, Patient, UserEnhanced, ActivityLog } from '../../types';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { formatBaghdadDate, formatBaghdadTime } from '../../utils/dayjs-config';
import './AdminDashboardModern.css';
import '../Welcome/WelcomeMessage.css';
import ModernHeaderWithLogo from '../Layout/ModernHeaderWithLogo';

const { Content } = Layout;
const { Title, Text, Paragraph } = Typography;
const { TabPane } = Tabs;

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

const AdminDashboardModern: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [users, setUsers] = useState<UserEnhanced[]>([]);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [userModalVisible, setUserModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserEnhanced | null>(null);
  const [patientSearchVisible, setPatientSearchVisible] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchDashboardData();
  }, [activeTab]);

  // Hide header when modals are open
  useEffect(() => {
    if (userModalVisible || patientSearchVisible) {
      const header = document.querySelector('.modern-header, .modern-header-with-logo');
      if (header) {
        (header as HTMLElement).style.display = 'none';
      }
    } else {
      const header = document.querySelector('.modern-header, .modern-header-with-logo');
      if (header) {
        (header as HTMLElement).style.display = '';
      }
    }
    
    return () => {
      // Show header when modals close
      const header = document.querySelector('.modern-header, .modern-header-with-logo');
      if (header) {
        (header as HTMLElement).style.display = '';
      }
    };
  }, [userModalVisible, patientSearchVisible]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'overview') {
        const statsRes = await axios.get('/api/admin/dashboard/stats');
        setStats(statsRes.data);
      } else if (activeTab === 'visits') {
        const visitsRes = await axios.get('/api/admin/visits');
        setVisits(visitsRes.data);
      } else if (activeTab === 'patients') {
        const patientsRes = await axios.get('/api/admin/patients');
        setPatients(patientsRes.data);
      } else if (activeTab === 'users') {
        const usersRes = await axios.get('/api/users');
        setUsers(usersRes.data);
      } else if (activeTab === 'activity') {
        const activityRes = await axios.get('/api/admin/activity-log');
        setActivities(activityRes.data);
      }
    } catch (error: any) {
      message.error(error.response?.data?.error || 'حدث خطأ أثناء جلب البيانات');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: { [key: string]: string } = {
      pending_lab: 'orange',
      pending_pharmacy: 'blue',
      pending_doctor: 'purple',
      completed: 'green',
      pending_inquiry: 'cyan'
    };
    return colors[status] || 'default';
  };

  const getStatusText = (status: string) => {
    const texts: { [key: string]: string } = {
      pending_lab: 'بانتظار التحاليل',
      pending_pharmacy: 'بانتظار الصيدلية',
      pending_doctor: 'بانتظار الطبيب',
      completed: 'مكتملة',
      pending_inquiry: 'بانتظار الاستعلامات'
    };
    return texts[status] || status;
  };

  const getRoleColor = (role: string) => {
    const colors: { [key: string]: string } = {
      admin: 'red',
      inquiry: 'blue',
      lab: 'green',
      lab_manager: 'cyan',
      pharmacist: 'orange',
      pharmacy_manager: 'gold',
      doctor: 'purple'
    };
    return colors[role] || 'default';
  };

  const getRoleText = (role: string) => {
    const texts: { [key: string]: string } = {
      admin: 'مدير',
      inquiry: 'استعلامات',
      lab: 'تحاليل',
      lab_manager: 'مدير المختبر',
      pharmacist: 'صيدلية',
      pharmacy_manager: 'مدير الصيدلية',
      doctor: 'طبيب'
    };
    return texts[role] || role;
  };

  // Visit trends chart data
  const visitTrendsData = stats?.visit_trends?.map(item => ({
    date: formatBaghdadDate(item.date),
    visits: item.count
  })) || [];

  // Department performance chart data
  const departmentData = stats?.department_performance ? [
    { name: 'التحاليل', completed: stats.department_performance.lab.completed, pending: stats.department_performance.lab.pending },
    { name: 'الصيدلية', completed: stats.department_performance.pharmacy.completed, pending: stats.department_performance.pharmacy.pending },
    { name: 'الطبيب', completed: stats.department_performance.doctor.completed, pending: stats.department_performance.doctor.pending }
  ] : [];

  // Status distribution for pie chart
  const statusDistribution = visits.reduce((acc: any, visit) => {
    acc[visit.status] = (acc[visit.status] || 0) + 1;
    return acc;
  }, {});

  const pieData = Object.entries(statusDistribution).map(([key, value]) => ({
    name: getStatusText(key),
    value
  }));

  // Visit columns
  const visitColumns: ColumnsType<Visit> = [
    {
      title: 'رقم الزيارة',
      dataIndex: 'visit_number',
      key: 'visit_number',
      sorter: (a, b) => a.visit_number.localeCompare(b.visit_number),
    },
    {
      title: 'المريض',
      dataIndex: 'patient_name',
      key: 'patient_name',
      sorter: (a, b) => (a.patient_name || '').localeCompare(b.patient_name || ''),
    },
    {
      title: 'الحالة',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={getStatusColor(status)}>{getStatusText(status)}</Tag>
      ),
      filters: [
        { text: 'بانتظار التحاليل', value: 'pending_lab' },
        { text: 'بانتظار الصيدلية', value: 'pending_pharmacy' },
        { text: 'بانتظار الطبيب', value: 'pending_doctor' },
        { text: 'مكتملة', value: 'completed' },
      ],
      onFilter: (value, record) => record.status === value,
    },
    {
      title: 'التاريخ',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm'),
      sorter: (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    },
    {
      title: 'الإجراءات',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Tooltip title="عرض التفاصيل">
            <Button type="link" icon={<EyeOutlined />} size="small" />
          </Tooltip>
        </Space>
      ),
    },
  ];

  // User columns
  const userColumns: ColumnsType<UserEnhanced> = [
    {
      title: 'المستخدم',
      key: 'user',
      render: (_, record) => (
        <Space>
          <Avatar icon={<UserOutlined />} style={{ backgroundColor: '#1890ff' }} />
          <div>
            <div style={{ fontWeight: 600 }}>{record.name}</div>
            <Text type="secondary" style={{ fontSize: '12px' }}>@{record.username}</Text>
          </div>
        </Space>
      ),
    },
    {
      title: 'الدور',
      dataIndex: 'role',
      key: 'role',
      render: (role: string) => (
        <Tag color={getRoleColor(role)}>{getRoleText(role)}</Tag>
      ),
      filters: [
        { text: 'مدير', value: 'admin' },
        { text: 'استعلامات', value: 'inquiry' },
        { text: 'تحاليل', value: 'lab' },
        { text: 'مدير المختبر', value: 'lab_manager' },
        { text: 'صيدلية', value: 'pharmacist' },
        { text: 'مدير الصيدلية', value: 'pharmacy_manager' },
        { text: 'طبيب', value: 'doctor' },
      ],
      onFilter: (value, record) => record.role === value,
    },
    {
      title: 'البريد الإلكتروني',
      dataIndex: 'email',
      key: 'email',
      render: (email: string) => email || <Text type="secondary">-</Text>,
    },
    {
      title: 'الحالة',
      dataIndex: 'is_active',
      key: 'is_active',
      render: (isActive: number) => (
        <Badge status={isActive ? 'success' : 'default'} text={isActive ? 'نشط' : 'غير نشط'} />
      ),
      filters: [
        { text: 'نشط', value: 1 },
        { text: 'غير نشط', value: 0 },
      ],
      onFilter: (value, record) => record.is_active === value,
    },
    {
      title: 'تاريخ الإنشاء',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date: string) => formatBaghdadDate(date),
      sorter: (a, b) => {
        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return dateA - dateB;
      },
    },
    {
      title: 'الإجراءات',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Tooltip title="تعديل">
            <Button type="link" icon={<EditOutlined />} size="small" onClick={() => handleEditUser(record)} />
          </Tooltip>
          <Tooltip title="حذف">
            <Button type="link" danger icon={<DeleteOutlined />} size="small" onClick={() => handleDeleteUser(record.id)} />
          </Tooltip>
        </Space>
      ),
    },
  ];

  const handleEditUser = (user: UserEnhanced) => {
    setSelectedUser(user);
    form.setFieldsValue({
      username: user.username,
      name: user.name,
      role: user.role,
      email: user.email,
      phone: user.phone,
      is_active: user.is_active === 1,
    });
    setUserModalVisible(true);
  };

  const handleDeleteUser = async (userId: number) => {
    Modal.confirm({
      title: 'تأكيد الحذف',
      content: 'هل أنت متأكد من حذف هذا المستخدم؟',
      okText: 'نعم',
      cancelText: 'لا',
      onOk: async () => {
        try {
          await axios.delete(`/api/users/${userId}`);
          message.success('تم حذف المستخدم بنجاح');
          fetchDashboardData();
        } catch (error: any) {
          message.error(error.response?.data?.error || 'حدث خطأ أثناء حذف المستخدم');
        }
      },
    });
  };

  const handleCreateUser = () => {
    setSelectedUser(null);
    form.resetFields();
    setUserModalVisible(true);
  };

  const handleUserSubmit = async (values: any) => {
    try {
      const payload = {
        ...values,
        is_active: values.is_active ? 1 : 0
      };
      
      if (selectedUser) {
        // Don't send password if it's empty (for update)
        if (!payload.password || payload.password.trim() === '') {
          delete payload.password;
        }
        const response = await axios.put(`/api/users/${selectedUser.id}`, payload);
        // Only show error if response status is error or has explicit error field
        if (response.status >= 400 || response.data?.error) {
          message.error(response.data?.error || 'حدث خطأ أثناء تحديث المستخدم');
          return;
        }
        message.success(response.data?.message || 'تم تحديث المستخدم بنجاح');
      } else {
        if (!values.password) {
          message.error('يرجى إدخال كلمة المرور');
          return;
        }
        const response = await axios.post('/api/users', payload);
        // Only show error if response status is error or has explicit error field
        if (response.status >= 400 || response.data?.error) {
          message.error(response.data?.error || 'حدث خطأ أثناء إنشاء المستخدم');
          return;
        }
        message.success(response.data?.message || 'تم إنشاء المستخدم بنجاح');
      }
      setUserModalVisible(false);
      form.resetFields();
      setSelectedUser(null);
      fetchDashboardData();
    } catch (error: any) {
      // Only show error if it's a real HTTP error (status >= 400)
      if (error.response?.status >= 400) {
        const errorMessage = error.response?.data?.error || error.message || 'حدث خطأ أثناء حفظ المستخدم';
        message.error(errorMessage);
      } else if (error.response?.status >= 200 && error.response?.status < 300) {
        // Success response - don't show error even if there's an error field
        // This handles cases where activityLogger might have issues but operation succeeded
        if (error.response?.data?.message) {
          message.success(error.response.data.message);
        }
        setUserModalVisible(false);
        form.resetFields();
        setSelectedUser(null);
        fetchDashboardData();
      } else {
        // Network or other errors
        console.error('Error saving user:', error);
        message.error(error.message || 'حدث خطأ أثناء حفظ المستخدم');
      }
    }
  };

  const getRoleName = (role?: string) => {
    const roleNames: { [key: string]: string } = {
      'lab': 'موظف التحليلات المخبرية',
      'lab_manager': 'مدير المختبر',
      'pharmacist': 'الصيدلي',
      'pharmacy_manager': 'مدير الصيدلية',
      'doctor': 'الطبيب',
      'inquiry': 'موظف الاستعلامات',
      'admin': 'المدير'
    };
    return roleNames[role || ''] || role || 'مستخدم';
  };

  return (
    <Layout className="admin-dashboard-layout">
      <ModernHeaderWithLogo
        roleName={getRoleName(user?.role)}
        user={user}
        onLogout={logout}
        className="admin-header"
        centerActions={
          <>
            <button
              className="modern-header-action-btn"
              onClick={() => setPatientSearchVisible(true)}
            >
              <FileTextOutlined />
              <span>التقرير الشامل</span>
            </button>
          </>
        }
      />

      <Content className="admin-dashboard-content">
        <WelcomeMessage />
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          size="large"
          style={{ marginBottom: '24px' }}
        >
          <TabPane
            tab={
              <span>
                <DashboardOutlined />
                نظرة عامة
              </span>
            }
            key="overview"
          >
            {loading ? (
              <div style={{ textAlign: 'center', padding: '100px' }}>
                <Spin size="large" />
              </div>
            ) : stats ? (
              <>
                <Row gutter={[20, 20]} style={{ marginBottom: '32px' }}>
                  <Col xs={24} sm={12} lg={6}>
                    <Card className="stats-card-modern">
                      <div className="stats-card-icon">
                        <TeamOutlined />
                      </div>
                      <div className="stats-card-value">{stats.total_patients}</div>
                      <div className="stats-card-title">إجمالي المرضى</div>
                      <Progress
                        percent={100}
                        showInfo={false}
                        strokeColor="#667eea"
                        className="modern-progress"
                        style={{ marginTop: '12px' }}
                      />
                    </Card>
                  </Col>
                  <Col xs={24} sm={12} lg={6}>
                    <Card className="stats-card-modern">
                      <div className="stats-card-icon">
                        <FileTextOutlined />
                      </div>
                      <div className="stats-card-value">{stats.total_visits}</div>
                      <div className="stats-card-title">إجمالي الزيارات</div>
                      <Progress
                        percent={100}
                        showInfo={false}
                        strokeColor="#764ba2"
                        className="modern-progress"
                        style={{ marginTop: '12px' }}
                      />
                    </Card>
                  </Col>
                  <Col xs={24} sm={12} lg={6}>
                    <Card className="stats-card-modern">
                      <div className="stats-card-icon">
                        <CalendarOutlined />
                      </div>
                      <div className="stats-card-value">{stats.today_visits}</div>
                      <div className="stats-card-title">زيارات اليوم</div>
                      {stats.this_week_visits && (
                        <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginTop: '8px' }}>
                          {stats.this_week_visits} أسبوعياً
                        </Text>
                      )}
                    </Card>
                  </Col>
                  <Col xs={24} sm={12} lg={6}>
                    <Card className="stats-card-modern">
                      <div className="stats-card-icon">
                        <TrophyOutlined />
                      </div>
                      <div className="stats-card-value">{stats.completed_visits}</div>
                      <div className="stats-card-title">زيارات مكتملة</div>
                      {stats.total_visits > 0 && (
                        <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginTop: '8px' }}>
                          {Math.round((stats.completed_visits / stats.total_visits) * 100)}% من الإجمالي
                        </Text>
                      )}
                    </Card>
                  </Col>
                </Row>

                <Row gutter={[20, 20]} style={{ marginBottom: '32px' }}>
                  <Col xs={24} sm={12} lg={8}>
                    <Card className="modern-card">
                      <div className="modern-card-title">
                        <ClockCircleOutlined /> بانتظار المعالجة
                      </div>
                      <Tag color="orange" style={{ marginBottom: '20px', fontSize: '14px', padding: '4px 12px' }}>
                        {stats.pending_lab + stats.pending_pharmacy + stats.pending_doctor} زيارة
                      </Tag>
                      <Space direction="vertical" size="large" style={{ width: '100%' }}>
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <Text strong>التحاليل:</Text>
                            <Text type="secondary">{stats.pending_lab} زيارة</Text>
                          </div>
                          <Progress
                            percent={stats.total_visits > 0 ? (stats.pending_lab / stats.total_visits) * 100 : 0}
                            status="active"
                            strokeColor="#fa8c16"
                            className="modern-progress"
                          />
                        </div>
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <Text strong>الصيدلية:</Text>
                            <Text type="secondary">{stats.pending_pharmacy} زيارة</Text>
                          </div>
                          <Progress
                            percent={stats.total_visits > 0 ? (stats.pending_pharmacy / stats.total_visits) * 100 : 0}
                            status="active"
                            strokeColor="#1890ff"
                            className="modern-progress"
                          />
                        </div>
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <Text strong>الطبيب:</Text>
                            <Text type="secondary">{stats.pending_doctor} زيارة</Text>
                          </div>
                          <Progress
                            percent={stats.total_visits > 0 ? (stats.pending_doctor / stats.total_visits) * 100 : 0}
                            status="active"
                            strokeColor="#722ed1"
                            className="modern-progress"
                          />
                        </div>
                      </Space>
                    </Card>
                  </Col>
                  <Col xs={24} sm={12} lg={8}>
                    <Card className="chart-container-modern">
                      <div className="chart-title">
                        <RiseOutlined /> اتجاهات الزيارات (آخر 7 أيام)
                      </div>
                      {visitTrendsData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={200}>
                          <AreaChart data={visitTrendsData}>
                            <defs>
                              <linearGradient id="colorVisits" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#667eea" stopOpacity={0.8} />
                                <stop offset="95%" stopColor="#764ba2" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis dataKey="date" stroke="#6b7280" />
                            <YAxis stroke="#6b7280" />
                            <RechartsTooltip 
                              contentStyle={{ 
                                borderRadius: '8px', 
                                border: '1px solid #e5e7eb',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                              }} 
                            />
                            <Area
                              type="monotone"
                              dataKey="visits"
                              stroke="#667eea"
                              strokeWidth={2}
                              fillOpacity={1}
                              fill="url(#colorVisits)"
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="modern-empty">
                          <Empty description="لا توجد بيانات" />
                        </div>
                      )}
                    </Card>
                  </Col>
                  <Col xs={24} sm={12} lg={8}>
                    <Card className="chart-container-modern">
                      <div className="chart-title">توزيع الحالات</div>
                      {pieData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={200}>
                          <PieChart>
                            <Pie
                              data={pieData}
                              cx="50%"
                              cy="50%"
                              labelLine={false}
                              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                              outerRadius={80}
                              fill="#8884d8"
                              dataKey="value"
                            >
                              {pieData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <RechartsTooltip 
                              contentStyle={{ 
                                borderRadius: '8px', 
                                border: '1px solid #e5e7eb',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                              }} 
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="modern-empty">
                          <Empty description="لا توجد بيانات" />
                        </div>
                      )}
                    </Card>
                  </Col>
                </Row>

                {departmentData.length > 0 && (
                  <Row gutter={[20, 20]}>
                    <Col xs={24}>
                      <Card className="chart-container-modern">
                        <div className="chart-title">أداء الأقسام</div>
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart data={departmentData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis dataKey="name" stroke="#6b7280" />
                            <YAxis stroke="#6b7280" />
                            <RechartsTooltip 
                              contentStyle={{ 
                                borderRadius: '8px', 
                                border: '1px solid #e5e7eb',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                              }} 
                            />
                            <Legend 
                              wrapperStyle={{ paddingTop: '20px' }}
                            />
                            <Bar dataKey="completed" fill="#52c41a" name="مكتمل" radius={[8, 8, 0, 0]} />
                            <Bar dataKey="pending" fill="#fa8c16" name="بانتظار" radius={[8, 8, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </Card>
                    </Col>
                  </Row>
                )}
              </>
            ) : (
              <Empty description="لا توجد بيانات" />
            )}
          </TabPane>

          <TabPane
            tab={
              <span>
                <FileTextOutlined />
                الزيارات
              </span>
            }
            key="visits"
          >
            <Card
              extra={
                <Space>
                  <Button icon={<ReloadOutlined />} onClick={fetchDashboardData}>
                    تحديث
                  </Button>
                  <Button icon={<ExportOutlined />} type="primary">
                    تصدير
                  </Button>
                </Space>
              }
            >
              <Table
                columns={visitColumns}
                dataSource={visits}
                rowKey="id"
                loading={loading}
                pagination={{ pageSize: 10, showSizeChanger: true }}
              />
            </Card>
          </TabPane>

          <TabPane
            tab={
              <span>
                <TeamOutlined />
                المرضى
              </span>
            }
            key="patients"
          >
            <Card
              className="modern-table-container"
              extra={
                <Button 
                  icon={<ExportOutlined />} 
                  type="primary"
                  className="modern-button modern-button-primary"
                  onClick={() => window.open('/api/export/patients/excel', '_blank')}
                >
                  تصدير Excel
                </Button>
              }
            >
              <Table
                dataSource={patients}
                rowKey="id"
                loading={loading}
                pagination={{ 
                  pageSize: 10, 
                  showSizeChanger: true,
                  showTotal: (total) => `إجمالي ${total} مريض`
                }}
                columns={[
                  { title: 'الاسم', dataIndex: 'name', key: 'name' },
                  { title: 'رقم الهوية', dataIndex: 'national_id', key: 'national_id' },
                  { title: 'العمر', dataIndex: 'age', key: 'age' },
                  { title: 'الجنس', dataIndex: 'gender', key: 'gender' },
                  {
                    title: 'تاريخ التسجيل',
                    dataIndex: 'created_at',
                    key: 'created_at',
                    render: (date: string) => formatBaghdadDate(date),
                  },
                ]}
                className="modern-table"
              />
            </Card>
          </TabPane>

          <TabPane
            tab={
              <span>
                <UserOutlined />
                المستخدمون
              </span>
            }
            key="users"
          >
            <Card
              extra={
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={handleCreateUser}
                >
                  إضافة مستخدم
                </Button>
              }
            >
              <Table
                columns={userColumns}
                dataSource={users}
                rowKey="id"
                loading={loading}
                pagination={{ pageSize: 10, showSizeChanger: true }}
              />
            </Card>
          </TabPane>

          <TabPane
            tab={
              <span>
                <AuditOutlined />
                سجل الأنشطة
              </span>
            }
            key="activity"
          >
            <Card>
              <Table
                dataSource={activities}
                rowKey="id"
                loading={loading}
                pagination={{ pageSize: 10, showSizeChanger: true }}
                columns={[
                  {
                    title: 'المستخدم',
                    key: 'user',
                    render: (_, record) => (
                      <Space>
                        <Avatar icon={<UserOutlined />} size="small" />
                        {record.user_name || 'N/A'}
                      </Space>
                    ),
                  },
                  { title: 'الإجراء', dataIndex: 'action', key: 'action' },
                  { title: 'الكيان', dataIndex: 'entity_type', key: 'entity_type' },
                  { title: 'التفاصيل', dataIndex: 'details', key: 'details' },
                  {
                    title: 'التاريخ',
                    dataIndex: 'created_at',
                    key: 'created_at',
                    render: (date: string) => formatBaghdadTime(date, 'YYYY-MM-DD hh:mm A'),
                  },
                ]}
              />
            </Card>
          </TabPane>
        </Tabs>

        {/* User Modal */}
        <Modal
          title={selectedUser ? 'تعديل مستخدم' : 'إضافة مستخدم جديد'}
          open={userModalVisible}
          onCancel={() => setUserModalVisible(false)}
          footer={null}
          width={600}
        >
          <Form
            form={form}
            layout="vertical"
            onFinish={handleUserSubmit}
          >
            <Form.Item
              name="username"
              label="اسم المستخدم"
              rules={[{ required: true, message: 'يرجى إدخال اسم المستخدم' }]}
            >
              <Input prefix={<UserOutlined />} />
            </Form.Item>
            <Form.Item
              name="name"
              label="الاسم الكامل"
              rules={[{ required: true, message: 'يرجى إدخال الاسم' }]}
            >
              <Input />
            </Form.Item>
            <Form.Item
              name="email"
              label="البريد الإلكتروني"
              rules={[{ type: 'email', message: 'يرجى إدخال بريد إلكتروني صحيح' }]}
            >
              <Input />
            </Form.Item>
            <Form.Item
              name="phone"
              label="رقم الهاتف"
            >
              <Input />
            </Form.Item>
            <Form.Item
              name="role"
              label="الدور"
              rules={[{ required: true, message: 'يرجى اختيار الدور' }]}
            >
              <Select>
                <Select.Option value="admin">مدير</Select.Option>
                <Select.Option value="inquiry">استعلامات</Select.Option>
                <Select.Option value="lab">تحاليل</Select.Option>
                <Select.Option value="lab_manager">مدير المختبر</Select.Option>
                <Select.Option value="pharmacist">صيدلية</Select.Option>
                <Select.Option value="pharmacy_manager">مدير الصيدلية</Select.Option>
                <Select.Option value="doctor">طبيب</Select.Option>
              </Select>
            </Form.Item>
            {!selectedUser && (
              <Form.Item
                name="password"
                label="كلمة المرور"
                rules={[{ required: true, message: 'يرجى إدخال كلمة المرور' }]}
              >
                <Input.Password placeholder="كلمة المرور" />
              </Form.Item>
            )}
            {selectedUser && (
              <Form.Item
                name="password"
                label="كلمة المرور (اتركه فارغاً للاحتفاظ بالحالية)"
              >
                <Input.Password placeholder="كلمة المرور الجديدة (اختياري)" />
              </Form.Item>
            )}
            <Form.Item
              name="is_active"
              label="الحالة"
              valuePropName="checked"
              initialValue={true}
            >
              <Switch checkedChildren="نشط" unCheckedChildren="غير نشط" />
            </Form.Item>
            <Form.Item>
              <Space>
                <Button type="primary" htmlType="submit">
                  {selectedUser ? 'تحديث' : 'إنشاء'}
                </Button>
                <Button onClick={() => setUserModalVisible(false)}>إلغاء</Button>
              </Space>
            </Form.Item>
          </Form>
        </Modal>

        {/* Patient Search Modal */}
        <PatientSearchModal
          visible={patientSearchVisible}
          onClose={() => setPatientSearchVisible(false)}
          onSelect={(patientId) => navigate(`/patients/${patientId}/full-report`)}
        />
      </Content>
    </Layout>
  );
};

export default AdminDashboardModern;
