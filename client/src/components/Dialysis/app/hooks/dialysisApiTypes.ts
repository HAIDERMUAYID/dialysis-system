export interface DialysisPatientRow {
  id: number;
  hospitalId?: number;
  hospital?: { id: number; name: string; code?: string | null } | null;
  fullName: string;
  kind: string;
  phone?: string | null;
  nationalId?: string | null;
  internalRecordNumber?: string | null;
  created_by_display?: string | null;
  dialysisStartDate?: string | null;
  sessionsPerWeek?: number | null;
  schedules?: Array<{
    id: number;
    dayOfWeek: number;
    shiftSlot?: { id: number; name: string } | null;
    location?: { id: number; hallName: string; bedCode: string } | null;
  }>;
  hasFaceEnrolled?: boolean;
  needsFaceReenroll?: boolean;
  facePipelineVersion?: string | null;
  sessionTotal?: number;
  lastSessionDate?: string | null;
}

export interface DialysisPatientsPageResponse {
  items: DialysisPatientRow[];
  total: number;
  limit: number;
  offset: number;
}

export interface DialysisPatientLite {
  id: number;
  fullName: string;
  kind?: string;
  hasFaceEnrolled?: boolean;
  needsFaceReenroll?: boolean;
}

export interface DialysisFaceStatsResponse {
  without_face_count?: number;
  needs_reenroll_count?: number;
  total_patients?: number;
}

export interface DialysisSessionRow {
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

export interface DialysisSessionKpis {
  total: number;
  active: number;
  scheduled: number;
  completed: number;
  cancelled: number;
  uniquePatients: number;
  byIntakeKind: Record<string, number>;
}

export interface DialysisOverviewActiveRow {
  id: number;
  hospital?: { name: string; code?: string | null };
  startedAt?: string | null;
  dialysisPatient?: { fullName: string };
  location?: { hallName: string; bedCode: string } | null;
}

export interface DialysisOverviewData {
  stats: {
    patients: number;
    locations: number;
    slots: number;
    machines: number;
    active: number;
    today: number;
  };
  active: DialysisOverviewActiveRow[];
}
