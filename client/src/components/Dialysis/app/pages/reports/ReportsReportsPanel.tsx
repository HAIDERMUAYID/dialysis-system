import React, { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { Collapse } from 'antd';
import { useAuth } from '../../../../../context/AuthContext';
import { usePermission } from '../../../../../hooks/usePermission';
import { DIALYSIS_FACE_ENABLED } from '../../../face/dialysisFaceConfig';
import { useDialysisContext, useEffectiveDialysisHospitalId } from '../../dialysisContext';
import { useDialysisOverlayLock } from '../../useDialysisOverlayLock';
import DialysisPageHeader from '../../DialysisPageHeader';
import '../../dialysis-brand.css';
import ReportsCharts, {
  ReportsChartsSection,
  ReportsHero,
  ReportsKpiCards,
} from './ReportsCharts';
import ReportsExtendedAnalytics from './ReportsExtendedAnalytics';
import ReportsPdfExportModal from './ReportsPdfExportModal';
import ReportsScopeBanner from './ReportsScopeBanner';
import ReportsTable from './ReportsTable';
import ReportsToolbar from './ReportsToolbar';
import type { PatientLookupRow } from './reportsPageTypes';
import { patientHasFaceEnrolled } from './reportsPageUtils';
import { useReportsData } from './useReportsData';
import { useReportsExport } from './useReportsExport';

const DialysisFaceEnrollModal = lazy(() => import('../../../face/DialysisFaceEnrollModal'));

export interface ReportsReportsPanelProps {
  onOverlayLockChange?: (locked: boolean) => void;
  onRegisterRefresh?: (refresh: () => void | Promise<void>) => void;
}

const ReportsReportsPanel: React.FC<ReportsReportsPanelProps> = ({
  onOverlayLockChange,
  onRegisterRefresh,
}) => {
  const { hospitals } = useDialysisContext();
  const { user } = useAuth();
  const effectiveHospitalId = useEffectiveDialysisHospitalId();
  const canEditPatient = usePermission('dialysis:patient:edit');

  const reportsData = useReportsData();
  const {
    isMobile,
    canRecon,
    showHospitalInReports,
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
    filterRecon,
    setFilterRecon,
    filterPatientMatch,
    setFilterPatientMatch,
    filterPatientId,
    setFilterPatientId,
    hallOptions,
    reportPatientOptions,
    loadReportData,
    filteredReportRows,
    statCoverageKeys,
    supplyMismatchKeys,
    reportTotal,
    reportTablePage,
    setReportTablePage,
    reportTablePageSize,
    kpis,
    chartByHall,
    chartByHospital,
    hospitalDistributionRows,
    chartByType,
    chartByShift,
    chartByStatus,
    chartReconSummary,
    monthlyTrendData,
    topPatients,
    monthlyStats,
    shouldShowExtendedSections,
    printTitle,
    printSessionSummary,
    resetReportFilters,
    patchReportPatientOptions,
    patchSessionRowsAfterFaceEnroll,
  } = reportsData;

  const exportApi = useReportsExport(reportsData, {
    user,
    hospitals,
    showHospitalInReports,
  });

  const [filtersDrawerOpen, setFiltersDrawerOpen] = useState(false);
  const [faceEnrollOpen, setFaceEnrollOpen] = useState(false);
  const [faceEnrollQuickStart, setFaceEnrollQuickStart] = useState(false);
  const [faceEnrollTarget, setFaceEnrollTarget] = useState<{
    id: number;
    name: string;
    hasFaceEnrolled: boolean;
  } | null>(null);

  const faceHospitalId = effectiveHospitalId;

  useDialysisOverlayLock(isMobile && (filtersDrawerOpen || faceEnrollOpen));

  useEffect(() => {
    onOverlayLockChange?.(filtersDrawerOpen || faceEnrollOpen);
  }, [filtersDrawerOpen, faceEnrollOpen, onOverlayLockChange]);

  useEffect(() => {
    onRegisterRefresh?.(loadReportData);
  }, [loadReportData, onRegisterRefresh]);

  const openFaceEnrollForPatient = useCallback((patient: PatientLookupRow) => {
    setFaceEnrollTarget({
      id: patient.id,
      name: patient.fullName,
      hasFaceEnrolled: patientHasFaceEnrolled(patient),
    });
    setFaceEnrollQuickStart(false);
    setFaceEnrollOpen(true);
  }, []);

  const closeFaceEnroll = useCallback(() => {
    setFaceEnrollOpen(false);
    setFaceEnrollQuickStart(false);
    setFaceEnrollTarget(null);
  }, []);

  const handleFaceEnrolled = useCallback(() => {
    if (!faceEnrollTarget) return;
    const patientId = faceEnrollTarget.id;
    patchReportPatientOptions((list) =>
      list.map((p) => (p.id === patientId ? { ...p, hasFaceEnrolled: true } : p))
    );
    patchSessionRowsAfterFaceEnroll(patientId);
    setFaceEnrollTarget((prev) => (prev ? { ...prev, hasFaceEnrolled: true } : null));
  }, [faceEnrollTarget, patchReportPatientOptions, patchSessionRowsAfterFaceEnroll]);

  const chartsProps = {
    kpis,
    chartByHall,
    chartByHospital,
    hospitalDistributionRows,
    chartByType,
    chartByShift,
    chartByStatus,
    chartReconSummary,
    monthlyTrendData,
    showHospitalInReports,
    isMobile,
    canRecon,
  };

  return (
    <>
      <DialysisPageHeader
        title="التقارير"
        subtitle="مؤشرات ومخططات وجداول لجلسات الغسل (نظام الحوكمة). الإحصاء والمطابقة في قسم منفصل: «الإحصاء والمطابقة» من القائمة الجانبية أو «المزيد» على الموبايل."
      />
      <div className={`d-card d-report-print${isMobile ? ' d-report-page--mobile' : ''}`}>
        <ReportsToolbar
          isMobile={isMobile}
          reportDateFrom={reportDateFrom}
          setReportDateFrom={setReportDateFrom}
          reportDateTo={reportDateTo}
          setReportDateTo={setReportDateTo}
          filterHall={filterHall}
          setFilterHall={setFilterHall}
          filterType={filterType}
          setFilterType={setFilterType}
          filterShift={filterShift}
          setFilterShift={setFilterShift}
          filterStatus={filterStatus}
          setFilterStatus={setFilterStatus}
          filterRecon={filterRecon}
          setFilterRecon={setFilterRecon}
          filterPatientMatch={filterPatientMatch}
          setFilterPatientMatch={setFilterPatientMatch}
          filterPatientId={filterPatientId}
          setFilterPatientId={setFilterPatientId}
          hallOptions={hallOptions}
          reportPatientOptions={reportPatientOptions}
          reportLoading={reportLoading}
          loadReportData={loadReportData}
          resetReportFilters={resetReportFilters}
          activeExtraFilterCount={exportApi.activeExtraFilterCount}
          filtersDrawerOpen={filtersDrawerOpen}
          setFiltersDrawerOpen={setFiltersDrawerOpen}
          exportReportExcel={exportApi.exportReportExcel}
          downloadReportPdf={exportApi.downloadReportPdf}
          printReport={exportApi.printReport}
          pdfLoading={exportApi.pdfLoading}
        />

        <ReportsScopeBanner
          isMobile={isMobile}
          reportHospitalLabel={exportApi.reportHospitalLabel}
          printTitle={printTitle}
          printSessionSummary={printSessionSummary}
          reportPrintFilters={exportApi.reportPrintFilters}
        />

        <div className="d-report-dashboard">
          {isMobile ? (
            <Collapse
              bordered={false}
              className="d-report-mobile-collapse"
              defaultActiveKey={['summary', 'charts']}
              items={[
                {
                  key: 'summary',
                  label: (
                    <span>
                      ملخص · <strong>{kpis.total}</strong> جلسة · تغطية {kpis.statCoveragePct}%
                    </span>
                  ),
                  children: (
                    <div className="d-report-mobile-tab-panel">
                      <ReportsHero kpis={kpis} isMobile={isMobile} />
                      <div className="d-report-kpi-scroll">
                        <ReportsKpiCards kpis={kpis} />
                      </div>
                    </div>
                  ),
                },
                {
                  key: 'charts',
                  label: 'المخططات والرسوم',
                  children: (
                    <div className="d-report-mobile-tab-panel">
                      <ReportsChartsSection {...chartsProps} />
                    </div>
                  ),
                },
              ]}
            />
          ) : (
            <ReportsCharts {...chartsProps} />
          )}
        </div>

        <ReportsExtendedAnalytics
          shouldShowExtendedSections={shouldShowExtendedSections}
          topPatients={topPatients}
          monthlyStats={monthlyStats}
        />

        <ReportsTable
          filteredReportRows={filteredReportRows}
          reportLoading={reportLoading}
          reportTotal={reportTotal}
          reportTablePage={reportTablePage}
          setReportTablePage={setReportTablePage}
          reportTablePageSize={reportTablePageSize}
          isMobile={isMobile}
          showHospitalInReports={showHospitalInReports}
          statCoverageKeys={statCoverageKeys}
          supplyMismatchKeys={supplyMismatchKeys}
          canEditPatient={canEditPatient}
          onFaceEnroll={openFaceEnrollForPatient}
        />
      </div>

      {DIALYSIS_FACE_ENABLED && faceHospitalId != null && faceEnrollTarget ? (
        <Suspense fallback={null}>
          <DialysisFaceEnrollModal
            open={faceEnrollOpen}
            onClose={closeFaceEnroll}
            patientId={faceEnrollTarget.id}
            hospitalId={faceHospitalId}
            patientName={faceEnrollTarget.name}
            hasFaceEnrolled={faceEnrollTarget.hasFaceEnrolled}
            quickStart={faceEnrollQuickStart}
            onEnrolled={handleFaceEnrolled}
          />
        </Suspense>
      ) : null}

      <ReportsPdfExportModal open={exportApi.pdfExportOpen} step={exportApi.pdfExportStep} />
    </>
  );
};

export default ReportsReportsPanel;
