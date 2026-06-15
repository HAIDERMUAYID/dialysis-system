import * as XLSX from 'xlsx';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import type { PatientLookupRow } from './reportsPageTypes';
import type {
  StatisticalBulkApiEntry,
  StatisticalBulkParseResult,
  StatisticalBulkPreviewRow,
} from './statisticalBulkImportTypes';

dayjs.extend(customParseFormat);

const HEADER_ALIASES: Record<string, keyof ParsedColumns> = {
  dialysis_patient_id: 'patientId',
  patient_id: 'patientId',
  id: 'patientId',
  'رقم المريض': 'patientId',
  patient_name: 'patientName',
  full_name: 'patientName',
  name: 'patientName',
  'اسم المريض': 'patientName',
  الاسم: 'patientName',
  session_date: 'sessionDate',
  date: 'sessionDate',
  تاريخ: 'sessionDate',
  'تاريخ الغسل': 'sessionDate',
  shift: 'shift',
  وردية: 'shift',
  folder_reference: 'folderReference',
  مرجع: 'folderReference',
  'مرجع المجلد': 'folderReference',
  notes: 'notes',
  ملاحظات: 'notes',
};

type ParsedColumns = {
  patientId?: string;
  patientName?: string;
  sessionDate?: string;
  shift?: string;
  folderReference?: string;
  notes?: string;
};

function normalizeHeader(raw: string): string {
  const trimmed = String(raw ?? '').trim();
  const lower = trimmed.toLowerCase();
  if (HEADER_ALIASES[trimmed]) return HEADER_ALIASES[trimmed];
  if (HEADER_ALIASES[lower]) return HEADER_ALIASES[lower];
  return lower;
}

function cellToString(value: unknown): string {
  if (value == null) return '';
  if (value instanceof Date) return dayjs(value).format('YYYY-MM-DD');
  return String(value).trim();
}

function normalizeShift(raw: string): 'MORNING' | 'EVENING' | null {
  const s = raw.trim();
  if (!s) return null;
  const upper = s.toUpperCase();
  if (upper === 'MORNING' || upper === 'EVENING') return upper;
  const lower = s.toLowerCase();
  if (['morning', 'am', 'm', 'صباحي', 'صباحية', 'ص'].includes(lower)) return 'MORNING';
  if (['evening', 'pm', 'e', 'مسائي', 'مسائية', 'م'].includes(lower)) return 'EVENING';
  return null;
}

function normalizeDate(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const formats = ['DD/MM/YYYY', 'D/M/YYYY', 'YYYY/MM/DD', 'DD-MM-YYYY', 'D-M-YYYY'];
  for (const fmt of formats) {
    const d = dayjs(s, fmt, true);
    if (d.isValid()) return d.format('YYYY-MM-DD');
  }
  const loose = dayjs(s);
  return loose.isValid() ? loose.format('YYYY-MM-DD') : null;
}

function mapRawRow(raw: Record<string, unknown>): ParsedColumns {
  const mapped: ParsedColumns = {};
  for (const [key, value] of Object.entries(raw)) {
    const field = normalizeHeader(key);
    const str = cellToString(value);
    if (!str) continue;
    if (field === 'patientId') mapped.patientId = str;
    else if (field === 'patientName') mapped.patientName = str;
    else if (field === 'sessionDate') mapped.sessionDate = str;
    else if (field === 'shift') mapped.shift = str;
    else if (field === 'folderReference') mapped.folderReference = str;
    else if (field === 'notes') mapped.notes = str;
  }
  return mapped;
}

function resolvePatientId(
  patientIdInput: string | undefined,
  patientNameInput: string | undefined,
  patients: PatientLookupRow[]
): { id?: number; name?: string; error?: string; warning?: string } {
  if (patientIdInput) {
    const pid = parseInt(patientIdInput, 10);
    if (!Number.isFinite(pid)) return { error: 'رقم المريض غير صالح' };
    const hit = patients.find((p) => p.id === pid);
    if (!hit) return { error: `المريض #${pid} غير موجود في هذا المستشفى` };
    return { id: hit.id, name: hit.fullName };
  }

  const name = (patientNameInput || '').trim();
  if (!name) return { error: 'اسم المريض أو رقمه مطلوب' };

  const matches = patients.filter(
    (p) => p.fullName.trim().toLowerCase() === name.toLowerCase()
  );
  if (matches.length === 1) return { id: matches[0].id, name: matches[0].fullName };
  if (matches.length > 1) {
    return { error: `اسم "${name}" مكرر — استخدم رقم المريض` };
  }

  const partial = patients.filter((p) =>
    p.fullName.trim().toLowerCase().includes(name.toLowerCase())
  );
  if (partial.length === 1) {
    return {
      id: partial[0].id,
      name: partial[0].fullName,
      warning: `تم مطابقة "${partial[0].fullName}" جزئياً`,
    };
  }

  return { error: `لم يُعثر على مريض باسم "${name}"` };
}

export function buildStatisticalBulkPreview(
  rawRows: Record<string, unknown>[],
  patients: PatientLookupRow[],
  fileName: string
): StatisticalBulkParseResult {
  const rows: StatisticalBulkPreviewRow[] = [];
  const validEntries: StatisticalBulkApiEntry[] = [];

  rawRows.forEach((raw, index) => {
    const cols = mapRawRow(raw);
    const rowNumber = index + 2;
    const preview: StatisticalBulkPreviewRow = {
      rowNumber,
      patientNameInput: cols.patientName,
      patientIdInput: cols.patientId,
      sessionDateInput: cols.sessionDate,
      shiftInput: cols.shift,
      folderReference: cols.folderReference,
      notes: cols.notes,
      status: 'error',
    };

    if (
      !cols.patientId &&
      !cols.patientName &&
      !cols.sessionDate &&
      !cols.shift &&
      !cols.folderReference &&
      !cols.notes
    ) {
      return;
    }

    const patient = resolvePatientId(cols.patientId, cols.patientName, patients);
    if (patient.error) {
      preview.message = patient.error;
      rows.push(preview);
      return;
    }

    const sessionDate = normalizeDate(cols.sessionDate || '');
    if (!sessionDate) {
      preview.message = 'تاريخ الغسل غير صالح (استخدم YYYY-MM-DD)';
      rows.push(preview);
      return;
    }

    const shift = normalizeShift(cols.shift || '');
    if (!shift) {
      preview.message = 'الوردية غير صالحة (صباحي / مسائي)';
      rows.push(preview);
      return;
    }

    preview.dialysisPatientId = patient.id;
    preview.resolvedPatientName = patient.name;
    preview.sessionDate = sessionDate;
    preview.shift = shift;
    preview.status = patient.warning ? 'warning' : 'valid';
    preview.message = patient.warning;

    rows.push(preview);
    validEntries.push({
      dialysis_patient_id: patient.id!,
      session_date: sessionDate,
      shift,
      folder_reference: cols.folderReference || null,
      notes: cols.notes || null,
    });
  });

  return { rows, validEntries, fileName };
}

export async function parseStatisticalBulkFile(
  file: File,
  patients: PatientLookupRow[]
): Promise<StatisticalBulkParseResult> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error('الملف فارغ — لا توجد أوراق');
  }
  const sheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
    raw: false,
  });
  if (!rawRows.length) {
    throw new Error('لا توجد صفوف بيانات في الملف');
  }
  return buildStatisticalBulkPreview(rawRows, patients, file.name);
}

export function downloadStatisticalBulkTemplate(): void {
  const ws = XLSX.utils.aoa_to_sheet([
    ['اسم المريض', 'رقم المريض', 'تاريخ الغسل', 'الوردية', 'مرجع المجلد', 'ملاحظات'],
    ['أحمد علي', '', '2026-05-08', 'صباحي', 'F-01', ''],
    ['', '12', '2026-05-08', 'مسائي', '', ''],
  ]);
  ws['!cols'] = [{ wch: 24 }, { wch: 12 }, { wch: 14 }, { wch: 10 }, { wch: 14 }, { wch: 20 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'إحصاء');
  XLSX.writeFile(wb, 'dialysis-statistical-import-template.xlsx');
}
