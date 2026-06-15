import { useQuery } from 'react-query';
import type { DialysisHospitalScope } from '../dialysisContext';
import { fetchDialysisOverview } from './dialysisApi';
import { DIALYSIS_STALE_TIME_MS } from './dialysisQueryConfig';
import { dialysisKeys } from './dialysisQueryKeys';

export type { DialysisOverviewData, DialysisOverviewActiveRow } from './dialysisApiTypes';

const OVERVIEW_REFETCH_MS = 30_000;

export function useDialysisOverview(hospitalId: DialysisHospitalScope | null) {
  const query = useQuery(
    dialysisKeys.overview(hospitalId!),
    () => fetchDialysisOverview(hospitalId!),
    {
      enabled: hospitalId != null,
      staleTime: DIALYSIS_STALE_TIME_MS,
      refetchInterval: OVERVIEW_REFETCH_MS,
    }
  );

  return {
    stats: query.data?.stats ?? {
      patients: 0,
      locations: 0,
      slots: 0,
      machines: 0,
      active: 0,
      today: 0,
    },
    active: query.data?.active ?? [],
    loading: query.isLoading,
    isFetching: query.isFetching,
    isSuccess: query.isSuccess,
    refetch: query.refetch,
    error: query.error,
  };
}
