import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import axios from 'axios';
import dayjs, { Dayjs } from 'dayjs';
import { message } from 'antd';
import { ALL_MY_HOSPITALS, useDialysisContext } from '../../dialysisContext';
import { useDialysisMobile } from '../../useDialysisMobile';
import { usePermission } from '../../../../../hooks/usePermission';
import {
  EMPTY_REPORT_KPIS,
  REPORT_MOBILE_PAGE_SIZE,
  REPORT_TABLE_PAGE_SIZE,
} from './reportsPageConstants';
import type {
  PatientLookupRow,
  ReconResult,
  ReportAggregatesResponse,
  ReportReconFilter,
  SessionReportRow,
  SessionsPageResponse,
} from './reportsPageTypes';
import {
  applyClientReportFilters,
  fetchAllReportSessions,
  mapSessionReportRow,
} from './reportsPageUtils';

export function useReportsData() {
  const { hospitalId } = useDialysisContext();
  const isMobile = useDialysisMobile();
  const canRecon = usePermission('dialysis:reconciliation');

  const [sessionRows, setSessionRows] = useState<SessionReportRow[]>([]);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportDateFrom, setReportDateFrom] = useState<Dayjs>(() => dayjs().startOf('month'));
  const [reportDateTo, setReportDateTo] = useState<Dayjs>(() => dayjs().endOf('day'));
  const [filterHall, setFilterHall] = useState<string>('');
  const [filterType, setFilterType] = useState<string>('');
  const [filterShift, setFilterShift] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterPatientId, setFilterPatientId] = useState<number | undefined>(undefined);
  const [filterPatientMatch, setFilterPatientMatch] = useState<string>('');
  const [filterRecon, setFilterRecon] = useState<ReportReconFilter>('');
  const [statCoverageKeys, setStatCoverageKeys] = useState<Set<string>>(() => new Set());
  const [supplyMismatchKeys, setSupplyMismatchKeys] = useState<Set<string>>(() => new Set());
  const [reportAggregates, setReportAggregates] = useState<ReportAggregatesResponse | null>(null);
  const [reportTotal, setReportTotal] = useState(0);
  const [reportTablePage, setReportTablePage] = useState(1);
  const [analyticsRows, setAnalyticsRows] = useState<SessionReportRow[]>([]);
  const [reportPatientOptions, setReportPatientOptions] = useState<PatientLookupRow[]>([]);

  const showHospitalInReports = hospitalId === ALL_MY_HOSPITALS;
  const reportTablePageSize = isMobile ? REPORT_MOBILE_PAGE_SIZE : REPORT_TABLE_PAGE_SIZE;
  const hasClientOnlyFilters = filterRecon !== '' || filterPatientMatch === 'NO_FACE';

  const reportBaseParams = useMemo(() => {
    if (hospitalId == null) return null;
    const params: Record<string, string | number> = {
      hospital_id: hospitalId,
      date_from: reportDateFrom.format('YYYY-MM-DD'),
      date_to: reportDateTo.format('YYYY-MM-DD'),
    };
    if (filterHall) params.hall_name = filterHall;
    if (filterType) params.intake_kind = filterType;
    if (filterShift) params.shift = filterShift;
    if (filterStatus) params.status = filterStatus;
    if (filterPatientId) params.dialysis_patient_id = filterPatientId;
    if (filterPatientMatch === 'FACE') params.patient_match_method = 'FACE';
    if (filterPatientMatch === 'MANUAL') params.patient_match_method = 'MANUAL';
    return params;
  }, [
    hospitalId,
    reportDateFrom,
    reportDateTo,
    filterHall,
    filterType,
    filterShift,
    filterStatus,
    filterPatientId,
    filterPatientMatch,
  ]);

  const extendedAnalyticsPeriod = useMemo(() => {
    const days = reportDateTo.startOf('day').diff(reportDateFrom.startOf('day'), 'day') + 1;
    return days >= 20;
  }, [reportDateFrom, reportDateTo]);

  const reportFilterKey = useMemo(
    () =>
      JSON.stringify({
        base: reportBaseParams,
        filterRecon,
        filterPatientMatch,
      }),
    [reportBaseParams, filterRecon, filterPatientMatch]
  );
  const lastReportFilterKeyRef = useRef<string | null>(null);

  const loadReportPatients = useCallback(async () => {
    if (hospitalId == null) return;
    try {
      const { data } = await axios.get<PatientLookupRow[]>('/api/dialysis/patients', {
        params: { hospital_id: hospitalId },
      });
      setReportPatientOptions(Array.isArray(data) ? data : []);
    } catch {
      /* optional */
    }
  }, [hospitalId]);

  useEffect(() => {
    loadReportPatients();
  }, [loadReportPatients]);

  const loadReportData = useCallback(async () => {
    if (hospitalId == null || reportBaseParams == null) return;

    const filtersChanged = lastReportFilterKeyRef.current !== reportFilterKey;
    if (filtersChanged) {
      lastReportFilterKeyRef.current = reportFilterKey;
      if (reportTablePage !== 1) {
        setReportTablePage(1);
        return;
      }
    }

    setReportLoading(true);
    try {
      const coveragePromise = axios
        .get<{ keys: string[] }>('/api/dialysis/statistical/coverage-keys', {
          params: reportBaseParams,
        })
        .catch(() => ({ data: { keys: [] as string[] } }));

      const reconPromise = canRecon
        ? axios
            .get<ReconResult>('/api/dialysis/reconciliation', {
              params: {
                hospital_id: hospitalId,
                from: reportBaseParams.date_from,
                to: reportBaseParams.date_to,
              },
            })
            .catch(() => ({ data: null as ReconResult | null }))
        : Promise.resolve({ data: null as ReconResult | null });

      const aggregatesPromise = axios
        .get<ReportAggregatesResponse>('/api/dialysis/sessions/report-aggregates', {
          params: reportBaseParams,
        })
        .catch(() => {
          message.error('فشل تحميل ملخص التقرير');
          return { data: null as ReportAggregatesResponse | null };
        });

      const [aggregatesRes, coverageRes, reconRes] = await Promise.all([
        aggregatesPromise,
        coveragePromise,
        reconPromise,
      ]);

      if (aggregatesRes.data) setReportAggregates(aggregatesRes.data);

      const keys = coverageRes.data?.keys;
      const coverageKeysSet = new Set(Array.isArray(keys) ? keys : []);
      setStatCoverageKeys(coverageKeysSet);

      const disc = reconRes.data?.supply_discrepancies;
      const supplyKeysSet = Array.isArray(disc)
        ? new Set(disc.map((x) => x.key).filter(Boolean) as string[])
        : new Set<string>();
      setSupplyMismatchKeys(supplyKeysSet);

      if (hasClientOnlyFilters) {
        const all = await fetchAllReportSessions(reportBaseParams).catch(() => {
          message.error('فشل تحميل الجلسات');
          return [] as SessionReportRow[];
        });
        const filtered = applyClientReportFilters(
          all,
          filterPatientMatch,
          filterRecon,
          coverageKeysSet,
          supplyKeysSet
        );
        setReportTotal(filtered.length);
        const start = (reportTablePage - 1) * reportTablePageSize;
        setSessionRows(filtered.slice(start, start + reportTablePageSize));
      } else {
        const offset = (reportTablePage - 1) * reportTablePageSize;
        const sessionsRes = await axios
          .get<SessionsPageResponse>('/api/dialysis/sessions', {
            params: {
              ...reportBaseParams,
              paginated: 1,
              limit: reportTablePageSize,
              offset,
            },
          })
          .catch(() => {
            message.error('فشل تحميل الجلسات');
            return {
              data: { items: [], total: 0, limit: reportTablePageSize, offset: 0 },
            };
          });
        setSessionRows(sessionsRes.data.items.map(mapSessionReportRow));
        setReportTotal(sessionsRes.data.total);
      }

      if (extendedAnalyticsPeriod) {
        const analytics = await fetchAllReportSessions(reportBaseParams).catch(
          () => [] as SessionReportRow[]
        );
        setAnalyticsRows(analytics);
      } else {
        setAnalyticsRows([]);
      }
    } finally {
      setReportLoading(false);
    }
  }, [
    hospitalId,
    reportBaseParams,
    canRecon,
    hasClientOnlyFilters,
    filterPatientMatch,
    filterRecon,
    reportTablePage,
    reportTablePageSize,
    extendedAnalyticsPeriod,
    reportFilterKey,
  ]);

  useEffect(() => {
    loadReportData();
  }, [loadReportData]);

  useEffect(() => {
    const onFocus = () => {
      if (document.visibilityState === 'visible') loadReportData();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [loadReportData]);

  const hallOptions = useMemo(() => {
    if (reportAggregates?.halls?.length) {
      return [...reportAggregates.halls];
    }
    return [];
  }, [reportAggregates]);

  const filteredReportRows = useMemo(() => sessionRows, [sessionRows]);

  const kpis = useMemo(
    () => reportAggregates?.kpis ?? EMPTY_REPORT_KPIS,
    [reportAggregates]
  );

  const chartByHall = useMemo(() => reportAggregates?.byHall ?? [], [reportAggregates]);
  const chartByHospital = useMemo(() => reportAggregates?.byHospital ?? [], [reportAggregates]);

  const hospitalDistributionRows = useMemo(() => {
    const total = kpis.total > 0 ? kpis.total : 1;
    return chartByHospital.map((row, idx) => ({
      key: `${row.name}-${idx}`,
      hospitalName: row.name,
      count: row.value,
      pct: Math.round((row.value / total) * 1000) / 10,
    }));
  }, [chartByHospital, kpis.total]);

  const chartByType = useMemo(
    () => [
      { name: 'مجدولة', value: kpis.scheduled },
      { name: 'غير مجدولة', value: kpis.unscheduled },
      { name: 'طارئة', value: kpis.emergency },
    ],
    [kpis]
  );

  const chartByStatus = useMemo(
    () => [
      { name: 'نشطة', value: kpis.active },
      { name: 'منتهية', value: kpis.completed },
      { name: 'ملغاة', value: kpis.cancelled },
    ],
    [kpis]
  );

  const chartReconSummary = useMemo(
    () => [
      { name: 'مسجّل', value: kpis.reconMatched },
      { name: 'غير مسجّل', value: kpis.reconMissing },
      { name: 'فرق مواد', value: kpis.reconSupply },
    ],
    [kpis]
  );

  const chartByShift = useMemo(
    () => [
      { name: 'صباحية', value: kpis.morning },
      { name: 'مسائية', value: kpis.evening },
    ],
    [kpis]
  );

  const topPatients = useMemo(() => {
    const source = analyticsRows.length > 0 ? analyticsRows : filteredReportRows;
    const map = new Map<string, number>();
    source.forEach((r) => {
      const name = r.dialysisPatient?.fullName || 'طارئ / غير معرف';
      map.set(name, (map.get(name) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [analyticsRows, filteredReportRows]);

  const monthlyStats = useMemo(() => {
    const rows = analyticsRows.length > 0 ? analyticsRows : [];
    if (rows.length === 0) return [];
    const monthMap = new Map<string, SessionReportRow[]>();
    rows.forEach((r) => {
      const key = dayjs(r.sessionDate).format('YYYY-MM');
      if (!monthMap.has(key)) monthMap.set(key, []);
      monthMap.get(key)!.push(r);
    });

    return Array.from(monthMap.entries())
      .sort(([a], [b]) => (a > b ? 1 : -1))
      .map(([month, monthRows]) => {
        const uniquePatients = new Set(monthRows.map((r) => r.dialysisPatient?.id).filter(Boolean)).size;
        const days = dayjs(`${month}-01`).daysInMonth();
        return {
          month,
          total: monthRows.length,
          morning: monthRows.filter((r) => (r.shift || '').toUpperCase() === 'MORNING').length,
          evening: monthRows.filter((r) => (r.shift || '').toUpperCase() === 'EVENING').length,
          scheduled: monthRows.filter((r) => r.intakeKind === 'SCHEDULED').length,
          unscheduled: monthRows.filter((r) => r.intakeKind === 'OFF_SCHEDULE').length,
          emergency: monthRows.filter((r) => r.intakeKind === 'EMERGENCY').length,
          uniquePatients,
          dailyAverage: (monthRows.length / Math.max(days, 1)).toFixed(1),
        };
      });
  }, [analyticsRows]);

  const monthlyTrendData = useMemo(
    () => monthlyStats.map((m) => ({ month: m.month, total: m.total })),
    [monthlyStats]
  );

  const shouldShowExtendedSections = useMemo(() => {
    const days = reportDateTo.startOf('day').diff(reportDateFrom.startOf('day'), 'day') + 1;
    return days >= 20;
  }, [reportDateFrom, reportDateTo]);

  const printTitle = useMemo(() => {
    return `من ${reportDateFrom.format('YYYY-MM-DD')} إلى ${reportDateTo.format('YYYY-MM-DD')}`;
  }, [reportDateFrom, reportDateTo]);

  const printSessionSummary = useMemo(() => {
    const n = reportTotal;
    return `${n} ${n === 1 ? 'جلسة' : 'جلسة'} بعد تطبيق الفلاتر`;
  }, [reportTotal]);

  const resetReportFilters = useCallback(() => {
    setFilterHall('');
    setFilterType('');
    setFilterShift('');
    setFilterStatus('');
    setFilterPatientId(undefined);
    setFilterPatientMatch('');
    setFilterRecon('');
    setReportTablePage(1);
  }, []);

  const patchReportPatientOptions = useCallback(
    (patch: (list: PatientLookupRow[]) => PatientLookupRow[]) => {
      setReportPatientOptions(patch);
    },
    []
  );

  const patchSessionRowsAfterFaceEnroll = useCallback((patientId: number) => {
    setSessionRows((prev) =>
      prev.map((r) =>
        r.dialysisPatient?.id === patientId
          ? {
              ...r,
              dialysisPatient: r.dialysisPatient
                ? {
                    ...r.dialysisPatient,
                    hasFaceEnrolled: true,
                    faceEnrolledAt: new Date().toISOString(),
                  }
                : r.dialysisPatient,
            }
          : r
      )
    );
  }, []);

  return {
    hospitalId,
    isMobile,
    canRecon,
    showHospitalInReports,
    sessionRows,
    reportLoading,
    reportDateFrom,
    setReportDateFrom,
    reportDateTo,
    setReportDateTo,
    filterHall,
    setFilterHall,
    filterType,
    setFilterType,
    filterShift,
    setFilterShift,
    filterStatus,
    setFilterStatus,
    filterPatientId,
    setFilterPatientId,
    filterPatientMatch,
    setFilterPatientMatch,
    filterRecon,
    setFilterRecon,
    statCoverageKeys,
    supplyMismatchKeys,
    reportTotal,
    reportTablePage,
    setReportTablePage,
    reportTablePageSize,
    reportPatientOptions,
    reportBaseParams,
    loadReportData,
    hallOptions,
    filteredReportRows,
    kpis,
    chartByHall,
    chartByHospital,
    hospitalDistributionRows,
    chartByType,
    chartByStatus,
    chartReconSummary,
    chartByShift,
    topPatients,
    monthlyStats,
    monthlyTrendData,
    shouldShowExtendedSections,
    printTitle,
    printSessionSummary,
    resetReportFilters,
    patchReportPatientOptions,
    patchSessionRowsAfterFaceEnroll,
    setReportLoading,
  };
}

export type ReportsData = ReturnType<typeof useReportsData>;
