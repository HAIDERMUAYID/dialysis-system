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
  Tabs,
  Badge,
  Avatar,
  Tooltip,
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  message,
  Empty,
  Spin,
  InputNumber,
  Divider,
  Statistic,
  Popconfirm
} from 'antd';
import {
  UserOutlined,
  TeamOutlined,
  FileTextOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  SearchOutlined,
  FilterOutlined,
  ReloadOutlined,
  ExportOutlined,
  CalendarOutlined,
  DashboardOutlined,
  LogoutOutlined,
  MedicineBoxOutlined,
  ExperimentOutlined,
  ShoppingOutlined,
  UserAddOutlined,
  FileAddOutlined,
  FilePdfOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import NotificationBell from '../Notifications/NotificationBell';
import WelcomeMessage from '../Welcome/WelcomeMessage';
import PatientSearchModal from '../Common/PatientSearchModal';
import { Patient, Visit } from '../../types';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { formatBaghdadTime, formatBaghdadDate } from '../../utils/dayjs-config';
import VisitDetails from '../Visits/VisitDetailsModern';
import PatientFormModern from '../Patients/PatientFormModern';
import './InquiryDashboardModern.css';
import ModernHeaderWithLogo from '../Layout/ModernHeaderWithLogo';

const { Content } = Layout;
const { Title, Text } = Typography;
const { TabPane } = Tabs;
const { Option } = Select;
const { RangePicker } = DatePicker;

const InquiryDashboardModern: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [filteredPatients, setFilteredPatients] = useState<Patient[]>([]);
  const [filteredVisits, setFilteredVisits] = useState<Visit[]>([]);
  const [activeTab, setActiveTab] = useState('patients');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [selectedVisit, setSelectedVisit] = useState<number | null>(null);
  const [patientModalVisible, setPatientModalVisible] = useState(false);
  const [patientSearchVisible, setPatientSearchVisible] = useState(false);
  const [visitModalVisible, setVisitModalVisible] = useState(false);
  const [visitForm] = Form.useForm();
  const [incompleteVisitInfo, setIncompleteVisitInfo] = useState<any>(null);
  
  // Search and Filters
  const [patientSearchText, setPatientSearchText] = useState('');
  const [visitSearchText, setVisitSearchText] = useState('');
  const [patientGenderFilter, setPatientGenderFilter] = useState<string | null>(null);
  const [visitStatusFilter, setVisitStatusFilter] = useState<string | null>(null);
  const [dateRangeFilter, setDateRangeFilter] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  // Hide header when modals are open
  useEffect(() => {
    if (patientModalVisible || visitModalVisible || patientSearchVisible) {
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
  }, [patientModalVisible, visitModalVisible, patientSearchVisible]);

  useEffect(() => {
    applyPatientFilters();
  }, [patients, patientSearchText, patientGenderFilter]);

  useEffect(() => {
    applyVisitFilters();
  }, [visits, visitSearchText, visitStatusFilter, dateRangeFilter]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'patients') {
        const response = await axios.get('/api/patients');
        // Handle both old format (array) and new format (object with data and pagination)
        const patientsData = Array.isArray(response.data) 
          ? response.data 
          : (response.data?.data || []);
        setPatients(patientsData);
        setFilteredPatients(patientsData);
      } else {
        const response = await axios.get('/api/visits');
        // Handle both old format (array) and new format (object with data and pagination)
        const visitsData = Array.isArray(response.data) 
          ? response.data 
          : (response.data?.data || []);
        setVisits(visitsData);
        setFilteredVisits(visitsData);
      }
    } catch (error: any) {
      message.error(error.response?.data?.error || 'حدث خطأ أثناء جلب البيانات');
    } finally {
      setLoading(false);
    }
  };

  const applyPatientFilters = () => {
    let filtered = [...patients];

    // Search filter
    if (patientSearchText) {
      const searchLower = patientSearchText.toLowerCase();
      filtered = filtered.filter(p =>
        p.name?.toLowerCase().includes(searchLower) ||
        p.national_id?.includes(searchLower) ||
        p.phone?.includes(searchLower) ||
        p.address?.toLowerCase().includes(searchLower)
      );
    }

    // Gender filter
    if (patientGenderFilter) {
      filtered = filtered.filter(p => p.gender === patientGenderFilter);
    }

    setFilteredPatients(filtered);
  };

  const applyVisitFilters = () => {
    let filtered = [...visits];

    // Search filter
    if (visitSearchText) {
      const searchLower = visitSearchText.toLowerCase();
      filtered = filtered.filter(v =>
        v.visit_number?.toLowerCase().includes(searchLower) ||
        v.patient_name?.toLowerCase().includes(searchLower) ||
        v.national_id?.includes(searchLower)
      );
    }

    // Status filter
    if (visitStatusFilter) {
      filtered = filtered.filter(v => {
        const visitStatus = v.status || '';
        return visitStatus === visitStatusFilter;
      });
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

  const getStatusColor = (status: string) => {
    const colors: { [key: string]: string } = {
      pending_all: 'orange',
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
      pending_all: 'قيد المعالجة',
      pending_lab: 'بانتظار التحاليل',
      pending_pharmacy: 'بانتظار الصيدلية',
      pending_doctor: 'بانتظار الطبيب',
      completed: 'مكتملة',
      pending_inquiry: 'بانتظار الاستعلامات'
    };
    return texts[status] || status;
  };

  const handleCreatePatient = () => {
    setSelectedPatient(null);
    setPatientModalVisible(true);
  };

  const handleEditPatient = (patient: Patient) => {
    setSelectedPatient(patient);
    setPatientModalVisible(true);
  };

  const handleDeletePatient = async (id: number) => {
    try {
      await axios.delete(`/api/patients/${id}`);
      message.success('تم حذف المريض بنجاح');
      fetchData();
    } catch (error: any) {
      message.error(error.response?.data?.error || 'حدث خطأ أثناء حذف المريض');
    }
  };

  const handlePatientSave = () => {
    setPatientModalVisible(false);
    setSelectedPatient(null);
    fetchData();
  };

  const handleCreateVisit = (patient: Patient) => {
    setSelectedPatient(patient);
    visitForm.setFieldsValue({ patient_id: patient.id });
    setVisitModalVisible(true);
  };

  const handleVisitSubmit = async (values: any) => {
    try {
      await axios.post('/api/visits', { patient_id: values.patient_id });
      message.success('تم إنشاء زيارة جديدة بنجاح - تم إرسالها إلى المختبر والصيدلية والطبيب');
      setVisitModalVisible(false);
      setIncompleteVisitInfo(null);
      setActiveTab('visits');
      fetchData();
    } catch (error: any) {
      if (error.response?.status === 400 && error.response?.data?.details) {
        // Show detailed error with incomplete visit info
        setIncompleteVisitInfo(error.response.data);
        message.warning(error.response.data.message);
      } else {
        message.error(error.response?.data?.error || 'حدث خطأ أثناء إنشاء الزيارة');
      }
    }
  };

  const handleCloseIncompleteVisit = async () => {
    if (!incompleteVisitInfo?.details?.visit_id) return;
    
    try {
      await axios.post(`/api/visits/${incompleteVisitInfo.details.visit_id}/close`);
      message.success('تم إغلاق الزيارة السابقة بنجاح. يمكنك الآن إنشاء زيارة جديدة.');
      setIncompleteVisitInfo(null);
      fetchData();
    } catch (error: any) {
      message.error(error.response?.data?.error || 'حدث خطأ أثناء إغلاق الزيارة');
    }
  };

  const handleCloseVisit = async (visitId: number) => {
    try {
      await axios.post(`/api/visits/${visitId}/close`);
      message.success('تم إغلاق الزيارة بنجاح');
      fetchData();
    } catch (error: any) {
      message.error(error.response?.data?.error || 'حدث خطأ أثناء إغلاق الزيارة');
    }
  };

  // Patient columns
  const patientColumns: ColumnsType<Patient> = [
    {
      title: 'المريض',
      key: 'patient',
      render: (_, record) => (
        <Space>
          <Avatar icon={<UserOutlined />} style={{ backgroundColor: '#1890ff' }} />
          <div>
            <div style={{ fontWeight: 600 }}>{record.name}</div>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              {record.national_id || 'بدون رقم هوية'}
            </Text>
          </div>
        </Space>
      ),
      sorter: (a, b) => (a.name || '').localeCompare(b.name || ''),
      filteredValue: patientSearchText ? [patientSearchText] : null,
      onFilter: (value, record) =>
        (record.name || '').toLowerCase().includes((value as string).toLowerCase()) ||
        (record.national_id || '').includes(value as string)
    },
    {
      title: 'رقم الهوية',
      dataIndex: 'national_id',
      key: 'national_id',
      render: (text: string) => text || '-',
      sorter: (a, b) => (a.national_id || '').localeCompare(b.national_id || '')
    },
    {
      title: 'الهاتف',
      dataIndex: 'phone',
      key: 'phone',
      render: (text: string) => text || '-'
    },
    {
      title: 'العمر',
      dataIndex: 'age',
      key: 'age',
      render: (age: number) => age || '-',
      sorter: (a, b) => (a.age || 0) - (b.age || 0)
    },
    {
      title: 'الجنس',
      dataIndex: 'gender',
      key: 'gender',
      render: (gender: string) => (
        <Tag color={gender === 'ذكر' ? 'blue' : 'pink'}>
          {gender || '-'}
        </Tag>
      ),
      filters: [
        { text: 'ذكر', value: 'ذكر' },
        { text: 'أنثى', value: 'أنثى' }
      ],
      onFilter: (value, record) => record.gender === value
    },
    {
      title: 'العنوان',
      dataIndex: 'address',
      key: 'address',
      render: (text: string) => text || '-',
      ellipsis: true
    },
    {
      title: 'تاريخ التسجيل',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date: string) => formatBaghdadDate(date),
      sorter: (a, b) => {
        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return dateA - dateB;
      }
    },
    {
      title: 'الإجراءات',
      key: 'actions',
      fixed: 'right',
      width: 280,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="عرض التقرير الشامل">
            <Button
              type="primary"
              icon={<FilePdfOutlined />}
              size="small"
              onClick={() => navigate(`/patients/${record.id}/full-report`)}
              style={{ background: '#722ed1', borderColor: '#722ed1' }}
            >
              التقرير
            </Button>
          </Tooltip>
          <Tooltip title="إنشاء زيارة">
            <Button
              type="default"
              icon={<FileAddOutlined />}
              size="small"
              onClick={() => handleCreateVisit(record)}
            >
              زيارة
            </Button>
          </Tooltip>
          <Tooltip title="تعديل">
            <Button
              type="default"
              icon={<EditOutlined />}
              size="small"
              onClick={() => handleEditPatient(record)}
            />
          </Tooltip>
          <Popconfirm
            title="حذف المريض"
            description="هل أنت متأكد من حذف هذا المريض؟"
            onConfirm={() => handleDeletePatient(record.id)}
            okText="نعم"
            cancelText="لا"
          >
            <Tooltip title="حذف">
              <Button
                type="primary"
                danger
                icon={<DeleteOutlined />}
                size="small"
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      )
    }
  ];

  // Visit columns
  const visitColumns: ColumnsType<Visit> = [
    {
      title: 'رقم الزيارة',
      dataIndex: 'visit_number',
      key: 'visit_number',
      render: (text: string) => <Text strong>{text}</Text>,
      sorter: (a, b) => a.visit_number.localeCompare(b.visit_number),
      filteredValue: visitSearchText ? [visitSearchText] : null,
      onFilter: (value, record) =>
        record.visit_number.toLowerCase().includes((value as string).toLowerCase()) ||
        (record.patient_name || '').toLowerCase().includes((value as string).toLowerCase())
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
      title: 'الحالة العامة',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={getStatusColor(status)}>{getStatusText(status)}</Tag>
      ),
      filters: [
        { text: 'قيد المعالجة', value: 'pending_all' },
        { text: 'بانتظار التحاليل', value: 'pending_lab' },
        { text: 'بانتظار الصيدلية', value: 'pending_pharmacy' },
        { text: 'بانتظار الطبيب', value: 'pending_doctor' },
        { text: 'مكتملة', value: 'completed' }
      ],
      onFilter: (value, record) => record.status === value
    },
    {
      title: 'حالة الأقسام',
      key: 'departments_status',
      width: 250,
      render: (_: any, record: Visit) => (
        <Space direction="vertical" size="small" style={{ width: '100%' }}>
          <Space size="small">
            <ExperimentOutlined style={{ color: record.lab_completed === 1 ? '#52c41a' : '#faad14' }} />
            <Text style={{ fontSize: '12px' }}>
              المختبر: 
              <Tag 
                color={record.lab_completed === 1 ? 'success' : 'warning'} 
                style={{ marginRight: '4px', marginLeft: '4px' }}
              >
                {record.lab_completed === 1 ? 'مكتمل' : 'معلق'}
              </Tag>
            </Text>
          </Space>
          <Space size="small">
            <ShoppingOutlined style={{ color: record.pharmacy_completed === 1 ? '#52c41a' : '#faad14' }} />
            <Text style={{ fontSize: '12px' }}>
              الصيدلية: 
              <Tag 
                color={record.pharmacy_completed === 1 ? 'success' : 'warning'} 
                style={{ marginRight: '4px', marginLeft: '4px' }}
              >
                {record.pharmacy_completed === 1 ? 'مكتمل' : 'معلق'}
              </Tag>
            </Text>
          </Space>
          <Space size="small">
            <MedicineBoxOutlined style={{ color: record.doctor_completed === 1 ? '#52c41a' : '#faad14' }} />
            <Text style={{ fontSize: '12px' }}>
              الطبيب: 
              <Tag 
                color={record.doctor_completed === 1 ? 'success' : 'warning'} 
                style={{ marginRight: '4px', marginLeft: '4px' }}
              >
                {record.doctor_completed === 1 ? 'مكتمل' : 'معلق'}
              </Tag>
            </Text>
          </Space>
        </Space>
      ),
    },
    {
      title: 'تاريخ الإنشاء',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date: string) => formatBaghdadTime(date, 'YYYY-MM-DD hh:mm A'),
      sorter: (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }) => (
        <div style={{ padding: 8 }}>
          <RangePicker
            style={{ marginBottom: 8, display: 'block' }}
            onChange={(dates) => {
              if (dates) {
                setDateRangeFilter([dates[0]!, dates[1]!]);
              } else {
                setDateRangeFilter(null);
              }
            }}
          />
          <Space>
            <Button
              type="primary"
              size="small"
              onClick={() => confirm()}
            >
              تطبيق
            </Button>
            <Button size="small" onClick={() => {
              setDateRangeFilter(null);
              clearFilters?.();
            }}>
              إعادة تعيين
            </Button>
          </Space>
        </div>
      ),
      filterIcon: <CalendarOutlined />
    },
    {
      title: 'أنشئ بواسطة',
      dataIndex: 'created_by_name',
      key: 'created_by_name',
      render: (text: string) => text || '-'
    },
    {
      title: 'الإجراءات',
      key: 'actions',
      fixed: 'right',
      width: 200,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="عرض التفاصيل">
            <Button
              type="primary"
              icon={<EyeOutlined />}
              size="small"
              onClick={() => setSelectedVisit(record.id)}
            >
              تفاصيل
            </Button>
          </Tooltip>
          {record.status !== 'completed' && (
            <Popconfirm
              title="إغلاق الزيارة"
              description="هل أنت متأكد من إغلاق هذه الزيارة مباشرة؟"
              onConfirm={() => handleCloseVisit(record.id)}
              okText="نعم"
              cancelText="لا"
            >
              <Tooltip title="إغلاق مباشرة">
                <Button
                  type="default"
                  danger
                  size="small"
                >
                  إغلاق
                </Button>
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      )
    }
  ];

  // Statistics - More useful metrics
  const patientStats = useMemo(() => {
    const today = dayjs().startOf('day');
    const weekStart = dayjs().startOf('week');
    const monthStart = dayjs().startOf('month');
    
    return {
      total: filteredPatients.length,
      today: filteredPatients.filter(p => {
        if (!p.created_at) return false;
        return dayjs(p.created_at).isSame(today, 'day');
      }).length,
      thisWeek: filteredPatients.filter(p => {
        if (!p.created_at) return false;
        return dayjs(p.created_at).isAfter(weekStart) || dayjs(p.created_at).isSame(weekStart, 'day');
      }).length,
      thisMonth: filteredPatients.filter(p => {
        if (!p.created_at) return false;
        return dayjs(p.created_at).isAfter(monthStart) || dayjs(p.created_at).isSame(monthStart, 'day');
      }).length
    };
  }, [filteredPatients]);

  const visitStats = useMemo(() => {
    const today = dayjs().startOf('day');
    
    return {
      total: filteredVisits.length,
      today: filteredVisits.filter(v => dayjs(v.created_at).isSame(today, 'day')).length,
      inProgress: filteredVisits.filter(v => 
        v.status !== 'completed' && v.status !== 'pending_inquiry'
      ).length,
      completed: filteredVisits.filter(v => v.status === 'completed').length,
      pending_lab: filteredVisits.filter(v => v.status === 'pending_lab').length,
      pending_pharmacy: filteredVisits.filter(v => v.status === 'pending_pharmacy').length,
      pending_doctor: filteredVisits.filter(v => v.status === 'pending_doctor').length
    };
  }, [filteredVisits]);

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
    <Layout className="inquiry-dashboard-layout">
      <ModernHeaderWithLogo
        roleName={getRoleName(user?.role)}
        user={user}
        onLogout={logout}
        className="inquiry-header"
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

      <Content className="inquiry-dashboard-content">
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          size="large"
          style={{ marginBottom: '24px' }}
          type="line"
        >
          <TabPane
            tab={
              <span>
                <TeamOutlined />
                المرضى ({patientStats.total})
              </span>
            }
            key="patients"
          >
            <Card
              extra={
                <Space>
                  <Input
                    placeholder="بحث في المرضى..."
                    prefix={<SearchOutlined />}
                    value={patientSearchText}
                    onChange={(e) => setPatientSearchText(e.target.value)}
                    allowClear
                    style={{ width: 250 }}
                  />
                  <Select
                    placeholder="الجنس"
                    allowClear
                    style={{ width: 120 }}
                    onChange={setPatientGenderFilter}
                    value={patientGenderFilter}
                  >
                    <Option value="ذكر">ذكر</Option>
                    <Option value="أنثى">أنثى</Option>
                  </Select>
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={handleCreatePatient}
                  >
                    إضافة مريض
                  </Button>
                  <Button icon={<ReloadOutlined />} onClick={fetchData} />
                  <Button icon={<ExportOutlined />}>تصدير</Button>
                </Space>
              }
            >
              <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
                <Col xs={24} sm={12} md={6}>
                  <Statistic
                    title="إجمالي المرضى"
                    value={patientStats.total}
                    prefix={<TeamOutlined />}
                    valueStyle={{ color: '#3b82f6', fontSize: '32px', fontWeight: 800 }}
                  />
                </Col>
                <Col xs={24} sm={12} md={6}>
                  <Statistic
                    title="مرضى جدد اليوم"
                    value={patientStats.today}
                    prefix={<CalendarOutlined />}
                    valueStyle={{ color: '#10b981', fontSize: '32px', fontWeight: 800 }}
                  />
                </Col>
                <Col xs={24} sm={12} md={6}>
                  <Statistic
                    title="مرضى جدد هذا الأسبوع"
                    value={patientStats.thisWeek}
                    prefix={<UserAddOutlined />}
                    valueStyle={{ color: '#f59e0b', fontSize: '32px', fontWeight: 800 }}
                  />
                </Col>
                <Col xs={24} sm={12} md={6}>
                  <Statistic
                    title="مرضى جدد هذا الشهر"
                    value={patientStats.thisMonth}
                    prefix={<UserOutlined />}
                    valueStyle={{ color: '#8b5cf6', fontSize: '32px', fontWeight: 800 }}
                  />
                </Col>
              </Row>

              <Table
                columns={patientColumns}
                dataSource={filteredPatients}
                rowKey="id"
                loading={loading}
                pagination={{
                  pageSize: 10,
                  showSizeChanger: true,
                  showTotal: (total) => `إجمالي ${total} مريض`,
                  pageSizeOptions: ['10', '20', '50', '100']
                }}
                scroll={{ x: 1200 }}
                size="middle"
              />
            </Card>
          </TabPane>

          <TabPane
            tab={
              <span>
                <FileTextOutlined />
                الزيارات ({visitStats.total})
              </span>
            }
            key="visits"
          >
            <Card
              extra={
                <Space>
                  <Input
                    placeholder="بحث في الزيارات..."
                    prefix={<SearchOutlined />}
                    value={visitSearchText}
                    onChange={(e) => setVisitSearchText(e.target.value)}
                    allowClear
                    style={{ width: 250 }}
                  />
                  <Select
                    placeholder="الحالة"
                    allowClear
                    style={{ width: 180 }}
                    onChange={(value) => {
                      setVisitStatusFilter(value);
                    }}
                    value={visitStatusFilter}
                  >
                    <Option value="pending_all">قيد المعالجة</Option>
                    <Option value="pending_lab">بانتظار التحاليل</Option>
                    <Option value="pending_pharmacy">بانتظار الصيدلية</Option>
                    <Option value="pending_doctor">بانتظار الطبيب</Option>
                    <Option value="pending_inquiry">بانتظار الاستعلامات</Option>
                    <Option value="completed">مكتملة</Option>
                  </Select>
                  <Button icon={<ReloadOutlined />} onClick={fetchData} />
                  <Button icon={<ExportOutlined />}>تصدير</Button>
                </Space>
              }
            >
              <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
                <Col xs={24} sm={12} md={6}>
                  <Statistic
                    title="إجمالي الزيارات"
                    value={visitStats.total}
                    prefix={<FileTextOutlined />}
                    valueStyle={{ color: '#3b82f6', fontSize: '32px', fontWeight: 800 }}
                  />
                </Col>
                <Col xs={24} sm={12} md={6}>
                  <Statistic
                    title="زيارات اليوم"
                    value={visitStats.today}
                    prefix={<CalendarOutlined />}
                    valueStyle={{ color: '#10b981', fontSize: '32px', fontWeight: 800 }}
                  />
                </Col>
                <Col xs={24} sm={12} md={6}>
                  <Statistic
                    title="قيد المعالجة"
                    value={visitStats.inProgress}
                    prefix={<DashboardOutlined />}
                    valueStyle={{ color: '#f59e0b', fontSize: '32px', fontWeight: 800 }}
                  />
                </Col>
                <Col xs={24} sm={12} md={6}>
                  <Statistic
                    title="مكتملة"
                    value={visitStats.completed}
                    prefix={<FileTextOutlined />}
                    valueStyle={{ color: '#10b981', fontSize: '32px', fontWeight: 800 }}
                  />
                </Col>
              </Row>
              
              {/* Department-specific stats */}
              {(visitStats.pending_lab > 0 || visitStats.pending_pharmacy > 0 || visitStats.pending_doctor > 0) && (
                <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
                  {visitStats.pending_lab > 0 && (
                    <Col xs={24} sm={8}>
                      <Statistic
                        title="بانتظار التحاليل"
                        value={visitStats.pending_lab}
                        prefix={<ExperimentOutlined />}
                        valueStyle={{ color: '#f59e0b', fontSize: '28px', fontWeight: 700 }}
                      />
                    </Col>
                  )}
                  {visitStats.pending_pharmacy > 0 && (
                    <Col xs={24} sm={8}>
                      <Statistic
                        title="بانتظار الصيدلية"
                        value={visitStats.pending_pharmacy}
                        prefix={<ShoppingOutlined />}
                        valueStyle={{ color: '#3b82f6', fontSize: '28px', fontWeight: 700 }}
                      />
                    </Col>
                  )}
                  {visitStats.pending_doctor > 0 && (
                    <Col xs={24} sm={8}>
                      <Statistic
                        title="بانتظار الطبيب"
                        value={visitStats.pending_doctor}
                        prefix={<MedicineBoxOutlined />}
                        valueStyle={{ color: '#8b5cf6', fontSize: '28px', fontWeight: 700 }}
                      />
                    </Col>
                  )}
                </Row>
              )}

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
                scroll={{ x: 1400 }}
                size="middle"
              />
            </Card>
          </TabPane>
        </Tabs>

        {/* Patient Modal - Using Enhanced PatientFormModern */}
        <PatientFormModern
          patient={selectedPatient}
          open={patientModalVisible}
          onSave={handlePatientSave}
          onCancel={() => {
            setPatientModalVisible(false);
            setSelectedPatient(null);
            fetchData();
          }}
        />

        {/* Visit Modal */}
        <Modal
          title="إنشاء زيارة جديدة"
          open={visitModalVisible}
          onCancel={() => {
            setVisitModalVisible(false);
            setSelectedPatient(null);
            setIncompleteVisitInfo(null);
            visitForm.resetFields();
          }}
          footer={null}
          width={600}
          destroyOnClose
        >
          <div style={{ marginBottom: '16px', padding: '16px', background: '#f0f2f5', borderRadius: '8px' }}>
            <Text strong>المريض: </Text>
            <Text>{selectedPatient?.name}</Text>
            {selectedPatient?.national_id && (
              <>
                <Divider type="vertical" />
                <Text type="secondary">رقم الهوية: {selectedPatient.national_id}</Text>
              </>
            )}
          </div>

          {/* Incomplete Visit Warning */}
          {incompleteVisitInfo && incompleteVisitInfo.details && (
            <div style={{ 
              marginBottom: '16px', 
              padding: '20px', 
              background: 'linear-gradient(135deg, #fff3cd 0%, #ffe69c 100%)', 
              borderRadius: '12px', 
              border: '2px solid #ffc107',
              boxShadow: '0 4px 12px rgba(255, 193, 7, 0.2)'
            }}>
              <div style={{ marginBottom: '16px' }}>
                <Text strong style={{ fontSize: '16px', color: '#856404', display: 'block', marginBottom: '8px' }}>
                  <FileTextOutlined style={{ marginLeft: '8px' }} />
                  {incompleteVisitInfo.message}
                </Text>
                <Text type="secondary" style={{ fontSize: '14px', color: '#856404' }}>
                  {incompleteVisitInfo.instruction}
                </Text>
              </div>
              
              <div style={{ 
                padding: '16px', 
                background: 'white', 
                borderRadius: '8px', 
                marginBottom: '16px',
                border: '1px solid #ffc107'
              }}>
                <Text strong style={{ display: 'block', marginBottom: '12px', color: '#856404' }}>
                  تفاصيل الزيارة المفتوحة:
                </Text>
                <Row gutter={[16, 8]}>
                  <Col span={12}>
                    <Text type="secondary">رقم الزيارة: </Text>
                    <Text strong>{incompleteVisitInfo.details.visit_number}</Text>
                  </Col>
                  <Col span={12}>
                    <Text type="secondary">الحالة: </Text>
                    <Tag color={getStatusColor(incompleteVisitInfo.details.status)}>
                      {getStatusText(incompleteVisitInfo.details.status)}
                    </Tag>
                  </Col>
                  <Col span={24}>
                    <Text type="secondary">تاريخ الفتح: </Text>
                    <Text strong>{incompleteVisitInfo.details.created_at}</Text>
                  </Col>
                  <Col span={24}>
                    <Text type="secondary" style={{ display: 'block', marginBottom: '8px' }}>حالة الأقسام:</Text>
                    <Space size="small">
                      <Tag color={incompleteVisitInfo.details.lab_completed ? 'success' : 'warning'}>
                        المختبر: {incompleteVisitInfo.details.lab_completed ? 'مكتمل' : 'معلق'}
                      </Tag>
                      <Tag color={incompleteVisitInfo.details.pharmacy_completed ? 'success' : 'warning'}>
                        الصيدلية: {incompleteVisitInfo.details.pharmacy_completed ? 'مكتمل' : 'معلق'}
                      </Tag>
                      <Tag color={incompleteVisitInfo.details.doctor_completed ? 'success' : 'warning'}>
                        الطبيب: {incompleteVisitInfo.details.doctor_completed ? 'مكتمل' : 'معلق'}
                      </Tag>
                    </Space>
                  </Col>
                </Row>
              </div>

              <div style={{ 
                padding: '16px', 
                background: '#e7f3ff', 
                borderRadius: '8px', 
                marginBottom: '16px',
                border: '1px solid #91d5ff'
              }}>
                <Text strong style={{ display: 'block', marginBottom: '8px', color: '#0050b3' }}>
                  <EyeOutlined style={{ marginLeft: '8px' }} />
                  طريقة إنهاء الزيارة يدوياً:
                </Text>
                <ol style={{ margin: 0, paddingRight: '20px', color: '#0050b3' }}>
                  <li style={{ marginBottom: '8px' }}>
                    يمكنك <Text strong>عرض تفاصيل الزيارة</Text> من خلال الضغط على زر "تفاصيل" في جدول الزيارات
                  </li>
                  <li style={{ marginBottom: '8px' }}>
                    أو يمكنك <Text strong>إنهاء الزيارة مباشرة</Text> من خلال الضغط على الزر أدناه
                  </li>
                  <li>
                    بعد إنهاء الزيارة، يمكنك إنشاء زيارة جديدة للمريض
                  </li>
                </ol>
              </div>

              <Space size="middle" style={{ width: '100%', justifyContent: 'space-between' }}>
                <Button 
                  type="primary" 
                  danger
                  icon={<DeleteOutlined />}
                  onClick={handleCloseIncompleteVisit}
                  size="large"
                >
                  إنهاء الزيارة يدوياً
                </Button>
                <Button 
                  type="default"
                  icon={<EyeOutlined />}
                  onClick={() => {
                    setSelectedVisit(incompleteVisitInfo.details.visit_id);
                    setVisitModalVisible(false);
                    setIncompleteVisitInfo(null);
                  }}
                  size="large"
                >
                  عرض تفاصيل الزيارة
                </Button>
              </Space>
            </div>
          )}

          {!incompleteVisitInfo && (
            <>
              <div style={{ marginBottom: '16px', padding: '12px', background: '#e6f7ff', borderRadius: '8px', border: '1px solid #91d5ff' }}>
                <Text type="secondary">
                  <MedicineBoxOutlined style={{ marginLeft: '8px' }} />
                  سيتم إرسال هذه الزيارة إلى <strong>المختبر والصيدلية والطبيب</strong> معاً بعد الإنشاء
                </Text>
              </div>
              <Form
                form={visitForm}
                layout="vertical"
                onFinish={handleVisitSubmit}
              >
                <Form.Item
                  name="patient_id"
                  hidden
                >
                  <Input />
                </Form.Item>

                <Form.Item>
                  <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
                    <Button onClick={() => {
                      setVisitModalVisible(false);
                      setSelectedPatient(null);
                      setIncompleteVisitInfo(null);
                      visitForm.resetFields();
                    }}>
                      إلغاء
                    </Button>
                    <Button type="primary" htmlType="submit" size="large">
                      إنشاء زيارة جديدة
                    </Button>
                  </Space>
                </Form.Item>
              </Form>
            </>
          )}
        </Modal>

        {/* Visit Details - using existing component as overlay */}
        {selectedVisit && (
          <VisitDetails
            visitId={selectedVisit}
            role="inquiry"
            onComplete={() => {
              setSelectedVisit(null);
              fetchData();
              message.success('تم تحديث الزيارة بنجاح');
            }}
            onClose={() => setSelectedVisit(null)}
            onUpdate={() => fetchData()}
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

export default InquiryDashboardModern;
