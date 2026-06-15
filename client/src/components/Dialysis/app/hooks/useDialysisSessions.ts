import { useQuery, useQueryClient } from 'react-query';
import type { DialysisHospitalScope } from '../dialysisContext';
import { fetchDialysisSessionKpis, fetchDialysisSessions } from './dialysisApi';
import type { DialysisSessionKpis, DialysisSessionRow } from './dialysisApiTypes';
import { DIALYSIS_STALE_TIME_MS } from './dialysisQueryConfig';
import { dialysisKeys, type SessionFilterParams } from './dialysisQueryKeys';

export type { DialysisSessionRow, DialysisSessionKpis } from './dialysisApiTypes';

export function useDialysisSessions(
  hospitalId: DialysisHospitalScope | null,
  filterParams: SessionFilterParams,
  options?: { limit?: number }
) {
  const enabled = hospitalId != null;
  const limit = options?.limit ?? 400;

  const sessionsQuery = useQuery(
    dialysisKeys.sessions.list(hospitalId!, filterParams),
    () => fetchDialysisSessions(hospitalId!, filterParams, limit),
    {
      enabled,
      staleTime: DIALYSIS_STALE_TIME_MS,
    }
  );

  const kpisQuery = useQuery(
    dialysisKeys.sessions.kpis(hospitalId!, filterParams),
    () => fetchDialysisSessionKpis(hospitalId!, filterParams),
    {
      enabled,
      staleTime: DIALYSIS_STALE_TIME_MS,
    }
  );

  const refetch = async () => {
    await Promise.all([sessionsQuery.refetch(), kpisQuery.refetch()]);
  };

  return {
    rows: (sessionsQuery.data ?? []) as DialysisSessionRow[],
    kpis: (kpisQuery.data ?? null) as DialysisSessionKpis | null,
    loading: sessionsQuery.isLoading || kpisQuery.isLoading,
    isFetching: sessionsQuery.isFetching || kpisQuery.isFetching,
    refetch,
    error: sessionsQuery.error || kpisQuery.error,
  };
}

export function useInvalidateDialysisSessions() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries(dialysisKeys.sessions.all());
}
