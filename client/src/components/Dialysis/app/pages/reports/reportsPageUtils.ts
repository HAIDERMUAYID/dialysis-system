import axios from 'axios';
import { formatDialysisCalendarDate } from '../../../dialysisConstants';
import type { ReconRowStatus } from '../reportSessionDisplay';
import type {
  ReportReconFilter,
  SessionReportRow,
  SessionsPageResponse,
} from './reportsPageTypes';

export function patientHasFaceEnrolled(
  p?: { hasFaceEnrolled?: boolean; faceEnrolledAt?: string | null } | null
): boolean {
  return Boolean(p?.hasFaceEnrolled ?? p?.faceEnrolledAt);
}

export function sessionStatCoverageKey(r: SessionReportRow): string | null {
  const pid = r.dialysisPatient?.id;
  if (!pid) return null;
  const ymd = formatDialysisCalendarDate(r.sessionDate);
  if (!ymd || ymd === '—') return null;
  const shift = r.shift;
  if (!shift) return null;
  return `${pid}|${ymd}|${shift}`;
}

export function computeReconStatus(
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

export function mapSessionReportRow(r: SessionReportRow): SessionReportRow {
  return {
    ...r,
    dialysisPatient: r.dialysisPatient
      ? {
          ...r.dialysisPatient,
          hasFaceEnrolled: patientHasFaceEnrolled(r.dialysisPatient),
        }
      : r.dialysisPatient,
  };
}

export function applyClientReportFilters(
  rows: SessionReportRow[],
  filterPatientMatch: string,
  filterRecon: ReportReconFilter,
  statCoverageKeys: Set<string>,
  supplyMismatchKeys: Set<string>
): SessionReportRow[] {
  return rows.filter((r) => {
    if (filterPatientMatch === 'NO_FACE' && patientHasFaceEnrolled(r.dialysisPatient)) {
      return false;
    }
    if (filterRecon) {
      const rs = computeReconStatus(r, statCoverageKeys, supplyMismatchKeys);
      if (rs !== filterRecon) return false;
    }
    return true;
  });
}

export async function fetchAllReportSessions(
  baseParams: Record<string, string | number>
): Promise<SessionReportRow[]> {
  const batchSize = 500;
  let offset = 0;
  let total = Infinity;
  const all: SessionReportRow[] = [];
  while (offset < total) {
    const { data } = await axios.get<SessionsPageResponse | SessionReportRow[]>(
      '/api/dialysis/sessions',
      { params: { ...baseParams, paginated: 1, limit: batchSize, offset } }
    );
    if (Array.isArray(data)) {
      return data.map(mapSessionReportRow);
    }
    total = data.total;
    all.push(...data.items.map(mapSessionReportRow));
    offset += data.items.length;
    if (data.items.length === 0) break;
  }
  return all;
}

export function sessionCreatorDisplayName(r: SessionReportRow): string {
  if (r.created_by_display) return r.created_by_display;
  if (r.created_by_username) return r.created_by_username;
  return '—';
}
