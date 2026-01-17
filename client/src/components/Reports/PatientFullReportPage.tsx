import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Layout,
  Card,
  Typography,
  Descriptions,
  Divider,
  Spin,
  Empty,
  Space,
  Button,
  Collapse,
  Table,
  Tag,
  Timeline,
  Row,
  Col,
  Avatar,
  Statistic,
  Tooltip,
  Breadcrumb,
  message,
  Input,
  Select,
  DatePicker,
  Tabs,
  Badge,
  Progress,
  Alert
} from 'antd';
import {
  UserOutlined,
  FileTextOutlined,
  HistoryOutlined,
  DownloadOutlined,
  ExperimentOutlined,
  ShoppingOutlined,
  MedicineBoxOutlined,
  PaperClipOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ArrowLeftOutlined,
  CalendarOutlined,
  TeamOutlined,
  HomeOutlined,
  PhoneOutlined,
  IdcardOutlined,
  HeartOutlined,
  PrinterOutlined,
  SearchOutlined,
  FilterOutlined,
  ReloadOutlined,
  ExportOutlined,
  EyeOutlined,
  BarChartOutlined,
  LineChartOutlined,
  PieChartOutlined,
  ThunderboltOutlined,
  TrophyOutlined,
  RiseOutlined,
  FallOutlined,
  InfoCircleOutlined,
  WarningOutlined,
  CheckOutlined,
  CloseOutlined
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
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import axios from 'axios';
import dayjs from 'dayjs';
import { formatBaghdadDate, formatBaghdadTime } from '../../utils/dayjs-config';
import { PatientFullReport, Visit, LabResult, Prescription, Diagnosis, Attachment, StatusHistory } from '../../types';
import './PatientFullReportPage.css';

const { Header, Content } = Layout;
const { Title, Text, Paragraph } = Typography;
const { Panel } = Collapse;
const { Option } = Select;
const { RangePicker } = DatePicker;
const { TabPane } = Tabs;

const PatientFullReportPage: React.FC = () => {
  const { patientId } = useParams<{ patientId: string }>();
  const navigate = useNavigate();
  const [report, setReport] = useState<PatientFullReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [dateRangeFilter, setDateRangeFilter] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [expandedVisits, setExpandedVisits] = useState<string[]>([]);

  useEffect(() => {
    if (patientId) {
      fetchPatientFullReport(parseInt(patientId));
    }
  }, [patientId]);

  const fetchPatientFullReport = async (id: number) => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(`/api/patients/${id}/full-report`);
      setReport(response.data);
    } catch (err: any) {
      console.error('Error fetching patient full report:', err);
      setError(err.response?.data?.error || 'فشل تحميل التقرير الطبي.');
    } finally {
      setLoading(false);
    }
  };

  // Filtered visits
  const filteredVisits = useMemo(() => {
    if (!report?.visits) return [];
    
    let filtered = [...report.visits];
    
    // Search filter
    if (searchText) {
      const searchLower = searchText.toLowerCase();
      filtered = filtered.filter(v =>
        v.visit_number?.toLowerCase().includes(searchLower) ||
        v.created_by_name?.toLowerCase().includes(searchLower) ||
        v.lab_results?.some(lr => lr.test_name?.toLowerCase().includes(searchLower)) ||
        v.prescriptions?.some(p => p.medication_name?.toLowerCase().includes(searchLower)) ||
        v.diagnoses?.some(d => d.diagnosis?.toLowerCase().includes(searchLower))
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
    
    return filtered;
  }, [report?.visits, searchText, statusFilter, dateRangeFilter]);

  // Statistics
  const stats = useMemo(() => {
    if (!report) return null;
    
    const visits = report.visits || [];
    const completedVisits = visits.filter(v => v.status === 'completed');
    const pendingVisits = visits.filter(v => v.status !== 'completed');
    
    // Visit trends (last 6 months)
    const sixMonthsAgo = dayjs().subtract(6, 'months');
    const monthlyVisits = Array.from({ length: 6 }, (_, i) => {
      const month = dayjs().subtract(5 - i, 'months');
      const monthStart = month.startOf('month');
      const monthEnd = month.endOf('month');
      const count = visits.filter(v => {
        const visitDate = dayjs(v.created_at);
        return visitDate.isAfter(monthStart) && visitDate.isBefore(monthEnd);
      }).length;
      return {
        month: month.format('MMM YYYY'),
        visits: count
      };
    });
    
    // Department completion rates
    const labCompleted = visits.filter(v => v.lab_completed === 1).length;
    const pharmacyCompleted = visits.filter(v => v.pharmacy_completed === 1).length;
    const doctorCompleted = visits.filter(v => v.doctor_completed === 1).length;
    
    // Status distribution
    const statusData = [
      { name: 'مكتملة', value: completedVisits.length, color: '#52c41a' },
      { name: 'معلقة', value: pendingVisits.length, color: '#fa8c16' }
    ];
    
    return {
      total_visits: visits.length,
      completed_visits: completedVisits.length,
      pending_visits: pendingVisits.length,
      total_lab_results: visits.reduce((sum, v) => sum + (v.lab_results?.length || 0), 0),
      total_prescriptions: visits.reduce((sum, v) => sum + (v.prescriptions?.length || 0), 0),
      total_diagnoses: visits.reduce((sum, v) => sum + (v.diagnoses?.length || 0), 0),
      total_attachments: visits.reduce((sum, v) => sum + (v.attachments?.length || 0), 0),
      monthly_visits: monthlyVisits,
      lab_completion_rate: visits.length > 0 ? (labCompleted / visits.length) * 100 : 0,
      pharmacy_completion_rate: visits.length > 0 ? (pharmacyCompleted / visits.length) * 100 : 0,
      doctor_completion_rate: visits.length > 0 ? (doctorCompleted / visits.length) * 100 : 0,
      status_data: statusData
    };
  }, [report]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending_all': return 'orange';
      case 'completed': return 'green';
      case 'pending_lab': return 'orange';
      case 'pending_pharmacy': return 'blue';
      case 'pending_doctor': return 'purple';
      default: return 'default';
    }
  };

  const getStatusText = (status: string) => {
    const statusMap: { [key: string]: string } = {
      'pending_all': 'قيد المعالجة',
      'completed': 'مكتملة',
      'pending_lab': 'بانتظار المختبر',
      'pending_pharmacy': 'بانتظار الصيدلية',
      'pending_doctor': 'بانتظار الطبيب'
    };
    return statusMap[status] || status;
  };

  const getCompletionTag = (isCompleted?: number | boolean | string | null) => {
    // Handle different formats: 1/0, true/false, '1'/'0', null/undefined
    const completed = isCompleted === 1 || isCompleted === true || isCompleted === '1' || isCompleted === 'true';
    return completed ? (
      <Tag color="green" icon={<CheckCircleOutlined />}>مكتمل</Tag>
    ) : (
      <Tag color="orange" icon={<ClockCircleOutlined />}>معلق</Tag>
    );
  };

  const handleDownloadAttachment = async (attachmentId: number) => {
    try {
      window.open(`/api/attachments/${attachmentId}/download`, '_blank');
    } catch (err: any) {
      console.error('Error downloading attachment:', err);
    }
  };

  const handleGeneratePDF = async () => {
    if (!patientId) {
      message.warning('Patient ID is required');
      return;
    }
    
    try {
      setLoading(true);
      message.loading({ content: 'جاري إنشاء PDF...', key: 'pdf', duration: 0 });
      
      const token = localStorage.getItem('token');
      if (!token) {
        message.error({ content: 'يجب تسجيل الدخول أولاً', key: 'pdf' });
        navigate('/login');
        return;
      }
      
      const response = await axios({
        method: 'GET',
        url: `/api/medical-reports/patient/${patientId}/pdf`,
        responseType: 'blob',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/pdf'
        }
      });
      
      if (!response.data || response.data.size === 0) {
        throw new Error('الملف المُستلم فارغ');
      }
      
      const contentType = response.headers['content-type'] || response.headers['Content-Type'];
      if (contentType && !contentType.includes('application/pdf')) {
        const text = await response.data.text();
        try {
          const errorData = JSON.parse(text);
          throw new Error(errorData.error || 'حدث خطأ أثناء إنشاء PDF');
        } catch (e: any) {
          if (e instanceof Error && e.message.includes('حدث خطأ')) {
            throw e;
          }
          throw new Error(text || 'حدث خطأ أثناء إنشاء PDF');
        }
      }
      
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `Medical-Report-Patient-${patientId}-${new Date().toISOString().split('T')[0]}.pdf`;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      const newWindow = window.open(url, '_blank');
      if (!newWindow) {
        message.warning({ content: 'تم حظر النافذة المنبثقة. يرجى السماح بالنوافذ المنبثقة لفتح PDF', key: 'pdf', duration: 5 });
      }
      
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
      }, 10000);
      
      message.success({ content: 'تم إنشاء PDF بنجاح - سيتم تحميله تلقائياً', key: 'pdf', duration: 3 });
    } catch (err: any) {
      console.error('Error generating PDF:', err);
      
      let errorMessage = 'حدث خطأ أثناء إنشاء PDF';
      
      if (err.response?.data) {
        if (err.response.data instanceof Blob) {
          try {
            const text = await err.response.data.text();
            try {
              const errorData = JSON.parse(text);
              errorMessage = errorData.error || errorMessage;
            } catch (e) {
              errorMessage = text || errorMessage;
            }
          } catch (e) {
            errorMessage = 'حدث خطأ أثناء قراءة استجابة الخادم';
          }
        } else if (typeof err.response.data === 'object') {
          errorMessage = err.response.data.error || errorMessage;
        } else if (typeof err.response.data === 'string') {
          errorMessage = err.response.data;
        }
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      if (err.response?.status === 401) {
        errorMessage = 'انتهت صلاحية الجلسة. يرجى تسجيل الدخول مرة أخرى';
        setTimeout(() => navigate('/login'), 2000);
      } else if (err.response?.status === 403) {
        errorMessage = 'ليس لديك صلاحية لتصدير هذا التقرير';
      } else if (err.response?.status === 404) {
        errorMessage = 'المريض غير موجود';
      }
      
      message.error({ content: errorMessage, key: 'pdf', duration: 5 });
    } finally {
      setLoading(false);
    }
  };

  if (loading && !report) {
    return (
      <Layout className="patient-full-report-layout">
        <Content style={{ padding: '50px', textAlign: 'center' }}>
          <Spin size="large" tip="جاري تحميل التقرير الشامل..." />
        </Content>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout className="patient-full-report-layout">
        <Content style={{ padding: '50px', textAlign: 'center' }}>
          <Empty description={<Text type="danger">{error}</Text>} />
          <Button type="primary" onClick={() => navigate(-1)} style={{ marginTop: 16 }}>
            العودة
          </Button>
        </Content>
      </Layout>
    );
  }

  if (!report || !report.patient) {
    return (
      <Layout className="patient-full-report-layout">
        <Content style={{ padding: '50px', textAlign: 'center' }}>
          <Empty description="لا توجد بيانات متاحة للمريض." />
          <Button type="primary" onClick={() => navigate(-1)} style={{ marginTop: 16 }}>
            العودة
          </Button>
        </Content>
      </Layout>
    );
  }

  const { patient, visits } = report;
  const COLORS = ['#52c41a', '#fa8c16', '#1890ff', '#722ed1', '#13c2c2'];

  return (
    <Layout className="patient-full-report-layout">
      <Header className="modern-header report-header">
        <div className="modern-header-content">
          <div className="modern-header-left">
            <div className="modern-header-icon-wrapper">
              <FileTextOutlined className="modern-header-icon" />
            </div>
            <div className="modern-header-title-section">
              <h1 className="modern-header-title">التقرير الطبي الشامل</h1>
              <p className="modern-header-subtitle">{patient.name}</p>
            </div>
          </div>
          
          <div className="modern-header-right">
            <Space>
              <Button
                icon={<ArrowLeftOutlined />}
                onClick={() => navigate(-1)}
                className="modern-header-action-btn"
              >
                العودة
              </Button>
              <Button
                type="primary"
                icon={<DownloadOutlined />}
                size="large"
                onClick={handleGeneratePDF}
                className="modern-header-action-btn"
                style={{ background: 'rgba(255,255,255,0.2)', borderColor: 'rgba(255,255,255,0.3)', color: '#fff' }}
              >
                تصدير PDF
              </Button>
            </Space>
          </div>
        </div>
      </Header>

      <Content className="patient-full-report-content">
        {/* Action Buttons */}
        <Card 
          className="action-buttons-card"
          style={{ marginBottom: 24, textAlign: 'center' }}
        >
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Space size="large" style={{ width: '100%', justifyContent: 'center', flexWrap: 'wrap' }}>
              <Button
                type="primary"
                size="large"
                icon={<PrinterOutlined />}
                onClick={() => window.print()}
                className="action-button action-button-primary"
                style={{ height: '60px', fontSize: '18px', padding: '0 40px', minWidth: '180px' }}
              >
                <div>
                  <div style={{ fontWeight: 'bold' }}>طباعة مباشرة</div>
                  <div style={{ fontSize: '14px', opacity: 0.9, fontWeight: 'normal' }}>Print Now</div>
                </div>
              </Button>
              <Button
                type="primary"
                size="large"
                icon={<PrinterOutlined />}
                onClick={() => navigate(`/patients/${patientId}/print`)}
                className="action-button action-button-secondary"
                style={{ height: '60px', fontSize: '18px', padding: '0 40px', minWidth: '180px', background: '#fff', color: '#667eea' }}
              >
                <div>
                  <div style={{ fontWeight: 'bold' }}>صفحة الطباعة</div>
                  <div style={{ fontSize: '14px', opacity: 0.9, fontWeight: 'normal' }}>Print Page</div>
                </div>
              </Button>
              <Button
                type="primary"
                size="large"
                icon={<DownloadOutlined />}
                onClick={handleGeneratePDF}
                className="action-button action-button-secondary"
                style={{ height: '60px', fontSize: '18px', padding: '0 40px', minWidth: '180px', background: '#fff', color: '#667eea' }}
              >
                <div>
                  <div style={{ fontWeight: 'bold' }}>تحميل PDF</div>
                  <div style={{ fontSize: '14px', opacity: 0.9, fontWeight: 'normal' }}>Download PDF</div>
                </div>
              </Button>
            </Space>
            <Text style={{ color: '#fff', fontSize: '14px', display: 'block', marginTop: '8px' }}>
              هذا المستند يمكن طباعته واستخدامه كسجل طبي رسمي
              <br />
              <span style={{ fontSize: '12px', opacity: 0.9 }}>This document can be printed and used as an official medical record</span>
            </Text>
          </Space>
        </Card>

        {/* Filters */}
        <Card style={{ marginBottom: 24, borderRadius: '12px' }}>
          <Row gutter={16} align="middle">
            <Col xs={24} sm={12} md={8}>
              <Input
                placeholder="بحث في الزيارات..."
                prefix={<SearchOutlined />}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                allowClear
                size="large"
              />
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Select
                placeholder="حالة الزيارة"
                value={statusFilter}
                onChange={setStatusFilter}
                allowClear
                size="large"
                style={{ width: '100%' }}
              >
                <Option value="completed">مكتملة</Option>
                <Option value="pending_all">قيد المعالجة</Option>
                <Option value="pending_lab">بانتظار المختبر</Option>
                <Option value="pending_pharmacy">بانتظار الصيدلية</Option>
                <Option value="pending_doctor">بانتظار الطبيب</Option>
              </Select>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <RangePicker
                placeholder={['من', 'إلى']}
                value={dateRangeFilter}
                onChange={(dates) => {
                  if (dates && dates[0] && dates[1]) {
                    setDateRangeFilter([dates[0], dates[1]]);
                  } else {
                    setDateRangeFilter(null);
                  }
                }}
                size="large"
                style={{ width: '100%' }}
              />
            </Col>
            <Col xs={24} sm={12} md={4}>
              <Button
                icon={<ReloadOutlined />}
                onClick={() => {
                  setSearchText('');
                  setStatusFilter(null);
                  setDateRangeFilter(null);
                }}
                size="large"
                style={{ width: '100%' }}
              >
                إعادة تعيين
              </Button>
            </Col>
          </Row>
        </Card>

        {/* Statistics */}
        {stats && (
          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col xs={24} sm={12} md={6} lg={4}>
              <Card className="stat-card" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', border: 'none' }}>
                <Statistic
                  title={<span style={{ color: '#fff' }}>إجمالي الزيارات</span>}
                  value={stats.total_visits}
                  prefix={<CalendarOutlined style={{ color: '#fff' }} />}
                  valueStyle={{ color: '#fff', fontSize: '28px', fontWeight: 'bold' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6} lg={4}>
              <Card className="stat-card" style={{ background: 'linear-gradient(135deg, #52c41a 0%, #73d13d 100%)', border: 'none' }}>
                <Statistic
                  title={<span style={{ color: '#fff' }}>مكتملة</span>}
                  value={stats.completed_visits}
                  prefix={<CheckCircleOutlined style={{ color: '#fff' }} />}
                  valueStyle={{ color: '#fff', fontSize: '28px', fontWeight: 'bold' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6} lg={4}>
              <Card className="stat-card" style={{ background: 'linear-gradient(135deg, #fa8c16 0%, #ffa940 100%)', border: 'none' }}>
                <Statistic
                  title={<span style={{ color: '#fff' }}>نتائج التحاليل</span>}
                  value={stats.total_lab_results}
                  prefix={<ExperimentOutlined style={{ color: '#fff' }} />}
                  valueStyle={{ color: '#fff', fontSize: '28px', fontWeight: 'bold' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6} lg={4}>
              <Card className="stat-card" style={{ background: 'linear-gradient(135deg, #1890ff 0%, #40a9ff 100%)', border: 'none' }}>
                <Statistic
                  title={<span style={{ color: '#fff' }}>الأدوية</span>}
                  value={stats.total_prescriptions}
                  prefix={<ShoppingOutlined style={{ color: '#fff' }} />}
                  valueStyle={{ color: '#fff', fontSize: '28px', fontWeight: 'bold' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6} lg={4}>
              <Card className="stat-card" style={{ background: 'linear-gradient(135deg, #722ed1 0%, #9254de 100%)', border: 'none' }}>
                <Statistic
                  title={<span style={{ color: '#fff' }}>التشخيصات</span>}
                  value={stats.total_diagnoses}
                  prefix={<MedicineBoxOutlined style={{ color: '#fff' }} />}
                  valueStyle={{ color: '#fff', fontSize: '28px', fontWeight: 'bold' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6} lg={4}>
              <Card className="stat-card" style={{ background: 'linear-gradient(135deg, #13c2c2 0%, #36cfc9 100%)', border: 'none' }}>
                <Statistic
                  title={<span style={{ color: '#fff' }}>المرفقات</span>}
                  value={stats.total_attachments}
                  prefix={<PaperClipOutlined style={{ color: '#fff' }} />}
                  valueStyle={{ color: '#fff', fontSize: '28px', fontWeight: 'bold' }}
                />
              </Card>
            </Col>
          </Row>
        )}

        {/* Tabs */}
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          size="large"
          style={{ marginBottom: 24 }}
          items={[
            {
              key: 'overview',
              label: (
                <Space>
                  <BarChartOutlined />
                  <span>نظرة عامة</span>
                </Space>
              ),
              children: (
                <>
                  {/* Charts */}
                  {stats && (
                    <Row gutter={16} style={{ marginBottom: 24 }}>
                      <Col xs={24} lg={12}>
                        <Card title={<Space><LineChartOutlined /> <span>اتجاه الزيارات (آخر 6 أشهر)</span></Space>} style={{ borderRadius: '12px' }}>
                          <ResponsiveContainer width="100%" height={300}>
                            <AreaChart data={stats.monthly_visits}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="month" />
                              <YAxis />
                              <RechartsTooltip />
                              <Area type="monotone" dataKey="visits" stroke="#667eea" fill="#667eea" fillOpacity={0.6} />
                            </AreaChart>
                          </ResponsiveContainer>
                        </Card>
                      </Col>
                      <Col xs={24} lg={12}>
                        <Card title={<Space><PieChartOutlined /> <span>توزيع الحالات</span></Space>} style={{ borderRadius: '12px' }}>
                          <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                              <Pie
                                data={stats.status_data}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                outerRadius={100}
                                fill="#8884d8"
                                dataKey="value"
                              >
                                {stats.status_data.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                              </Pie>
                              <RechartsTooltip />
                            </PieChart>
                          </ResponsiveContainer>
                        </Card>
                      </Col>
                    </Row>
                  )}

                  {/* Completion Rates */}
                  {stats && (
                    <Card title={<Space><TrophyOutlined /> <span>معدلات الإنجاز</span></Space>} style={{ marginBottom: 24, borderRadius: '12px' }}>
                      <Row gutter={16}>
                        <Col xs={24} sm={8}>
                          <Card size="small" style={{ background: 'linear-gradient(135deg, #fff5e6 0%, #ffe7ba 100%)', border: 'none' }}>
                            <Space direction="vertical" style={{ width: '100%' }}>
                              <Space>
                                <ExperimentOutlined style={{ fontSize: '20px', color: '#fa8c16' }} />
                                <Text strong>المختبر</Text>
                              </Space>
                              <Progress
                                percent={Math.round(stats.lab_completion_rate)}
                                strokeColor="#fa8c16"
                                format={(percent) => `${percent}%`}
                              />
                            </Space>
                          </Card>
                        </Col>
                        <Col xs={24} sm={8}>
                          <Card size="small" style={{ background: 'linear-gradient(135deg, #e6f7ff 0%, #bae7ff 100%)', border: 'none' }}>
                            <Space direction="vertical" style={{ width: '100%' }}>
                              <Space>
                                <ShoppingOutlined style={{ fontSize: '20px', color: '#1890ff' }} />
                                <Text strong>الصيدلية</Text>
                              </Space>
                              <Progress
                                percent={Math.round(stats.pharmacy_completion_rate)}
                                strokeColor="#1890ff"
                                format={(percent) => `${percent}%`}
                              />
                            </Space>
                          </Card>
                        </Col>
                        <Col xs={24} sm={8}>
                          <Card size="small" style={{ background: 'linear-gradient(135deg, #f9f0ff 0%, #efdbff 100%)', border: 'none' }}>
                            <Space direction="vertical" style={{ width: '100%' }}>
                              <Space>
                                <MedicineBoxOutlined style={{ fontSize: '20px', color: '#722ed1' }} />
                                <Text strong>الطبيب</Text>
                              </Space>
                              <Progress
                                percent={Math.round(stats.doctor_completion_rate)}
                                strokeColor="#722ed1"
                                format={(percent) => `${percent}%`}
                              />
                            </Space>
                          </Card>
                        </Col>
                      </Row>
                    </Card>
                  )}

                  {/* Patient Information */}
                  <Card 
                    title={<Space><UserOutlined style={{ fontSize: '20px', color: '#1890ff' }} /> <span style={{ fontSize: '18px', fontWeight: 'bold' }}>معلومات المريض</span></Space>} 
                    style={{ marginBottom: 24, borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  >
                    <Descriptions bordered column={{ xs: 1, sm: 2, md: 3 }}>
                      <Descriptions.Item label="الاسم الكامل">
                        <Text strong style={{ fontSize: '16px' }}>{patient.name}</Text>
                      </Descriptions.Item>
                      <Descriptions.Item label="رقم الهوية">{patient.national_id || '-'}</Descriptions.Item>
                      <Descriptions.Item label="العمر">{patient.age || '-'}</Descriptions.Item>
                      <Descriptions.Item label="الجنس">
                        <Tag color={patient.gender === 'ذكر' || patient.gender === 'Male' ? 'blue' : 'pink'}>
                          {patient.gender || '-'}
                        </Tag>
                      </Descriptions.Item>
                      <Descriptions.Item label="الهاتف">{patient.phone || '-'}</Descriptions.Item>
                      <Descriptions.Item label="الجوال">{patient.mobile || '-'}</Descriptions.Item>
                      <Descriptions.Item label="البريد الإلكتروني">{patient.email || '-'}</Descriptions.Item>
                      <Descriptions.Item label="العنوان">{patient.address || '-'}</Descriptions.Item>
                      <Descriptions.Item label="المدينة">{patient.city || '-'}</Descriptions.Item>
                      <Descriptions.Item label="فئة المريض">
                        {patient.patient_category ? <Tag color="blue">{patient.patient_category}</Tag> : '-'}
                      </Descriptions.Item>
                      <Descriptions.Item label="فصيلة الدم">
                        {patient.blood_type ? <Tag color="red">{patient.blood_type}</Tag> : '-'}
                      </Descriptions.Item>
                      <Descriptions.Item label="تاريخ الميلاد">
                        {patient.date_of_birth ? formatBaghdadDate(patient.date_of_birth) : '-'}
                      </Descriptions.Item>
                      <Descriptions.Item label="تاريخ التسجيل">
                        {patient.created_at ? formatBaghdadTime(patient.created_at, 'YYYY-MM-DD hh:mm A') : '-'}
                      </Descriptions.Item>
                      <Descriptions.Item label="سجل بواسطة">
                        {patient.created_by_name || '-'}
                      </Descriptions.Item>
                      <Descriptions.Item label="الحالة">
                        {patient.is_active === 1 ? (
                          <Tag color="green">نشط</Tag>
                        ) : (
                          <Tag color="red">غير نشط</Tag>
                        )}
                      </Descriptions.Item>
                    </Descriptions>

                    {(patient.allergies || patient.medical_history || patient.chronic_diseases || patient.current_medications) && (
                      <>
                        <Divider orientation="right" style={{ fontSize: '16px', fontWeight: 'bold', marginTop: '24px' }}>
                          المعلومات الطبية
                        </Divider>
                        <Row gutter={16}>
                          {patient.allergies && (
                            <Col xs={24} sm={12}>
                              <Card size="small" title={<Space><HeartOutlined style={{ color: '#ff4d4f' }} /> الحساسية</Space>} style={{ borderRadius: '8px' }}>
                                <Text>{patient.allergies}</Text>
                              </Card>
                            </Col>
                          )}
                          {patient.chronic_diseases && (
                            <Col xs={24} sm={12}>
                              <Card size="small" title={<Space><MedicineBoxOutlined style={{ color: '#722ed1' }} /> الأمراض المزمنة</Space>} style={{ borderRadius: '8px' }}>
                                <Text>{patient.chronic_diseases}</Text>
                              </Card>
                            </Col>
                          )}
                          {patient.medical_history && (
                            <Col xs={24}>
                              <Card size="small" title={<Space><HistoryOutlined style={{ color: '#1890ff' }} /> التاريخ الطبي</Space>} style={{ borderRadius: '8px' }}>
                                <Text>{patient.medical_history}</Text>
                              </Card>
                            </Col>
                          )}
                          {patient.current_medications && (
                            <Col xs={24}>
                              <Card size="small" title={<Space><MedicineBoxOutlined style={{ color: '#52c41a' }} /> الأدوية الحالية</Space>} style={{ borderRadius: '8px' }}>
                                <Text>{patient.current_medications}</Text>
                              </Card>
                            </Col>
                          )}
                        </Row>
                      </>
                    )}

                    {(patient.emergency_contact_name || patient.insurance_number) && (
                      <>
                        <Divider orientation="right" style={{ fontSize: '16px', fontWeight: 'bold', marginTop: '24px' }}>
                          جهة الاتصال للطوارئ والتأمين
                        </Divider>
                        <Row gutter={16}>
                          {patient.emergency_contact_name && (
                            <Col xs={24} sm={12}>
                              <Descriptions bordered column={1} size="small" style={{ borderRadius: '8px' }}>
                                <Descriptions.Item label="اسم جهة الاتصال">
                                  {patient.emergency_contact_name}
                                </Descriptions.Item>
                                <Descriptions.Item label="العلاقة">
                                  {patient.emergency_contact_relation || '-'}
                                </Descriptions.Item>
                                <Descriptions.Item label="الهاتف">
                                  {patient.emergency_contact_phone || '-'}
                                </Descriptions.Item>
                              </Descriptions>
                            </Col>
                          )}
                          {patient.insurance_number && (
                            <Col xs={24} sm={12}>
                              <Descriptions bordered column={1} size="small" style={{ borderRadius: '8px' }}>
                                <Descriptions.Item label="رقم التأمين">
                                  {patient.insurance_number}
                                </Descriptions.Item>
                                <Descriptions.Item label="نوع التأمين">
                                  {patient.insurance_type || '-'}
                                </Descriptions.Item>
                              </Descriptions>
                            </Col>
                          )}
                        </Row>
                      </>
                    )}

                    {patient.notes && (
                      <>
                        <Divider orientation="right" style={{ fontSize: '16px', fontWeight: 'bold', marginTop: '24px' }}>
                          ملاحظات إضافية
                        </Divider>
                        <Card size="small" style={{ borderRadius: '8px' }}>
                          <Text>{patient.notes}</Text>
                        </Card>
                      </>
                    )}
                  </Card>
                </>
              )
            },
            {
              key: 'visits',
              label: (
                <Space>
                  <HistoryOutlined />
                  <span>الزيارات</span>
                  <Badge count={filteredVisits.length} style={{ backgroundColor: '#1890ff' }} />
                </Space>
              ),
              children: (
                <Card 
                  title={<Space><HistoryOutlined style={{ fontSize: '20px', color: '#1890ff' }} /> <span style={{ fontSize: '18px', fontWeight: 'bold' }}>تاريخ الزيارات</span></Space>}
                  style={{ borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                >
                  {filteredVisits.length === 0 ? (
                    <Empty description="لا توجد زيارات مسجلة لهذا المريض." />
                  ) : (
                    <Collapse 
                      accordion={false}
                      activeKey={expandedVisits}
                      onChange={setExpandedVisits}
                    >
                      {filteredVisits.map((visit) => (
                        <Panel
                          header={
                            <Space>
                              <Text strong style={{ fontSize: '16px' }}>{visit.visit_number}</Text>
                              <Text type="secondary">
                                ({formatBaghdadTime(visit.created_at, 'YYYY-MM-DD hh:mm A')})
                              </Text>
                              <Tag color={getStatusColor(visit.status)}>
                                {getStatusText(visit.status)}
                              </Tag>
                              {visit.lab_completed === 1 && visit.pharmacy_completed === 1 && visit.doctor_completed === 1 && (
                                <Tag color="green" icon={<CheckCircleOutlined />}>مكتملة بالكامل</Tag>
                              )}
                            </Space>
                          }
                          key={visit.id.toString()}
                        >
                          <Descriptions bordered column={{ xs: 1, sm: 2, md: 3 }} size="small" style={{ marginBottom: 16 }}>
                            <Descriptions.Item label="رقم الزيارة">{visit.visit_number}</Descriptions.Item>
                            <Descriptions.Item label="تاريخ الزيارة">
                              {formatBaghdadTime(visit.created_at, 'YYYY-MM-DD hh:mm A')}
                            </Descriptions.Item>
                            <Descriptions.Item label="أنشئ بواسطة">{visit.created_by_name || '-'}</Descriptions.Item>
                          </Descriptions>

                          <Divider orientation="right" style={{ fontSize: '14px', fontWeight: 'bold' }}>حالة الأقسام</Divider>
                          <Row gutter={16} style={{ marginBottom: 16 }}>
                            <Col xs={24} sm={8}>
                              <Card size="small" style={{ borderRadius: '8px', background: 'linear-gradient(135deg, #fff5e6 0%, #ffe7ba 100%)' }}>
                                <Space>
                                  <ExperimentOutlined style={{ fontSize: '18px', color: '#fa8c16' }} />
                                  <Text strong>المختبر:</Text>
                                  {getCompletionTag(visit.lab_completed)}
                                </Space>
                              </Card>
                            </Col>
                            <Col xs={24} sm={8}>
                              <Card size="small" style={{ borderRadius: '8px', background: 'linear-gradient(135deg, #e6f7ff 0%, #bae7ff 100%)' }}>
                                <Space>
                                  <ShoppingOutlined style={{ fontSize: '18px', color: '#1890ff' }} />
                                  <Text strong>الصيدلية:</Text>
                                  {getCompletionTag(visit.pharmacy_completed)}
                                </Space>
                              </Card>
                            </Col>
                            <Col xs={24} sm={8}>
                              <Card size="small" style={{ borderRadius: '8px', background: 'linear-gradient(135deg, #f9f0ff 0%, #efdbff 100%)' }}>
                                <Space>
                                  <MedicineBoxOutlined style={{ fontSize: '18px', color: '#722ed1' }} />
                                  <Text strong>الطبيب:</Text>
                                  {getCompletionTag(visit.doctor_completed)}
                                </Space>
                              </Card>
                            </Col>
                          </Row>

                          {visit.lab_results && visit.lab_results.length > 0 && (
                            <>
                              <Divider orientation="right" style={{ fontSize: '14px', fontWeight: 'bold' }}>نتائج التحاليل</Divider>
                              <Table
                                dataSource={visit.lab_results.map((lr: any) => ({
                                  ...lr,
                                  // Use visit date as fallback if created_at is missing
                                  created_at: lr.created_at || visit.created_at || null
                                }))}
                                columns={[
                                  { title: 'اسم التحليل', dataIndex: 'test_name', key: 'test_name' },
                                  { title: 'النتيجة', dataIndex: 'result', key: 'result' },
                                  { title: 'الوحدة', dataIndex: 'unit', key: 'unit' },
                                  { title: 'المدى الطبيعي', dataIndex: 'normal_range', key: 'normal_range' },
                                  { title: 'ملاحظات', dataIndex: 'notes', key: 'notes' },
                                  { title: 'بواسطة', dataIndex: 'created_by_name', key: 'created_by_name' },
                                  {
                                    title: 'التاريخ',
                                    dataIndex: 'created_at',
                                    key: 'created_at',
                                    render: (date: string) => {
                                      if (!date) return '-';
                                      try {
                                        return dayjs(date).format('YYYY-MM-DD HH:mm');
                                      } catch (e) {
                                        return '-';
                                      }
                                    }
                                  }
                                ]}
                                rowKey="id"
                                pagination={false}
                                size="small"
                                style={{ marginBottom: 16, borderRadius: '8px' }}
                              />
                            </>
                          )}

                          {visit.prescriptions && visit.prescriptions.length > 0 && (
                            <>
                              <Divider orientation="right" style={{ fontSize: '14px', fontWeight: 'bold' }}>الأدوية المصروفة</Divider>
                              <Table
                                dataSource={visit.prescriptions.map((p: any) => ({
                                  ...p,
                                  // Use visit date as fallback if created_at is missing
                                  created_at: p.created_at || visit.created_at || null
                                }))}
                                columns={[
                                  { title: 'الدواء', dataIndex: 'medication_name', key: 'medication_name' },
                                  { title: 'الجرعة', dataIndex: 'dosage', key: 'dosage' },
                                  { title: 'الكمية', dataIndex: 'quantity', key: 'quantity' },
                                  { title: 'التعليمات', dataIndex: 'instructions', key: 'instructions' },
                                  { title: 'بواسطة', dataIndex: 'created_by_name', key: 'created_by_name' },
                                  {
                                    title: 'التاريخ',
                                    dataIndex: 'created_at',
                                    key: 'created_at',
                                    render: (date: string) => {
                                      if (!date) return '-';
                                      try {
                                        return dayjs(date).format('YYYY-MM-DD HH:mm');
                                      } catch (e) {
                                        return '-';
                                      }
                                    }
                                  }
                                ]}
                                rowKey="id"
                                pagination={false}
                                size="small"
                                style={{ marginBottom: 16, borderRadius: '8px' }}
                              />
                            </>
                          )}

                          {visit.diagnoses && visit.diagnoses.length > 0 && (
                            <>
                              <Divider orientation="right" style={{ fontSize: '14px', fontWeight: 'bold' }}>التشخيص</Divider>
                              <Table
                                dataSource={visit.diagnoses.map((d: any) => ({
                                  ...d,
                                  // Use visit date as fallback if created_at is missing
                                  created_at: d.created_at || visit.created_at || null
                                }))}
                                columns={[
                                  { title: 'التشخيص', dataIndex: 'diagnosis', key: 'diagnosis' },
                                  { title: 'ملاحظات', dataIndex: 'notes', key: 'notes' },
                                  { title: 'الطبيب', dataIndex: 'doctor_name', key: 'doctor_name' },
                                  {
                                    title: 'التاريخ',
                                    dataIndex: 'created_at',
                                    key: 'created_at',
                                    render: (date: string) => {
                                      if (!date) return '-';
                                      try {
                                        return dayjs(date).format('YYYY-MM-DD HH:mm');
                                      } catch (e) {
                                        return '-';
                                      }
                                    }
                                  }
                                ]}
                                rowKey="id"
                                pagination={false}
                                size="small"
                                style={{ marginBottom: 16, borderRadius: '8px' }}
                              />
                            </>
                          )}

                          {visit.attachments && visit.attachments.length > 0 && (
                            <>
                              <Divider orientation="right" style={{ fontSize: '14px', fontWeight: 'bold' }}>المرفقات</Divider>
                              <Table
                                dataSource={visit.attachments}
                                columns={[
                                  { title: 'اسم الملف', dataIndex: 'original_filename', key: 'original_filename' },
                                  { title: 'القسم', dataIndex: 'department', key: 'department' },
                                  { title: 'الوصف', dataIndex: 'description', key: 'description', render: (text: string) => text || '-' },
                                  { title: 'رفع بواسطة', dataIndex: 'uploaded_by_name', key: 'uploaded_by_name' },
                                  {
                                    title: 'التاريخ',
                                    dataIndex: 'created_at',
                                    key: 'created_at',
                                    render: (date: string) => (date ? dayjs(date).format('YYYY-MM-DD HH:mm') : '-')
                                  },
                                  {
                                    title: 'الإجراء',
                                    key: 'action',
                                    render: (_, record) => (
                                      <Button
                                        icon={<DownloadOutlined />}
                                        size="small"
                                        onClick={() => handleDownloadAttachment(record.id)}
                                      >
                                        تحميل
                                      </Button>
                                    )
                                  }
                                ]}
                                rowKey="id"
                                pagination={false}
                                size="small"
                                style={{ marginBottom: 16, borderRadius: '8px' }}
                              />
                            </>
                          )}

                          {visit.status_history && visit.status_history.length > 0 && (
                            <>
                              <Divider orientation="right" style={{ fontSize: '14px', fontWeight: 'bold' }}>تاريخ الحالة</Divider>
                              <Timeline reverse>
                                {visit.status_history.map((history: StatusHistory) => (
                                  <Timeline.Item key={history.id} color="blue">
                                    <Text strong>{dayjs(history.created_at).format('YYYY-MM-DD HH:mm')}</Text>
                                    <br />
                                    <Text>{history.notes || history.status}</Text>
                                    {history.changed_by_name && (
                                      <Text type="secondary"> (بواسطة: {history.changed_by_name})</Text>
                                    )}
                                  </Timeline.Item>
                                ))}
                              </Timeline>
                            </>
                          )}
                        </Panel>
                      ))}
                    </Collapse>
                  )}
                </Card>
              )
            }
          ]}
        />
      </Content>
    </Layout>
  );
};

export default PatientFullReportPage;
