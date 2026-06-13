import React, { useEffect, useState, useCallback, useMemo, lazy, Suspense } from 'react';
import {
  Table,
  Button,
  Space,
  Tag,
  Drawer,
  Form,
  InputNumber,
  DatePicker,
  TimePicker,
  Select,
  Input,
  Row,
  Col,
  Collapse,
  Modal,
  message,
  Typography,
  Empty,
  Alert,
  Spin,
  Segmented,
  Tooltip,
  Pagination,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  PlusOutlined,
  ReloadOutlined,
  StopOutlined,
  DeleteOutlined,
  FileSearchOutlined,
  CalendarOutlined,
  ThunderboltOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  TeamOutlined,
  ClearOutlined,
  FilterOutlined,
  UserOutlined,
  ScanOutlined,
} from '@ant-design/icons';
import axios from 'axios';
import dayjs, { Dayjs } from 'dayjs';
import {
  ALL_MY_HOSPITALS,
  useDialysisContext,
  useEffectiveDialysisHospitalId,
} from '../dialysisContext';
import { useDialysisMobile } from '../useDialysisMobile';
import { useDialysisOverlayLock } from '../useDialysisOverlayLock';
import { usePermission } from '../../../../hooks/usePermission';
import DialysisSessionClinicalDrawer from '../../DialysisSessionClinicalDrawer';
import { formatDialysisCalendarDate } from '../../dialysisConstants';
import DialysisPullRefresh from '../DialysisPullRefresh';
import DialysisMobileFab from '../DialysisMobileFab';
import SessionMobileCard from './SessionMobileCard';
import './sessions-page.css';
import { DIALYSIS_FACE_ENABLED } from '../../face/dialysisFaceConfig';

const DialysisFaceIdentifyModal = lazy(
  () => import('../../face/DialysisFaceIdentifyModal')
);

const { Text } = Typography;
const MOBILE_PAGE_SIZE = 15;
const { TextArea } = Input;
const { RangePicker } = DatePicker;

interface SessionRow {
  id: number;
  hospitalId?: number;
  hospital?: { id: number; name: string; code?: string | null };
  sessionDate: string;
  shift: string;
  status: string;
  intakeKind?: string | null;
  patientMatchMethod?: 'MANUAL' | 'FACE' | null;
  startedAt?: string | null;
  endedAt?: string | null;
  dialysisPatient?: { fullName: string; kind?: string };
  location?: { hallName: string; bedCode: string } | null;
  shiftSlot?: { name: string; startMinutes?: number } | null;
  created_by_display?: string | null;
  createdAt?: string;
}

interface PatientLite {
  id: number;
  fullName: string;
  kind?: string;
}
interface LocLite {
  id: number;
  hallName: string;
  bedCode: string;
}
interface SlotLite {
  id: number;
  name: string;
  startMinutes: number;
  weekday: number;
}
interface MachineLite {
  id: number;
  assetTag?: string | null;
  locationId?: number | null;
}

interface IntakeHints {
  patientKind: string;
  isScheduleDay: boolean;
  previewIntakeKind: string;
  defaultLocationId: number | null;
  defaultShiftSlotId: number | null;
  suggestedStartedAt: string | null;
  registrationBlocked?: boolean;
  registrationBlockedReason?: string | null;
  existingSession?: { id: number; status: string; startedAt?: string | null } | null;
}

interface SessionKpis {
  total: number;
  active: number;
  scheduled: number;
  completed: number;
  cancelled: number;
  uniquePatients: number;
  byIntakeKind: Record<string, number>;
}

type PeriodPreset = 'today' | 'week' | 'month' | 'all' | 'custom';

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  ACTIVE: { label: 'نشطة', color: 'red' },
  SCHEDULED: { label: 'مجدولة', color: 'blue' },
  COMPLETED: { label: 'منتهية', color: 'green' },
  CANCELLED: { label: 'ملغاة', color: 'default' },
};

const INTAKE_KIND_LABEL: Record<string, { label: string; color: string }> = {
  SCHEDULED: { label: 'مجدولة', color: 'blue' },
  OFF_SCHEDULE: { label: 'غير مجدولة', color: 'orange' },
  EMERGENCY: { label: 'غسلة طارئة', color: 'volcano' },
};

const PATIENT_MATCH_LABEL: Record<string, { label: string; color: string }> = {
  MANUAL: { label: 'يدوي', color: 'default' },
  FACE: { label: 'تعرف بالوجه', color: 'purple' },
};

function patientMatchDisplay(method?: string | null): { label: string; color: string } {
  if (method === 'FACE') return PATIENT_MATCH_LABEL.FACE;
  return PATIENT_MATCH_LABEL.MANUAL;
}

const KPI_ICON_BG: Record<string, string> = {
  total: 'linear-gradient(135deg,#6366f1,#4f46e5)',
  active: 'linear-gradient(135deg,#ef4444,#b91c1c)',
  completed: 'linear-gradient(135deg,#22c55e,#15803d)',
  scheduled: 'linear-gradient(135deg,#3b82f6,#1d4ed8)',
  cancelled: 'linear-gradient(135deg,#94a3b8,#64748b)',
  patients: 'linear-gradient(135deg,#a855f7,#7e22ce)',
};

function mergeSessionDateWithStartTime(sessionDate: Dayjs, timeOnly: Dayjs): string {
  return sessionDate
    .hour(timeOnly.hour())
    .minute(timeOnly.minute())
    .second(timeOnly.second())
    .millisecond(0)
    .toISOString();
}

function dateRangeForPeriod(
  period: PeriodPreset,
  custom: [Dayjs, Dayjs] | null
): { date_from?: string; date_to?: string } {
  const d0 = dayjs().startOf('day');
  switch (period) {
    case 'today':
      return { date_from: d0.format('YYYY-MM-DD'), date_to: d0.format('YYYY-MM-DD') };
    case 'week':
      return {
        date_from: d0.startOf('week').format('YYYY-MM-DD'),
        date_to: d0.endOf('week').format('YYYY-MM-DD'),
      };
    case 'month':
      return {
        date_from: d0.startOf('month').format('YYYY-MM-DD'),
        date_to: d0.endOf('month').format('YYYY-MM-DD'),
      };
    case 'all':
      return {};
    case 'custom':
      if (custom?.[0]?.isValid() && custom?.[1]?.isValid()) {
        const a = custom[0].startOf('day');
        const b = custom[1].startOf('day');
        const [from, to] = a.isAfter(b) ? [b, a] : [a, b];
        return { date_from: from.format('YYYY-MM-DD'), date_to: to.format('YYYY-MM-DD') };
      }
      return {};
    default:
      return {};
  }
}

const SessionsPage: React.FC = () => {
  const { hospitalId } = useDialysisContext();
  const effectiveHospitalId = useEffectiveDialysisHospitalId();
  const mergedScope = hospitalId === ALL_MY_HOSPITALS;
  const isMobile = useDialysisMobile();
  const canCreate = usePermission('dialysis:session:create');
  const canEdit = usePermission('dialysis:session:edit');
  const canDelete = usePermission('dialysis:session:delete');

  const [rows, setRows] = useState<SessionRow[]>([]);
  const [kpis, setKpis] = useState<SessionKpis | null>(null);
  const [loading, setLoading] = useState(false);

  const [period, setPeriod] = useState<PeriodPreset>('today');
  const [customRange, setCustomRange] = useState<[Dayjs, Dayjs]>(() => [
    dayjs().subtract(7, 'day').startOf('day'),
    dayjs().endOf('day'),
  ]);
  const [filterStatus, setFilterStatus] = useState<string | undefined>();
  const [filterIntakeKind, setFilterIntakeKind] = useState<string | undefined>();
  const [filterPatientMatch, setFilterPatientMatch] = useState<string | undefined>();
  const [filterPatientId, setFilterPatientId] = useState<number | undefined>();
  const [searchName, setSearchName] = useState('');

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [faceIdentifyOpen, setFaceIdentifyOpen] = useState(false);
  const [patientMatchMethod, setPatientMatchMethod] = useState<'MANUAL' | 'FACE'>('MANUAL');
  const [form] = Form.useForm();
  const [patients, setPatients] = useState<PatientLite[]>([]);
  const [locations, setLocations] = useState<LocLite[]>([]);
  const [slots, setSlots] = useState<SlotLite[]>([]);
  const [machines, setMachines] = useState<MachineLite[]>([]);
  const [intakeHints, setIntakeHints] = useState<IntakeHints | null>(null);

  const [mobilePage, setMobilePage] = useState(1);

  const [clinicalOpen, setClinicalOpen] = useState(false);

  useDialysisOverlayLock(isMobile && (drawerOpen || clinicalOpen || faceIdentifyOpen));
  const [clinicalId, setClinicalId] = useState<number | null>(null);
  const [clinicalHospitalId, setClinicalHospitalId] = useState<number | null>(null);

  const watchedSessionDate = Form.useWatch('session_date', form);

  const isSessionToday = Boolean(
    watchedSessionDate && dayjs(watchedSessionDate).isSame(dayjs(), 'day')
  );

  const sessionStartDisabledTime = useMemo(() => {
    if (!isSessionToday) return undefined;
    const now = dayjs();
    return () => ({
      disabledHours: () => {
        const list: number[] = [];
        for (let h = now.hour() + 1; h < 24; h += 1) list.push(h);
        return list;
      },
      disabledMinutes: (selectedHour: number) => {
        if (selectedHour === now.hour()) {
          const list: number[] = [];
          for (let m = now.minute() + 1; m < 60; m += 1) list.push(m);
          return list;
        }
        return [];
      },
    });
  }, [isSessionToday]);

  const filterParams = useMemo(() => {
    const dr = dateRangeForPeriod(period, customRange);
    const params: Record<string, string | number> = {};
    if (dr.date_from) params.date_from = dr.date_from;
    if (dr.date_to) params.date_to = dr.date_to;
    if (filterStatus) params.status = filterStatus;
    if (filterIntakeKind) params.intake_kind = filterIntakeKind;
    if (filterPatientMatch) params.patient_match_method = filterPatientMatch;
    if (filterPatientId) params.dialysis_patient_id = filterPatientId;
    const q = searchName.trim();
    if (q) params.search = q;
    return params;
  }, [period, customRange, filterStatus, filterIntakeKind, filterPatientMatch, filterPatientId, searchName]);

  const load = useCallback(async () => {
    if (hospitalId == null) return;
    setLoading(true);
    try {
      const base = { hospital_id: hospitalId, ...filterParams, limit: 400 };
      const [listRes, kpiRes] = await Promise.all([
        axios.get<SessionRow[]>('/api/dialysis/sessions', { params: base }),
        axios.get<SessionKpis>('/api/dialysis/sessions/kpis', { params: { hospital_id: hospitalId, ...filterParams } }),
      ]);
      setRows(listRes.data);
      setKpis(kpiRes.data);
    } catch {
      message.error('فشل جلب الجلسات');
      setKpis(null);
    } finally {
      setLoading(false);
    }
  }, [hospitalId, filterParams]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setMobilePage(1);
  }, [period, customRange, filterStatus, filterIntakeKind, filterPatientMatch, filterPatientId, searchName, hospitalId]);

  useEffect(() => {
    if (hospitalId == null) return;
    axios
      .get<PatientLite[]>('/api/dialysis/patients', { params: { hospital_id: hospitalId } })
      .then((r) => setPatients(r.data))
      .catch(() => {});
  }, [hospitalId]);

  const loadRefs = useCallback(async () => {
    if (hospitalId == null) return;
    try {
      const params = { hospital_id: hospitalId };
      const [p, l, m] = await Promise.all([
        axios.get<PatientLite[]>('/api/dialysis/patients', { params }),
        axios.get<LocLite[]>('/api/dialysis/locations', { params }),
        axios.get<MachineLite[]>('/api/dialysis/machines', { params }),
      ]);
      setPatients(p.data);
      setLocations(l.data);
      setMachines(m.data);
    } catch {
      /* ignore */
    }
  }, [hospitalId]);

  const fetchAndApplyHints = useCallback(
    async (patientId: number | undefined, sessionDate: Dayjs | null | undefined) => {
      if (hospitalId == null || !patientId || !sessionDate?.isValid()) {
        setIntakeHints(null);
        return;
      }
      const dateStr = sessionDate.format('YYYY-MM-DD');
      try {
        const { data } = await axios.get<IntakeHints>(
          `/api/dialysis/patients/${patientId}/intake-hints`,
          { params: { hospital_id: hospitalId, date: dateStr } }
        );
        setIntakeHints(data);
        form.setFieldsValue({
          location_id: data.defaultLocationId ?? undefined,
          shift_slot_id: data.defaultShiftSlotId ?? undefined,
          started_at: data.suggestedStartedAt ? dayjs(data.suggestedStartedAt) : dayjs(),
        });
      } catch {
        setIntakeHints(null);
      }
    },
    [hospitalId, form]
  );

  const handleFacePatientSelected = useCallback(
    (patientId: number) => {
      setPatientMatchMethod('FACE');
      form.setFieldsValue({ dialysis_patient_id: patientId });
      const sd = (form.getFieldValue('session_date') as Dayjs | undefined) ?? dayjs();
      void fetchAndApplyHints(patientId, sd);
    },
    [form, fetchAndApplyHints]
  );

  const reloadSlots = useCallback(
    async (date: Dayjs | null) => {
      if (hospitalId == null || !date) {
        setSlots([]);
        return;
      }
      try {
        const wd = date.day();
        const { data } = await axios.get<SlotLite[]>('/api/dialysis/shift-slots', {
          params: { hospital_id: hospitalId, weekday: wd },
        });
        setSlots(data);
      } catch {
        setSlots([]);
      }
    },
    [hospitalId]
  );

  const faceHospitalId =
    typeof hospitalId === 'number' ? hospitalId : effectiveHospitalId;

  const openCreate = () => {
    if (mergedScope) {
      message.warning('لإنشاء جلسة جديدة اختر مستشفى واحداً من القائمة أعلاه.');
      return;
    }
    loadRefs();
    form.resetFields();
    setIntakeHints(null);
    setPatientMatchMethod('MANUAL');
    form.setFieldsValue({ session_date: dayjs(), started_at: dayjs() });
    reloadSlots(dayjs());
    setDrawerOpen(true);
  };

  const resetFilters = () => {
    setPeriod('today');
    setCustomRange([dayjs().subtract(7, 'day').startOf('day'), dayjs().endOf('day')]);
    setFilterStatus(undefined);
    setFilterIntakeKind(undefined);
    setFilterPatientMatch(undefined);
    setFilterPatientId(undefined);
    setSearchName('');
  };

  const submit = async () => {
    try {
      const v = await form.validateFields();
      if (intakeHints?.registrationBlocked) {
        message.error(intakeHints.registrationBlockedReason || 'التسجيل غير مسموح لهذا التاريخ أو الشفت.');
        return;
      }
      if (intakeHints?.existingSession) {
        message.error('يوجد للمريض جلسة في هذا اليوم — لا يمكن إنشاء جلسة ثانية.');
        return;
      }
      const sessionD = v.session_date as Dayjs;
      if (sessionD.startOf('day').isAfter(dayjs().startOf('day'))) {
        message.error('لا يمكن تسجيل غسلة لتاريخ مستقبلي.');
        return;
      }
      const timeOnly = (v.started_at as Dayjs | undefined) ?? dayjs();
      const mergedStart = dayjs(mergeSessionDateWithStartTime(sessionD, timeOnly));
      if (mergedStart.isAfter(dayjs())) {
        message.error('وقت بدء الغسلة لا يمكن أن يكون في المستقبل.');
        return;
      }
      if (!v.location_id) {
        message.error('القاعة/السرير إلزامي لتسجيل الغسلة.');
        return;
      }
      if (intakeHints?.previewIntakeKind === 'OFF_SCHEDULE') {
        if (!v.shift_slot_id || !v.started_at) {
          message.error('اليوم ليس ضمن جدول المريض الدائم: أدخل الشفت ووقت البدء.');
          return;
        }
      }
      if (effectiveHospitalId == null) {
        message.error('لا يوجد مستشفى افتراضي — اختر مستشفى محدداً.');
        return;
      }
      await axios.post('/api/dialysis/sessions', {
        hospital_id: effectiveHospitalId,
        dialysis_patient_id: v.dialysis_patient_id,
        session_date: sessionD.format('YYYY-MM-DD'),
        started_at: mergeSessionDateWithStartTime(sessionD, timeOnly),
        location_id: v.location_id ?? null,
        shift_slot_id: v.shift_slot_id ?? null,
        machine_id: v.machine_id ?? null,
        pre_systolic: v.pre_systolic ?? null,
        pre_diastolic: v.pre_diastolic ?? null,
        weight_pre_kg: v.weight_pre_kg ?? null,
        uf_goal_ml: v.uf_goal_ml ?? null,
        heart_rate_pre: v.heart_rate_pre ?? null,
        temperature_pre_c: v.temperature_pre_c ?? null,
        notes: v.notes ?? null,
        patient_match_method: patientMatchMethod,
      });
      message.success('تم إنشاء الجلسة');
      setDrawerOpen(false);
      load();
    } catch (e: unknown) {
      const err = e as { errorFields?: unknown; response?: { status?: number; data?: { error?: string } } };
      if (err.errorFields) return;
      const msg = err.response?.data?.error || 'فشل إنشاء الجلسة';
      message.error(msg);
    }
  };

  const endSession = async (id: number, rowHospitalId?: number) => {
    try {
      const hid = rowHospitalId ?? (typeof hospitalId === 'number' ? hospitalId : effectiveHospitalId);
      await axios.patch(
        `/api/dialysis/sessions/${id}`,
        { status: 'COMPLETED', ended_at: new Date().toISOString() },
        { params: hid ? { hospital_id: hid } : {} }
      );
      message.success('تم إنهاء الجلسة');
      load();
    } catch {
      message.error('فشل إنهاء الجلسة');
    }
  };

  const removeSession = (id: number, rowHospitalId?: number) => {
    Modal.confirm({
      title: 'حذف الجلسة؟',
      okText: 'حذف',
      okType: 'danger',
      cancelText: 'إلغاء',
      onOk: async () => {
        try {
          const hid = rowHospitalId ?? (typeof hospitalId === 'number' ? hospitalId : effectiveHospitalId);
          await axios.delete(`/api/dialysis/sessions/${id}`, {
            params: hid ? { hospital_id: hid } : {},
          });
          message.success('تم الحذف');
          load();
        } catch {
          message.error('فشل الحذف');
        }
      },
    });
  };

  const mobilePageRows = useMemo(() => {
    const start = (mobilePage - 1) * MOBILE_PAGE_SIZE;
    return rows.slice(start, start + MOBILE_PAGE_SIZE);
  }, [rows, mobilePage]);

  const kpiCards = useMemo(() => {
    if (!kpis) return [];
    return [
      { key: 'total', label: 'إجمالي الجلسات', value: kpis.total, icon: <CalendarOutlined /> },
      { key: 'active', label: 'نشطة الآن', value: kpis.active, icon: <ThunderboltOutlined /> },
      { key: 'completed', label: 'منتهية', value: kpis.completed, icon: <CheckCircleOutlined /> },
      { key: 'scheduled', label: 'مجدولة', value: kpis.scheduled, icon: <ClockCircleOutlined /> },
      { key: 'cancelled', label: 'ملغاة', value: kpis.cancelled, icon: <CloseCircleOutlined /> },
      { key: 'patients', label: 'مرضى مختلفون', value: kpis.uniquePatients, icon: <TeamOutlined /> },
    ];
  }, [kpis]);

  const hasConflict = Boolean(intakeHints?.existingSession);
  const registrationBlocked = Boolean(intakeHints?.registrationBlocked);
  const columns = useMemo<ColumnsType<SessionRow>>(() => {
    if (isMobile) {
      return [
        {
          title: 'تفاصيل الجلسة',
          key: 'mobile_details',
          render: (_: unknown, r: SessionRow): React.ReactNode => (
            <div className="d-session-mobile-cell">
              {mergedScope && r.hospital?.name ? (
                <div className="d-session-mobile-row">
                  <Tag color="geekblue">{r.hospital.name}</Tag>
                </div>
              ) : null}
              <div className="d-session-mobile-row">
                <Text strong>{r.dialysisPatient?.fullName ?? '—'}</Text>
                {r.dialysisPatient?.kind ? (
                  <Tag
                    style={{ marginInlineStart: 6 }}
                    color={r.dialysisPatient.kind === 'EMERGENCY' ? 'volcano' : 'blue'}
                  >
                    {r.dialysisPatient.kind === 'EMERGENCY' ? 'طارئ' : 'دائم'}
                  </Tag>
                ) : null}
              </div>
              <div className="d-session-mobile-row">
                <Text type="secondary">{formatDialysisCalendarDate(r.sessionDate)}</Text>
                <Text type="secondary">•</Text>
                <Text type="secondary">{r.startedAt ? dayjs(r.startedAt).format('HH:mm') : '—'}</Text>
              </div>
              <div className="d-session-mobile-row">
                <Text type="secondary">الصالة/السرير:</Text>
                <Text>{r.location ? `${r.location.hallName} — ${r.location.bedCode}` : '—'}</Text>
              </div>
              <div className="d-session-mobile-row">
                {r.intakeKind ? (
                  <Tag color={INTAKE_KIND_LABEL[r.intakeKind]?.color || 'default'}>
                    {INTAKE_KIND_LABEL[r.intakeKind]?.label ?? r.intakeKind}
                  </Tag>
                ) : (
                  <Tag>غير مصنّف</Tag>
                )}
                <Tag color={patientMatchDisplay(r.patientMatchMethod).color}>
                  {patientMatchDisplay(r.patientMatchMethod).label}
                </Tag>
                <Tag color={STATUS_LABEL[r.status]?.color || 'default'}>
                  {STATUS_LABEL[r.status]?.label ?? r.status}
                </Tag>
              </div>
              <div className="d-session-mobile-created-by">
                <Text type="secondary">أضافها:</Text>
                <Text>{r.created_by_display ?? '—'}</Text>
              </div>
            </div>
          ),
        },
        {
          title: '',
          key: 'a',
          width: 98,
          render: (_: unknown, r: SessionRow): React.ReactNode => (
            <Space size="small" direction="vertical">
              <Button
                size="small"
                icon={<FileSearchOutlined />}
                onClick={() => {
                  setClinicalId(r.id);
                  setClinicalHospitalId(r.hospitalId ?? null);
                  setClinicalOpen(true);
                }}
              />
              {canEdit && r.status === 'ACTIVE' && (
                <Button
                  size="small"
                  type="primary"
                  icon={<StopOutlined />}
                  onClick={() => endSession(r.id, r.hospitalId)}
                />
              )}
              {canDelete && (
                <Button
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => removeSession(r.id, r.hospitalId)}
                />
              )}
            </Space>
          ),
        },
      ];
    }

    return [
      {
        title: 'التاريخ',
        dataIndex: 'sessionDate',
        key: 'd',
        render: (d: string) => formatDialysisCalendarDate(d),
        width: 110,
      },
      ...(mergedScope
        ? [
            {
              title: 'المستشفى',
              key: 'hosp',
              width: 170,
              render: (_: unknown, r: SessionRow) =>
                r.hospital?.name ? <Tag color="geekblue">{r.hospital.name}</Tag> : '—',
            },
          ]
        : []),
      {
        title: 'المريض',
        key: 'p',
        render: (_: unknown, r: SessionRow): React.ReactNode => (
          <span>
            {r.dialysisPatient?.fullName ?? '—'}
            {r.dialysisPatient?.kind ? (
              <Tag
                style={{ marginInlineStart: 6 }}
                color={r.dialysisPatient.kind === 'EMERGENCY' ? 'volcano' : 'blue'}
              >
                {r.dialysisPatient.kind === 'EMERGENCY' ? 'طارئ' : 'دائم'}
              </Tag>
            ) : null}
          </span>
        ),
      },
      {
        title: 'نوع الغسلة',
        dataIndex: 'intakeKind',
        key: 'ik',
        width: 120,
        responsive: ['sm'],
        render: (k: string | null | undefined) =>
          k ? (
            <Tag color={INTAKE_KIND_LABEL[k]?.color || 'default'}>
              {INTAKE_KIND_LABEL[k]?.label ?? k}
            </Tag>
          ) : (
            <Text type="secondary">—</Text>
          ),
      },
      {
        title: 'نوع الإضافة',
        dataIndex: 'patientMatchMethod',
        key: 'pm',
        width: 120,
        responsive: ['md'],
        render: (m: string | null | undefined) => {
          const meta = patientMatchDisplay(m);
          return <Tag color={meta.color}>{meta.label}</Tag>;
        },
      },
      {
        title: 'الشفت',
        key: 'slot',
        width: 100,
        responsive: ['md'],
        render: (_: unknown, r: SessionRow) => r.shiftSlot?.name ?? '—',
      },
      {
        title: 'المكان',
        key: 'loc',
        render: (_: unknown, r: SessionRow): React.ReactNode =>
          r.location ? `${r.location.hallName} — ${r.location.bedCode}` : '—',
        responsive: ['md'],
      },
      {
        title: 'بدء',
        dataIndex: 'startedAt',
        key: 'st',
        render: (t: string | null) => (t ? dayjs(t).format('HH:mm') : '—'),
        width: 80,
      },
      {
        title: 'الحالة',
        dataIndex: 'status',
        key: 's',
        width: 110,
        render: (s: string) => (
          <Tag color={STATUS_LABEL[s]?.color || 'default'}>
            {STATUS_LABEL[s]?.label ?? s}
          </Tag>
        ),
      },
      {
        title: 'أضافها',
        dataIndex: 'created_by_display',
        key: 'cb',
        ellipsis: true,
        responsive: ['lg'],
        render: (t: string | null) => t ?? '—',
      },
      {
        title: 'وقت الإضافة',
        dataIndex: 'createdAt',
        key: 'ca',
        width: 130,
        responsive: ['lg'],
        render: (t: string | undefined) =>
          t ? dayjs(t).format('YYYY-MM-DD HH:mm') : '—',
      },
      {
        title: '',
        key: 'a',
        fixed: 'right' as const,
        width: 220,
        render: (_: unknown, r: SessionRow): React.ReactNode => (
          <Space size="small" wrap>
            <Button
              size="small"
              icon={<FileSearchOutlined />}
              onClick={() => {
                setClinicalId(r.id);
                setClinicalHospitalId(r.hospitalId ?? null);
                setClinicalOpen(true);
              }}
            >
              سجل
            </Button>
            {canEdit && r.status === 'ACTIVE' && (
              <Button
                size="small"
                type="primary"
                icon={<StopOutlined />}
                onClick={() => endSession(r.id, r.hospitalId)}
              >
                إنهاء
              </Button>
            )}
            {canDelete && (
              <Button
                size="small"
                danger
                icon={<DeleteOutlined />}
                onClick={() => removeSession(r.id, r.hospitalId)}
              />
            )}
          </Space>
        ),
      },
    ];
  }, [isMobile, mergedScope, canEdit, canDelete, endSession, removeSession]);

  const openClinical = (r: SessionRow) => {
    setClinicalId(r.id);
    setClinicalHospitalId(r.hospitalId ?? null);
    setClinicalOpen(true);
  };

  const pageBody = (
    <div className={isMobile ? 'd-sessions-page' : undefined}>
      <div className="d-page-header">
        <h2>الجلسات</h2>
        <Text className="sub">
          متابعة جلسات الغسل مع مؤشرات وفلاتر، ومنع تسجيل أكثر من غسلة لنفس المريض في اليوم الواحد.
        </Text>
      </div>

      <div className="d-stat-grid" style={{ marginBottom: 16 }}>
        {loading && !kpis ? (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 24 }}>
            <Spin />
          </div>
        ) : (
          kpiCards.map((c) => (
            <div key={c.key} className="d-stat">
              <div className="d-stat-info">
                <span className="d-stat-label">{c.label}</span>
                <span className="d-stat-value">{c.value}</span>
              </div>
              <span className="d-stat-icon" style={{ background: KPI_ICON_BG[c.key] }}>
                {c.icon}
              </span>
            </div>
          ))
        )}
      </div>

      {kpis && Object.keys(kpis.byIntakeKind || {}).length > 0 && (
        <div className="d-card" style={{ marginBottom: 16, padding: '10px 14px' }}>
          <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>
            حسب نوع الإدخال:
          </Text>
          <Space size={[4, 4]} wrap>
            {Object.entries(kpis.byIntakeKind).map(([k, n]) => (
              <Tag key={k} color={INTAKE_KIND_LABEL[k]?.color || 'default'}>
                {k === 'UNKNOWN' ? 'غير مصنّف' : INTAKE_KIND_LABEL[k]?.label ?? k}: {n}
              </Tag>
            ))}
          </Space>
        </div>
      )}

      <div className="d-card">
        <div
          className={`d-toolbar${isMobile ? ' d-sessions-toolbar-period' : ''}`}
          style={{ marginBottom: 8 }}
        >
          <Segmented
            value={period}
            onChange={(v) => {
              setPeriod(v as PeriodPreset);
              if (v === 'custom') {
                setCustomRange([dayjs().subtract(7, 'day').startOf('day'), dayjs().endOf('day')]);
              }
            }}
            options={[
              { label: 'اليوم', value: 'today' },
              { label: 'الأسبوع', value: 'week' },
              { label: 'الشهر', value: 'month' },
              { label: 'الكل', value: 'all' },
              { label: 'مخصص', value: 'custom' },
            ]}
          />
          {period === 'custom' && (
            <RangePicker
              value={customRange}
              onChange={(r) => r?.[0] && r[1] && setCustomRange([r[0], r[1]])}
              format="YYYY-MM-DD"
              allowClear={false}
              style={isMobile ? { width: '100%', minWidth: 0 } : { minWidth: 260 }}
            />
          )}
          <span className="grow" />
          <div className={isMobile ? 'd-sessions-toolbar-actions' : undefined}>
          <Tooltip title="تحديث القائمة والأرقام">
            <Button icon={<ReloadOutlined />} onClick={load}>
              تحديث
            </Button>
          </Tooltip>
          {canCreate && (
            <Button
              className={isMobile ? 'd-sessions-btn-new' : undefined}
              type="primary"
              icon={<PlusOutlined />}
              onClick={openCreate}
              disabled={mergedScope}
              title={
                mergedScope
                  ? 'لإنشاء جلسة جديدة اختر مستشفى واحداً من القائمة أعلاه'
                  : undefined
              }
            >
              جلسة جديدة
            </Button>
          )}
          </div>
        </div>

        <div
          className={`d-toolbar${isMobile ? ' d-sessions-filters' : ''}`}
          style={{ alignItems: 'stretch' }}
        >
          <FilterOutlined style={{ marginTop: 8, color: '#94a3b8' }} />
          <Select
            allowClear
            placeholder="الحالة"
            style={{ minWidth: 130 }}
            value={filterStatus}
            onChange={setFilterStatus}
            options={Object.entries(STATUS_LABEL).map(([k, v]) => ({ value: k, label: v.label }))}
          />
          <Select
            allowClear
            placeholder="نوع الغسلة"
            style={{ minWidth: 150 }}
            value={filterIntakeKind}
            onChange={setFilterIntakeKind}
            options={[
              { value: 'SCHEDULED', label: 'مجدولة' },
              { value: 'OFF_SCHEDULE', label: 'غير مجدولة' },
              { value: 'EMERGENCY', label: 'طارئة' },
              { value: '__NULL__', label: 'غير مصنّف' },
            ]}
          />
          <Select
            allowClear
            placeholder="نوع الإضافة"
            style={{ minWidth: 150 }}
            value={filterPatientMatch}
            onChange={setFilterPatientMatch}
            options={[
              { value: 'MANUAL', label: 'يدوي' },
              { value: 'FACE', label: 'تعرف بالوجه' },
            ]}
          />
          <Select
            allowClear
            showSearch
            placeholder="المريض"
            style={{ minWidth: 200 }}
            value={filterPatientId}
            onChange={(v) => setFilterPatientId(v)}
            optionFilterProp="label"
            suffixIcon={<UserOutlined />}
            options={patients.map((p) => ({
              value: p.id,
              label: `${p.fullName} (${p.kind === 'EMERGENCY' ? 'طارئ' : 'دائم'})`,
            }))}
          />
          <Input.Search
            className="d-toolbar-input-grow"
            placeholder="بحث سريع باسم المريض…"
            allowClear
            value={searchName}
            onChange={(e) => setSearchName(e.target.value)}
            onSearch={() => load()}
          />
          <Button icon={<ClearOutlined />} onClick={resetFilters}>
            مسح الفلاتر
          </Button>
        </div>

        <Spin spinning={loading}>
          {isMobile ? (
            <>
              {rows.length === 0 ? (
                <Empty description="لا توجد جلسات حسب الفلتر" />
              ) : (
                <div className="d-sessions-cards">
                  {mobilePageRows.map((r) => {
                    const statusMeta = STATUS_LABEL[r.status] ?? {
                      label: r.status,
                      color: 'default',
                    };
                    const intake = r.intakeKind
                      ? INTAKE_KIND_LABEL[r.intakeKind]
                      : undefined;
                    const match = patientMatchDisplay(r.patientMatchMethod);
                    return (
                      <SessionMobileCard
                        key={r.id}
                        row={r}
                        showHospital={mergedScope}
                        statusMeta={statusMeta}
                        intakeLabel={intake?.label}
                        intakeColor={intake?.color}
                        matchLabel={match.label}
                        matchColor={match.color}
                        canEdit={canEdit}
                        canDelete={canDelete}
                        onOpenRecord={() => openClinical(r)}
                        onEnd={() => endSession(r.id, r.hospitalId)}
                        onDelete={() => removeSession(r.id, r.hospitalId)}
                      />
                    );
                  })}
                </div>
              )}
              {rows.length > MOBILE_PAGE_SIZE && (
                <Pagination
                  className="d-sessions-pagination"
                  current={mobilePage}
                  pageSize={MOBILE_PAGE_SIZE}
                  total={rows.length}
                  showSizeChanger={false}
                  showTotal={(t) => `إجمالي ${t}`}
                  onChange={(p) => setMobilePage(p)}
                />
              )}
            </>
          ) : (
            <div className="d-table-scroll">
              <Table
                rowKey="id"
                loading={false}
                dataSource={rows}
                size="middle"
                scroll={{ x: 'max-content' }}
                locale={{ emptyText: <Empty description="لا توجد جلسات حسب الفلتر" /> }}
                pagination={{
                  pageSize: 15,
                  showSizeChanger: true,
                  pageSizeOptions: ['10', '15', '25', '50'],
                  showTotal: (t) => `إجمالي ${t} صفاً`,
                }}
                columns={columns}
              />
            </div>
          )}
        </Spin>
      </div>

      {canCreate && (
        <Drawer
          className={`d-session-create-drawer${isMobile ? ' d-session-create-drawer--mobile' : ''}`}
          title={
            <Space direction="vertical" size={0}>
              <span>جلسة غسيل جديدة</span>
            </Space>
          }
          placement={isMobile ? 'bottom' : 'right'}
          height={isMobile ? '92%' : undefined}
          width={isMobile ? undefined : 500}
          zIndex={isMobile ? 1310 : 1000}
          open={drawerOpen}
          onClose={() => {
            if (faceIdentifyOpen) return;
            setDrawerOpen(false);
          }}
          maskClosable={!faceIdentifyOpen && !isMobile}
          keyboard={!faceIdentifyOpen}
          destroyOnClose
          footer={
            <Space className="d-session-create-drawer__footer" wrap>
              <Button
                type="primary"
                size="large"
                icon={<CalendarOutlined />}
                onClick={submit}
                disabled={hasConflict || registrationBlocked}
              >
                إنشاء الجلسة
              </Button>
              <Button
                size="large"
                onClick={() => setDrawerOpen(false)}
                disabled={faceIdentifyOpen}
              >
                إلغاء
              </Button>
            </Space>
          }
        >
          <Form
            form={form}
            layout="vertical"
            onValuesChange={(changed, all) => {
              if (changed.session_date !== undefined) {
                reloadSlots(changed.session_date ?? all.session_date);
              }
              if (changed.dialysis_patient_id !== undefined || changed.session_date !== undefined) {
                const pid = changed.dialysis_patient_id ?? all.dialysis_patient_id;
                const sd = (changed.session_date ?? all.session_date) as Dayjs | undefined;
                void fetchAndApplyHints(pid, sd);
              }
            }}
          >
            {registrationBlocked && (
              <Alert
                type="error"
                showIcon
                style={{ marginBottom: 16 }}
                message="لا يمكن تسجيل جلسة في هذه الظروف"
                description={
                  intakeHints?.registrationBlockedReason ||
                  'راجع التاريخ أو الشفت — قد يكون التاريخ مستقبلياً أو الشفت لم يبدأ بعد.'
                }
              />
            )}
            {hasConflict && intakeHints?.existingSession && (
              <Alert
                type="error"
                showIcon
                style={{ marginBottom: 16 }}
                message="يوجد للمريض جلسة في هذا اليوم"
                description={`لا يمكن إضافة غسلة ثانية لنفس اليوم (جلسة حالية رقم ${intakeHints.existingSession.id} — حالة: ${STATUS_LABEL[intakeHints.existingSession.status]?.label ?? intakeHints.existingSession.status}). غيّر التاريخ أو راجع الجلسة الموجودة.`}
              />
            )}
            {intakeHints && !hasConflict && !registrationBlocked && (
              <Alert
                type="info"
                showIcon
                style={{ marginBottom: 16 }}
                message={
                  <span>
                    نوع الغسلة:{' '}
                    <Tag color={INTAKE_KIND_LABEL[intakeHints.previewIntakeKind]?.color}>
                      {INTAKE_KIND_LABEL[intakeHints.previewIntakeKind]?.label ??
                        intakeHints.previewIntakeKind}
                    </Tag>
                    {intakeHints.patientKind === 'EMERGENCY' ? (
                      <Tag color="volcano" style={{ marginInlineStart: 8 }}>
                        مريض طارئ
                      </Tag>
                    ) : (
                      <Tag color="geekblue" style={{ marginInlineStart: 8 }}>
                        مريض دائم
                      </Tag>
                    )}
                  </span>
                }
                description={
                  intakeHints.previewIntakeKind === 'SCHEDULED'
                    ? 'اليوم مطابق لجدول المريض — تم تعبئة القاعة والسرير والوقت والشفت افتراضياً ويمكن تعديلها.'
                    : intakeHints.previewIntakeKind === 'OFF_SCHEDULE'
                      ? 'اليوم ليس ضمن جدول المريض الدائم — أدخل القاعة والسرير والشفت ووقت البدء يدوياً.'
                      : 'يُسجَّل كغسلة طارئة لمريض الطوارئ.'
                }
              />
            )}
            {DIALYSIS_FACE_ENABLED && faceHospitalId != null && (
              <Button
                type="default"
                size="large"
                block
                className="d-face-quick-btn"
                icon={<ScanOutlined />}
                style={{ marginBottom: 12 }}
                onClick={() => setFaceIdentifyOpen(true)}
              >
                مسح الوجه — تعرف تلقائي
              </Button>
            )}
            <Form.Item
              name="dialysis_patient_id"
              label="المريض"
              rules={[{ required: true, message: 'اختر المريض' }]}
            >
              <Select
                size="large"
                showSearch
                placeholder="ابحث بالاسم — يظهر طارئ أو دائم"
                optionFilterProp="label"
                onChange={() => setPatientMatchMethod('MANUAL')}
                options={patients.map((p) => ({
                  value: p.id,
                  label: `${p.fullName} (${p.kind === 'EMERGENCY' ? 'طارئ' : 'دائم'})`,
                }))}
              />
            </Form.Item>
            {patientMatchMethod === 'FACE' ? (
              <Alert
                type="success"
                showIcon
                style={{ marginBottom: 12 }}
                message="تم تحديد المريض عبر التعرف بالوجه"
              />
            ) : null}
            <Row gutter={12}>
              <Col xs={24} sm={12}>
                <Form.Item
                  name="session_date"
                  label="تاريخ الجلسة"
                  rules={[{ required: true }]}
                  initialValue={dayjs()}
                >
                  <DatePicker
                    size="large"
                    style={{ width: '100%' }}
                    format="YYYY-MM-DD"
                    disabledDate={(current) =>
                      !!current && current.startOf('day').isAfter(dayjs().startOf('day'))
                    }
                  />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item
                  name="started_at"
                  label="وقت البدء"
                  initialValue={dayjs()}
                  rules={[{ required: true, message: 'اختر وقت البدء' }]}
                >
                  <TimePicker
                    size="large"
                    format="HH:mm"
                    needConfirm={false}
                    style={{ width: '100%' }}
                    disabledTime={sessionStartDisabledTime}
                  />
                </Form.Item>
              </Col>
              <Col span={24}>
                <Form.Item
                  name="location_id"
                  label="القاعة — السرير"
                  rules={[{ required: true, message: 'اختر القاعة/السرير' }]}
                >
                  <Select
                    size="large"
                    options={locations.map((l) => ({
                      value: l.id,
                      label: `${l.hallName} — سرير ${l.bedCode}`,
                    }))}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item name="shift_slot_id" label="شفت الغسل">
                  <Select
                    size="large"
                    allowClear
                    options={slots.map((s) => ({
                      value: s.id,
                      label: `${s.name} (${String(Math.floor(s.startMinutes / 60)).padStart(2, '0')}:${String(s.startMinutes % 60).padStart(2, '0')})`,
                    }))}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item name="machine_id" label="جهاز">
                  <Select
                    size="large"
                    allowClear
                    options={machines.map((m) => ({
                      value: m.id,
                      label: m.assetTag || `جهاز #${m.id}`,
                    }))}
                  />
                </Form.Item>
              </Col>
            </Row>

            <Collapse
              ghost
              items={[
                {
                  key: 'vit',
                  label: 'قياسات أولية (اختياري)',
                  children: (
                    <Row gutter={12}>
                      <Col xs={12}>
                        <Form.Item name="pre_systolic" label="ضغط انقباضي">
                          <InputNumber min={0} style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>
                      <Col xs={12}>
                        <Form.Item name="pre_diastolic" label="ضغط انبساطي">
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
                        <Form.Item name="heart_rate_pre" label="نبض">
                          <InputNumber min={0} style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>
                      <Col xs={12}>
                        <Form.Item name="temperature_pre_c" label="حرارة">
                          <InputNumber min={30} max={42} step={0.1} style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>
                      <Col span={24}>
                        <Form.Item name="notes" label="ملاحظات سريعة">
                          <TextArea rows={2} />
                        </Form.Item>
                      </Col>
                    </Row>
                  ),
                },
              ]}
            />
          </Form>
        </Drawer>
      )}

      {DIALYSIS_FACE_ENABLED && faceHospitalId != null ? (
        <Suspense fallback={null}>
          <DialysisFaceIdentifyModal
            open={faceIdentifyOpen}
            onClose={() => setFaceIdentifyOpen(false)}
            hospitalId={faceHospitalId}
            onSelect={(patientId) => handleFacePatientSelected(patientId)}
          />
        </Suspense>
      ) : null}

      <DialysisSessionClinicalDrawer
        open={clinicalOpen}
        sessionId={clinicalId}
        hospitalId={
          clinicalHospitalId ??
          (typeof hospitalId === 'number' ? hospitalId : effectiveHospitalId)
        }
        canEdit={canEdit}
        onClose={() => {
          setClinicalOpen(false);
          setClinicalId(null);
          setClinicalHospitalId(null);
        }}
        onSaved={() => load()}
      />

    </div>
  );

  if (isMobile) {
    const fab = canCreate ? (
      <DialysisMobileFab
        icon={<PlusOutlined />}
        label="جلسة"
        ariaLabel="جلسة غسيل جديدة"
        visible={!drawerOpen && !clinicalOpen && !faceIdentifyOpen}
        onClick={() => {
          if (mergedScope) {
            message.warning('اختر مستشفى واحداً من القائمة (☰) أو من حسابك قبل إنشاء جلسة');
            return;
          }
          openCreate();
        }}
      />
    ) : null;

    return (
      <>
        <DialysisPullRefresh onRefresh={load} disabled={hospitalId == null || drawerOpen || clinicalOpen}>
          {pageBody}
        </DialysisPullRefresh>
        {fab}
      </>
    );
  }

  return pageBody;
};

export default SessionsPage;
