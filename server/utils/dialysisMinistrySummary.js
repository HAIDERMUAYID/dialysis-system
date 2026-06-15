const { aggregateDialysisSessionKpis } = require('./dialysisSessionKpis');
const {
  aggregateReportSessionCharts,
  aggregateReportReconSummary,
  sessionDateRowToYmd,
} = require('./dialysisReportAggregates');

function hospitalClause(ids) {
  return ids.length > 1 ? { in: ids } : ids[0];
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {number[]} hospitalIds
 * @param {Date} dateFromDb
 * @param {Date} dateToDb
 */
async function buildMinistrySummary(prisma, hospitalIds, dateFromDb, dateToDb) {
  const ids = [...new Set(hospitalIds.filter((id) => Number.isFinite(id)))];
  if (!ids.length) {
    return {
      period: {
        from: sessionDateRowToYmd(dateFromDb),
        to: sessionDateRowToYmd(dateToDb),
      },
      generatedAt: new Date().toISOString(),
      kpis: null,
      byHospital: [],
      charts: { byHall: [], byHospital: [] },
    };
  }

  const sessionDateWhere = { gte: dateFromDb, lte: dateToDb };
  const overallWhere = {
    hospitalId: hospitalClause(ids),
    sessionDate: sessionDateWhere,
  };

  const [hospitals, overallKpis, charts, statEntries, patientCounts] = await Promise.all([
    prisma.hospital.findMany({
      where: { id: { in: ids }, isActive: 1 },
      select: { id: true, name: true, code: true, province: true, directorate: true },
      orderBy: { name: 'asc' },
    }),
    aggregateDialysisSessionKpis(prisma, overallWhere),
    aggregateReportSessionCharts(prisma, overallWhere),
    prisma.dialysisStatisticalEntry.findMany({
      where: {
        hospitalId: hospitalClause(ids),
        sessionDate: sessionDateWhere,
      },
      select: {
        hospitalId: true,
        dialysisPatientId: true,
        sessionDate: true,
        shift: true,
      },
    }),
    prisma.dialysisPatient.groupBy({
      by: ['hospitalId'],
      where: { hospitalId: hospitalClause(ids) },
      _count: { _all: true },
    }),
  ]);

  const patientCountByHospital = Object.fromEntries(
    patientCounts.map((g) => [g.hospitalId, g._count._all])
  );

  const coverageKeys = statEntries.map(
    (e) => `${e.dialysisPatientId}|${sessionDateRowToYmd(e.sessionDate)}|${e.shift}`
  );
  const recon = await aggregateReportReconSummary(prisma, overallWhere, coverageKeys, []);

  const statKeysByHospital = new Map();
  for (const e of statEntries) {
    if (!statKeysByHospital.has(e.hospitalId)) statKeysByHospital.set(e.hospitalId, []);
    statKeysByHospital
      .get(e.hospitalId)
      .push(`${e.dialysisPatientId}|${sessionDateRowToYmd(e.sessionDate)}|${e.shift}`);
  }

  const statCountByHospital = statEntries.reduce((acc, e) => {
    acc[e.hospitalId] = (acc[e.hospitalId] || 0) + 1;
    return acc;
  }, {});

  const byHospital = await Promise.all(
    hospitals.map(async (h) => {
      const where = { hospitalId: h.id, sessionDate: sessionDateWhere };
      const kpis = await aggregateDialysisSessionKpis(prisma, where);
      const hKeys = statKeysByHospital.get(h.id) || [];
      const hRecon = await aggregateReportReconSummary(prisma, where, hKeys, []);
      return {
        hospitalId: h.id,
        name: h.name,
        code: h.code,
        province: h.province,
        directorate: h.directorate,
        registeredPatients: patientCountByHospital[h.id] ?? 0,
        sessionsTotal: kpis.total,
        sessionsCompleted: kpis.completed,
        sessionsActive: kpis.active,
        uniquePatients: kpis.uniquePatients,
        morning: kpis.shiftMorning,
        evening: kpis.shiftEvening,
        scheduled: kpis.intakeScheduled,
        emergency: kpis.intakeEmergency,
        statisticalEntries: statCountByHospital[h.id] ?? 0,
        statCoveragePct: hRecon.statCoveragePct,
        reconMatched: hRecon.reconMatched,
        reconMissing: hRecon.reconMissing,
        reconSupply: hRecon.reconSupply,
      };
    })
  );

  return {
    period: {
      from: sessionDateRowToYmd(dateFromDb),
      to: sessionDateRowToYmd(dateToDb),
    },
    generatedAt: new Date().toISOString(),
    kpis: {
      total: overallKpis.total,
      uniquePatients: overallKpis.uniquePatients,
      completed: overallKpis.completed,
      active: overallKpis.active,
      cancelled: overallKpis.cancelled,
      morning: overallKpis.shiftMorning,
      evening: overallKpis.shiftEvening,
      scheduled: overallKpis.intakeScheduled,
      unscheduled: overallKpis.intakeOffSchedule,
      emergency: overallKpis.intakeEmergency,
      statisticalEntries: statEntries.length,
      ...recon,
    },
    byHospital,
    charts: {
      byHall: charts.byHall,
      byHospital: charts.byHospital,
    },
  };
}

module.exports = { buildMinistrySummary };
