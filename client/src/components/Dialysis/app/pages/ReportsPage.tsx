import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Button,
  DatePicker,
  Space,
  Table,
  Typography,
  message,
  Tabs,
  Input,
  Empty,
  Form,
  Select,
  Modal,
  Tag,
  Row,
  Col,
  Card,
  Tooltip,
  Progress,
  Drawer,
  Badge,
  List,
  Collapse,
} from 'antd';
import {
  ReloadOutlined,
  DeleteOutlined,
  PlusOutlined,
  PrinterOutlined,
  DownloadOutlined,
  FileExcelOutlined,
  CalendarOutlined,
  TeamOutlined,
  ThunderboltOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  FileDoneOutlined,
  RiseOutlined,
  PieChartOutlined,
  FilterOutlined,
} from '@ant-design/icons';
import axios from 'axios';
import dayjs, { Dayjs } from 'dayjs';
import { useDialysisContext, useEffectiveDialysisHospitalId, ALL_MY_HOSPITALS } from '../dialysisContext';
import DialysisBrandLogo from '../DialysisBrandLogo';
import { DIALYSIS_MINISTRY_LINE, getHospitalScopeLabel } from '../dialysisBrand';
import '../dialysis-brand.css';
import {
  buildDialysisPrintHeaderHtml,
  DIALYSIS_PRINT_HEADER_CSS,
  escapeDialysisPrintHtml,
  type DialysisPrintFilterChip,
} from '../dialysisPrint';
import { useDialysisMobile } from '../useDialysisMobile';
import ReportSessionMobileCard from './ReportSessionMobileCard';
import './dialysis-reports.css';
import { usePermission } from '../../../../hooks/usePermission';
import { formatDialysisCalendarDate } from '../../dialysisConstants';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
  AreaChart,
  Area,
} from 'recharts';
import * as XLSX from 'xlsx';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

const { Text, Title } = Typography;
const { TextArea } = Input;

interface PatientLookupRow {
  id: number;
  fullName: string;
  kind?: string;
}

interface StatEntryRow {
  id: number;
  sessionDate: string;
  shift: string;
  dialysisPatient?: { fullName: string; id: number };
}

interface ReconResult {
  missed_folders?: Array<Record<string, unknown>>;
  ghost_sessions?: Array<Record<string, unknown>>;
  supply_discrepancies?: Array<Record<string, unknown> & { key?: string }>;
}

interface SessionReportRow {
  id: number;
  hospitalId?: number;
  hospital?: { id: number; name: string; code?: string | null } | null;
  sessionDate: string;
  status: string;
  intakeKind?: string | null;
  shift?: string | null;
  startedAt?: string | null;
  notes?: string | null;
  dialysisPatient?: { id: number; fullName: string } | null;
  location?: { hallName: string; bedCode: string } | null;
  created_by_display?: string | null;
  created_by_username?: string | null;
}

interface MonthlyStatRow {
  month: string;
  total: number;
  morning: number;
  evening: number;
  scheduled: number;
  unscheduled: number;
  emergency: number;
  uniquePatients: number;
  dailyAverage: string;
}

const SHIFT_OPTIONS = [
  { value: 'MORNING', label: 'صباحي' },
  { value: 'EVENING', label: 'مسائي' },
];

const SHIFT_LABEL_AR: Record<string, string> = {
  MORNING: 'صباحي',
  EVENING: 'مسائي',
};

const SHIFT_FILTER_OPTIONS = [
  { value: '', label: 'الكل' },
  { value: 'MORNING', label: 'صباحية' },
  { value: 'EVENING', label: 'مسائية' },
];

const INTAKE_LABEL_AR: Record<string, string> = {
  SCHEDULED: 'مجدولة',
  OFF_SCHEDULE: 'غير مجدولة',
  EMERGENCY: 'طارئة',
};

const STATUS_LABEL_AR: Record<string, string> = {
  ACTIVE: 'نشطة',
  COMPLETED: 'منتهية',
  CANCELLED: 'ملغاة',
  SCHEDULED: 'مجدولة',
};

/** ألوان Tag صريحة — بدونها يظهر نمط Tag الافتراضي في الوضع الداكن ككتلة داكنة بدون نص واضح */
const INTAKE_KIND_TAG_COLOR: Record<string, string> = {
  SCHEDULED: 'blue',
  OFF_SCHEDULE: 'orange',
  EMERGENCY: 'volcano',
};

const STATUS_TAG_COLOR: Record<string, string> = {
  ACTIVE: 'red',
  SCHEDULED: 'blue',
  COMPLETED: 'green',
  CANCELLED: 'default',
};

const CHART_PALETTE = ['#6366f1', '#8b5cf6', '#ec4899', '#14b8a6', '#f59e0b', '#3b82f6'];

const INTAKE_ACCENT_HEX: Record<string, string> = {
  SCHEDULED: '#3b82f6',
  OFF_SCHEDULE: '#f59e0b',
  EMERGENCY: '#ef4444',
};

type ReconRowStatus = 'matched' | 'missing' | 'supply' | 'na';

const RECON_STATUS_LABEL: Record<ReconRowStatus, string> = {
  matched: 'مسجّل في الإحصاء',
  missing: 'غير مسجّل في الإحصاء',
  supply: 'فرق في المواد',
  na: 'لا ينطبق',
};

const RECON_TAG_COLOR: Record<ReconRowStatus, string> = {
  matched: 'success',
  missing: 'warning',
  supply: 'volcano',
  na: 'default',
};

function sessionStatCoverageKey(r: SessionReportRow): string | null {
  const pid = r.dialysisPatient?.id;
  if (!pid) return null;
  const ymd = formatDialysisCalendarDate(r.sessionDate);
  if (!ymd || ymd === '—') return null;
  const shift = r.shift;
  if (!shift) return null;
  return `${pid}|${ymd}|${shift}`;
}

function computeReconStatus(
  r: SessionReportRow,
  statKeys: Set<string>,
  mismatchKeys: Set<string>
): ReconRowStatus {
  const st = (r.status || '').toUpperCase();
  if (st === 'CANCELLED') return 'na';
  const k = sessionStatCoverageKey(r);
  if (!k) return 'missing';
  if (mismatchKeys.has(k)) return 'supply';
  if (statKeys.has(k)) return 'matched';
  return 'missing';
}

/** الاسم الظاهر للموظف (الاسم الكامل من النظام، وليس اسم الدخول) */
function sessionCreatorDisplayName(r: SessionReportRow): string {
  if (r.created_by_display) return r.created_by_display;
  if (r.created_by_username) return r.created_by_username;
  return '—';
}

function svgEscapeText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

type PrintSlice = { name: string; value: number };

function buildPrintPieSvg(slices: PrintSlice[], colors: string[], size = 128): string {
  const active = slices.filter((s) => s.value > 0);
  const total = active.reduce((a, b) => a + b.value, 0);
  if (total <= 0) return '<p class="chart-empty">لا بيانات</p>';
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.36;
  let angle = -Math.PI / 2;
  let paths = '';
  let idx = 0;
  for (const sl of active) {
    const frac = sl.value / total;
    const a = frac * 2 * Math.PI;
    const x1 = cx + r * Math.cos(angle);
    const y1 = cy + r * Math.sin(angle);
    angle += a;
    const x2 = cx + r * Math.cos(angle);
    const y2 = cy + r * Math.sin(angle);
    const largeArc = a > Math.PI ? 1 : 0;
    const c = colors[idx % colors.length];
    paths += `<path d="M ${cx} ${cy} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z" fill="${c}" stroke="#fff" stroke-width="1.2"/>`;
    idx += 1;
  }
  let leg = '<div class="pie-legend">';
  idx = 0;
  for (const sl of active) {
    const c = colors[idx % colors.length];
    leg += `<span><i style="background:${c}"></i>${svgEscapeText(sl.name)}: <b>${sl.value}</b></span>`;
    idx += 1;
  }
  leg += '</div>';
  return `<div class="pie-wrap"><svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">${paths}</svg>${leg}</div>`;
}

function buildPrintHBars(rows: PrintSlice[], colors: string[], esc: (s: string) => string): string {
  if (!rows.length) return '<p class="chart-empty">لا بيانات</p>';
  const max = Math.max(...rows.map((x) => x.value), 1);
  let html = '<div class="hbar-chart">';
  rows.forEach((row, i) => {
    const pct = (row.value / max) * 100;
    const c = colors[i % colors.length];
    html += `<div class="hbar-row"><span class="hbar-name">${esc(row.name)}</span><div class="hbar-track"><div class="hbar-fill" style="width:${pct}%;background:${c}"></div></div><span class="hbar-num">${row.value}</span></div>`;
  });
  html += '</div>';
  return html;
}

function buildPrintTrendSvg(rows: { month: string; total: number }[], w = 380, h = 130): string {
  if (!rows.length) return '<p class="chart-empty">لا بيانات</p>';
  const max = Math.max(...rows.map((r) => r.total), 1);
  const padL = 26;
  const padR = 10;
  const padT = 10;
  const padB = 22;
  const iw = w - padL - padR;
  const ih = h - padT - padB;
  const n = rows.length;
  const coords = rows.map((row, i) => {
    const x = padL + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw);
    const y = padT + ih - (row.total / max) * ih;
    return { x, y, m: row.month };
  });
  const x0 = coords[0].x;
  const xLast = coords[coords.length - 1].x;
  const yb = padT + ih;
  const areaD = `M ${x0} ${yb} L ${coords.map((c) => `${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' L ')} L ${xLast} ${yb} Z`;
  const linePoints = coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
  const labels = coords
    .map((c) => `<text x="${c.x}" y="${h - 4}" text-anchor="middle" font-size="9" fill="#64748b">${svgEscapeText(c.m)}</text>`)
    .join('');
  return `<svg class="trend-svg" width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="pgf" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#6366f1" stop-opacity="0.42"/><stop offset="100%" stop-color="#6366f1" stop-opacity="0.04"/></linearGradient></defs><path d="${areaD}" fill="url(#pgf)"/><polyline points="${linePoints}" fill="none" stroke="#6366f1" stroke-width="2.2"/>${labels}</svg>`;
}

const PLACEHOLDER = `{
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

const ReportsPage: React.FC<{ variant?: 'reports' | 'statistics' }> = ({ variant = 'reports' }) => {
  const { hospitalId, hospitals } = useDialysisContext();
  const effectiveHospitalId = useEffectiveDialysisHospitalId();
  /** عمود المستشفى يظهر فقط عند عرض «كل المستشفيات» */
  const showHospitalInReports = hospitalId === ALL_MY_HOSPITALS;
  const isMobile = useDialysisMobile();
  const [filtersDrawerOpen, setFiltersDrawerOpen] = useState(false);
  const [scopeTagsExpanded, setScopeTagsExpanded] = useState(false);
  const canRecon = usePermission('dialysis:reconciliation');
  const canBulk = usePermission('dialysis:stats:bulk');
  const canStatsEntry = usePermission('dialysis:stats:entry');
  const canStatWrite = canStatsEntry || canBulk;

  const [range, setRange] = useState<[Dayjs, Dayjs]>([dayjs().startOf('month'), dayjs()]);
  const [result, setResult] = useState<ReconResult | null>(null);
  const [loading, setLoading] = useState(false);

  const [listDate, setListDate] = useState<Dayjs>(() => dayjs().startOf('day'));
  const [statRows, setStatRows] = useState<StatEntryRow[]>([]);
  const [statLoading, setStatLoading] = useState(false);
  const [patientOptions, setPatientOptions] = useState<PatientLookupRow[]>([]);
  const [entryForm] = Form.useForm();
  const [sessionRows, setSessionRows] = useState<SessionReportRow[]>([]);
  const [reportLoading, setReportLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [reportDateFrom, setReportDateFrom] = useState<Dayjs>(() => dayjs().startOf('month'));
  const [reportDateTo, setReportDateTo] = useState<Dayjs>(() => dayjs().endOf('day'));
  const [filterHall, setFilterHall] = useState<string>('');
  const [filterType, setFilterType] = useState<string>('');
  const [filterShift, setFilterShift] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterPatientId, setFilterPatientId] = useState<number | undefined>(undefined);
  const [filterRecon, setFilterRecon] = useState<'' | ReconRowStatus>('');
  const [statCoverageKeys, setStatCoverageKeys] = useState<Set<string>>(() => new Set());
  const [supplyMismatchKeys, setSupplyMismatchKeys] = useState<Set<string>>(() => new Set());

  const loadStatEntries = useCallback(async () => {
    if (hospitalId == null || !canStatWrite) return;
    setStatLoading(true);
    try {
      const { data } = await axios.get<StatEntryRow[]>('/api/dialysis/statistical/entries', {
        params: {
          hospital_id: hospitalId,
          date: listDate.format('YYYY-MM-DD'),
        },
      });
      setStatRows(Array.isArray(data) ? data : []);
    } catch {
      message.error('فشل تحميل السجل الإحصائي');
    } finally {
      setStatLoading(false);
    }
  }, [hospitalId, listDate, canStatWrite]);

  const loadPatientOptions = useCallback(async () => {
    if (hospitalId == null || !canStatWrite) return;
    try {
      const { data } = await axios.get<PatientLookupRow[]>(
        '/api/dialysis/statistical/patient-lookup',
        { params: { hospital_id: hospitalId } }
      );
      setPatientOptions(Array.isArray(data) ? data : []);
    } catch {
      /* يُحمّل عند أول إضافة */
    }
  }, [hospitalId, canStatWrite]);

  useEffect(() => {
    loadStatEntries();
  }, [loadStatEntries]);

  useEffect(() => {
    loadPatientOptions();
  }, [loadPatientOptions]);

  useEffect(() => {
    entryForm.setFieldsValue({ session_date: listDate });
  }, [listDate, entryForm]);

  const submitStatEntry = async () => {
    if (hospitalId == null) return;
    const writeHid =
      typeof hospitalId === 'number' ? hospitalId : effectiveHospitalId;
    if (writeHid == null) {
      message.error('اختر مستشفى محدداً لتسجيل الإحصاء.');
      return;
    }
    try {
      const v = await entryForm.validateFields();
      await axios.post('/api/dialysis/statistical/entry', {
        hospital_id: writeHid,
        dialysis_patient_id: v.dialysis_patient_id,
        session_date: (v.session_date as Dayjs).format('YYYY-MM-DD'),
        shift: v.shift || 'MORNING',
      });
      message.success('تم تسجيل الاسم في السجل الإحصائي');
      entryForm.resetFields();
      entryForm.setFieldsValue({
        session_date: listDate,
        shift: 'MORNING',
      });
      loadStatEntries();
      loadPatientOptions();
    } catch (e: unknown) {
      const err = e as { errorFields?: unknown; response?: { data?: { error?: string } } };
      if (err.errorFields) return;
      message.error(err.response?.data?.error || 'فشل الحفظ');
    }
  };

  const deleteStatEntry = (row: StatEntryRow) => {
    Modal.confirm({
      title: 'حذف هذا السطر من السجل الإحصائي؟',
      okText: 'حذف',
      okType: 'danger',
      cancelText: 'إلغاء',
      onOk: async () => {
        try {
          const hid =
            typeof hospitalId === 'number'
              ? hospitalId
              : (row as { hospitalId?: number }).hospitalId ?? effectiveHospitalId;
          await axios.delete(`/api/dialysis/statistical/entries/${row.id}`, {
            params: hid ? { hospital_id: hid } : {},
          });
          message.success('تم الحذف');
          loadStatEntries();
        } catch {
          message.error('فشل الحذف');
        }
      },
    });
  };

  const statisticsDefaultTab = useMemo(() => {
    if (canStatWrite) return 'stats';
    if (canRecon) return 'recon';
    if (canBulk) return 'bulk';
    return 'stats';
  }, [canStatWrite, canRecon, canBulk]);

  const run = async () => {
    if (hospitalId == null) return;
    setLoading(true);
    try {
      const { data } = await axios.get<ReconResult>('/api/dialysis/reconciliation', {
        params: {
          hospital_id: hospitalId,
          from: range[0].format('YYYY-MM-DD'),
          to: range[1].format('YYYY-MM-DD'),
        },
      });
      setResult(data);
      message.success('تم تشغيل المطابقة');
    } catch {
      message.error('فشل المطابقة');
    } finally {
      setLoading(false);
    }
  };

  const submitBulk = async (raw: string) => {
    if (hospitalId == null) return;
    const writeHid =
      typeof hospitalId === 'number' ? hospitalId : effectiveHospitalId;
    if (writeHid == null) {
      message.error('اختر مستشفى محدداً للإدخال الإحصائي الجماعي.');
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      const entries = Array.isArray(parsed) ? parsed : parsed.entries;
      if (!Array.isArray(entries)) {
        message.error('يجب أن يكون الجذر مصفوفة أو يحتوي entries');
        return;
      }
      await axios.post('/api/dialysis/statistical/bulk', {
        hospital_id: writeHid,
        entries,
      });
      message.success('تم حفظ الإدخال الإحصائي');
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      message.error(err.response?.data?.error || 'تحقق من صيغة JSON');
    }
  };

  const loadReportData = useCallback(async () => {
    if (hospitalId == null) return;
    setReportLoading(true);
    const rangeParams = {
      hospital_id: hospitalId,
      date_from: reportDateFrom.format('YYYY-MM-DD'),
      date_to: reportDateTo.format('YYYY-MM-DD'),
    };
    try {
      const sessionsRes = await axios
        .get<SessionReportRow[]>('/api/dialysis/sessions', {
          params: { ...rangeParams, limit: 5000 },
        })
        .catch(() => {
          message.error('فشل تحميل الجلسات');
          return { data: [] as SessionReportRow[] };
        });
      setSessionRows(Array.isArray(sessionsRes.data) ? sessionsRes.data : []);

      const coverageRes = await axios
        .get<{ keys: string[] }>('/api/dialysis/statistical/coverage-keys', {
          params: rangeParams,
        })
        .catch(() => ({ data: { keys: [] as string[] } }));
      const keys = coverageRes.data?.keys;
      setStatCoverageKeys(new Set(Array.isArray(keys) ? keys : []));

      if (canRecon) {
        const reconRes = await axios
          .get<ReconResult>('/api/dialysis/reconciliation', {
            params: {
              hospital_id: hospitalId,
              from: rangeParams.date_from,
              to: rangeParams.date_to,
            },
          })
          .catch(() => ({ data: null as ReconResult | null }));
        const disc = reconRes.data?.supply_discrepancies;
        if (Array.isArray(disc)) {
          setSupplyMismatchKeys(new Set(disc.map((x) => x.key).filter(Boolean) as string[]));
        } else {
          setSupplyMismatchKeys(new Set());
        }
      } else {
        setSupplyMismatchKeys(new Set());
      }
    } finally {
      setReportLoading(false);
    }
  }, [hospitalId, reportDateFrom, reportDateTo, canRecon]);

  useEffect(() => {
    loadReportData();
  }, [loadReportData]);

  const hallOptions = useMemo(() => {
    const uniq = new Set<string>();
    sessionRows.forEach((r) => {
      if (r.location?.hallName) uniq.add(r.location.hallName);
    });
    return Array.from(uniq).sort((a, b) => a.localeCompare(b, 'ar'));
  }, [sessionRows]);

  const filteredReportRows = useMemo(() => {
    return sessionRows.filter((r) => {
      if (filterHall && r.location?.hallName !== filterHall) return false;
      if (filterType && (r.intakeKind || '') !== filterType) return false;
      if (filterShift && (r.shift || '').toUpperCase() !== filterShift) return false;
      if (filterStatus && (r.status || '').toUpperCase() !== filterStatus) return false;
      if (filterPatientId && r.dialysisPatient?.id !== filterPatientId) return false;
      if (filterRecon) {
        const rs = computeReconStatus(r, statCoverageKeys, supplyMismatchKeys);
        if (rs !== filterRecon) return false;
      }
      return true;
    });
  }, [
    sessionRows,
    filterHall,
    filterType,
    filterShift,
    filterStatus,
    filterPatientId,
    filterRecon,
    statCoverageKeys,
    supplyMismatchKeys,
  ]);

  const kpis = useMemo(() => {
    const list = filteredReportRows;
    const byType = {
      scheduled: list.filter((r) => r.intakeKind === 'SCHEDULED').length,
      unscheduled: list.filter((r) => r.intakeKind === 'OFF_SCHEDULE').length,
      emergency: list.filter((r) => r.intakeKind === 'EMERGENCY').length,
    };
    const byShift = {
      morning: list.filter((r) => (r.shift || '').toUpperCase() === 'MORNING').length,
      evening: list.filter((r) => (r.shift || '').toUpperCase() === 'EVENING').length,
    };
    const byStatus = {
      active: list.filter((r) => (r.status || '').toUpperCase() === 'ACTIVE').length,
      completed: list.filter((r) => (r.status || '').toUpperCase() === 'COMPLETED').length,
      cancelled: list.filter((r) => (r.status || '').toUpperCase() === 'CANCELLED').length,
    };
    let reconMatched = 0;
    let reconMissing = 0;
    let reconSupply = 0;
    let reconNa = 0;
    for (const r of list) {
      const rs = computeReconStatus(r, statCoverageKeys, supplyMismatchKeys);
      if (rs === 'matched') reconMatched += 1;
      else if (rs === 'missing') reconMissing += 1;
      else if (rs === 'supply') reconSupply += 1;
      else reconNa += 1;
    }
    const reconEligible = reconMatched + reconMissing + reconSupply;
    const statCoveragePct = reconEligible > 0 ? Math.round((reconMatched / reconEligible) * 1000) / 10 : 0;
    return {
      total: list.length,
      uniquePatients: new Set(list.map((r) => r.dialysisPatient?.id).filter(Boolean)).size,
      ...byType,
      ...byShift,
      ...byStatus,
      reconMatched,
      reconMissing,
      reconSupply,
      reconNa,
      statCoveragePct,
    };
  }, [filteredReportRows, statCoverageKeys, supplyMismatchKeys]);

  const chartByHall = useMemo(() => {
    const map = new Map<string, number>();
    filteredReportRows.forEach((r) => {
      const h = r.location?.hallName || 'غير محدد';
      map.set(h, (map.get(h) || 0) + 1);
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [filteredReportRows]);

  /** توزيع الجلسات حسب المستشفى (للمخطط والجدول) */
  const chartByHospital = useMemo(() => {
    const map = new Map<string, number>();
    filteredReportRows.forEach((r) => {
      const name = r.hospital?.name || 'غير محدد';
      map.set(name, (map.get(name) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredReportRows]);

  const hospitalDistributionRows = useMemo(() => {
    const total = filteredReportRows.length;
    const denom = total > 0 ? total : 1;
    return chartByHospital.map((row, idx) => ({
      key: `${row.name}-${idx}`,
      hospitalName: row.name,
      count: row.value,
      pct: Math.round((row.value / denom) * 1000) / 10,
    }));
  }, [chartByHospital, filteredReportRows.length]);

  const chartByType = useMemo(
    () => [
      { name: 'مجدولة', value: kpis.scheduled },
      { name: 'غير مجدولة', value: kpis.unscheduled },
      { name: 'طارئة', value: kpis.emergency },
    ],
    [kpis]
  );

  const chartByStatus = useMemo(
    () => [
      { name: 'نشطة', value: kpis.active },
      { name: 'منتهية', value: kpis.completed },
      { name: 'ملغاة', value: kpis.cancelled },
    ],
    [kpis]
  );

  const chartReconSummary = useMemo(
    () => [
      { name: 'مسجّل', value: kpis.reconMatched },
      { name: 'غير مسجّل', value: kpis.reconMissing },
      { name: 'فرق مواد', value: kpis.reconSupply },
    ],
    [kpis]
  );

  const chartByShift = useMemo(
    () => [
      { name: 'صباحية', value: kpis.morning },
      { name: 'مسائية', value: kpis.evening },
    ],
    [kpis]
  );

  const topPatients = useMemo(() => {
    const map = new Map<string, number>();
    filteredReportRows.forEach((r) => {
      const name = r.dialysisPatient?.fullName || 'طارئ / غير معرف';
      map.set(name, (map.get(name) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [filteredReportRows]);

  const monthlyStats = useMemo<MonthlyStatRow[]>(() => {
    const monthMap = new Map<string, SessionReportRow[]>();
    filteredReportRows.forEach((r) => {
      const key = dayjs(r.sessionDate).format('YYYY-MM');
      if (!monthMap.has(key)) monthMap.set(key, []);
      monthMap.get(key)!.push(r);
    });

    return Array.from(monthMap.entries())
      .sort(([a], [b]) => (a > b ? 1 : -1))
      .map(([month, rows]) => {
        const uniquePatients = new Set(rows.map((r) => r.dialysisPatient?.id).filter(Boolean)).size;
        const days = dayjs(`${month}-01`).daysInMonth();
        return {
          month,
          total: rows.length,
          morning: rows.filter((r) => (r.shift || '').toUpperCase() === 'MORNING').length,
          evening: rows.filter((r) => (r.shift || '').toUpperCase() === 'EVENING').length,
          scheduled: rows.filter((r) => r.intakeKind === 'SCHEDULED').length,
          unscheduled: rows.filter((r) => r.intakeKind === 'OFF_SCHEDULE').length,
          emergency: rows.filter((r) => r.intakeKind === 'EMERGENCY').length,
          uniquePatients,
          dailyAverage: (rows.length / Math.max(days, 1)).toFixed(1),
        };
      });
  }, [filteredReportRows]);

  const monthlyTrendData = useMemo(
    () => monthlyStats.map((m) => ({ month: m.month, total: m.total })),
    [monthlyStats]
  );

  const resetReportFilters = () => {
    setFilterHall('');
    setFilterType('');
    setFilterShift('');
    setFilterStatus('');
    setFilterPatientId(undefined);
    setFilterRecon('');
  };

  const exportReportExcel = () => {
    const exportRows = filteredReportRows.map((r, i) => {
      const recon = computeReconStatus(r, statCoverageKeys, supplyMismatchKeys);
      const row: Record<string, string | number> = { '#': i + 1 };
      if (showHospitalInReports) {
        row['المستشفى'] = r.hospital?.name || '—';
      }
      Object.assign(row, {
        'اسم المريض': r.dialysisPatient?.fullName || '—',
        'الصالة': r.location?.hallName || '—',
        'السرير': r.location?.bedCode || '—',
        'تاريخ الجلسة': formatDialysisCalendarDate(r.sessionDate),
        'الوقت': r.startedAt ? dayjs(r.startedAt).format('HH:mm') : '—',
        'النوبة': SHIFT_LABEL_AR[(r.shift || '').toUpperCase()] || '—',
        'نوع الجلسة': INTAKE_LABEL_AR[r.intakeKind || ''] || '—',
        'الحالة': STATUS_LABEL_AR[(r.status || '').toUpperCase()] || r.status || '—',
        'اسم الموظف': sessionCreatorDisplayName(r),
        'مطابقة الإحصاء': RECON_STATUS_LABEL[recon],
        'ملاحظات': r.notes || '—',
      });
      return row;
    });
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exportRows);
    XLSX.utils.book_append_sheet(wb, ws, 'جلسات');
    XLSX.writeFile(wb, `dialysis-report-${dayjs().format('YYYY-MM-DD-HH-mm')}.xlsx`);
  };

  /** أعلى 10، الإحصاءات الشهرية، وجداول النوع/النوبة — تظهر فقط إذا كانت الفترة ≥ 20 يوماً */
  const shouldShowExtendedSections = useMemo(() => {
    const days = reportDateTo.startOf('day').diff(reportDateFrom.startOf('day'), 'day') + 1;
    return days >= 20;
  }, [reportDateFrom, reportDateTo]);

  const printTitle = useMemo(() => {
    return `تقرير الجلسات (${reportDateFrom.format('YYYY-MM-DD')} → ${reportDateTo.format('YYYY-MM-DD')})`;
  }, [reportDateFrom, reportDateTo]);

  const reportHospitalLabel = useMemo(
    () => getHospitalScopeLabel(hospitalId, hospitals),
    [hospitalId, hospitals]
  );

  const reportPrintFilters = useMemo((): DialysisPrintFilterChip[] => {
    const patientName = filterPatientId
      ? patientOptions.find((p) => p.id === filterPatientId)?.fullName ||
        filteredReportRows.find((r) => r.dialysisPatient?.id === filterPatientId)?.dialysisPatient
          ?.fullName
      : null;
    return [
      { label: 'من تاريخ', value: reportDateFrom.format('YYYY-MM-DD') },
      { label: 'إلى تاريخ', value: reportDateTo.format('YYYY-MM-DD') },
      { label: 'الصالة', value: filterHall || 'الكل' },
      {
        label: 'نوع الجلسة',
        value: filterType ? INTAKE_LABEL_AR[filterType] || filterType : 'الكل',
      },
      {
        label: 'النوبة',
        value: filterShift ? SHIFT_LABEL_AR[filterShift] || filterShift : 'الكل',
      },
      {
        label: 'حالة الجلسة',
        value: filterStatus ? STATUS_LABEL_AR[filterStatus] || filterStatus : 'الكل',
      },
      {
        label: 'مطابقة الإحصاء',
        value: filterRecon ? RECON_STATUS_LABEL[filterRecon] : 'الكل',
      },
      { label: 'المريض', value: patientName || (filterPatientId ? `#${filterPatientId}` : 'الكل') },
    ];
  }, [
    reportDateFrom,
    reportDateTo,
    filterHall,
    filterType,
    filterShift,
    filterStatus,
    filterRecon,
    filterPatientId,
    patientOptions,
    filteredReportRows,
  ]);

  const activeExtraFilterCount = useMemo(() => {
    let n = 0;
    if (filterHall) n += 1;
    if (filterType) n += 1;
    if (filterShift) n += 1;
    if (filterStatus) n += 1;
    if (filterRecon) n += 1;
    if (filterPatientId) n += 1;
    return n;
  }, [filterHall, filterType, filterShift, filterStatus, filterRecon, filterPatientId]);

  const esc = escapeDialysisPrintHtml;

  const printSessionsRowsHtml = useMemo(
    () =>
      filteredReportRows
        .map((r, i) => {
          const hosp = esc(r.hospital?.name || '—');
          const patient = esc(r.dialysisPatient?.fullName || '—');
          const hall = esc(r.location?.hallName || '—');
          const bed = esc(r.location?.bedCode || '—');
          const date = esc(formatDialysisCalendarDate(r.sessionDate));
          const time = esc(r.startedAt ? dayjs(r.startedAt).format('HH:mm') : '—');
          const shift = esc(SHIFT_LABEL_AR[(r.shift || '').toUpperCase()] || '—');
          const intake = esc(INTAKE_LABEL_AR[r.intakeKind || ''] || '—');
          const status = esc(STATUS_LABEL_AR[(r.status || '').toUpperCase()] || r.status || '—');
          const creator = esc(sessionCreatorDisplayName(r));
          const recon = computeReconStatus(r, statCoverageKeys, supplyMismatchKeys);
          const reconAr = esc(RECON_STATUS_LABEL[recon]);
          const notes = esc(r.notes || '—');
          const hospCell = showHospitalInReports ? `<td>${hosp}</td>` : '';
          return `<tr><td>${i + 1}</td>${hospCell}<td>${patient}</td><td>${hall}</td><td>${bed}</td><td>${date}</td><td>${time}</td><td>${shift}</td><td>${intake}</td><td>${status}</td><td>${creator}</td><td>${reconAr}</td><td>${notes}</td></tr>`;
        })
        .join(''),
    [filteredReportRows, showHospitalInReports, statCoverageKeys, supplyMismatchKeys]
  );

  const sessionsPrintColspan = showHospitalInReports ? 13 : 12;
  const sessionsPrintHospitalTh = showHospitalInReports ? '<th>المستشفى</th>' : '';

  const sessionReportColumns = useMemo(
    () => [
      { title: '#', key: 'idx', width: 70, render: (_: unknown, __: SessionReportRow, idx: number) => idx + 1 },
      ...(showHospitalInReports
        ? [
            {
              title: 'المستشفى',
              key: 'hosp',
              width: 160,
              render: (_: unknown, r: SessionReportRow) =>
                r.hospital?.name ? <Tag color="geekblue">{r.hospital.name}</Tag> : '—',
            },
          ]
        : []),
      { title: 'اسم المريض', key: 'p', render: (_: unknown, r: SessionReportRow) => r.dialysisPatient?.fullName || '—' },
      { title: 'الصالة', key: 'h', render: (_: unknown, r: SessionReportRow) => r.location?.hallName || '—' },
      { title: 'السرير', key: 'b', render: (_: unknown, r: SessionReportRow) => r.location?.bedCode || '—' },
      {
        title: 'تاريخ الجلسة',
        dataIndex: 'sessionDate',
        render: (d: string) => formatDialysisCalendarDate(d),
      },
      {
        title: 'الوقت',
        key: 't',
        render: (_: unknown, r: SessionReportRow) => (r.startedAt ? dayjs(r.startedAt).format('HH:mm') : '—'),
      },
      {
        title: 'النوبة',
        key: 's',
        render: (_: unknown, r: SessionReportRow) => SHIFT_LABEL_AR[(r.shift || '').toUpperCase()] || '—',
      },
      {
        title: 'نوع الجلسة',
        key: 'ik',
        render: (_: unknown, r: SessionReportRow) => {
          const k = r.intakeKind || '';
          const label = INTAKE_LABEL_AR[k] || '—';
          return <Tag color={INTAKE_KIND_TAG_COLOR[k] || 'default'}>{label}</Tag>;
        },
      },
      {
        title: 'الحالة',
        key: 'st',
        render: (_: unknown, r: SessionReportRow) => {
          const st = (r.status || '').toUpperCase();
          const label = STATUS_LABEL_AR[st] || r.status || '—';
          return <Tag color={STATUS_TAG_COLOR[st] || 'default'}>{label}</Tag>;
        },
      },
      {
        title: 'اسم الموظف',
        key: 'cu',
        width: 140,
        render: (_: unknown, r: SessionReportRow) => {
          const name = sessionCreatorDisplayName(r);
          const hint =
            r.created_by_username && name !== r.created_by_username
              ? `اسم الدخول: ${r.created_by_username}`
              : null;
          const inner = <span className="d-report-user-cell">{name}</span>;
          return hint ? <Tooltip title={hint}>{inner}</Tooltip> : inner;
        },
      },
      {
        title: 'مطابقة الإحصاء',
        key: 'rc',
        width: 160,
        render: (_: unknown, r: SessionReportRow) => {
          const rs = computeReconStatus(r, statCoverageKeys, supplyMismatchKeys);
          return <Tag color={RECON_TAG_COLOR[rs]}>{RECON_STATUS_LABEL[rs]}</Tag>;
        },
      },
      { title: 'ملاحظات', dataIndex: 'notes', render: (n?: string | null) => n || '—' },
    ],
    [showHospitalInReports, statCoverageKeys, supplyMismatchKeys]
  );


  const reportSecondaryFilters = (
    <>
      <Select
        className="d-report-filter-field"
        value={filterHall}
        onChange={setFilterHall}
        placeholder="الصالة"
        options={[{ value: '', label: 'كل الصالات' }, ...hallOptions.map((h) => ({ value: h, label: h }))]}
      />
      <Select
        className="d-report-filter-field"
        value={filterType}
        onChange={setFilterType}
        placeholder="نوع الجلسة"
        options={[
          { value: '', label: 'كل الأنواع' },
          { value: 'SCHEDULED', label: 'مجدولة' },
          { value: 'OFF_SCHEDULE', label: 'غير مجدولة' },
          { value: 'EMERGENCY', label: 'طارئة' },
        ]}
      />
      <Select
        className="d-report-filter-field"
        value={filterShift}
        onChange={setFilterShift}
        placeholder="النوبة"
        options={SHIFT_FILTER_OPTIONS}
      />
      <Select
        className="d-report-filter-field"
        value={filterStatus}
        onChange={setFilterStatus}
        placeholder="حالة الجلسة"
        options={[
          { value: '', label: 'كل الحالات' },
          { value: 'ACTIVE', label: 'نشطة' },
          { value: 'COMPLETED', label: 'منتهية' },
          { value: 'CANCELLED', label: 'ملغاة' },
        ]}
      />
      <Select
        className="d-report-filter-field"
        value={filterRecon || ''}
        onChange={(v) => setFilterRecon((v || '') as '' | ReconRowStatus)}
        placeholder="مطابقة الإحصاء"
        options={[
          { value: '', label: 'كل حالات المطابقة' },
          { value: 'matched', label: RECON_STATUS_LABEL.matched },
          { value: 'missing', label: RECON_STATUS_LABEL.missing },
          { value: 'supply', label: RECON_STATUS_LABEL.supply },
          { value: 'na', label: RECON_STATUS_LABEL.na },
        ]}
      />
      <Select
        className="d-report-filter-field"
        allowClear
        showSearch
        optionFilterProp="label"
        value={filterPatientId}
        onChange={(v) => setFilterPatientId(v)}
        placeholder="المريض"
        options={patientOptions.map((p) => ({
          value: p.id,
          label: `${p.fullName} (${p.kind === 'EMERGENCY' ? 'طارئ' : 'دائم'})`,
        }))}
      />
    </>
  );

  const kpiCardsEl = (
    <>
      {[
        { label: 'إجمالي الجلسات', value: kpis.total, icon: <CalendarOutlined />, accent: '#6366f1' },
        { label: 'مرضى فريدون', value: kpis.uniquePatients, icon: <TeamOutlined />, accent: '#8b5cf6' },
        { label: 'مجدولة', value: kpis.scheduled, icon: <FileDoneOutlined />, accent: '#3b82f6' },
        { label: 'غير مجدولة', value: kpis.unscheduled, icon: <RiseOutlined />, accent: '#f59e0b' },
        { label: 'طارئة', value: kpis.emergency, icon: <ThunderboltOutlined />, accent: '#ec4899' },
        { label: 'صباحية', value: kpis.morning, icon: <PieChartOutlined />, accent: '#14b8a6' },
        { label: 'مسائية', value: kpis.evening, icon: <PieChartOutlined />, accent: '#0d9488' },
        { label: 'نشطة', value: kpis.active, icon: <CheckCircleOutlined />, accent: '#22c55e' },
        { label: 'منتهية', value: kpis.completed, icon: <CheckCircleOutlined />, accent: '#15803d' },
        { label: 'ملغاة', value: kpis.cancelled, icon: <WarningOutlined />, accent: '#94a3b8' },
        { label: 'مسجّل إحصاء', value: kpis.reconMatched, icon: <FileDoneOutlined />, accent: '#10b981' },
        { label: 'غير مسجّل', value: kpis.reconMissing, icon: <WarningOutlined />, accent: '#f97316' },
        { label: 'فرق مواد', value: kpis.reconSupply, icon: <WarningOutlined />, accent: '#dc2626' },
      ].map((c) => (
        <div key={c.label} className="d-report-kpi-card" style={{ ['--accent' as string]: c.accent }}>
          <span className="d-report-kpi-icon">{c.icon}</span>
          <div>
            <div className="d-report-kpi-value">{c.value}</div>
            <div className="d-report-kpi-label">{c.label}</div>
          </div>
        </div>
      ))}
    </>
  );

  const reportHeroEl = (
    <div className="d-report-hero">
      <Space direction="vertical" size={6} className="d-report-hero-text">
        <Title level={isMobile ? 5 : 4} style={{ margin: 0 }}>
          لوحة تحليل الجلسات
        </Title>
        {!isMobile ? (
          <Text type="secondary" style={{ maxWidth: 720 }}>
            مؤشرات ومخططات حسب الفلاتر — تُقارن كل جلسة حوكمة مع وجود سجل إحصائي لنفس المريض والتاريخ والنوبة.
            نسبة التغطية تستثني الجلسات الملغاة.
          </Text>
        ) : null}
      </Space>
      <div className="d-report-hero-progress">
        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>
          تغطية السجل الإحصائي
        </Text>
        <Progress
          percent={kpis.statCoveragePct}
          strokeColor={{ '0%': '#6366f1', '100%': '#14b8a6' }}
          status="active"
          format={(p) => `${p}%`}
        />
      </div>
    </div>
  );

  const chartsSection = (
    <>
      {showHospitalInReports ? (
                    <Card
                      size="small"
                      title="توزيع الجلسات حسب المستشفى"
                      className="d-report-chart-card"
                      style={{ marginBottom: 16 }}
                    >
                      <Row gutter={[16, 16]}>
                        <Col xs={24} lg={14}>
                          <div className="d-report-chart-plot" style={{ height: 280 }}>
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart
                                data={chartByHospital}
                                margin={{ top: 8, right: 8, left: 0, bottom: 8 }}
                              >
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.35)" />
                                <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-18} textAnchor="end" height={70} />
                                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                                <RechartsTooltip />
                                <Bar dataKey="value" name="جلسات" radius={[8, 8, 0, 0]}>
                                  {chartByHospital.map((_, idx) => (
                                    <Cell key={`hosp-${idx}`} fill={CHART_PALETTE[idx % CHART_PALETTE.length]} />
                                  ))}
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </Col>
                        <Col xs={24} lg={10}>
                          <Table
                            rowKey="key"
                            size="small"
                            pagination={false}
                            dataSource={hospitalDistributionRows}
                            locale={{ emptyText: 'لا توجد جلسات في الفترة' }}
                            columns={[
                              { title: 'المستشفى', dataIndex: 'hospitalName', ellipsis: true },
                              { title: 'عدد الجلسات', dataIndex: 'count', width: 110 },
                              {
                                title: 'النسبة %',
                                dataIndex: 'pct',
                                width: 90,
                                render: (p: number) => `${p}%`,
                              },
                            ]}
                          />
                        </Col>
                      </Row>
                    </Card>
                    ) : null}

                    <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                      <Col xs={24} lg={14}>
                        <Card
                          size="small"
                          title="توزيع الجلسات على الصالات"
                          className="d-report-chart-card"
                        >
                          <div className="d-report-chart-plot" style={{ height: 300 }}>
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={chartByHall} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.35)" />
                                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                                <YAxis tick={{ fontSize: 11 }} />
                                <RechartsTooltip />
                                <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                                  {chartByHall.map((_, idx) => (
                                    <Cell key={`hall-${idx}`} fill={CHART_PALETTE[idx % CHART_PALETTE.length]} />
                                  ))}
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </Card>
                      </Col>
                      <Col xs={24} lg={10}>
                        <Card
                          size="small"
                          title="اتجاه الجلسات شهرياً"
                          className="d-report-chart-card"
                        >
                          <div className="d-report-chart-plot" style={{ height: 300 }}>
                            <ResponsiveContainer width="100%" height="100%">
                              <AreaChart data={monthlyTrendData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                                <defs>
                                  <linearGradient id="dReportAreaTotal" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.35} />
                                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                  </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.35)" />
                                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                                <YAxis tick={{ fontSize: 11 }} />
                                <RechartsTooltip />
                                <Area
                                  type="monotone"
                                  dataKey="total"
                                  stroke="#6366f1"
                                  strokeWidth={2}
                                  fillOpacity={1}
                                  fill="url(#dReportAreaTotal)"
                                />
                              </AreaChart>
                            </ResponsiveContainer>
                          </div>
                        </Card>
                      </Col>
                    </Row>

                    <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                      <Col xs={24} md={8}>
                        <Card size="small" title="نوع الجلسة" className="d-report-chart-card">
                          <div className="d-report-chart-plot" style={{ height: 260 }}>
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie data={chartByType} dataKey="value" nameKey="name" innerRadius={44} outerRadius={72} paddingAngle={2}>
                                  {chartByType.map((_, idx) => (
                                    <Cell key={`type-${idx}`} fill={CHART_PALETTE[idx % CHART_PALETTE.length]} />
                                  ))}
                                </Pie>
                                <Legend />
                                <RechartsTooltip />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                        </Card>
                      </Col>
                      <Col xs={24} md={8}>
                        <Card size="small" title="النوبة" className="d-report-chart-card">
                          <div className="d-report-chart-plot" style={{ height: 260 }}>
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie data={chartByShift} dataKey="value" nameKey="name" innerRadius={44} outerRadius={72} paddingAngle={2}>
                                  {chartByShift.map((_, idx) => (
                                    <Cell key={`shift-${idx}`} fill={CHART_PALETTE[(idx + 2) % CHART_PALETTE.length]} />
                                  ))}
                                </Pie>
                                <Legend />
                                <RechartsTooltip />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                        </Card>
                      </Col>
                      <Col xs={24} md={8}>
                        <Card size="small" title="حالة الجلسة" className="d-report-chart-card">
                          <div className="d-report-chart-plot" style={{ height: 260 }}>
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie data={chartByStatus} dataKey="value" nameKey="name" innerRadius={44} outerRadius={72} paddingAngle={2}>
                                  {chartByStatus.map((_, idx) => (
                                    <Cell key={`st-${idx}`} fill={CHART_PALETTE[(idx + 4) % CHART_PALETTE.length]} />
                                  ))}
                                </Pie>
                                <Legend />
                                <RechartsTooltip />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                        </Card>
                      </Col>
                    </Row>

                    <Row gutter={[16, 16]} style={{ marginBottom: 8 }}>
                      <Col xs={24} md={12} lg={10}>
                        <Card size="small" title="مطابقة الجلسات مع الإحصاء" className="d-report-chart-card">
                          <div className="d-report-chart-plot" style={{ height: 260 }}>
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie data={chartReconSummary} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                                  {chartReconSummary.map((_, idx) => (
                                    <Cell key={`rc-${idx}`} fill={CHART_PALETTE[(idx + 1) % CHART_PALETTE.length]} />
                                  ))}
                                </Pie>
                                <Legend />
                                <RechartsTooltip />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                        </Card>
                      </Col>
                    </Row>
    </>
  );

  const printReport = (openPrintDialog = true) => {
    const printedAt = dayjs().format('YYYY-MM-DD HH:mm');
    const topRowsHtml = topPatients
      .map((r, idx) => `<tr><td>${idx + 1}</td><td>${esc(r.name)}</td><td>${r.count}</td></tr>`)
      .join('');
    const monthlyRowsHtml = monthlyStats
      .map(
        (m) =>
          `<tr><td>${m.month}</td><td>${m.total}</td><td>${m.morning}</td><td>${m.evening}</td><td>${m.scheduled}</td><td>${m.unscheduled}</td><td>${m.emergency}</td><td>${m.uniquePatients}</td><td>${m.dailyAverage}</td></tr>`
      )
      .join('');
    const typeRowsHtml = chartByType
      .map((r) => `<tr><td>${esc(r.name)}</td><td>${r.value}</td></tr>`)
      .join('');
    const shiftRowsHtml = chartByShift
      .map((r) => `<tr><td>${esc(r.name)}</td><td>${r.value}</td></tr>`)
      .join('');

    const kpiSec = (title: string, cards: { n: string | number; l: string }[]) => {
      const cells = cards
        .map(
          (c) =>
            `<div class="kpi compact"><div class="n">${c.n}</div><div class="l">${esc(c.l)}</div></div>`
        )
        .join('');
      return `<div class="print-kpi-section"><h4>${esc(title)}</h4><div class="print-kpi-row">${cells}</div></div>`;
    };

    const kpiBlock = `
<div class="print-kpi-wrap">
  ${kpiSec('١ — ملخص عام', [
    { n: kpis.total, l: 'إجمالي الجلسات' },
    { n: kpis.uniquePatients, l: 'مرضى فريدون' },
    { n: `${kpis.statCoveragePct}%`, l: 'تغطية الإحصاء' },
  ])}
  ${kpiSec('٢ — حسب نوع الجلسة', [
    { n: kpis.scheduled, l: 'مجدولة' },
    { n: kpis.unscheduled, l: 'غير مجدولة' },
    { n: kpis.emergency, l: 'طارئة' },
  ])}
  ${kpiSec('٣ — حسب النوبة', [
    { n: kpis.morning, l: 'صباحية' },
    { n: kpis.evening, l: 'مسائية' },
  ])}
  ${kpiSec('٤ — حالة الجلسة', [
    { n: kpis.active, l: 'نشطة' },
    { n: kpis.completed, l: 'منتهية' },
    { n: kpis.cancelled, l: 'ملغاة' },
  ])}
  ${kpiSec('٥ — مطابقة الإحصاء', [
    { n: kpis.reconMatched, l: 'مسجّل في الإحصاء' },
    { n: kpis.reconMissing, l: 'غير مسجّل' },
    { n: kpis.reconSupply, l: 'فرق في المواد' },
  ])}
</div>`;

    const hospitalPrintRowsHtml = hospitalDistributionRows
      .map(
        (r) =>
          `<tr><td>${esc(r.hospitalName)}</td><td>${r.count}</td><td>${r.pct}%</td></tr>`
      )
      .join('');

    const hospitalChartsPrint = showHospitalInReports
      ? `
<div class="print-charts-row single">
  <div class="chart-box"><h4>توزيع الجلسات حسب المستشفى</h4>${buildPrintHBars(chartByHospital, CHART_PALETTE, esc)}</div>
</div>
<div class="sec" style="margin-bottom:12px"><h3 style="margin:8px 0">جدول التوزيع حسب المستشفى</h3>
<table class="data"><thead><tr><th>المستشفى</th><th>عدد الجلسات</th><th>النسبة %</th></tr></thead><tbody>${hospitalPrintRowsHtml || '<tr><td colspan="3">—</td></tr>'}</tbody></table></div>`
      : '';

    const chartsBlock = `
<div class="print-charts-title">المخططات البيانية</div>
${hospitalChartsPrint}
<div class="print-charts-row">
  <div class="chart-box"><h4>توزيع الجلسات على الصالات</h4>${buildPrintHBars(chartByHall, CHART_PALETTE, esc)}</div>
  <div class="chart-box"><h4>اتجاه الجلسات شهرياً</h4>${buildPrintTrendSvg(monthlyTrendData)}</div>
</div>
<div class="print-charts-row three">
  <div class="chart-box"><h4>نوع الجلسة</h4>${buildPrintPieSvg(chartByType, CHART_PALETTE)}</div>
  <div class="chart-box"><h4>النوبة</h4>${buildPrintPieSvg(chartByShift, CHART_PALETTE)}</div>
  <div class="chart-box"><h4>حالة الجلسة</h4>${buildPrintPieSvg(chartByStatus, CHART_PALETTE)}</div>
</div>
<div class="print-charts-row single">
  <div class="chart-box"><h4>مطابقة الجلسات مع الإحصاء</h4>${buildPrintPieSvg(chartReconSummary, CHART_PALETTE)}</div>
</div>`;

    const printHeaderHtml = buildDialysisPrintHeaderHtml({
      reportTitle: 'لوحة التقارير والإحصاءات — جلسات الغسل',
      reportSubtitle: printTitle,
      hospitalLabel: reportHospitalLabel,
      filters: reportPrintFilters,
      printedAt,
      sessionCount: filteredReportRows.length,
    });

    const html = `<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8" />
<title>${esc(printTitle)}</title>
<style>
*{box-sizing:border-box}
html,body{font-family:Tahoma,'Segoe UI',Arial,sans-serif;background:#fff;color:#0f172a;margin:0;padding:14px 16px;font-size:12px;line-height:1.45}
${DIALYSIS_PRINT_HEADER_CSS}
.print-kpi-wrap{margin:12px 0 18px;display:flex;flex-direction:column;gap:12px}
.print-kpi-section{break-inside:avoid-page;border:1px solid #cfe8f6;border-radius:12px;padding:10px 12px;background:linear-gradient(180deg,#fafdff 0%,#fff 100%)}
.print-kpi-section h4{margin:0 0 10px;font-size:13px;font-weight:800;color:#0c4a6e;border-bottom:2px solid #28b2e1;padding-bottom:6px}
.print-kpi-row{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.print-kpi-row.four{grid-template-columns:repeat(4,1fr)}
.kpi.compact{border:1px solid #dbeaf5;border-radius:10px;padding:8px 6px;text-align:center;background:#fff}
.kpi.compact .n{font-size:20px;font-weight:900;color:#157c67}
.kpi.compact .l{font-size:11px;color:#475569;margin-top:2px}
.print-charts-title{font-size:15px;font-weight:800;color:#0c4a6e;margin:16px 0 10px;padding-bottom:6px;border-bottom:2px solid #bae6fd}
.print-charts-row{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;break-inside:avoid-page}
.print-charts-row.three{grid-template-columns:1fr 1fr 1fr}
.print-charts-row.single{grid-template-columns:1fr;max-width:420px;margin-inline:auto}
.chart-box{border:1px solid #dbeaf5;border-radius:12px;padding:10px 12px;background:#fafdff;break-inside:avoid}
.chart-box h4{margin:0 0 10px;font-size:12px;font-weight:700;color:#134e7c}
.chart-empty{margin:8px 0;color:#94a3b8;font-size:11px;text-align:center}
.hbar-chart{width:100%}
.hbar-row{display:flex;align-items:center;gap:8px;margin:7px 0;font-size:11px}
.hbar-name{flex:0 0 92px;text-align:end;color:#334155;word-break:break-word}
.hbar-track{flex:1;height:15px;background:#e8f4fc;border-radius:8px;overflow:hidden;min-width:40px}
.hbar-fill{height:100%;border-radius:8px;min-width:2px}
.hbar-num{flex:0 0 26px;font-weight:800;text-align:start;color:#0f172a}
.pie-wrap{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:10px}
.pie-legend{display:flex;flex-direction:column;gap:4px;font-size:10px;color:#334155}
.pie-legend span{display:flex;align-items:center;gap:6px}
.pie-legend i{width:10px;height:10px;border-radius:3px;flex-shrink:0}
.trend-svg{display:block;max-width:100%;margin:0 auto}
.sec{margin-top:14px;break-inside:avoid-page}
.sec h3{margin:0 0 10px;font-size:16px;font-weight:800;color:#0c4a6e;break-after:avoid-page}
.sec.sessions{margin-top:18px}
.divider{height:4px;border:0;background:linear-gradient(90deg,#28b2e1,#bae6fd);border-radius:999px;margin:16px 0}
table.data{width:100%;border-collapse:collapse;page-break-inside:auto;font-size:11px}
table.data thead{display:table-header-group}
table.data tfoot{display:table-footer-group}
table.data tr{page-break-inside:avoid;page-break-after:auto}
table.data th,table.data td{border:1px solid #dbeaf5;padding:5px 7px;vertical-align:middle}
table.data th{background:linear-gradient(180deg,#e0f2fe 0%,#dbeafe 100%);font-weight:700;color:#0c4a6e}
.two{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.print-signature{display:none}
.print-footer{display:none}
.preview-tools{
  position:sticky;
  top:0;
  z-index:9999;
  display:flex;
  gap:8px;
  align-items:center;
  justify-content:space-between;
  margin:0 0 12px;
  padding:9px 10px;
  border:1px solid #dbeaf5;
  border-radius:10px;
  background:#f8fbff;
}
.preview-tools__meta{font-size:11px;color:#334155;font-weight:700}
.preview-tools__actions{display:flex;gap:6px}
.preview-tools button{
  border:1px solid #cbd5e1;
  background:#fff;
  color:#0f172a;
  padding:6px 10px;
  border-radius:8px;
  font-size:11px;
  font-weight:700;
}
.preview-tools button.primary{
  background:#157c67;
  border-color:#157c67;
  color:#fff;
}
@media print{
  @page{size:A4;margin:7mm 7mm 18mm 7mm}
  body{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .no-print{display:none !important}
  .print-signature{
    display:block;
    position:fixed;
    left:1mm;
    bottom:0.5mm;
    width:230px;
    opacity:.75;
    z-index:2147483647;
    pointer-events:none;
  }
  .print-signature svg{width:100%;height:auto;display:block}
  .print-footer{
    display:flex;
    position:fixed;
    left:0;
    right:0;
    bottom:0;
    border-top:1px dashed #dbeaf5;
    background:transparent;
    padding:4px 7px;
    align-items:center;
    justify-content:space-between;
    font-size:11px;
    color:#51657a;
  }
  .page-num::after{
    content:"صفحة " counter(page) " من " counter(pages);
  }
}
</style></head><body>
<div class="preview-tools no-print">
  <div class="preview-tools__meta">وضع المعاينة للطباعة/PDF</div>
  <div class="preview-tools__actions">
    <button onclick="window.print()">طباعة / حفظ PDF</button>
    <button class="primary" onclick="window.close()">رجوع للنظام</button>
  </div>
</div>
<div class="print-signature" aria-hidden="true">
  <svg viewBox="0 0 600 300" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="shine" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#ffffff" stop-opacity=".38"/>
        <stop offset="60%" stop-color="#ffffff" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <g>
      <rect x="15" y="15" width="570" height="270" rx="28" ry="28" fill="none" stroke="#0a4fb4" stroke-width="6"/>
      <rect x="28" y="28" width="544" height="244" rx="22" ry="22" fill="none" stroke="#0a4fb4" stroke-width="2"/>
      <rect x="52" y="52" width="496" height="196" rx="18" ry="18" fill="none" stroke="#0a4fb4" stroke-width="2" stroke-dasharray="6 6" opacity=".7"/>
      <g fill="none" stroke="#0a4fb4" stroke-width="2.6" opacity=".9">
        <path d="M55 85 q22-22 50-35" />
        <path d="M545 85 q-22-22 -50-35" />
        <path d="M55 215 q22 22 50 35" />
        <path d="M545 215 q-22 22 -50 35" />
      </g>
    </g>
    <rect x="28" y="28" width="544" height="60" rx="20" ry="20" fill="url(#shine)" />
    <g transform="translate(95,70) scale(0.5)">
      <g fill="none" stroke="#0a4fb4" stroke-width="3">
        <circle cx="0" cy="0" r="40" />
        <circle cx="0" cy="0" r="26" stroke-width="2"/>
      </g>
      <path d="M -20 0 h 10 l 5 -10 l 6 20 l 7 -15 h 20" fill="none" stroke="#0a4fb4" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
      <g transform="translate(20,-20)" fill="#0a4fb4">
        <rect x="-4" y="-12" width="8" height="24" rx="2"/>
        <rect x="-12" y="-4" width="24" height="8" rx="2"/>
      </g>
    </g>
    <g fill="#0a4fb4" stroke="#0a4fb4">
      <text x="300" y="120" text-anchor="middle" style="font-family:'Aref Ruqaa',serif; font-size:46px; font-weight:700;">المهندس حيدر الحكيم</text>
      <path d="M170 132 q130 28 260 0" fill="none" stroke-width="3"/>
      <text x="300" y="198" text-anchor="middle" style="font-family:'Cairo',sans-serif; font-size:24px; font-weight:800;">مسؤول وحدة الحوكمة</text>
      <text x="300" y="228" text-anchor="middle" style="font-family:'Cairo',sans-serif; font-size:21px; font-weight:700;">شعبة الكلية الصناعية – مستشفى الحكيم العام</text>
    </g>
    <g fill="#0a4fb4">
      <circle cx="96" cy="238" r="3"/>
      <circle cx="504" cy="238" r="3"/>
    </g>
  </svg>
</div>

${printHeaderHtml}

${kpiBlock}
${chartsBlock}

${shouldShowExtendedSections ? `<hr class="divider"><div class="sec"><h3>أكثر 10 مراجعين غسلات في الفترة</h3>
<table class="data"><thead><tr><th>الترتيب</th><th>اسم المريض</th><th>عدد الجلسات</th></tr></thead><tbody>${topRowsHtml || '<tr><td colspan="3">—</td></tr>'}</tbody></table></div>` : ''}

${shouldShowExtendedSections ? `<div class="sec"><h3>الإحصاءات الشهرية</h3>
<table class="data"><thead><tr><th>الشهر</th><th>الإجمالي</th><th>صباحية</th><th>مسائية</th><th>مجدولة</th><th>غير مجدولة</th><th>طارئة</th><th>مرضى فريدون</th><th>معدل يومي</th></tr></thead><tbody>${monthlyRowsHtml || '<tr><td colspan="9">—</td></tr>'}</tbody></table></div>` : ''}

${shouldShowExtendedSections ? `<div class="sec"><h3>جداول تفصيلية (نوع الجلسة والنوبة)</h3><div class="two">
<div><h4 style="margin:0 0 6px;font-size:13px">حسب نوع الجلسة</h4><table class="data"><thead><tr><th>النوع</th><th>العدد</th></tr></thead><tbody>${typeRowsHtml}</tbody></table></div>
<div><h4 style="margin:0 0 6px;font-size:13px">حسب النوبة</h4><table class="data"><thead><tr><th>النوبة</th><th>العدد</th></tr></thead><tbody>${shiftRowsHtml}</tbody></table></div>
</div></div>` : ''}

<hr class="divider"><div class="sec sessions"><h3>كل الجلسات حسب الفلاتر</h3>
<table class="data"><thead><tr><th>#</th>${sessionsPrintHospitalTh}<th>اسم المريض</th><th>الصالة</th><th>رقم السرير</th><th>تاريخ الجلسة</th><th>الوقت</th><th>النوبة</th><th>نوع الجلسة</th><th>الحالة</th><th>اسم الموظف</th><th>مطابقة الإحصاء</th><th>ملاحظات</th></tr></thead>
<tbody>${printSessionsRowsHtml || `<tr><td colspan="${sessionsPrintColspan}">لا توجد بيانات</td></tr>`}</tbody></table>
</div>
<div class="print-footer"><div>شعبة الكلية الصناعية – وحدة الحوكمة</div><div class="page-num"></div></div>
</body></html>`;

    const w = window.open('', '_blank');
    if (!w) {
      message.error('المتصفح منع نافذة الطباعة.');
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
    if (openPrintDialog) {
      setTimeout(() => w.print(), 250);
    }
  };

  const downloadReportPdf = async () => {
    const reportRoot = document.querySelector('.d-report-print') as HTMLElement | null;
    if (!reportRoot) {
      message.error('تعذر تحديد محتوى التقرير للتنزيل.');
      return;
    }

    setPdfLoading(true);
    reportRoot.classList.add('d-report-exporting-pdf');
    try {
      await new Promise((resolve) => setTimeout(resolve, 120));
      const canvas = await html2canvas(reportRoot, {
        scale: Math.min(window.devicePixelRatio || 2, 2.2),
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      });

      const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 6;
      const usableWidth = pageWidth - margin * 2;
      const usableHeight = pageHeight - margin * 2;
      const imageHeight = (canvas.height * usableWidth) / canvas.width;
      const imageData = canvas.toDataURL('image/jpeg', 0.95);

      let remainingHeight = imageHeight;
      pdf.addImage(imageData, 'JPEG', margin, margin, usableWidth, imageHeight, undefined, 'FAST');
      remainingHeight -= usableHeight;

      while (remainingHeight > 0) {
        pdf.addPage();
        const offsetY = margin - (imageHeight - remainingHeight);
        pdf.addImage(imageData, 'JPEG', margin, offsetY, usableWidth, imageHeight, undefined, 'FAST');
        remainingHeight -= usableHeight;
      }

      const filename = `dialysis-report-${reportDateFrom.format('YYYYMMDD')}-${reportDateTo.format('YYYYMMDD')}.pdf`;
      pdf.save(filename);
      message.success('تم تنزيل PDF بنجاح');
    } catch (error) {
      console.error('Dialysis report PDF export failed:', error);
      message.error('فشل تنزيل PDF. حاول مرة أخرى.');
    } finally {
      reportRoot.classList.remove('d-report-exporting-pdf');
      setPdfLoading(false);
    }
  };


  return (
    <>
      {variant === 'reports' ? (
        <>
          <div className="d-page-header">
            <h2>التقارير</h2>
            <Text className="sub">
              مؤشرات ومخططات وجداول لجلسات الغسل (نظام الحوكمة). <strong>الإحصاء والمطابقة</strong> في قسم
              منفصل: «الإحصاء والمطابقة» من القائمة الجانبية أو «المزيد» على الموبايل.
            </Text>
          </div>
          <div className={`d-card d-report-print${isMobile ? ' d-report-page--mobile' : ''}`}>
                {isMobile ? (
                  <>
                    <div className="d-report-mobile-sticky">
                      <div className="d-report-mobile-dates">
                        <DatePicker
                          value={reportDateFrom}
                          onChange={(d) => d && setReportDateFrom(d.startOf('day'))}
                          format="YYYY-MM-DD"
                          placeholder="من تاريخ"
                        />
                        <DatePicker
                          value={reportDateTo}
                          onChange={(d) => d && setReportDateTo(d.endOf('day'))}
                          format="YYYY-MM-DD"
                          placeholder="إلى تاريخ"
                        />
                      </div>
                      <div className="d-report-mobile-actions">
                        <Button
                          type="primary"
                          icon={<FilterOutlined />}
                          onClick={() => setFiltersDrawerOpen(true)}
                        >
                          فلاتر
                          {activeExtraFilterCount > 0 ? (
                            <Badge count={activeExtraFilterCount} style={{ marginInlineStart: 6 }} />
                          ) : null}
                        </Button>
                        <Button icon={<ReloadOutlined />} loading={reportLoading} onClick={loadReportData}>
                          تحديث
                        </Button>
                        <div className="d-report-mobile-actions__wide">
                          <Button icon={<FileExcelOutlined />} onClick={exportReportExcel}>
                            Excel
                          </Button>
                          <Button icon={<DownloadOutlined />} onClick={downloadReportPdf} loading={pdfLoading}>
                            PDF
                          </Button>
                          <Button type="primary" ghost icon={<PrinterOutlined />} onClick={() => printReport()}>
                            طباعة
                          </Button>
                          <Button onClick={resetReportFilters}>مسح</Button>
                        </div>
                      </div>
                    </div>
                    <Drawer
                      title="فلاتر التقرير"
                      placement="bottom"
                      height="85%"
                      open={filtersDrawerOpen}
                      onClose={() => setFiltersDrawerOpen(false)}
                      className="d-report-filters-drawer"
                      destroyOnHidden={false}
                    >
                      {reportSecondaryFilters}
                      <div className="d-report-filters-drawer__actions">
                        <Button
                          type="primary"
                          onClick={() => {
                            setFiltersDrawerOpen(false);
                            loadReportData();
                          }}
                        >
                          تطبيق
                        </Button>
                        <Button
                          onClick={() => {
                            resetReportFilters();
                            setFiltersDrawerOpen(false);
                          }}
                        >
                          مسح الكل
                        </Button>
                      </div>
                    </Drawer>
                  </>
                ) : (
                  <div className="d-toolbar">
                    <DatePicker
                      value={reportDateFrom}
                      onChange={(d) => d && setReportDateFrom(d.startOf('day'))}
                      format="YYYY-MM-DD"
                      placeholder="من تاريخ"
                    />
                    <DatePicker
                      value={reportDateTo}
                      onChange={(d) => d && setReportDateTo(d.endOf('day'))}
                      format="YYYY-MM-DD"
                      placeholder="إلى تاريخ"
                    />
                    {reportSecondaryFilters}
                    <Button onClick={resetReportFilters}>مسح الفلاتر</Button>
                    <Button icon={<ReloadOutlined />} loading={reportLoading} onClick={loadReportData}>
                      تحديث
                    </Button>
                    <span className="grow" />
                    <Button icon={<FileExcelOutlined />} onClick={exportReportExcel}>
                      Excel
                    </Button>
                    <Button icon={<DownloadOutlined />} onClick={downloadReportPdf} loading={pdfLoading}>
                      PDF
                    </Button>
                    <Button icon={<PrinterOutlined />} onClick={() => printReport()}>
                      طباعة
                    </Button>
                  </div>
                )}

                                <Card className={`d-report-scope-banner${isMobile ? ' d-report-scope-banner--mobile' : ''}${scopeTagsExpanded ? ' is-expanded' : ''}`} size="small">
                  <div className="d-report-scope-banner__inner">
                    <DialysisBrandLogo size="md" />
                    <div className="d-report-scope-banner__body">
                      <Text type="secondary" className="d-report-scope-banner__ministry">
                        {DIALYSIS_MINISTRY_LINE}
                      </Text>
                      <Title level={5} style={{ margin: '4px 0 8px' }}>
                        {reportHospitalLabel}
                      </Title>
                      <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
                        {printTitle} — {filteredReportRows.length} جلسة بعد تطبيق الفلاتر
                      </Text>
                      {isMobile ? (
                        <>
                          <Button
                            type="link"
                            className="d-report-scope-toggle"
                            onClick={() => setScopeTagsExpanded((v) => !v)}
                          >
                            {scopeTagsExpanded ? 'إخفاء الفلاتر' : 'عرض تفاصيل الفلاتر'}
                          </Button>
                          <Space
                            size={[6, 6]}
                            wrap
                            className={`d-report-scope-tags-collapsed${scopeTagsExpanded ? '' : ''}`}
                          >
                            {reportPrintFilters.map((f) => (
                              <Tag key={f.label} color="processing" style={{ margin: 0 }}>
                                {f.label}: {f.value}
                              </Tag>
                            ))}
                          </Space>
                        </>
                      ) : (
                        <Space size={[6, 6]} wrap>
                          {reportPrintFilters.map((f) => (
                            <Tag key={f.label} color="processing" style={{ margin: 0 }}>
                              {f.label}: {f.value}
                            </Tag>
                          ))}
                        </Space>
                      )}
                    </div>
                  </div>
                </Card>

                <div className="d-report-dashboard">
                  {isMobile ? (
                    <Collapse
                      bordered={false}
                      className="d-report-mobile-collapse"
                      defaultActiveKey={['summary', 'charts']}
                      items={[
                        {
                          key: 'summary',
                          label: (
                            <span>
                              ملخص · <strong>{kpis.total}</strong> جلسة · تغطية {kpis.statCoveragePct}%
                            </span>
                          ),
                          children: (
                            <div className="d-report-mobile-tab-panel">
                              {reportHeroEl}
                              <div className="d-report-kpi-scroll">{kpiCardsEl}</div>
                            </div>
                          ),
                        },
                        {
                          key: 'charts',
                          label: 'المخططات والرسوم',
                          children: (
                            <div className="d-report-mobile-tab-panel">{chartsSection}</div>
                          ),
                        },
                      ]}
                    />
                  ) : (
                    <>
                      {reportHeroEl}
                      {!canRecon ? (
                        <Text type="secondary" style={{ display: 'block', marginBottom: 14, fontSize: 12 }}>
                          بلا صلاحية مطابقة: يُعرض «مسجّل / غير مسجّل» من السجل الإحصائي فقط. كشف «فرق في المواد»
                          يتطلّب صلاحية المطابقة.
                        </Text>
                      ) : null}
                      <div className="d-report-kpi-grid">{kpiCardsEl}</div>
                      {chartsSection}
                    </>
                  )}
                </div>

                {shouldShowExtendedSections ? (
                  <>
                    <div className="d-table-scroll" style={{ marginBottom: 16 }}>
                      <Title level={5}>أكثر 10 مراجعين غسلات في الفترة</Title>
                      <Table
                        rowKey={(r) => r.name}
                        pagination={false}
                        dataSource={topPatients.map((r, idx) => ({ rank: idx + 1, ...r }))}
                        columns={[
                          { title: 'الترتيب', dataIndex: 'rank', width: 90 },
                          { title: 'اسم المريض', dataIndex: 'name' },
                          { title: 'عدد الجلسات', dataIndex: 'count', width: 130 },
                        ]}
                      />
                    </div>

                    <div className="d-table-scroll" style={{ marginBottom: 16 }}>
                      <Title level={5}>الإحصاءات الشهرية</Title>
                      <Table
                        rowKey={(r) => r.month}
                        dataSource={monthlyStats}
                        pagination={false}
                        scroll={{ x: 'max-content' }}
                        columns={[
                          { title: 'الشهر', dataIndex: 'month' },
                          { title: 'الإجمالي', dataIndex: 'total' },
                          { title: 'صباحية', dataIndex: 'morning' },
                          { title: 'مسائية', dataIndex: 'evening' },
                          { title: 'مجدولة', dataIndex: 'scheduled' },
                          { title: 'غير مجدولة', dataIndex: 'unscheduled' },
                          { title: 'طارئة', dataIndex: 'emergency' },
                          { title: 'مرضى فريدون', dataIndex: 'uniquePatients' },
                          { title: 'معدل يومي', dataIndex: 'dailyAverage' },
                        ]}
                      />
                    </div>
                  </>
                ) : (
                  <Text
                    type="secondary"
                    className="d-report-extended-hint"
                    style={{ display: 'block', marginBottom: 16 }}
                  >
                    الجداول التفصيلية (أعلى 10، شهري، نوع/نوبة) تظهر عند فترة 20 يوماً أو أكثر.
                  </Text>
                )}

                <div className="d-report-sessions-section">
                  <div className="d-report-sessions-header">
                    <div className="d-report-sessions-header__text">
                      <Title level={5}>{isMobile ? 'الجلسات' : 'كل الجلسات حسب الفلاتر'}</Title>
                      <Text type="secondary">حسب الفلاتر المحددة</Text>
                    </div>
                    <span className="d-report-sessions-count">{filteredReportRows.length}</span>
                  </div>
                  {isMobile ? (
                    <List<SessionReportRow>
                      className="d-report-session-list"
                      loading={reportLoading}
                      dataSource={filteredReportRows}
                      rowKey="id"
                      pagination={{
                        pageSize: 12,
                        showTotal: (t) => `إجمالي ${t}`,
                        size: 'small',
                        simple: true,
                      }}
                      locale={{ emptyText: 'لا توجد جلسات للفلاتر المحددة' }}
                      renderItem={(row, idx) => {
                        const ik = row.intakeKind || '';
                        const st = (row.status || '').toUpperCase();
                        const rs = computeReconStatus(row, statCoverageKeys, supplyMismatchKeys);
                        return (
                          <List.Item>
                            <ReportSessionMobileCard
                              row={row}
                              index={idx + 1}
                              showHospital={showHospitalInReports}
                              shiftLabel={SHIFT_LABEL_AR[(row.shift || '').toUpperCase()] || '—'}
                              intakeLabel={INTAKE_LABEL_AR[ik] || '—'}
                              intakeColor={INTAKE_KIND_TAG_COLOR[ik] || 'default'}
                              accentColor={INTAKE_ACCENT_HEX[ik] || '#6366f1'}
                              statusLabel={STATUS_LABEL_AR[st] || row.status || '—'}
                              statusColor={STATUS_TAG_COLOR[st] || 'default'}
                              reconLabel={RECON_STATUS_LABEL[rs]}
                              reconColor={RECON_TAG_COLOR[rs]}
                              creatorName={sessionCreatorDisplayName(row)}
                            />
                          </List.Item>
                        );
                      }}
                    />
                  ) : (
                    <div className="d-table-scroll">
                      <Table<SessionReportRow>
                        rowKey="id"
                        loading={reportLoading}
                        dataSource={filteredReportRows}
                        scroll={{ x: 'max-content' }}
                        pagination={{ pageSize: 20, showTotal: (t) => `إجمالي ${t} جلسة` }}
                        columns={sessionReportColumns}
                      />
                    </div>
                  )}
                </div>
              </div>
        </>
      ) : (
        <>
          <div className="d-page-header">
            <h2>الإحصاء والمطابقة</h2>
            <Text className="sub">
              <strong>الإحصاء:</strong> إدخال يدوي اسمًا اسمًا في السجل الإحصائي (مصدر ب) — منفصل عن جلسات قسم
              الحوكمة. <strong>المطابقة:</strong> في نهاية اليوم لمقارنة الميدان مع الإحصاء ومعرفة الفروقات.
            </Text>
          </div>
          {!canStatWrite && !canRecon && !canBulk ? (
            <div className="d-card">
              <Empty description="ليس لديك صلاحية الإحصاء أو المطابقة. راجع مسؤول النظام." />
            </div>
          ) : (
            <Tabs
              className="d-tabs-responsive"
              defaultActiveKey={statisticsDefaultTab}
              items={[
                {
                  key: 'stats',
                  label: 'الإحصاء اليومي',
                  disabled: !canStatWrite,
                  children: !canStatWrite ? (
              <div className="d-card">
                <Empty description="ليس لديك صلاحية إدخال الإحصاء اليومي أو الجماعي. اطلب من المشرف تفعيلها من «إدارة الوصول»." />
              </div>
            ) : (
              <div className="d-card">
                <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
                  يختار موظف الإحصاء المريض والتاريخ والوردية ويضيف سطرًا إلى السجل الرسمي. هذه القائمة لا تعرض
                  جلسات نظام الحوكمة — المطابقة مع الجلسات تتم من تبويب «المطابقة» عند الحاجة.
                </Text>

                <Form
                  form={entryForm}
                  layout="vertical"
                  onFinish={submitStatEntry}
                  initialValues={{
                    session_date: listDate,
                    shift: 'MORNING',
                  }}
                >
                  <Space wrap style={{ width: '100%', marginBottom: 16 }} align="start">
                    <Form.Item
                      name="dialysis_patient_id"
                      label="المريض"
                      rules={[{ required: true, message: 'اختر المريض' }]}
                      style={{ minWidth: 240, flex: 1 }}
                    >
                      <Select
                        showSearch
                        placeholder="ابحث واختر الاسم"
                        optionFilterProp="label"
                        options={patientOptions.map((p) => ({
                          value: p.id,
                          label: `${p.fullName} (${p.kind === 'EMERGENCY' ? 'طارئ' : 'دائم'})`,
                        }))}
                        onDropdownVisibleChange={(open) => open && loadPatientOptions()}
                      />
                    </Form.Item>
                    <Form.Item
                      name="session_date"
                      label="تاريخ الغسل (في السجل الإحصائي)"
                      rules={[{ required: true }]}
                    >
                      <DatePicker format="YYYY-MM-DD" />
                    </Form.Item>
                    <Form.Item name="shift" label="الوردية" rules={[{ required: true }]}>
                      <Select options={SHIFT_OPTIONS} style={{ minWidth: 120 }} />
                    </Form.Item>
                    <Form.Item label=" ">
                      <Button type="primary" htmlType="submit" icon={<PlusOutlined />}>
                        إضافة للسجل
                      </Button>
                    </Form.Item>
                  </Space>
                </Form>

                <div className="d-toolbar">
                  <Text strong>عرض السجل لتاريخ:</Text>
                  <DatePicker
                    value={listDate}
                    onChange={(d) => d && setListDate(d.startOf('day'))}
                    format="YYYY-MM-DD"
                  />
                  <span className="grow" />
                  <Button icon={<ReloadOutlined />} onClick={loadStatEntries} loading={statLoading}>
                    تحديث القائمة
                  </Button>
                </div>

                <div className="d-table-scroll">
                  <Table<StatEntryRow>
                    rowKey="id"
                    loading={statLoading}
                    dataSource={statRows}
                    locale={{
                      emptyText: (
                        <Empty description="لا توجد إدخالات إحصائية لهذا التاريخ — أضف اسمًا من النموذج أعلاه" />
                      ),
                    }}
                    pagination={{ pageSize: 20, showTotal: (t) => `${t} سطرًا` }}
                    columns={[
                      {
                        title: 'اسم المريض',
                        key: 'name',
                        ellipsis: true,
                        render: (_, r) => r.dialysisPatient?.fullName ?? '—',
                      },
                      {
                        title: 'التاريخ',
                        dataIndex: 'sessionDate',
                        width: 130,
                        render: (d: string) => formatDialysisCalendarDate(d),
                      },
                      {
                        title: 'الوردية',
                        dataIndex: 'shift',
                        width: 100,
                        render: (s: string) => SHIFT_LABEL_AR[s] ?? s,
                      },
                      {
                        title: '',
                        key: 'del',
                        width: 90,
                        render: (_, r) => (
                          <Button
                            type="text"
                            danger
                            size="small"
                            icon={<DeleteOutlined />}
                            onClick={() => deleteStatEntry(r)}
                          >
                            حذف
                          </Button>
                        ),
                      },
                    ]}
                  />
                </div>
              </div>
            ),
          },
          {
            key: 'recon',
            label: 'المطابقة (نهاية اليوم)',
            disabled: !canRecon,
            children: (
              <div className="d-card">
                <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
                  مقارنة جلسات الميدان (الحوكمة) مع السجل الإحصائي الذي أُدخل يدويًا — لتفسير الفروقات بعد انتهاء
                  الدوام.
                </Text>
                <div className="d-toolbar">
                  <Text>الفترة:</Text>
                  <DatePicker.RangePicker
                    value={range}
                    onChange={(v) => v && setRange(v as [Dayjs, Dayjs])}
                    style={{ width: '100%', maxWidth: 360 }}
                  />
                  <Button type="primary" icon={<ReloadOutlined />} onClick={run} loading={loading}>
                    تشغيل المقارنة
                  </Button>
                </div>

                {result && (
                  <Space direction="vertical" size="large" style={{ width: '100%' }}>
                    <div>
                      <Title level={5}>مجلدات ناقصة في الإحصاء</Title>
                      <div className="d-table-scroll d-table-scroll--compact">
                        <Table
                          size="small"
                          rowKey={(r: Record<string, unknown>) =>
                            `${r.dialysisPatientId}-${String(r.sessionDate)}-${r.shift}`
                          }
                          dataSource={result.missed_folders || []}
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
                          scroll={{ x: 'max-content' }}
                        />
                      </div>
                    </div>

                    <div>
                      <Title level={5}>جلسات شبح (في الإحصاء فقط)</Title>
                      <div className="d-table-scroll d-table-scroll--compact">
                        <Table
                          size="small"
                          rowKey={(r: Record<string, unknown>) =>
                            `${r.dialysisPatientId}-${String(r.sessionDate)}-${r.shift}`
                          }
                          dataSource={result.ghost_sessions || []}
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
                          scroll={{ x: 'max-content' }}
                        />
                      </div>
                    </div>

                    <div>
                      <Title level={5}>فروق المواد</Title>
                      <div className="d-table-scroll">
                        <Table
                          size="small"
                          rowKey={(r: Record<string, unknown>) =>
                            `${r.dialysisPatientId}-${r.item_id}`
                          }
                          dataSource={result.supply_discrepancies || []}
                          columns={[
                            { title: 'المريض', dataIndex: 'patient_name', key: 'pn' },
                            { title: 'المادة', dataIndex: 'item_id', key: 'i' },
                            { title: 'حقل', dataIndex: 'quantity_field', key: 'qf' },
                            { title: 'إحصاء', dataIndex: 'quantity_stats', key: 'qs' },
                            { title: 'فرق', dataIndex: 'delta', key: 'd' },
                          ]}
                          pagination={false}
                          scroll={{ x: 'max-content' }}
                        />
                      </div>
                    </div>
                  </Space>
                )}
              </div>
            ),
          },
          {
            key: 'bulk',
            label: 'إدخال جماعي',
            disabled: !canBulk,
            children: (
              <div className="d-card">
                <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
                  ألصق إدخال JSON يحتوي مفتاح <code>entries</code>. سيتم upsert لكل دخول حسب
                  (مريض، تاريخ، وردية).
                </Text>
                <BulkForm placeholder={PLACEHOLDER} onSubmit={submitBulk} />
              </div>
            ),
          },
        ]}
            />
          )}
        </>
      )}
    </>
  );
};

const BulkForm: React.FC<{ placeholder: string; onSubmit: (raw: string) => void }> = ({
  placeholder,
  onSubmit,
}) => {
  const [text, setText] = useState(placeholder);
  return (
    <Space direction="vertical" style={{ width: '100%' }}>
      <TextArea rows={14} value={text} onChange={(e) => setText(e.target.value)} />
      <Button type="primary" onClick={() => onSubmit(text)}>
        إرسال
      </Button>
    </Space>
  );
};

export default ReportsPage;
