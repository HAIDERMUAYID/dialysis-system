import type { ReconRowStatus } from '../reportSessionDisplay';

export interface PatientLookupRow {
  id: number;
  fullName: string;
  kind?: string;
  hasFaceEnrolled?: boolean;
  faceEnrolledAt?: string | null;
}

export interface StatEntryRow {
  id: number;
  sessionDate: string;
  shift: string;
  dialysisPatient?: { fullName: string; id: number };
}

export interface ReconResult {
  missed_folders?: Array<Record<string, unknown>>;
  ghost_sessions?: Array<Record<string, unknown>>;
  supply_discrepancies?: Array<Record<string, unknown> & { key?: string }>;
}

export interface SessionReportRow {
  id: number;
  hospitalId?: number;
  hospital?: { id: number; name: string; code?: string | null } | null;
  sessionDate: string;
  status: string;
  intakeKind?: string | null;
  shift?: string | null;
  startedAt?: string | null;
  notes?: string | null;
  patientMatchMethod?: 'MANUAL' | 'FACE' | null;
  dialysisPatient?: {
    id: number;
    fullName: string;
    photoUrl?: string | null;
    photo_url?: string | null;
    hasFaceEnrolled?: boolean;
    faceEnrolledAt?: string | null;
  } | null;
  location?: { hallName: string; bedCode: string } | null;
  created_by_display?: string | null;
  created_by_username?: string | null;
}

export interface MonthlyStatRow {
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

export interface ReportAggregatesResponse {
  kpis: {
    total: number;
    uniquePatients: number;
    scheduled: number;
    unscheduled: number;
    emergency: number;
    morning: number;
    evening: number;
    active: number;
    completed: number;
    cancelled: number;
    reconMatched: number;
    reconMissing: number;
    reconSupply: number;
    reconNa: number;
    statCoveragePct: number;
  };
  byHall: { name: string; value: number }[];
  byHospital: { name: string; value: number }[];
  halls: string[];
}

export interface SessionsPageResponse {
  items: SessionReportRow[];
  total: number;
  limit: number;
  offset: number;
}

export type ReportReconFilter = '' | ReconRowStatus;

export type PrintSlice = { name: string; value: number };
