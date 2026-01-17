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
  DatePicker,
  Select,
  message,
  Empty,
  Spin,
  Statistic,
  Tabs,
  Drawer
} from 'antd';
import {
  UserOutlined,
  FileTextOutlined,
  MedicineBoxOutlined,
  SearchOutlined,
  ReloadOutlined,
  ExportOutlined,
  EyeOutlined,
  DashboardOutlined,
  LogoutOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  HistoryOutlined,
  CheckCircleOutlined,
  ThunderboltOutlined,
  RiseOutlined,
  FallOutlined,
  TrophyOutlined,
  BarChartOutlined
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
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import NotificationBell from '../Notifications/NotificationBell';
import WelcomeMessage from '../Welcome/WelcomeMessage';
import PatientSearchModal from '../Common/PatientSearchModal';
import VisitDetails from '../Visits/VisitDetailsModern';
import { Visit, Patient } from '../../types';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { formatBaghdadDate, formatBaghdadTimeOnly } from '../../utils/dayjs-config';
import './DoctorDashboardModern.css';
import ModernHeaderWithLogo from '../Layout/ModernHeaderWithLogo';

const { Content } = Layout;
const { Title, Text } = Typography;
const { TabPane } = Tabs;
const { RangePicker } = DatePicker;
const { Option } = Select;

const DoctorDashboardModern: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [filteredVisits, setFilteredVisits] = useState<Visit[]>([]);
  const [selectedVisit, setSelectedVisit] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState('pending');
  
  // Search and Filters
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [dateRangeFilter, setDateRangeFilter] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  
  // Patient Search
  const [patientSearchVisible, setPatientSearchVisible] = useState(false);
  const [patientSearchText, setPatientSearchText] = useState('');
  const [searchResults, setSearchResults] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [fullReportSearchVisible, setFullReportSearchVisible] = useState(false);

  useEffect(() => {
    fetchVisits();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [visits, searchText, statusFilter, dateRangeFilter, activeTab]);

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

    // Tab filter
    if (activeTab === 'pending') {
      filtered = filtered.filter(v => 
        v.status === 'pending_doctor' ||
        (v.status === 'pending_all' && (v.doctor_completed === 0 || v.doctor_completed === null))
      );
    } else if (activeTab === 'completed') {
      filtered = filtered.filter(v => v.status === 'completed' || v.doctor_completed === 1);
    } else if (activeTab === 'all') {
      filtered = filtered.filter(v => 
        v.status === 'pending_doctor' ||
        (v.status === 'pending_all' && (v.doctor_completed === 0 || v.doctor_completed === null)) || 
        v.status === 'completed' || 
        v.doctor_completed === 1
      );
    }

    // Search filter
    if (searchText) {
      const searchLower = searchText.toLowerCase();
      filtered = filtered.filter(v =>
        v.visit_number?.toLowerCase().includes(searchLower) ||
        v.patient_name?.toLowerCase().includes(searchLower) ||
        v.national_id?.includes(searchLower)
      );
    }

    // Status filter
    if (statusFilter) {
      filtered = filtered.filter(v => v.status === statusFilter);
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

  const handleSearchPatient = async () => {
    if (!patientSearchText.trim()) return;

    try {
      const response = await axios.get(`/api/patients?search=${encodeURIComponent(patientSearchText)}`);
      setSearchResults(response.data);
    } catch (error: any) {
      message.error(error.response?.data?.error || 'حدث خطأ أثناء البحث');
    }
  };

  const handlePatientSelect = async (patientId: number) => {
    try {
      const response = await axios.get(`/api/doctor/patients/${patientId}/visits`);
      setVisits(response.data);
      setFilteredVisits(response.data);
      setSelectedPatient(searchResults.find(p => p.id === patientId) || null);
      setPatientSearchVisible(false);
      setPatientSearchText('');
      message.success('تم جلب تاريخ زيارات المريض');
    } catch (error: any) {
      message.error(error.response?.data?.error || 'حدث خطأ أثناء جلب تاريخ الزيارات');
    }
  };

  // Removed handleComplete - completion is now automatic when adding diagnosis

  const handleResetFilters = () => {
    setSearchText('');
    setStatusFilter(null);
    setDateRangeFilter(null);
    setSelectedPatient(null);
    fetchVisits();
  };

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
            <Space split={<span>•</span>} style={{ fontSize: '12px', color: '#8c8c8c' }}>
              {record.national_id && <span>{record.national_id}</span>}
              {record.age && <span>العمر: {record.age}</span>}
              {record.gender && <span>{record.gender}</span>}
            </Space>
          </div>
        </Space>
      ),
      sorter: (a, b) => (a.patient_name || '').localeCompare(b.patient_name || '')
    },
    {
      title: 'الحالة',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag
          color={status === 'completed' ? 'green' : 'purple'}
          icon={status === 'completed' ? <CheckCircleOutlined /> : <ClockCircleOutlined />}
        >
          {status === 'completed' ? 'مكتملة' : 'بانتظار الطبيب'}
        </Tag>
      ),
      width: 150,
      filters: [
        { text: 'بانتظار الطبيب', value: 'pending_doctor' },
        { text: 'مكتملة', value: 'completed' }
      ],
      onFilter: (value, record) => record.status === value
    },
    {
      title: 'تاريخ الإنشاء',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date: string) => (
        <Space direction="vertical" size={0}>
          <Text>{formatBaghdadDate(date)}</Text>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {formatBaghdadTimeOnly(date)}
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
          <Tooltip title="عرض التفاصيل والتشخيص">
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
    const pending = filteredVisits.filter(v => 
      v.status === 'pending_doctor' || 
      (v.status === 'pending_all' && (v.doctor_completed === 0 || v.doctor_completed === null))
    ).length;
    const completed = filteredVisits.filter(v => v.status === 'completed' || v.doctor_completed === 1).length;
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
        completed: dayVisits.filter(v => v.status === 'completed' || v.doctor_completed === 1).length,
        pending: dayVisits.filter(v => 
          v.status === 'pending_doctor' || 
          (v.status === 'pending_all' && (v.doctor_completed === 0 || v.doctor_completed === null))
        ).length
      };
    });

    // Status distribution for pie chart
    const statusData = [
      { name: 'مكتملة', value: completed, color: '#52c41a' },
      { name: 'معلقة', value: pending, color: '#722ed1' }
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

  const COLORS = ['#52c41a', '#722ed1'];

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
    <Layout className="doctor-dashboard-layout">
      <ModernHeaderWithLogo
        roleName={getRoleName(user?.role)}
        user={user}
        onLogout={logout}
        className="doctor-header"
        centerActions={
          <>
            <button
              className="modern-header-action-btn"
              onClick={() => setFullReportSearchVisible(true)}
            >
              <FileTextOutlined />
              <span>التقرير الشامل</span>
            </button>
            <button
              className="modern-header-action-btn"
              onClick={() => setPatientSearchVisible(true)}
            >
              <HistoryOutlined />
              <span>البحث عن مريض</span>
            </button>
          </>
        }
      />

      <Content className="doctor-dashboard-content">
        <WelcomeMessage />
        <Card
          title={
            <Space>
              <MedicineBoxOutlined />
              <span>الزيارات - الطبيب</span>
              <Badge count={stats.pending} style={{ backgroundColor: '#722ed1' }} />
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
              {selectedPatient && (
                <Tag
                  closable
                  onClose={() => {
                    setSelectedPatient(null);
                    handleResetFilters();
                  }}
                  color="blue"
                >
                  {selectedPatient.name}
                </Tag>
              )}
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
              <Card style={{ background: 'linear-gradient(135deg, #722ed1 0%, #9254de 100%)', border: 'none' }}>
                <Statistic
                  title={<span style={{ color: '#fff' }}>بانتظار التشخيص</span>}
                  value={stats.pending}
                  prefix={<ClockCircleOutlined style={{ color: '#fff' }} />}
                  valueStyle={{ color: '#fff', fontSize: '28px', fontWeight: 'bold' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card style={{ background: 'linear-gradient(135deg, #52c41a 0%, #73d13d 100%)', border: 'none' }}>
                <Statistic
                  title={<span style={{ color: '#fff' }}>مكتملة</span>}
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
                    <Bar dataKey="completed" fill="#52c41a" name="مكتملة" />
                    <Bar dataKey="pending" fill="#722ed1" name="معلقة" />
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

          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            style={{ marginBottom: '16px' }}
          >
            <TabPane
              tab={
                <span>
                  <ClockCircleOutlined />
                  بانتظار التشخيص ({stats.pending})
                </span>
              }
              key="pending"
            />
            <TabPane
              tab={
                <span>
                  <CheckCircleOutlined />
                  مكتملة ({stats.completed})
                </span>
              }
              key="completed"
            />
            <TabPane
              tab={
                <span>
                  <FileTextOutlined />
                  الكل ({stats.total})
                </span>
              }
              key="all"
            />
          </Tabs>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '100px' }}>
              <Spin size="large" />
            </div>
          ) : filteredVisits.length === 0 ? (
            <Empty
              description={activeTab === 'pending' ? 'لا توجد زيارات بانتظار التشخيص' : 'لا توجد زيارات'}
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
            />
          )}
        </Card>

        {/* Patient Search Drawer */}
        <Drawer
          title="البحث عن مريض"
          placement="right"
          onClose={() => {
            setPatientSearchVisible(false);
            setPatientSearchText('');
            setSearchResults([]);
          }}
          open={patientSearchVisible}
          width={400}
        >
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <Input
              placeholder="ابحث بالاسم أو رقم الهوية..."
              prefix={<SearchOutlined />}
              value={patientSearchText}
              onChange={(e) => setPatientSearchText(e.target.value)}
              onPressEnter={handleSearchPatient}
              allowClear
            />
            <Button
              type="primary"
              icon={<SearchOutlined />}
              onClick={handleSearchPatient}
              block
            >
              بحث
            </Button>
            {searchResults.length > 0 && (
              <div>
                <Text strong>النتائج ({searchResults.length}):</Text>
                <div style={{ marginTop: '16px' }}>
                  {searchResults.map(patient => (
                    <Card
                      key={patient.id}
                      size="small"
                      hoverable
                      onClick={() => handlePatientSelect(patient.id)}
                      style={{ marginBottom: '8px', cursor: 'pointer' }}
                    >
                      <Space direction="vertical" size={0} style={{ width: '100%' }}>
                        <Text strong>{patient.name}</Text>
                        <Space split={<span>•</span>} style={{ fontSize: '12px', color: '#8c8c8c' }}>
                          {patient.national_id && <span>هوية: {patient.national_id}</span>}
                          {patient.phone && <span>هاتف: {patient.phone}</span>}
                          {patient.age && <span>عمر: {patient.age}</span>}
                        </Space>
                      </Space>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </Space>
        </Drawer>

        {/* Visit Details */}
        {selectedVisit && (
          <VisitDetails
            visitId={selectedVisit}
            role="doctor"
            onComplete={() => {}} // No longer needed - completion is automatic
            onClose={() => setSelectedVisit(null)}
            onUpdate={() => {
              fetchVisits();
              setSelectedVisit(null);
            }}
          />
        )}

        {/* Full Report Patient Search Modal */}
        <PatientSearchModal
          visible={fullReportSearchVisible}
          onClose={() => setFullReportSearchVisible(false)}
          onSelect={(patientId) => navigate(`/patients/${patientId}/full-report`)}
        />
      </Content>
    </Layout>
  );
};

export default DoctorDashboardModern;
