import { useMemo } from 'react';
import { useInfiniteQuery, useQuery, useQueryClient } from 'react-query';
import type { DialysisHospitalScope } from '../dialysisContext';
import { ALL_MY_HOSPITALS } from '../dialysisContext';
import {
  fetchDialysisFaceStats,
  fetchDialysisPatientsLookup,
  fetchDialysisPatientsPage,
} from './dialysisApi';
import type { DialysisPatientRow } from './dialysisApiTypes';
import { DIALYSIS_STALE_TIME_MS } from './dialysisQueryConfig';
import { dialysisKeys, type PatientListFilterParams } from './dialysisQueryKeys';

export type { DialysisPatientRow, DialysisPatientsPageResponse } from './dialysisApiTypes';

const DEFAULT_DESKTOP_PAGE_SIZE = 12;
const DEFAULT_MOBILE_PAGE_SIZE = 8;

export function buildPatientListFilters(input: {
  search: string;
  faceFilter: string;
  sessionsFilter: string;
  lastSessionFilter: string;
}): PatientListFilterParams {
  return {
    search: input.search.trim() || undefined,
    face_filter: input.faceFilter,
    sessions_filter: input.sessionsFilter,
    last_session_filter: input.lastSessionFilter,
  };
}

export function useDialysisPatients(options: {
  hospitalId: DialysisHospitalScope | null;
  filters: PatientListFilterParams;
  isMobile: boolean;
  desktopPage: number;
  desktopPageSize?: number;
  mobilePageSize?: number;
}) {
  const {
    hospitalId,
    filters,
    isMobile,
    desktopPage,
    desktopPageSize = DEFAULT_DESKTOP_PAGE_SIZE,
    mobilePageSize = DEFAULT_MOBILE_PAGE_SIZE,
  } = options;

  const enabled = hospitalId != null;

  const desktopQuery = useQuery(
    dialysisKeys.patients.list(hospitalId!, filters, {
      mode: 'desktop',
      page: desktopPage,
      pageSize: desktopPageSize,
    }),
    () =>
      fetchDialysisPatientsPage(
        hospitalId!,
        filters,
        (desktopPage - 1) * desktopPageSize,
        desktopPageSize
      ),
    {
      enabled: enabled && !isMobile,
      staleTime: DIALYSIS_STALE_TIME_MS,
      keepPreviousData: true,
    }
  );

  const infiniteQuery = useInfiniteQuery(
    dialysisKeys.patients.list(hospitalId!, filters, {
      mode: 'infinite',
      pageSize: mobilePageSize,
    }),
    ({ pageParam = 0 }) =>
      fetchDialysisPatientsPage(hospitalId!, filters, pageParam as number, mobilePageSize),
    {
      enabled: enabled && isMobile,
      staleTime: DIALYSIS_STALE_TIME_MS,
      getNextPageParam: (lastPage, pages) => {
        const loaded = pages.reduce((n, p) => n + p.items.length, 0);
        return loaded < lastPage.total ? loaded : undefined;
      },
    }
  );

  const rows = useMemo((): DialysisPatientRow[] => {
    if (isMobile) {
      const pages = infiniteQuery.data?.pages ?? [];
      const seen = new Set<number>();
      const merged: DialysisPatientRow[] = [];
      for (const page of pages) {
        for (const row of page.items) {
          if (!seen.has(row.id)) {
            seen.add(row.id);
            merged.push(row);
          }
        }
      }
      return merged;
    }
    return desktopQuery.data?.items ?? [];
  }, [isMobile, infiniteQuery.data, desktopQuery.data]);

  const total = isMobile
    ? infiniteQuery.data?.pages[0]?.total ?? 0
    : desktopQuery.data?.total ?? 0;

  const loading = isMobile ? infiniteQuery.isLoading : desktopQuery.isLoading;
  const loadingMore = isMobile ? infiniteQuery.isFetchingNextPage : false;
  const isFetching = isMobile ? infiniteQuery.isFetching : desktopQuery.isFetching;

  const refetch = async () => {
    if (isMobile) {
      await infiniteQuery.refetch();
    } else {
      await desktopQuery.refetch();
    }
  };

  const fetchNextPage = () => {
    if (isMobile && infiniteQuery.hasNextPage && !infiniteQuery.isFetchingNextPage) {
      void infiniteQuery.fetchNextPage();
    }
  };

  return {
    rows,
    total,
    loading,
    loadingMore,
    isFetching,
    refetch,
    fetchNextPage,
    hasNextPage: isMobile ? Boolean(infiniteQuery.hasNextPage) : false,
  };
}

export function useDialysisFaceStats(
  hospitalId: DialysisHospitalScope | null,
  fallbackTotal = 0
) {
  const numericHospitalId = typeof hospitalId === 'number' ? hospitalId : null;
  const query = useQuery(
    dialysisKeys.patients.faceStats(numericHospitalId ?? 0),
    () => fetchDialysisFaceStats(numericHospitalId!),
    {
      enabled: numericHospitalId != null && hospitalId !== ALL_MY_HOSPITALS,
      staleTime: DIALYSIS_STALE_TIME_MS,
    }
  );

  return {
    withoutFace: query.data?.without_face_count ?? 0,
    needsReenroll: query.data?.needs_reenroll_count ?? 0,
    totalPatients: query.data?.total_patients ?? fallbackTotal,
    isLoading: query.isLoading,
  };
}

export function useDialysisPatientsLookup(hospitalId: DialysisHospitalScope | null) {
  return useQuery(
    dialysisKeys.patients.lookup(hospitalId!),
    () => fetchDialysisPatientsLookup(hospitalId!),
    {
      enabled: hospitalId != null,
      staleTime: DIALYSIS_STALE_TIME_MS,
    }
  );
}

export function useInvalidateDialysisPatients() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries(dialysisKeys.patients.all());
}
