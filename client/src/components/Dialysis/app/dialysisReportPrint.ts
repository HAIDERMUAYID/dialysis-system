import type { ReconRowStatus } from './pages/reportSessionDisplay';
import { buildReportPatientPrintHtml } from './pages/reportSessionDisplay';

export type PrintBadgeTone = 'blue' | 'green' | 'orange' | 'red' | 'purple' | 'slate' | 'teal';

export const DIALYSIS_REPORT_PRINT_CSS = `
.print-doc-accent{
  height:5px;
  border-radius:999px;
  margin:0 0 14px;
  background:linear-gradient(90deg,#0f5132 0%,#157c67 35%,#28b2e1 70%,#86efac 100%);
}
.print-hero-metrics{
  display:grid;
  grid-template-columns:repeat(5,1fr);
  gap:10px;
  margin:0 0 16px;
  break-inside:avoid-page;
}
.hero-metric{
  border-radius:14px;
  padding:12px 10px;
  text-align:center;
  border:1px solid #d1fae5;
  background:linear-gradient(165deg,#f0fdf9 0%,#fff 55%);
  box-shadow:0 2px 8px rgba(15,81,50,.06);
}
.hero-metric.primary{
  border-color:#6ee7b7;
  background:linear-gradient(165deg,#ecfdf5 0%,#d1fae5 40%,#fff 100%);
  box-shadow:0 4px 14px rgba(21,124,103,.12);
}
.hero-metric .v{
  display:block;
  font-size:24px;
  font-weight:900;
  color:#065f46;
  line-height:1.1;
}
.hero-metric.primary .v{color:#047857;font-size:28px}
.hero-metric .l{
  display:block;
  margin-top:4px;
  font-size:10px;
  font-weight:700;
  color:#64748b;
  line-height:1.35;
}
.print-kpi-dashboard{
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:10px;
  margin:0 0 16px;
}
.print-kpi-section{
  break-inside:avoid-page;
  border:1px solid #e2e8f0;
  border-radius:14px;
  padding:11px 12px;
  background:#fff;
  box-shadow:0 1px 4px rgba(15,23,42,.04);
}
.print-kpi-section h4{
  margin:0 0 9px;
  font-size:11px;
  font-weight:800;
  color:#0f5132;
  padding-bottom:6px;
  border-bottom:2px solid #a7f3d0;
}
.print-kpi-row{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}
.kpi.compact{
  border:1px solid #f1f5f9;
  border-radius:10px;
  padding:8px 5px;
  text-align:center;
  background:linear-gradient(180deg,#fafafa 0%,#fff 100%);
}
.kpi.compact .n{font-size:18px;font-weight:900;color:#157c67;line-height:1.1}
.kpi.compact .l{font-size:9px;color:#64748b;margin-top:3px;font-weight:600;line-height:1.3}
.print-section-head{
  display:flex;
  align-items:flex-end;
  justify-content:space-between;
  gap:10px;
  margin:0 0 10px;
  padding-bottom:8px;
  border-bottom:2px solid #e2e8f0;
}
.print-section-head h3{
  margin:0;
  font-size:15px;
  font-weight:900;
  color:#0f5132;
  position:relative;
  padding-right:12px;
}
.print-section-head h3::before{
  content:'';
  position:absolute;
  right:0;
  top:2px;
  bottom:2px;
  width:4px;
  border-radius:999px;
  background:linear-gradient(180deg,#157c67,#28b2e1);
}
.print-section-head .sub{
  font-size:10px;
  color:#64748b;
  font-weight:600;
}
.print-section-head .count-pill{
  font-size:10px;
  font-weight:800;
  color:#065f46;
  background:#ecfdf5;
  border:1px solid #a7f3d0;
  border-radius:999px;
  padding:4px 10px;
  white-space:nowrap;
}
.print-charts-title{
  font-size:14px;
  font-weight:900;
  color:#0f5132;
  margin:6px 0 12px;
  padding:8px 12px;
  border-radius:10px;
  background:linear-gradient(90deg,#ecfdf5,#f8fafc);
  border:1px solid #d1fae5;
}
.print-charts-row{
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:12px;
  margin-bottom:12px;
  break-inside:avoid-page;
}
.print-charts-row.three{grid-template-columns:1fr 1fr 1fr}
.print-charts-row.single{grid-template-columns:1fr;max-width:440px;margin-inline:auto}
.chart-box{
  border:1px solid #e2e8f0;
  border-radius:14px;
  padding:12px 14px;
  background:linear-gradient(180deg,#fafafa 0%,#fff 100%);
  break-inside:avoid;
  box-shadow:0 2px 10px rgba(15,23,42,.05);
}
.chart-box h4{
  margin:0 0 10px;
  font-size:11px;
  font-weight:800;
  color:#134e4a;
  padding-bottom:6px;
  border-bottom:1px solid #f1f5f9;
}
.chart-empty{margin:10px 0;color:#94a3b8;font-size:10px;text-align:center}
.hbar-chart{width:100%}
.hbar-row{display:flex;align-items:center;gap:8px;margin:7px 0;font-size:10px}
.hbar-name{flex:0 0 88px;text-align:end;color:#334155;word-break:break-word;font-weight:600}
.hbar-track{flex:1;height:14px;background:#f1f5f9;border-radius:999px;overflow:hidden;min-width:36px}
.hbar-fill{height:100%;border-radius:999px;min-width:2px}
.hbar-num{flex:0 0 24px;font-weight:900;text-align:start;color:#0f172a;font-size:10px}
.pie-wrap{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:12px}
.pie-legend{display:flex;flex-direction:column;gap:5px;font-size:9px;color:#334155}
.pie-legend span{display:flex;align-items:center;gap:6px;font-weight:600}
.pie-legend i{width:10px;height:10px;border-radius:3px;flex-shrink:0}
.trend-svg{display:block;max-width:100%;margin:0 auto}
.sec{margin-top:16px;break-inside:avoid-page}
.sec.sessions{margin-top:20px}
.divider{
  height:3px;
  border:0;
  background:linear-gradient(90deg,#157c67,#28b2e1,#e2e8f0);
  border-radius:999px;
  margin:18px 0;
}
.sessions-table-wrap{
  border:1px solid #e2e8f0;
  border-radius:14px;
  overflow:hidden;
  box-shadow:0 2px 12px rgba(15,23,42,.05);
  background:#fff;
}
table.data{
  width:100%;
  border-collapse:collapse;
  page-break-inside:auto;
  font-size:10px;
}
table.data thead{display:table-header-group}
table.data tbody tr:nth-child(even){background:#f8fafc}
table.data tbody tr:hover{background:#f0fdf9}
table.data th,table.data td{
  border-bottom:1px solid #eef2f7;
  padding:6px 7px;
  vertical-align:middle;
  font-family:'Cairo',Tahoma,'Segoe UI',Arial,sans-serif;
  letter-spacing:normal;
  word-spacing:normal;
}
table.data th{
  background:#157c67;
  color:#fff;
  font-weight:700;
  font-size:9px;
  border-bottom:none;
  white-space:nowrap;
  text-align:center;
}
table.data td.tc{text-align:center;font-weight:800;color:#64748b;width:28px}
table.data td.recon-cell{text-align:center;width:36px}
.patient-cell{display:flex;align-items:center;gap:7px;min-width:0}
.patient-photo{
  width:28px;height:28px;border-radius:50%;
  object-fit:cover;border:2px solid #e2e8f0;flex-shrink:0;background:#f8fafc;
}
.patient-photo--empty{
  display:inline-block;width:28px;height:28px;border-radius:50%;
  background:linear-gradient(135deg,#e2e8f0,#f1f5f9);
}
.patient-name{font-weight:700;color:#0f172a;word-break:break-word;line-height:1.3;font-size:10px}
.pb{
  display:inline-block;
  padding:2px 7px;
  border-radius:999px;
  font-size:9px;
  font-weight:800;
  line-height:1.35;
  white-space:nowrap;
}
.pb-blue{color:#1d4ed8;background:#dbeafe;border:1px solid #bfdbfe}
.pb-green{color:#047857;background:#d1fae5;border:1px solid #a7f3d0}
.pb-orange{color:#c2410c;background:#ffedd5;border:1px solid #fed7aa}
.pb-red{color:#b91c1c;background:#fee2e2;border:1px solid #fecaca}
.pb-purple{color:#6d28d9;background:#ede9fe;border:1px solid #ddd6fe}
.pb-slate{color:#475569;background:#f1f5f9;border:1px solid #e2e8f0}
.pb-teal{color:#0f766e;background:#ccfbf1;border:1px solid #99f6e4}
.recon-badge{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  width:22px;height:22px;
  border-radius:50%;
  font-size:12px;
  font-weight:900;
  line-height:1;
}
.recon-badge.ok{color:#047857;background:#d1fae5;border:1px solid #6ee7b7}
.recon-badge.bad{color:#c2410c;background:#ffedd5;border:1px solid #fdba74}
.recon-badge.warn{color:#b91c1c;background:#fee2e2;border:1px solid #fca5a5}
.recon-badge.na{color:#64748b;background:#f1f5f9;border:1px solid #e2e8f0}
.two{display:grid;grid-template-columns:1fr 1fr;gap:12px}
body.pdf-capture .print-hero-metrics{grid-template-columns:repeat(5,1fr)}
body.pdf-capture .hero-metric .v{font-size:22px}
body.pdf-capture .hero-metric.primary .v{font-size:24px}
body.pdf-capture table.data{font-size:9px}
body.pdf-capture table.data th{font-size:8px}
`;

export function buildPrintBadge(
  label: string,
  tone: PrintBadgeTone,
  esc: (s: string) => string
): string {
  return `<span class="pb pb-${tone}">${esc(label)}</span>`;
}

export function intakePrintTone(kind: string): PrintBadgeTone {
  if (kind === 'SCHEDULED') return 'blue';
  if (kind === 'OFF_SCHEDULE') return 'orange';
  if (kind === 'EMERGENCY') return 'red';
  return 'slate';
}

export function statusPrintTone(status: string): PrintBadgeTone {
  const st = status.toUpperCase();
  if (st === 'COMPLETED') return 'green';
  if (st === 'ACTIVE') return 'teal';
  if (st === 'CANCELLED') return 'slate';
  return 'blue';
}

export function matchPrintTone(method?: string | null): PrintBadgeTone {
  return method === 'FACE' ? 'purple' : 'slate';
}

export function buildPrintReconCell(recon: ReconRowStatus, esc: (s: string) => string): string {
  const sym = esc(
    recon === 'matched' ? '✓' : recon === 'missing' ? '✗' : recon === 'supply' ? '!' : '—'
  );
  const cls =
    recon === 'matched' ? 'ok' : recon === 'missing' ? 'bad' : recon === 'supply' ? 'warn' : 'na';
  return `<span class="recon-badge ${cls}">${sym}</span>`;
}

export function buildPrintHeroMetrics(
  metrics: { value: string | number; label: string; primary?: boolean }[],
  esc: (s: string) => string
): string {
  const cells = metrics
    .map(
      (m) =>
        `<div class="hero-metric${m.primary ? ' primary' : ''}"><span class="v">${esc(String(m.value))}</span><span class="l">${esc(m.label)}</span></div>`
    )
    .join('');
  return `<div class="print-hero-metrics">${cells}</div>`;
}

export function buildPrintKpiSection(
  title: string,
  cards: { n: string | number; l: string }[],
  esc: (s: string) => string
): string {
  const cells = cards
    .map(
      (c) =>
        `<div class="kpi compact"><div class="n">${esc(String(c.n))}</div><div class="l">${esc(c.l)}</div></div>`
    )
    .join('');
  return `<div class="print-kpi-section"><h4>${esc(title)}</h4><div class="print-kpi-row">${cells}</div></div>`;
}

export function buildPrintKpiDashboard(sectionsHtml: string): string {
  return `<div class="print-kpi-dashboard">${sectionsHtml}</div>`;
}

export function buildPrintSectionHead(
  title: string,
  esc: (s: string) => string,
  opts?: { subtitle?: string; count?: number | string }
): string {
  const sub = opts?.subtitle ? `<span class="sub">${esc(opts.subtitle)}</span>` : '';
  const count =
    opts?.count != null
      ? `<span class="count-pill">${esc(String(opts.count))} جلسة</span>`
      : '';
  return `<div class="print-section-head"><div><h3>${esc(title)}</h3>${sub}</div>${count}</div>`;
}

export interface PrintSessionRowInput {
  index: number;
  hospitalName?: string;
  patientName: string;
  patientPhotoUrl?: string | null;
  hall: string;
  bed: string;
  date: string;
  time: string;
  shift: string;
  intakeKind: string;
  intakeLabel: string;
  status: string;
  statusLabel: string;
  creator: string;
  matchMethod?: string | null;
  matchLabel: string;
  recon: ReconRowStatus;
  notes: string;
  showHospital: boolean;
}

export function buildPrintSessionRowHtml(
  r: PrintSessionRowInput,
  esc: (s: string) => string
): string {
  const patient = buildReportPatientPrintHtml(r.patientName, r.patientPhotoUrl, esc);
  const hospCell = r.showHospital ? `<td>${esc(r.hospitalName || '—')}</td>` : '';
  const rowClass = r.index % 2 === 0 ? ' class="row-even"' : '';
  return `<tr${rowClass}>
    <td class="tc">${r.index}</td>
    ${hospCell}
    <td>${patient}</td>
    <td>${esc(r.hall)}</td>
    <td>${esc(r.bed)}</td>
    <td>${esc(r.date)}</td>
    <td>${esc(r.time)}</td>
    <td>${esc(r.shift)}</td>
    <td>${buildPrintBadge(r.intakeLabel, intakePrintTone(r.intakeKind), esc)}</td>
    <td>${buildPrintBadge(r.statusLabel, statusPrintTone(r.status), esc)}</td>
    <td>${esc(r.creator)}</td>
    <td>${buildPrintBadge(r.matchLabel, matchPrintTone(r.matchMethod), esc)}</td>
    <td class="recon-cell">${buildPrintReconCell(r.recon, esc)}</td>
    <td>${esc(r.notes)}</td>
  </tr>`;
}
