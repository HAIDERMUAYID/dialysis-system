import React, { useState, useEffect, useCallback } from 'react';
import {
  Layout,
  Card,
  Tabs,
  Table,
  Button,
  Space,
  Typography,
  Select,
  Form,
  Input,
  DatePicker,
  message,
  Spin,
  Tag,
  InputNumber,
  Divider,
  Drawer,
  Modal,
  Grid,
  FloatButton,
  Collapse,
  Row,
  Col,
} from 'antd';
import {
  MedicineBoxOutlined,
  ArrowLeftOutlined,
  ReloadOutlined,
  TeamOutlined,
  CalendarOutlined,
  ThunderboltOutlined,
  PlusOutlined,
  StopOutlined,
  DeleteOutlined,
  ApartmentOutlined,
  ClockCircleOutlined,
  FormOutlined,
  DashboardOutlined,
  HddOutlined,
  FundOutlined,
  InboxOutlined,
  FileSearchOutlined,
} from '@ant-design/icons';
import axios from 'axios';
import dayjs, { Dayjs } from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { usePermission } from '../../hooks/usePermission';
import ModernHeaderWithLogo from '../Layout/ModernHeaderWithLogo';
import DialysisStructurePanel from './DialysisStructurePanel';
import DialysisShiftTemplatesPanel from './DialysisShiftTemplatesPanel';
import DialysisPatientIntakePanel from './DialysisPatientIntakePanel';
import DialysisOverviewPanel from './DialysisOverviewPanel';
import DialysisMachinesPanel from './DialysisMachinesPanel';
import DialysisPatientDetailModal from './DialysisPatientDetailModal';
import DialysisInventoryPanel from './DialysisInventoryPanel';
import DialysisSessionClinicalDrawer from './DialysisSessionClinicalDrawer';
import { formatDialysisCalendarDate } from './dialysisConstants';
import type { ColumnsType } from 'antd/es/table';

const { Content } = Layout;
const { Title, Text } = Typography;
const { TabPane } = Tabs;
const { TextArea } = Input;

const HOSPITAL_STORAGE_KEY = 'dialysis_hospital_id';

interface HospitalRow {
  id: number;
  name: string;
  code?: string | null;
}

interface DialysisPatientRow {
  id: number;
  fullName: string;
  kind: string;
  phone?: string | null;
  created_by_display?: string | null;
}

interface SessionRow {
  id: number;
  sessionDate: string;
  shift: string;
  status: string;
  dialysisPatient?: { fullName: string };
  created_by_display?: string | null;
}

interface ActiveSessionRow {
  id: number;
  status: string;
  startedAt?: string | null;
  dialysisPatient?: { fullName: string };
  location?: { hallName: string; bedCode: string } | null;
}

interface MachineApiRow {
  id: number;
  locationId?: number | null;
  assetTag?: string | null;
  location?: { hallName: string; bedCode: string } | null;
}

/** حقول موقع/شفت/جهزة داخل نموذج الجلسة — يجب أن يكون داخل `<Form>` */
const DialysisSessionExtraFields: React.FC<{ hospitalId: number }> = ({ hospitalId }) => {
  const form = Form.useFormInstance();
  const sessionDate = Form.useWatch('session_date', form);
  const locationId = Form.useWatch('location_id', form);
  const [locs, setLocs] = useState<{ id: number; hallName: string; bedCode: string }[]>([]);
  const [machines, setMachines] = useState<MachineApiRow[]>([]);
  const [slots, setSlots] = useState<{ id: number; name: string; startMinutes: number }[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [lr, mr] = await Promise.all([
          axios.get('/api/dialysis/locations', { params: { hospital_id: hospitalId } }),
          axios.get('/api/dialysis/machines', { params: { hospital_id: hospitalId } }),
        ]);
        if (!cancelled) {
          setLocs(lr.data);
          setMachines(mr.data);
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hospitalId]);

  useEffect(() => {
    if (!sessionDate || !hospitalId) {
      setSlots([]);
      return;
    }
    const wd = dayjs(sessionDate).day();
    let cancelled = false;
    (async () => {
      try {
        const { data } = await axios.get('/api/dialysis/shift-slots', {
          params: { hospital_id: hospitalId, weekday: wd },
        });
        if (!cancelled) setSlots(data);
      } catch {
        if (!cancelled) setSlots([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionDate, hospitalId]);

  const machineOpts = machines.filter(
    (m) => !locationId || m.locationId === locationId || m.locationId == null
  );

  return (
    <>
      <Form.Item
        name="location_id"
        label="القاعة — السرير"
        rules={[{ required: true, message: 'اختر القاعة/السرير' }]}
      >
        <Select
          placeholder="اختيار إلزامي"
          options={locs.map((l) => ({
            value: l.id,
            label: `${l.hallName} — سرير ${l.bedCode}`,
          }))}
        />
      </Form.Item>
      <Form.Item name="shift_slot_id" label="شفت الغسل">
        <Select
          allowClear
          placeholder="حسب يوم تاريخ الجلسة"
          options={slots.map((s) => ({
            value: s.id,
            label: `${s.name} (${String(Math.floor(s.startMinutes / 60)).padStart(2, '0')}:${String(s.startMinutes % 60).padStart(2, '0')})`,
          }))}
        />
      </Form.Item>
      <Form.Item name="machine_id" label="جهاز الغسل">
        <Select
          allowClear
          placeholder="اختياري"
          options={machineOpts.map((m) => ({
            value: m.id,
            label: `${m.assetTag || `جهاز #${m.id}`}${m.location ? ` — ${m.location.hallName}` : ''}`,
          }))}
        />
      </Form.Item>
    </>
  );
};

const DialysisDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;

  const canView = usePermission('dialysis:view');
  const canPatientCreate = usePermission('dialysis:patient:create');
  const canSessionCreate = usePermission('dialysis:session:create');
  const canSessionEdit = usePermission('dialysis:session:edit');
  const canSessionDelete = usePermission('dialysis:session:delete');
  const canReconciliation = usePermission('dialysis:reconciliation');
  const canBulkStats = usePermission('dialysis:stats:bulk');
  const canLocationManage = usePermission('dialysis:location:manage');
  const canPatientEdit = usePermission('dialysis:patient:edit');
  const canPatientDelete = usePermission('dialysis:patient:delete');

  const [detailPatientId, setDetailPatientId] = useState<number | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const [clinicalSessionId, setClinicalSessionId] = useState<number | null>(null);
  const [clinicalOpen, setClinicalOpen] = useState(false);

  const [hospitals, setHospitals] = useState<HospitalRow[]>([]);
  const [hospitalId, setHospitalId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const [patients, setPatients] = useState<DialysisPatientRow[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [activeSessions, setActiveSessions] = useState<ActiveSessionRow[]>([]);
  const [reconDateRange, setReconDateRange] = useState<[Dayjs, Dayjs]>([
    dayjs().startOf('month'),
    dayjs(),
  ]);
  const [reconResult, setReconResult] = useState<any>(null);

  const [patientDrawerOpen, setPatientDrawerOpen] = useState(false);
  const [sessionDrawerOpen, setSessionDrawerOpen] = useState(false);

  const [patientForm] = Form.useForm();
  const [sessionForm] = Form.useForm();

  const loadHospitals = useCallback(async () => {
    try {
      const { data } = await axios.get<HospitalRow[]>('/api/dialysis/hospitals');
      setHospitals(data);
      const stored = localStorage.getItem(HOSPITAL_STORAGE_KEY);
      const sid = stored ? parseInt(stored, 10) : NaN;
      if (!Number.isNaN(sid) && data.some((h) => h.id === sid)) {
        setHospitalId(sid);
      } else if (data.length === 1) {
        setHospitalId(data[0].id);
        localStorage.setItem(HOSPITAL_STORAGE_KEY, String(data[0].id));
      }
    } catch {
      message.error('تعذر تحميل قائمة المستشفيات');
    }
  }, []);

  const fetchPatients = useCallback(async () => {
    if (!hospitalId) return;
    setLoading(true);
    try {
      const { data } = await axios.get<DialysisPatientRow[]>('/api/dialysis/patients', {
        params: { hospital_id: hospitalId },
      });
      setPatients(data);
    } catch {
      message.error('فشل جلب مرضى الغسل الكلوي');
    } finally {
      setLoading(false);
    }
  }, [hospitalId]);

  const fetchSessions = useCallback(async () => {
    if (!hospitalId) return;
    setLoading(true);
    try {
      const { data } = await axios.get<SessionRow[]>('/api/dialysis/sessions', {
        params: { hospital_id: hospitalId },
      });
      setSessions(data);
    } catch {
      message.error('فشل جلب الجلسات');
    } finally {
      setLoading(false);
    }
  }, [hospitalId]);

  const fetchActiveOnly = useCallback(async () => {
    if (!hospitalId) return;
    try {
      const { data } = await axios.get<ActiveSessionRow[]>('/api/dialysis/sessions/active', {
        params: { hospital_id: hospitalId },
      });
      setActiveSessions(data);
    } catch {
      /* صامت للاستطلاع الدوري */
    }
  }, [hospitalId]);

  useEffect(() => {
    loadHospitals();
  }, [loadHospitals]);

  useEffect(() => {
    if (hospitalId) {
      fetchPatients();
      fetchSessions();
      fetchActiveOnly();
    }
  }, [hospitalId, fetchPatients, fetchSessions, fetchActiveOnly]);

  useEffect(() => {
    if (!hospitalId) return undefined;
    const t = window.setInterval(() => fetchActiveOnly(), 15000);
    return () => window.clearInterval(t);
  }, [hospitalId, fetchActiveOnly]);

  const onHospitalChange = (id: number) => {
    setHospitalId(id);
    localStorage.setItem(HOSPITAL_STORAGE_KEY, String(id));
  };

  const submitPatient = async (values: any) => {
    if (!hospitalId) return;
    try {
      await axios.post('/api/dialysis/patients', {
        hospital_id: hospitalId,
        full_name: values.full_name,
        phone: values.phone,
        national_id: values.national_id,
        kind: values.kind || 'EMERGENCY',
      });
      message.success('تم حفظ المريض');
      patientForm.resetFields();
      setPatientDrawerOpen(false);
      fetchPatients();
    } catch (e: any) {
      message.error(e.response?.data?.error || 'فشل الحفظ');
    }
  };

  const submitSession = async (values: any) => {
    if (!hospitalId) return;
    try {
      await axios.post('/api/dialysis/sessions', {
        hospital_id: hospitalId,
        dialysis_patient_id: values.dialysis_patient_id,
        session_date: values.session_date.format('YYYY-MM-DD'),
        started_at: values.started_at
          ? dayjs(values.started_at).toISOString()
          : new Date().toISOString(),
        location_id: values.location_id ?? null,
        shift_slot_id: values.shift_slot_id ?? null,
        machine_id: values.machine_id ?? null,
        pre_systolic: values.pre_systolic ?? null,
        pre_diastolic: values.pre_diastolic ?? null,
        weight_pre_kg: values.weight_pre_kg ?? null,
        uf_goal_ml: values.uf_goal_ml ?? null,
        heart_rate_pre: values.heart_rate_pre ?? null,
        temperature_pre_c: values.temperature_pre_c ?? null,
        blood_flow_ml_min: values.blood_flow_ml_min ?? null,
        notes: values.notes ?? null,
        consumptions: [],
      });
      message.success('تم إنشاء الجلسة');
      sessionForm.resetFields();
      setSessionDrawerOpen(false);
      fetchSessions();
      fetchActiveOnly();
    } catch (e: any) {
      message.error(e.response?.data?.error || 'فشل إنشاء الجلسة');
    }
  };

  const endSession = async (id: number) => {
    try {
      await axios.patch(
        `/api/dialysis/sessions/${id}`,
        {
          status: 'COMPLETED',
          ended_at: new Date().toISOString(),
        },
        { params: { hospital_id: hospitalId ?? undefined } }
      );
      message.success('تم إنهاء الجلسة');
      fetchSessions();
      fetchActiveOnly();
    } catch (e: any) {
      message.error(e.response?.data?.error || 'فشل الإنهاء');
    }
  };

  const deleteSession = (id: number) => {
    Modal.confirm({
      title: 'حذف الجلسة؟',
      content: 'لن يُسترد السجل بعد الحذف.',
      okText: 'حذف',
      okType: 'danger',
      cancelText: 'إلغاء',
      onOk: async () => {
        try {
          await axios.delete(`/api/dialysis/sessions/${id}`, {
            params: { hospital_id: hospitalId },
          });
          message.success('تم الحذف');
          fetchSessions();
          fetchActiveOnly();
        } catch (e: any) {
          message.error(e.response?.data?.error || 'فشل الحذف');
        }
      },
    });
  };

  const runReconciliation = async () => {
    if (!hospitalId || !reconDateRange) return;
    setLoading(true);
    try {
      const { data } = await axios.get('/api/dialysis/reconciliation', {
        params: {
          hospital_id: hospitalId,
          from: reconDateRange[0].format('YYYY-MM-DD'),
          to: reconDateRange[1].format('YYYY-MM-DD'),
        },
      });
      setReconResult(data);
      message.success('تم تشغيل المطابقة');
    } catch {
      message.error('فشل المطابقة');
    } finally {
      setLoading(false);
    }
  };

  const submitBulkStats = async (raw: string) => {
    if (!hospitalId) return;
    try {
      const parsed = JSON.parse(raw);
      const entries = Array.isArray(parsed) ? parsed : parsed.entries;
      if (!Array.isArray(entries)) {
        message.error('يجب أن يكون الجذر مصفوفة أو يحتوي على entries');
        return;
      }
      await axios.post('/api/dialysis/statistical/bulk', {
        hospital_id: hospitalId,
        entries,
      });
      message.success('تم حفظ الإدخال الإحصائي');
    } catch (e: any) {
      message.error(e.response?.data?.error || 'تحقق من صيغة JSON');
    }
  };

  const patientCols: ColumnsType<DialysisPatientRow> = [
    { title: 'الاسم', dataIndex: 'fullName', key: 'fullName' },
    {
      title: 'النوع',
      dataIndex: 'kind',
      key: 'kind',
      render: (k: string) => (
        <Tag color={k === 'PERSISTENT' ? 'green' : 'orange'}>{k}</Tag>
      ),
    },
    { title: 'الهاتف', dataIndex: 'phone', key: 'phone' },
    { title: 'أنشئ بواسطة', dataIndex: 'created_by_display', key: 'cb' },
    {
      title: 'ملف',
      key: 'file',
      width: 90,
      render: (_, r) => (
        <Button type="link" size="small" onClick={() => {
          setDetailPatientId(r.id);
          setDetailOpen(true);
        }}>
          عرض
        </Button>
      ),
    },
  ];

  const sessionCols: ColumnsType<SessionRow> = [
    {
      title: 'التاريخ',
      dataIndex: 'sessionDate',
      key: 'sessionDate',
      render: (d: string) => formatDialysisCalendarDate(d),
    },
    { title: 'الوردية', dataIndex: 'shift', key: 'shift' },
    {
      title: 'المريض',
      key: 'p',
      render: (_, r) => r.dialysisPatient?.fullName ?? '—',
    },
    {
      title: 'الحالة',
      dataIndex: 'status',
      key: 'status',
      render: (s: string) => <Tag>{s}</Tag>,
    },
    { title: 'أنشئ بواسطة', dataIndex: 'created_by_display', key: 'cb' },
    {
      title: 'إجراءات',
      key: 'actions',
      render: (_: unknown, r: SessionRow) => (
        <Space size="small" wrap>
          <Button
            size="small"
            icon={<FileSearchOutlined />}
            onClick={() => {
              setClinicalSessionId(r.id);
              setClinicalOpen(true);
            }}
          >
            سجل كامل
          </Button>
          {canSessionEdit && r.status === 'ACTIVE' && (
            <Button size="small" type="primary" icon={<StopOutlined />} onClick={() => endSession(r.id)}>
              إنهاء
            </Button>
          )}
          {canSessionDelete && (
            <Button size="small" danger icon={<DeleteOutlined />} onClick={() => deleteSession(r.id)}>
              حذف
            </Button>
          )}
        </Space>
      ),
    },
  ];

  const bulkPlaceholder = `{
  "entries": [
    {
      "dialysis_patient_id": 1,
      "session_date": "2026-05-08",
      "shift": "MORNING",
      "folder_reference": "F-01",
      "consumptions": [{ "item_id": 1, "quantity_base": "2" }]
    }
  ]
}`;

  const patientFormInner = (
    <Form form={patientForm} layout="vertical" onFinish={submitPatient}>
      <Form.Item name="full_name" rules={[{ required: true }]} label="الاسم الكامل">
        <Input placeholder="الاسم الكامل" />
      </Form.Item>
      <Form.Item name="phone" label="الهاتف">
        <Input placeholder="الهاتف" />
      </Form.Item>
      <Form.Item name="national_id" label="رقم الهوية (اختياري)">
        <Input placeholder="رقم الهوية" />
      </Form.Item>
      <Form.Item name="kind" label="النوع" initialValue="EMERGENCY">
        <Select
          options={[
            { value: 'EMERGENCY', label: 'طوارئ' },
            { value: 'PERSISTENT', label: 'دائم' },
          ]}
        />
      </Form.Item>
      <Button type="primary" htmlType="submit" block>
        حفظ
      </Button>
    </Form>
  );

  const sessionFormInner = (
    <Form form={sessionForm} layout="vertical" onFinish={submitSession}>
      <Form.Item name="dialysis_patient_id" label="معرف مريض الغسيل" rules={[{ required: true }]}>
        <InputNumber style={{ width: '100%' }} min={1} />
      </Form.Item>
      <Form.Item name="session_date" label="تاريخ الجلسة" initialValue={dayjs()} rules={[{ required: true }]}>
        <DatePicker style={{ width: '100%' }} />
      </Form.Item>
      <Form.Item name="started_at" label="وقت البدء (اختياري)">
        <DatePicker showTime style={{ width: '100%' }} />
      </Form.Item>
      {hospitalId ? <DialysisSessionExtraFields hospitalId={hospitalId} /> : null}
      <Collapse
        ghost
        items={[
          {
            key: 'vitals',
            label: 'قياسات أولية (اختياري — يمكن إكمالها لاحقاً من «سجل كامل»)',
            children: (
              <>
                <Row gutter={12}>
                  <Col xs={12}>
                    <Form.Item name="pre_systolic" label="ضغط انقباضي قبل">
                      <InputNumber min={0} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                  <Col xs={12}>
                    <Form.Item name="pre_diastolic" label="ضغط انبساطي قبل">
                      <InputNumber min={0} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                  <Col xs={12}>
                    <Form.Item name="weight_pre_kg" label="وزن قبل (كغ)">
                      <InputNumber min={0} step={0.1} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                  <Col xs={12}>
                    <Form.Item name="uf_goal_ml" label="هدف UF (مل)">
                      <InputNumber min={0} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                  <Col xs={12}>
                    <Form.Item name="heart_rate_pre" label="نبض قبل">
                      <InputNumber min={0} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                  <Col xs={12}>
                    <Form.Item name="temperature_pre_c" label="حرارة °م">
                      <InputNumber min={30} max={42} step={0.1} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                  <Col xs={12}>
                    <Form.Item name="blood_flow_ml_min" label="تدفق دم (مل/د)">
                      <InputNumber min={0} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                </Row>
                <Form.Item name="notes" label="ملاحظات سريعة">
                  <TextArea rows={2} />
                </Form.Item>
              </>
            ),
          },
        ]}
      />
      <Button type="primary" htmlType="submit" block>
        إنشاء جلسة
      </Button>
    </Form>
  );

  if (!canView) {
    return (
      <Layout style={{ minHeight: '100vh', padding: 24 }}>
        <Text type="danger">لا تملك صلاحية عرض وحدة الغسيل.</Text>
      </Layout>
    );
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <ModernHeaderWithLogo
        roleName="نظام الغسل الكلوي — D-IRS"
        user={user}
        onLogout={logout}
        centerActions={
          <button type="button" className="modern-header-action-btn" onClick={() => navigate(-1)}>
            <ArrowLeftOutlined />
            <span>رجوع</span>
          </button>
        }
      />
      <Content style={{ padding: isMobile ? 12 : 24 }}>
        <Card style={{ marginBottom: 16 }}>
          <Space wrap align="center">
            <MedicineBoxOutlined style={{ fontSize: 24, color: '#722ed1' }} />
            <Title level={4} style={{ margin: 0 }}>
              نظام الغسل الكلوي
            </Title>
            <Text type="secondary" style={{ fontSize: 12 }}>
              نظرة عامة، إعداد القاعات والشفتات والأجهزة والمخزون، التشغيل الميداني والسجل السريري، الملفات، المطابقة
            </Text>
            <Divider type="vertical" />
            <Text>المستشفى:</Text>
            <Select
              style={{ minWidth: isMobile ? 200 : 280 }}
              placeholder="اختر المستشفى"
              value={hospitalId ?? undefined}
              onChange={onHospitalChange}
              options={hospitals.map((h) => ({
                value: h.id,
                label: `${h.name}${h.code ? ` (${h.code})` : ''}`,
              }))}
            />
            <Button
              icon={<ReloadOutlined />}
              onClick={() => {
                fetchPatients();
                fetchSessions();
                fetchActiveOnly();
              }}
            >
              تحديث
            </Button>
          </Space>
        </Card>

        {!hospitalId ? (
          <Card>
            <Text type="secondary">
              لا يوجد مستشفى أو لم يتم الاختيار. شغّل البذور أو أنشئ مستشفى من API.
            </Text>
          </Card>
        ) : (
          <Spin spinning={loading}>
            <Tabs defaultActiveKey="overview">
              <TabPane
                tab={
                  <span>
                    <DashboardOutlined /> نظرة عامة
                  </span>
                }
                key="overview"
              >
                <DialysisOverviewPanel hospitalId={hospitalId} />
              </TabPane>

              <TabPane
                tab={
                  <span>
                    <FormOutlined /> التسجيل والإعداد
                  </span>
                }
                key="registry"
              >
                <Tabs defaultActiveKey="intake">
              <TabPane
                tab={
                  <span>
                    <FormOutlined /> إدخال مريض
                  </span>
                }
                key="intake"
              >
                <DialysisPatientIntakePanel
                  hospitalId={hospitalId}
                  canCreate={canPatientCreate}
                  onPatientCreated={() => {
                    fetchPatients();
                  }}
                />
              </TabPane>

              <TabPane
                tab={
                  <span>
                    <ApartmentOutlined /> هيكلية القاعات والأسرة
                  </span>
                }
                key="setup-halls"
              >
                <DialysisStructurePanel hospitalId={hospitalId} canManage={canLocationManage} />
              </TabPane>

              <TabPane
                tab={
                  <span>
                    <ClockCircleOutlined /> شفتات الغسل اليومية
                  </span>
                }
                key="setup-shifts"
              >
                <DialysisShiftTemplatesPanel hospitalId={hospitalId} canManage={canLocationManage} />
              </TabPane>

              <TabPane
                tab={
                  <span>
                    <HddOutlined /> أجهزة الغسل
                  </span>
                }
                key="setup-machines"
              >
                <DialysisMachinesPanel hospitalId={hospitalId} canManage={canLocationManage} />
              </TabPane>

              <TabPane
                tab={
                  <span>
                    <InboxOutlined /> المستودع والمواد
                  </span>
                }
                key="setup-inventory"
              >
                <DialysisInventoryPanel hospitalId={hospitalId} canManage={canLocationManage} />
              </TabPane>
                </Tabs>
              </TabPane>

              <TabPane
                tab={
                  <span>
                    <ThunderboltOutlined /> التشغيل الميداني
                  </span>
                }
                key="ops"
              >
                <Tabs defaultActiveKey="hall">
              <TabPane
                tab={
                  <span>
                    <ThunderboltOutlined /> القاعة (نشط)
                  </span>
                }
                key="hall"
              >
                <Card title={`جلسات نشطة (${activeSessions.length}) — تحديث تلقائي كل 15 ثانية`}>
                  <Table
                    rowKey="id"
                    size="small"
                    pagination={false}
                    dataSource={activeSessions}
                    columns={[
                      {
                        title: 'المريض',
                        render: (_, r) => r.dialysisPatient?.fullName ?? '—',
                      },
                      {
                        title: 'المكان',
                        render: (_, r) =>
                          r.location ? `${r.location.hallName} — ${r.location.bedCode}` : '—',
                      },
                      {
                        title: 'بدء',
                        dataIndex: 'startedAt',
                        render: (t: string | null) => (t ? dayjs(t).format('HH:mm') : '—'),
                      },
                      {
                        title: 'إجراء',
                        render: (_, r) => (
                          <Space>
                            {canSessionEdit && (
                              <Button size="small" type="primary" onClick={() => endSession(r.id)}>
                                إنهاء
                              </Button>
                            )}
                            {canSessionDelete && (
                              <Button size="small" danger onClick={() => deleteSession(r.id)}>
                                حذف
                              </Button>
                            )}
                          </Space>
                        ),
                      },
                    ]}
                  />
                </Card>
              </TabPane>

              <TabPane
                tab={
                  <span>
                    <CalendarOutlined /> الجلسات (الميدان)
                  </span>
                }
                key="sessions"
              >
                {canSessionCreate && !isMobile && (
                  <Card title="جلسة جديدة" style={{ marginBottom: 16 }}>
                    <div style={{ maxWidth: 560 }}>{sessionFormInner}</div>
                  </Card>
                )}
                <Card title="آخر الجلسات">
                  <Table rowKey="id" columns={sessionCols} dataSource={sessions} pagination={{ pageSize: 8 }} />
                </Card>
              </TabPane>
                </Tabs>
              </TabPane>

              <TabPane
                tab={
                  <span>
                    <TeamOutlined /> المرضى والملفات
                  </span>
                }
                key="patients-main"
              >
                {canPatientCreate && !isMobile && (
                  <Card title="إضافة مريض غسيل سريع" style={{ marginBottom: 16 }}>
                    <Form form={patientForm} layout="inline" onFinish={submitPatient}>
                      <Form.Item name="full_name" rules={[{ required: true }]}>
                        <Input placeholder="الاسم الكامل" />
                      </Form.Item>
                      <Form.Item name="phone">
                        <Input placeholder="الهاتف" />
                      </Form.Item>
                      <Form.Item name="national_id">
                        <Input placeholder="رقم الهوية (اختياري)" />
                      </Form.Item>
                      <Form.Item name="kind" initialValue="EMERGENCY">
                        <Select
                          style={{ width: 140 }}
                          options={[
                            { value: 'EMERGENCY', label: 'طوارئ' },
                            { value: 'PERSISTENT', label: 'دائم' },
                          ]}
                        />
                      </Form.Item>
                      <Button type="primary" htmlType="submit">
                        حفظ
                      </Button>
                    </Form>
                  </Card>
                )}
                <Card title="قائمة مرضى الغسل — اضغط «عرض» لملف كامل وجدول الأسبوع">
                  <Table rowKey="id" columns={patientCols} dataSource={patients} pagination={{ pageSize: 8 }} />
                </Card>
              </TabPane>

              {(canReconciliation || canBulkStats) && (
                <TabPane
                  tab={
                    <span>
                      <FundOutlined /> المطابقة والإحصاء
                    </span>
                  }
                  key="analytics"
                >
                  <Space direction="vertical" size="large" style={{ width: '100%' }}>
                    {canReconciliation && (
                      <Card title="مطابقة الميدان مع الإحصاء">
                        <Space wrap>
                          <Text>من — إلى:</Text>
                          <DatePicker.RangePicker
                            value={reconDateRange}
                            onChange={(v) => v && setReconDateRange(v as [Dayjs, Dayjs])}
                          />
                          <Button type="primary" onClick={runReconciliation}>
                            تشغيل المقارنة
                          </Button>
                        </Space>
                        {reconResult && (
                          <div style={{ marginTop: 24 }}>
                            <Title level={5}>مجلدات ناقصة في الإحصاء</Title>
                            <Table
                              size="small"
                              rowKey={(r: Record<string, unknown>) =>
                                `${r.dialysisPatientId}-${String(r.sessionDate)}-${r.shift}`
                              }
                              dataSource={reconResult.missed_folders || []}
                              columns={[
                                { title: 'المريض', dataIndex: 'patient_name', key: 'pn' },
                                {
                                  title: 'التاريخ',
                                  dataIndex: 'sessionDate',
                                  key: 'd',
                                  render: (d: string) => formatDialysisCalendarDate(d),
                                },
                                { title: 'الوردية', dataIndex: 'shift', key: 's' },
                              ]}
                              pagination={false}
                            />
                            <Title level={5} style={{ marginTop: 16 }}>
                              جلسات شبح (في الإحصاء فقط)
                            </Title>
                            <Table
                              size="small"
                              rowKey={(r: Record<string, unknown>) =>
                                `${r.dialysisPatientId}-${String(r.sessionDate)}-${r.shift}`
                              }
                              dataSource={reconResult.ghost_sessions || []}
                              columns={[
                                { title: 'المريض', dataIndex: 'patient_name', key: 'pn' },
                                {
                                  title: 'التاريخ',
                                  dataIndex: 'sessionDate',
                                  key: 'd',
                                  render: (d: string) => formatDialysisCalendarDate(d),
                                },
                                { title: 'الوردية', dataIndex: 'shift', key: 's' },
                              ]}
                              pagination={false}
                            />
                            <Title level={5} style={{ marginTop: 16 }}>
                              فروق المواد
                            </Title>
                            <Table
                              size="small"
                              rowKey={(r: Record<string, unknown>) =>
                                `${r.dialysisPatientId}-${r.item_id}`
                              }
                              dataSource={reconResult.supply_discrepancies || []}
                              columns={[
                                { title: 'المريض', dataIndex: 'patient_name', key: 'pn' },
                                { title: 'المادة id', dataIndex: 'item_id', key: 'i' },
                                { title: 'حقل', dataIndex: 'quantity_field', key: 'qf' },
                                { title: 'إحصاء', dataIndex: 'quantity_stats', key: 'qs' },
                                { title: 'فرق', dataIndex: 'delta', key: 'd' },
                              ]}
                              pagination={false}
                            />
                          </div>
                        )}
                      </Card>
                    )}
                    {canBulkStats && (
                      <Card title="إدخال إحصائي جماعي (JSON)">
                        <BulkStatsForm placeholder={bulkPlaceholder} onSubmit={submitBulkStats} />
                      </Card>
                    )}
                  </Space>
                </TabPane>
              )}
            </Tabs>

            {isMobile && (canPatientCreate || canSessionCreate) && (
              <FloatButton.Group trigger="click" icon={<PlusOutlined />} style={{ insetInlineEnd: 24, bottom: 88 }}>
                {canPatientCreate && (
                  <FloatButton icon={<TeamOutlined />} tooltip="مريض جديد" onClick={() => setPatientDrawerOpen(true)} />
                )}
                {canSessionCreate && (
                  <FloatButton
                    icon={<CalendarOutlined />}
                    tooltip="جلسة جديدة"
                    onClick={() => setSessionDrawerOpen(true)}
                  />
                )}
              </FloatButton.Group>
            )}

            <Drawer
              title="مريض جديد"
              placement={isMobile ? 'bottom' : 'right'}
              height={isMobile ? '72%' : undefined}
              open={patientDrawerOpen}
              onClose={() => setPatientDrawerOpen(false)}
              destroyOnClose
            >
              {patientFormInner}
            </Drawer>

            <Drawer
              title="جلسة جديدة"
              placement={isMobile ? 'bottom' : 'right'}
              height={isMobile ? '72%' : undefined}
              open={sessionDrawerOpen}
              onClose={() => setSessionDrawerOpen(false)}
              destroyOnClose
            >
              {sessionFormInner}
            </Drawer>

            <DialysisPatientDetailModal
              open={detailOpen}
              patientId={detailPatientId}
              hospitalId={hospitalId}
              canEdit={canPatientEdit}
              canDelete={canPatientDelete}
              onClose={() => {
                setDetailOpen(false);
                setDetailPatientId(null);
              }}
              onSaved={() => {
                fetchPatients();
                fetchSessions();
                fetchActiveOnly();
              }}
            />

            <DialysisSessionClinicalDrawer
              open={clinicalOpen}
              sessionId={clinicalSessionId}
              hospitalId={hospitalId}
              canEdit={canSessionEdit}
              onClose={() => {
                setClinicalOpen(false);
                setClinicalSessionId(null);
              }}
              onSaved={() => {
                fetchSessions();
                fetchActiveOnly();
              }}
            />
          </Spin>
        )}
      </Content>
    </Layout>
  );
};

const BulkStatsForm: React.FC<{ placeholder: string; onSubmit: (raw: string) => void }> = ({
  placeholder,
  onSubmit,
}) => {
  const [text, setText] = useState(placeholder);
  return (
    <Space direction="vertical" style={{ width: '100%' }}>
      <TextArea rows={12} value={text} onChange={(e) => setText(e.target.value)} />
      <Button type="primary" onClick={() => onSubmit(text)}>
        إرسال
      </Button>
    </Space>
  );
};

export default DialysisDashboard;
