import { useCallback, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { message } from 'antd';
import * as XLSX from 'xlsx';
import { reportClientError } from '../../../../../monitoring/clientMonitoring';
import {
  buildDialysisPrintHeaderHtml,
  DIALYSIS_PRINT_HEADER_CSS,
  DIALYSIS_PDF_CAPTURE_CSS,
  DIALYSIS_PRINT_BASE_CSS,
  DIALYSIS_PRINT_FONT_TAGS,
  DIALYSIS_PRINT_SIGNATURE_CSS,
  DIALYSIS_PRINT_SIGNATURE_HTML,
  downloadDialysisPrintHtmlAsPdf,
  escapeDialysisPrintHtml,
  type DialysisPrintFilterChip,
} from '../../dialysisPrint';
import { sessionPatientPhotoUrl } from '../../dialysisPatientPhoto';
import {
  DIALYSIS_REPORT_PRINT_CSS,
  buildPrintHeroMetrics,
  buildPrintKpiDashboard,
  buildPrintKpiSection,
  buildPrintSectionHead,
  buildPrintSessionRowHtml,
} from '../../dialysisReportPrint';
import { getHospitalScopeLabel } from '../../dialysisBrand';
import { formatDialysisCalendarDate } from '../../../dialysisConstants';
import {
  patientMatchLabel,
  reconPrintSymbol,
} from '../reportSessionDisplay';
import {
  CHART_PALETTE,
  INTAKE_LABEL_AR,
  RECON_STATUS_LABEL,
  SHIFT_LABEL_AR,
  STATUS_LABEL_AR,
} from './reportsPageConstants';
import type { SessionReportRow } from './reportsPageTypes';
import {
  applyClientReportFilters,
  computeReconStatus,
  fetchAllReportSessions,
  sessionCreatorDisplayName,
} from './reportsPageUtils';
import {
  buildPrintHBars,
  buildPrintPieSvg,
  buildPrintTrendSvg,
} from './reportsPrintSvgUtils';
import type { ReportsData } from './useReportsData';

export interface UseReportsExportOptions {
  user?: { name?: string | null; username?: string | null } | null;
  hospitals: Array<{ id: number; name: string; code?: string | null }>;
  showHospitalInReports: boolean;
}

export function useReportsExport(data: ReportsData, options: UseReportsExportOptions) {
  const { user, hospitals, showHospitalInReports } = options;

  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfExportOpen, setPdfExportOpen] = useState(false);
  const [pdfExportStep, setPdfExportStep] = useState(0);

  const {
    hospitalId,
    reportBaseParams,
    filterPatientMatch,
    filterRecon,
    statCoverageKeys,
    supplyMismatchKeys,
    filteredReportRows,
    kpis,
    topPatients,
    monthlyStats,
    chartByType,
    chartByShift,
    chartByHall,
    chartByHospital,
    chartByStatus,
    chartReconSummary,
    monthlyTrendData,
    hospitalDistributionRows,
    shouldShowExtendedSections,
    printTitle,
    printSessionSummary,
    reportDateFrom,
    reportDateTo,
    reportTotal,
    filterHall,
    filterType,
    filterShift,
    filterStatus,
    filterPatientId,
    filterRecon: filterReconValue,
    reportPatientOptions,
    setReportLoading,
  } = data;

  const esc = escapeDialysisPrintHtml;

  const reportHospitalLabel = useMemo(
    () => getHospitalScopeLabel(hospitalId, hospitals),
    [hospitalId, hospitals]
  );

  const reportPrintFilters = useMemo((): DialysisPrintFilterChip[] => {
    const patientName = filterPatientId
      ? reportPatientOptions.find((p) => p.id === filterPatientId)?.fullName ||
        filteredReportRows.find((r) => r.dialysisPatient?.id === filterPatientId)?.dialysisPatient
          ?.fullName
      : null;
    return [
      { label: 'من تاريخ', value: reportDateFrom.format('YYYY-MM-DD') },
      { label: 'إلى تاريخ', value: reportDateTo.format('YYYY-MM-DD') },
      { label: 'الصالة', value: filterHall || 'الكل' },
      {
        label: 'نوع الجلسة',
        value: filterType ? INTAKE_LABEL_AR[filterType] || filterType : 'الكل',
      },
      {
        label: 'النوبة',
        value: filterShift ? SHIFT_LABEL_AR[filterShift] || filterShift : 'الكل',
      },
      {
        label: 'حالة الجلسة',
        value: filterStatus ? STATUS_LABEL_AR[filterStatus] || filterStatus : 'الكل',
      },
      {
        label: 'مطابقة الإحصاء',
        value: filterReconValue ? RECON_STATUS_LABEL[filterReconValue] : 'الكل',
      },
      { label: 'المريض', value: patientName || (filterPatientId ? `#${filterPatientId}` : 'الكل') },
    ];
  }, [
    reportDateFrom,
    reportDateTo,
    filterHall,
    filterType,
    filterShift,
    filterStatus,
    filterReconValue,
    filterPatientId,
    reportPatientOptions,
    filteredReportRows,
  ]);

  const activeExtraFilterCount = useMemo(() => {
    let n = 0;
    if (filterHall) n += 1;
    if (filterType) n += 1;
    if (filterShift) n += 1;
    if (filterStatus) n += 1;
    if (filterReconValue) n += 1;
    if (filterPatientId) n += 1;
    if (filterPatientMatch) n += 1;
    return n;
  }, [
    filterHall,
    filterType,
    filterShift,
    filterStatus,
    filterReconValue,
    filterPatientId,
    filterPatientMatch,
  ]);

  const sessionsPrintColspan = showHospitalInReports ? 14 : 13;
  const sessionsPrintHospitalTh = showHospitalInReports ? '<th>المستشفى</th>' : '';

  const mapPrintSessionRowsHtml = useCallback(
    (rows: SessionReportRow[]) =>
      rows
        .map((r, i) => {
          const recon = computeReconStatus(r, statCoverageKeys, supplyMismatchKeys);
          const ik = r.intakeKind || '';
          const st = (r.status || '').toUpperCase();
          return buildPrintSessionRowHtml(
            {
              index: i + 1,
              showHospital: showHospitalInReports,
              hospitalName: r.hospital?.name,
              patientName: r.dialysisPatient?.fullName || '—',
              patientPhotoUrl: sessionPatientPhotoUrl(r.dialysisPatient),
              hall: r.location?.hallName || '—',
              bed: r.location?.bedCode || '—',
              date: formatDialysisCalendarDate(r.sessionDate),
              time: r.startedAt ? dayjs(r.startedAt).format('HH:mm') : '—',
              shift: SHIFT_LABEL_AR[(r.shift || '').toUpperCase()] || '—',
              intakeKind: ik,
              intakeLabel: INTAKE_LABEL_AR[ik] || '—',
              status: st,
              statusLabel: STATUS_LABEL_AR[st] || r.status || '—',
              creator: sessionCreatorDisplayName(r),
              matchMethod: r.patientMatchMethod,
              matchLabel: patientMatchLabel(r.patientMatchMethod),
              recon,
              notes: r.notes || '—',
            },
            esc
          );
        })
        .join(''),
    [showHospitalInReports, statCoverageKeys, supplyMismatchKeys, esc]
  );

  const buildPrintReportDocumentHtml = useCallback(
    (forPdfCapture = false, detailRows?: SessionReportRow[]) => {
      const rowsForPrint = detailRows ?? filteredReportRows;
      const printSessionsRowsHtml = mapPrintSessionRowsHtml(rowsForPrint);
      const printedAt = dayjs().format('YYYY-MM-DD HH:mm');
      const topRowsHtml = topPatients
        .map((r, idx) => `<tr><td>${idx + 1}</td><td>${esc(r.name)}</td><td>${r.count}</td></tr>`)
        .join('');
      const monthlyRowsHtml = monthlyStats
        .map(
          (m) =>
            `<tr><td>${m.month}</td><td>${m.total}</td><td>${m.morning}</td><td>${m.evening}</td><td>${m.scheduled}</td><td>${m.unscheduled}</td><td>${m.emergency}</td><td>${m.uniquePatients}</td><td>${m.dailyAverage}</td></tr>`
        )
        .join('');
      const typeRowsHtml = chartByType
        .map((r) => `<tr><td>${esc(r.name)}</td><td>${r.value}</td></tr>`)
        .join('');
      const shiftRowsHtml = chartByShift
        .map((r) => `<tr><td>${esc(r.name)}</td><td>${r.value}</td></tr>`)
        .join('');

      const kpiDashboard = buildPrintKpiDashboard(
        [
          buildPrintKpiSection('توزيع الجلسات حسب النوع', [
            { n: kpis.scheduled, l: 'مجدولة' },
            { n: kpis.unscheduled, l: 'غير مجدولة' },
            { n: kpis.emergency, l: 'طارئة' },
          ], esc),
          buildPrintKpiSection('توزيع الجلسات حسب النوبة', [
            { n: kpis.morning, l: 'صباحية' },
            { n: kpis.evening, l: 'مسائية' },
            { n: '—', l: '' },
          ], esc),
          buildPrintKpiSection('حالة الجلسات', [
            { n: kpis.active, l: 'نشطة' },
            { n: kpis.completed, l: 'منتهية' },
            { n: kpis.cancelled, l: 'ملغاة' },
          ], esc),
          buildPrintKpiSection('مطابقة الجلسات مع الإحصاء', [
            { n: kpis.reconMatched, l: 'مسجّلة' },
            { n: kpis.reconMissing, l: 'غير مسجّلة' },
            { n: kpis.reconSupply, l: 'فرق مواد' },
          ], esc),
        ].join('')
      );

      const heroMetrics = buildPrintHeroMetrics(
        [
          { value: kpis.total, label: 'إجمالي الجلسات', primary: true },
          { value: kpis.uniquePatients, label: 'مرضى مختلفون' },
          { value: `${kpis.statCoveragePct}%`, label: 'تغطية الإحصاء' },
          { value: kpis.completed, label: 'جلسات منتهية' },
          { value: reportTotal, label: 'بعد الفلاتر' },
        ],
        esc
      );

      const hospitalPrintRowsHtml = hospitalDistributionRows
        .map(
          (r) =>
            `<tr><td>${esc(r.hospitalName)}</td><td>${r.count}</td><td>${r.pct}%</td></tr>`
        )
        .join('');

      const hospitalChartsPrint = showHospitalInReports
        ? `
<div class="print-charts-row single">
  <div class="chart-box"><h4>توزيع الجلسات حسب المستشفى</h4>${buildPrintHBars(chartByHospital, CHART_PALETTE, esc)}</div>
</div>
<div class="sec" style="margin-bottom:12px">${buildPrintSectionHead('جدول التوزيع حسب المستشفى', esc)}<div class="sessions-table-wrap"><table class="data" dir="rtl" lang="ar"><thead><tr><th>المستشفى</th><th>عدد الجلسات</th><th>النسبة %</th></tr></thead><tbody>${hospitalPrintRowsHtml || '<tr><td colspan="3">—</td></tr>'}</tbody></table></div></div>`
        : '';

      const chartsBlock = `
<div class="print-charts-title">الرسوم البيانية والتحليلات</div>
${hospitalChartsPrint}
<div class="print-charts-row">
  <div class="chart-box"><h4>توزيع الجلسات على الصالات</h4>${buildPrintHBars(chartByHall, CHART_PALETTE, esc)}</div>
  <div class="chart-box"><h4>اتجاه الجلسات شهرياً</h4>${buildPrintTrendSvg(monthlyTrendData)}</div>
</div>
<div class="print-charts-row three">
  <div class="chart-box"><h4>نوع الجلسة</h4>${buildPrintPieSvg(chartByType, CHART_PALETTE)}</div>
  <div class="chart-box"><h4>النوبة</h4>${buildPrintPieSvg(chartByShift, CHART_PALETTE)}</div>
  <div class="chart-box"><h4>حالة الجلسة</h4>${buildPrintPieSvg(chartByStatus, CHART_PALETTE)}</div>
</div>
<div class="print-charts-row single">
  <div class="chart-box"><h4>مطابقة الجلسات مع الإحصاء</h4>${buildPrintPieSvg(chartReconSummary, CHART_PALETTE)}</div>
</div>`;

      const printHeaderHtml = buildDialysisPrintHeaderHtml({
        reportTitle: 'تقرير جلسات الغسل الكلوي',
        reportSubtitle: `${printTitle} — ${printSessionSummary}`,
        hospitalLabel: reportHospitalLabel,
        filters: reportPrintFilters,
        printedAt,
        printedBy: user?.name?.trim() || user?.username || undefined,
        sessionCount: rowsForPrint.length,
      });

      const html = `<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8" />
<title>${esc(printTitle)}</title>
${DIALYSIS_PRINT_FONT_TAGS}
<style>
${DIALYSIS_PRINT_BASE_CSS}
${DIALYSIS_PRINT_HEADER_CSS}
${DIALYSIS_PRINT_SIGNATURE_CSS}
${DIALYSIS_PDF_CAPTURE_CSS}
${DIALYSIS_REPORT_PRINT_CSS}
.preview-tools{
  position:sticky;
  top:0;
  z-index:9999;
  display:flex;
  gap:8px;
  align-items:center;
  justify-content:space-between;
  margin:0 0 12px;
  padding:9px 10px;
  border:1px solid #dbeaf5;
  border-radius:10px;
  background:#f8fbff;
}
.preview-tools__meta{font-size:11px;color:#334155;font-weight:700}
.preview-tools__actions{display:flex;gap:6px}
.preview-tools button{
  border:1px solid #cbd5e1;
  background:#fff;
  color:#0f172a;
  padding:6px 10px;
  border-radius:8px;
  font-size:11px;
  font-weight:700;
}
.preview-tools button.primary{
  background:#157c67;
  border-color:#157c67;
  color:#fff;
}
.print-signature{display:none}
.print-signature-top .print-signature{display:none}
.print-footer{display:none}
@media print{
  @page{size:A4;margin:7mm 7mm 18mm 7mm}
  body{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .no-print{display:none !important}
  .print-signature-top .print-signature-stamp{
    display:block;
    position:fixed;
    left:1mm;
    bottom:0.5mm;
    width:220px;
    opacity:.78;
    z-index:2147483647;
    pointer-events:none;
  }
  .print-footer{
    display:flex;
    position:fixed;
    left:0;
    right:0;
    bottom:0;
    border-top:2px solid #157c67;
    background:transparent;
    padding:4px 7px;
    align-items:center;
    justify-content:space-between;
    font-size:10px;
    color:#51657a;
  }
  .page-num::after{
    content:"صفحة " counter(page) " من " counter(pages);
  }
}
</style></head><body${forPdfCapture ? ' class="pdf-capture"' : ''}>
<div class="preview-tools no-print">
  <div class="preview-tools__meta">وضع المعاينة للطباعة/PDF</div>
  <div class="preview-tools__actions">
    <button onclick="window.print()">طباعة / حفظ PDF</button>
    <button class="primary" onclick="window.close()">رجوع للنظام</button>
  </div>
</div>
${forPdfCapture ? '' : `<div class="print-signature-top">${DIALYSIS_PRINT_SIGNATURE_HTML}</div>`}

${printHeaderHtml}

${heroMetrics}
${kpiDashboard}
${chartsBlock}

${shouldShowExtendedSections ? `<hr class="divider"><div class="sec">${buildPrintSectionHead('أكثر عشرة مرضى حضوراً للغسل', esc)}<div class="sessions-table-wrap"><table class="data" dir="rtl" lang="ar"><thead><tr><th>الترتيب</th><th>اسم المريض</th><th>عدد الجلسات</th></tr></thead><tbody>${topRowsHtml || '<tr><td colspan="3">—</td></tr>'}</tbody></table></div></div>` : ''}

${shouldShowExtendedSections ? `<div class="sec">${buildPrintSectionHead('ملخص الجلسات شهرياً', esc)}<div class="sessions-table-wrap"><table class="data" dir="rtl" lang="ar"><thead><tr><th>الشهر</th><th>الإجمالي</th><th>صباحية</th><th>مسائية</th><th>مجدولة</th><th>غير مجدولة</th><th>طارئة</th><th>مرضى فريدون</th><th>معدل يومي</th></tr></thead><tbody>${monthlyRowsHtml || '<tr><td colspan="9">—</td></tr>'}</tbody></table></div></div>` : ''}

${shouldShowExtendedSections ? `<div class="sec">${buildPrintSectionHead('تفصيل حسب نوع الجلسة والنوبة', esc)}<div class="two">
<div class="sessions-table-wrap"><h4 style="margin:0 0 6px;font-size:11px;font-weight:800;color:#0f5132;padding:8px 10px 0">حسب نوع الجلسة</h4><table class="data" dir="rtl" lang="ar"><thead><tr><th>النوع</th><th>العدد</th></tr></thead><tbody>${typeRowsHtml}</tbody></table></div>
<div class="sessions-table-wrap"><h4 style="margin:0 0 6px;font-size:11px;font-weight:800;color:#0f5132;padding:8px 10px 0">حسب النوبة</h4><table class="data" dir="rtl" lang="ar"><thead><tr><th>النوبة</th><th>العدد</th></tr></thead><tbody>${shiftRowsHtml}</tbody></table></div>
</div></div>` : ''}

<hr class="divider"><div class="sec sessions">
${buildPrintSectionHead('سجل الجلسات التفصيلي', esc, { subtitle: printSessionSummary, count: rowsForPrint.length })}
<div class="sessions-table-wrap">
<table class="data" dir="rtl" lang="ar"><thead><tr><th>#</th>${sessionsPrintHospitalTh}<th>المريض</th><th>الصالة</th><th>السرير</th><th>التاريخ</th><th>الوقت</th><th>النوبة</th><th>النوع</th><th>الحالة</th><th>الموظف</th><th>الإدخال</th><th>إحصاء</th><th>ملاحظات</th></tr></thead>
<tbody>${printSessionsRowsHtml || `<tr><td colspan="${sessionsPrintColspan}">لا توجد بيانات</td></tr>`}</tbody></table>
</div></div>
${forPdfCapture ? `<div class="print-signature-bottom">${DIALYSIS_PRINT_SIGNATURE_HTML}</div><div class="pdf-footer-template">شعبة الكلية الصناعية – وحدة الحوكمة</div>` : ''}
<div class="print-footer"><div>شعبة الكلية الصناعية – وحدة الحوكمة</div><div class="page-num"></div></div>
</body></html>`;

      return html;
    },
    [
      filteredReportRows,
      mapPrintSessionRowsHtml,
      topPatients,
      monthlyStats,
      chartByType,
      chartByShift,
      kpis,
      reportTotal,
      hospitalDistributionRows,
      showHospitalInReports,
      chartByHospital,
      chartByHall,
      monthlyTrendData,
      chartByStatus,
      chartReconSummary,
      printTitle,
      printSessionSummary,
      reportHospitalLabel,
      reportPrintFilters,
      shouldShowExtendedSections,
      user,
      esc,
      sessionsPrintHospitalTh,
      sessionsPrintColspan,
    ]
  );

  const exportReportExcel = useCallback(async () => {
    if (!reportBaseParams) return;
    setReportLoading(true);
    try {
      const all = await fetchAllReportSessions(reportBaseParams);
      const exportRows = applyClientReportFilters(
        all,
        filterPatientMatch,
        filterRecon,
        statCoverageKeys,
        supplyMismatchKeys
      );
      const sheetRows = exportRows.map((r, i) => {
        const recon = computeReconStatus(r, statCoverageKeys, supplyMismatchKeys);
        const row: Record<string, string | number> = { '#': i + 1 };
        if (showHospitalInReports) {
          row['المستشفى'] = r.hospital?.name || '—';
        }
        Object.assign(row, {
          'اسم المريض': r.dialysisPatient?.fullName || '—',
          'الصالة': r.location?.hallName || '—',
          'السرير': r.location?.bedCode || '—',
          'تاريخ الجلسة': formatDialysisCalendarDate(r.sessionDate),
          'الوقت': r.startedAt ? dayjs(r.startedAt).format('HH:mm') : '—',
          'النوبة': SHIFT_LABEL_AR[(r.shift || '').toUpperCase()] || '—',
          'نوع الجلسة': INTAKE_LABEL_AR[r.intakeKind || ''] || '—',
          'الحالة': STATUS_LABEL_AR[(r.status || '').toUpperCase()] || r.status || '—',
          'اسم الموظف': sessionCreatorDisplayName(r),
          'طريقة الإدخال': patientMatchLabel(r.patientMatchMethod),
          'مطابقة الإحصاء': reconPrintSymbol(recon),
          'ملاحظات': r.notes || '—',
        });
        return row;
      });
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(sheetRows);
      XLSX.utils.book_append_sheet(wb, ws, 'جلسات');
      XLSX.writeFile(wb, `dialysis-report-${dayjs().format('YYYY-MM-DD-HH-mm')}.xlsx`);
    } catch {
      message.error('فشل تصدير Excel');
    } finally {
      setReportLoading(false);
    }
  }, [
    reportBaseParams,
    filterPatientMatch,
    filterRecon,
    statCoverageKeys,
    supplyMismatchKeys,
    showHospitalInReports,
    setReportLoading,
  ]);

  const printReport = useCallback(
    async (openPrintDialog = true) => {
      if (!reportBaseParams) return;
      setReportLoading(true);
      try {
        const all = await fetchAllReportSessions(reportBaseParams);
        const rows = applyClientReportFilters(
          all,
          filterPatientMatch,
          filterRecon,
          statCoverageKeys,
          supplyMismatchKeys
        );
        const html = buildPrintReportDocumentHtml(false, rows);
        const w = window.open('', '_blank');
        if (!w) {
          message.error('المتصفح منع نافذة الطباعة.');
          return;
        }
        w.document.open();
        w.document.write(html);
        w.document.close();
        w.focus();
        if (openPrintDialog) {
          setTimeout(() => w.print(), 250);
        }
      } catch {
        message.error('فشل تجهيز الطباعة');
      } finally {
        setReportLoading(false);
      }
    },
    [
      reportBaseParams,
      filterPatientMatch,
      filterRecon,
      statCoverageKeys,
      supplyMismatchKeys,
      buildPrintReportDocumentHtml,
      setReportLoading,
    ]
  );

  const downloadReportPdf = useCallback(async () => {
    if (!reportBaseParams) return;
    setPdfLoading(true);
    setPdfExportOpen(true);
    setPdfExportStep(8);
    try {
      setPdfExportStep(12);
      const all = await fetchAllReportSessions(reportBaseParams);
      setPdfExportStep(28);
      const rows = applyClientReportFilters(
        all,
        filterPatientMatch,
        filterRecon,
        statCoverageKeys,
        supplyMismatchKeys
      );
      setPdfExportStep(48);
      const html = buildPrintReportDocumentHtml(true, rows);
      setPdfExportStep(72);
      const filename = `dialysis-report-${reportDateFrom.format('YYYYMMDD')}-${reportDateTo.format('YYYYMMDD')}.pdf`;
      setPdfExportStep(85);
      await downloadDialysisPrintHtmlAsPdf(html, filename);
      setPdfExportStep(100);
      message.success('تم تنزيل PDF بنجاح');
    } catch (error) {
      reportClientError(error, {
        feature: 'dialysis_report_pdf',
        date_from: reportDateFrom.format('YYYY-MM-DD'),
        date_to: reportDateTo.format('YYYY-MM-DD'),
      });
      console.error('Dialysis report PDF export failed:', error);
      message.error(
        error instanceof Error && error.message
          ? `فشل تنزيل PDF: ${error.message}`
          : 'فشل تنزيل PDF. حاول مرة أخرى أو استخدم «طباعة / حفظ PDF».'
      );
    } finally {
      setPdfLoading(false);
      window.setTimeout(() => {
        setPdfExportOpen(false);
        setPdfExportStep(0);
      }, 600);
    }
  }, [
    reportBaseParams,
    filterPatientMatch,
    filterRecon,
    statCoverageKeys,
    supplyMismatchKeys,
    buildPrintReportDocumentHtml,
    reportDateFrom,
    reportDateTo,
  ]);

  return {
    exportReportExcel,
    printReport,
    downloadReportPdf,
    buildPrintReportDocumentHtml,
    mapPrintSessionRowsHtml,
    pdfExportOpen,
    pdfExportStep,
    pdfLoading,
    reportHospitalLabel,
    reportPrintFilters,
    activeExtraFilterCount,
  };
}
