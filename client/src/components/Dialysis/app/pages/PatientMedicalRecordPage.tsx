import React, { useCallback, useEffect, useMemo, useState, lazy, Suspense } from 'react';
import {
  Avatar,
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  Row,
  Space,
  Spin,
  Statistic,
  Table,
  Tabs,
  Tag,
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  ArrowRightOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  ExperimentOutlined,
  FileProtectOutlined,
  FolderOpenOutlined,
  MedicineBoxOutlined,
  PrinterOutlined,
  EditOutlined,
  ScanOutlined,
} from '@ant-design/icons';
import axios from 'axios';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import {
  ALL_MY_HOSPITALS,
  useDialysisContext,
  useEffectiveDialysisHospitalId,
} from '../dialysisContext';
import {
  formatDialysisCalendarDate,
  weekdayLabelAr,
  VASCULAR_ACCESS_OPTIONS,
} from '../../dialysisConstants';
import { usePermission } from '../../../../hooks/usePermission';
import DialysisPatientDetailModal from '../../DialysisPatientDetailModal';
import { useDialysisMobile } from '../useDialysisMobile';
import DialysisBrandLogo from '../DialysisBrandLogo';
import { DIALYSIS_MINISTRY_LINE, DIALYSIS_SYSTEM_TITLE } from '../dialysisBrand';
import '../dialysis-brand.css';
import './patient-medical-record.css';
import { DIALYSIS_FACE_ENABLED } from '../../face/dialysisFaceConfig';
import {
  PatientDossierCover,
  PatientDossierSessionTimeline,
  PatientDossierTreatmentsTable,
  SessionClinicalDetail,
  sessionHasClinicalExtras,
  type SessionDossierRow,
  type TreatmentHistoryRow,
} from './PatientDossierViews';

const DialysisFaceEnrollModal = lazy(
  () => import('../../face/DialysisFaceEnrollModal')
);

const { Text, Paragraph } = Typography;

interface HospitalLite {
  id: number;
  name: string;
  code?: string | null;
}

interface PatientDossier {
  id: number;
  hospitalId: number;
  hospital?: HospitalLite | null;
  fullName: string;
  kind: string;
  gender?: string | null;
  phone?: string | null;
  nationalId?: string | null;
  biometricId?: string | null;
  internalRecordNumber?: string | null;
  birthDate?: string | null;
  bloodGroup?: string | null;
  companionName?: string | null;
  companionPhone?: string | null;
  city?: string | null;
  addressLine?: string | null;
  provinceCode?: string | null;
  countryCode?: string | null;
  notes?: string | null;
  viralMarkersJson?: unknown;
  dialysisStartDate?: string | null;
  kidneyFailureCause?: string | null;
  vascularAccessType?: string | null;
  vascularAccessSite?: string | null;
  vascularAccessNote?: string | null;
  targetDryWeightKg?: unknown;
  sessionsPerWeek?: number | null;
  sessionDurationMinutes?: number | null;
  dialyzerModelDefault?: string | null;
  bloodFlowTargetMlMin?: number | null;
  anticoagulantStandard?: string | null;
  labsFollowUpJson?: unknown;
  photoUrl?: string | null;
  faceEnrolledAt?: string | null;
  hasFaceEnrolled?: boolean;
  created_by_display?: string | null;
}

type SessionRow = SessionDossierRow & {
  machineId?: number | null;
  intakeKind?: string | null;
  startedAt?: string | null;
  endedAt?: string | null;
  created_by_display?: string | null;
  shiftSlot?: {
    name: string;
    startMinutes?: number;
    endMinutes?: number;
  } | null;
};

interface ScheduleRow {
  id: number;
  dayOfWeek: number;
  isActive: number;
  shiftSlot?: { name: string } | null;
  location?: { hallName: string; bedCode: string } | null;
}

interface StatisticalRow {
  id: number;
  sessionDate: string;
  shift: string;
  folderReference?: string | null;
  notes?: string | null;
  created_by_display?: string | null;
}

interface DossierStats {
  sessionTotal: number;
  statusCounts: Record<string, number>;
  returnedSessions: number;
  dispenseLineCount?: number;
  consumptionLineCount?: number;
  treatmentHistoryCount?: number;
  lastSessionDate: string | null;
  lastSessionStartedAt: string | null;
  avgWeightPreKg: number | null;
  avgWeightPostKg: number | null;
  dialysisProgramStart: string | null;
}

interface DossierPayload {
  patient: PatientDossier;
  sessions: SessionRow[];
  schedules: ScheduleRow[];
  statisticalEntries: StatisticalRow[];
  treatmentHistory?: TreatmentHistoryRow[];
  stats: DossierStats;
}

function shiftLabelAr(shift: string): string {
  if (shift === 'MORNING') return 'صباحي';
  if (shift === 'EVENING') return 'مسائي';
  return shift || '—';
}

function sessionStatusTag(status: string) {
  const map: Record<string, { color: string; label: string }> = {
    COMPLETED: { color: 'success', label: 'مكتملة' },
    ACTIVE: { color: 'processing', label: 'نشطة' },
    SCHEDULED: { color: 'warning', label: 'مجدولة' },
    CANCELLED: { color: 'default', label: 'ملغاة' },
  };
  const m = map[status] ?? { color: 'default', label: status };
  return <Tag color={m.color}>{m.label}</Tag>;
}

function vascularTypeLabel(code: string | null | undefined): string {
  if (!code) return '—';
  return VASCULAR_ACCESS_OPTIONS.find((o) => o.value === code)?.label ?? code;
}

function genderLabelAr(code: string): string {
  const u = code.trim().toUpperCase();
  if (u === 'MALE') return 'ذكر';
  if (u === 'FEMALE') return 'أنثى';
  if (u === 'OTHER') return 'غير محدد';
  return code;
}


/** أوزان/مختبر — يدعم رقم، نص عشري من JSON، وكائنات تشبه Prisma Decimal */
function formatNum(v: unknown, digits = 2): string {
  if (v == null || v === '') return '—';
  if (typeof v === 'number' && Number.isFinite(v)) {
    return v.toFixed(digits);
  }
  if (typeof v === 'string') {
    const t = v.trim();
    if (t === '') return '—';
    const n = parseFloat(t.replace(',', '.'));
    if (Number.isFinite(n)) return n.toFixed(digits);
    return '—';
  }
  if (typeof v === 'object' && v !== null) {
    const o = v as { toNumber?: () => number; toString?: () => string };
    if (typeof o.toNumber === 'function') {
      try {
        const n = o.toNumber();
        if (Number.isFinite(n)) return n.toFixed(digits);
      } catch {
        /* ignore */
      }
    }
    if (typeof o.toString === 'function') {
      const n = parseFloat(String(o.toString()).replace(',', '.'));
      if (Number.isFinite(n)) return n.toFixed(digits);
    }
  }
  const n = Number(v);
  if (Number.isFinite(n) && !Number.isNaN(n)) return n.toFixed(digits);
  return '—';
}

function formatMachineLabel(r: SessionRow): string {
  const m = r.machine;
  if (m) {
    const tag = m.assetTag?.trim();
    const model = m.model?.trim();
    const serial = m.serialNumber?.trim();
    if (tag) return tag;
    if (model) return model;
    if (serial) return serial;
    return `جهاز #${m.id}`;
  }
  if (r.machineId != null && r.machineId > 0) {
    return `مرجع جهاز #${r.machineId}`;
  }
  return '—';
}

function normalizeLabs(raw: unknown): Record<string, unknown>[] {
  if (!raw) return [];
  if (!Array.isArray(raw)) return [];
  return raw.filter((x) => x && typeof x === 'object') as Record<string, unknown>[];
}

function ViralBlock({ data }: { data: unknown }) {
  if (data == null) return <Empty description="لا توجد بيانات فيروسية مسجّلة" />;
  if (typeof data === 'object' && !Array.isArray(data)) {
    const o = data as Record<string, unknown>;
    return (
      <div className="d-medical-panel d-medical-panel--flush">
        <Descriptions bordered size="small" column={{ xs: 1, sm: 2, md: 3 }}>
          {Object.entries(o).map(([k, v]) => (
            <Descriptions.Item key={k} label={k}>
              {v == null ? '—' : String(v)}
            </Descriptions.Item>
          ))}
        </Descriptions>
      </div>
    );
  }
  return (
    <div className="d-medical-panel d-medical-panel--flush">
      <Paragraph style={{ marginBottom: 0 }}>{String(data)}</Paragraph>
    </div>
  );
}

const PatientMedicalRecordPage: React.FC = () => {
  const { patientId: rawPid } = useParams<{ patientId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const stateHospitalId = (location.state as { hospitalId?: number } | null)?.hospitalId;

  const { hospitalId } = useDialysisContext();
  const effectiveHospitalId = useEffectiveDialysisHospitalId();
  const mergedScope = hospitalId === ALL_MY_HOSPITALS;

  const canEdit = usePermission('dialysis:patient:edit');
  const canDelete = usePermission('dialysis:patient:delete');
  const isMobile = useDialysisMobile();
  /** عمودان على الشاشات العريضة؛ عمود واحد على الهاتف يمنع تعارض span مع column في Descriptions */
  const summaryDescColumns = isMobile ? 1 : 2;
  const fullRowDescSpan = isMobile ? 1 : 2;

  const patientId = parseInt(rawPid || '', 10);
  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState<DossierPayload | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [faceEnrollOpen, setFaceEnrollOpen] = useState(false);
  /** يفعّل تخطيط الطباعة: كل الجلسات، كل الإحصاء، وتجهيز الجداول قبل الحوار */
  const [printLayout, setPrintLayout] = useState(false);

  const apiHospitalParam = useMemo(() => {
    if (mergedScope) return stateHospitalId ?? ALL_MY_HOSPITALS;
    if (typeof hospitalId === 'number') return hospitalId;
    return effectiveHospitalId ?? ALL_MY_HOSPITALS;
  }, [mergedScope, stateHospitalId, hospitalId, effectiveHospitalId]);

  const load = useCallback(async () => {
    if (!Number.isFinite(patientId)) return;
    setLoading(true);
    try {
      const { data } = await axios.get<DossierPayload>(
        `/api/dialysis/patients/${patientId}/dossier`,
        { params: { hospital_id: apiHospitalParam } }
      );
      setPayload(data);
    } catch {
      message.error('تعذّر تحميل السجل الطبي');
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }, [patientId, apiHospitalParam]);

  useEffect(() => {
    if (!Number.isFinite(patientId)) {
      navigate('/dialysis/patients', { replace: true });
      return;
    }
    load();
  }, [patientId, navigate, load]);

  useEffect(() => {
    const onBeforePrint = () => setPrintLayout(true);
    const onAfterPrint = () => setPrintLayout(false);
    window.addEventListener('beforeprint', onBeforePrint);
    window.addEventListener('afterprint', onAfterPrint);
    return () => {
      window.removeEventListener('beforeprint', onBeforePrint);
      window.removeEventListener('afterprint', onAfterPrint);
    };
  }, []);

  const triggerPrint = useCallback(() => {
    setPrintLayout(true);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.print();
      });
    });
  }, []);

  const patient = payload?.patient;
  const stats = payload?.stats;

  const monthlyBuckets = useMemo(() => {
    const sessions = payload?.sessions ?? [];
    const map = new Map<string, number>();
    for (const s of sessions) {
      const d = formatDialysisCalendarDate(s.sessionDate);
      const key = d !== '—' ? d.slice(0, 7) : '';
      if (!key) continue;
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    const keys = Array.from(map.keys()).sort();
    const last = keys.slice(-12);
    const max = Math.max(1, ...last.map((k) => map.get(k) ?? 0));
    return last.map((k) => ({
      key: k,
      label: k.slice(5),
      count: map.get(k) ?? 0,
      hPct: ((map.get(k) ?? 0) / max) * 100,
    }));
  }, [payload?.sessions]);

  const labsRows = useMemo(() => normalizeLabs(patient?.labsFollowUpJson), [patient?.labsFollowUpJson]);

  const labsColumns = useMemo(() => {
    const keys = new Set<string>();
    labsRows.forEach((r) => Object.keys(r).forEach((k) => keys.add(k)));
    const sorted = Array.from(keys).sort();
    return sorted.map((k) => ({
      title: k,
      dataIndex: k,
      key: k,
      ellipsis: true,
      render: (v: unknown) => (v == null || v === '' ? '—' : String(v)),
    })) as ColumnsType<Record<string, unknown>>;
  }, [labsRows]);

  const sessionColumns: ColumnsType<SessionRow> = useMemo(
    () => [
      {
        title: 'التاريخ',
        key: 'd',
        width: 102,
        render: (_, r) => formatDialysisCalendarDate(r.sessionDate),
      },
      {
        title: 'الوردية',
        key: 'sh',
        width: 78,
        render: (_, r) => shiftLabelAr(r.shift),
      },
      {
        title: 'الحالة',
        dataIndex: 'status',
        key: 'st',
        width: 96,
        render: (s: string) => sessionStatusTag(s),
      },
      {
        title: 'المكان',
        key: 'loc',
        width: 130,
        ellipsis: true,
        render: (_, r) =>
          r.location ? `${r.location.hallName} — ${r.location.bedCode}` : '—',
      },
      {
        title: 'الشفت',
        key: 'slot',
        width: 100,
        ellipsis: true,
        render: (_, r) => r.shiftSlot?.name ?? '—',
      },
      {
        title: 'الجهاز',
        key: 'mach',
        width: 118,
        ellipsis: true,
        render: (_, r) => formatMachineLabel(r),
      },
      {
        title: 'وزن قبل (كغ)',
        key: 'pre',
        width: 92,
        render: (_, r) => formatNum(r.weightPreKg, 2),
      },
      {
        title: 'وزن بعد (كغ)',
        key: 'post',
        width: 92,
        render: (_, r) => formatNum(r.weightPostKg, 2),
      },
      {
        title: 'ضغط قبل',
        key: 'bp1',
        width: 92,
        render: (_, r) =>
          r.preSystolic != null && r.preDiastolic != null
            ? `${r.preSystolic}/${r.preDiastolic}`
            : '—',
      },
      {
        title: 'Kt/V',
        key: 'ktv',
        width: 68,
        render: (_, r) => formatNum(r.ktV, 2),
      },
      {
        title: 'هدف UF (مل)',
        key: 'uf',
        width: 88,
        render: (_, r) =>
          r.ufGoalMl != null && r.ufGoalMl !== undefined ? String(r.ufGoalMl) : '—',
      },
      {
        title: 'ملاحظات',
        key: 'notes',
        ellipsis: true,
        render: (_, r) =>
          [r.complicationsNote, r.nursingNote, r.notes].filter(Boolean).join(' — ') ||
          '—',
      },
    ],
    []
  );

  const scheduleColumns: ColumnsType<ScheduleRow> = useMemo(
    () => [
      {
        title: 'اليوم',
        key: 'day',
        width: 110,
        render: (_, r) => weekdayLabelAr(r.dayOfWeek),
      },
      {
        title: 'الشفت',
        key: 'slot',
        render: (_, r) => r.shiftSlot?.name ?? '—',
      },
      {
        title: 'السرير / القاعة',
        key: 'loc',
        render: (_, r) =>
          r.location ? `${r.location.hallName} — ${r.location.bedCode}` : '—',
      },
      {
        title: 'الحالة',
        key: 'act',
        width: 90,
        render: (_, r) => (
          <Tag color={r.isActive ? 'success' : 'default'}>
            {r.isActive ? 'فعّال' : 'موقوف'}
          </Tag>
        ),
      },
    ],
    []
  );

  const statisticalColumns: ColumnsType<StatisticalRow> = useMemo(
    () => [
      {
        title: 'التاريخ',
        key: 'd',
        width: 112,
        render: (_, r) => formatDialysisCalendarDate(r.sessionDate),
      },
      {
        title: 'الوردية',
        key: 'sh',
        width: 88,
        render: (_, r) => shiftLabelAr(r.shift),
      },
      {
        title: 'مرجع الملف',
        dataIndex: 'folderReference',
        ellipsis: true,
        render: (v) => v || '—',
      },
      {
        title: 'ملاحظات',
        dataIndex: 'notes',
        ellipsis: true,
        render: (v) => v || '—',
      },
    ],
    []
  );

  const printGeneratedAt = useMemo(
    () =>
      new Date().toLocaleString('ar-IQ', {
        dateStyle: 'long',
        timeStyle: 'short',
      }),
    [printLayout]
  );

  const dossierIssuedAt = useMemo(
    () =>
      new Date().toLocaleString('ar-IQ', {
        dateStyle: 'long',
        timeStyle: 'short',
      }),
    []
  );

  const treatmentHistory = payload?.treatmentHistory ?? [];
  const treatmentCount =
    stats?.treatmentHistoryCount ?? treatmentHistory.length;

  if (!Number.isFinite(patientId)) return null;

  return (
    <div
      className={`d-medical-record d-medical-print-root${isMobile ? ' d-medical-record--mobile' : ''}`}
    >
      <Spin spinning={loading} className="d-medical-spin-wrap">
        {patient && stats && (
          <>
            <header className="d-medical-print-banner d-print-only" dir="rtl">
              <div className="d-medical-print-banner-accent" aria-hidden />
              <div className="d-medical-print-banner-brand">
                <DialysisBrandLogo size="lg" static />
                <span className="d-medical-print-banner-brand-text">
                  <span className="d-medical-print-banner-ministry">{DIALYSIS_MINISTRY_LINE}</span>
                  {DIALYSIS_SYSTEM_TITLE} — سجل طبي إلكتروني
                </span>
              </div>
              <div className="d-medical-print-banner-title">الملف الطبي الشامل للمريض</div>
              <div className="d-medical-print-banner-sub">
                نسخة قابلة للطباعة — تشمل الجلسات والعلاجات والصرف — للاطلاع والمراجعة السريرية
              </div>
              <dl className="d-medical-print-banner-meta">
                <div>
                  <dt>المريض</dt>
                  <dd>{patient.fullName}</dd>
                </div>
                <div>
                  <dt>المستشفى</dt>
                  <dd>{patient.hospital?.name ?? '—'}</dd>
                </div>
                <div>
                  <dt>رقم الملف</dt>
                  <dd>{patient.internalRecordNumber ?? '—'}</dd>
                </div>
                <div>
                  <dt>تاريخ ووقت الطباعة</dt>
                  <dd>{printGeneratedAt}</dd>
                </div>
                <div>
                  <dt>المعرّف في النظام</dt>
                  <dd>#{patient.id}</dd>
                </div>
                <div>
                  <dt>سجلات علاج / صرف</dt>
                  <dd>{treatmentCount}</dd>
                </div>
              </dl>
            </header>

            <PatientDossierCover
              patientName={patient.fullName}
              hospitalName={patient.hospital?.name ?? '—'}
              fileNumber={patient.internalRecordNumber ?? null}
              patientId={patient.id}
              sessionTotal={stats.sessionTotal}
              treatmentCount={treatmentCount}
              generatedAt={dossierIssuedAt}
            />

            <div className={`d-medical-hero${isMobile ? ' d-medical-hero--mobile' : ''}`}>
              <div className="d-medical-hero-grid" aria-hidden />
              <div className="d-medical-hero-inner">
                <div className="d-medical-hero-main">
                  <Avatar
                    className="d-medical-avatar"
                    size={isMobile ? 56 : 88}
                    src={patient.photoUrl || undefined}
                    icon={<MedicineBoxOutlined />}
                  />
                  <div className="d-medical-hero-titles">
                    <span className="d-medical-hero-eyebrow">ملف طبي شامل — وحدة الغسل الكلوي</span>
                    <h1>{patient.fullName}</h1>
                    <div className="d-medical-hero-meta">
                      <Tag color={patient.kind === 'PERSISTENT' ? 'green' : 'orange'}>
                        {patient.kind === 'PERSISTENT' ? 'دائم' : 'طوارئ'}
                      </Tag>
                      {patient.gender && (
                        <Tag className="d-medical-hero-gender-tag">
                          {genderLabelAr(patient.gender)}
                        </Tag>
                      )}
                      {patient.bloodGroup && (
                        <Tag color="red">{patient.bloodGroup}</Tag>
                      )}
                      {patient.hospital?.name && (
                        <Tag color="geekblue">{patient.hospital.name}</Tag>
                      )}
                      {patient.internalRecordNumber && (
                        <Text style={{ color: 'rgba(255,255,255,0.92)' }}>
                          ملف: {patient.internalRecordNumber}
                        </Text>
                      )}
                    </div>
                  </div>
                </div>
                <Space
                  wrap={!isMobile}
                  direction={isMobile ? 'vertical' : 'horizontal'}
                  className="d-medical-hero-actions no-print"
                  size={isMobile ? 'small' : 'middle'}
                  style={isMobile ? { width: '100%' } : undefined}
                >
                  <Button
                    block={isMobile}
                    icon={<ArrowRightOutlined />}
                    onClick={() => navigate('/dialysis/patients')}
                  >
                    القائمة
                  </Button>
                  <Button block={isMobile} icon={<PrinterOutlined />} onClick={triggerPrint}>
                    طباعة
                  </Button>
                  {canEdit && (
                    <Button
                      block={isMobile}
                      type="primary"
                      icon={<EditOutlined />}
                      onClick={() => setEditOpen(true)}
                    >
                      {isMobile ? 'تعديل' : 'تعديل البيانات'}
                    </Button>
                  )}
                  {DIALYSIS_FACE_ENABLED && canEdit && patient && (
                    <Button
                      block={isMobile}
                      icon={<ScanOutlined />}
                      onClick={() => setFaceEnrollOpen(true)}
                    >
                      {patient.hasFaceEnrolled || patient.faceEnrolledAt
                        ? 'إعادة تسجيل الوجه'
                        : 'تسجيل الوجه (اختياري)'}
                    </Button>
                  )}
                </Space>
              </div>
            </div>

            <Row gutter={[16, 16]} className="d-medical-kpi-row">
              <Col xs={12} sm={12} md={6} lg={4}>
                <Card className="d-medical-kpi-card d-medical-kpi-card--a" size="small">
                  <Statistic
                    title={isMobile ? 'الجلسات' : 'إجمالي الجلسات'}
                    value={stats.sessionTotal}
                    prefix={<CalendarOutlined />}
                  />
                </Card>
              </Col>
              <Col xs={12} sm={12} md={6} lg={4}>
                <Card className="d-medical-kpi-card d-medical-kpi-card--b" size="small">
                  <Statistic
                    title={isMobile ? 'آخر جلسة' : 'آخر جلسة'}
                    value={
                      stats.lastSessionDate
                        ? formatDialysisCalendarDate(stats.lastSessionDate)
                        : '—'
                    }
                  />
                </Card>
              </Col>
              <Col xs={12} sm={12} md={6} lg={4}>
                <Card className="d-medical-kpi-card d-medical-kpi-card--e" size="small">
                  <Statistic
                    title={isMobile ? 'علاج / صرف' : 'سجلات علاج وصرف'}
                    value={treatmentCount}
                    prefix={<MedicineBoxOutlined />}
                  />
                </Card>
              </Col>
              <Col xs={12} sm={12} md={6} lg={4}>
                <Card className="d-medical-kpi-card d-medical-kpi-card--c" size="small">
                  <Statistic
                    title={isMobile ? 'وزن قبل' : 'متوسط وزن قبل الغسل'}
                    value={
                      stats.avgWeightPreKg != null
                        ? stats.avgWeightPreKg.toFixed(2)
                        : '—'
                    }
                    suffix={stats.avgWeightPreKg != null ? 'كغ' : undefined}
                  />
                </Card>
              </Col>
              <Col xs={12} sm={12} md={6} lg={4}>
                <Card className="d-medical-kpi-card d-medical-kpi-card--d" size="small">
                  <Statistic
                    title={isMobile ? 'وزن بعد' : 'متوسط وزن بعد الغسل'}
                    value={
                      stats.avgWeightPostKg != null
                        ? stats.avgWeightPostKg.toFixed(2)
                        : '—'
                    }
                    suffix={stats.avgWeightPostKg != null ? 'كغ' : undefined}
                  />
                </Card>
              </Col>
              <Col xs={12} sm={12} md={6} lg={4}>
                <Card className="d-medical-kpi-card d-medical-kpi-card--f" size="small">
                  <Statistic
                    title={isMobile ? 'محمّل' : 'جلسات في الملف'}
                    value={stats.returnedSessions}
                    suffix={stats.sessionTotal > stats.returnedSessions ? ` / ${stats.sessionTotal}` : undefined}
                  />
                </Card>
              </Col>
            </Row>

            <Tabs
              className={`d-medical-tabs${isMobile ? ' d-medical-tabs--mobile' : ''}`}
              type="card"
              size={isMobile ? 'small' : 'middle'}
              items={[
                {
                  key: 'summary',
                  forceRender: true,
                  label: (
                    <span>
                      <FileProtectOutlined />{' '}
                      {isMobile ? 'ملخص' : 'ملخص سريري'}
                    </span>
                  ),
                  children: (
                    <div className="d-medical-tab-panel">
                      <h2 className="d-print-section-heading">ملخص سريري</h2>
                      <Row gutter={[18, 18]}>
                        <Col xs={24} lg={14}>
                          <div className="d-medical-panel">
                          <h3 className="d-medical-section-title">البيانات الديموغرافية والتواصل</h3>
                          <Descriptions
                            bordered
                            size="small"
                            column={summaryDescColumns}
                            layout={isMobile ? 'vertical' : 'horizontal'}
                            className="d-medical-desc"
                          >
                            <Descriptions.Item label="تاريخ الميلاد">
                              {patient.birthDate
                                ? formatDialysisCalendarDate(patient.birthDate)
                                : '—'}
                            </Descriptions.Item>
                            <Descriptions.Item label="الهاتف">
                              {patient.phone ?? '—'}
                            </Descriptions.Item>
                            <Descriptions.Item label="الهوية الوطنية">
                              {patient.nationalId ?? '—'}
                            </Descriptions.Item>
                            <Descriptions.Item label="البصمة / المعرف">
                              {patient.biometricId ?? '—'}
                            </Descriptions.Item>
                            {DIALYSIS_FACE_ENABLED ? (
                              <Descriptions.Item label="تسجيل الوجه">
                                {patient.hasFaceEnrolled || patient.faceEnrolledAt
                                  ? `مسجّل${patient.faceEnrolledAt ? ` — ${formatDialysisCalendarDate(patient.faceEnrolledAt)}` : ''}`
                                  : 'غير مسجّل (اختياري)'}
                              </Descriptions.Item>
                            ) : null}
                            <Descriptions.Item label="المدينة">
                              {patient.city ?? '—'}
                            </Descriptions.Item>
                            <Descriptions.Item label="المحافظة (رمز)">
                              {patient.provinceCode ?? '—'}
                            </Descriptions.Item>
                            <Descriptions.Item label="العنوان" span={fullRowDescSpan}>
                              {patient.addressLine ?? '—'}
                            </Descriptions.Item>
                            <Descriptions.Item label="اسم المرافق">
                              {patient.companionName ?? '—'}
                            </Descriptions.Item>
                            <Descriptions.Item label="هاتف المرافق">
                              {patient.companionPhone ?? '—'}
                            </Descriptions.Item>
                          </Descriptions>
                          </div>
                        </Col>
                        <Col xs={24} lg={10}>
                          <div className="d-medical-panel">
                          <h3 className="d-medical-section-title">وصفة الغسل والأهداف</h3>
                          <Descriptions bordered size="small" column={1} className="d-medical-desc">
                            <Descriptions.Item label="بداية برنامج الغسل">
                              {patient.dialysisStartDate
                                ? formatDialysisCalendarDate(patient.dialysisStartDate)
                                : '—'}
                            </Descriptions.Item>
                            <Descriptions.Item label="الوزن الجاف المستهدف (كغ)">
                              {formatNum(patient.targetDryWeightKg, 3)}
                            </Descriptions.Item>
                            <Descriptions.Item label="جلسات / أسبوع">
                              {patient.sessionsPerWeek ?? '—'}
                            </Descriptions.Item>
                            <Descriptions.Item label="مدة الجلسة (دقيقة)">
                              {patient.sessionDurationMinutes ?? '—'}
                            </Descriptions.Item>
                            <Descriptions.Item label="فلتر افتراضي">
                              {patient.dialyzerModelDefault ?? '—'}
                            </Descriptions.Item>
                            <Descriptions.Item label="سريان دم مستهدف (مل/د)">
                              {patient.bloodFlowTargetMlMin ?? '—'}
                            </Descriptions.Item>
                            <Descriptions.Item label="مضاد تخثر معياري">
                              {patient.anticoagulantStandard ?? '—'}
                            </Descriptions.Item>
                          </Descriptions>
                          </div>
                        </Col>
                      </Row>

                      <div className="d-medical-panel" style={{ marginTop: 8 }}>
                      <h3 className="d-medical-section-title" style={{ marginTop: 0 }}>
                        السبب ومسارات الوصول الوعائي
                      </h3>
                      <Descriptions
                        bordered
                        size="small"
                        column={summaryDescColumns}
                        layout={isMobile ? 'vertical' : 'horizontal'}
                        className="d-medical-desc"
                      >
                        <Descriptions.Item label="سبب الفشل الكلوي" span={fullRowDescSpan}>
                          {patient.kidneyFailureCause ?? '—'}
                        </Descriptions.Item>
                        <Descriptions.Item label="نوع الوصول">
                          {vascularTypeLabel(patient.vascularAccessType)}
                        </Descriptions.Item>
                        <Descriptions.Item label="موقع الوصول">
                          {patient.vascularAccessSite ?? '—'}
                        </Descriptions.Item>
                        <Descriptions.Item label="ملاحظات وعائية" span={fullRowDescSpan}>
                          {patient.vascularAccessNote ?? '—'}
                        </Descriptions.Item>
                      </Descriptions>
                      </div>

                      <h3 className="d-medical-section-title d-medical-section-title--spaced">
                        العلامات الفيروسية (Virology)
                      </h3>
                      <ViralBlock data={patient.viralMarkersJson} />

                      {patient.notes ? (
                        <div className="d-medical-panel" style={{ marginTop: 16 }}>
                          <h3 className="d-medical-section-title" style={{ marginTop: 0 }}>
                            ملاحظات عامة
                          </h3>
                          <div className="d-medical-notes-box">{patient.notes}</div>
                        </div>
                      ) : null}

                      <h3 className="d-medical-section-title d-print-hide-chart-title" style={{ marginTop: 20 }}>
                        نشاط الجلسات — آخر 12 شهراً (المحمّلة)
                      </h3>
                      {monthlyBuckets.length === 0 ? (
                        <Empty description="لا جلسات ضمن العينة المعروضة" />
                      ) : (
                        <div className="d-medical-chart d-print-hide-chart">
                          {monthlyBuckets.map((b) => (
                            <div key={b.key} className="d-medical-chart-bar-wrap">
                              <div
                                className="d-medical-chart-bar"
                                style={{ height: `${Math.max(8, b.hPct)}%` }}
                                title={`${b.count} جلسة`}
                              />
                              <span className="d-medical-chart-label">{b.label}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      <Text type="secondary">
                        حالة الجلسات — مكتملة: {stats.statusCounts.COMPLETED ?? 0} · نشطة:{' '}
                        {stats.statusCounts.ACTIVE ?? 0} · مجدولة:{' '}
                        {stats.statusCounts.SCHEDULED ?? 0} · ملغاة:{' '}
                        {stats.statusCounts.CANCELLED ?? 0}
                      </Text>
                    </div>
                  ),
                },
                {
                  key: 'sessions',
                  forceRender: true,
                  label: (
                    <span>
                      <CalendarOutlined /> {isMobile ? 'جلسات' : 'جلسات الغسل'}
                    </span>
                  ),
                  children: (
                    <div className="d-medical-tab-panel">
                      <h2 className="d-print-section-heading">جلسات الغسل — السجل الكامل</h2>
                      <p className="d-print-section-note d-print-only">
                        إجمالي الجلسات في النظام: {stats.sessionTotal}. المعروض أدناه جميع
                        الجلسات المحمّلة في الملف (حتى 500 جلسة) مع تفاصيل العلاج والاستهلاك.
                      </p>
                      {isMobile && !printLayout ? (
                        <PatientDossierSessionTimeline
                          sessions={payload.sessions}
                          formatMachine={formatMachineLabel}
                        />
                      ) : (
                        <Table<SessionRow>
                          rowKey="id"
                          size="small"
                          className="d-medical-print-table"
                          scroll={printLayout ? undefined : { x: 'max-content' }}
                          pagination={
                            printLayout
                              ? false
                              : { pageSize: 12, showSizeChanger: false }
                          }
                          dataSource={payload.sessions}
                          columns={sessionColumns}
                          expandable={{
                            expandedRowRender: (record) => (
                              <SessionClinicalDetail session={record} />
                            ),
                            rowExpandable: (record) => sessionHasClinicalExtras(record),
                          }}
                        />
                      )}
                      {isMobile && printLayout && (
                        <PatientDossierSessionTimeline
                          sessions={payload.sessions}
                          formatMachine={formatMachineLabel}
                        />
                      )}
                    </div>
                  ),
                },
                {
                  key: 'treatments',
                  forceRender: true,
                  label: (
                    <span>
                      <MedicineBoxOutlined />{' '}
                      {isMobile ? 'علاج' : 'العلاجات والصرف'}
                    </span>
                  ),
                  children: (
                    <div className="d-medical-tab-panel">
                      <h2 className="d-print-section-heading">
                        سجل العلاجات والصرف والاستهلاك
                      </h2>
                      <p className="d-print-section-note">
                        يجمع صرف الصيدلة لكل جلسة والمواد المستهلكة أثناء الغسل — من الأحدث إلى
                        الأقدم.
                      </p>
                      <Row gutter={[12, 12]} className="d-dossier-treatment-kpis no-print">
                        <Col xs={8}>
                          <Card size="small" className="d-medical-kpi-card d-medical-kpi-card--e">
                            <Statistic title="إجمالي السجلات" value={treatmentCount} />
                          </Card>
                        </Col>
                        <Col xs={8}>
                          <Card size="small" className="d-medical-kpi-card d-medical-kpi-card--a">
                            <Statistic
                              title="صرف صيدلة"
                              value={stats.dispenseLineCount ?? 0}
                            />
                          </Card>
                        </Col>
                        <Col xs={8}>
                          <Card size="small" className="d-medical-kpi-card d-medical-kpi-card--f">
                            <Statistic
                              title="استهلاك جلسات"
                              value={stats.consumptionLineCount ?? 0}
                            />
                          </Card>
                        </Col>
                      </Row>
                      <PatientDossierTreatmentsTable
                        rows={treatmentHistory}
                        printLayout={printLayout}
                      />
                    </div>
                  ),
                },
                {
                  key: 'schedule',
                  forceRender: true,
                  label: (
                    <span>
                      <ClockCircleOutlined />{' '}
                      {isMobile ? 'الأسبوع' : 'الجدول الأسبوعي'}
                    </span>
                  ),
                  children: (
                    <div className="d-medical-tab-panel">
                      <h2 className="d-print-section-heading">الجدول الأسبوعي</h2>
                      <Table<ScheduleRow>
                        rowKey="id"
                        size="small"
                        className="d-medical-print-table"
                        pagination={false}
                        dataSource={payload.schedules}
                        columns={scheduleColumns}
                        locale={{
                          emptyText: (
                            <Empty description="لا يوجد جدول أسبوعي مسجّل لهذا المريض" />
                          ),
                        }}
                      />
                    </div>
                  ),
                },
                {
                  key: 'labs',
                  forceRender: true,
                  label: (
                    <span>
                      <ExperimentOutlined />{' '}
                      {isMobile ? 'مخبر' : 'متابعة مخبرية'}
                    </span>
                  ),
                  children:
                    labsRows.length === 0 ? (
                      <div className="d-medical-tab-panel">
                        <h2 className="d-print-section-heading">متابعة مخبرية</h2>
                        <Empty description="لا توجد قياسات مخبرية مسجّلة في الحقل الدوري" />
                      </div>
                    ) : (
                      <div className="d-medical-tab-panel">
                        <h2 className="d-print-section-heading">متابعة مخبرية</h2>
                        <Table<Record<string, unknown>>
                          rowKey={(_, i) => String(i)}
                          size="small"
                          className="d-medical-print-table"
                          scroll={printLayout ? undefined : { x: 'max-content' }}
                          dataSource={labsRows}
                          columns={labsColumns}
                        />
                      </div>
                    ),
                },
                {
                  key: 'stat',
                  forceRender: true,
                  label: (
                    <span>
                      <FolderOpenOutlined />{' '}
                      {isMobile ? 'إحصاء' : 'صفحة إحصائية'}
                    </span>
                  ),
                  children: (
                    <div className="d-medical-tab-panel">
                      <h2 className="d-print-section-heading">إدخالات صفحة الإحصاء</h2>
                      <Table<StatisticalRow>
                        rowKey="id"
                        size="small"
                        className="d-medical-print-table"
                        scroll={printLayout ? undefined : { x: 'max-content' }}
                        pagination={
                          printLayout
                            ? false
                            : { pageSize: 15, showSizeChanger: false }
                        }
                        dataSource={payload.statisticalEntries}
                        columns={statisticalColumns}
                        locale={{
                          emptyText: (
                            <Empty description="لا توجد إدخالات من صفحة الإحصاء لهذا المريض" />
                          ),
                        }}
                      />
                    </div>
                  ),
                },
              ]}
            />

            <footer className="d-medical-print-footer d-print-only" dir="rtl">
              <div className="d-medical-print-footer-line" aria-hidden />
              <p className="d-medical-print-footer-main">
                وثيقة مُنشأة آلياً من نظام <strong>D-IRS</strong> — للاطلاع السريري والتوثيق الداخلي فقط.
              </p>
              <p className="d-medical-print-footer-note">
                لا تُعدّ نسخة رسمية للجهات الخارجية دون اعتماد الجهة المعنية ومطابقة البيانات مع السجل الأصلي.
              </p>
            </footer>
          </>
        )}

        {!loading && !patient && (
          <Empty
            description="لا يمكن عرض السجل — تحقق من الصلاحيات أو معرف المريض"
            style={{ marginTop: 48 }}
          />
        )}
      </Spin>

      {patient && (
        <DialysisPatientDetailModal
          open={editOpen}
          patientId={patient.id}
          hospitalId={patient.hospitalId}
          canEdit={canEdit}
          canDelete={canDelete}
          onClose={() => setEditOpen(false)}
          onSaved={() => {
            setEditOpen(false);
            load();
          }}
        />
      )}

      {DIALYSIS_FACE_ENABLED && patient && (
        <Suspense fallback={null}>
          <DialysisFaceEnrollModal
            open={faceEnrollOpen}
            onClose={() => setFaceEnrollOpen(false)}
            patientId={patient.id}
            hospitalId={patient.hospitalId}
            patientName={patient.fullName}
            hasFaceEnrolled={Boolean(patient.hasFaceEnrolled || patient.faceEnrolledAt)}
            onEnrolled={() => load()}
          />
        </Suspense>
      )}
    </div>
  );
};

export default PatientMedicalRecordPage;
