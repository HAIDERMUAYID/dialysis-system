import axios from 'axios';
import dayjs from 'dayjs';
import type { DialysisHospitalScope } from '../dialysisContext';
import { buildOfflineCacheKey } from '../offline/dialysisOfflineDb';
import { fetchWithOfflineCache } from '../offline/dialysisOfflineFetch';
import type { PatientListFilterParams, SessionFilterParams } from './dialysisQueryKeys';
import type {
  DialysisFaceStatsResponse,
  DialysisOverviewData,
  DialysisPatientLite,
  DialysisPatientsPageResponse,
  DialysisSessionKpis,
  DialysisSessionRow,
} from './dialysisApiTypes';

export async function fetchDialysisPatientsPage(
  hospitalId: DialysisHospitalScope,
  filters: PatientListFilterParams,
  offset: number,
  limit: number
): Promise<DialysisPatientsPageResponse> {
  const cacheKey = buildOfflineCacheKey([
    'patients-page',
    hospitalId,
    filters.search,
    filters.face_filter,
    filters.sessions_filter,
    filters.last_session_filter,
    offset,
    limit,
  ]);
  return fetchWithOfflineCache(cacheKey, async () => {
    const { data } = await axios.get<DialysisPatientsPageResponse>('/api/dialysis/patients', {
      params: {
        hospital_id: hospitalId,
        limit,
        offset,
        search: filters.search?.trim() || undefined,
        face_filter: filters.face_filter,
        sessions_filter: filters.sessions_filter,
        last_session_filter: filters.last_session_filter,
      },
    });
    return data;
  });
}

export async function fetchDialysisPatientsLookup(
  hospitalId: DialysisHospitalScope
): Promise<DialysisPatientLite[]> {
  const cacheKey = buildOfflineCacheKey(['patients-lookup', hospitalId]);
  return fetchWithOfflineCache(cacheKey, async () => {
    const { data } = await axios.get<DialysisPatientLite[]>('/api/dialysis/patients', {
      params: { hospital_id: hospitalId },
    });
    return Array.isArray(data) ? data : [];
  });
}

export async function fetchDialysisFaceStats(
  hospitalId: number
): Promise<DialysisFaceStatsResponse> {
  const { data } = await axios.get<DialysisFaceStatsResponse>(
    '/api/dialysis/patients/face-stats',
    { params: { hospital_id: hospitalId } }
  );
  return data;
}

export async function fetchDialysisSessions(
  hospitalId: DialysisHospitalScope,
  filters: SessionFilterParams,
  limit = 400
): Promise<DialysisSessionRow[]> {
  const cacheKey = buildOfflineCacheKey(['sessions', hospitalId, JSON.stringify(filters), limit]);
  return fetchWithOfflineCache(cacheKey, async () => {
    const { data } = await axios.get<DialysisSessionRow[]>('/api/dialysis/sessions', {
      params: { hospital_id: hospitalId, ...filters, limit },
    });
    return Array.isArray(data) ? data : [];
  });
}

export async function fetchDialysisSessionKpis(
  hospitalId: DialysisHospitalScope,
  filters: SessionFilterParams
): Promise<DialysisSessionKpis> {
  const cacheKey = buildOfflineCacheKey(['sessions-kpis', hospitalId, JSON.stringify(filters)]);
  return fetchWithOfflineCache(cacheKey, async () => {
    const { data } = await axios.get<DialysisSessionKpis>('/api/dialysis/sessions/kpis', {
      params: { hospital_id: hospitalId, ...filters },
    });
    return data;
  });
}

export async function fetchDialysisOverview(
  hospitalId: DialysisHospitalScope
): Promise<DialysisOverviewData> {
  const today = dayjs().format('YYYY-MM-DD');
  const params = { hospital_id: hospitalId };
  const [pat, locs, slots, machs, act, kpis] = await Promise.all([
    axios.get('/api/dialysis/patients', { params }),
    axios.get('/api/dialysis/locations', { params }),
    axios.get('/api/dialysis/shift-slots', { params }),
    axios.get('/api/dialysis/machines', { params }),
    axios.get('/api/dialysis/sessions/active', { params }),
    axios.get<{ total: number; active: number }>('/api/dialysis/sessions/kpis', {
      params: { ...params, date: today },
    }),
  ]);
  return {
    stats: {
      patients: Array.isArray(pat.data) ? pat.data.length : 0,
      locations: Array.isArray(locs.data) ? locs.data.length : 0,
      slots: Array.isArray(slots.data) ? slots.data.length : 0,
      machines: Array.isArray(machs.data) ? machs.data.length : 0,
      active: Array.isArray(act.data) ? act.data.length : 0,
      today: typeof kpis.data?.total === 'number' ? kpis.data.total : 0,
    },
    active: Array.isArray(act.data) ? act.data.slice(0, 6) : [],
  };
}
