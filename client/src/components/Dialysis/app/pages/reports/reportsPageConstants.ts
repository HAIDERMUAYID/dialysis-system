import type { ReconRowStatus } from '../reportSessionDisplay';
import type { ReportAggregatesResponse } from './reportsPageTypes';

export const SHIFT_OPTIONS = [
  { value: 'MORNING', label: 'صباحي' },
  { value: 'EVENING', label: 'مسائي' },
];

export const SHIFT_LABEL_AR: Record<string, string> = {
  MORNING: 'صباحي',
  EVENING: 'مسائي',
};

export const SHIFT_FILTER_OPTIONS = [
  { value: '', label: 'الكل' },
  { value: 'MORNING', label: 'صباحية' },
  { value: 'EVENING', label: 'مسائية' },
];

export const INTAKE_LABEL_AR: Record<string, string> = {
  SCHEDULED: 'مجدولة',
  OFF_SCHEDULE: 'غير مجدولة',
  EMERGENCY: 'طارئة',
};

export const STATUS_LABEL_AR: Record<string, string> = {
  ACTIVE: 'نشطة',
  COMPLETED: 'منتهية',
  CANCELLED: 'ملغاة',
  SCHEDULED: 'مجدولة',
};

export const INTAKE_KIND_TAG_COLOR: Record<string, string> = {
  SCHEDULED: 'blue',
  OFF_SCHEDULE: 'orange',
  EMERGENCY: 'volcano',
};

export const STATUS_TAG_COLOR: Record<string, string> = {
  ACTIVE: 'red',
  SCHEDULED: 'blue',
  COMPLETED: 'green',
  CANCELLED: 'default',
};

export const CHART_PALETTE = ['#6366f1', '#8b5cf6', '#ec4899', '#14b8a6', '#f59e0b', '#3b82f6'];

export const INTAKE_ACCENT_HEX: Record<string, string> = {
  SCHEDULED: '#3b82f6',
  OFF_SCHEDULE: '#f59e0b',
  EMERGENCY: '#ef4444',
};

export const RECON_STATUS_LABEL: Record<ReconRowStatus, string> = {
  matched: 'مسجّل في الإحصاء',
  missing: 'غير مسجّل في الإحصاء',
  supply: 'فرق في المواد',
  na: 'لا ينطبق',
};

export const REPORT_TABLE_PAGE_SIZE = 20;
export const REPORT_MOBILE_PAGE_SIZE = 12;

export const EMPTY_REPORT_KPIS: ReportAggregatesResponse['kpis'] = {
  total: 0,
  uniquePatients: 0,
  scheduled: 0,
  unscheduled: 0,
  emergency: 0,
  morning: 0,
  evening: 0,
  active: 0,
  completed: 0,
  cancelled: 0,
  reconMatched: 0,
  reconMissing: 0,
  reconSupply: 0,
  reconNa: 0,
  statCoveragePct: 0,
};

export const BULK_JSON_PLACEHOLDER = `{
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
