import {
  DIALYSIS_MINISTRY_LINE,
  DIALYSIS_SYSTEM_TITLE,
  dialysisLogoAbsoluteUrl,
} from './dialysisBrand';

export interface DialysisPrintFilterChip {
  label: string;
  value: string;
}

export interface DialysisPrintHeaderOptions {
  reportTitle: string;
  reportSubtitle?: string;
  hospitalLabel: string;
  filters: DialysisPrintFilterChip[];
  printedAt: string;
  sessionCount?: number;
  logoUrl?: string;
}

export function escapeDialysisPrintHtml(v: string): string {
  return v
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/** أنماط رأس التقرير المطبوع — تُضمَّن داخل &lt;style&gt; نافذة الطباعة */
export const DIALYSIS_PRINT_HEADER_CSS = `
.dialysis-print-header{
  margin-bottom:18px;
  padding:16px 18px 14px;
  border:2px solid #157c67;
  border-radius:16px;
  background:linear-gradient(165deg,#f0fdf9 0%,#fff 42%,#f8fafc 100%);
  break-inside:avoid-page;
}
.dialysis-print-header-top{
  display:flex;
  gap:16px;
  align-items:center;
  padding-bottom:12px;
  border-bottom:2px solid #bae6fd;
  margin-bottom:12px;
}
.dialysis-print-logo-wrap{
  flex-shrink:0;
  width:76px;height:76px;
  display:flex;align-items:center;justify-content:center;
  background:#fff;border-radius:50%;
  border:2px solid #157c67;
  box-shadow:0 4px 14px rgba(21,124,103,.18);
  animation:dialysis-print-logo-pulse 3.2s ease-in-out infinite;
}
.dialysis-print-logo{width:58px;height:58px;object-fit:contain}
@keyframes dialysis-print-logo-pulse{
  0%,100%{transform:scale(1)}
  50%{transform:scale(1.06)}
}
.dialysis-print-titles{flex:1;min-width:0}
.dialysis-print-ministry{
  font-size:11px;font-weight:700;color:#157c67;
  letter-spacing:.02em;margin-bottom:4px;
}
.dialysis-print-system{
  font-size:13px;font-weight:800;color:#0c4a6e;margin-bottom:2px;
}
.dialysis-print-title{
  margin:0;font-size:20px;font-weight:900;color:#134e7c;line-height:1.25;
}
.dialysis-print-subtitle{
  margin:6px 0 0;font-size:12px;color:#64748b;line-height:1.45;
}
.dialysis-print-scope{
  display:flex;flex-wrap:wrap;gap:10px;margin-bottom:12px;
}
.dialysis-print-scope-card{
  flex:1 1 220px;
  padding:10px 14px;
  border-radius:12px;
  border:1px solid #a7f3d0;
  background:linear-gradient(135deg,#ecfdf5,#fff);
}
.dialysis-print-scope-card .label{
  display:block;font-size:10px;font-weight:700;color:#047857;
  text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px;
}
.dialysis-print-scope-card .value{
  display:block;font-size:14px;font-weight:800;color:#064e3b;line-height:1.35;
}
.dialysis-print-filters h3{
  margin:0 0 8px;font-size:12px;font-weight:800;color:#0c4a6e;
}
.dialysis-print-filter-grid{
  display:grid;
  grid-template-columns:repeat(auto-fill,minmax(140px,1fr));
  gap:8px;
}
.dialysis-print-filter-chip{
  padding:7px 10px;
  border-radius:10px;
  border:1px solid #dbeafe;
  background:#fff;
}
.dialysis-print-filter-chip .l{
  display:block;font-size:9px;font-weight:700;color:#64748b;margin-bottom:2px;
}
.dialysis-print-filter-chip .v{
  display:block;font-size:11px;font-weight:700;color:#0f172a;word-break:break-word;
}
.dialysis-print-meta{
  margin-top:10px;padding-top:8px;
  border-top:1px dashed #cbd5e1;
  font-size:10px;color:#64748b;
  display:flex;flex-wrap:wrap;gap:8px 16px;
}
.dialysis-print-meta strong{color:#334155}
`;

export function buildDialysisPrintHeaderHtml(opts: DialysisPrintHeaderOptions): string {
  const esc = escapeDialysisPrintHtml;
  const logo = esc(opts.logoUrl ?? dialysisLogoAbsoluteUrl());
  const filterHtml =
    opts.filters.length > 0
      ? opts.filters
          .map(
            (f) =>
              `<div class="dialysis-print-filter-chip"><span class="l">${esc(f.label)}</span><span class="v">${esc(f.value)}</span></div>`
          )
          .join('')
      : '<div class="dialysis-print-filter-chip"><span class="l">الفلاتر</span><span class="v">بدون فلتر إضافي — كل البيانات في الفترة</span></div>';

  const countLine =
    opts.sessionCount != null
      ? `<span><strong>عدد الجلسات في التقرير:</strong> ${opts.sessionCount}</span>`
      : '';

  return `
<header class="dialysis-print-header" dir="rtl">
  <div class="dialysis-print-header-top">
    <div class="dialysis-print-logo-wrap">
      <img class="dialysis-print-logo" src="${logo}" alt="${esc(DIALYSIS_SYSTEM_TITLE)}" />
    </div>
    <div class="dialysis-print-titles">
      <div class="dialysis-print-ministry">${esc(DIALYSIS_MINISTRY_LINE)}</div>
      <div class="dialysis-print-system">${esc(DIALYSIS_SYSTEM_TITLE)}</div>
      <h1 class="dialysis-print-title">${esc(opts.reportTitle)}</h1>
      ${opts.reportSubtitle ? `<p class="dialysis-print-subtitle">${esc(opts.reportSubtitle)}</p>` : ''}
    </div>
  </div>
  <div class="dialysis-print-scope">
    <div class="dialysis-print-scope-card">
      <span class="label">المستشفى / نطاق العرض</span>
      <span class="value">${esc(opts.hospitalLabel)}</span>
    </div>
  </div>
  <div class="dialysis-print-filters">
    <h3>معايير التقرير والفلاتر</h3>
    <div class="dialysis-print-filter-grid">${filterHtml}</div>
  </div>
  <div class="dialysis-print-meta">
    <span><strong>وقت الطباعة:</strong> ${esc(opts.printedAt)}</span>
    ${countLine}
  </div>
</header>`;
}
