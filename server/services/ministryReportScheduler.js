const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const logger = require('../utils/logger');
const { buildMinistrySummary } = require('../utils/dialysisMinistrySummary');

function parseCalendarDateForDb(ymd) {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function defaultWeeklyRange() {
  const to = new Date();
  to.setUTCHours(0, 0, 0, 0);
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - 6);
  return { from, to };
}

async function writeMinistrySummaryWorkbook(workbook, summary) {
  const wsKpi = workbook.addWorksheet('مؤشرات');
  wsKpi.views = [{ rightToLeft: true }];
  wsKpi.columns = [
    { header: 'المؤشر', key: 'label', width: 32 },
    { header: 'القيمة', key: 'value', width: 18 },
  ];
  wsKpi.getRow(1).font = { bold: true };

  const k = summary.kpis || {};
  const kpiRows = [
    ['الفترة من', summary.period?.from],
    ['الفترة إلى', summary.period?.to],
    ['إجمالي الجلسات', k.total ?? 0],
    ['مرضى فريدون', k.uniquePatients ?? 0],
    ['جلسات منتهية', k.completed ?? 0],
    ['صباحي', k.morning ?? 0],
    ['مسائي', k.evening ?? 0],
    ['سطور السجل الإحصائي', k.statisticalEntries ?? 0],
    ['تغطية الإحصاء %', k.statCoveragePct ?? 0],
    ['مطابقة إحصاء', k.reconMatched ?? 0],
    ['ناقص في الإحصاء', k.reconMissing ?? 0],
  ];
  for (const [label, value] of kpiRows) {
    wsKpi.addRow({ label, value });
  }

  const wsH = workbook.addWorksheet('حسب المستشفى');
  wsH.views = [{ rightToLeft: true }];
  wsH.columns = [
    { header: 'المستشفى', key: 'name', width: 28 },
    { header: 'الرمز', key: 'code', width: 14 },
    { header: 'مرضى مسجلون', key: 'registeredPatients', width: 14 },
    { header: 'جلسات', key: 'sessionsTotal', width: 10 },
    { header: 'منتهية', key: 'sessionsCompleted', width: 10 },
    { header: 'صباحي', key: 'morning', width: 10 },
    { header: 'مسائي', key: 'evening', width: 10 },
    { header: 'سطور إحصاء', key: 'statisticalEntries', width: 12 },
    { header: 'تغطية %', key: 'statCoveragePct', width: 10 },
    { header: 'مطابقة', key: 'reconMatched', width: 10 },
    { header: 'ناقص', key: 'reconMissing', width: 10 },
  ];
  wsH.getRow(1).font = { bold: true };
  for (const row of summary.byHospital || []) {
    wsH.addRow(row);
  }
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {number[]} hospitalIds
 * @param {Date} from
 * @param {Date} to
 */
async function generateMinistryExcelBuffer(prisma, hospitalIds, from, to) {
  const summary = await buildMinistrySummary(prisma, hospitalIds, from, to);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'D-IRS';
  workbook.created = new Date();
  await writeMinistrySummaryWorkbook(workbook, summary);
  return workbook.xlsx.writeBuffer();
}

/**
 * Weekly archive for all active hospitals (optional cron).
 */
async function archiveWeeklyMinistryReport(prisma) {
  const hospitals = await prisma.hospital.findMany({
    where: { isActive: 1 },
    select: { id: true },
    orderBy: { id: 'asc' },
  });
  const ids = hospitals.map((h) => h.id);
  if (!ids.length) return null;

  const { from, to } = defaultWeeklyRange();
  const buffer = await generateMinistryExcelBuffer(prisma, ids, from, to);
  const dir = path.join(__dirname, '../../uploads/ministry-reports');
  fs.mkdirSync(dir, { recursive: true });
  const stamp = to.toISOString().slice(0, 10);
  const filePath = path.join(dir, `ministry-weekly-${stamp}.xlsx`);
  fs.writeFileSync(filePath, buffer);
  logger.info(`Ministry weekly report archived: ${filePath}`);
  return filePath;
}

function registerMinistryReportScheduler(prisma) {
  const schedule = process.env.DIALYSIS_MINISTRY_REPORT_CRON;
  if (!schedule) return;

  try {
    const cron = require('node-cron');
    cron.schedule(schedule, async () => {
      try {
        await archiveWeeklyMinistryReport(prisma);
      } catch (err) {
        logger.error('Ministry scheduled report failed:', err);
      }
    });
    logger.info(`Ministry report scheduler: ${schedule}`);
  } catch (err) {
    logger.error('Failed to register ministry report scheduler:', err);
  }
}

module.exports = {
  parseCalendarDateForDb,
  writeMinistrySummaryWorkbook,
  generateMinistryExcelBuffer,
  archiveWeeklyMinistryReport,
  registerMinistryReportScheduler,
};
