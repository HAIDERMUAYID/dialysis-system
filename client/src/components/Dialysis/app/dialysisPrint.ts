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
  align-items:flex-start;
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
.dialysis-print-titles{flex:1;min-width:0;overflow:visible}
.dialysis-print-ministry{
  font-size:11px;font-weight:700;color:#157c67;
  letter-spacing:.02em;margin-bottom:4px;
}
.dialysis-print-system{
  font-size:13px;font-weight:800;color:#0c4a6e;margin-bottom:2px;
}
.dialysis-print-title{
  margin:0;font-size:20px;font-weight:900;color:#134e7c;line-height:1.35;
  word-break:break-word;
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
  letter-spacing:0;margin-bottom:4px;
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

/** خط عربي موحّد للطباعة وPDF */
export const DIALYSIS_PRINT_FONT_TAGS = `
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap" rel="stylesheet" />
`;

export const DIALYSIS_PRINT_BASE_CSS = `
*{box-sizing:border-box}
html,body{
  font-family:'Cairo',Tahoma,'Segoe UI',Arial,sans-serif;
  background:#fff;
  color:#0f172a;
  margin:0;
  padding:14px 16px;
  font-size:12px;
  line-height:1.55;
  -webkit-font-smoothing:antialiased;
  text-rendering:optimizeLegibility;
}
`;

/** ختم HTML — أوضح للعربية من نص SVG داخل html2canvas */
export const DIALYSIS_PRINT_SIGNATURE_HTML = `
<div class="print-signature print-signature-stamp" aria-hidden="true" dir="rtl">
  <div class="print-signature-stamp__frame">
    <div class="print-signature-stamp__name">المهندس حيدر الحكيم</div>
    <div class="print-signature-stamp__line"></div>
    <div class="print-signature-stamp__role">مسؤول وحدة الحوكمة</div>
    <div class="print-signature-stamp__dept">شعبة الكلية الصناعية – مستشفى الحكيم العام</div>
  </div>
</div>`;

export const DIALYSIS_PRINT_SIGNATURE_CSS = `
.print-signature-stamp{width:220px;opacity:.78}
.print-signature-stamp__frame{
  border:3px solid #0a4fb4;
  border-radius:16px;
  padding:12px 10px;
  text-align:center;
  background:linear-gradient(180deg,#f8fbff 0%,#fff 100%);
  font-family:'Cairo',Tahoma,sans-serif;
}
.print-signature-stamp__name{
  font-size:14px;font-weight:800;color:#0a4fb4;line-height:1.45;
}
.print-signature-stamp__line{
  height:2px;margin:8px 16px;border-radius:999px;
  background:linear-gradient(90deg,transparent,#0a4fb4,transparent);
}
.print-signature-stamp__role{
  font-size:11px;font-weight:800;color:#0a4fb4;line-height:1.4;
}
.print-signature-stamp__dept{
  font-size:10px;font-weight:700;color:#1d4ed8;line-height:1.45;margin-top:4px;
}
`;

/** أنماط التقاط PDF */
export const DIALYSIS_PDF_CAPTURE_CSS = `
body.pdf-capture{
  width:794px;
  max-width:794px;
  margin:0;
  padding:18px 22px 28px;
  background:#fff;
  -webkit-print-color-adjust:exact;
  print-color-adjust:exact;
}
body.pdf-capture .preview-tools,
body.pdf-capture .print-signature-top{display:none!important}
body.pdf-capture .dialysis-print-logo-wrap{animation:none}
body.pdf-capture .dialysis-print-title{font-size:17px;line-height:1.35}
body.pdf-capture .print-signature-bottom{
  position:absolute;
  left:-9999px;
  width:200px;
  opacity:.75;
  visibility:hidden;
}
body.pdf-capture .pdf-footer-template{
  position:absolute;
  left:-9999px;
  visibility:hidden;
}
`;

const PDF_MARGIN_MM = 7;
const PDF_BLOCK_GAP_MM = 2;
const PDF_SIGNATURE_WIDTH_MM = 46;
const PDF_FOOTER_RESERVE_MM = 26;
const PDF_CAPTURE_SCALE = 2.5;
const PDF_CONTENT_WIDTH_PX = 750;

async function waitForPrintFonts(doc: Document): Promise<void> {
  try {
    await doc.fonts?.ready;
  } catch {
    /* ignore */
  }
  await new Promise((r) => setTimeout(r, 450));
}

function getOrCreateFooterHost(doc: Document): HTMLElement {
  let host = doc.getElementById('pdf-footer-capture-host') as HTMLElement | null;
  if (!host) {
    host = doc.createElement('div');
    host.id = 'pdf-footer-capture-host';
    host.style.cssText = 'position:absolute;left:0;top:0;visibility:hidden;pointer-events:none';
    doc.body.appendChild(host);
  }
  return host;
}

async function renderPdfFooterCanvas(
  doc: Document,
  html2canvas: (element: HTMLElement, options?: object) => Promise<HTMLCanvasElement>,
  footerText: string,
  pageIndex: number,
  totalPages: number
): Promise<HTMLCanvasElement | null> {
  const host = getOrCreateFooterHost(doc);
  host.innerHTML = `
<div class="pdf-footer-strip" dir="rtl" style="width:${PDF_CONTENT_WIDTH_PX}px;font-family:'Cairo',Tahoma,sans-serif;font-size:11px;color:#51657a;display:flex;justify-content:space-between;align-items:center;border-top:1px dashed #dbeaf5;padding:7px 4px 5px;background:#fff;">
  <span style="font-weight:600">${escapeDialysisPrintHtml(footerText)}</span>
  <span style="font-weight:700">صفحة ${pageIndex} من ${totalPages}</span>
</div>`;
  const el = host.firstElementChild as HTMLElement | null;
  if (!el) return null;
  const canvas = await html2canvas(el, {
    scale: PDF_CAPTURE_SCALE,
    backgroundColor: '#ffffff',
    logging: false,
  });
  return canvas.width && canvas.height ? canvas : null;
}

function collectDialysisPdfBlocks(body: HTMLElement): HTMLElement[] {
  const blocks: HTMLElement[] = [];
  for (const el of Array.from(body.children) as HTMLElement[]) {
    if (
      el.classList.contains('preview-tools') ||
      el.classList.contains('print-signature-top') ||
      el.classList.contains('print-signature-bottom') ||
      el.classList.contains('pdf-footer-template') ||
      el.classList.contains('print-footer')
    ) {
      continue;
    }
    if (el.classList.contains('print-kpi-wrap')) {
      el.querySelectorAll('.print-kpi-section').forEach((s) => blocks.push(s as HTMLElement));
      continue;
    }
    if (el.classList.contains('divider')) continue;
    if (
      el.classList.contains('dialysis-print-header') ||
      el.classList.contains('print-charts-title') ||
      el.classList.contains('print-charts-row') ||
      el.classList.contains('sec')
    ) {
      blocks.push(el);
    }
  }
  return blocks;
}

async function captureBlockCanvas(
  el: HTMLElement,
  html2canvas: (element: HTMLElement, options?: object) => Promise<HTMLCanvasElement>
): Promise<HTMLCanvasElement> {
  const canvas = await html2canvas(el, {
    scale: PDF_CAPTURE_SCALE,
    useCORS: true,
    backgroundColor: '#ffffff',
    logging: false,
  });
  if (!canvas.width || !canvas.height) {
    throw new Error('فشل التقاط قسم من التقرير');
  }
  return canvas;
}

async function captureSignatureCanvas(
  doc: Document,
  html2canvas: (element: HTMLElement, options?: object) => Promise<HTMLCanvasElement>
): Promise<HTMLCanvasElement | null> {
  const wrap = doc.querySelector('.print-signature-bottom') as HTMLElement | null;
  if (!wrap) return null;

  const prev = wrap.style.cssText;
  wrap.style.cssText =
    'position:absolute;left:0;top:0;width:200px;visibility:visible;opacity:0.75;z-index:1';

  try {
    const canvas = await html2canvas(wrap, {
      scale: PDF_CAPTURE_SCALE,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
    });
    if (!canvas.width || !canvas.height) return null;
    return canvas;
  } finally {
    wrap.style.cssText = prev;
  }
}

function canvasHeightMm(canvas: HTMLCanvasElement, widthMm: number): number {
  return (canvas.height * widthMm) / canvas.width;
}

function safeAddImage(
  pdf: import('jspdf').jsPDF,
  canvas: HTMLCanvasElement,
  x: number,
  y: number,
  widthMm: number,
  heightMm?: number
): number {
  if (!canvas.width || !canvas.height || !Number.isFinite(widthMm) || widthMm <= 0) {
    return 0;
  }
  const h = heightMm ?? canvasHeightMm(canvas, widthMm);
  if (!Number.isFinite(h) || h <= 0) return 0;
  pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', x, y, widthMm, h);
  return h;
}

function addCanvasToPdfPage(
  pdf: import('jspdf').jsPDF,
  canvas: HTMLCanvasElement,
  x: number,
  y: number,
  maxWidth: number
): number {
  return safeAddImage(pdf, canvas, x, y, maxWidth);
}

function sliceTallCanvasToPdf(
  pdf: import('jspdf').jsPDF,
  canvas: HTMLCanvasElement,
  usableW: number,
  usableH: number,
  startNewPage: boolean
): void {
  const pageCanvas = document.createElement('canvas');
  const ctx = pageCanvas.getContext('2d');
  if (!ctx) return;

  const sliceHeightPx = Math.floor((canvas.width * usableH) / usableW);
  let srcY = 0;
  let first = !startNewPage;

  while (srcY < canvas.height) {
    const sliceH = Math.min(sliceHeightPx, canvas.height - srcY);
    pageCanvas.width = canvas.width;
    pageCanvas.height = sliceH;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
    ctx.drawImage(canvas, 0, srcY, canvas.width, sliceH, 0, 0, canvas.width, sliceH);

    if (first) {
      first = false;
    } else {
      pdf.addPage();
    }

    const sliceImgH = (sliceH * usableW) / canvas.width;
    if (Number.isFinite(sliceImgH) && sliceImgH > 0) {
      safeAddImage(pdf, pageCanvas, PDF_MARGIN_MM, PDF_MARGIN_MM, usableW, sliceImgH);
    }
    srcY += sliceH;
  }
}

/** ينزّل HTML الطباعة كـ PDF — تقسيم حسب الأقسام + ختم أسفل كل صفحة */
export async function downloadDialysisPrintHtmlAsPdf(
  html: string,
  filename: string
): Promise<void> {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText =
    'position:fixed;left:-10000px;top:0;width:794px;height:2000px;border:0;visibility:hidden';
  document.body.appendChild(iframe);

  try {
    const doc = iframe.contentDocument;
    if (!doc) throw new Error('تعذر تهيئة مستند PDF');

    doc.open();
    doc.write(html);
    doc.close();

    await new Promise<void>((resolve) => {
      const done = () => resolve();
      iframe.onload = done;
      setTimeout(done, 700);
    });

    const body = doc.body;
    if (!body) throw new Error('محتوى التقرير فارغ');

    await Promise.all(
      Array.from(doc.images).map(
        (img) =>
          new Promise<void>((resolve) => {
            if (img.complete) resolve();
            else {
              img.onload = () => resolve();
              img.onerror = () => resolve();
            }
          })
      )
    );
    await waitForPrintFonts(doc);

    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
      import('html2canvas'),
      import('jspdf'),
    ]);

    const blocks = collectDialysisPdfBlocks(body);
    if (!blocks.length) throw new Error('لا توجد أقسام للتصدير');

    const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    const pageH = pdf.internal.pageSize.getHeight();
    const usableW = pdf.internal.pageSize.getWidth() - PDF_MARGIN_MM * 2;
    const usableH = pageH - PDF_MARGIN_MM * 2 - PDF_FOOTER_RESERVE_MM;

    let cursorY = PDF_MARGIN_MM;
    let pageOpen = false;

    const ensureSpace = (neededMm: number) => {
      if (!pageOpen) {
        pageOpen = true;
        cursorY = PDF_MARGIN_MM;
        return;
      }
      if (cursorY + neededMm > PDF_MARGIN_MM + usableH) {
        pdf.addPage();
        cursorY = PDF_MARGIN_MM;
      }
    };

    for (const block of blocks) {
      const canvas = await captureBlockCanvas(block, html2canvas);
      const imgH = canvasHeightMm(canvas, usableW);
      if (!Number.isFinite(imgH) || imgH <= 0) continue;

      if (imgH > usableH) {
        if (pageOpen && cursorY > PDF_MARGIN_MM) {
          pdf.addPage();
        }
        sliceTallCanvasToPdf(pdf, canvas, usableW, usableH, pageOpen);
        pageOpen = true;
        cursorY = PDF_MARGIN_MM;
        continue;
      }

      ensureSpace(imgH + PDF_BLOCK_GAP_MM);
      const drawnH = addCanvasToPdfPage(pdf, canvas, PDF_MARGIN_MM, cursorY, usableW);
      cursorY += drawnH + PDF_BLOCK_GAP_MM;
    }

    const sigCanvas = await captureSignatureCanvas(doc, html2canvas);
    let sigHm = 0;
    if (sigCanvas) {
      sigHm = canvasHeightMm(sigCanvas, PDF_SIGNATURE_WIDTH_MM);
    }

    const totalPages = pdf.getNumberOfPages();
    const footerText =
      body.querySelector('.pdf-footer-template')?.textContent?.trim() ||
      'شعبة الكلية الصناعية – وحدة الحوكمة';

    for (let i = 1; i <= totalPages; i += 1) {
      pdf.setPage(i);

      const footerCanvas = await renderPdfFooterCanvas(
        doc,
        html2canvas,
        footerText,
        i,
        totalPages
      );
      let footerHm = 0;
      if (footerCanvas) {
        footerHm = canvasHeightMm(footerCanvas, usableW);
        safeAddImage(
          pdf,
          footerCanvas,
          PDF_MARGIN_MM,
          pageH - PDF_MARGIN_MM - footerHm,
          usableW,
          footerHm
        );
      }

      if (sigCanvas && sigHm > 0) {
        safeAddImage(
          pdf,
          sigCanvas,
          PDF_MARGIN_MM,
          pageH - PDF_MARGIN_MM - footerHm - sigHm - 4,
          PDF_SIGNATURE_WIDTH_MM,
          sigHm
        );
      }
    }

    pdf.save(filename);
  } finally {
    document.body.removeChild(iframe);
  }
}

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
