import type { PrintSlice } from './reportsPageTypes';

function svgEscapeText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function buildPrintPieSvg(slices: PrintSlice[], colors: string[], size = 128): string {
  const active = slices.filter((s) => s.value > 0);
  const total = active.reduce((a, b) => a + b.value, 0);
  if (total <= 0) return '<p class="chart-empty">لا بيانات</p>';
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.36;
  let angle = -Math.PI / 2;
  let paths = '';
  let idx = 0;
  for (const sl of active) {
    const frac = sl.value / total;
    const a = frac * 2 * Math.PI;
    const x1 = cx + r * Math.cos(angle);
    const y1 = cy + r * Math.sin(angle);
    angle += a;
    const x2 = cx + r * Math.cos(angle);
    const y2 = cy + r * Math.sin(angle);
    const largeArc = a > Math.PI ? 1 : 0;
    const c = colors[idx % colors.length];
    paths += `<path d="M ${cx} ${cy} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z" fill="${c}" stroke="#fff" stroke-width="1.2"/>`;
    idx += 1;
  }
  let leg = '<div class="pie-legend">';
  idx = 0;
  for (const sl of active) {
    const c = colors[idx % colors.length];
    leg += `<span><i style="background:${c}"></i>${svgEscapeText(sl.name)}: <b>${sl.value}</b></span>`;
    idx += 1;
  }
  leg += '</div>';
  return `<div class="pie-wrap"><svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">${paths}</svg>${leg}</div>`;
}

export function buildPrintHBars(
  rows: PrintSlice[],
  colors: string[],
  esc: (s: string) => string
): string {
  if (!rows.length) return '<p class="chart-empty">لا بيانات</p>';
  const max = Math.max(...rows.map((x) => x.value), 1);
  let html = '<div class="hbar-chart">';
  rows.forEach((row, i) => {
    const pct = (row.value / max) * 100;
    const c = colors[i % colors.length];
    html += `<div class="hbar-row"><span class="hbar-name">${esc(row.name)}</span><div class="hbar-track"><div class="hbar-fill" style="width:${pct}%;background:${c}"></div></div><span class="hbar-num">${row.value}</span></div>`;
  });
  html += '</div>';
  return html;
}

export function buildPrintTrendSvg(rows: { month: string; total: number }[], w = 380, h = 130): string {
  if (!rows.length) return '<p class="chart-empty">لا بيانات</p>';
  const max = Math.max(...rows.map((r) => r.total), 1);
  const padL = 26;
  const padR = 10;
  const padT = 10;
  const padB = 22;
  const iw = w - padL - padR;
  const ih = h - padT - padB;
  const n = rows.length;
  const coords = rows.map((row, i) => {
    const x = padL + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw);
    const y = padT + ih - (row.total / max) * ih;
    return { x, y, m: row.month };
  });
  const x0 = coords[0].x;
  const xLast = coords[coords.length - 1].x;
  const yb = padT + ih;
  const areaD = `M ${x0} ${yb} L ${coords.map((c) => `${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' L ')} L ${xLast} ${yb} Z`;
  const linePoints = coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
  const labels = coords
    .map(
      (c) =>
        `<text x="${c.x}" y="${h - 4}" text-anchor="middle" font-size="9" fill="#64748b">${svgEscapeText(c.m)}</text>`
    )
    .join('');
  return `<svg class="trend-svg" width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="pgf" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#6366f1" stop-opacity="0.42"/><stop offset="100%" stop-color="#6366f1" stop-opacity="0.04"/></linearGradient></defs><path d="${areaD}" fill="url(#pgf)"/><polyline points="${linePoints}" fill="none" stroke="#6366f1" stroke-width="2.2"/>${labels}</svg>`;
}
