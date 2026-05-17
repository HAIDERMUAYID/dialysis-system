import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Table,
  Button,
  Space,
  DatePicker,
  Select,
  InputNumber,
  Input,
  Modal,
  Drawer,
  Pagination,
  message,
  Typography,
  Spin,
  Collapse,
  Alert,
  Segmented,
  Tag,
  Tooltip,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  ReloadOutlined,
  MedicineBoxOutlined,
  DatabaseOutlined,
  CalendarOutlined,
  ThunderboltOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  TeamOutlined,
  ClearOutlined,
  FilterOutlined,
  UserOutlined,
  FormOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { Link } from 'react-router-dom';
import axios from 'axios';
import dayjs, { Dayjs } from 'dayjs';
import {
  ALL_MY_HOSPITALS,
  useDialysisContext,
} from '../dialysisContext';
import { DialysisPickHospitalScope } from '../DialysisPickHospitalScope';
import { useDialysisMobile } from '../useDialysisMobile';
import { usePermission } from '../../../../hooks/usePermission';
import { formatDialysisCalendarDate } from '../../dialysisConstants';
import DialysisUnitQuantityInput from '../../DialysisUnitQuantityInput';
import {
  estimateBaseQty,
  unitsFromApi,
  type ItemUnitApi,
  type PackagingUnitRow,
} from '../../dialysisUnitUtils';
import './pharmacy-dialysis.css';

const { Text } = Typography;
const { TextArea } = Input;
const { RangePicker } = DatePicker;

type PeriodPreset = 'today' | 'week' | 'month' | 'all' | 'custom';

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

const KPI_ICON_BG: Record<string, string> = {
  total: 'linear-gradient(135deg,#6366f1,#4f46e5)',
  active: 'linear-gradient(135deg,#ef4444,#b91c1c)',
  completed: 'linear-gradient(135deg,#22c55e,#15803d)',
  scheduled: 'linear-gradient(135deg,#3b82f6,#1d4ed8)',
  cancelled: 'linear-gradient(135deg,#94a3b8,#64748b)',
  patients: 'linear-gradient(135deg,#a855f7,#7e22ce)',
  pharmacyDispensed: 'linear-gradient(135deg,#059669,#047857)',
  pharmacyDraft: 'linear-gradient(135deg,#d97706,#b45309)',
  pharmacyPending: 'linear-gradient(135deg,#7c3aed,#5b21b6)',
};

interface PharmSessionRow {
  id: number;
  sessionDate: string;
  status: string;
  shift: string;
  intakeKind?: string | null;
  startedAt?: string | null;
  dialysisPatient?: { fullName: string; id: number; kind?: string };
  location?: { hallName: string; bedCode: string } | null;
  shiftSlot?: { name: string } | null;
  machine?: { id: number; assetTag?: string | null } | null;
  pharmacyDispense?: {
    id: number;
    status: string;
    completed_by_display?: string | null;
    completedAt?: string | null;
    lines?: Array<{
      quantity: number;
      drugCatalogId?: number | null;
      dialysisItemId?: number | null;
      drugCatalog?: { drugNameAr?: string | null; drugName?: string | null };
      dialysisItem?: { id: number; name: string; sku?: string | null; baseUnitLabel?: string };
    }>;
  } | null;
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
}

interface PharmacySessionKpis {
  total: number;
  active: number;
  scheduled: number;
  completed: number;
  cancelled: number;
  uniquePatients: number;
  byIntakeKind: Record<string, number>;
  pharmacyDispensed: number;
  pharmacyDraft: number;
  pharmacyPending: number;
}

type DispenseFrequencyKind = 'PER_SESSION' | 'DAILY_TO_NEXT_DIALYSIS';

interface DispenseLineDraft {
  dialysis_item_id: number;
  dosage?: string;
  quantity: number;
  unit_code: string;
  instructions?: string;
  frequency_kind: DispenseFrequencyKind;
  /** جرعة اليوم — تُستخدم عند DAILY_TO_NEXT_DIALYSIS */
  daily_unit_qty: number;
  daily_unit_code: string;
}

interface PharmacyBridgeInfo {
  bridge_days: number;
  next_dialysis_date: string | null;
  scheduled_weekdays: number[];
  weekday_labels: string[];
  source: 'SCHEDULE' | 'NO_SCHEDULE' | 'NO_NEXT_FOUND';
  hint: string | null;
}

interface PharmacyBridgeApiResponse extends PharmacyBridgeInfo {
  session_id: number;
  session_date: string;
  dialysis_patient_id: number;
}

function suggestedBridgeQuantity(
  line: DispenseLineDraft,
  bridge: PharmacyBridgeInfo | null,
  packagingUnits: PackagingUnitRow[]
): number | null {
  if (line.frequency_kind !== 'DAILY_TO_NEXT_DIALYSIS' || !bridge) return null;
  const dailyBase = estimateBaseQty(
    packagingUnits,
    Math.max(1, line.daily_unit_qty || 1),
    line.daily_unit_code || packagingUnits[0]?.unit_code || 'base'
  );
  const days = Math.max(1, bridge.bridge_days);
  return dailyBase * days;
}

function defaultUnitForItem(packagingUnits: PackagingUnitRow[]): string {
  return packagingUnits.find((u) => u.is_base)?.unit_code ?? packagingUnits[0]?.unit_code ?? 'base';
}

interface DialysisSessionDetail {
  id: number;
  dialysisPatient?: { fullName: string; id: number };
  pharmacyDispense?: {
    id: number;
    status: string;
    notes?: string | null;
    completedAt?: string | null;
    completedBy?: { name?: string | null; username?: string | null } | null;
    lines?: Array<{
      frequencyKind?: DispenseFrequencyKind;
      dailyUnitQty?: number | null;
      bridgeDaysSnapshot?: number | null;
      drugCatalogId?: number | null;
      dialysisItemId?: number | null;
      dosage?: string | null;
      quantity: number;
      instructions?: string | null;
      drugCatalog?: { drugNameAr?: string | null; drugName?: string | null };
      dialysisItem?: {
        id: number;
        name: string;
        sku?: string | null;
        baseUnitLabel?: string;
        inventoryBaseUnitCode?: string | null;
        units?: ItemUnitApi[];
      };
    }>;
  } | null;
}

interface DrugOpt {
  id: number;
  drug_name?: string;
  drug_name_ar?: string;
  base_unit_label?: string;
  packaging_units?: PackagingUnitRow[];
}

interface SetOpt {
  id: number;
  set_name_ar?: string;
  set_name?: string;
}

function mergeDrugOptions(
  prev: DrugOpt[],
  catalogs: Array<{ id?: number; drugName?: string; drugNameAr?: string } | undefined | null>
): DrugOpt[] {
  const map = new Map(prev.map((d) => [d.id, d]));
  for (const c of catalogs) {
    if (!c?.id) continue;
    if (!map.has(c.id)) {
      map.set(c.id, {
        id: c.id,
        drug_name: c.drugName,
        drug_name_ar: c.drugNameAr,
      });
    }
  }
  return Array.from(map.values()).sort((a, b) =>
    String(a.drug_name_ar || a.drug_name).localeCompare(String(b.drug_name_ar || b.drug_name), 'ar')
  );
}

function formatDispensedDrugsSummary(
  lines:
    | Array<{
        quantity: number;
        drugCatalogId?: number | null;
        dialysisItemId?: number | null;
        drugCatalog?: { drugNameAr?: string | null; drugName?: string | null };
        dialysisItem?: { name?: string };
      }>
    | undefined
): string {
  if (!lines?.length) return '';
  return lines
    .map((l) => {
      const fromItem = l.dialysisItem?.name?.trim();
      if (fromItem) return fromItem;
      return (
        l.drugCatalog?.drugNameAr ||
        l.drugCatalog?.drugName ||
        (l.drugCatalogId != null ? `#cat-${l.drugCatalogId}` : '') ||
        (l.dialysisItemId != null ? `#صنف-${l.dialysisItemId}` : '')
      );
    })
    .filter(Boolean)
    .join('، ');
}

const PharmacyDialysisPage: React.FC = () => {
  const { hospitalId } = useDialysisContext();
  const canDispense = usePermission('dialysis:pharmacy:dispense');
  const canInventory = usePermission('dialysis:pharmacy:inventory');
  const canViewPharm = usePermission('dialysis:pharmacy:view');

  const [period, setPeriod] = useState<PeriodPreset>('today');
  const [customRange, setCustomRange] = useState<[Dayjs, Dayjs]>(() => [
    dayjs().subtract(7, 'day').startOf('day'),
    dayjs().endOf('day'),
  ]);
  const [filterStatus, setFilterStatus] = useState<string | undefined>();
  const [filterIntakeKind, setFilterIntakeKind] = useState<string | undefined>();
  const [filterPatientId, setFilterPatientId] = useState<number | undefined>();
  const [filterLocationId, setFilterLocationId] = useState<number | undefined>();
  const [filterShiftSlotId, setFilterShiftSlotId] = useState<number | undefined>();
  const [searchName, setSearchName] = useState('');

  const [loading, setLoading] = useState(false);
  const [sessions, setSessions] = useState<PharmSessionRow[]>([]);
  const [kpis, setKpis] = useState<PharmacySessionKpis | null>(null);

  const [patients, setPatients] = useState<PatientLite[]>([]);
  const [locations, setLocations] = useState<LocLite[]>([]);
  const [slots, setSlots] = useState<SlotLite[]>([]);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeSession, setActiveSession] = useState<PharmSessionRow | null>(null);
  const [sessionDetail, setSessionDetail] = useState<DialysisSessionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [lines, setLines] = useState<DispenseLineDraft[]>([]);
  const [notes, setNotes] = useState('');
  const [pharmacyBridge, setPharmacyBridge] = useState<PharmacyBridgeInfo | null>(null);

  const [drugs, setDrugs] = useState<DrugOpt[]>([]);
  const [sets, setSets] = useState<SetOpt[]>([]);

  const [dialysisPharmacyWarehouse, setDialysisPharmacyWarehouse] = useState<{
    id: number;
    name: string;
  } | null>(null);

  const isNarrow = useDialysisMobile();
  const [cardPage, setCardPage] = useState(1);
  const cardPageSize = 12;

  const dispenseStatus =
    sessionDetail?.pharmacyDispense?.status ?? activeSession?.pharmacyDispense?.status ?? undefined;
  const isCompleted = dispenseStatus === 'COMPLETED';

  const mobileSessionSlice = useMemo(() => {
    const start = (cardPage - 1) * cardPageSize;
    return sessions.slice(start, start + cardPageSize);
  }, [sessions, cardPage, cardPageSize]);

  const filterParams = useMemo(() => {
    const dr = dateRangeForPeriod(period, customRange);
    const params: Record<string, string | number> = {};
    if (dr.date_from) params.date_from = dr.date_from;
    if (dr.date_to) params.date_to = dr.date_to;
    if (filterStatus) params.status = filterStatus;
    if (filterIntakeKind) params.intake_kind = filterIntakeKind;
    if (filterPatientId) params.dialysis_patient_id = filterPatientId;
    if (filterLocationId) params.location_id = filterLocationId;
    if (filterShiftSlotId) params.shift_slot_id = filterShiftSlotId;
    const q = searchName.trim();
    if (q) params.search = q;
    return params;
  }, [
    period,
    customRange,
    filterStatus,
    filterIntakeKind,
    filterPatientId,
    filterLocationId,
    filterShiftSlotId,
    searchName,
  ]);

  const loadSessions = useCallback(async () => {
    if (hospitalId === null || hospitalId === ALL_MY_HOSPITALS) return;
    setLoading(true);
    try {
      const base = { hospital_id: hospitalId, ...filterParams, limit: 500 };
      const [listRes, kpiRes] = await Promise.all([
        axios.get<PharmSessionRow[]>('/api/dialysis/pharmacy/sessions', { params: base }),
        axios.get<PharmacySessionKpis>('/api/dialysis/pharmacy/sessions/kpis', { params: base }),
      ]);
      setSessions(listRes.data);
      setKpis(kpiRes.data);
    } catch {
      message.error('تعذر تحميل جلسات الغسل');
      setKpis(null);
    } finally {
      setLoading(false);
    }
  }, [hospitalId, filterParams]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    setCardPage(1);
  }, [sessions]);

  useEffect(() => {
    if (hospitalId === null || hospitalId === ALL_MY_HOSPITALS) {
      setPatients([]);
      setLocations([]);
      setSlots([]);
      return;
    }
    const params = { hospital_id: hospitalId };
    Promise.all([
      axios.get<PatientLite[]>('/api/dialysis/patients', { params }),
      axios.get<LocLite[]>('/api/dialysis/locations', { params }),
      axios.get<SlotLite[]>('/api/dialysis/shift-slots', { params }),
    ])
      .then(([p, l, s]) => {
        setPatients(p.data);
        setLocations(l.data);
        setSlots(s.data);
      })
      .catch(() => {
        setPatients([]);
        setLocations([]);
        setSlots([]);
      });
  }, [hospitalId]);

  const resetFilters = () => {
    setPeriod('today');
    setCustomRange([dayjs().subtract(7, 'day').startOf('day'), dayjs().endOf('day')]);
    setFilterStatus(undefined);
    setFilterIntakeKind(undefined);
    setFilterPatientId(undefined);
    setFilterLocationId(undefined);
    setFilterShiftSlotId(undefined);
    setSearchName('');
  };

  const kpiCards = useMemo(() => {
    if (!kpis) return [];
    return [
      { key: 'total', label: 'إجمالي الجلسات', value: kpis.total, icon: <CalendarOutlined /> },
      { key: 'active', label: 'نشطة الآن', value: kpis.active, icon: <ThunderboltOutlined /> },
      { key: 'scheduled', label: 'مجدولة', value: kpis.scheduled, icon: <ClockCircleOutlined /> },
      { key: 'completed', label: 'منتهية', value: kpis.completed, icon: <CheckCircleOutlined /> },
      { key: 'cancelled', label: 'ملغاة', value: kpis.cancelled, icon: <CloseCircleOutlined /> },
      { key: 'patients', label: 'مرضى مختلفون', value: kpis.uniquePatients, icon: <TeamOutlined /> },
      {
        key: 'pharmacyDispensed',
        label: 'تم الصرف صيدلياً',
        value: kpis.pharmacyDispensed,
        icon: <MedicineBoxOutlined />,
      },
      {
        key: 'pharmacyDraft',
        label: 'مسودة صرف',
        value: kpis.pharmacyDraft,
        icon: <FormOutlined />,
      },
      {
        key: 'pharmacyPending',
        label: 'لم يُكتمل الصرف',
        value: kpis.pharmacyPending,
        icon: <WarningOutlined />,
      },
    ];
  }, [kpis]);

  const loadMeta = useCallback(async () => {
    if (hospitalId === null || hospitalId === ALL_MY_HOSPITALS) {
      setDrugs([]);
      setSets([]);
      setDialysisPharmacyWarehouse(null);
      return;
    }
    try {
      const [ed, st] = await Promise.all([
        axios.get<{ pharmacy_warehouse?: { id: number; name: string } | null; drugs: DrugOpt[] }>(
          '/api/dialysis/pharmacy/eligible-drugs',
          { params: { hospital_id: hospitalId } }
        ),
        axios.get<SetOpt[]>('/api/dialysis/pharmacy/prescription-sets', {
          params: { hospital_id: hospitalId },
        }),
      ]);
      setDialysisPharmacyWarehouse(ed.data.pharmacy_warehouse ?? null);
      setDrugs(ed.data.drugs || []);
      setSets(Array.isArray(st.data) ? st.data : []);
    } catch {
      setDrugs([]);
      setSets([]);
    }
  }, [hospitalId]);

  useEffect(() => {
    loadMeta();
  }, [loadMeta]);

  const closeModal = () => {
    setDrawerOpen(false);
    setSessionDetail(null);
    setActiveSession(null);
    setPharmacyBridge(null);
  };

  const openDispense = async (row: PharmSessionRow) => {
    setActiveSession(row);
    setSessionDetail(null);
    setPharmacyBridge(null);
    setDrawerOpen(true);
    setDetailLoading(true);
    try {
      const [detailRes, bridgeRes] = await Promise.all([
        axios.get<DialysisSessionDetail>(`/api/dialysis/pharmacy/sessions/${row.id}`),
        axios
          .get<PharmacyBridgeApiResponse>(
            `/api/dialysis/pharmacy/sessions/${row.id}/pharmacy-bridge`
          )
          .catch(() => null),
      ]);
      const data = detailRes.data;
      setSessionDetail(data);
      if (bridgeRes?.data) {
        const { session_id: _sid, session_date: _sd, dialysis_patient_id: _pid, ...bridge } = bridgeRes.data;
        setPharmacyBridge(bridge as PharmacyBridgeInfo);
      } else {
        setPharmacyBridge(null);
      }
      const disp = data.pharmacyDispense;
      if (disp?.lines?.length) {
        const mapped: DispenseLineDraft[] = disp.lines.map((L) => {
          const itemId = L.dialysisItemId ?? L.dialysisItem?.id;
          const fk: DispenseFrequencyKind =
            L.frequencyKind === 'DAILY_TO_NEXT_DIALYSIS' ? 'DAILY_TO_NEXT_DIALYSIS' : 'PER_SESSION';
          const pack = unitsFromApi(
            L.dialysisItem?.units,
            L.dialysisItem?.inventoryBaseUnitCode
          );
          const defaultUnit = defaultUnitForItem(pack);
          return {
            dialysis_item_id: typeof itemId === 'number' && itemId > 0 ? itemId : 0,
            dosage: L.dosage ?? '',
            quantity: L.quantity,
            unit_code: defaultUnit,
            instructions: L.instructions ?? '',
            frequency_kind: fk,
            daily_unit_qty:
              fk === 'DAILY_TO_NEXT_DIALYSIS' && L.dailyUnitQty != null && L.dailyUnitQty >= 1
                ? L.dailyUnitQty
                : 1,
            daily_unit_code: defaultUnit,
          };
        });
        setLines(mapped);
        setNotes(disp.notes ?? '');
        setDrugs((prev) =>
          mergeDrugOptions(
            prev,
            disp.lines!.map((L) =>
              L.dialysisItem
                ? {
                    id: L.dialysisItem.id,
                    drugName: L.dialysisItem.name,
                    drugNameAr: L.dialysisItem.name,
                  }
                : null
            )
          )
        );
      } else {
        setLines([]);
        setNotes('');
      }
    } catch {
      message.error('تعذر تحميل تفاصيل الصرف');
    } finally {
      setDetailLoading(false);
    }
  };

  const saveDraft = async () => {
    if (!activeSession || isCompleted) return;
    try {
      await axios.put(`/api/dialysis/pharmacy/sessions/${activeSession.id}/dispense`, {
        notes,
        lines: lines.map((l, i) => ({
          dialysis_item_id: l.dialysis_item_id,
          dosage: l.dosage || null,
          quantity: l.quantity,
          dispense_unit_code: l.unit_code,
          instructions: l.instructions || null,
          display_order: i,
          frequency_kind: l.frequency_kind,
          daily_unit_qty:
            l.frequency_kind === 'DAILY_TO_NEXT_DIALYSIS' ? l.daily_unit_qty : null,
          daily_unit_code:
            l.frequency_kind === 'DAILY_TO_NEXT_DIALYSIS' ? l.daily_unit_code : null,
        })),
      });
      message.success('تم حفظ المسودة');
      loadSessions();
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'فشل الحفظ';
      message.error(msg);
    }
  };

  const applySet = async (setId: number) => {
    if (!activeSession || isCompleted) return;
    try {
      const { data } = await axios.post(
        `/api/dialysis/pharmacy/sessions/${activeSession.id}/dispense/from-set`,
        { set_id: setId }
      );
      if (data?.lines?.length) {
        setLines(
          data.lines.map(
            (L: {
              dialysisItemId?: number | null;
              dialysisItem?: { id: number; name: string };
              dosage?: string;
              quantity: number;
              instructions?: string;
            }) => {
              const drug = drugs.find((d) => d.id === (L.dialysisItemId ?? L.dialysisItem?.id));
              const def = defaultUnitForItem(drug?.packaging_units ?? []);
              return {
                dialysis_item_id: L.dialysisItemId ?? L.dialysisItem?.id ?? 0,
                dosage: L.dosage ?? '',
                quantity: L.quantity,
                unit_code: def,
                instructions: L.instructions ?? '',
                frequency_kind: 'PER_SESSION' as const,
                daily_unit_qty: 1,
                daily_unit_code: def,
              };
            }
          )
        );
        setDrugs((prev) =>
          mergeDrugOptions(
            prev,
            data.lines.map((L: { dialysisItem?: { id: number; name: string }; drugCatalog?: { id: number; drugName?: string; drugNameAr?: string } }) =>
              L.dialysisItem
                ? {
                    id: L.dialysisItem.id,
                    drugName: L.dialysisItem.name,
                    drugNameAr: L.dialysisItem.name,
                  }
                : L.drugCatalog
                  ? {
                      id: L.drugCatalog.id,
                      drugName: L.drugCatalog.drugName,
                      drugNameAr: L.drugCatalog.drugNameAr,
                    }
                  : null
            )
          )
        );
      }
      setNotes(data?.notes ?? '');
      message.success('تم تحميل المجموعة');
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'فشل التحميل';
      message.error(msg);
    }
  };

  const completeDispense = async () => {
    if (!activeSession || isCompleted) return;
    Modal.confirm({
      title: 'تأكيد صرف العلاج',
      content:
        dialysisPharmacyWarehouse != null
          ? `سيتم خصم الكميات من مستودع «${dialysisPharmacyWarehouse.name}» وفق ترتيب الدفعات (الأقرب انتهاءً أولاً). هل تؤكد؟`
          : 'سيتم خصم الكميات من مستودع صيدلية وحدة الغسل وفق ترتيب الدفعات (الأقرب انتهاءً أولاً). هل تؤكد؟',
      okText: 'تأكيد',
      cancelText: 'إلغاء',
      onOk: async () => {
        try {
          await axios.put(`/api/dialysis/pharmacy/sessions/${activeSession.id}/dispense`, {
            notes,
            lines: lines.map((l, i) => ({
              dialysis_item_id: l.dialysis_item_id,
              dosage: l.dosage || null,
              quantity: l.quantity,
              dispense_unit_code: l.unit_code,
              instructions: l.instructions || null,
              display_order: i,
              frequency_kind: l.frequency_kind,
              daily_unit_qty:
                l.frequency_kind === 'DAILY_TO_NEXT_DIALYSIS' ? l.daily_unit_qty : null,
              daily_unit_code:
                l.frequency_kind === 'DAILY_TO_NEXT_DIALYSIS' ? l.daily_unit_code : null,
            })),
          });
          await axios.post(`/api/dialysis/pharmacy/sessions/${activeSession.id}/dispense/complete`);
          message.success('تم تأكيد الصرف وتحديث مخزن صيدلية الغسل');
          closeModal();
          loadSessions();
        } catch (e: unknown) {
          const msg =
            (e as { response?: { data?: { error?: string } } })?.response?.data?.error ||
            'فشل التأكيد — تأكد من ربط الصنف بالدواء والمخزون';
          message.error(msg);
        }
      },
    });
  };

  const dispenseTag = (row: PharmSessionRow) => {
    const st = row.pharmacyDispense?.status;
    if (!row.pharmacyDispense || !st) {
      return <span className="d-pharmacy-dispense-pill d-pharmacy-dispense-pill--none">بدون صرف</span>;
    }
    if (st === 'COMPLETED') {
      return (
        <span className="d-pharmacy-dispense-pill d-pharmacy-dispense-pill--done">
          تم الصرف
          {row.pharmacyDispense.completed_by_display
            ? ` — ${row.pharmacyDispense.completed_by_display}`
            : ''}
        </span>
      );
    }
    if (st === 'DRAFT') {
      return <span className="d-pharmacy-dispense-pill d-pharmacy-dispense-pill--draft">مسودة</span>;
    }
    return <span className="d-pharmacy-dispense-pill d-pharmacy-dispense-pill--raw">{st}</span>;
  };

  const columns: ColumnsType<PharmSessionRow> = useMemo(
    () => [
      {
        title: 'المريض',
        width: 160,
        render: (_, r) => (
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
        title: 'التاريخ',
        render: (_, r) => formatDialysisCalendarDate(r.sessionDate),
        width: 108,
      },
      {
        title: 'الصالة',
        width: 120,
        ellipsis: true,
        render: (_, r) => r.location?.hallName ?? '—',
      },
      {
        title: 'السرير',
        width: 88,
        render: (_, r) => r.location?.bedCode ?? '—',
      },
      {
        title: 'نوع الغسلة',
        width: 120,
        render: (_, r) =>
          r.intakeKind ? (
            <Tag color={INTAKE_KIND_LABEL[r.intakeKind]?.color || 'default'}>
              {INTAKE_KIND_LABEL[r.intakeKind]?.label ?? r.intakeKind}
            </Tag>
          ) : (
            <Text type="secondary">—</Text>
          ),
      },
      {
        title: 'الشفت',
        width: 100,
        ellipsis: true,
        render: (_, r) => r.shiftSlot?.name ?? '—',
      },
      {
        title: 'الجهاز',
        width: 96,
        ellipsis: true,
        render: (_, r) => r.machine?.assetTag ?? '—',
      },
      {
        title: 'بدء الغسلة',
        width: 88,
        render: (_, r) => (r.startedAt ? dayjs(r.startedAt).format('HH:mm') : '—'),
      },
      {
        title: 'حالة الجلسة',
        width: 100,
        render: (_, r) => (
          <Tag color={STATUS_LABEL[r.status]?.color || 'default'}>
            {STATUS_LABEL[r.status]?.label ?? r.status}
          </Tag>
        ),
      },
      {
        title: 'الصرف',
        render: (_, r) => dispenseTag(r),
        width: 168,
      },
      {
        title: 'الأدوية',
        key: 'drugs_preview',
        ellipsis: true,
        width: 200,
        render: (_, r) => {
          const summary = formatDispensedDrugsSummary(r.pharmacyDispense?.lines);
          if (!summary) {
            return <Text type="secondary">—</Text>;
          }
          return (
            <span className="d-pharmacy-drugs-preview" title={summary}>
              {summary}
            </span>
          );
        },
      },
      {
        title: '',
        width: 112,
        render: (_, r) => (
          <Button
            type="link"
            size="small"
            onClick={() => openDispense(r)}
            disabled={!canViewPharm && !canDispense}
          >
            {r.pharmacyDispense?.status === 'COMPLETED'
              ? 'عرض التفاصيل'
              : canDispense
                ? 'صرف العلاج'
                : 'عرض الصرف'}
          </Button>
        ),
      },
    ],
    [canDispense, canViewPharm]
  );

  const pd = sessionDetail?.pharmacyDispense;
  const completedLines = pd?.lines;

  const modalTitle = useMemo(() => {
    const name = activeSession?.dialysisPatient?.fullName ?? '';
    if (!activeSession) return 'صرف';
    return (
      <span>
        صرف علاج — {name}
        {isCompleted ? (
          <Text type="success" style={{ marginInlineStart: 10 }}>
            (تم الصرف)
          </Text>
        ) : null}
      </span>
    );
  }, [activeSession, isCompleted]);

  const renderDispensePanel = (): React.ReactNode => {
    return (
      <>
        {detailLoading ? (
          <Spin />
        ) : (
          <>
            {isCompleted && pd ? (
              <>
                <Alert
                  type="success"
                  showIcon
                  style={{ marginBottom: 16 }}
                  message="تم تأكيد الصرف"
                  description={
                    <Space direction="vertical" size={4}>
                      <span>
                        خُصم من مخزن صيدلية الغسل
                        {dialysisPharmacyWarehouse ? ` «${dialysisPharmacyWarehouse.name}»` : ''}.
                      </span>
                      {pd.completedAt ? (
                        <span>التاريخ والوقت: {dayjs(pd.completedAt).format('YYYY/MM/DD — HH:mm')}</span>
                      ) : null}
                      {(pd.completedBy?.name || pd.completedBy?.username) && (
                        <span>
                          بواسطة: {pd.completedBy?.name || pd.completedBy?.username}
                        </span>
                      )}
                    </Space>
                  }
                />
                {completedLines?.length ? (
                  <Table
                    className="d-pharmacy-modal-completed-table"
                    size="small"
                    pagination={false}
                    rowKey={(row, i) => `${row.dialysisItemId ?? row.drugCatalogId}-${i}`}
                    dataSource={completedLines}
                    columns={[
                      {
                        title: 'الصنف',
                        render: (_, line) =>
                          line.dialysisItem?.name ||
                          line.drugCatalog?.drugNameAr ||
                          line.drugCatalog?.drugName ||
                          `#${line.drugCatalogId ?? line.dialysisItemId}`,
                      },
                      {
                        title: 'نوع الصرف',
                        width: 130,
                        render: (_, line) =>
                          line.frequencyKind === 'DAILY_TO_NEXT_DIALYSIS' ? (
                            <Tag color="blue">يومي للغسلة القادمة</Tag>
                          ) : (
                            <Tag>عند الغسلة</Tag>
                          ),
                      },
                      {
                        title: 'احتساب يومي',
                        width: 128,
                        render: (_, line) =>
                          line.frequencyKind === 'DAILY_TO_NEXT_DIALYSIS' &&
                          line.dailyUnitQty != null &&
                          line.bridgeDaysSnapshot != null ? (
                            <span style={{ fontSize: 12 }}>
                              {line.dailyUnitQty} × {line.bridgeDaysSnapshot} يوم
                            </span>
                          ) : (
                            <Text type="secondary">—</Text>
                          ),
                      },
                      {
                        title: 'الجرعة',
                        dataIndex: 'dosage',
                        width: 120,
                        render: (v: string | null) => v || '—',
                      },
                      { title: 'الكمية المصروفة', dataIndex: 'quantity', width: 110 },
                    ]}
                  />
                ) : null}
                {pd.notes ? (
                  <div style={{ marginTop: 12 }}>
                    <Text strong>ملاحظات</Text>
                    <div style={{ marginTop: 6 }}>{pd.notes}</div>
                  </div>
                ) : null}
              </>
            ) : (
              <>
                <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
                  {dialysisPharmacyWarehouse
                    ? `اختر الأصناف المعرفة في «${dialysisPharmacyWarehouse.name}». عند التأكيد يُخصم من هذا المستودع وفق الدفعات المتاحة.`
                    : 'عند التأكيد يُخصم من مستودع صيدلية وحدة الغسل وفق الدفعات المتاحة.'}
                </Text>
                {pharmacyBridge ? (
                  <Alert
                    className="d-ph-bridge-alert"
                    type={pharmacyBridge.source === 'SCHEDULE' ? 'info' : 'warning'}
                    showIcon
                    style={{ marginBottom: 12 }}
                    message={
                      pharmacyBridge.source === 'SCHEDULE'
                        ? `التغطية اليومية المحسوبة: ${pharmacyBridge.bridge_days} يوماً (من تاريخ الجلسة حتى ما قبل موعد الغسلة القادمة في الجدول)`
                        : 'احتساب أيام التغطية — يتطلب مراجعة يدوية'
                    }
                    description={
                      <Space direction="vertical" size={4} style={{ width: '100%' }}>
                        {pharmacyBridge.source === 'SCHEDULE' && pharmacyBridge.next_dialysis_date ? (
                          <span>
                            أقرب موعد غسلة بعد هذه الجلسة:{' '}
                            <strong>{formatDialysisCalendarDate(pharmacyBridge.next_dialysis_date)}</strong>
                          </span>
                        ) : null}
                        {pharmacyBridge.weekday_labels?.length ? (
                          <span style={{ fontSize: 12 }}>
                            أيام الغسل في الجدول: {pharmacyBridge.weekday_labels.join('، ')}
                          </span>
                        ) : null}
                        {pharmacyBridge.hint ? (
                          <span style={{ fontSize: 12 }}>{pharmacyBridge.hint}</span>
                        ) : null}
                        {pharmacyBridge.source === 'SCHEDULE' ? (
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            للسطر «يومي حتى الغسلة القادمة»: الكمية المقترحة = جرعة اليوم ×{' '}
                            {pharmacyBridge.bridge_days} أيام — يمكنك تعديل الكمية النهائية قبل التأكيد.
                          </Text>
                        ) : null}
                      </Space>
                    }
                  />
                ) : null}
                <div className="d-pharmacy-set-row">
                  <Text strong>تحميل سريع من مجموعة وصفات:</Text>
                  <Select
                    style={{ minWidth: 220 }}
                    placeholder="اختر مجموعة"
                    allowClear
                    options={sets.map((s) => ({
                      value: s.id,
                      label: s.set_name_ar || s.set_name || `#${s.id}`,
                    }))}
                    onChange={(v) => v && applySet(v)}
                    disabled={!canDispense}
                  />
                </div>
                <Collapse
                  items={[
                    {
                      key: 'lines',
                      label: 'أسطر الوصفة',
                      children: (
                        <>
                          {lines.map((line, idx) => {
                            const packUnits =
                              drugs.find((d) => d.id === line.dialysis_item_id)?.packaging_units ??
                              [];
                            const baseLabel =
                              packUnits.find((u) => u.is_base)?.label ??
                              drugs.find((d) => d.id === line.dialysis_item_id)?.base_unit_label ??
                              'أساس';
                            const suggested = suggestedBridgeQuantity(
                              line,
                              pharmacyBridge,
                              packUnits
                            );
                            return (
                              <div key={idx} className="d-pharmacy-line d-ph-line-card">
                                <Space wrap align="start">
                                  <Select
                                    style={{ minWidth: 200 }}
                                    placeholder="صنف من مخزن الغسل"
                                    value={line.dialysis_item_id || undefined}
                                    options={drugs.map((d) => ({
                                      value: d.id,
                                      label: d.drug_name_ar || d.drug_name || `#${d.id}`,
                                    }))}
                                    onChange={(v) => {
                                      const drug = drugs.find((d) => d.id === v);
                                      const def = defaultUnitForItem(drug?.packaging_units ?? []);
                                      const next = [...lines];
                                      next[idx] = {
                                        ...next[idx],
                                        dialysis_item_id: v as number,
                                        unit_code: def,
                                        daily_unit_code: def,
                                      };
                                      setLines(next);
                                    }}
                                    disabled={!canDispense}
                                    showSearch
                                    optionFilterProp="label"
                                  />
                                  <Select
                                    style={{ minWidth: 200 }}
                                    value={line.frequency_kind}
                                    disabled={!canDispense}
                                    options={[
                                      { value: 'PER_SESSION', label: 'عند الغسلة فقط' },
                                      {
                                        value: 'DAILY_TO_NEXT_DIALYSIS',
                                        label: 'يومي حتى الغسلة القادمة',
                                      },
                                    ]}
                                    onChange={(v) => {
                                      const next = [...lines];
                                      const fk = v as DispenseFrequencyKind;
                                      next[idx] = {
                                        ...next[idx],
                                        frequency_kind: fk,
                                        daily_unit_qty:
                                          fk === 'DAILY_TO_NEXT_DIALYSIS'
                                            ? Math.max(1, next[idx].daily_unit_qty || 1)
                                            : next[idx].daily_unit_qty,
                                      };
                                      setLines(next);
                                    }}
                                  />
                                  {line.frequency_kind === 'DAILY_TO_NEXT_DIALYSIS' ? (
                                    <>
                                      <div className="d-ph-field-mini" style={{ minWidth: 200 }}>
                                        <Text type="secondary" className="d-ph-field-mini-label">
                                          جرعة/يوم
                                        </Text>
                                        <DialysisUnitQuantityInput
                                          units={packUnits}
                                          quantity={line.daily_unit_qty}
                                          unitCode={line.daily_unit_code}
                                          onQuantityChange={(q) => {
                                            const next = [...lines];
                                            next[idx] = {
                                              ...next[idx],
                                              daily_unit_qty: q || 1,
                                            };
                                            setLines(next);
                                          }}
                                          onUnitChange={(code) => {
                                            const next = [...lines];
                                            next[idx] = { ...next[idx], daily_unit_code: code };
                                            setLines(next);
                                          }}
                                          disabled={!canDispense}
                                        />
                                      </div>
                                      {suggested != null ? (
                                        <Text type="secondary" style={{ fontSize: 12, maxWidth: 220 }}>
                                          مقترح: {suggested} {baseLabel} (مجموع للأيام)
                                        </Text>
                                      ) : (
                                        <Text type="secondary" style={{ fontSize: 12 }}>
                                          حمّل احتساب الأيام أعلاه أو أدخل الكمية يدوياً
                                        </Text>
                                      )}
                                      <Button
                                        size="small"
                                        disabled={!canDispense || suggested == null}
                                        onClick={() => {
                                          if (suggested == null) return;
                                          const next = [...lines];
                                          next[idx] = {
                                            ...next[idx],
                                            quantity: suggested,
                                            unit_code: defaultUnitForItem(packUnits),
                                          };
                                          setLines(next);
                                        }}
                                      >
                                        تطبيق المقترح
                                      </Button>
                                    </>
                                  ) : null}
                                  <Input
                                    style={{ width: 120 }}
                                    placeholder="الجرعة"
                                    value={line.dosage}
                                    onChange={(e) => {
                                      const next = [...lines];
                                      next[idx] = { ...next[idx], dosage: e.target.value };
                                      setLines(next);
                                    }}
                                    disabled={!canDispense}
                                  />
                                  <div className="d-ph-field-mini" style={{ minWidth: 220 }}>
                                    <Text type="secondary" className="d-ph-field-mini-label">
                                      كمية الصرف
                                    </Text>
                                    <DialysisUnitQuantityInput
                                      units={packUnits}
                                      quantity={line.quantity}
                                      unitCode={line.unit_code}
                                      onQuantityChange={(q) => {
                                        const next = [...lines];
                                        next[idx] = { ...next[idx], quantity: q || 1 };
                                        setLines(next);
                                      }}
                                      onUnitChange={(code) => {
                                        const next = [...lines];
                                        next[idx] = { ...next[idx], unit_code: code };
                                        setLines(next);
                                      }}
                                      disabled={!canDispense}
                                    />
                                  </div>
                                  <Button
                                    danger
                                    type="link"
                                    size="small"
                                    disabled={!canDispense}
                                    onClick={() => setLines(lines.filter((_, i) => i !== idx))}
                                  >
                                    حذف
                                  </Button>
                                </Space>
                              </div>
                            );
                          })}
                          <Button
                            type="dashed"
                            block
                            disabled={!canDispense}
                            onClick={() => {
                              if (!drugs.length) {
                                message.warning('حمّل قائمة الأدوية المتاحة أولاً');
                                return;
                              }
                              const def = defaultUnitForItem(drugs[0].packaging_units ?? []);
                              setLines([
                                ...lines,
                                {
                                  dialysis_item_id: drugs[0].id,
                                  quantity: 1,
                                  unit_code: def,
                                  dosage: '',
                                  instructions: '',
                                  frequency_kind: 'PER_SESSION',
                                  daily_unit_qty: 1,
                                  daily_unit_code: def,
                                },
                              ]);
                            }}
                          >
                            + إضافة سطر
                          </Button>
                        </>
                      ),
                    },
                  ]}
                />
                <div style={{ marginTop: 12 }}>
                  <Text strong>ملاحظات</Text>
                  <TextArea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    disabled={!canDispense}
                  />
                </div>
              </>
            )}
          </>
        )}
      </>
    );
  };

  const renderDispenseFooter = (): React.ReactNode => {
    if (isCompleted) {
      return (
        <Button type="primary" size={isNarrow ? 'large' : 'middle'} block={isNarrow} onClick={closeModal}>
          إغلاق
        </Button>
      );
    }
    if (canDispense) {
      if (isNarrow) {
        return (
          <div className="d-ph-drawer-footer-inner">
            <Button onClick={closeModal}>إغلاق</Button>
            <Button onClick={saveDraft}>مسودة</Button>
            <Button type="primary" onClick={completeDispense}>
              تأكيد الصرف
            </Button>
          </div>
        );
      }
      return (
        <Space wrap>
          <Button onClick={closeModal}>إغلاق</Button>
          <Button onClick={saveDraft}>حفظ مسودة</Button>
          <Button type="primary" onClick={completeDispense}>
            تأكيد الصرف وخصم المخزون
          </Button>
        </Space>
      );
    }
    return (
      <Button type="primary" block={isNarrow} onClick={closeModal}>
        إغلاق
      </Button>
    );
  };

  if (hospitalId === null || hospitalId === ALL_MY_HOSPITALS) {
    return (
      <div className="d-pharmacy-page d-pharmacy-page--pick-hospital">
        <header className="d-ph-hero">
          <div className="d-ph-hero-inner">
            <h1 className="d-ph-hero-title">
              <MedicineBoxOutlined aria-hidden />
              صيدلية الغسل الكلوي
            </h1>
            <p className="d-ph-hero-sub">
              {isNarrow
                ? 'اختر مستشفى لعرض جلسات الصرف والمخزن المرتبط.'
                : 'صرف الأدوية من مخزن وحدة الغسل يتم لكل مستشفى على حدة. عند دمج كل المستشفيات في العرض، اختر أدناه المستشفى الذي تريد العمل عليه.'}
            </p>
          </div>
        </header>
        <DialysisPickHospitalScope
          title="اختر مستشفى الصيدلية"
          description="جلسات الصرف والكميات تُحمّل لمستشفى واحد فقط. بعد الاختيار تظهر الجداول والإحصائيات لهذا المستشفى."
        />
      </div>
    );
  }

  const filterControls = (
    <>
      <Select
        allowClear
        placeholder="حالة الجلسة"
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
      <Select
        allowClear
        showSearch
        placeholder="الصالة / السرير"
        style={{ minWidth: 200 }}
        value={filterLocationId}
        onChange={(v) => setFilterLocationId(v)}
        optionFilterProp="label"
        options={locations.map((loc) => ({
          value: loc.id,
          label: `${loc.hallName} — ${loc.bedCode}`,
        }))}
      />
      <Select
        allowClear
        showSearch
        placeholder="الشفت"
        style={{ minWidth: 160 }}
        value={filterShiftSlotId}
        onChange={(v) => setFilterShiftSlotId(v)}
        optionFilterProp="label"
        options={slots.map((s) => ({
          value: s.id,
          label: s.name,
        }))}
      />
      <Input.Search
        className="d-ph-toolbar-input-grow"
        placeholder="بحث سريع باسم المريض…"
        allowClear
        value={searchName}
        onChange={(e) => setSearchName(e.target.value)}
        onSearch={() => loadSessions()}
      />
      <Button icon={<ClearOutlined />} onClick={resetFilters}>
        مسح الفلاتر
      </Button>
    </>
  );

  const kpiStatNodes =
    loading && !kpis ? (
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
          <span className="d-stat-icon" style={{ background: KPI_ICON_BG[c.key] ?? KPI_ICON_BG.total }}>
            {c.icon}
          </span>
        </div>
      ))
    );

  return (
    <div className="d-pharmacy-page">
      <header className="d-ph-hero">
        <div className="d-ph-hero-inner">
          <h1 className="d-ph-hero-title">
            <MedicineBoxOutlined aria-hidden />
            صيدلية الغسل الكلوي
          </h1>
          <p className="d-ph-hero-sub">
            صرف الأدوية من مخزن وحدة الغسل فقط؛ الجلسات تُدار من الحوكمة والتمريض — ركّز على الدقة والسرعة مع تجربة
            مريحة على الهاتف.
          </p>
        </div>
      </header>

      <Alert
        className="d-ph-warehouse-banner"
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message={
          dialysisPharmacyWarehouse
            ? `المستودع المرتبط: «${dialysisPharmacyWarehouse.name}» — صرف الأصناف المعرفة في مخزن الغسل لهذا المستشفى.`
            : 'يُخصم الصرف من مستودع صيدلية وحدة الغسل. تأكد من ربط الأصناف في المخزن قبل الصرف.'
        }
      />

      <div className="d-ph-kpi-scroll-wrap">
        <div className="d-ph-kpi-scroll">{kpiStatNodes}</div>
        <div className="d-stat-grid" style={{ marginBottom: 16 }}>
          {kpiStatNodes}
        </div>
      </div>

      {kpis && Object.keys(kpis.byIntakeKind || {}).length > 0 && (
        <div className="d-ph-intake-card">
          <Text type="secondary" style={{ fontSize: 12, marginInlineEnd: 8 }}>
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

      <div className="d-ph-main-panel">
        <div className="d-ph-toolbar-row">
          <div className="d-ph-segmented-wrap">
            <Segmented
              block
              value={period}
              onChange={(v) => {
                setPeriod(v as PeriodPreset);
                if (v === 'custom') {
                  setCustomRange([dayjs().subtract(7, 'day').startOf('day'), dayjs().endOf('day')]);
                }
              }}
              options={[
                { label: 'اليوم', value: 'today' },
                { label: 'أسبوع', value: 'week' },
                { label: 'شهر', value: 'month' },
                { label: 'الكل', value: 'all' },
                { label: 'مخصص', value: 'custom' },
              ]}
            />
          </div>
          {period === 'custom' && (
            <RangePicker
              value={customRange}
              onChange={(r) => r?.[0] && r[1] && setCustomRange([r[0], r[1]])}
              format="YYYY-MM-DD"
              allowClear={false}
              style={{ minWidth: 260 }}
            />
          )}
          <span className="d-ph-grow" />
          <Tooltip title="تحديث القائمة والأرقام">
            <Button shape="round" icon={<ReloadOutlined />} onClick={() => loadSessions()}>
              تحديث
            </Button>
          </Tooltip>
          {(canInventory || canViewPharm) && (
            <Link to="/dialysis/pharmacy-stock">
              <Button className="d-ph-stock-link" shape="round" icon={<DatabaseOutlined />} type="default">
                {isNarrow ? 'المخزن' : 'مخزن صيدلية الغسل'}
              </Button>
            </Link>
          )}
        </div>

        {isNarrow ? (
          <Collapse
            className="d-ph-filters-collapse"
            items={[
              {
                key: 'filters',
                label: (
                  <Space>
                    <FilterOutlined />
                    <span>فلاتر البحث والمريض</span>
                  </Space>
                ),
                children: <div className="d-ph-filters-inner">{filterControls}</div>,
              },
            ]}
          />
        ) : (
          <div className="d-ph-toolbar-row d-ph-toolbar-row--filters" style={{ marginBottom: 12 }}>
            <FilterOutlined style={{ marginTop: 8, color: 'var(--ph-muted, #94a3b8)' }} />
            <div className="d-ph-filters-inner" style={{ flex: 1 }}>
              {filterControls}
            </div>
          </div>
        )}

        <Spin spinning={loading}>
          {isNarrow ? (
            <>
              <div className="d-ph-session-cards">
                {mobileSessionSlice.map((r) => {
                  const preview = formatDispensedDrugsSummary(r.pharmacyDispense?.lines);
                  return (
                    <button
                      key={r.id}
                      type="button"
                      className="d-ph-session-card"
                      onClick={() => openDispense(r)}
                    >
                      <div className="d-ph-session-card-top">
                        <div>
                          <div className="d-ph-session-name">{r.dialysisPatient?.fullName ?? '—'}</div>
                          {r.dialysisPatient?.kind ? (
                            <Tag
                              style={{ marginTop: 6 }}
                              color={r.dialysisPatient.kind === 'EMERGENCY' ? 'volcano' : 'blue'}
                            >
                              {r.dialysisPatient.kind === 'EMERGENCY' ? 'طارئ' : 'دائم'}
                            </Tag>
                          ) : null}
                        </div>
                        <Tag color={STATUS_LABEL[r.status]?.color || 'default'}>
                          {STATUS_LABEL[r.status]?.label ?? r.status}
                        </Tag>
                      </div>
                      <div className="d-ph-session-meta">
                        <span>
                          التاريخ: <strong>{formatDialysisCalendarDate(r.sessionDate)}</strong>
                        </span>
                        <span>
                          الشفت: <strong>{r.shiftSlot?.name ?? '—'}</strong>
                        </span>
                        <span>
                          الصالة: <strong>{r.location?.hallName ?? '—'}</strong>
                        </span>
                        <span>
                          السرير: <strong>{r.location?.bedCode ?? '—'}</strong>
                        </span>
                      </div>
                      <div className="d-ph-session-card-footer">
                        {dispenseTag(r)}
                        {preview ? (
                          <span className="d-ph-session-preview" title={preview}>
                            {preview}
                          </span>
                        ) : (
                          <span className="d-ph-session-preview">لا أدوية مسجّلة</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
              {sessions.length > cardPageSize ? (
                <div className="d-ph-pagination-mobile">
                  <Pagination
                    current={cardPage}
                    pageSize={cardPageSize}
                    total={sessions.length}
                    onChange={setCardPage}
                    showSizeChanger={false}
                    size="small"
                  />
                </div>
              ) : null}
            </>
          ) : (
            <div className="d-table-scroll">
              <Table
                rowKey="id"
                columns={columns}
                dataSource={sessions}
                loading={false}
                pagination={{
                  pageSize: 15,
                  showSizeChanger: true,
                  pageSizeOptions: ['10', '15', '25', '50'],
                  showTotal: (t) => `إجمالي ${t} صفاً`,
                }}
                locale={{ emptyText: 'لا توجد جلسات حسب الفلتر' }}
                scroll={{ x: 'max-content' }}
                size="middle"
              />
            </div>
          )}
        </Spin>
      </div>

      {isNarrow ? (
        <Drawer
          className="d-pharmacy-drawer"
          title={modalTitle}
          placement="bottom"
          height="92%"
          open={drawerOpen}
          onClose={closeModal}
          footer={renderDispenseFooter()}
          styles={{ body: { paddingBottom: 8 } }}
        >
          {renderDispensePanel()}
        </Drawer>
      ) : (
        <Modal
          className="d-pharmacy-modal"
          title={modalTitle}
          open={drawerOpen}
          onCancel={closeModal}
          width={840}
          footer={renderDispenseFooter()}
        >
          {renderDispensePanel()}
        </Modal>
      )}
    </div>
  );
};

export default PharmacyDialysisPage;
