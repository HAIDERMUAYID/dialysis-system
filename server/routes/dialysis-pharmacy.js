/**
 * صيدلية وحدة الغسل — جلسات (عرض فقط)، مسودة صرف، تأكيد مع خصم مخزون PHARMACY
 */
const express = require('express');
const { Prisma } = require('@prisma/client');
const { authenticateToken, requireAnyPermission } = require('../middleware/auth');
const {
  resolveDialysisDataScope,
  assertRecordHospitalInDialysisScope,
  requireDialysisHospital,
} = require('../utils/dialysisScope');
const db = require('../database/db');
const {
  resolveQuantityToBase,
  resolveDispenseLineQuantities,
  unitOptionsForItem,
  formatBaseQuantity,
  loadItemUnits,
} = require('../utils/dialysisItemUnits');
const { purgeInactiveDialysisItemsInventory } = require('../utils/purgeDialysisItemInventory');
const { aggregateDialysisSessionKpis } = require('../utils/dialysisSessionKpis');

const router = express.Router();

const P_VIEW = ['dialysis:pharmacy:view', 'dialysis:view'];
const P_DISPENSE = ['dialysis:pharmacy:dispense'];
const P_INVENTORY = ['dialysis:pharmacy:inventory'];

function prismaOr503(res) {
  if (!db.prisma) {
    res.status(503).json({ error: 'وحدة الغسل الكلوي تتطلب PostgreSQL عبر Prisma' });
    return null;
  }
  return db.prisma;
}

function audit(req) {
  const uid = req.user?.id;
  return {
    createdByUserId: uid ?? undefined,
    updatedByUserId: uid ?? undefined,
  };
}

/** نسخة محلية — توافق فلاتر قائمة الجلسات مع dialysis.js */
function parseCalendarDateForDb(ymd) {
  const s = String(ymd || '').split('T')[0];
  const p = s.split('-').map((x) => parseInt(x, 10));
  if (p.length < 3 || p.some((n) => Number.isNaN(n))) return null;
  return new Date(Date.UTC(p[0], p[1] - 1, p[2], 12, 0, 0, 0));
}

function buildDialysisSessionsWhere(hospitalClause, query) {
  const dateStr = query.date;
  const dateFrom = query.date_from;
  const dateTo = query.date_to;
  const status = query.status;
  const intakeKindRaw = query.intake_kind;
  const pidRaw = query.dialysis_patient_id;
  const search = query.search;
  const locationIdRaw = query.location_id;
  const shiftSlotIdRaw = query.shift_slot_id;
  const machineIdRaw = query.machine_id;

  let sessionDateWhere = undefined;
  const df = dateFrom ? parseCalendarDateForDb(String(dateFrom)) : null;
  const dt = dateTo ? parseCalendarDateForDb(String(dateTo)) : null;
  if (df && dt) {
    sessionDateWhere = { gte: df, lte: dt };
  } else if (dateStr) {
    const d = parseCalendarDateForDb(String(dateStr));
    if (d) sessionDateWhere = d;
  }

  const pid = pidRaw !== undefined && pidRaw !== '' ? parseInt(String(pidRaw), 10) : NaN;
  const locationId =
    locationIdRaw !== undefined && locationIdRaw !== '' ? parseInt(String(locationIdRaw), 10) : NaN;
  const shiftSlotId =
    shiftSlotIdRaw !== undefined && shiftSlotIdRaw !== '' ? parseInt(String(shiftSlotIdRaw), 10) : NaN;
  const machineId =
    machineIdRaw !== undefined && machineIdRaw !== '' ? parseInt(String(machineIdRaw), 10) : NaN;

  let intakeKindFilter = undefined;
  if (intakeKindRaw === '__NULL__') {
    intakeKindFilter = '__NULL__';
  } else if (intakeKindRaw && String(intakeKindRaw).trim()) {
    intakeKindFilter = String(intakeKindRaw).trim();
  }

  return {
    hospitalId: hospitalClause,
    ...(sessionDateWhere !== undefined
      ? typeof sessionDateWhere === 'object' &&
          sessionDateWhere !== null &&
          'gte' in sessionDateWhere
        ? { sessionDate: sessionDateWhere }
        : { sessionDate: sessionDateWhere }
      : {}),
    ...(status ? { status } : {}),
    ...(intakeKindFilter !== undefined
      ? intakeKindFilter === '__NULL__'
        ? { intakeKind: null }
        : { intakeKind: intakeKindFilter }
      : {}),
    ...(Number.isFinite(pid) ? { dialysisPatientId: pid } : {}),
    ...(Number.isFinite(locationId) ? { locationId } : {}),
    ...(Number.isFinite(shiftSlotId) ? { shiftSlotId } : {}),
    ...(Number.isFinite(machineId) ? { machineId } : {}),
    ...(search && String(search).trim()
      ? {
          dialysisPatient: {
            fullName: { contains: String(search).trim(), mode: 'insensitive' },
          },
        }
      : {}),
  };
}

async function attachSessionListDispenseCompletedBy(prisma, sessions) {
  const ids = [
    ...new Set(
      sessions.map((s) => s.pharmacyDispense?.completedByUserId).filter(Boolean)
    ),
  ];
  if (!ids.length) return sessions;
  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, username: true },
  });
  const map = Object.fromEntries(users.map((u) => [u.id, u]));
  return sessions.map((s) => {
    const cid = s.pharmacyDispense?.completedByUserId;
    if (!s.pharmacyDispense || !cid) return s;
    return {
      ...s,
      pharmacyDispense: {
        ...s.pharmacyDispense,
        completed_by_display:
          map[cid]?.name || map[cid]?.username || `#${cid}`,
      },
    };
  });
}

/** أيام الأسبوع في النظام: 0 = الأحد … 6 = السبت */
const WEEKDAY_NAMES_AR = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

/**
 * عدد أيام التغطية اليومية من تاريخ الجلسة (ضمناً) حتى قبل موعد الغسلة القادمة في الجدول.
 * يبحث عن أول يوم غسلة بعد يوم الجلسة ضمن جدول المريض النشط.
 */
async function computeDialysisBridgeForSession(prisma, session) {
  const schedules = await prisma.dialysisPatientSchedule.findMany({
    where: {
      dialysisPatientId: session.dialysisPatientId,
      hospitalId: session.hospitalId,
      isActive: 1,
    },
    select: { dayOfWeek: true },
  });
  const weekdays = [...new Set(schedules.map((s) => s.dayOfWeek))].sort((a, b) => a - b);

  const sd = session.sessionDate;
  const sessionDay = new Date(Date.UTC(sd.getUTCFullYear(), sd.getUTCMonth(), sd.getUTCDate()));

  if (weekdays.length === 0) {
    return {
      bridge_days: 1,
      next_dialysis_date: null,
      scheduled_weekdays: [],
      weekday_labels: [],
      source: 'NO_SCHEDULE',
      hint:
        'لا يوجد جدول غسل أسبوعي لهذا المريض — يُعتمد يوم واحد لحساب الكمية. عدّل الكمية يدوياً عند الحاجة.',
    };
  }

  const weekdayLabels = weekdays.map((w) => WEEKDAY_NAMES_AR[w] ?? String(w));

  const cursor = new Date(sessionDay);
  cursor.setUTCDate(cursor.getUTCDate() + 1);

  let nextDialysisDate = null;
  for (let step = 0; step < 21; step++) {
    const wd = cursor.getUTCDay();
    if (weekdays.includes(wd)) {
      nextDialysisDate = new Date(cursor);
      break;
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  if (!nextDialysisDate) {
    return {
      bridge_days: 1,
      next_dialysis_date: null,
      scheduled_weekdays: weekdays,
      weekday_labels: weekdayLabels,
      source: 'NO_NEXT_FOUND',
      hint:
        'لم يُعثر على موعد غسلة قادم في الجدول خلال 3 أسابيع — أدخل الكمية يدوياً أو راجع جدول المريض.',
    };
  }

  const msPerDay = 86400000;
  const bridgeDays = Math.max(
    1,
    Math.round((nextDialysisDate.getTime() - sessionDay.getTime()) / msPerDay)
  );

  const nextStr = nextDialysisDate.toISOString().split('T')[0];

  return {
    bridge_days: bridgeDays,
    next_dialysis_date: nextStr,
    scheduled_weekdays: weekdays,
    weekday_labels: weekdayLabels,
    source: 'SCHEDULE',
    hint: null,
  };
}

async function getPharmacyWarehouse(tx, hospitalId) {
  return tx.dialysisWarehouse.findFirst({
    where: { hospitalId, type: 'PHARMACY', isActive: 1 },
  });
}

function parseOptionalCost(b) {
  const raw = b.unit_cost_per_base ?? b.unitCostPerBase;
  if (raw === undefined || raw === null || raw === '') return null;
  try {
    return new Prisma.Decimal(String(raw));
  } catch {
    return null;
  }
}

/**
 * خصم FIFO من دفعات مستودع الصيدلية — quantityBase وحدات أساسية للصنف
 */
async function deductFifoPharmacy(tx, hospitalId, warehouseId, itemId, quantityBase, dispenseId, userId) {
  let remaining = new Prisma.Decimal(String(quantityBase));
  const batches = await tx.dialysisInventoryBatch.findMany({
    where: {
      hospitalId,
      warehouseId,
      itemId,
      quantityRemainingBase: { gt: 0 },
    },
    orderBy: [{ expiryDate: 'asc' }, { id: 'asc' }],
  });

  for (const batch of batches) {
    if (remaining.lte(0)) break;
    const avail = new Prisma.Decimal(batch.quantityRemainingBase.toString());
    const take = remaining.lt(avail) ? remaining : avail;
    const newRemain = avail.minus(take);

    await tx.dialysisInventoryBatch.update({
      where: { id: batch.id },
      data: {
        quantityRemainingBase: newRemain,
        updatedByUserId: userId ?? undefined,
      },
    });

    await tx.dialysisInventoryLedger.create({
      data: {
        hospitalId,
        warehouseId,
        itemId,
        batchId: batch.id,
        txnType: 'PHARMACY_DISPENSE',
        quantityDeltaBase: take.mul(-1),
        refType: 'dialysis_session_dispense',
        refId: dispenseId,
        createdByUserId: userId ?? null,
      },
    });

    remaining = remaining.minus(take);
  }

  if (remaining.gt(0)) {
    throw Object.assign(new Error('الكمية المتوفرة في المخزن غير كافية لهذا الدواء'), {
      code: 400,
    });
  }
}

/** أصناف مخزن الغسل المتاحة للصرف — المعرف id هو معرف صنف D-IRS (ليس كتالوج المستشفى العام) */
router.get(
  '/eligible-drugs',
  authenticateToken,
  requireAnyPermission(...P_VIEW),
  async (req, res) => {
    const prisma = prismaOr503(res);
    if (!prisma) return;
    try {
      const hospitalId = await requireDialysisHospital(prisma, req, res);
      if (hospitalId == null) return;

      const pharmacyWarehouse = await prisma.dialysisWarehouse.findFirst({
        where: { hospitalId, type: 'PHARMACY', isActive: 1 },
        select: { id: true, name: true },
      });

      const items = await prisma.dialysisItem.findMany({
        where: {
          hospitalId,
          isActive: 1,
        },
        select: {
          id: true,
          name: true,
          sku: true,
          baseUnitLabel: true,
          measureKind: true,
          drugCatalogId: true,
          units: { orderBy: [{ levelOrder: 'asc' }, { id: 'asc' }] },
          drugCatalog: {
            select: {
              id: true,
              drugName: true,
              drugNameAr: true,
              form: true,
              strength: true,
            },
          },
        },
        orderBy: [{ name: 'asc' }],
      });

      res.json({
        pharmacy_warehouse: pharmacyWarehouse,
        drugs: items.map((it) => ({
          id: it.id,
          drug_name: it.name,
          drug_name_ar: it.name,
          sku: it.sku,
          base_unit_label: it.baseUnitLabel,
          measure_kind: it.measureKind,
          legacy_drug_catalog_id: it.drugCatalogId,
          packaging_units: unitOptionsForItem(it),
          inventory_base_unit_code: it.inventoryBaseUnitCode,
        })),
      });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'فشل جلب أصناف مخزن الغسل للصرف' });
    }
  }
);

/** مجموعات الوصفات (كرّوب) للاستخدام في صيدلية الغسل — قراءة فقط، بنفس صلاحيات عرض الصيدلية */
router.get(
  '/prescription-sets',
  authenticateToken,
  requireAnyPermission(...P_VIEW),
  async (req, res) => {
    const prisma = prismaOr503(res);
    if (!prisma) return;
    try {
      const hospitalId = await requireDialysisHospital(prisma, req, res);
      if (hospitalId == null) return;

      const sets = await prisma.prescriptionSet.findMany({
        where: { isActive: 1 },
        select: {
          id: true,
          setName: true,
          setNameAr: true,
        },
        orderBy: [{ setNameAr: 'asc' }, { setName: 'asc' }],
      });

      res.json(
        sets.map((s) => ({
          id: s.id,
          set_name: s.setName,
          set_name_ar: s.setNameAr,
        }))
      );
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'فشل جلب مجموعات الوصفات' });
    }
  }
);

// --- قائمة الجلسات مع حالة الصرف ---
router.get(
  '/sessions',
  authenticateToken,
  requireAnyPermission(...P_VIEW),
  async (req, res) => {
    const prisma = prismaOr503(res);
    if (!prisma) return;
    try {
      const ds = await resolveDialysisDataScope(prisma, req, res);
      if (!ds) return;
      const hospitalClause =
        ds.mode === 'multi' ? { in: ds.hospitalIds } : ds.hospitalId;
      const where = buildDialysisSessionsWhere(hospitalClause, req.query);
      const limitRaw = parseInt(String(req.query.limit ?? '300'), 10);
      const take = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 500) : 300;

      let rows = await prisma.dialysisSession.findMany({
        where,
        include: {
          hospital: { select: { id: true, name: true, code: true } },
          dialysisPatient: { select: { fullName: true, id: true, kind: true } },
          location: true,
          shiftSlot: true,
          machine: { select: { id: true, assetTag: true } },
          pharmacyDispense: {
            include: {
              lines: {
                include: {
                  drugCatalog: { select: { id: true, drugName: true, drugNameAr: true } },
                  dialysisItem: { select: { id: true, name: true, sku: true, baseUnitLabel: true } },
                },
                orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }],
              },
            },
          },
        },
        orderBy: [{ sessionDate: 'desc' }, { startedAt: 'desc' }],
        take,
      });

      rows = await attachSessionListDispenseCompletedBy(prisma, rows);
      res.json(rows);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'فشل جلب الجلسات (صيدلية الغسل)' });
    }
  }
);

/** مؤشرات الجلسات + الصيدلية — نفس فلاتر قائمة الجلسات */
router.get(
  '/sessions/kpis',
  authenticateToken,
  requireAnyPermission(...P_VIEW),
  async (req, res) => {
    const prisma = prismaOr503(res);
    if (!prisma) return;
    try {
      const ds = await resolveDialysisDataScope(prisma, req, res);
      if (!ds) return;
      const hospitalClause =
        ds.mode === 'multi' ? { in: ds.hospitalIds } : ds.hospitalId;
      const where = buildDialysisSessionsWhere(hospitalClause, req.query);

      const [
        sessionKpis,
        pharmacyDispensed,
        pharmacyDraft,
        pharmacyPending,
      ] = await Promise.all([
        aggregateDialysisSessionKpis(prisma, where),
        prisma.dialysisSession.count({
          where: { ...where, pharmacyDispense: { status: 'COMPLETED' } },
        }),
        prisma.dialysisSession.count({
          where: { ...where, pharmacyDispense: { status: 'DRAFT' } },
        }),
        prisma.dialysisSession.count({
          where: {
            ...where,
            status: { not: 'CANCELLED' },
            OR: [
              { pharmacyDispense: null },
              { pharmacyDispense: { status: { not: 'COMPLETED' } } },
            ],
          },
        }),
      ]);

      res.json({
        ...sessionKpis,
        pharmacyDispensed,
        pharmacyDraft,
        pharmacyPending,
      });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'فشل حساب مؤشرات صيدلية الغسل' });
    }
  }
);

/** حساب أيام الجسر الصيدلاني (يومي حتى الغسلة القادمة من الجدول) */
router.get(
  '/sessions/:sessionId/pharmacy-bridge',
  authenticateToken,
  requireAnyPermission(...P_VIEW),
  async (req, res) => {
    const prisma = prismaOr503(res);
    if (!prisma) return;
    try {
      const sessionId = parseInt(req.params.sessionId, 10);
      if (!sessionId) return res.status(400).json({ error: 'معرّف جلسة غير صالح' });

      const session = await prisma.dialysisSession.findUnique({
        where: { id: sessionId },
      });
      if (!session) return res.status(404).json({ error: 'الجلسة غير موجودة' });
      const allowed = await assertRecordHospitalInDialysisScope(prisma, req, res, session.hospitalId);
      if (allowed == null) return;

      const info = await computeDialysisBridgeForSession(prisma, session);
      const sessionDateStr = session.sessionDate.toISOString().split('T')[0];
      res.json({
        session_id: sessionId,
        session_date: sessionDateStr,
        dialysis_patient_id: session.dialysisPatientId,
        ...info,
      });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'فشل حساب الفترة الصيدلانية' });
    }
  }
);

// --- تفاصيل جلسة + صرف ---
router.get(
  '/sessions/:sessionId',
  authenticateToken,
  requireAnyPermission(...P_VIEW),
  async (req, res) => {
    const prisma = prismaOr503(res);
    if (!prisma) return;
    try {
      const sessionId = parseInt(req.params.sessionId, 10);
      if (!sessionId) return res.status(400).json({ error: 'معرّف جلسة غير صالح' });

      const preview = await prisma.dialysisSession.findUnique({
        where: { id: sessionId },
        select: { hospitalId: true },
      });
      if (!preview) return res.status(404).json({ error: 'الجلسة غير موجودة' });
      const allowed = await assertRecordHospitalInDialysisScope(prisma, req, res, preview.hospitalId);
      if (allowed == null) return;

      const row = await prisma.dialysisSession.findFirst({
        where: { id: sessionId },
        include: {
          hospital: { select: { id: true, name: true, code: true } },
          dialysisPatient: { select: { fullName: true, id: true, kind: true } },
          location: true,
          machine: { include: { location: true } },
          shiftSlot: true,
          pharmacyDispense: {
            include: {
              lines: {
                include: {
                  drugCatalog: true,
                  dialysisItem: { select: { id: true, name: true, sku: true, baseUnitLabel: true } },
                  prescriptionSet: { select: { id: true, setName: true, setNameAr: true } },
                },
                orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }],
              },
              completedBy: { select: { id: true, name: true, username: true } },
            },
          },
        },
      });
      if (!row) return res.status(404).json({ error: 'الجلسة غير موجودة' });

      if (row.pharmacyDispense?.lines?.length) {
        for (const ln of row.pharmacyDispense.lines) {
          if (!ln.dialysisItemId && ln.drugCatalogId) {
            const it = await prisma.dialysisItem.findFirst({
              where: {
                hospitalId: row.hospitalId,
                drugCatalogId: ln.drugCatalogId,
                isActive: 1,
              },
              select: { id: true, name: true, sku: true, baseUnitLabel: true },
            });
            if (it) {
              ln.dialysisItemId = it.id;
              ln.dialysisItem = it;
            }
          }
        }
      }

      res.json(row);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'فشل جلب الجلسة' });
    }
  }
);

/** مسودة أو تحديث أسطر الصرف */
router.put(
  '/sessions/:sessionId/dispense',
  authenticateToken,
  requireAnyPermission(...P_DISPENSE),
  async (req, res) => {
    const prisma = prismaOr503(res);
    if (!prisma) return;
    try {
      const sessionId = parseInt(req.params.sessionId, 10);
      if (!sessionId) return res.status(400).json({ error: 'معرّف جلسة غير صالح' });

      const session = await prisma.dialysisSession.findUnique({
        where: { id: sessionId },
      });
      if (!session) return res.status(404).json({ error: 'الجلسة غير موجودة' });
      if (session.status === 'CANCELLED') {
        return res.status(400).json({ error: 'لا يمكن صرف علاج لجلسة ملغاة' });
      }

      const allowed = await assertRecordHospitalInDialysisScope(prisma, req, res, session.hospitalId);
      if (allowed == null) return;

      const b = req.body || {};
      const rawLines = Array.isArray(b.lines) ? b.lines : [];

      const bridgeInfoCached = await computeDialysisBridgeForSession(prisma, session);

      const linesPayload = [];
      for (let i = 0; i < rawLines.length; i++) {
        const L = rawLines[i];

        const rawItem = L.dialysis_item_id ?? L.dialysisItemId;
        const rawCat = L.drug_catalog_id ?? L.drugCatalogId;
        const dialysisItemId =
          rawItem !== undefined && rawItem !== null && rawItem !== ''
            ? parseInt(String(rawItem), 10)
            : NaN;
        const drugCatalogIdRaw =
          rawCat !== undefined && rawCat !== null && rawCat !== ''
            ? parseInt(String(rawCat), 10)
            : NaN;

        let drugCatalogId = null;
        let resolvedDialysisItemId = null;

        if (Number.isFinite(dialysisItemId)) {
          const item = await prisma.dialysisItem.findFirst({
            where: { id: dialysisItemId, hospitalId: session.hospitalId, isActive: 1 },
          });
          if (!item) {
            return res.status(400).json({ error: `سطر ${i + 1}: صنف مخزن الغسل غير موجود أو غير نشط` });
          }
          resolvedDialysisItemId = item.id;
          drugCatalogId = item.drugCatalogId ?? null;
        } else if (Number.isFinite(drugCatalogIdRaw)) {
          const drug = await prisma.drugCatalog.findFirst({
            where: { id: drugCatalogIdRaw, isActive: 1 },
          });
          if (!drug) return res.status(400).json({ error: `سطر ${i + 1}: مرجع كتالوج غير صالح (قديم)` });
          drugCatalogId = drugCatalogIdRaw;
        } else {
          return res.status(400).json({
            error: `سطر ${i + 1}: حدد صنف الغسل (dialysis_item_id) من مخزن صيدلية الغسل`,
          });
        }

        let qtyResolved;
        try {
          qtyResolved = await resolveDispenseLineQuantities(
            prisma,
            resolvedDialysisItemId,
            L,
            bridgeInfoCached.bridge_days
          );
        } catch (err) {
          return res.status(400).json({ error: `سطر ${i + 1}: ${err.message}` });
        }

        const frequencyKind = qtyResolved.frequencyKind;
        let bridgeDaysSnapshot = null;
        if (frequencyKind === 'DAILY_TO_NEXT_DIALYSIS') {
          if (qtyResolved.dailyUnitQty == null) {
            return res.status(400).json({
              error: `سطر ${i + 1}: جرعة اليوم (daily_unit_qty + daily_unit_code) مطلوبة عند الصرف اليومي`,
            });
          }
          bridgeDaysSnapshot = bridgeInfoCached.bridge_days;
        }

        linesPayload.push({
          dialysisItemId: resolvedDialysisItemId,
          drugCatalogId,
          dosage: L.dosage != null ? String(L.dosage) : null,
          quantity: qtyResolved.quantity,
          dispenseUnitCode: qtyResolved.dispenseUnitCode,
          dispenseUnitQty: qtyResolved.dispenseUnitQty,
          frequencyKind,
          dailyUnitQty: qtyResolved.dailyUnitQty,
          bridgeDaysSnapshot,
          instructions: L.instructions != null ? String(L.instructions) : null,
          prescriptionSetId: L.prescription_set_id
            ? parseInt(String(L.prescription_set_id), 10)
            : L.prescriptionSetId
              ? parseInt(String(L.prescriptionSetId), 10)
              : null,
          displayOrder: L.display_order != null ? parseInt(String(L.display_order), 10) : i,
        });
      }

      const result = await prisma.$transaction(async (tx) => {
        const existing = await tx.dialysisSessionDispense.findUnique({
          where: { sessionId },
        });
        if (existing && existing.status === 'COMPLETED') {
          throw Object.assign(new Error('تم تأكيد الصرف مسبقاً ولا يمكن تعديله'), { code: 409 });
        }

        let dispenseId;
        if (existing) {
          await tx.dialysisSessionDispenseLine.deleteMany({ where: { dispenseId: existing.id } });
          await tx.dialysisSessionDispense.update({
            where: { id: existing.id },
            data: {
              notes: b.notes != null ? String(b.notes) : null,
              ...audit(req),
            },
          });
          dispenseId = existing.id;

          if (linesPayload.length) {
            await tx.dialysisSessionDispenseLine.createMany({
              data: linesPayload.map((l) => ({
                dispenseId,
                dialysisItemId: l.dialysisItemId ?? null,
                drugCatalogId: l.drugCatalogId ?? null,
                dosage: l.dosage,
                frequencyKind: l.frequencyKind,
                dailyUnitQty: l.dailyUnitQty,
                bridgeDaysSnapshot: l.bridgeDaysSnapshot,
                quantity: l.quantity,
                dispenseUnitCode: l.dispenseUnitCode,
                dispenseUnitQty: l.dispenseUnitQty,
                instructions: l.instructions,
                prescriptionSetId: Number.isFinite(l.prescriptionSetId) ? l.prescriptionSetId : null,
                displayOrder: l.displayOrder ?? 0,
              })),
            });
          }
        } else {
          const created = await tx.dialysisSessionDispense.create({
            data: {
              hospitalId: session.hospitalId,
              sessionId,
              status: 'DRAFT',
              notes: b.notes != null ? String(b.notes) : null,
              ...audit(req),
            },
          });
          dispenseId = created.id;
          if (linesPayload.length) {
            await tx.dialysisSessionDispenseLine.createMany({
              data: linesPayload.map((l) => ({
                dispenseId,
                dialysisItemId: l.dialysisItemId ?? null,
                drugCatalogId: l.drugCatalogId ?? null,
                dosage: l.dosage,
                frequencyKind: l.frequencyKind,
                dailyUnitQty: l.dailyUnitQty,
                bridgeDaysSnapshot: l.bridgeDaysSnapshot,
                quantity: l.quantity,
                dispenseUnitCode: l.dispenseUnitCode,
                dispenseUnitQty: l.dispenseUnitQty,
                instructions: l.instructions,
                prescriptionSetId: Number.isFinite(l.prescriptionSetId) ? l.prescriptionSetId : null,
                displayOrder: l.displayOrder ?? 0,
              })),
            });
          }
        }

        return tx.dialysisSessionDispense.findUnique({
          where: { id: dispenseId },
          include: {
            lines: {
              include: {
                drugCatalog: true,
                dialysisItem: {
                  select: {
                    id: true,
                    name: true,
                    sku: true,
                    baseUnitLabel: true,
                    units: { orderBy: [{ levelOrder: 'asc' }, { id: 'asc' }] },
                  },
                },
                prescriptionSet: { select: { id: true, setNameAr: true } },
              },
              orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }],
            },
          },
        });
      });

      res.json(result);
    } catch (e) {
      if (e.code === 409) {
        return res.status(409).json({ error: e.message });
      }
      console.error(e);
      res.status(500).json({ error: e.message || 'فشل حفظ مسودة الصرف' });
    }
  }
);

/** تعبئة المسودة من مجموعة وصفات (كرّوب) */
router.post(
  '/sessions/:sessionId/dispense/from-set',
  authenticateToken,
  requireAnyPermission(...P_DISPENSE),
  async (req, res) => {
    const prisma = prismaOr503(res);
    if (!prisma) return;
    try {
      const sessionId = parseInt(req.params.sessionId, 10);
      const setId = parseInt(String(req.body?.set_id ?? req.body?.setId), 10);
      if (!sessionId || !setId) {
        return res.status(400).json({ error: 'sessionId و set_id مطلوبان' });
      }

      const session = await prisma.dialysisSession.findUnique({ where: { id: sessionId } });
      if (!session) return res.status(404).json({ error: 'الجلسة غير موجودة' });
      const allowed = await assertRecordHospitalInDialysisScope(prisma, req, res, session.hospitalId);
      if (allowed == null) return;

      const existingDisp = await prisma.dialysisSessionDispense.findUnique({ where: { sessionId } });
      if (existingDisp?.status === 'COMPLETED') {
        return res.status(409).json({ error: 'تم تأكيد الصرف مسبقاً' });
      }

      const set = await prisma.prescriptionSet.findFirst({
        where: { id: setId, isActive: 1 },
        include: {
          items: {
            include: { drugCatalog: true },
            orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }],
          },
        },
      });
      if (!set) return res.status(404).json({ error: 'مجموعة الوصفات غير موجودة' });

      const linesPayload = [];
      for (let i = 0; i < set.items.length; i++) {
        const it = set.items[i];
        const qty = it.quantity != null ? parseInt(String(it.quantity), 10) : 1;
        const dItems = await prisma.dialysisItem.findMany({
          where: {
            hospitalId: session.hospitalId,
            drugCatalogId: it.drugCatalogId,
            isActive: 1,
          },
        });
        if (dItems.length === 0) {
          return res.status(400).json({
            error: `لا يوجد صنف في مخزن الغسل يطابق سطر المجموعة ${i + 1} — عرّف الصنف في مخزن صيدلية الغسل أو ازل هذا الدواء من المجموعة.`,
          });
        }
        if (dItems.length > 1) {
          return res.status(400).json({
            error: `أكثر من صنف مخزون لنفس الدواء في سطر المجموعة ${i + 1} — وحّد الصنف أو راجع المشرف.`,
          });
        }
        linesPayload.push({
          dialysisItemId: dItems[0].id,
          drugCatalogId: it.drugCatalogId,
          dosage: it.dosage != null ? String(it.dosage) : null,
          quantity: Number.isFinite(qty) && qty >= 1 ? qty : 1,
          frequencyKind: 'PER_SESSION',
          dailyUnitQty: null,
          bridgeDaysSnapshot: null,
          instructions: it.instructions != null ? String(it.instructions) : null,
          prescriptionSetId: set.id,
          displayOrder: it.displayOrder ?? i,
        });
      }

      const result = await prisma.$transaction(async (tx) => {
        let dispenseId;
        if (existingDisp) {
          await tx.dialysisSessionDispenseLine.deleteMany({ where: { dispenseId: existingDisp.id } });
          await tx.dialysisSessionDispense.update({
            where: { id: existingDisp.id },
            data: { notes: `من مجموعة: ${set.setNameAr || set.setName}`, ...audit(req) },
          });
          dispenseId = existingDisp.id;
        } else {
          const created = await tx.dialysisSessionDispense.create({
            data: {
              hospitalId: session.hospitalId,
              sessionId,
              status: 'DRAFT',
              notes: `من مجموعة: ${set.setNameAr || set.setName}`,
              ...audit(req),
            },
          });
          dispenseId = created.id;
        }

        if (linesPayload.length) {
          await tx.dialysisSessionDispenseLine.createMany({
            data: linesPayload.map((l) => ({
              dispenseId,
              dialysisItemId: l.dialysisItemId ?? null,
              drugCatalogId: l.drugCatalogId ?? null,
              dosage: l.dosage,
              frequencyKind: l.frequencyKind,
              dailyUnitQty: l.dailyUnitQty,
              bridgeDaysSnapshot: l.bridgeDaysSnapshot,
              quantity: l.quantity,
              instructions: l.instructions,
              prescriptionSetId: l.prescriptionSetId,
              displayOrder: l.displayOrder ?? 0,
            })),
          });
        }

        return tx.dialysisSessionDispense.findUnique({
          where: { id: dispenseId },
          include: {
            lines: {
              include: {
                drugCatalog: true,
                dialysisItem: { select: { id: true, name: true, sku: true, baseUnitLabel: true } },
              },
              orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }],
            },
          },
        });
      });

      res.json(result);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: e.message || 'فشل تحميل المجموعة' });
    }
  }
);

/** تأكيد الصرف وخصم المخزون */
router.post(
  '/sessions/:sessionId/dispense/complete',
  authenticateToken,
  requireAnyPermission(...P_DISPENSE),
  async (req, res) => {
    const prisma = prismaOr503(res);
    if (!prisma) return;
    try {
      const sessionId = parseInt(req.params.sessionId, 10);
      if (!sessionId) return res.status(400).json({ error: 'معرّف جلسة غير صالح' });

      const session = await prisma.dialysisSession.findUnique({
        where: { id: sessionId },
      });
      if (!session) return res.status(404).json({ error: 'الجلسة غير موجودة' });
      if (session.status === 'CANCELLED') {
        return res.status(400).json({ error: 'لا يمكن صرف علاج لجلسة ملغاة' });
      }

      const allowed = await assertRecordHospitalInDialysisScope(prisma, req, res, session.hospitalId);
      if (allowed == null) return;

      const uid = req.user?.id ?? null;

      await prisma.$transaction(async (tx) => {
        let dispense = await tx.dialysisSessionDispense.findUnique({
          where: { sessionId },
          include: { lines: true },
        });

        if (!dispense || !dispense.lines.length) {
          throw Object.assign(new Error('لا توجد أدوية في مسودة الصرف'), { code: 400 });
        }
        if (dispense.status === 'COMPLETED') {
          throw Object.assign(new Error('تم تأكيد الصرف مسبقاً'), { code: 409 });
        }

        const wh = await getPharmacyWarehouse(tx, session.hospitalId);
        if (!wh) throw new Error('مستودع الصيدلية غير مهيأ لهذا المستشفى');

        for (const line of dispense.lines) {
          let itemId = line.dialysisItemId ?? null;
          if (itemId != null) {
            const one = await tx.dialysisItem.findFirst({
              where: { id: itemId, hospitalId: session.hospitalId, isActive: 1 },
            });
            if (!one) throw new Error(`صنف مخزن الغسل غير صالح للسطر (المعرّف ${itemId})`);
          } else if (line.drugCatalogId != null) {
            const items = await tx.dialysisItem.findMany({
              where: {
                hospitalId: session.hospitalId,
                drugCatalogId: line.drugCatalogId,
                isActive: 1,
              },
            });
            if (items.length === 0) {
              throw new Error(
                `لا يوجد صنف مخزون مطابق لسطر قديم (كتالوج ${line.drugCatalogId}). حدّث المسودة أو أضف الصنف في مخزن الغسل.`
              );
            }
            if (items.length > 1) {
              throw new Error(
                `أكثر من صنف مخزون لنفس مرجع الكتالوج (${line.drugCatalogId}) — راجع المشرف لتوحيد الربط.`
              );
            }
            itemId = items[0].id;
          } else {
            throw new Error('سطر صرف بدون صنف مخزن غسل — حدّث المسودة من صيدلية الغسل');
          }

          await deductFifoPharmacy(
            tx,
            session.hospitalId,
            wh.id,
            itemId,
            line.quantity,
            dispense.id,
            uid
          );
        }

        await tx.dialysisSessionDispense.update({
          where: { id: dispense.id },
          data: {
            status: 'COMPLETED',
            completedByUserId: uid,
            completedAt: new Date(),
            ...audit(req),
          },
        });
      });

      const full = await prisma.dialysisSessionDispense.findUnique({
        where: { sessionId },
        include: {
          lines: {
            include: {
              drugCatalog: true,
              dialysisItem: { select: { id: true, name: true, sku: true, baseUnitLabel: true } },
            },
          },
          completedBy: { select: { id: true, name: true, username: true } },
        },
      });
      res.json({ ok: true, dispense: full });
    } catch (e) {
      if (e.code === 400 || e.code === 409) {
        return res.status(e.code).json({ error: e.message });
      }
      console.error(e);
      res.status(500).json({ error: e.message || 'فشل تأكيد الصرف' });
    }
  }
);

/** ملخص مخزن صيدلية الغسل — أصناف، كميات مجمّعة، مؤشرات */
router.get(
  '/inventory/overview',
  authenticateToken,
  requireAnyPermission(...P_VIEW),
  async (req, res) => {
    const prisma = prismaOr503(res);
    if (!prisma) return;
    try {
      const hospitalId = await requireDialysisHospital(prisma, req, res);
      if (hospitalId == null) return;

      const ph = await prisma.dialysisWarehouse.findFirst({
        where: { hospitalId, type: 'PHARMACY', isActive: 1 },
      });

      if (!ph) {
        return res.json({
          pharmacy_warehouse: null,
          kpis: null,
          items: [],
        });
      }

      const items = await prisma.dialysisItem.findMany({
        where: { hospitalId, isActive: 1 },
        include: {
          units: { orderBy: [{ levelOrder: 'asc' }, { id: 'asc' }] },
          drugCatalog: {
            select: {
              id: true,
              drugName: true,
              drugNameAr: true,
              form: true,
              strength: true,
            },
          },
        },
        orderBy: { name: 'asc' },
      });

      const activeItemIds = items.map((it) => it.id);

      const batches = await prisma.dialysisInventoryBatch.findMany({
        where: {
          hospitalId,
          warehouseId: ph.id,
          itemId: activeItemIds.length ? { in: activeItemIds } : { in: [-1] },
        },
        select: {
          id: true,
          itemId: true,
          quantityRemainingBase: true,
          expiryDate: true,
          unitCostPerBase: true,
          lotNumber: true,
        },
      });

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const limit30 = new Date(today);
      limit30.setDate(limit30.getDate() + 31);

      let totalQtyBase = new Prisma.Decimal(0);
      let stockValueEstimate = new Prisma.Decimal(0);
      let expiringWithin30 = 0;
      let batchesWithPositiveQty = 0;

      const agg = new Map();

      for (const b of batches) {
        const q = new Prisma.Decimal(b.quantityRemainingBase.toString());
        const prev = agg.get(b.itemId) || {
          totalRemainingBase: new Prisma.Decimal(0),
          batchCount: 0,
        };
        prev.totalRemainingBase = prev.totalRemainingBase.plus(q);
        prev.batchCount += 1;
        agg.set(b.itemId, prev);

        if (q.gt(0)) {
          batchesWithPositiveQty += 1;
          totalQtyBase = totalQtyBase.plus(q);
          if (b.unitCostPerBase != null) {
            stockValueEstimate = stockValueEstimate.plus(q.times(b.unitCostPerBase));
          }
          if (b.expiryDate) {
            const ex = new Date(b.expiryDate);
            ex.setHours(0, 0, 0, 0);
            if (ex >= today && ex <= limit30) {
              expiringWithin30 += 1;
            }
          }
        }
      }

      const itemsOut = items.map((it) => {
        const a = agg.get(it.id);
        return {
          id: it.id,
          sku: it.sku,
          name: it.name,
          measureKind: it.measureKind,
          baseUnitLabel: it.baseUnitLabel,
          drugCatalogId: it.drugCatalogId,
          drugCatalog: it.drugCatalog,
          totalRemainingBase: a ? a.totalRemainingBase.toString() : '0',
          batchCount: a ? a.batchCount : 0,
          packaging_units: unitOptionsForItem(it),
          inventory_base_unit_code: it.inventoryBaseUnitCode,
          units: it.units,
        };
      });

      const orphanedBatchCount = await prisma.dialysisInventoryBatch.count({
        where: { hospitalId, warehouseId: ph.id, item: { isActive: 0 } },
      });

      res.json({
        pharmacy_warehouse: {
          id: ph.id,
          name: ph.name,
          type: ph.type,
        },
        kpis: {
          sku_count: items.length,
          batch_records: batches.length,
          batches_with_remaining_stock: batchesWithPositiveQty,
          total_quantity_base: totalQtyBase.toString(),
          stock_value_estimate: stockValueEstimate.toString(),
          expiring_batches_within_30_days: expiringWithin30,
          orphaned_batch_records: orphanedBatchCount,
        },
        items: itemsOut,
      });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'فشل جلب ملخص مخزن الصيدلية' });
    }
  }
);

/** كل دفعات مستودع الصيدلية مع التفاصيل (كمية متبقية، تسعير، لوت، صلاحية) */
router.get(
  '/inventory/batches',
  authenticateToken,
  requireAnyPermission(...P_VIEW),
  async (req, res) => {
    const prisma = prismaOr503(res);
    if (!prisma) return;
    try {
      const hospitalId = await requireDialysisHospital(prisma, req, res);
      if (hospitalId == null) return;

      const ph = await prisma.dialysisWarehouse.findFirst({
        where: { hospitalId, type: 'PHARMACY', isActive: 1 },
      });
      if (!ph) return res.json([]);

      const includeZero =
        req.query.include_zero === '1' || req.query.include_zero === 'true';
      const limitRaw = parseInt(String(req.query.limit ?? '500'), 10);
      const take = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 1000) : 500;

      const rows = await prisma.dialysisInventoryBatch.findMany({
        where: {
          hospitalId,
          warehouseId: ph.id,
          item: { isActive: 1 },
          ...(includeZero ? {} : { quantityRemainingBase: { gt: 0 } }),
        },
        include: {
          item: {
            select: {
              id: true,
              name: true,
              sku: true,
              baseUnitLabel: true,
              measureKind: true,
              drugCatalogId: true,
              drugCatalog: {
                select: { drugName: true, drugNameAr: true, form: true, strength: true },
              },
            },
          },
        },
        orderBy: [{ expiryDate: 'asc' }, { id: 'desc' }],
        take,
      });

      const mapped = rows.map((r) => ({
        ...r,
        quantityRemainingBase: r.quantityRemainingBase.toString(),
        unitCostPerBase: r.unitCostPerBase != null ? r.unitCostPerBase.toString() : null,
        line_value_estimate:
          r.unitCostPerBase != null && r.quantityRemainingBase != null
            ? new Prisma.Decimal(r.quantityRemainingBase.toString()).times(r.unitCostPerBase).toString()
            : null,
      }));

      res.json(mapped);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'فشل جلب دفعات المخزن' });
    }
  }
);

/** حركة مخزن الصيدلية (قيد الدفتر) */
router.get(
  '/inventory/ledger',
  authenticateToken,
  requireAnyPermission(...P_VIEW),
  async (req, res) => {
    const prisma = prismaOr503(res);
    if (!prisma) return;
    try {
      const hospitalId = await requireDialysisHospital(prisma, req, res);
      if (hospitalId == null) return;

      const ph = await prisma.dialysisWarehouse.findFirst({
        where: { hospitalId, type: 'PHARMACY', isActive: 1 },
      });
      if (!ph) return res.json([]);

      const limitRaw = parseInt(String(req.query.limit ?? '200'), 10);
      const take = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 500) : 200;

      const rows = await prisma.dialysisInventoryLedger.findMany({
        where: { hospitalId, warehouseId: ph.id, item: { isActive: 1 } },
        orderBy: { createdAt: 'desc' },
        take,
        include: {
          item: { select: { name: true, baseUnitLabel: true } },
          batch: { select: { lotNumber: true } },
        },
      });

      const txnLabel = (t) => {
        switch (t) {
          case 'RECEIPT':
            return 'وارد';
          case 'PHARMACY_DISPENSE':
            return 'صرف صيدلية';
          case 'SESSION_CONSUMPTION':
            return 'استهلاك جلسة';
          case 'ADJUSTMENT':
            return 'تسوية';
          case 'EXPIRED_WASTE':
            return 'إتلاف منتهي';
          default:
            return t;
        }
      };

      res.json(
        rows.map((r) => ({
          id: r.id,
          txnType: r.txnType,
          txn_label_ar: txnLabel(r.txnType),
          quantity_delta_base: r.quantityDeltaBase.toString(),
          refType: r.refType,
          refId: r.refId,
          note: r.note,
          createdAt: r.createdAt,
          item: r.item,
          batch: r.batch,
        }))
      );
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'فشل جلب حركة المخزن' });
    }
  }
);

/** إزالة دفعات وحركة المخزن للأصناف المحذوفة سابقاً (تعطيل فقط دون مسح الدفعات) */
router.post(
  '/inventory/purge-deleted-items',
  authenticateToken,
  requireAnyPermission(...P_INVENTORY),
  async (req, res) => {
    const prisma = prismaOr503(res);
    if (!prisma) return;
    try {
      const hospitalId = await requireDialysisHospital(prisma, req, res);
      if (hospitalId == null) return;
      const totals = await purgeInactiveDialysisItemsInventory(prisma, hospitalId);
      res.json({
        ok: true,
        message: 'تم تنظيف مخزون الأصناف المحذوفة',
        ...totals,
      });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: e.message || 'فشل التنظيف' });
    }
  }
);

/** إدخال وارد إلى مستودع صيدلية الغسل فقط */
router.post(
  '/inventory/receipt',
  authenticateToken,
  requireAnyPermission(...P_INVENTORY),
  async (req, res) => {
    const prisma = prismaOr503(res);
    if (!prisma) return;
    try {
      const hospitalId = await requireDialysisHospital(prisma, req, res);
      if (hospitalId == null) return;

      const b = req.body;
      const warehouseId = parseInt(String(b.warehouse_id), 10);
      const itemId = parseInt(String(b.item_id), 10);
      if (!warehouseId || !itemId) {
        return res.status(400).json({ error: 'warehouse_id و item_id مطلوبان' });
      }
      const hasQty =
        b.quantity_remaining_base !== undefined ||
        b.quantity_base !== undefined ||
        b.quantity !== undefined;
      if (!hasQty) {
        return res.status(400).json({
          error: 'أدخل الكمية: quantity + unit_code أو quantity_remaining_base بالوحدة الأصغر',
        });
      }
      let qtyResolved;
      try {
        qtyResolved = await resolveQuantityToBase(prisma, itemId, b);
      } catch (err) {
        return res.status(400).json({ error: err.message });
      }
      const qty = qtyResolved.quantityBase;
      const unitCost = parseOptionalCost(b);
      const supplierName = b.supplier_name ?? b.supplierName ?? null;
      const invoiceReference = b.invoice_reference ?? b.invoiceRef ?? null;
      const receiptNotes = b.receipt_notes ?? b.receiptNotes ?? null;

      const row = await prisma.$transaction(async (tx) => {
        const wh = await tx.dialysisWarehouse.findFirst({ where: { id: warehouseId, hospitalId } });
        if (!wh || wh.type !== 'PHARMACY') {
          throw Object.assign(new Error('يمكن الاستلام فقط في مستودع الصيدلية'), { code: 400 });
        }
        const it = await tx.dialysisItem.findFirst({ where: { id: itemId, hospitalId } });
        if (!it) throw new Error('صنف غير موجود');

        const ledgerNoteParts = [
          b.note,
          receiptNotes,
          qtyResolved.formatted ? `وارد: ${qtyResolved.formatted}` : null,
        ].filter(Boolean);
        const ledgerNote = ledgerNoteParts.length ? ledgerNoteParts.join(' — ') : null;

        const batch = await tx.dialysisInventoryBatch.create({
          data: {
            hospitalId,
            warehouseId,
            itemId,
            lotNumber: b.lot_number ?? null,
            expiryDate: b.expiry_date ? new Date(b.expiry_date) : null,
            quantityRemainingBase: qty,
            unitCostPerBase: unitCost ?? undefined,
            supplierName: supplierName ? String(supplierName) : null,
            invoiceReference: invoiceReference ? String(invoiceReference) : null,
            receiptNotes: receiptNotes ? String(receiptNotes) : null,
            receivedAt: b.received_at ? new Date(b.received_at) : new Date(),
            ...audit(req),
          },
        });

        await tx.dialysisInventoryLedger.create({
          data: {
            hospitalId,
            warehouseId,
            itemId,
            batchId: batch.id,
            txnType: 'RECEIPT',
            quantityDeltaBase: qty,
            refType: 'inventory_batch',
            refId: batch.id,
            note: ledgerNote,
            createdByUserId: req.user?.id ?? null,
          },
        });

        return batch;
      });

      const full = await prisma.dialysisInventoryBatch.findUnique({
        where: { id: row.id },
        include: {
          item: {
            select: {
              name: true,
              drugCatalogId: true,
              baseUnitLabel: true,
              units: { orderBy: [{ levelOrder: 'asc' }, { id: 'asc' }] },
            },
          },
        },
      });
      const units = full?.item?.units ?? [];
      res.status(201).json({
        ...full,
        receipt_display: qtyResolved.formatted,
        quantity_remaining_base: qty.toString(),
      });
    } catch (e) {
      if (e.code === 400) return res.status(400).json({ error: e.message });
      console.error(e);
      res.status(500).json({ error: e.message || 'فشل استلام الدفعة' });
    }
  }
);

module.exports = router;
