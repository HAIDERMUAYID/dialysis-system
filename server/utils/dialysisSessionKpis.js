/**
 * تجميع KPI الجلسات في استعلامات قليلة بدل عدة COUNT متوازية.
 */
async function aggregateDialysisSessionKpis(prisma, where) {
  const [statusGroups, intakeGroups, distinctPatientRows] = await Promise.all([
    prisma.dialysisSession.groupBy({
      by: ['status'],
      where,
      _count: { _all: true },
    }),
    prisma.dialysisSession.groupBy({
      by: ['intakeKind'],
      where,
      _count: { _all: true },
    }),
    prisma.dialysisSession.findMany({
      where,
      distinct: ['dialysisPatientId'],
      select: { dialysisPatientId: true },
    }),
  ]);

  const statusMap = Object.fromEntries(
    statusGroups.map((g) => [g.status, g._count._all])
  );
  const total = statusGroups.reduce((sum, g) => sum + g._count._all, 0);

  const byIntakeKind = Object.fromEntries(
    intakeGroups.map((g) => [
      g.intakeKind === null ? 'UNKNOWN' : g.intakeKind,
      g._count._all,
    ])
  );

  const shiftGroups = await prisma.dialysisSession.groupBy({
    by: ['shift'],
    where,
    _count: { _all: true },
  });
  const shiftMap = Object.fromEntries(
    shiftGroups.map((g) => [(g.shift || '').toUpperCase(), g._count._all])
  );

  return {
    total,
    active: statusMap.ACTIVE ?? 0,
    scheduled: statusMap.SCHEDULED ?? 0,
    completed: statusMap.COMPLETED ?? 0,
    cancelled: statusMap.CANCELLED ?? 0,
    uniquePatients: distinctPatientRows.length,
    byIntakeKind,
    intakeScheduled: byIntakeKind.SCHEDULED ?? 0,
    intakeOffSchedule: byIntakeKind.OFF_SCHEDULE ?? 0,
    intakeEmergency: byIntakeKind.EMERGENCY ?? 0,
    shiftMorning: shiftMap.MORNING ?? 0,
    shiftEvening: shiftMap.EVENING ?? 0,
    shiftNight: shiftMap.NIGHT ?? 0,
  };
}

module.exports = { aggregateDialysisSessionKpis };
