import {
  buildDialysisPrintHeaderHtml,
  DIALYSIS_PRINT_BASE_CSS,
  DIALYSIS_PRINT_FONT_TAGS,
  DIALYSIS_PRINT_HEADER_CSS,
  DIALYSIS_PRINT_SIGNATURE_CSS,
  DIALYSIS_PRINT_SIGNATURE_HTML,
  downloadDialysisPrintHtmlAsPdf,
  escapeDialysisPrintHtml,
} from '../../dialysisPrint';
import { getHospitalScopeLabel } from '../../dialysisBrand';
import type { MinistryDashboardSummary } from './ministryDashboardTypes';

function esc(v: string | number | null | undefined): string {
  return escapeDialysisPrintHtml(String(v ?? '—'));
}

export async function exportMinistryDashboardPdf(options: {
  summary: MinistryDashboardSummary;
  hospitalId: import('../../dialysisContext').DialysisHospitalScope | null;
  hospitals: Array<{ id: number; name: string; code?: string | null }>;
  printedBy?: string;
}): Promise<void> {
  const { summary, hospitalId, hospitals, printedBy } = options;
  const k = summary.kpis;
  const periodLabel = `${summary.period.from} → ${summary.period.to}`;

  const kpiGrid = k
    ? `
    <div class="d-ministry-kpi-grid">
      ${[
        ['إجمالي الجلسات', k.total],
        ['مرضى فريدون', k.uniquePatients],
        ['منتهية', k.completed],
        ['صباحي', k.morning],
        ['مسائي', k.evening],
        ['سطور الإحصاء', k.statisticalEntries],
        ['تغطية الإحصاء %', k.statCoveragePct],
        ['مطابقة', k.reconMatched],
        ['ناقص إحصاء', k.reconMissing],
      ]
        .map(
          ([label, val]) =>
            `<div class="d-ministry-kpi"><span class="l">${esc(label)}</span><span class="v">${esc(val)}</span></div>`
        )
        .join('')}
    </div>`
    : '<p>لا توجد بيانات KPI</p>';

  const hospitalRows = (summary.byHospital || [])
    .map(
      (h) => `<tr>
        <td>${esc(h.name)}</td>
        <td>${esc(h.code)}</td>
        <td>${esc(h.sessionsTotal)}</td>
        <td>${esc(h.uniquePatients)}</td>
        <td>${esc(h.statisticalEntries)}</td>
        <td>${esc(h.statCoveragePct)}%</td>
        <td>${esc(h.reconMissing)}</td>
      </tr>`
    )
    .join('');

  const body = `
<style>
${DIALYSIS_PRINT_HEADER_CSS}
${DIALYSIS_PRINT_BASE_CSS}
${DIALYSIS_PRINT_SIGNATURE_CSS}
.d-ministry-kpi-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:16px 0}
.d-ministry-kpi{border:1px solid #e2e8f0;border-radius:10px;padding:10px;background:#f8fafc}
.d-ministry-kpi .l{display:block;font-size:10px;color:#64748b;font-weight:700}
.d-ministry-kpi .v{display:block;font-size:16px;font-weight:900;color:#0f5132;margin-top:4px}
.d-ministry-table{width:100%;border-collapse:collapse;margin-top:12px;font-size:11px}
.d-ministry-table th,.d-ministry-table td{border:1px solid #cbd5e1;padding:6px 8px;text-align:right}
.d-ministry-table th{background:#ecfdf5;color:#065f46;font-weight:800}
</style>
${DIALYSIS_PRINT_FONT_TAGS}
<div dir="rtl" lang="ar">
${buildDialysisPrintHeaderHtml({
  reportTitle: 'لوحة مؤشرات الوزارة — وحدة الغسل الكلوي',
  reportSubtitle: 'تقرير مجمّع للفترة المحددة — جاهز للتقديم الرسمي',
  hospitalLabel: getHospitalScopeLabel(hospitalId, hospitals),
  filters: [{ label: 'الفترة', value: periodLabel }],
  printedAt: new Date().toLocaleString('ar-IQ'),
  printedBy,
})}
<section style="padding:0 18px 18px">
  <h2 style="font-size:14px;color:#0f5132;margin:0 0 8px">المؤشرات الإجمالية</h2>
  ${kpiGrid}
  <h2 style="font-size:14px;color:#0f5132;margin:18px 0 8px">تفصيل حسب المستشفى</h2>
  <table class="d-ministry-table">
    <thead>
      <tr>
        <th>المستشفى</th>
        <th>الرمز</th>
        <th>جلسات</th>
        <th>مرضى</th>
        <th>سطور إحصاء</th>
        <th>تغطية %</th>
        <th>ناقص</th>
      </tr>
    </thead>
    <tbody>${hospitalRows || '<tr><td colspan="7">—</td></tr>'}</tbody>
  </table>
</section>
${DIALYSIS_PRINT_SIGNATURE_HTML}
</div>`;

  await downloadDialysisPrintHtmlAsPdf(
    body,
    `ministry-dialysis-${summary.period.from}_${summary.period.to}.pdf`
  );
}
