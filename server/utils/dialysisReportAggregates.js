/**
 * تجميعات تقارير الجلسات — للمخططات و KPI بدون تحميل كل الصفوف.
 */
async function aggregateReportSessionCharts(prisma, where) {
  const [shiftGroups, locationGroups, hospitalGroups] = await Promise.all([
    prisma.dialysisSession.groupBy({
      by: ['shift'],
      where,
      _count: { _all: true },
    }),
    prisma.dialysisSession.groupBy({
      by: ['locationId'],
      where,
      _count: { _all: true },
    }),
    prisma.dialysisSession.groupBy({
      by: ['hospitalId'],
      where,
      _count: { _all: true },
    }),
  ]);

  const shiftMap = Object.fromEntries(
    shiftGroups.map((g) => [(g.shift || '').toUpperCase(), g._count._all])
  );

  const locationIds = locationGroups.map((g) => g.locationId).filter(Boolean);
  const locations =
    locationIds.length > 0
      ? await prisma.dialysisLocation.findMany({
          where: { id: { in: locationIds } },
          select: { id: true, hallName: true },
        })
      : [];
  const locNameById = Object.fromEntries(locations.map((l) => [l.id, l.hallName || 'غير محدد']));

  const byHallMap = new Map();
  for (const g of locationGroups) {
    const name = g.locationId ? locNameById[g.locationId] || 'غير محدد' : 'غير محدد';
    byHallMap.set(name, (byHallMap.get(name) || 0) + g._count._all);
  }
  const byHall = Array.from(byHallMap.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name, 'ar'));

  const hospitalIds = hospitalGroups.map((g) => g.hospitalId).filter(Boolean);
  const hospitals =
    hospitalIds.length > 0
      ? await prisma.hospital.findMany({
          where: { id: { in: hospitalIds } },
          select: { id: true, name: true },
        })
      : [];
  const hospNameById = Object.fromEntries(hospitals.map((h) => [h.id, h.name || 'غير محدد']));

  const byHospital = hospitalGroups
    .map((g) => ({
      name: g.hospitalId ? hospNameById[g.hospitalId] || 'غير محدد' : 'غير محدد',
      value: g._count._all,
    }))
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name, 'ar'));

  const halls = byHall.map((h) => h.name).filter((n) => n && n !== 'غير محدد');

  return {
    byHall,
    byHospital,
    halls,
    shiftMorning: shiftMap.MORNING ?? 0,
    shiftEvening: shiftMap.EVENING ?? 0,
    shiftNight: shiftMap.NIGHT ?? 0,
  };
}

function sessionDateRowToYmd(d) {
  if (!d) return '';
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return '';
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

async function aggregateReportReconSummary(prisma, where, coverageKeys, supplyMismatchKeys) {
  const statKeys = new Set(Array.isArray(coverageKeys) ? coverageKeys : []);
  const mismatchKeys = new Set(Array.isArray(supplyMismatchKeys) ? supplyMismatchKeys : []);

  const rows = await prisma.dialysisSession.findMany({
    where,
    select: {
      status: true,
      shift: true,
      sessionDate: true,
      dialysisPatientId: true,
    },
  });

  let reconMatched = 0;
  let reconMissing = 0;
  let reconSupply = 0;
  let reconNa = 0;

  for (const r of rows) {
    const st = (r.status || '').toUpperCase();
    if (st === 'CANCELLED') {
      reconNa += 1;
      continue;
    }
    const pid = r.dialysisPatientId;
    const ymd = sessionDateRowToYmd(r.sessionDate);
    const shift = r.shift;
    if (!pid || !ymd || !shift) {
      reconMissing += 1;
      continue;
    }
    const k = `${pid}|${ymd}|${shift}`;
    if (mismatchKeys.has(k)) reconSupply += 1;
    else if (statKeys.has(k)) reconMatched += 1;
    else reconMissing += 1;
  }

  const reconEligible = reconMatched + reconMissing + reconSupply;
  const statCoveragePct =
    reconEligible > 0 ? Math.round((reconMatched / reconEligible) * 1000) / 10 : 0;

  return {
    reconMatched,
    reconMissing,
    reconSupply,
    reconNa,
    statCoveragePct,
  };
}

module.exports = {
  aggregateReportSessionCharts,
  aggregateReportReconSummary,
  sessionDateRowToYmd,
};
