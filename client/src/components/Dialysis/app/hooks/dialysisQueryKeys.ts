import type { DialysisHospitalScope } from '../dialysisContext';

export type PatientListFilterParams = {
  search?: string;
  face_filter?: string;
  sessions_filter?: string;
  last_session_filter?: string;
};

export type SessionFilterParams = Record<string, string | number>;

export const dialysisKeys = {
  all: ['dialysis'] as const,
  patients: {
    all: () => [...dialysisKeys.all, 'patients'] as const,
    list: (
      hospitalId: DialysisHospitalScope,
      filters: PatientListFilterParams,
      paging: { mode: 'desktop' | 'infinite'; page?: number; pageSize: number }
    ) => [...dialysisKeys.patients.all(), 'list', hospitalId, filters, paging] as const,
    lookup: (hospitalId: DialysisHospitalScope) =>
      [...dialysisKeys.patients.all(), 'lookup', hospitalId] as const,
    faceStats: (hospitalId: number) =>
      [...dialysisKeys.patients.all(), 'face-stats', hospitalId] as const,
  },
  sessions: {
    all: () => [...dialysisKeys.all, 'sessions'] as const,
    list: (hospitalId: DialysisHospitalScope, filters: SessionFilterParams) =>
      [...dialysisKeys.sessions.all(), 'list', hospitalId, filters] as const,
    kpis: (hospitalId: DialysisHospitalScope, filters: SessionFilterParams) =>
      [...dialysisKeys.sessions.all(), 'kpis', hospitalId, filters] as const,
  },
  overview: (hospitalId: DialysisHospitalScope) =>
    [...dialysisKeys.all, 'overview', hospitalId] as const,
};
