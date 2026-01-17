import React, { useState, useEffect, useMemo } from 'react';
import {
  Layout,
  Card,
  Row,
  Col,
  Table,
  Tag,
  Button,
  Space,
  Typography,
  Badge,
  Avatar,
  Tooltip,
  Input,
  Select,
  DatePicker,
  message,
  Empty,
  Spin,
  Statistic
} from 'antd';
import {
  UserOutlined,
  FileTextOutlined,
  ShoppingOutlined,
  SearchOutlined,
  ReloadOutlined,
  ExportOutlined,
  EyeOutlined,
  DashboardOutlined,
  LogoutOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  DatabaseOutlined,
  AppstoreOutlined,
  ThunderboltOutlined,
  RiseOutlined,
  FallOutlined,
  TrophyOutlined,
  BarChartOutlined,
  ExperimentOutlined,
  MedicineBoxOutlined
} from '@ant-design/icons';
import {
  LineChart,
  Line,
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
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import NotificationBell from '../Notifications/NotificationBell';
import WelcomeMessage from '../Welcome/WelcomeMessage';
import PatientSearchModal from '../Common/PatientSearchModal';
import VisitDetails from '../Visits/VisitDetailsModern';
import { Visit } from '../../types';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import './PharmacyDashboardModern.css';
import ModernHeaderWithLogo from '../Layout/ModernHeaderWithLogo';

const { Content } = Layout;
const { Title, Text } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

const PharmacyDashboardModern: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [filteredVisits, setFilteredVisits] = useState<Visit[]>([]);
  const [selectedVisit, setSelectedVisit] = useState<number | null>(null);
  const [patientSearchVisible, setPatientSearchVisible] = useState(false);
  
  // Search and Filters
  const [searchText, setSearchText] = useState('');
  const [pharmacyStatusFilter, setPharmacyStatusFilter] = useState<string | null>(null); // 'pending' | 'completed' | null
  const [dateRangeFilter, setDateRangeFilter] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);

  useEffect(() => {
    fetchVisits();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [visits, searchText, pharmacyStatusFilter, dateRangeFilter]);

  const fetchVisits = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/visits');
      // Handle both old format (array) and new format (object with data and pagination)
      const visitsData = Array.isArray(response.data) 
        ? response.data 
        : (response.data?.data || []);
      setVisits(visitsData);
      setFilteredVisits(visitsData);
    } catch (error: any) {
      message.error(error.response?.data?.error || 'حدث خطأ أثناء جلب الزيارات');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...visits];

    // Search filter
    if (searchText) {
      const searchLower = searchText.toLowerCase();
      filtered = filtered.filter(v =>
        v.visit_number?.toLowerCase().includes(searchLower) ||
        v.patient_name?.toLowerCase().includes(searchLower) ||
        v.national_id?.includes(searchLower)
      );
    }

    // Status filter - Pharmacy sees visits where pharmacy is not completed (status = pending_all or pharmacy_completed = 0)
    filtered = filtered.filter(v => 
      (v.status === 'pending_all' && (v.pharmacy_completed === 0 || v.pharmacy_completed === null)) || 
      (v.pharmacy_completed === 1) // Can see completed ones too for editing
    );

    // Pharmacy status filter - Filter by pharmacy completion status
    if (pharmacyStatusFilter) {
      if (pharmacyStatusFilter === 'pending') {
        filtered = filtered.filter(v => v.pharmacy_completed === 0 || v.pharmacy_completed === null);
      } else if (pharmacyStatusFilter === 'completed') {
        filtered = filtered.filter(v => v.pharmacy_completed === 1);
      }
    }

    // Date range filter
    if (dateRangeFilter && dateRangeFilter[0] && dateRangeFilter[1]) {
      filtered = filtered.filter(v => {
        const visitDate = dayjs(v.created_at);
        return visitDate.isAfter(dateRangeFilter[0].startOf('day')) &&
               visitDate.isBefore(dateRangeFilter[1].endOf('day'));
      });
    }

    setFilteredVisits(filtered);
  };

  // Removed handleComplete - completion is now automatic when adding prescriptions

  // Visit columns
  const visitColumns: ColumnsType<Visit> = [
    {
      title: 'رقم الزيارة',
      dataIndex: 'visit_number',
      key: 'visit_number',
      render: (text: string) => <Text strong style={{ color: '#1890ff' }}>{text}</Text>,
      sorter: (a, b) => a.visit_number.localeCompare(b.visit_number),
      fixed: 'left'
    },
    {
      title: 'المريض',
      key: 'patient',
      render: (_, record) => (
        <Space>
          <Avatar icon={<UserOutlined />} size="small" style={{ backgroundColor: '#52c41a' }} />
          <div>
            <div style={{ fontWeight: 600 }}>{record.patient_name || '-'}</div>
            {record.national_id && (
              <Text type="secondary" style={{ fontSize: '12px' }}>
                {record.national_id}
              </Text>
            )}
          </div>
        </Space>
      ),
      sorter: (a, b) => (a.patient_name || '').localeCompare(b.patient_name || '')
    },
    {
      title: 'الحالة',
      dataIndex: 'status',
      key: 'status',
      render: (status: string, record: Visit) => {
        const getStatusDisplay = () => {
          if (status === 'completed') {
            return { text: 'مكتملة', color: 'green', icon: <CheckCircleOutlined /> };
          } else if (status === 'pending_pharmacy') {
            return { text: 'بانتظار الصيدلية', color: 'blue', icon: <ShoppingOutlined /> };
          } else if (status === 'pending_all') {
            // If pharmacy is completed but status is pending_all, show "قيد المعالجة"
            if (record.pharmacy_completed === 1) {
              return { text: 'قيد المعالجة', color: 'orange', icon: <ClockCircleOutlined /> };
            }
            return { text: 'قيد المعالجة', color: 'orange', icon: <ClockCircleOutlined /> };
          } else if (status === 'pending_lab') {
            return { text: 'بانتظار التحاليل', color: 'orange', icon: <ExperimentOutlined /> };
          } else if (status === 'pending_doctor') {
            return { text: 'بانتظار الطبيب', color: 'purple', icon: <MedicineBoxOutlined /> };
          }
          return { text: status || 'غير محدد', color: 'default', icon: <ClockCircleOutlined /> };
        };
        
        const statusDisplay = getStatusDisplay();
        return (
          <Tag color={statusDisplay.color} icon={statusDisplay.icon}>
            {statusDisplay.text}
          </Tag>
        );
      },
      width: 150
    },
    {
      title: 'حالة الصيدلية',
      dataIndex: 'pharmacy_completed',
      key: 'pharmacy_completed',
      render: (completed: number, record: Visit) => {
        const isCompleted = completed === 1;
        return (
          <Tag 
            color={isCompleted ? 'green' : 'orange'} 
            icon={isCompleted ? <CheckCircleOutlined /> : <ClockCircleOutlined />}
          >
            {isCompleted ? 'منجز' : 'معلق'}
          </Tag>
        );
      },
      filters: [
        { text: 'معلقة', value: 0 },
        { text: 'منجز', value: 1 },
      ],
      onFilter: (value, record) => {
        if (value === 0) return record.pharmacy_completed === 0 || record.pharmacy_completed === null;
        if (value === 1) return record.pharmacy_completed === 1;
        return true;
      },
      width: 150
    },
    {
      title: 'تاريخ الإنشاء',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date: string) => (
        <Space direction="vertical" size={0}>
          <Text>{dayjs(date).format('YYYY-MM-DD')}</Text>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {dayjs(date).format('HH:mm')}
          </Text>
        </Space>
      ),
      sorter: (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      width: 140
    },
    {
      title: 'الإجراءات',
      key: 'actions',
      fixed: 'right',
      width: 150,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="عرض التفاصيل وصرف العلاج">
            <Button
              type="primary"
              icon={<EyeOutlined />}
              size="small"
              onClick={() => setSelectedVisit(record.id)}
            >
              عرض
            </Button>
          </Tooltip>
        </Space>
      )
    }
  ];

  // Statistics
  const stats = useMemo(() => {
    const total = filteredVisits.length;
    const today = filteredVisits.filter(v => dayjs(v.created_at).isSame(dayjs(), 'day')).length;
    const pending = filteredVisits.filter(v => v.pharmacy_completed === 0 || v.pharmacy_completed === null).length;
    const completed = filteredVisits.filter(v => v.pharmacy_completed === 1).length;
    const completionRate = total > 0 ? ((completed / total) * 100).toFixed(1) : '0';
    const thisWeek = filteredVisits.filter(v => dayjs(v.created_at).isAfter(dayjs().subtract(7, 'day'))).length;
    const thisMonth = filteredVisits.filter(v => dayjs(v.created_at).isAfter(dayjs().subtract(30, 'day'))).length;
    
    // Chart data - visits by day (last 7 days)
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = dayjs().subtract(6 - i, 'day');
      const dayVisits = filteredVisits.filter(v => dayjs(v.created_at).isSame(date, 'day'));
      return {
        date: date.format('DD/MM'),
        day: date.format('ddd'),
        total: dayVisits.length,
        completed: dayVisits.filter(v => v.pharmacy_completed === 1).length,
        pending: dayVisits.filter(v => v.pharmacy_completed === 0 || v.pharmacy_completed === null).length
      };
    });

    // Status distribution for pie chart
    const statusData = [
      { name: 'منجز', value: completed, color: '#52c41a' },
      { name: 'معلقة', value: pending, color: '#1890ff' }
    ];

    return {
      total,
      today,
      pending,
      completed,
      completionRate,
      thisWeek,
      thisMonth,
      last7Days,
      statusData
    };
  }, [filteredVisits]);

  const COLORS = ['#52c41a', '#1890ff'];

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
    <Layout className="pharmacy-dashboard-layout">
      <ModernHeaderWithLogo
        roleName={getRoleName(user?.role)}
        user={user}
        onLogout={logout}
        className="pharmacy-header"
        centerActions={
          <>
            {(user?.role === 'admin' || user?.role === 'pharmacy_manager') && (
              <button
                className="modern-header-action-btn"
                onClick={() => navigate('/pharmacy/catalog')}
              >
                <DatabaseOutlined />
                <span>إدارة الكتالوج</span>
              </button>
            )}
            <button
              className="modern-header-action-btn"
              onClick={() => navigate('/pharmacy/sets')}
            >
              <AppstoreOutlined />
              <span>مجموعات الوصفات</span>
            </button>
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

      <Content className="pharmacy-dashboard-content">
        <WelcomeMessage />
        <Card
          title={
            <Space>
              <ShoppingOutlined />
              <span>الزيارات المعلقة - الصيدلية</span>
              <Badge count={stats.pending} style={{ backgroundColor: '#1890ff' }} />
            </Space>
          }
          extra={
            <Space>
              <Input
                placeholder="بحث في الزيارات..."
                prefix={<SearchOutlined />}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                allowClear
                style={{ width: 250 }}
              />
              <Select
                placeholder="حالة الصيدلية"
                value={pharmacyStatusFilter}
                onChange={(value) => setPharmacyStatusFilter(value)}
                allowClear
                style={{ width: 150 }}
              >
                <Option value="pending">معلقة</Option>
                <Option value="completed">منجز</Option>
              </Select>
              <RangePicker
                placeholder={['من', 'إلى']}
                onChange={(dates) => {
                  if (dates && dates[0] && dates[1]) {
                    setDateRangeFilter([dates[0], dates[1]]);
                  } else {
                    setDateRangeFilter(null);
                  }
                }}
              />
              <Button icon={<ReloadOutlined />} onClick={fetchVisits} />
              <Button icon={<ExportOutlined />}>تصدير</Button>
            </Space>
          }
        >
          <Row gutter={16} style={{ marginBottom: '24px' }}>
            <Col xs={24} sm={12} md={6}>
              <Card style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', border: 'none' }}>
                <Statistic
                  title={<span style={{ color: '#fff' }}>إجمالي الزيارات</span>}
                  value={stats.total}
                  prefix={<FileTextOutlined style={{ color: '#fff' }} />}
                  valueStyle={{ color: '#fff', fontSize: '28px', fontWeight: 'bold' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card style={{ background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', border: 'none' }}>
                <Statistic
                  title={<span style={{ color: '#fff' }}>زيارات اليوم</span>}
                  value={stats.today}
                  prefix={<CalendarOutlined style={{ color: '#fff' }} />}
                  valueStyle={{ color: '#fff', fontSize: '28px', fontWeight: 'bold' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card style={{ background: 'linear-gradient(135deg, #1890ff 0%, #40a9ff 100%)', border: 'none' }}>
                <Statistic
                  title={<span style={{ color: '#fff' }}>بانتظار الصيدلية</span>}
                  value={stats.pending}
                  prefix={<ClockCircleOutlined style={{ color: '#fff' }} />}
                  valueStyle={{ color: '#fff', fontSize: '28px', fontWeight: 'bold' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card style={{ background: 'linear-gradient(135deg, #52c41a 0%, #73d13d 100%)', border: 'none' }}>
                <Statistic
                  title={<span style={{ color: '#fff' }}>منجز</span>}
                  value={stats.completed}
                  prefix={<CheckCircleOutlined style={{ color: '#fff' }} />}
                  valueStyle={{ color: '#fff', fontSize: '28px', fontWeight: 'bold' }}
                />
              </Card>
            </Col>
          </Row>

          <Row gutter={16} style={{ marginBottom: '24px' }}>
            <Col xs={24} sm={12} md={6}>
              <Card style={{ background: 'linear-gradient(135deg, #52c41a 0%, #73d13d 100%)', border: 'none' }}>
                <Statistic
                  title={<span style={{ color: '#fff', fontWeight: 600 }}>معدل الإكمال</span>}
                  value={stats.completionRate}
                  suffix="%"
                  prefix={<TrophyOutlined style={{ color: '#fff' }} />}
                  valueStyle={{ color: '#fff', fontSize: '28px', fontWeight: 'bold' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card style={{ background: 'linear-gradient(135deg, #1890ff 0%, #40a9ff 100%)', border: 'none' }}>
                <Statistic
                  title={<span style={{ color: '#fff', fontWeight: 600 }}>هذا الأسبوع</span>}
                  value={stats.thisWeek}
                  prefix={<BarChartOutlined style={{ color: '#fff' }} />}
                  valueStyle={{ color: '#fff', fontSize: '28px', fontWeight: 'bold' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card style={{ background: 'linear-gradient(135deg, #722ed1 0%, #9254de 100%)', border: 'none' }}>
                <Statistic
                  title={<span style={{ color: '#fff', fontWeight: 600 }}>هذا الشهر</span>}
                  value={stats.thisMonth}
                  prefix={<ThunderboltOutlined style={{ color: '#fff' }} />}
                  valueStyle={{ color: '#fff', fontSize: '28px', fontWeight: 'bold' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card style={{ background: 'linear-gradient(135deg, #fa8c16 0%, #ffa940 100%)', border: 'none' }}>
                <Statistic
                  title={<span style={{ color: '#fff', fontWeight: 600 }}>نسبة المعلقة</span>}
                  value={stats.total > 0 ? ((stats.pending / stats.total) * 100).toFixed(1) : '0'}
                  suffix="%"
                  prefix={<FallOutlined style={{ color: '#fff' }} />}
                  valueStyle={{ color: '#fff', fontSize: '28px', fontWeight: 'bold' }}
                />
              </Card>
            </Col>
          </Row>

          <Row gutter={16} style={{ marginBottom: '24px' }}>
            <Col xs={24} lg={12}>
              <Card title={<><BarChartOutlined /> توزيع الزيارات (آخر 7 أيام)</>}>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={stats.last7Days}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" />
                    <YAxis />
                    <RechartsTooltip />
                    <Legend />
                    <Bar dataKey="completed" fill="#52c41a" name="منجز" />
                    <Bar dataKey="pending" fill="#1890ff" name="معلقة" />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card title={<><PieChart /> توزيع الحالات</>}>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={stats.statusData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {stats.statusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip />
                  </PieChart>
                </ResponsiveContainer>
              </Card>
            </Col>
          </Row>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '100px' }}>
              <Spin size="large" />
            </div>
          ) : filteredVisits.length === 0 ? (
            <Empty
              description="لا توجد زيارات معلقة"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          ) : (
            <Table
              columns={visitColumns}
              dataSource={filteredVisits}
              rowKey="id"
              loading={loading}
              pagination={{
                pageSize: 10,
                showSizeChanger: true,
                showTotal: (total) => `إجمالي ${total} زيارة`,
                pageSizeOptions: ['10', '20', '50', '100']
              }}
              scroll={{ x: 1200 }}
              size="middle"
              rowClassName={(record) => {
                // Highlight pending pharmacy visits
                if (record.pharmacy_completed === 0 || record.pharmacy_completed === null) {
                  return 'pharmacy-pending-row';
                }
                return 'pharmacy-completed-row';
              }}
            />
          )}
        </Card>

        {/* Visit Details */}
        {selectedVisit && (
          <VisitDetails
            visitId={selectedVisit}
            role="pharmacist"
            onComplete={() => {}} // No longer needed - completion is automatic
            onClose={() => setSelectedVisit(null)}
            onUpdate={() => {
              fetchVisits();
              setSelectedVisit(null);
            }}
          />
        )}

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

export default PharmacyDashboardModern;
