/**
 * D-IRS — Dialysis module API (Prisma / PostgreSQL only)
 */
const express = require('express');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const { Prisma } = require('@prisma/client');
const { authenticateToken, authenticateTokenOrQuery, requirePermission, requireAnyPermission } = require('../middleware/auth');
const {
  requireDialysisHospital,
  loadDialysisScope,
  resolveDialysisDataScope,
  assertRecordHospitalInDialysisScope,
} = require('../utils/dialysisScope');
const db = require('../database/db');
const {
  replaceItemUnits,
  resolveQuantityToBase,
  ladderFromUnits,
  formatBaseQuantity,
  loadItemUnits,
} = require('../utils/dialysisItemUnits');
const { purgeDialysisItemInventory } = require('../utils/purgeDialysisItemInventory');
const { aggregateDialysisSessionKpis } = require('../utils/dialysisSessionKpis');
const {
  aggregateReportSessionCharts,
  aggregateReportReconSummary,
} = require('../utils/dialysisReportAggregates');
const { buildMinistrySummary } = require('../utils/dialysisMinistrySummary');
const { generateMinistryExcelBuffer } = require('../services/ministryReportScheduler');
const { logDialysisAudit, DIALYSIS_AUDIT_PREFIX, parseAuditDetails, auditActionLabel } = require('../utils/dialysisAuditLog');
const dialysisLiveHub = require('../services/dialysisLiveHub');
const { notifyDialysisLiveChange, notifyDialysisLiveAfterAutoComplete } = require('../utils/dialysisLiveNotify');
const logger = require('../utils/logger');
const { faceIdentifyLimiter } = require('../utils/rateLimiter');
const {
  parseWarehouseType,
  itemWhereForWarehouseType,
  assertItemMatchesWarehouseType,
} = require('../utils/dialysisInventoryScope');
const {
  validateEnrollmentSamples,
  identifyFaceStrict,
  stripFaceEmbeddingFromPatient,
  needsFaceReenrollment,
  isCurrentStaffPipeline,
  STAFF_AUTO_THRESHOLD,
  STAFF_STRONG_THRESHOLD,
  STAFF_VERIFY_MIN_SCORE,
  STAFF_MIN_MARGIN,
  STAFF_STRONG_MIN_MARGIN,
  CURRENT_PIPELINE_VERSION,
} = require('../utils/dialysisFaceMatch');

const router = express.Router();

/** يُزيل حقول ثقيلة من صف قائمة المرضى قبل الإرسال للعميل */
function stripPatientListRow(row) {
  const base = stripFaceEmbeddingFromPatient(row);
  const {
    labsFollowUpJson: _labs,
    viralMarkersJson: _viral,
    notes: _notes,
    kidneyFailureCause: _kfc,
    vascularAccessNote: _van,
    addressLine: _addr,
    ...rest
  } = base;
  return rest;
}

/** إحصائيات الجلسات لكل مريض — استعلام واحد مجمّع */
async function attachPatientSessionStats(prisma, rows, hospitalClause) {
  if (!rows.length) return rows;
  const ids = rows.map((r) => r.id);
  const agg = await prisma.dialysisSession.groupBy({
    by: ['dialysisPatientId'],
    where: {
      dialysisPatientId: { in: ids },
      hospitalId: hospitalClause,
    },
    _count: { id: true },
    _max: { sessionDate: true },
  });
  const map = Object.fromEntries(
    agg.map((a) => [
      a.dialysisPatientId,
      { sessionTotal: a._count.id, lastSessionDate: a._max.sessionDate },
    ])
  );
  return rows.map((r) => ({
    ...r,
    sessionTotal: map[r.id]?.sessionTotal ?? 0,
    lastSessionDate: map[r.id]?.lastSessionDate ?? null,
  }));
}

function intersectPatientIds(a, b) {
  if (a == null) return b;
  if (b == null) return a;
  const setB = new Set(b);
  return a.filter((id) => setB.has(id));
}

async function patientIdsForLastSessionFilter(prisma, hospitalClause, filter) {
  if (filter === 'all' || filter === 'none') return null;
  const agg = await prisma.dialysisSession.groupBy({
    by: ['dialysisPatientId'],
    where: { hospitalId: hospitalClause },
    _max: { sessionDate: true },
  });
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return agg
    .filter((row) => {
      const maxDate = row._max.sessionDate;
      if (!maxDate) return false;
      const d = new Date(maxDate);
      d.setHours(0, 0, 0, 0);
      const daysAgo = Math.floor((today.getTime() - d.getTime()) / 86400000);
      if (filter === '7d') return daysAgo <= 7;
      if (filter === '30d') return daysAgo <= 30;
      if (filter === '90d') return daysAgo <= 90;
      if (filter === 'older30d') return daysAgo > 30;
      return false;
    })
    .map((row) => row.dialysisPatientId);
}

async function buildPatientListWhere(prisma, req, hospitalClause) {
  const search = (req.query.search || '').trim();
  const faceFilter = String(req.query.face_filter || 'all');
  const sessionsFilter = String(req.query.sessions_filter || 'all');
  const lastSessionFilter = String(req.query.last_session_filter || 'all');

  const where = {
    hospitalId: hospitalClause,
    ...(search
      ? {
          OR: [
            { fullName: { contains: search, mode: 'insensitive' } },
            { phone: { contains: search } },
            { nationalId: { contains: search } },
            { internalRecordNumber: { contains: search, mode: 'insensitive' } },
            { biometricId: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  if (faceFilter === 'no') {
    where.faceEnrolledAt = null;
  }

  if (sessionsFilter === 'none') {
    where.dialysisSessions = { none: { hospitalId: hospitalClause } };
  } else if (sessionsFilter === 'has') {
    where.dialysisSessions = { some: { hospitalId: hospitalClause } };
  }

  if (lastSessionFilter === 'none') {
    where.dialysisSessions = { none: { hospitalId: hospitalClause } };
  }

  let idFilter = null;

  if (faceFilter === 'yes' || faceFilter === 'needs_reenroll') {
    const enrolled = await prisma.dialysisPatient.findMany({
      where: { hospitalId: hospitalClause, faceEnrolledAt: { not: null } },
      select: { id: true, faceEnrollMetaJson: true },
    });
    const ids =
      faceFilter === 'needs_reenroll'
        ? enrolled.filter((r) => needsFaceReenrollment(r.faceEnrollMetaJson)).map((r) => r.id)
        : enrolled.filter((r) => !needsFaceReenrollment(r.faceEnrollMetaJson)).map((r) => r.id);
    idFilter = intersectPatientIds(idFilter, ids);
  }

  if (lastSessionFilter !== 'all' && lastSessionFilter !== 'none') {
    const ids = await patientIdsForLastSessionFilter(prisma, hospitalClause, lastSessionFilter);
    idFilter = intersectPatientIds(idFilter, ids);
  }

  if (idFilter != null) {
    if (!idFilter.length) {
      return { where: { id: -1 }, empty: true };
    }
    where.id = { in: idFilter };
  }

  return { where, empty: false };
}

const PATIENT_LIST_INCLUDE = {
  hospital: { select: { id: true, name: true, code: true } },
  schedules: {
    where: { isActive: 1 },
    orderBy: [{ dayOfWeek: 'asc' }, { shiftSlotId: 'asc' }],
    include: {
      shiftSlot: { select: { id: true, name: true } },
      location: { select: { id: true, hallName: true, bedCode: true } },
    },
  },
};

/** علاقات خفيفة لقائمة الجلسات — بدون استهلاكات (تُجلب في GET /sessions/:id) */
const SESSION_LIST_INCLUDE = {
  hospital: { select: { id: true, name: true, code: true } },
  dialysisPatient: { select: { fullName: true, id: true, kind: true, photoUrl: true, faceEnrolledAt: true } },
  location: { select: { id: true, hallName: true, bedCode: true } },
  shiftSlot: { select: { id: true, name: true, startMinutes: true } },
};

const dialysisUploadsRoot = path.join(__dirname, '../../uploads');
const patientPhotoMulter = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const patientId = req.params.id;
      const dir = path.join(dialysisUploadsRoot, 'dialysis-patients', String(patientId));
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      const ext = (path.extname(file.originalname || '') || '.jpg').toLowerCase();
      const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
      const e = allowed.includes(ext) ? (ext === '.jpeg' ? '.jpg' : ext) : '.jpg';
      cb(null, `photo${e}`);
    },
  }),
  limits: { fileSize: 4 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/^image\/(jpeg|png|webp|gif)$/i.test(file.mimetype)) {
      cb(null, true);
      return;
    }
    const ext = (path.extname(file.originalname || '') || '').toLowerCase();
    if (['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext)) {
      cb(null, true);
      return;
    }
    cb(new Error('يجب رفع صورة (JPEG/PNG/WebP/GIF)'));
  },
});

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

function parsePortraitBase64(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  const m = trimmed.match(/^data:image\/\w+;base64,(.+)$/i);
  const b64 = m ? m[1] : trimmed;
  try {
    const buf = Buffer.from(b64, 'base64');
    if (buf.length < 64 || buf.length > 4 * 1024 * 1024) return null;
    return buf;
  } catch {
    return null;
  }
}

function saveDialysisPatientPortraitBuffer(patientId, buffer) {
  const dir = path.join(dialysisUploadsRoot, 'dialysis-patients', String(patientId));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'photo.jpg'), buffer);
  return `/uploads/dialysis-patients/${patientId}/photo.jpg`;
}

function normBiometricId(v) {
  if (v === undefined || v === null) return null;
  const t = String(v).trim();
  return t.length ? t : null;
}

function validateEmergencyFields(b) {
  const missing = [];
  if (!b.full_name || !String(b.full_name).trim()) missing.push('الاسم الكامل');
  if (!b.phone || !String(b.phone).trim()) missing.push('هاتف المريض');
  if (!b.gender || !String(b.gender).trim()) missing.push('الجنس');
  if (!b.address_line || !String(b.address_line).trim()) missing.push('العنوان');
  return missing;
}

/** حقول المريض الدائم الإلزامية */
function validatePersistentFields(b) {
  const missing = [];
  if (!b.full_name || !String(b.full_name).trim()) missing.push('الاسم الكامل');
  if (!b.birth_date) missing.push('تاريخ الميلاد');
  if (!b.gender || !String(b.gender).trim()) missing.push('الجنس');
  if (!b.province_code || !String(b.province_code).trim()) missing.push('المحافظة');
  if (!b.city || !String(b.city).trim()) missing.push('المدينة');
  if (!normBiometricId(b.biometric_id)) missing.push('معرف البصمة');
  if (!b.phone || !String(b.phone).trim()) missing.push('هاتف المريض');
  if (!b.companion_phone || !String(b.companion_phone).trim()) missing.push('هاتف المرافق');
  return missing;
}

async function assertUniqueBiometric(prisma, hospitalId, biometricId, excludePatientId) {
  const bio = normBiometricId(biometricId);
  if (!bio) return;
  const dup = await prisma.dialysisPatient.findFirst({
    where: {
      hospitalId,
      biometricId: bio,
      ...(excludePatientId ? { id: { not: excludePatientId } } : {}),
    },
    select: { id: true },
  });
  if (dup) {
    const err = new Error('معرف البصمة مستخدم لمريض آخر في هذا المستشفى');
    err.statusCode = 409;
    throw err;
  }
}

/** إنشاء صفوف الجدول الأسبوعي داخل معاملة — نفس قواعد PUT */
async function createScheduleRowsInTx(tx, { hospitalId, patientId, rows, req }) {
  for (const r of rows) {
    const dayOfWeek = parseInt(r.day_of_week, 10);
    const shiftSlotId = parseInt(r.shift_slot_id, 10);
    const locationId = parseInt(r.location_id, 10);
    if (Number.isNaN(dayOfWeek) || Number.isNaN(shiftSlotId) || Number.isNaN(locationId)) {
      throw new Error('كل صف في الجدول يحتاج day_of_week و shift_slot_id و location_id أرقاماً صحيحة');
    }
    const slot = await tx.dialysisShiftSlot.findFirst({
      where: { id: shiftSlotId, hospitalId, isActive: 1 },
    });
    if (!slot || slot.weekday !== dayOfWeek) {
      throw new Error(`شفت غير متوافق مع اليوم: يوم ${dayOfWeek} شفت ${shiftSlotId}`);
    }
    const loc = await tx.dialysisLocation.findFirst({
      where: { id: locationId, hospitalId, isActive: 1 },
    });
    if (!loc) throw new Error('موقع غير موجود');
    await tx.dialysisPatientSchedule.create({
      data: {
        hospitalId,
        dialysisPatientId: patientId,
        dayOfWeek,
        shiftSlotId,
        locationId,
        isActive: 1,
        ...audit(req),
      },
    });
  }
}

/** دمج الجسم مع السجل الحالي لفرض قواعد التحقق عند التحديث */
function mergedPatientPayload(existing, b) {
  return {
    full_name: b.full_name !== undefined ? b.full_name : existing.fullName,
    birth_date:
      b.birth_date !== undefined ? b.birth_date : existing.birthDate || null,
    gender: b.gender !== undefined ? b.gender : existing.gender,
    province_code: b.province_code !== undefined ? b.province_code : existing.provinceCode,
    city: b.city !== undefined ? b.city : existing.city,
    biometric_id: b.biometric_id !== undefined ? b.biometric_id : existing.biometricId,
    phone: b.phone !== undefined ? b.phone : existing.phone,
    companion_phone: b.companion_phone !== undefined ? b.companion_phone : existing.companionPhone,
    address_line: b.address_line !== undefined ? b.address_line : existing.addressLine,
  };
}

/** يوم الأسبوع (0–6) من YYYY-MM-DD — يُحسب وفق التقويم الميلادي للتاريخ نفسه (UTC) */
function localWeekdayFromYmd(ymd) {
  const s = String(ymd || '').split('T')[0];
  const p = s.split('-').map((x) => parseInt(x, 10));
  if (p.length < 3 || p.some((n) => Number.isNaN(n))) return new Date().getUTCDay();
  return new Date(Date.UTC(p[0], p[1] - 1, p[2], 12, 0, 0, 0)).getUTCDay();
}

/**
 * تحويل YYYY-MM-DD إلى Date لتخزين Postgres @db.Date.
 * يستخدم منتصف النهار UTC للتقويم حتى لا يُخصم يوم عندما يكون الخادم أو PG بتوقيت يختلف عن العراق.
 */
function parseCalendarDateForDb(ymd) {
  const s = String(ymd || '').split('T')[0];
  const p = s.split('-').map((x) => parseInt(x, 10));
  if (p.length < 3 || p.some((n) => Number.isNaN(n))) return null;
  return new Date(Date.UTC(p[0], p[1] - 1, p[2], 12, 0, 0, 0));
}

/** سياسة الجلسات: تقويم اليوم وفق توقيت الوحدة (العراق — آسيا/بغداد) */
const DIALYSIS_SESSION_TZ = 'Asia/Baghdad';
/** العراق UTC+3 بدون DST — تحويل ساعة الحائط المحلية إلى UTC */
const DIALYSIS_WALL_UTC_OFFSET_H = 3;

function todayYmdDialysis() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: DIALYSIS_SESSION_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const map = Object.fromEntries(parts.filter((p) => p.type !== 'literal').map((p) => [p.type, p.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

function compareYmd(a, b) {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/** صف الجلسة من DB (@db.Date منتصف نهار UTC) → YYYY-MM-DD */
function sessionDateRowToYmd(sessionDate) {
  const d = sessionDate instanceof Date ? sessionDate : new Date(sessionDate);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * دقائق من منتصف الليل بتوقيت العراق على تاريخ YYYY-MM-DD → طابع UTC.
 */
function dialysisWallMinutesToUtcDate(ymd, minutesFromMidnight) {
  const s = String(ymd || '').split('T')[0];
  const p = s.split('-').map((x) => parseInt(x, 10));
  if (p.length < 3 || p.some((n) => Number.isNaN(n))) return null;
  const h = Math.floor(minutesFromMidnight / 60);
  const mi = minutesFromMidnight % 60;
  return new Date(Date.UTC(p[0], p[1] - 1, p[2], h - DIALYSIS_WALL_UTC_OFFSET_H, mi, 0, 0));
}

/** أقصى وقت انتهاء: الأقل بين نهاية الشفت وبداية الغسلة + 4 ساعات */
function computeDialysisSessionCapEndedAt(startedAt, sessionDateYmd, shiftSlot) {
  if (!startedAt) return null;
  const start = startedAt instanceof Date ? startedAt : new Date(startedAt);
  const fourH = new Date(start.getTime() + 4 * 60 * 60 * 1000);
  if (!shiftSlot || shiftSlot.endMinutes == null) return fourH;
  const shiftEnd = dialysisWallMinutesToUtcDate(sessionDateYmd, shiftSlot.endMinutes);
  if (!shiftEnd) return fourH;
  return shiftEnd.getTime() < fourH.getTime() ? shiftEnd : fourH;
}

/**
 * إغلاق تلقائي للجلسات النشطة:
 * - تنتهي عند نهاية الشفت
 * - أو بعد 4 ساعات من البدء (الأسبق)
 */
async function autoCompleteExpiredDialysisSessions(prisma, hospitalIdsInput) {
  const ids = Array.isArray(hospitalIdsInput) ? hospitalIdsInput : [hospitalIdsInput];
  const hospitalClause = ids.length > 1 ? { in: ids } : ids[0];

  const activeRows = await prisma.dialysisSession.findMany({
    where: { hospitalId: hospitalClause, status: 'ACTIVE' },
    select: {
      id: true,
      hospitalId: true,
      startedAt: true,
      sessionDate: true,
      shiftSlotId: true,
    },
  });
  if (!activeRows.length) return { closedCount: 0, hospitalIds: [] };

  const slotIds = [...new Set(activeRows.map((r) => r.shiftSlotId).filter(Boolean))];
  let slotsMap = new Map();
  if (slotIds.length) {
    const slots = await prisma.dialysisShiftSlot.findMany({
      where: { id: { in: slotIds } },
      select: { id: true, endMinutes: true },
    });
    slotsMap = new Map(slots.map((s) => [s.id, s]));
  }

  const nowMs = Date.now();
  const toClose = [];

  for (const row of activeRows) {
    if (!row.startedAt) continue;
    const sessionYmd = sessionDateRowToYmd(row.sessionDate);
    const slot = row.shiftSlotId ? slotsMap.get(row.shiftSlotId) : null;
    const cap = computeDialysisSessionCapEndedAt(row.startedAt, sessionYmd, slot);
    if (!cap) continue;
    if (nowMs >= cap.getTime()) {
      toClose.push({ id: row.id, hospitalId: row.hospitalId, endedAt: cap });
    }
  }

  if (!toClose.length) return { closedCount: 0, hospitalIds: [] };

  await prisma.$transaction(
    toClose.map((s) =>
      prisma.dialysisSession.update({
        where: { id: s.id },
        data: { status: 'COMPLETED', endedAt: s.endedAt },
      })
    )
  );

  const hospitalIds = [...new Set(toClose.map((s) => s.hospitalId))];
  return { closedCount: toClose.length, hospitalIds };
}

/** فلاتر قائمة الجلسات و KPI (استعلام GET) */
function buildDialysisSessionsWhere(hospitalClause, query) {
  const dateStr = query.date;
  const dateFrom = query.date_from;
  const dateTo = query.date_to;
  const status = query.status;
  const intakeKindRaw = query.intake_kind;
  const patientMatchMethodRaw = query.patient_match_method;
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

  let patientMatchMethodFilter = undefined;
  if (patientMatchMethodRaw === 'FACE') {
    patientMatchMethodFilter = 'FACE';
  } else if (patientMatchMethodRaw === 'MANUAL') {
    patientMatchMethodFilter = 'MANUAL';
  }

  const shiftRaw = query.shift;
  const shiftFilter =
    shiftRaw && String(shiftRaw).trim()
      ? String(shiftRaw).trim().toUpperCase()
      : undefined;

  const hallNameRaw = query.hall_name;
  const hallNameFilter =
    hallNameRaw && String(hallNameRaw).trim() ? String(hallNameRaw).trim() : undefined;

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
    ...(patientMatchMethodFilter === 'FACE'
      ? { patientMatchMethod: 'FACE' }
      : patientMatchMethodFilter === 'MANUAL'
        ? { OR: [{ patientMatchMethod: 'MANUAL' }, { patientMatchMethod: null }] }
        : {}),
    ...(Number.isFinite(pid) ? { dialysisPatientId: pid } : {}),
    ...(Number.isFinite(locationId) ? { locationId } : {}),
    ...(Number.isFinite(shiftSlotId) ? { shiftSlotId } : {}),
    ...(Number.isFinite(machineId) ? { machineId } : {}),
    ...(shiftFilter ? { shift: shiftFilter } : {}),
    ...(hallNameFilter ? { location: { hallName: hallNameFilter } } : {}),
    ...(search && String(search).trim()
      ? {
          dialysisPatient: {
            fullName: { contains: String(search).trim(), mode: 'insensitive' },
          },
        }
      : {}),
  };
}

/** تصنيف نوع إدخال الجلسة للعرض والتقارير */
async function resolveSessionIntakeKind(prisma, { hospitalId, dialysisPatientId, sessionDateYmd }) {
  const patient = await prisma.dialysisPatient.findFirst({
    where: { id: dialysisPatientId, hospitalId },
    select: { kind: true },
  });
  if (!patient) throw new Error('المريض غير موجود');
  if (patient.kind === 'EMERGENCY') return 'EMERGENCY';
  const wd = localWeekdayFromYmd(sessionDateYmd);
  const n = await prisma.dialysisPatientSchedule.count({
    where: { dialysisPatientId, hospitalId, dayOfWeek: wd, isActive: 1 },
  });
  return n > 0 ? 'SCHEDULED' : 'OFF_SCHEDULE';
}

/** يخصم من الدفعة ويسجل دفتر المخزون عند وجود batch_id */
async function applySessionConsumptionLines(tx, { hospitalId, sessionId, lines, req }) {
  const uid = req.user?.id ?? null;
  for (const line of lines) {
    const qty = new Prisma.Decimal(String(line.quantity_base));
    await tx.dialysisSessionConsumption.create({
      data: {
        hospitalId,
        sessionId,
        warehouseId: line.warehouse_id,
        itemId: line.item_id,
        batchId: line.batch_id ?? null,
        quantityBase: qty,
        displayUnitCode: line.display_unit_code ?? null,
        ...audit(req),
      },
    });

    if (line.batch_id) {
      const batch = await tx.dialysisInventoryBatch.findFirst({
        where: { id: line.batch_id, hospitalId, itemId: line.item_id },
      });
      if (!batch) throw new Error(`دفعة غير موجودة: ${line.batch_id}`);
      const remain = new Prisma.Decimal(batch.quantityRemainingBase.toString()).minus(qty);
      if (remain.lessThan(0)) throw new Error('الكمية المتوفرة في الدفعة غير كافية');
      await tx.dialysisInventoryBatch.update({
        where: { id: batch.id },
        data: { quantityRemainingBase: remain, ...audit(req) },
      });
      await tx.dialysisInventoryLedger.create({
        data: {
          hospitalId,
          warehouseId: line.warehouse_id,
          itemId: line.item_id,
          batchId: batch.id,
          txnType: 'SESSION_CONSUMPTION',
          quantityDeltaBase: new Prisma.Decimal(qty.toString()).times(-1),
          refType: 'dialysis_session',
          refId: sessionId,
          createdByUserId: uid,
        },
      });
    }
  }
}

/** وسيط للتوافق مع مصادر قديمة: الجلسات تحفظ كذلك DialysisShift */
function legacyShiftFromSlot(slot) {
  const mid = (slot.startMinutes + slot.endMinutes) / 2;
  return mid < 12 * 60 ? 'MORNING' : 'EVENING';
}

/** Morning: 00:00–12:00, Evening: 12:01–23:59 (local server time) */
function shiftFromLocalDate(d) {
  const h = d.getHours();
  const m = d.getMinutes();
  if (h < 12) return 'MORNING';
  if (h === 12 && m === 0) return 'MORNING';
  return 'EVENING';
}

async function attachUsernames(prisma, rows, field = 'createdByUserId') {
  const ids = [...new Set(rows.map((r) => r[field]).filter(Boolean))];
  if (!ids.length) return rows;
  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, username: true },
  });
  const map = Object.fromEntries(users.map((u) => [u.id, u]));
  return rows.map((r) => ({
    ...r,
    created_by_username: r[field] ? map[r[field]]?.username ?? null : null,
    created_by_display: r[field] ? map[r[field]]?.name || map[r[field]]?.username || `#${r[field]}` : null,
  }));
}

// --- Hospitals ---
router.get(
  '/hospitals',
  authenticateToken,
  requireAnyPermission('dialysis:view', 'dialysis:pharmacy:view', 'dialysis:pharmacy:dispense', 'dialysis:pharmacy:inventory'),
  async (req, res) => {
    const prisma = prismaOr503(res);
    if (!prisma) return;
    try {
      const scope = await loadDialysisScope(prisma, req.user);
      const list = await prisma.hospital.findMany({
        where: {
          isActive: 1,
          ...(scope.canSeeAll
            ? {}
            : scope.hospitalIds.length
              ? { id: { in: scope.hospitalIds } }
              : { id: { in: [-1] } }),
        },
        orderBy: { id: 'asc' },
      });
      res.json(list);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'فشل جلب المستشفيات' });
    }
  }
);

router.post(
  '/hospitals',
  authenticateToken,
  requirePermission('dialysis:hospital:manage'),
  async (req, res) => {
    const prisma = prismaOr503(res);
    if (!prisma) return;
    try {
      const { name, code, province, directorate, address } = req.body;
      if (!name) return res.status(400).json({ error: 'اسم المستشفى مطلوب' });
      const row = await prisma.hospital.create({
        data: {
          name,
          code,
          province,
          directorate,
          address,
          ...audit(req),
        },
      });

      await prisma.dialysisWarehouse.createMany({
        data: [
          {
            hospitalId: row.id,
            type: 'GENERAL_MEDICAL',
            name: 'مستودع مستلزمات عامة',
            ...audit(req),
          },
          {
            hospitalId: row.id,
            type: 'PHARMACY',
            name: 'مستودع صيدلية',
            ...audit(req),
          },
        ],
      });

      res.status(201).json(row);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'فشل إنشاء المستشفى' });
    }
  }
);

/** تعطيل/تفعيل مستشفى (لا يحذف البيانات) — is_active: 0 | 1 */
router.patch(
  '/hospitals/:id',
  authenticateToken,
  requirePermission('dialysis:hospital:manage'),
  async (req, res) => {
    const prisma = prismaOr503(res);
    if (!prisma) return;
    try {
      const hid = parseInt(req.params.id, 10);
      if (Number.isNaN(hid)) {
        return res.status(400).json({ error: 'معرّف مستشفى غير صالح' });
      }
      const scope = await loadDialysisScope(prisma, req.user);
      if (!scope.canSeeAll && !scope.hospitalIds.includes(hid)) {
        return res.status(403).json({ error: 'لا صلاحية لهذا المستشفى' });
      }
      const { is_active, name, code, province, directorate, address } = req.body;
      const data = {};
      if (is_active !== undefined) data.isActive = is_active ? 1 : 0;
      if (name !== undefined) data.name = name;
      if (code !== undefined) data.code = code;
      if (province !== undefined) data.province = province;
      if (directorate !== undefined) data.directorate = directorate;
      if (address !== undefined) data.address = address;
      if (!Object.keys(data).length) {
        return res.status(400).json({ error: 'لا حقول للتحديث' });
      }
      const row = await prisma.hospital.update({
        where: { id: hid },
        data: { ...data, ...audit(req) },
      });
      res.json(row);
    } catch (e) {
      if (e.code === 'P2025') {
        return res.status(404).json({ error: 'المستشفى غير موجود' });
      }
      console.error(e);
      res.status(500).json({ error: 'فشل تحديث المستشفى' });
    }
  }
);

// --- Patients ---
router.get(
  '/patients',
  authenticateToken,
  requireAnyPermission(
    'dialysis:view',
    'dialysis:pharmacy:view',
    'dialysis:pharmacy:dispense',
    'dialysis:pharmacy:inventory'
  ),
  async (req, res) => {
    const prisma = prismaOr503(res);
    if (!prisma) return;
    try {
      const ds = await resolveDialysisDataScope(prisma, req, res);
      if (!ds) return;
      const hospitalClause =
        ds.mode === 'multi' ? { in: ds.hospitalIds } : ds.hospitalId;

      const limitRaw = parseInt(String(req.query.limit ?? ''), 10);
      const usePagination = Number.isFinite(limitRaw) && limitRaw > 0;
      const limit = usePagination ? Math.min(Math.max(limitRaw, 1), 100) : 500;
      const offset = usePagination
        ? Math.max(parseInt(String(req.query.offset ?? '0'), 10) || 0, 0)
        : 0;

      const { where, empty } = await buildPatientListWhere(prisma, req, hospitalClause);
      if (empty) {
        if (usePagination) {
          return res.json({ items: [], total: 0, limit, offset });
        }
        return res.json([]);
      }

      const total = usePagination ? await prisma.dialysisPatient.count({ where }) : undefined;

      let rows = await prisma.dialysisPatient.findMany({
        where,
        include: PATIENT_LIST_INCLUDE,
        orderBy: { updatedAt: 'desc' },
        ...(usePagination ? { skip: offset, take: limit } : { take: 500 }),
      });
      rows = await attachUsernames(prisma, rows);
      rows = await attachPatientSessionStats(prisma, rows, hospitalClause);
      const items = rows.map(stripPatientListRow);

      if (usePagination) {
        return res.json({ items, total, limit, offset });
      }
      res.json(items);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'فشل جلب مرضى الغسل الكلوي' });
    }
  }
);

router.get(
  '/patients/:id',
  authenticateToken,
  requirePermission('dialysis:view'),
  async (req, res) => {
    const prisma = prismaOr503(res);
    if (!prisma) return;
    try {
      const id = parseInt(req.params.id, 10);
      const ds = await resolveDialysisDataScope(prisma, req, res);
      if (!ds) return;
      const hospitalClause =
        ds.mode === 'multi' ? { in: ds.hospitalIds } : ds.hospitalId;
      let row = await prisma.dialysisPatient.findFirst({
        where: { id, hospitalId: hospitalClause },
        include: {
          hospital: { select: { id: true, name: true, code: true } },
        },
      });
      if (!row) return res.status(404).json({ error: 'المريض غير موجود' });
      row = (await attachUsernames(prisma, [row]))[0];
      res.json(stripFaceEmbeddingFromPatient(row));
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'فشل جلب المريض' });
    }
  }
);

/** ملف سريري مجمّع: المريض + الجلسات + الجداول + إحصاءات */
router.get(
  '/patients/:id/dossier',
  authenticateToken,
  requirePermission('dialysis:view'),
  async (req, res) => {
    const prisma = prismaOr503(res);
    if (!prisma) return;
    try {
      const id = parseInt(req.params.id, 10);
      if (Number.isNaN(id)) {
        return res.status(400).json({ error: 'معرّف المريض غير صالح' });
      }
      const ds = await resolveDialysisDataScope(prisma, req, res);
      if (!ds) return;
      const hospitalClause =
        ds.mode === 'multi' ? { in: ds.hospitalIds } : ds.hospitalId;

      const patient = await prisma.dialysisPatient.findFirst({
        where: { id, hospitalId: hospitalClause },
        include: {
          hospital: { select: { id: true, name: true, code: true } },
        },
      });
      if (!patient) return res.status(404).json({ error: 'المريض غير موجود' });

      const withUser = (await attachUsernames(prisma, [patient]))[0];
      const hid = patient.hospitalId;

      const sessionWhere = { dialysisPatientId: id, hospitalId: hid };
      const [sessionTotal, sessions] = await prisma.$transaction([
        prisma.dialysisSession.count({ where: sessionWhere }),
        prisma.dialysisSession.findMany({
          where: sessionWhere,
          include: {
            location: true,
            shiftSlot: true,
            machine: {
              select: {
                id: true,
                assetTag: true,
                model: true,
                serialNumber: true,
              },
            },
            hospital: { select: { id: true, name: true, code: true } },
            consumptions: {
              include: {
                item: { select: { id: true, name: true, sku: true, baseUnitLabel: true } },
              },
            },
            pharmacyDispense: {
              include: {
                lines: {
                  include: {
                    dialysisItem: {
                      select: { id: true, name: true, sku: true, baseUnitLabel: true },
                    },
                    drugCatalog: {
                      select: { id: true, drugName: true, drugNameAr: true, form: true, strength: true },
                    },
                  },
                  orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }],
                },
              },
            },
          },
          orderBy: [{ sessionDate: 'desc' }, { startedAt: 'desc' }],
          take: 500,
        }),
      ]);
      const sessionsWithUsers = await attachUsernames(prisma, sessions);

      const schedules = await prisma.dialysisPatientSchedule.findMany({
        where: { dialysisPatientId: id, hospitalId: hid },
        include: {
          shiftSlot: true,
          location: true,
        },
        orderBy: [{ dayOfWeek: 'asc' }, { shiftSlotId: 'asc' }],
      });

      const statisticalEntries = await prisma.dialysisStatisticalEntry.findMany({
        where: { dialysisPatientId: id, hospitalId: hid },
        orderBy: [{ sessionDate: 'desc' }, { shift: 'asc' }],
        take: 200,
      });
      const statisticalWithUsers = await attachUsernames(
        prisma,
        statisticalEntries
      );

      const byStatus = await prisma.dialysisSession.groupBy({
        by: ['status'],
        where: sessionWhere,
        _count: { _all: true },
      });
      const statusCounts = Object.fromEntries(
        byStatus.map((r) => [r.status, r._count._all])
      );

      const weightsPre = sessions
        .map((s) => (s.weightPreKg != null ? Number(s.weightPreKg) : null))
        .filter((x) => x != null && !Number.isNaN(x));
      const weightsPost = sessions
        .map((s) => (s.weightPostKg != null ? Number(s.weightPostKg) : null))
        .filter((x) => x != null && !Number.isNaN(x));

      const dispenseLineCount = sessions.reduce(
        (n, s) => n + (s.pharmacyDispense?.lines?.length ?? 0),
        0
      );
      const consumptionLineCount = sessions.reduce(
        (n, s) => n + (s.consumptions?.length ?? 0),
        0
      );

      /** سجل علاجات/صرف مجمّع (كل جلسة مع أدويتها) */
      const treatmentHistory = [];
      for (const s of sessions) {
        const sessionDate = s.sessionDate;
        const disp = s.pharmacyDispense;
        if (disp?.lines?.length) {
          for (const line of disp.lines) {
            const itemName =
              line.dialysisItem?.name ||
              line.drugCatalog?.drugNameAr ||
              line.drugCatalog?.drugName ||
              null;
            treatmentHistory.push({
              kind: 'PHARMACY_DISPENSE',
              sessionId: s.id,
              sessionDate,
              shift: s.shift,
              status: disp.status,
              itemName,
              quantity: line.quantity?.toString?.() ?? String(line.quantity),
              unitCode: line.dispenseUnitCode || line.dialysisItem?.baseUnitLabel || null,
              dosage: line.dosage,
              instructions: line.instructions,
              frequencyKind: line.frequencyKind,
            });
          }
        }
        if (s.consumptions?.length) {
          for (const c of s.consumptions) {
            treatmentHistory.push({
              kind: 'SESSION_CONSUMPTION',
              sessionId: s.id,
              sessionDate,
              shift: s.shift,
              itemName: c.item?.name || null,
              quantity: c.quantityBase?.toString?.() ?? String(c.quantityBase),
              unitCode: c.displayUnitCode || c.item?.baseUnitLabel || null,
            });
          }
        }
      }

      const stats = {
        sessionTotal,
        statusCounts,
        returnedSessions: sessions.length,
        dispenseLineCount,
        consumptionLineCount,
        treatmentHistoryCount: treatmentHistory.length,
        lastSessionDate: sessions[0]?.sessionDate ?? null,
        lastSessionStartedAt: sessions[0]?.startedAt ?? null,
        avgWeightPreKg:
          weightsPre.length > 0
            ? weightsPre.reduce((a, b) => a + b, 0) / weightsPre.length
            : null,
        avgWeightPostKg:
          weightsPost.length > 0
            ? weightsPost.reduce((a, b) => a + b, 0) / weightsPost.length
            : null,
        dialysisProgramStart: patient.dialysisStartDate,
      };

      res.json({
        patient: stripFaceEmbeddingFromPatient(withUser),
        sessions: sessionsWithUsers,
        schedules,
        statisticalEntries: statisticalWithUsers,
        treatmentHistory,
        stats,
      });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'فشل جلب الملف السريري' });
    }
  }
);

router.get(
  '/patients/:id/intake-hints',
  authenticateToken,
  requirePermission('dialysis:view'),
  async (req, res) => {
    const prisma = prismaOr503(res);
    if (!prisma) return;
    try {
      const id = parseInt(req.params.id, 10);
      const ds = await resolveDialysisDataScope(prisma, req, res);
      if (!ds) return;
      const hospitalClause =
        ds.mode === 'multi' ? { in: ds.hospitalIds } : ds.hospitalId;
      const dateStr = (req.query.date || '').toString().split('T')[0];
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        return res.status(400).json({ error: 'أرسل date بصيغة YYYY-MM-DD' });
      }
      const patient = await prisma.dialysisPatient.findFirst({
        where: { id, hospitalId: hospitalClause },
        select: { id: true, kind: true, fullName: true, hospitalId: true },
      });
      if (!patient) return res.status(404).json({ error: 'المريض غير موجود' });
      const hospitalId = patient.hospitalId;

      const dayDate = parseCalendarDateForDb(dateStr);
      const existingSession = dayDate
        ? await prisma.dialysisSession.findFirst({
            where: {
              hospitalId,
              dialysisPatientId: id,
              sessionDate: dayDate,
              status: { not: 'CANCELLED' },
            },
            select: { id: true, status: true, startedAt: true },
          })
        : null;

      if (patient.kind === 'EMERGENCY') {
        const todayY = todayYmdDialysis();
        const blocked = compareYmd(dateStr, todayY) > 0;
        return res.json({
          patientKind: 'EMERGENCY',
          isScheduleDay: false,
          previewIntakeKind: 'EMERGENCY',
          defaultLocationId: null,
          defaultShiftSlotId: null,
          suggestedStartedAt: null,
          registrationBlocked: blocked,
          registrationBlockedReason: blocked
            ? 'لا يمكن تخطيط أو تسجيل غسلة لتاريخ مستقبلي.'
            : null,
          scheduleRows: [],
          existingSession,
        });
      }

      const wd = localWeekdayFromYmd(dateStr);
      const scheduleRows = await prisma.dialysisPatientSchedule.findMany({
        where: { dialysisPatientId: id, hospitalId, dayOfWeek: wd, isActive: 1 },
        include: { location: true, shiftSlot: true },
        orderBy: { id: 'asc' },
      });
      const isScheduleDay = scheduleRows.length > 0;
      const first = scheduleRows[0];
      let suggestedStartedAt = null;
      let registrationBlocked = false;
      let registrationBlockedReason = null;
      const todayY = todayYmdDialysis();
      if (compareYmd(dateStr, todayY) > 0) {
        registrationBlocked = true;
        registrationBlockedReason = 'لا يمكن تخطيط أو تسجيل غسلة لتاريخ مستقبلي.';
      } else if (first?.shiftSlot) {
        const slotStart = dialysisWallMinutesToUtcDate(dateStr, first.shiftSlot.startMinutes);
        if (slotStart) {
          suggestedStartedAt = slotStart.toISOString();
          const nowMs = Date.now();
          if (compareYmd(dateStr, todayY) === 0 && slotStart.getTime() > nowMs) {
            registrationBlocked = true;
            registrationBlockedReason =
              'لم يبدأ وقت الشفت بعد — لا يمكن تسجيل الغسلة قبل بداية الشفت ضمن اليوم الحالي.';
          }
          if (slotStart.getTime() > nowMs) {
            suggestedStartedAt = new Date(nowMs).toISOString();
          }
        }
      }
      return res.json({
        patientKind: 'PERSISTENT',
        isScheduleDay,
        previewIntakeKind: isScheduleDay ? 'SCHEDULED' : 'OFF_SCHEDULE',
        defaultLocationId: first?.locationId ?? null,
        defaultShiftSlotId: first?.shiftSlotId ?? null,
        suggestedStartedAt,
        registrationBlocked,
        registrationBlockedReason,
        scheduleRows: scheduleRows.map((r) => ({
          locationId: r.locationId,
          shiftSlotId: r.shiftSlotId,
          hallName: r.location?.hallName,
          bedCode: r.location?.bedCode,
          slotName: r.shiftSlot?.name,
          startMinutes: r.shiftSlot?.startMinutes,
        })),
        existingSession,
      });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'فشل تلميحات الجلسة' });
    }
  }
);

router.post(
  '/patients',
  authenticateToken,
  requirePermission('dialysis:patient:create'),
  async (req, res) => {
    const prisma = prismaOr503(res);
    if (!prisma) return;
    try {
      const hospitalId = await requireDialysisHospital(prisma, req, res);
      if (hospitalId == null) return;
      const b = req.body;
      const kind = b.kind === 'PERSISTENT' ? 'PERSISTENT' : 'EMERGENCY';
      const schedulesIn = Array.isArray(b.schedules) ? b.schedules : [];

      if (kind === 'PERSISTENT') {
        const miss = validatePersistentFields(b);
        if (miss.length) {
          return res.status(400).json({ error: `بيانات المريض الدائم ناقصة: ${miss.join('، ')}` });
        }
        if (schedulesIn.length < 1) {
          return res.status(400).json({
            error: 'المريض الدائم يحتاج يوم غسل واحد على الأقل مع القاعة/السرير والشفت لكل يوم',
          });
        }
      } else {
        const miss = validateEmergencyFields(b);
        if (miss.length) {
          return res.status(400).json({ error: `بيانات المريض الطارئ ناقصة: ${miss.join('، ')}` });
        }
      }

      await assertUniqueBiometric(prisma, hospitalId, b.biometric_id, null);

      const row = await prisma.$transaction(async (tx) => {
        const created = await tx.dialysisPatient.create({
          data: {
            hospitalId,
            patientId: b.patient_id ?? null,
            kind,
            fullName: b.full_name,
            gender: b.gender ?? null,
            phone: b.phone ?? null,
            nationalId: b.national_id ?? null,
            biometricId: normBiometricId(b.biometric_id),
            companionName: b.companion_name ?? null,
            companionPhone: b.companion_phone ?? null,
            countryCode: b.country_code ?? 'IQ',
            provinceCode: b.province_code ?? null,
            city: b.city ?? null,
            addressLine: b.address_line ?? null,
            bloodGroup: b.blood_group ?? null,
            viralMarkersJson: b.viral_markers_json ?? undefined,
            notes: b.notes ?? null,
            birthDate: b.birth_date ? new Date(b.birth_date) : null,
            internalRecordNumber: b.internal_record_number ?? null,
            dialysisStartDate: b.dialysis_start_date ? new Date(b.dialysis_start_date) : null,
            kidneyFailureCause: b.kidney_failure_cause ?? null,
            vascularAccessType: b.vascular_access_type ?? null,
            vascularAccessSite: b.vascular_access_site ?? null,
            vascularAccessNote: b.vascular_access_note ?? null,
            targetDryWeightKg:
              b.target_dry_weight_kg != null ? new Prisma.Decimal(String(b.target_dry_weight_kg)) : null,
            sessionsPerWeek: b.sessions_per_week != null ? parseInt(String(b.sessions_per_week), 10) : null,
            sessionDurationMinutes:
              b.session_duration_minutes != null ? parseInt(String(b.session_duration_minutes), 10) : null,
            dialyzerModelDefault: b.dialyzer_model_default ?? null,
            bloodFlowTargetMlMin:
              b.blood_flow_target_ml_min != null ? parseInt(String(b.blood_flow_target_ml_min), 10) : null,
            anticoagulantStandard: b.anticoagulant_standard ?? null,
            labsFollowUpJson: b.labs_follow_up_json ?? undefined,
            photoUrl: b.photo_url ?? null,
            ...audit(req),
          },
        });

        if (kind === 'PERSISTENT' && schedulesIn.length > 0) {
          await createScheduleRowsInTx(tx, {
            hospitalId,
            patientId: created.id,
            rows: schedulesIn,
            req,
          });
        }

        return created;
      });

      res.status(201).json(row);
    } catch (e) {
      console.error(e);
      if (e.statusCode === 409) return res.status(409).json({ error: e.message });
      if (e.code === 'P2002') {
        return res.status(409).json({ error: 'معرف البصمة مكرر لهذا المستشفى' });
      }
      res.status(500).json({ error: e.message || 'فشل إنشاء المريض' });
    }
  }
);

router.patch(
  '/patients/:id/promote',
  authenticateToken,
  requirePermission('dialysis:patient:edit'),
  async (req, res) => {
    const prisma = prismaOr503(res);
    if (!prisma) return;
    try {
      const id = parseInt(req.params.id, 10);
      const b = req.body;
      const hospitalId = await requireDialysisHospital(prisma, req, res);
      if (hospitalId == null) return;
      const existing = await prisma.dialysisPatient.findFirst({ where: { id, hospitalId } });
      if (!existing) return res.status(404).json({ error: 'المريض غير موجود' });

      const merged = mergedPatientPayload(existing, {
        ...b,
        full_name: b.full_name !== undefined ? b.full_name : existing.fullName,
      });
      const miss = validatePersistentFields(merged);
      if (miss.length) {
        return res.status(400).json({
          error: `لا يمكن التحويل إلى دائم قبل إكمال: ${miss.join('، ')}`,
        });
      }
      await assertUniqueBiometric(prisma, hospitalId, merged.biometric_id, id);

      const schedCount = await prisma.dialysisPatientSchedule.count({
        where: { dialysisPatientId: id, hospitalId },
      });
      if (schedCount < 1) {
        return res.status(400).json({
          error: 'أضف جدول أيام الغسل (يوم واحد على الأقل) قبل التحويل إلى مريض دائم',
        });
      }

      const row = await prisma.dialysisPatient.update({
        where: { id },
        data: {
          kind: 'PERSISTENT',
          patientId: b.patient_id ?? undefined,
          nationalId: b.national_id ?? undefined,
          gender: b.gender ?? undefined,
          biometricId: normBiometricId(b.biometric_id ?? existing.biometricId),
          companionName: b.companion_name ?? undefined,
          companionPhone: b.companion_phone ?? undefined,
          countryCode: b.country_code ?? undefined,
          provinceCode: b.province_code ?? undefined,
          city: b.city ?? undefined,
          addressLine: b.address_line ?? undefined,
          birthDate: b.birth_date ? new Date(b.birth_date) : existing.birthDate,
          promotedAt: new Date(),
          ...audit(req),
        },
      });
      await logDialysisAudit(prisma, req, {
        action: 'patient_promote',
        entityType: 'dialysis_patient',
        entityId: id,
        summary: `ترقية المريض «${existing.fullName}» إلى دائم`,
        meta: { hospital_id: hospitalId, patient_name: existing.fullName },
      });
      res.json(row);
    } catch (e) {
      console.error(e);
      if (e.statusCode === 409) return res.status(409).json({ error: e.message });
      res.status(500).json({ error: 'فشل ترقية المريض' });
    }
  }
);

router.patch(
  '/patients/:id',
  authenticateToken,
  requirePermission('dialysis:patient:edit'),
  async (req, res) => {
    const prisma = prismaOr503(res);
    if (!prisma) return;
    try {
      const id = parseInt(req.params.id, 10);
      const b = req.body;
      const hospitalId = await requireDialysisHospital(prisma, req, res);
      if (hospitalId == null) return;
      const existing = await prisma.dialysisPatient.findFirst({ where: { id, hospitalId } });
      if (!existing) return res.status(404).json({ error: 'المريض غير موجود' });

      const nextKind =
        b.kind === 'PERSISTENT' || b.kind === 'EMERGENCY' ? b.kind : existing.kind;

      const merged = mergedPatientPayload(existing, b);
      if (nextKind === 'PERSISTENT') {
        const miss = validatePersistentFields(merged);
        if (miss.length) {
          return res.status(400).json({ error: `بيانات المريض الدائم ناقصة: ${miss.join('، ')}` });
        }
        const schedCount = await prisma.dialysisPatientSchedule.count({
          where: { dialysisPatientId: id, hospitalId },
        });
        if (schedCount < 1) {
          return res.status(400).json({
            error: 'المريض الدائم يحتاج جدول أيام غسل (يوم واحد على الأقل)',
          });
        }
      } else {
        const miss = validateEmergencyFields(merged);
        if (miss.length) {
          return res.status(400).json({ error: `بيانات المريض الطارئ ناقصة: ${miss.join('، ')}` });
        }
      }

      await assertUniqueBiometric(prisma, hospitalId, merged.biometric_id, id);

      const row = await prisma.dialysisPatient.update({
        where: { id },
        data: {
          fullName: b.full_name ?? undefined,
          gender: b.gender !== undefined ? b.gender : undefined,
          phone: b.phone ?? undefined,
          nationalId: b.national_id ?? undefined,
          biometricId:
            b.biometric_id !== undefined ? normBiometricId(b.biometric_id) : undefined,
          companionName: b.companion_name ?? undefined,
          companionPhone: b.companion_phone ?? undefined,
          countryCode: b.country_code !== undefined ? b.country_code : undefined,
          provinceCode: b.province_code ?? undefined,
          city: b.city ?? undefined,
          addressLine: b.address_line ?? undefined,
          bloodGroup: b.blood_group ?? undefined,
          viralMarkersJson: b.viral_markers_json !== undefined ? b.viral_markers_json : undefined,
          notes: b.notes ?? undefined,
          birthDate: b.birth_date ? new Date(b.birth_date) : b.birth_date === null ? null : undefined,
          internalRecordNumber: b.internal_record_number ?? undefined,
          kind: b.kind === 'PERSISTENT' || b.kind === 'EMERGENCY' ? b.kind : undefined,
          dialysisStartDate:
            b.dialysis_start_date !== undefined
              ? b.dialysis_start_date
                ? new Date(b.dialysis_start_date)
                : null
              : undefined,
          kidneyFailureCause: b.kidney_failure_cause !== undefined ? b.kidney_failure_cause : undefined,
          vascularAccessType: b.vascular_access_type !== undefined ? b.vascular_access_type : undefined,
          vascularAccessSite: b.vascular_access_site !== undefined ? b.vascular_access_site : undefined,
          vascularAccessNote: b.vascular_access_note !== undefined ? b.vascular_access_note : undefined,
          targetDryWeightKg:
            b.target_dry_weight_kg !== undefined
              ? b.target_dry_weight_kg === null
                ? null
                : new Prisma.Decimal(String(b.target_dry_weight_kg))
              : undefined,
          sessionsPerWeek:
            b.sessions_per_week !== undefined
              ? b.sessions_per_week === null
                ? null
                : parseInt(String(b.sessions_per_week), 10)
              : undefined,
          sessionDurationMinutes:
            b.session_duration_minutes !== undefined
              ? b.session_duration_minutes === null
                ? null
                : parseInt(String(b.session_duration_minutes), 10)
              : undefined,
          dialyzerModelDefault: b.dialyzer_model_default !== undefined ? b.dialyzer_model_default : undefined,
          bloodFlowTargetMlMin:
            b.blood_flow_target_ml_min !== undefined
              ? b.blood_flow_target_ml_min === null
                ? null
                : parseInt(String(b.blood_flow_target_ml_min), 10)
              : undefined,
          anticoagulantStandard: b.anticoagulant_standard !== undefined ? b.anticoagulant_standard : undefined,
          labsFollowUpJson: b.labs_follow_up_json !== undefined ? b.labs_follow_up_json : undefined,
          photoUrl: b.photo_url !== undefined ? b.photo_url : undefined,
          ...(nextKind === 'PERSISTENT' && existing.kind === 'EMERGENCY'
            ? { promotedAt: new Date() }
            : {}),
          ...audit(req),
        },
      });
      res.json(row);
    } catch (e) {
      console.error(e);
      if (e.statusCode === 409) return res.status(409).json({ error: e.message });
      if (e.code === 'P2002') {
        return res.status(409).json({ error: 'معرف البصمة مكرر لهذا المستشفى' });
      }
      res.status(500).json({ error: 'فشل تحديث المريض' });
    }
  }
);

router.get(
  '/patients/:id/schedules',
  authenticateToken,
  requirePermission('dialysis:view'),
  async (req, res) => {
    const prisma = prismaOr503(res);
    if (!prisma) return;
    try {
      const patientId = parseInt(req.params.id, 10);
      const hospitalId = await requireDialysisHospital(prisma, req, res);
      if (hospitalId == null) return;
      const rows = await prisma.dialysisPatientSchedule.findMany({
        where: { dialysisPatientId: patientId, hospitalId },
        include: {
          shiftSlot: true,
          location: true,
        },
        orderBy: [{ dayOfWeek: 'asc' }, { shiftSlotId: 'asc' }],
      });
      res.json(rows);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'فشل جلب جدول الغسل الأسبوعي' });
    }
  }
);

router.put(
  '/patients/:id/schedules',
  authenticateToken,
  requirePermission('dialysis:patient:edit'),
  async (req, res) => {
    const prisma = prismaOr503(res);
    if (!prisma) return;
    try {
      const patientId = parseInt(req.params.id, 10);
      const hospitalId = await requireDialysisHospital(prisma, req, res);
      if (hospitalId == null) return;
      const patient = await prisma.dialysisPatient.findFirst({
        where: { id: patientId, hospitalId },
      });
      if (!patient) return res.status(404).json({ error: 'المريض غير موجود' });

      const rows = Array.isArray(req.body.rows) ? req.body.rows : [];
      await prisma.$transaction(async (tx) => {
        await tx.dialysisPatientSchedule.deleteMany({
          where: { dialysisPatientId: patientId, hospitalId },
        });
        for (const r of rows) {
          const dayOfWeek = parseInt(r.day_of_week, 10);
          const shiftSlotId = parseInt(r.shift_slot_id, 10);
          const locationId = parseInt(r.location_id, 10);
          if (Number.isNaN(dayOfWeek) || Number.isNaN(shiftSlotId) || Number.isNaN(locationId)) {
            throw new Error('كل صف يحتاج day_of_week و shift_slot_id و location_id أرقاماً صحيحة');
          }
          const slot = await tx.dialysisShiftSlot.findFirst({
            where: { id: shiftSlotId, hospitalId, isActive: 1 },
          });
          if (!slot || slot.weekday !== dayOfWeek) {
            throw new Error(`شفت غير متوافق مع اليوم: يوم ${dayOfWeek} شفت ${shiftSlotId}`);
          }
          const loc = await tx.dialysisLocation.findFirst({
            where: { id: locationId, hospitalId, isActive: 1 },
          });
          if (!loc) throw new Error('موقع غير موجود');

          await tx.dialysisPatientSchedule.create({
            data: {
              hospitalId,
              dialysisPatientId: patientId,
              dayOfWeek,
              shiftSlotId,
              locationId,
              isActive: 1,
              ...audit(req),
            },
          });
        }
      });

      const out = await prisma.dialysisPatientSchedule.findMany({
        where: { dialysisPatientId: patientId, hospitalId },
        include: { shiftSlot: true, location: true },
      });
      res.json(out);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: e.message || 'فشل حفظ الجدول الأسبوعي' });
    }
  }
);

router.delete(
  '/patients/:id',
  authenticateToken,
  requirePermission('dialysis:patient:delete'),
  async (req, res) => {
    const prisma = prismaOr503(res);
    if (!prisma) return;
    try {
      const id = parseInt(req.params.id, 10);
      const hospitalId = await requireDialysisHospital(prisma, req, res);
      if (hospitalId == null) return;
      const exists = await prisma.dialysisPatient.findFirst({ where: { id, hospitalId } });
      if (!exists) return res.status(404).json({ error: 'المريض غير موجود' });
      await prisma.dialysisPatient.delete({ where: { id } });
      res.json({ ok: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'تعذر حذف المريض — قد توجد سجلات مرتبطة' });
    }
  }
);

router.post(
  '/patients/:id/photo',
  authenticateToken,
  requirePermission('dialysis:patient:edit'),
  (req, res, next) => {
    patientPhotoMulter.single('photo')(req, res, (err) => {
      if (err) return res.status(400).json({ error: err.message || 'فشل الرفع' });
      next();
    });
  },
  async (req, res) => {
    const prisma = prismaOr503(res);
    if (!prisma) return;
    try {
      const id = parseInt(req.params.id, 10);
      const hospitalId = await requireDialysisHospital(prisma, req, res);
      if (hospitalId == null) return;
      const patient = await prisma.dialysisPatient.findFirst({ where: { id, hospitalId } });
      if (!patient) return res.status(404).json({ error: 'المريض غير موجود' });
      if (!req.file) return res.status(400).json({ error: 'لم يُرفع ملف' });

      const photoUrl = `/uploads/dialysis-patients/${id}/${req.file.filename}`;
      const updated = await prisma.dialysisPatient.update({
        where: { id },
        data: { photoUrl, ...audit(req) },
      });
      res.json({ photo_url: photoUrl, patient: stripFaceEmbeddingFromPatient(updated) });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'فشل حفظ الصورة' });
    }
  }
);

/** حفظ صورة المريض من base64 — أكثر موثوقية من multipart على الموبايل */
router.post(
  '/patients/:id/photo-data',
  authenticateToken,
  requirePermission('dialysis:patient:edit'),
  async (req, res) => {
    const prisma = prismaOr503(res);
    if (!prisma) return;
    try {
      const id = parseInt(req.params.id, 10);
      const hospitalId = await requireDialysisHospital(prisma, req, res);
      if (hospitalId == null) return;
      const patient = await prisma.dialysisPatient.findFirst({ where: { id, hospitalId } });
      if (!patient) return res.status(404).json({ error: 'المريض غير موجود' });

      const portraitBuf = parsePortraitBase64(
        req.body?.portrait_jpeg_base64 ?? req.body?.portrait_base64
      );
      if (!portraitBuf) return res.status(400).json({ error: 'صورة غير صالحة' });

      const photoUrl = saveDialysisPatientPortraitBuffer(id, portraitBuf);
      const updated = await prisma.dialysisPatient.update({
        where: { id },
        data: { photoUrl, ...audit(req) },
      });
      res.json({
        photo_url: photoUrl,
        photoUrl,
        patient: stripFaceEmbeddingFromPatient(updated),
      });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'فشل حفظ الصورة' });
    }
  }
);

/** تسجيل بصمة وجه اختياري (embedding من المتصفح — لا يؤثر على البصمة/الجلسات الحالية) */
router.post(
  '/patients/:id/face-enroll',
  authenticateToken,
  requirePermission('dialysis:patient:edit'),
  async (req, res) => {
    const prisma = prismaOr503(res);
    if (!prisma) return;
    try {
      const id = parseInt(req.params.id, 10);
      if (!id) return res.status(400).json({ error: 'معرّف المريض غير صالح' });
      const hospitalId = await requireDialysisHospital(prisma, req, res);
      if (hospitalId == null) return;

      const patient = await prisma.dialysisPatient.findFirst({ where: { id, hospitalId } });
      if (!patient) return res.status(404).json({ error: 'المريض غير موجود' });

      const b = req.body;
      if (b.consent !== true && b.consent !== 1 && b.consent !== '1') {
        return res.status(400).json({ error: 'موافقة المريض على تسجيل الوجه مطلوبة' });
      }

      let embedding = null;
      let pairwise = null;
      const list = b.embeddings ?? b.embedding_list;
      if (Array.isArray(list) && list.length) {
        const validation = validateEnrollmentSamples(list);
        if (!validation.ok) {
          return res.status(400).json({ error: validation.error });
        }
        embedding = validation.embedding;
        pairwise = validation.pairwise;
      } else {
        const validation = validateEnrollmentSamples([b.embedding ?? b.face_embedding].filter(Boolean));
        if (!validation.ok) {
          return res.status(400).json({ error: validation.error || 'بصمة الوجه غير صالحة أو ناقصة' });
        }
        embedding = validation.embedding;
        pairwise = validation.pairwise;
      }
      if (!embedding) {
        return res.status(400).json({ error: 'بصمة الوجه غير صالحة أو ناقصة' });
      }

      const metaRaw = b.meta && typeof b.meta === 'object' ? b.meta : {};
      const probeList = Array.isArray(list) && list.length ? list : embedding ? [embedding] : [];
      const faceMeta = {
        pipeline_version: metaRaw.pipeline_version || CURRENT_PIPELINE_VERSION,
        camera_facing: metaRaw.camera_facing || 'environment',
        enroll_quality: metaRaw.enroll_quality ?? null,
        liveness_passed: Boolean(metaRaw.liveness_passed),
        sample_count: metaRaw.sample_count ?? probeList.length,
        pairwise_similarity: metaRaw.pairwise_similarity ?? pairwise ?? null,
        probe_embeddings: probeList,
        operating_mode: metaRaw.operating_mode || 'staff',
        enrolled_at: new Date().toISOString(),
      };

      const now = new Date();
      const portraitBuf = parsePortraitBase64(b.portrait_jpeg_base64 ?? b.portrait_base64);
      const updateData = {
        faceEmbeddingJson: embedding,
        faceEnrolledAt: now,
        faceConsentAt: now,
        faceEnrollMetaJson: faceMeta,
        ...audit(req),
      };
      if (portraitBuf) {
        updateData.photoUrl = saveDialysisPatientPortraitBuffer(id, portraitBuf);
      }

      const updated = await prisma.dialysisPatient.update({
        where: { id },
        data: updateData,
      });
      await logDialysisAudit(prisma, req, {
        action: 'face_enroll',
        entityType: 'dialysis_patient',
        entityId: id,
        summary: `تسجيل بصمة وجه للمريض «${patient.fullName}»`,
        meta: {
          hospital_id: hospitalId,
          patient_name: patient.fullName,
          sample_count: faceMeta.sample_count,
        },
      });
      res.json({
        ok: true,
        face_enrolled_at: now.toISOString(),
        patient: stripFaceEmbeddingFromPatient(updated),
      });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: e.message || 'فشل تسجيل الوجه' });
    }
  }
);

router.delete(
  '/patients/:id/face-enroll',
  authenticateToken,
  requirePermission('dialysis:patient:edit'),
  async (req, res) => {
    const prisma = prismaOr503(res);
    if (!prisma) return;
    try {
      const id = parseInt(req.params.id, 10);
      const hospitalId = await requireDialysisHospital(prisma, req, res);
      if (hospitalId == null) return;
      const patient = await prisma.dialysisPatient.findFirst({ where: { id, hospitalId } });
      if (!patient) return res.status(404).json({ error: 'المريض غير موجود' });

      const updated = await prisma.dialysisPatient.update({
        where: { id },
        data: {
          faceEmbeddingJson: null,
          faceEnrolledAt: null,
          faceConsentAt: null,
          faceEnrollMetaJson: null,
          ...audit(req),
        },
      });
      await logDialysisAudit(prisma, req, {
        action: 'face_enroll_clear',
        entityType: 'dialysis_patient',
        entityId: id,
        summary: `إزالة بصمة وجه للمريض «${patient.fullName}»`,
        meta: { hospital_id: hospitalId, patient_name: patient.fullName },
      });
      res.json({ ok: true, patient: stripFaceEmbeddingFromPatient(updated) });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'فشل إزالة تسجيل الوجه' });
    }
  }
);

/** مطابقة وجه — للاستخدام لاحقاً عند إنشاء الجلسة (لا يغيّر السلوك الحالي) */
router.post(
  '/patients/identify-face',
  authenticateToken,
  faceIdentifyLimiter,
  requireAnyPermission('dialysis:view', 'dialysis:session:create'),
  async (req, res) => {
    const prisma = prismaOr503(res);
    if (!prisma) return;
    try {
      const hospitalId = await requireDialysisHospital(prisma, req, res);
      if (hospitalId == null) return;

      const probeList = Array.isArray(req.body?.embeddings)
        ? req.body.embeddings
        : req.body?.embedding ?? req.body?.face_embedding
          ? [req.body.embedding ?? req.body.face_embedding]
          : [];

      if (!probeList.length) {
        return res.status(400).json({ error: 'بصمة الوجه للمطابقة غير صالحة' });
      }

      const rows = await prisma.dialysisPatient.findMany({
        where: {
          hospitalId,
          faceEnrolledAt: { not: null },
          faceEmbeddingJson: { not: null },
        },
        select: { id: true, fullName: true, faceEmbeddingJson: true, photoUrl: true, faceEnrollMetaJson: true },
        take: 2000,
      });

      const gallery = rows.map((r) => ({
        id: r.id,
        fullName: r.fullName,
        photoUrl: r.photoUrl,
        embedding: r.faceEmbeddingJson,
        meta: r.faceEnrollMetaJson,
      }));

      const topK = parseInt(String(req.body?.top_k ?? 5), 10) || 5;
      const result = identifyFaceStrict(probeList, gallery, {
        topK,
        autoThreshold: STAFF_AUTO_THRESHOLD,
        strongThreshold: STAFF_STRONG_THRESHOLD,
        verifyMinScore: STAFF_VERIFY_MIN_SCORE,
        minMargin: STAFF_MIN_MARGIN,
        strongMinMargin: STAFF_STRONG_MIN_MARGIN,
      });

      if (result.error) {
        logger.warn('dialysis.identify_face.rejected', {
          hospitalId,
          userId: req.user?.id ?? null,
          reason: result.error,
          enrolled_count: gallery.length,
        });
        return res.status(400).json({ error: result.error });
      }

      logger.info('dialysis.identify_face', {
        hospitalId,
        userId: req.user?.id ?? null,
        enrolled_count: gallery.length,
        probe_count: result.probe_count,
        match_count: result.matches?.length ?? 0,
        auto_match_id: result.auto_match?.patient_id ?? null,
        auto_match_reason: result.auto_match?.reason ?? null,
        top_score: result.matches?.[0]?.score ?? null,
      });

      res.json({
        matches: result.matches,
        enrolled_count: gallery.length,
        auto_match: result.auto_match,
        probe_count: result.probe_count,
        pipeline_version: CURRENT_PIPELINE_VERSION,
      });
    } catch (e) {
      logger.error('dialysis.identify_face.error', {
        userId: req.user?.id ?? null,
        message: e?.message,
      });
      console.error(e);
      res.status(500).json({ error: 'فشل مطابقة الوجه' });
    }
  }
);

/** إحصاءات تسجيل الوجه — للمتابعة التشغيلية */
router.get(
  '/patients/face-stats',
  authenticateToken,
  requireAnyPermission('dialysis:view', 'dialysis:patient:edit'),
  async (req, res) => {
    const prisma = prismaOr503(res);
    if (!prisma) return;
    try {
      const hospitalId = await requireDialysisHospital(prisma, req, res);
      if (hospitalId == null) return;

      const enrolled = await prisma.dialysisPatient.findMany({
        where: {
          hospitalId,
          faceEnrolledAt: { not: null },
          faceEmbeddingJson: { not: null },
        },
        select: { id: true, faceEnrollMetaJson: true },
      });

      const currentStaff = enrolled.filter((r) => isCurrentStaffPipeline(r.faceEnrollMetaJson)).length;
      const needsReenroll = enrolled.filter((r) => needsFaceReenrollment(r.faceEnrollMetaJson)).length;
      const backCamera = enrolled.filter(
        (r) => r.faceEnrollMetaJson && r.faceEnrollMetaJson.camera_facing === 'environment'
      ).length;

      const totalPatients = await prisma.dialysisPatient.count({ where: { hospitalId } });
      const withoutFace = await prisma.dialysisPatient.count({
        where: { hospitalId, faceEnrolledAt: null },
      });

      res.json({
        enrolled_count: enrolled.length,
        current_staff_count: currentStaff,
        needs_reenroll_count: needsReenroll,
        back_camera_count: backCamera,
        total_patients: totalPatients,
        without_face_count: withoutFace,
        pipeline_current: CURRENT_PIPELINE_VERSION,
      });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'فشل جلب إحصاءات الوجه' });
    }
  }
);

// --- Locations ---
router.get(
  '/locations',
  authenticateToken,
  requireAnyPermission(
    'dialysis:view',
    'dialysis:pharmacy:view',
    'dialysis:pharmacy:dispense',
    'dialysis:pharmacy:inventory'
  ),
  async (req, res) => {
    const prisma = prismaOr503(res);
    if (!prisma) return;
    try {
      const ds = await resolveDialysisDataScope(prisma, req, res);
      if (!ds) return;
      const hospitalClause =
        ds.mode === 'multi' ? { in: ds.hospitalIds } : ds.hospitalId;
      const rows = await prisma.dialysisLocation.findMany({
        where: { hospitalId: hospitalClause, isActive: 1 },
        include: {
          hospital: { select: { id: true, name: true, code: true } },
        },
        orderBy: [{ hospitalId: 'asc' }, { hallName: 'asc' }, { bedCode: 'asc' }],
      });
      res.json(rows);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'فشل جلب الأسرة' });
    }
  }
);

router.post(
  '/locations',
  authenticateToken,
  requirePermission('dialysis:location:manage'),
  async (req, res) => {
    const prisma = prismaOr503(res);
    if (!prisma) return;
    try {
      const hospitalId = await requireDialysisHospital(prisma, req, res);
      if (hospitalId == null) return;
      const { hall_name, bed_code } = req.body;
      if (!hall_name || !bed_code) return res.status(400).json({ error: 'hall_name و bed_code مطلوبان' });
      const row = await prisma.dialysisLocation.create({
        data: {
          hospitalId,
          hallName: hall_name,
          bedCode: bed_code,
          ...audit(req),
        },
      });
      res.status(201).json(row);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'فشل إنشاء السرير' });
    }
  }
);

router.post(
  '/locations/bulk',
  authenticateToken,
  requirePermission('dialysis:location:manage'),
  async (req, res) => {
    const prisma = prismaOr503(res);
    if (!prisma) return;
    try {
      const hospitalId = await requireDialysisHospital(prisma, req, res);
      if (hospitalId == null) return;
      const items = Array.isArray(req.body.locations) ? req.body.locations : [];
      if (!items.length) return res.status(400).json({ error: 'locations مطلوبة كمصفوفة' });
      const created = [];
      let order = 0;
      for (const it of items) {
        const hall_name = it.hall_name;
        const bed_code = it.bed_code;
        if (!hall_name || !bed_code) continue;
        order += 1;
        const row = await prisma.dialysisLocation.upsert({
          where: {
            hospitalId_hallName_bedCode: {
              hospitalId,
              hallName: hall_name,
              bedCode: bed_code,
            },
          },
          update: {
            isActive: 1,
            displayOrder: it.display_order ?? order,
            ...audit(req),
          },
          create: {
            hospitalId,
            hallName: hall_name,
            bedCode: bed_code,
            displayOrder: it.display_order ?? order,
            isActive: 1,
            ...audit(req),
          },
        });
        created.push(row);
      }
      res.status(201).json({ ok: true, count: created.length, locations: created });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'فشل الإنشاء الجماعي للأسرة' });
    }
  }
);

async function loadActiveHallBeds(prisma, hospitalId, hallName) {
  return prisma.dialysisLocation.findMany({
    where: { hospitalId, hallName, isActive: 1 },
    orderBy: [{ displayOrder: 'asc' }, { bedCode: 'asc' }, { id: 'asc' }],
  });
}

async function hallLocationBlockers(prisma, hospitalId, locationIds) {
  if (!locationIds.length) {
    return { schedules: 0, activeSessions: 0, machines: 0 };
  }
  const [schedules, activeSessions, machines] = await Promise.all([
    prisma.dialysisPatientSchedule.count({
      where: { hospitalId, locationId: { in: locationIds }, isActive: 1 },
    }),
    prisma.dialysisSession.count({
      where: { hospitalId, locationId: { in: locationIds }, status: 'ACTIVE' },
    }),
    prisma.dialysisMachine.count({
      where: { hospitalId, locationId: { in: locationIds }, isActive: 1 },
    }),
  ]);
  return { schedules, activeSessions, machines };
}

router.put(
  '/locations/hall',
  authenticateToken,
  requirePermission('dialysis:location:manage'),
  async (req, res) => {
    const prisma = prismaOr503(res);
    if (!prisma) return;
    try {
      const hospitalId = await requireDialysisHospital(prisma, req, res);
      if (hospitalId == null) return;

      const originalHallName = String(req.body.hall_name ?? '').trim();
      if (!originalHallName) return res.status(400).json({ error: 'hall_name مطلوب' });

      const newHallNameRaw = req.body.new_hall_name;
      let hallName =
        newHallNameRaw !== undefined && newHallNameRaw !== null
          ? String(newHallNameRaw).trim()
          : originalHallName;
      if (!hallName) return res.status(400).json({ error: 'اسم القاعة الجديد غير صالح' });

      let beds = await loadActiveHallBeds(prisma, hospitalId, originalHallName);
      if (!beds.length) return res.status(404).json({ error: 'القاعة غير موجودة أو معطّلة' });

      if (hallName !== originalHallName) {
        const otherHall = await prisma.dialysisLocation.findFirst({
          where: { hospitalId, hallName, isActive: 1 },
        });
        if (otherHall) {
          return res.status(400).json({ error: 'يوجد قاعة أخرى بنفس الاسم في هذا المستشفى' });
        }
        await prisma.dialysisLocation.updateMany({
          where: { hospitalId, hallName: originalHallName, isActive: 1 },
          data: { hallName, ...audit(req) },
        });
        beds = await loadActiveHallBeds(prisma, hospitalId, hallName);
      }

      if (req.body.bed_count !== undefined && req.body.bed_count !== null) {
        const target = Math.min(80, Math.max(1, parseInt(String(req.body.bed_count), 10)));
        if (!Number.isFinite(target)) {
          return res.status(400).json({ error: 'bed_count غير صالح' });
        }

        for (let i = 1; i <= target; i += 1) {
          await prisma.dialysisLocation.upsert({
            where: {
              hospitalId_hallName_bedCode: {
                hospitalId,
                hallName,
                bedCode: String(i),
              },
            },
            update: {
              isActive: 1,
              displayOrder: i,
              ...audit(req),
            },
            create: {
              hospitalId,
              hallName,
              bedCode: String(i),
              displayOrder: i,
              isActive: 1,
              ...audit(req),
            },
          });
        }

        const refreshed = await loadActiveHallBeds(prisma, hospitalId, hallName);
        const toDeactivate = refreshed.filter((b) => {
          const n = parseInt(String(b.bedCode), 10);
          return Number.isFinite(n) ? n > target : true;
        });

        if (toDeactivate.length) {
          const ids = toDeactivate.map((b) => b.id);
          const blockers = await hallLocationBlockers(prisma, hospitalId, ids);
          if (blockers.schedules > 0 || blockers.activeSessions > 0 || blockers.machines > 0) {
            return res.status(409).json({
              error:
                'لا يمكن تقليل عدد الأسرة: بعض الأسرة مرتبطة بجدول مريض أو جلسة نشطة أو جهاز غسيل. أزل الارتباط أولاً.',
              blockers,
            });
          }
          await prisma.dialysisLocation.updateMany({
            where: { id: { in: ids } },
            data: { isActive: 0, ...audit(req) },
          });
        }
      }

      const out = await loadActiveHallBeds(prisma, hospitalId, hallName);
      res.json({
        ok: true,
        hallName,
        bedCount: out.length,
        locations: out,
      });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: e.message || 'فشل تحديث القاعة' });
    }
  }
);

router.delete(
  '/locations/hall',
  authenticateToken,
  requirePermission('dialysis:location:manage'),
  async (req, res) => {
    const prisma = prismaOr503(res);
    if (!prisma) return;
    try {
      const hospitalId = await requireDialysisHospital(prisma, req, res);
      if (hospitalId == null) return;

      const hallName = String(req.body.hall_name ?? req.query.hall_name ?? '').trim();
      if (!hallName) return res.status(400).json({ error: 'hall_name مطلوب' });

      const beds = await loadActiveHallBeds(prisma, hospitalId, hallName);
      if (!beds.length) return res.status(404).json({ error: 'القاعة غير موجودة أو معطّلة' });

      const ids = beds.map((b) => b.id);
      const blockers = await hallLocationBlockers(prisma, hospitalId, ids);
      if (blockers.schedules > 0 || blockers.activeSessions > 0 || blockers.machines > 0) {
        return res.status(409).json({
          error:
            'لا يمكن حذف القاعة: مرتبطة بجدول مرضى أو جلسة نشطة أو جهاز. أزل الارتباط أولاً.',
          blockers,
        });
      }

      await prisma.dialysisLocation.updateMany({
        where: { id: { in: ids } },
        data: { isActive: 0, ...audit(req) },
      });

      res.json({ ok: true, deactivated: ids.length });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'فشل حذف القاعة' });
    }
  }
);

// --- Shift templates (شفتات يومية حسب يوم الأسبوع) ---
router.get(
  '/shift-slots',
  authenticateToken,
  requireAnyPermission(
    'dialysis:view',
    'dialysis:pharmacy:view',
    'dialysis:pharmacy:dispense',
    'dialysis:pharmacy:inventory'
  ),
  async (req, res) => {
    const prisma = prismaOr503(res);
    if (!prisma) return;
    try {
      const ds = await resolveDialysisDataScope(prisma, req, res);
      if (!ds) return;
      const hospitalClause =
        ds.mode === 'multi' ? { in: ds.hospitalIds } : ds.hospitalId;
      const weekdayRaw = req.query.weekday;
      const where = {
        hospitalId: hospitalClause,
        isActive: 1,
        ...(weekdayRaw !== undefined && weekdayRaw !== ''
          ? { weekday: parseInt(String(weekdayRaw), 10) }
          : {}),
      };
      const rows = await prisma.dialysisShiftSlot.findMany({
        where,
        include: {
          hospital: { select: { id: true, name: true, code: true } },
        },
        orderBy: [{ hospitalId: 'asc' }, { weekday: 'asc' }, { displayOrder: 'asc' }, { id: 'asc' }],
      });
      res.json(rows);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'فشل جلب الشفتات' });
    }
  }
);

router.post(
  '/shift-slots',
  authenticateToken,
  requirePermission('dialysis:location:manage'),
  async (req, res) => {
    const prisma = prismaOr503(res);
    if (!prisma) return;
    try {
      const hospitalId = await requireDialysisHospital(prisma, req, res);
      if (hospitalId == null) return;
      const b = req.body;
      if (b.weekday === undefined || !b.name) {
        return res.status(400).json({ error: 'weekday و name مطلوبان' });
      }
      const row = await prisma.dialysisShiftSlot.create({
        data: {
          hospitalId,
          weekday: parseInt(String(b.weekday), 10),
          name: String(b.name),
          startMinutes: parseInt(String(b.start_minutes ?? 0), 10),
          endMinutes: parseInt(String(b.end_minutes ?? 0), 10),
          capacityApprox: b.capacity_approx != null ? parseInt(String(b.capacity_approx), 10) : null,
          displayOrder: b.display_order != null ? parseInt(String(b.display_order), 10) : 0,
          isActive: 1,
          ...audit(req),
        },
      });
      res.status(201).json(row);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'فشل إنشاء الشفت' });
    }
  }
);

/** إنشاء نفس الشفت (اسم + أوقات) لعدة أيام دفعة واحدة */
router.post(
  '/shift-slots/batch',
  authenticateToken,
  requirePermission('dialysis:location:manage'),
  async (req, res) => {
    const prisma = prismaOr503(res);
    if (!prisma) return;
    try {
      const hospitalId = await requireDialysisHospital(prisma, req, res);
      if (hospitalId == null) return;
      const b = req.body;
      if (!b.name || String(b.name).trim() === '') {
        return res.status(400).json({ error: 'اسم الشفت مطلوب' });
      }
      const rawDays = Array.isArray(b.weekdays) ? b.weekdays : [];
      const weekdays = [
        ...new Set(
          rawDays
            .map((x) => parseInt(String(x), 10))
            .filter((n) => !Number.isNaN(n) && n >= 0 && n <= 6)
        ),
      ].sort((a, b2) => a - b2);
      if (!weekdays.length) {
        return res.status(400).json({ error: 'اختر يوماً واحداً على الأقل من أيام الأسبوع' });
      }

      const startMinutes = parseInt(String(b.start_minutes ?? 0), 10);
      const endMinutes = parseInt(String(b.end_minutes ?? 0), 10);
      const name = String(b.name).trim();

      const created = await prisma.$transaction(async (tx) => {
        const out = [];
        const conflicts = [];
        for (const weekday of weekdays) {
          const dup = await tx.dialysisShiftSlot.findFirst({
            where: { hospitalId, weekday, name, isActive: 1 },
          });
          if (dup) {
            conflicts.push(weekday);
            continue;
          }
          const row = await tx.dialysisShiftSlot.create({
            data: {
              hospitalId,
              weekday,
              name,
              startMinutes,
              endMinutes,
              capacityApprox:
                b.capacity_approx != null ? parseInt(String(b.capacity_approx), 10) : null,
              displayOrder: b.display_order != null ? parseInt(String(b.display_order), 10) : 0,
              isActive: 1,
              ...audit(req),
            },
          });
          out.push(row);
        }
        if (!out.length && conflicts.length) {
          throw new Error('DUPLICATE_ALL');
        }
        return { out, conflicts };
      });

      res.status(201).json({
        ok: true,
        count: created.out.length,
        slots: created.out,
        skippedWeekdays: created.conflicts.length ? created.conflicts : undefined,
      });
    } catch (e) {
      console.error(e);
      const msg = e && typeof e === 'object' && 'message' in e ? String(e.message) : '';
      if (msg === 'DUPLICATE_ALL') {
        return res.status(409).json({ error: 'يوجد شفت بنفس الاسم في الأيام المختارة' });
      }
      res.status(500).json({ error: msg || 'فشل إنشاء الشفتات' });
    }
  }
);

router.patch(
  '/shift-slots/:id',
  authenticateToken,
  requirePermission('dialysis:location:manage'),
  async (req, res) => {
    const prisma = prismaOr503(res);
    if (!prisma) return;
    try {
      const id = parseInt(req.params.id, 10);
      const b = req.body;
      const row = await prisma.dialysisShiftSlot.update({
        where: { id },
        data: {
          weekday: b.weekday !== undefined ? parseInt(String(b.weekday), 10) : undefined,
          name: b.name ?? undefined,
          startMinutes:
            b.start_minutes !== undefined ? parseInt(String(b.start_minutes), 10) : undefined,
          endMinutes: b.end_minutes !== undefined ? parseInt(String(b.end_minutes), 10) : undefined,
          capacityApprox:
            b.capacity_approx !== undefined
              ? b.capacity_approx === null
                ? null
                : parseInt(String(b.capacity_approx), 10)
              : undefined,
          displayOrder:
            b.display_order !== undefined ? parseInt(String(b.display_order), 10) : undefined,
          isActive: b.is_active !== undefined ? parseInt(String(b.is_active), 10) : undefined,
          ...audit(req),
        },
      });
      res.json(row);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'فشل تحديث الشفت' });
    }
  }
);

router.delete(
  '/shift-slots/:id',
  authenticateToken,
  requirePermission('dialysis:location:manage'),
  async (req, res) => {
    const prisma = prismaOr503(res);
    if (!prisma) return;
    try {
      const id = parseInt(req.params.id, 10);
      await prisma.dialysisShiftSlot.update({
        where: { id },
        data: { isActive: 0, ...audit(req) },
      });
      res.json({ ok: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'فشل تعطيل الشفت' });
    }
  }
);

// --- أجهزة الغسل (ربط بالسرير/القاعة) ---
router.get(
  '/machines',
  authenticateToken,
  requirePermission('dialysis:view'),
  async (req, res) => {
    const prisma = prismaOr503(res);
    if (!prisma) return;
    try {
      const ds = await resolveDialysisDataScope(prisma, req, res);
      if (!ds) return;
      const hospitalClause =
        ds.mode === 'multi' ? { in: ds.hospitalIds } : ds.hospitalId;
      const rows = await prisma.dialysisMachine.findMany({
        where: { hospitalId: hospitalClause, isActive: 1 },
        include: {
          location: { select: { hallName: true, bedCode: true } },
          hospital: { select: { id: true, name: true, code: true } },
        },
        orderBy: [{ hospitalId: 'asc' }, { id: 'asc' }],
      });
      res.json(rows);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'فشل جلب الأجهزة' });
    }
  }
);

router.post(
  '/machines',
  authenticateToken,
  requirePermission('dialysis:location:manage'),
  async (req, res) => {
    const prisma = prismaOr503(res);
    if (!prisma) return;
    try {
      const hospitalId = await requireDialysisHospital(prisma, req, res);
      if (hospitalId == null) return;
      const b = req.body;
      const row = await prisma.dialysisMachine.create({
        data: {
          hospitalId,
          locationId: b.location_id ?? null,
          assetTag: b.asset_tag ?? null,
          model: b.model ?? null,
          serialNumber: b.serial_number ?? null,
          maintenanceThresholdHours:
            b.maintenance_threshold_hours != null
              ? new Prisma.Decimal(String(b.maintenance_threshold_hours))
              : null,
          isActive: 1,
          ...audit(req),
        },
        include: { location: true },
      });
      res.status(201).json(row);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'فشل إنشاء الجهاز' });
    }
  }
);

router.patch(
  '/machines/:id',
  authenticateToken,
  requirePermission('dialysis:location:manage'),
  async (req, res) => {
    const prisma = prismaOr503(res);
    if (!prisma) return;
    try {
      const id = parseInt(req.params.id, 10);
      const hospitalId = await requireDialysisHospital(prisma, req, res);
      if (hospitalId == null) return;
      const existing = await prisma.dialysisMachine.findFirst({ where: { id, hospitalId } });
      if (!existing) return res.status(404).json({ error: 'الجهاز غير موجود' });
      const b = req.body;
      const row = await prisma.dialysisMachine.update({
        where: { id },
        data: {
          locationId: b.location_id !== undefined ? b.location_id : undefined,
          assetTag: b.asset_tag ?? undefined,
          model: b.model ?? undefined,
          serialNumber: b.serial_number ?? undefined,
          maintenanceThresholdHours:
            b.maintenance_threshold_hours !== undefined
              ? b.maintenance_threshold_hours === null
                ? null
                : new Prisma.Decimal(String(b.maintenance_threshold_hours))
              : undefined,
          isActive: b.is_active !== undefined ? parseInt(String(b.is_active), 10) : undefined,
          ...audit(req),
        },
        include: { location: true },
      });
      res.json(row);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'فشل تحديث الجهاز' });
    }
  }
);

// --- Items & warehouses (lists for forms) ---
router.get(
  '/warehouses',
  authenticateToken,
  requireAnyPermission('dialysis:view', 'dialysis:pharmacy:view', 'dialysis:pharmacy:dispense', 'dialysis:pharmacy:inventory'),
  async (req, res) => {
    const prisma = prismaOr503(res);
    if (!prisma) return;
    try {
      const hospitalId = await requireDialysisHospital(prisma, req, res);
      if (hospitalId == null) return;
      const warehouseType = parseWarehouseType(req.query.warehouse_type ?? req.query.type);
      const rows = await prisma.dialysisWarehouse.findMany({
        where: {
          hospitalId,
          isActive: 1,
          ...(warehouseType ? { type: warehouseType } : {}),
        },
      });
      res.json(rows);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'فشل جلب المستودعات' });
    }
  }
);

router.get(
  '/items',
  authenticateToken,
  requireAnyPermission('dialysis:view', 'dialysis:pharmacy:view', 'dialysis:pharmacy:dispense', 'dialysis:pharmacy:inventory'),
  async (req, res) => {
    const prisma = prismaOr503(res);
    if (!prisma) return;
    try {
      const hospitalId = await requireDialysisHospital(prisma, req, res);
      if (hospitalId == null) return;
      const warehouseType = parseWarehouseType(req.query.warehouse_type ?? req.query.type);
      const rows = await prisma.dialysisItem.findMany({
        where: {
          hospitalId,
          isActive: 1,
          ...itemWhereForWarehouseType(warehouseType),
        },
        orderBy: { name: 'asc' },
        include: { units: true },
      });
      res.json(rows);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'فشل جلب الأصناف' });
    }
  }
);

router.post(
  '/items',
  authenticateToken,
  requireAnyPermission('dialysis:location:manage', 'dialysis:pharmacy:inventory'),
  async (req, res) => {
    const prisma = prismaOr503(res);
    if (!prisma) return;
    try {
      const hospitalId = await requireDialysisHospital(prisma, req, res);
      if (hospitalId == null) return;
      const b = req.body;
      if (!b.name || !b.base_unit_label) {
        return res.status(400).json({ error: 'name و base_unit_label مطلوبان' });
      }
      const mk = b.measure_kind === 'WEIGHT_VOLUME' ? 'WEIGHT_VOLUME' : 'COUNT';
      const drugCatalogIdRaw = b.drug_catalog_id ?? b.drugCatalogId;
      const drugCatalogId =
        drugCatalogIdRaw !== undefined && drugCatalogIdRaw !== null && drugCatalogIdRaw !== ''
          ? parseInt(String(drugCatalogIdRaw), 10)
          : null;
      if (drugCatalogId != null && Number.isFinite(drugCatalogId)) {
        const dc = await prisma.drugCatalog.findFirst({
          where: { id: drugCatalogId, isActive: 1 },
        });
        if (!dc) return res.status(400).json({ error: 'دواء الكتالوج غير موجود أو غير نشط' });
      }
      const row = await prisma.$transaction(async (tx) => {
        const created = await tx.dialysisItem.create({
          data: {
            hospitalId,
            sku: b.sku ?? null,
            name: String(b.name),
            measureKind: mk,
            baseUnitLabel: String(b.base_unit_label),
            drugCatalogId:
              drugCatalogId != null && Number.isFinite(drugCatalogId) ? drugCatalogId : undefined,
            isActive: 1,
            ...audit(req),
          },
        });
        const ladder = b.packaging_ladder ?? b.packagingLadder;
        if (Array.isArray(ladder) && ladder.length) {
          await replaceItemUnits(
            tx,
            created.id,
            ladder,
            {
              baseUnitLabel: created.baseUnitLabel,
              inventoryBaseUnitCode: b.inventory_base_unit_code ?? b.inventoryBaseUnitCode,
              packagingDirection:
                b.packaging_direction ?? b.packagingDirection ?? 'largest_first',
            },
            audit(req)
          );
        }
        return tx.dialysisItem.findUnique({
          where: { id: created.id },
          include: { units: { orderBy: [{ levelOrder: 'asc' }, { id: 'asc' }] } },
        });
      });
      res.status(201).json(row);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'فشل إنشاء الصنف' });
    }
  }
);

router.patch(
  '/items/:itemId',
  authenticateToken,
  requireAnyPermission('dialysis:location:manage', 'dialysis:pharmacy:inventory'),
  async (req, res) => {
    const prisma = prismaOr503(res);
    if (!prisma) return;
    try {
      const hospitalId = await requireDialysisHospital(prisma, req, res);
      if (hospitalId == null) return;
      const itemId = parseInt(req.params.itemId, 10);
      if (!itemId) return res.status(400).json({ error: 'معرّف الصنف غير صالح' });

      const existing = await prisma.dialysisItem.findFirst({
        where: { id: itemId, hospitalId },
      });
      if (!existing) return res.status(404).json({ error: 'الصنف غير موجود' });

      const b = req.body;
      const data = {};

      if (b.name !== undefined) data.name = String(b.name);
      if (b.sku !== undefined) data.sku = b.sku ? String(b.sku).trim() : null;
      if (b.base_unit_label !== undefined || b.baseUnitLabel !== undefined) {
        data.baseUnitLabel = String(b.base_unit_label ?? b.baseUnitLabel);
      }
      if (b.measure_kind !== undefined || b.measureKind !== undefined) {
        const mk = String(b.measure_kind ?? b.measureKind);
        data.measureKind = mk === 'WEIGHT_VOLUME' ? 'WEIGHT_VOLUME' : 'COUNT';
      }
      const drugRaw = b.drug_catalog_id ?? b.drugCatalogId;
      if (drugRaw !== undefined) {
        if (drugRaw === null || drugRaw === '') {
          data.drugCatalogId = null;
        } else {
          const did = parseInt(String(drugRaw), 10);
          if (!Number.isFinite(did)) {
            return res.status(400).json({ error: 'معرّف كتالوج الدواء غير صالح' });
          }
          const dc = await prisma.drugCatalog.findFirst({
            where: { id: did, isActive: 1 },
          });
          if (!dc) return res.status(400).json({ error: 'دواء الكتالوج غير موجود أو غير نشط' });
          data.drugCatalogId = did;
        }
      }
      if (b.is_active !== undefined || b.isActive !== undefined) {
        const ia = b.is_active ?? b.isActive;
        data.isActive = ia === 1 || ia === true ? 1 : 0;
      }

      if (Object.keys(data).length === 0) {
        return res.status(400).json({ error: 'لا حقول للتحديث' });
      }

      const row = await prisma.dialysisItem.update({
        where: { id: itemId },
        data: { ...data, ...audit(req) },
        include: {
          drugCatalog: {
            select: { id: true, drugName: true, drugNameAr: true },
          },
        },
      });
      res.json(row);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: e.message || 'فشل تحديث الصنف' });
    }
  }
);

/** حذف صنف مع دفعاته وحركة المخزن (يُعطّل الصنف فقط إن وُجدت سجلات صرف سابقة) */
router.delete(
  '/items/:itemId',
  authenticateToken,
  requireAnyPermission('dialysis:location:manage', 'dialysis:pharmacy:inventory'),
  async (req, res) => {
    const prisma = prismaOr503(res);
    if (!prisma) return;
    try {
      const hospitalId = await requireDialysisHospital(prisma, req, res);
      if (hospitalId == null) return;
      const itemId = parseInt(req.params.itemId, 10);
      if (!itemId) return res.status(400).json({ error: 'معرّف الصنف غير صالح' });

      const result = await purgeDialysisItemInventory(prisma, itemId, hospitalId, audit(req));
      res.json({
        ok: true,
        message: result.itemRemoved
          ? 'تم حذف الصنف وكل دفعاته وحركة المخزن'
          : 'تم حذف الدفعات والحركة؛ بقي تعريف الصنف معطّلاً لوجود سجلات صرف سابقة',
        ...result,
      });
    } catch (e) {
      if (e.code === 404) return res.status(404).json({ error: e.message });
      console.error(e);
      res.status(500).json({ error: e.message || 'فشل حذف الصنف' });
    }
  }
);

router.get(
  '/items/:itemId/units',
  authenticateToken,
  requireAnyPermission('dialysis:view', 'dialysis:pharmacy:view', 'dialysis:pharmacy:dispense', 'dialysis:pharmacy:inventory'),
  async (req, res) => {
    const prisma = prismaOr503(res);
    if (!prisma) return;
    try {
      const hospitalId = await requireDialysisHospital(prisma, req, res);
      if (hospitalId == null) return;
      const itemId = parseInt(req.params.itemId, 10);
      const item = await prisma.dialysisItem.findFirst({
        where: { id: itemId, hospitalId },
        include: { units: { orderBy: [{ levelOrder: 'asc' }, { id: 'asc' }] } },
      });
      if (!item) return res.status(404).json({ error: 'الصنف غير موجود' });
      res.json({
        item_id: item.id,
        base_unit_label: item.baseUnitLabel,
        inventory_base_unit_code: item.inventoryBaseUnitCode,
        ladder: ladderFromUnits(item.units, item),
        units: item.units,
      });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'فشل جلب وحدات التعبئة' });
    }
  }
);

router.put(
  '/items/:itemId/units',
  authenticateToken,
  requireAnyPermission('dialysis:location:manage', 'dialysis:pharmacy:inventory'),
  async (req, res) => {
    const prisma = prismaOr503(res);
    if (!prisma) return;
    try {
      const hospitalId = await requireDialysisHospital(prisma, req, res);
      if (hospitalId == null) return;
      const itemId = parseInt(req.params.itemId, 10);
      const item = await prisma.dialysisItem.findFirst({ where: { id: itemId, hospitalId } });
      if (!item) return res.status(404).json({ error: 'الصنف غير موجود' });

      const ladder = req.body?.packaging_ladder ?? req.body?.packagingLadder ?? req.body?.ladder;
      if (!Array.isArray(ladder)) {
        return res.status(400).json({ error: 'packaging_ladder مطلوب (مصفوفة مستويات التعبئة)' });
      }

      const invCode = req.body?.inventory_base_unit_code ?? req.body?.inventoryBaseUnitCode;
      const units = await prisma.$transaction(async (tx) => {
        await replaceItemUnits(
          tx,
          itemId,
          ladder,
          {
            baseUnitLabel: item.baseUnitLabel,
            inventoryBaseUnitCode: invCode,
            packagingDirection:
              req.body?.packaging_direction ?? req.body?.packagingDirection ?? 'largest_first',
          },
          audit(req)
        );
        return loadItemUnits(tx, itemId);
      });
      const freshItem = await prisma.dialysisItem.findUnique({ where: { id: itemId } });
      res.json({
        item_id: itemId,
        inventory_base_unit_code: freshItem?.inventoryBaseUnitCode,
        ladder: ladderFromUnits(units, freshItem || {}),
        units,
      });
    } catch (e) {
      console.error(e);
      res.status(400).json({ error: e.message || 'فشل حفظ وحدات التعبئة' });
    }
  }
);

/** ملخص الرصيد المتبقي لكل صنف — عبر كل المستودعات أو مستودع واحد */
router.get(
  '/inventory/summary',
  authenticateToken,
  requireAnyPermission('dialysis:view', 'dialysis:pharmacy:view', 'dialysis:pharmacy:dispense', 'dialysis:pharmacy:inventory'),
  async (req, res) => {
    const prisma = prismaOr503(res);
    if (!prisma) return;
    try {
      const hospitalId = await requireDialysisHospital(prisma, req, res);
      if (hospitalId == null) return;
      const warehouseIdRaw = req.query.warehouse_id;
      const warehouseId =
        warehouseIdRaw !== undefined && warehouseIdRaw !== ''
          ? parseInt(String(warehouseIdRaw), 10)
          : null;
      if (warehouseIdRaw !== undefined && warehouseIdRaw !== '' && Number.isNaN(warehouseId)) {
        return res.status(400).json({ error: 'warehouse_id غير صالح' });
      }
      if (warehouseId) {
        const wh = await prisma.dialysisWarehouse.findFirst({ where: { id: warehouseId, hospitalId } });
        if (!wh) return res.status(404).json({ error: 'مستودع غير موجود' });
      }
      const warehouseTypeQuery = parseWarehouseType(req.query.warehouse_type ?? req.query.type);
      let scopeWarehouseType = warehouseTypeQuery;
      if (!scopeWarehouseType && warehouseId) {
        const whRow = await prisma.dialysisWarehouse.findFirst({
          where: { id: warehouseId, hospitalId },
          select: { type: true },
        });
        scopeWarehouseType = whRow?.type ?? null;
      }

      const items = await prisma.dialysisItem.findMany({
        where: {
          hospitalId,
          isActive: 1,
          ...itemWhereForWarehouseType(scopeWarehouseType),
        },
        select: {
          id: true,
          name: true,
          sku: true,
          baseUnitLabel: true,
          inventoryBaseUnitCode: true,
        },
        orderBy: { name: 'asc' },
      });

      const batches = await prisma.dialysisInventoryBatch.findMany({
        where: {
          hospitalId,
          ...(warehouseId ? { warehouseId } : {}),
          quantityRemainingBase: { gt: 0 },
        },
        select: { itemId: true, quantityRemainingBase: true },
      });

      const agg = new Map();
      for (const b of batches) {
        const q = new Prisma.Decimal(b.quantityRemainingBase.toString());
        const prev = agg.get(b.itemId) || { total: new Prisma.Decimal(0), batchCount: 0 };
        prev.total = prev.total.plus(q);
        prev.batchCount += 1;
        agg.set(b.itemId, prev);
      }

      const itemsOut = items.map((it) => {
        const a = agg.get(it.id);
        return {
          id: it.id,
          name: it.name,
          sku: it.sku,
          baseUnitLabel: it.baseUnitLabel,
          totalRemainingBase: a ? a.total.toString() : '0',
          batchCount: a ? a.batchCount : 0,
        };
      });

      res.json({
        warehouse_id: warehouseId,
        warehouse_type: scopeWarehouseType,
        items: itemsOut,
      });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'فشل جلب ملخص المخزون' });
    }
  }
);

router.get(
  '/inventory/batches',
  authenticateToken,
  requireAnyPermission('dialysis:view', 'dialysis:pharmacy:view', 'dialysis:pharmacy:dispense', 'dialysis:pharmacy:inventory'),
  async (req, res) => {
    const prisma = prismaOr503(res);
    if (!prisma) return;
    try {
      const hospitalId = await requireDialysisHospital(prisma, req, res);
      if (hospitalId == null) return;
      const warehouseId = req.query.warehouse_id ? parseInt(String(req.query.warehouse_id), 10) : null;
      const itemId = req.query.item_id ? parseInt(String(req.query.item_id), 10) : null;
      if (!warehouseId || Number.isNaN(warehouseId)) {
        return res.status(400).json({ error: 'warehouse_id مطلوب' });
      }
      const wh = await prisma.dialysisWarehouse.findFirst({ where: { id: warehouseId, hospitalId } });
      if (!wh) return res.status(404).json({ error: 'مستودع غير موجود' });
      const rows = await prisma.dialysisInventoryBatch.findMany({
        where: {
          hospitalId,
          warehouseId,
          ...(itemId && !Number.isNaN(itemId) ? { itemId } : {}),
          quantityRemainingBase: { gt: 0 },
        },
        include: {
          item: { select: { id: true, name: true, baseUnitLabel: true } },
        },
        orderBy: [{ expiryDate: 'asc' }, { id: 'asc' }],
        take: 500,
      });
      res.json(rows);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'فشل جلب الدفعات' });
    }
  }
);

router.post(
  '/inventory/batches',
  authenticateToken,
  requireAnyPermission('dialysis:location:manage', 'dialysis:pharmacy:inventory'),
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
          error: 'أدخل الكمية: quantity + unit_code (مثل 20 كرتون) أو quantity_remaining_base بالوحدة الأصغر',
        });
      }
      let qtyResolved;
      try {
        qtyResolved = await resolveQuantityToBase(prisma, itemId, b);
      } catch (err) {
        return res.status(400).json({ error: err.message });
      }
      const qty = qtyResolved.quantityBase;

      const parseCost = () => {
        const raw = b.unit_cost_per_base ?? b.unitCostPerBase;
        if (raw === undefined || raw === null || raw === '') return null;
        try {
          return new Prisma.Decimal(String(raw));
        } catch {
          return null;
        }
      };

      const row = await prisma.$transaction(async (tx) => {
        const wh = await tx.dialysisWarehouse.findFirst({ where: { id: warehouseId, hospitalId } });
        if (!wh) throw new Error('مستودع غير موجود');
        const it = await tx.dialysisItem.findFirst({ where: { id: itemId, hospitalId } });
        if (!it) throw new Error('صنف غير موجود');
        assertItemMatchesWarehouseType(it, wh.type);
        if (wh.type === 'PHARMACY') {
          const err = new Error('استلام أدوية الصيدلية يتم من «مخزن صيدلية الغسل» فقط');
          err.code = 400;
          throw err;
        }

        const unitCost = parseCost();
        const receiptNotes = b.receipt_notes ?? b.receiptNotes ?? null;
        const ledgerNoteParts = [b.note, receiptNotes, qtyResolved.formatted ? `وارد: ${qtyResolved.formatted}` : null].filter(
          Boolean
        );
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
            supplierName: (b.supplier_name ?? b.supplierName)
              ? String(b.supplier_name ?? b.supplierName).trim()
              : null,
            invoiceReference: (b.invoice_reference ?? b.invoiceRef)
              ? String(b.invoice_reference ?? b.invoiceRef).trim()
              : null,
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
        include: { item: { select: { name: true } } },
      });
      res.status(201).json(full);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: e.message || 'فشل استلام الدفعة' });
    }
  }
);

// --- Sessions (Source A) ---
router.get(
  '/sessions',
  authenticateToken,
  requirePermission('dialysis:view'),
  async (req, res) => {
    const prisma = prismaOr503(res);
    if (!prisma) return;
    try {
      const ds = await resolveDialysisDataScope(prisma, req, res);
      if (!ds) return;
      const hospIds = ds.mode === 'multi' ? ds.hospitalIds : [ds.hospitalId];
      const ac = await autoCompleteExpiredDialysisSessions(prisma, hospIds);
      notifyDialysisLiveAfterAutoComplete(req, ac);
      const hospitalClause =
        ds.mode === 'multi' ? { in: ds.hospitalIds } : ds.hospitalId;
      const where = buildDialysisSessionsWhere(hospitalClause, req.query);
      const limitRaw = parseInt(String(req.query.limit ?? '300'), 10);
      const take = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 500) : 300;
      const offsetRaw = parseInt(String(req.query.offset ?? ''), 10);
      const usePagination =
        req.query.paginated === '1' || req.query.paginated === 'true' || Number.isFinite(offsetRaw);
      const offset = usePagination ? Math.max(offsetRaw || 0, 0) : 0;

      const total = usePagination ? await prisma.dialysisSession.count({ where }) : undefined;

      let rows = await prisma.dialysisSession.findMany({
        where,
        include: SESSION_LIST_INCLUDE,
        orderBy: [{ sessionDate: 'desc' }, { startedAt: 'desc' }],
        ...(usePagination ? { skip: offset, take } : { take }),
      });
      rows = await attachUsernames(prisma, rows);

      if (usePagination) {
        return res.json({ items: rows, total, limit: take, offset });
      }
      res.json(rows);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'فشل جلب الجلسات' });
    }
  }
);

router.get(
  '/sessions/kpis',
  authenticateToken,
  requirePermission('dialysis:view'),
  async (req, res) => {
    const prisma = prismaOr503(res);
    if (!prisma) return;
    try {
      const ds = await resolveDialysisDataScope(prisma, req, res);
      if (!ds) return;
      const hospIds = ds.mode === 'multi' ? ds.hospitalIds : [ds.hospitalId];
      const ac = await autoCompleteExpiredDialysisSessions(prisma, hospIds);
      notifyDialysisLiveAfterAutoComplete(req, ac);
      const hospitalClause =
        ds.mode === 'multi' ? { in: ds.hospitalIds } : ds.hospitalId;
      const where = buildDialysisSessionsWhere(hospitalClause, req.query);

      const kpis = await aggregateDialysisSessionKpis(prisma, where);
      res.json(kpis);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'فشل إحصاء الجلسات' });
    }
  }
);

router.get(
  '/sessions/report-aggregates',
  authenticateToken,
  requirePermission('dialysis:view'),
  async (req, res) => {
    const prisma = prismaOr503(res);
    if (!prisma) return;
    try {
      const ds = await resolveDialysisDataScope(prisma, req, res);
      if (!ds) return;
      const hospIds = ds.mode === 'multi' ? ds.hospitalIds : [ds.hospitalId];
      const ac = await autoCompleteExpiredDialysisSessions(prisma, hospIds);
      notifyDialysisLiveAfterAutoComplete(req, ac);
      const hospitalClause =
        ds.mode === 'multi' ? { in: ds.hospitalIds } : ds.hospitalId;
      const where = buildDialysisSessionsWhere(hospitalClause, req.query);

      const rangeParams = {
        date_from: req.query.date_from,
        date_to: req.query.date_to,
      };

      const [kpis, charts, coverageRes] = await Promise.all([
        aggregateDialysisSessionKpis(prisma, where),
        aggregateReportSessionCharts(prisma, where),
        prisma.dialysisStatisticalEntry.findMany({
          where: {
            hospitalId: hospitalClause,
            ...(rangeParams.date_from && rangeParams.date_to
              ? {
                  sessionDate: {
                    gte: parseCalendarDateForDb(String(rangeParams.date_from).split('T')[0]),
                    lte: parseCalendarDateForDb(String(rangeParams.date_to).split('T')[0]),
                  },
                }
              : {}),
          },
          select: { dialysisPatientId: true, sessionDate: true, shift: true },
        }),
      ]);

      const coverageKeys = coverageRes.map(
        (e) => `${e.dialysisPatientId}|${sessionDateRowToYmd(e.sessionDate)}|${e.shift}`
      );

      const recon = await aggregateReportReconSummary(prisma, where, coverageKeys, []);

      res.json({
        kpis: {
          total: kpis.total,
          uniquePatients: kpis.uniquePatients,
          scheduled: kpis.intakeScheduled,
          unscheduled: kpis.intakeOffSchedule,
          emergency: kpis.intakeEmergency,
          morning: kpis.shiftMorning,
          evening: kpis.shiftEvening,
          active: kpis.active,
          completed: kpis.completed,
          cancelled: kpis.cancelled,
          ...recon,
        },
        byHall: charts.byHall,
        byHospital: charts.byHospital,
        halls: charts.halls,
      });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'فشل تجميع تقرير الجلسات' });
    }
  }
);

router.get(
  '/ministry/summary',
  authenticateToken,
  requirePermission('dialysis:view'),
  async (req, res) => {
    const prisma = prismaOr503(res);
    if (!prisma) return;
    try {
      const ds = await resolveDialysisDataScope(prisma, req, res);
      if (!ds) return;
      const fromRaw = (req.query.date_from || req.query.from || '').toString().split('T')[0];
      const toRaw = (req.query.date_to || req.query.to || '').toString().split('T')[0];
      if (!/^\d{4}-\d{2}-\d{2}$/.test(fromRaw) || !/^\d{4}-\d{2}-\d{2}$/.test(toRaw)) {
        return res.status(400).json({ error: 'أرسل date_from و date_to بصيغة YYYY-MM-DD' });
      }
      const fromD = parseCalendarDateForDb(fromRaw);
      const toD = parseCalendarDateForDb(toRaw);
      if (!fromD || !toD) return res.status(400).json({ error: 'تواريخ غير صالحة' });

      const hospIds = ds.mode === 'multi' ? ds.hospitalIds : [ds.hospitalId];
      const ac = await autoCompleteExpiredDialysisSessions(prisma, hospIds);
      notifyDialysisLiveAfterAutoComplete(req, ac);

      const summary = await buildMinistrySummary(prisma, hospIds, fromD, toD);
      res.json(summary);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'فشل تجميع لوحة الوزارة' });
    }
  }
);

router.get(
  '/ministry/export.xlsx',
  authenticateToken,
  requirePermission('dialysis:view'),
  async (req, res) => {
    const prisma = prismaOr503(res);
    if (!prisma) return;
    try {
      const ds = await resolveDialysisDataScope(prisma, req, res);
      if (!ds) return;
      const fromRaw = (req.query.date_from || req.query.from || '').toString().split('T')[0];
      const toRaw = (req.query.date_to || req.query.to || '').toString().split('T')[0];
      if (!/^\d{4}-\d{2}-\d{2}$/.test(fromRaw) || !/^\d{4}-\d{2}-\d{2}$/.test(toRaw)) {
        return res.status(400).json({ error: 'أرسل date_from و date_to بصيغة YYYY-MM-DD' });
      }
      const fromD = parseCalendarDateForDb(fromRaw);
      const toD = parseCalendarDateForDb(toRaw);
      if (!fromD || !toD) return res.status(400).json({ error: 'تواريخ غير صالحة' });

      const hospIds = ds.mode === 'multi' ? ds.hospitalIds : [ds.hospitalId];
      const buffer = await generateMinistryExcelBuffer(prisma, hospIds, fromD, toD);
      const filename = `ministry-dialysis-${fromRaw}_${toRaw}.xlsx`;
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(Buffer.from(buffer));
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'فشل تصدير تقرير الوزارة' });
    }
  }
);

/** SSE fallback for live hall — EventSource cannot send Authorization header. */
router.get(
  '/live/stream',
  authenticateTokenOrQuery,
  requirePermission('dialysis:view'),
  async (req, res) => {
    const prisma = prismaOr503(res);
    if (!prisma) return;
    try {
      const ds = await resolveDialysisDataScope(prisma, req, res);
      if (!ds) return;
      const hospitalIds = ds.mode === 'multi' ? ds.hospitalIds : [ds.hospitalId];

      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      if (typeof res.flushHeaders === 'function') res.flushHeaders();

      dialysisLiveHub.subscribe(hospitalIds, res);
      res.write(': connected\n\n');

      const heartbeat = setInterval(() => {
        try {
          res.write(': ping\n\n');
        } catch {
          clearInterval(heartbeat);
        }
      }, 25000);

      req.on('close', () => {
        clearInterval(heartbeat);
        dialysisLiveHub.unsubscribe(res);
      });
    } catch (e) {
      console.error(e);
      if (!res.headersSent) {
        res.status(500).json({ error: 'فشل بث القاعة المباشرة' });
      }
    }
  }
);

router.get(
  '/sessions/active',
  authenticateToken,
  requirePermission('dialysis:view'),
  async (req, res) => {
    const prisma = prismaOr503(res);
    if (!prisma) return;
    try {
      const ds = await resolveDialysisDataScope(prisma, req, res);
      if (!ds) return;
      const hospIds = ds.mode === 'multi' ? ds.hospitalIds : [ds.hospitalId];
      const ac = await autoCompleteExpiredDialysisSessions(prisma, hospIds);
      notifyDialysisLiveAfterAutoComplete(req, ac);
      const hospitalClause =
        ds.mode === 'multi' ? { in: ds.hospitalIds } : ds.hospitalId;
      const rows = await prisma.dialysisSession.findMany({
        where: { hospitalId: hospitalClause, status: 'ACTIVE' },
        include: SESSION_LIST_INCLUDE,
        orderBy: { startedAt: 'desc' },
      });
      res.json(rows);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'فشل جلب الجلسات النشطة' });
    }
  }
);

router.get(
  '/sessions/:id',
  authenticateToken,
  requirePermission('dialysis:view'),
  async (req, res) => {
    const prisma = prismaOr503(res);
    if (!prisma) return;
    try {
      const sid = parseInt(req.params.id, 10);
      const preview = await prisma.dialysisSession.findUnique({
        where: { id: sid },
        select: { hospitalId: true },
      });
      if (!preview) return res.status(404).json({ error: 'الجلسة غير موجودة' });
      const allowed = await assertRecordHospitalInDialysisScope(
        prisma,
        req,
        res,
        preview.hospitalId
      );
      if (allowed == null) return;
      const ac = await autoCompleteExpiredDialysisSessions(prisma, [preview.hospitalId]);
      notifyDialysisLiveAfterAutoComplete(req, ac);
      const row = await prisma.dialysisSession.findFirst({
        where: { id: sid },
        include: {
          hospital: { select: { id: true, name: true, code: true } },
          dialysisPatient: { select: { fullName: true, id: true } },
          location: true,
          machine: { include: { location: true } },
          shiftSlot: true,
          consumptions: {
            include: {
              item: { select: { name: true } },
              warehouse: { select: { name: true, type: true } },
              batch: { select: { lotNumber: true, expiryDate: true } },
            },
          },
        },
      });
      if (!row) return res.status(404).json({ error: 'الجلسة غير موجودة' });
      const [withUser] = await attachUsernames(prisma, [row]);
      res.json(withUser);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'فشل جلب الجلسة' });
    }
  }
);

router.post(
  '/sessions',
  authenticateToken,
  requirePermission('dialysis:session:create'),
  async (req, res) => {
    const prisma = prismaOr503(res);
    if (!prisma) return;
    try {
      const hospitalId = await requireDialysisHospital(prisma, req, res);
      if (hospitalId == null) return;
      const b = req.body;
      const sessionDateYmd = b.session_date
        ? String(b.session_date).split('T')[0]
        : (() => {
            const sessionDate = b.session_date ? new Date(b.session_date) : new Date();
            return `${sessionDate.getFullYear()}-${String(sessionDate.getMonth() + 1).padStart(2, '0')}-${String(
              sessionDate.getDate()
            ).padStart(2, '0')}`;
          })();
      const dialysisPatientId = parseInt(String(b.dialysis_patient_id), 10);
      const sessionDateForDb = parseCalendarDateForDb(sessionDateYmd);
      if (!sessionDateForDb) {
        return res.status(400).json({ error: 'تاريخ الجلسة غير صالح' });
      }

      const todayY = todayYmdDialysis();
      if (compareYmd(sessionDateYmd, todayY) > 0) {
        return res.status(400).json({
          error: 'لا يمكن تسجيل غسلة لتاريخ مستقبلي (غداً أو بعده).',
          code: 'SESSION_DATE_FUTURE',
        });
      }

      const startedAt = b.started_at ? new Date(b.started_at) : new Date();
      if (Number.isNaN(startedAt.getTime())) {
        return res.status(400).json({ error: 'وقت بدء الغسلة غير صالح' });
      }
      if (startedAt.getTime() > Date.now()) {
        return res.status(400).json({
          error: 'لا يمكن أن يكون وقت بدء الغسلة في المستقبل بالنسبة للوقت الحالي.',
          code: 'SESSION_START_FUTURE',
        });
      }

      const locationId = parseInt(String(b.location_id), 10);
      if (!locationId || Number.isNaN(locationId)) {
        return res.status(400).json({ error: 'القاعة/السرير (location_id) مطلوب لتسجيل الغسلة.' });
      }
      const location = await prisma.dialysisLocation.findFirst({
        where: { id: locationId, hospitalId, isActive: 1 },
        select: { id: true },
      });
      if (!location) {
        return res.status(400).json({ error: 'القاعة/السرير المحدد غير موجود أو غير نشط.' });
      }

      let shiftSlotId = b.shift_slot_id != null ? parseInt(String(b.shift_slot_id), 10) : null;
      let prefetchedSlot = null;
      if (shiftSlotId) {
        prefetchedSlot = await prisma.dialysisShiftSlot.findFirst({
          where: { id: shiftSlotId, hospitalId, isActive: 1 },
        });
        if (!prefetchedSlot) {
          return res.status(400).json({ error: 'شفت غير موجود أو غير نشط' });
        }
        const slotStart = dialysisWallMinutesToUtcDate(sessionDateYmd, prefetchedSlot.startMinutes);
        if (slotStart && compareYmd(sessionDateYmd, todayY) === 0 && slotStart.getTime() > Date.now()) {
          return res.status(400).json({
            error:
              'لم يبدأ وقت الشفت بعد — لا يمكن تسجيل الغسلة لهذا الشفت قبل وصول موعد بدايته ضمن اليوم الحالي.',
            code: 'SHIFT_NOT_STARTED_YET',
          });
        }
      }

      const intakeKind = await resolveSessionIntakeKind(prisma, {
        hospitalId,
        dialysisPatientId,
        sessionDateYmd,
      });

      const patientMatchMethod = b.patient_match_method === 'FACE' ? 'FACE' : 'MANUAL';

      let shift = b.shift || shiftFromLocalDate(startedAt);
      if (prefetchedSlot) {
        shift = legacyShiftFromSlot(prefetchedSlot);
      }

      const result = await prisma.$transaction(async (tx) => {
        const dup = await tx.dialysisSession.findFirst({
          where: {
            hospitalId,
            dialysisPatientId,
            sessionDate: sessionDateForDb,
            status: { not: 'CANCELLED' },
          },
          select: { id: true },
        });
        if (dup) {
          const err = new Error(
            'يوجد للمريض جلسة في هذا اليوم. لا يُسمح بأكثر من غسلة واحدة لكل مريض في اليوم الواحد.'
          );
          err.code = 'DUPLICATE_SESSION_SAME_DAY';
          throw err;
        }

        if (shiftSlotId && !prefetchedSlot) {
          throw new Error('شفت غير موجود أو غير نشط');
        }

        const session = await tx.dialysisSession.create({
          data: {
            hospitalId,
            dialysisPatientId,
            sessionDate: sessionDateForDb,
            shift,
            shiftSlotId,
            intakeKind,
            patientMatchMethod,
            status: b.status || 'ACTIVE',
            startedAt,
            endedAt: b.ended_at ? new Date(b.ended_at) : null,
            locationId,
            machineId: b.machine_id ?? null,
            preSystolic: b.pre_systolic ?? null,
            preDiastolic: b.pre_diastolic ?? null,
            postSystolic: b.post_systolic ?? null,
            postDiastolic: b.post_diastolic ?? null,
            weightPreKg: b.weight_pre_kg != null ? new Prisma.Decimal(String(b.weight_pre_kg)) : null,
            weightPostKg: b.weight_post_kg != null ? new Prisma.Decimal(String(b.weight_post_kg)) : null,
            ufGoalMl: b.uf_goal_ml ?? null,
            heartRatePre: b.heart_rate_pre ?? null,
            heartRatePost: b.heart_rate_post ?? null,
            temperaturePreC:
              b.temperature_pre_c != null ? new Prisma.Decimal(String(b.temperature_pre_c)) : null,
            temperaturePostC:
              b.temperature_post_c != null ? new Prisma.Decimal(String(b.temperature_post_c)) : null,
            bloodFlowMlMin: b.blood_flow_ml_min ?? null,
            ktV: b.kt_v != null ? new Prisma.Decimal(String(b.kt_v)) : null,
            complicationsNote: b.complications_note ?? null,
            nursingNote: b.nursing_note ?? null,
            notes: b.notes ?? null,
            ...audit(req),
          },
        });

        const lines = Array.isArray(b.consumptions) ? b.consumptions : [];
        await applySessionConsumptionLines(tx, {
          hospitalId,
          sessionId: session.id,
          lines,
          req,
        });

        return session;
      });

      const full = await prisma.dialysisSession.findUnique({
        where: { id: result.id },
        include: { consumptions: true },
      });
      notifyDialysisLiveChange(req, hospitalId, 'session-created');
      res.status(201).json(full);
    } catch (e) {
      console.error(e);
      const code = typeof e === 'object' && e && 'code' in e ? e.code : '';
      if (code === 'DUPLICATE_SESSION_SAME_DAY') {
        return res.status(409).json({
          error:
            'يوجد للمريض جلسة في هذا اليوم. لا يُسمح بأكثر من غسلة واحدة لكل مريض في اليوم الواحد.',
          code: 'DUPLICATE_SESSION_SAME_DAY',
        });
      }
      res.status(500).json({ error: e.message || 'فشل إنشاء الجلسة' });
    }
  }
);

router.patch(
  '/sessions/:id',
  authenticateToken,
  requirePermission('dialysis:session:edit'),
  async (req, res) => {
    const prisma = prismaOr503(res);
    if (!prisma) return;
    try {
      const id = parseInt(req.params.id, 10);
      const b = req.body;
      const existing = await prisma.dialysisSession.findUnique({
        where: { id },
        select: { hospitalId: true, shiftSlotId: true, sessionDate: true, startedAt: true, shift: true },
      });
      if (!existing) return res.status(404).json({ error: 'الجلسة غير موجودة' });
      const hospitalId = await assertRecordHospitalInDialysisScope(
        prisma,
        req,
        res,
        existing.hospitalId
      );
      if (hospitalId == null) return;

      let effectiveSlotId = existing.shiftSlotId;
      if (b.shift_slot_id !== undefined) {
        if (b.shift_slot_id === null) {
          effectiveSlotId = null;
        } else {
          effectiveSlotId = parseInt(String(b.shift_slot_id), 10);
        }
      }
      let slotForCap = null;
      if (effectiveSlotId) {
        slotForCap = await prisma.dialysisShiftSlot.findFirst({
          where: { id: effectiveSlotId, hospitalId, isActive: 1 },
        });
      }

      const sessionYmd = sessionDateRowToYmd(existing.sessionDate);
      const startedRef = existing.startedAt ? new Date(existing.startedAt) : new Date();

      const clampSessionEndedAt = (candidate) => {
        let c = candidate instanceof Date ? candidate : new Date(candidate);
        if (Number.isNaN(c.getTime())) c = new Date();
        const now = new Date();
        if (c.getTime() > now.getTime()) c = now;
        const cap = computeDialysisSessionCapEndedAt(startedRef, sessionYmd, slotForCap);
        if (cap && c.getTime() > cap.getTime()) c = cap;
        if (c.getTime() < startedRef.getTime()) c = startedRef;
        return c;
      };

      let endedAtResolved = undefined;
      if (b.ended_at !== undefined) {
        if (b.ended_at === null) {
          endedAtResolved = null;
        } else {
          const cand = new Date(b.ended_at);
          if (Number.isNaN(cand.getTime())) {
            return res.status(400).json({ error: 'وقت انتهاء غير صالح' });
          }
          endedAtResolved = clampSessionEndedAt(cand);
        }
      } else if (b.status === 'COMPLETED') {
        endedAtResolved = clampSessionEndedAt(new Date());
      }

      const append = Array.isArray(b.consumptions_append) ? b.consumptions_append : [];

      await prisma.$transaction(async (tx) => {
        let shiftSlotId = existing.shiftSlotId;
        let shift = existing.shift;
        if (b.shift_slot_id !== undefined) {
          if (b.shift_slot_id === null) {
            shiftSlotId = null;
          } else {
            shiftSlotId = parseInt(String(b.shift_slot_id), 10);
            const slot = await tx.dialysisShiftSlot.findFirst({
              where: { id: shiftSlotId, hospitalId, isActive: 1 },
            });
            if (!slot) throw new Error('شفت غير موجود أو غير نشط');
            shift = legacyShiftFromSlot(slot);
          }
        }

        await tx.dialysisSession.update({
          where: { id },
          data: {
            status: b.status ?? undefined,
            ...(endedAtResolved !== undefined ? { endedAt: endedAtResolved } : {}),
            shiftSlotId: b.shift_slot_id !== undefined ? shiftSlotId : undefined,
            shift: b.shift_slot_id !== undefined ? shift : undefined,
            locationId: b.location_id !== undefined ? b.location_id : undefined,
            machineId: b.machine_id !== undefined ? b.machine_id : undefined,
            preSystolic: b.pre_systolic ?? undefined,
            preDiastolic: b.pre_diastolic ?? undefined,
            postSystolic: b.post_systolic ?? undefined,
            postDiastolic: b.post_diastolic ?? undefined,
            weightPreKg:
              b.weight_pre_kg !== undefined
                ? b.weight_pre_kg === null
                  ? null
                  : new Prisma.Decimal(String(b.weight_pre_kg))
                : undefined,
            weightPostKg:
              b.weight_post_kg !== undefined
                ? b.weight_post_kg === null
                  ? null
                  : new Prisma.Decimal(String(b.weight_post_kg))
                : undefined,
            ufGoalMl: b.uf_goal_ml !== undefined ? b.uf_goal_ml : undefined,
            heartRatePre: b.heart_rate_pre !== undefined ? b.heart_rate_pre : undefined,
            heartRatePost: b.heart_rate_post !== undefined ? b.heart_rate_post : undefined,
            temperaturePreC:
              b.temperature_pre_c !== undefined
                ? b.temperature_pre_c === null
                  ? null
                  : new Prisma.Decimal(String(b.temperature_pre_c))
                : undefined,
            temperaturePostC:
              b.temperature_post_c !== undefined
                ? b.temperature_post_c === null
                  ? null
                  : new Prisma.Decimal(String(b.temperature_post_c))
                : undefined,
            bloodFlowMlMin: b.blood_flow_ml_min !== undefined ? b.blood_flow_ml_min : undefined,
            ktV:
              b.kt_v !== undefined
                ? b.kt_v === null
                  ? null
                  : new Prisma.Decimal(String(b.kt_v))
                : undefined,
            complicationsNote: b.complications_note !== undefined ? b.complications_note : undefined,
            nursingNote: b.nursing_note !== undefined ? b.nursing_note : undefined,
            notes: b.notes !== undefined ? b.notes : undefined,
            ...audit(req),
          },
        });

        if (append.length) {
          await applySessionConsumptionLines(tx, { hospitalId, sessionId: id, lines: append, req });
        }
      });

      const full = await prisma.dialysisSession.findUnique({
        where: { id },
        include: {
          consumptions: {
            include: {
              item: { select: { name: true } },
              warehouse: { select: { name: true } },
            },
          },
        },
      });
      notifyDialysisLiveChange(req, hospitalId, 'session-updated');
      res.json(full);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: e.message || 'فشل تحديث الجلسة' });
    }
  }
);

router.delete(
  '/sessions/:id',
  authenticateToken,
  requirePermission('dialysis:session:delete'),
  async (req, res) => {
    const prisma = prismaOr503(res);
    if (!prisma) return;
    try {
      const id = parseInt(req.params.id, 10);
      const preview = await prisma.dialysisSession.findUnique({
        where: { id },
        select: { hospitalId: true },
      });
      if (!preview) return res.status(404).json({ error: 'الجلسة غير موجودة' });
      const hospitalId = await assertRecordHospitalInDialysisScope(
        prisma,
        req,
        res,
        preview.hospitalId
      );
      if (hospitalId == null) return;
      const exists = await prisma.dialysisSession.findFirst({
        where: { id, hospitalId },
        include: { dialysisPatient: { select: { fullName: true } } },
      });
      if (!exists) return res.status(404).json({ error: 'الجلسة غير موجودة' });
      await prisma.dialysisSession.delete({ where: { id } });
      await logDialysisAudit(prisma, req, {
        action: 'session_delete',
        entityType: 'dialysis_session',
        entityId: id,
        summary: `حذف جلسة #${id} — ${exists.dialysisPatient?.fullName || 'مريض'}`,
        meta: {
          hospital_id: hospitalId,
          patient_name: exists.dialysisPatient?.fullName,
          session_date: sessionDateRowToYmd(exists.sessionDate),
          shift: exists.shift,
        },
      });
      notifyDialysisLiveChange(req, hospitalId, 'session-deleted');
      res.json({ ok: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'فشل حذف الجلسة' });
    }
  }
);

router.get(
  '/audit-log',
  authenticateToken,
  requirePermission('dialysis:access:manage'),
  async (req, res) => {
    const prisma = prismaOr503(res);
    if (!prisma) return;
    try {
      const ds = await resolveDialysisDataScope(prisma, req, res);
      if (!ds) return;
      const hospIds = ds.mode === 'multi' ? ds.hospitalIds : [ds.hospitalId];

      const limitRaw = parseInt(String(req.query.limit ?? '50'), 10);
      const offsetRaw = parseInt(String(req.query.offset ?? '0'), 10);
      const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 200) : 50;
      const offset = Number.isFinite(offsetRaw) ? Math.max(offsetRaw, 0) : 0;
      const actionFilter = (req.query.action || '').toString().replace(DIALYSIS_AUDIT_PREFIX, '');

      const fromRaw = (req.query.date_from || '').toString().split('T')[0];
      const toRaw = (req.query.date_to || '').toString().split('T')[0];
      let createdAtWhere = undefined;
      if (/^\d{4}-\d{2}-\d{2}$/.test(fromRaw) && /^\d{4}-\d{2}-\d{2}$/.test(toRaw)) {
        const fromD = parseCalendarDateForDb(fromRaw);
        const toD = parseCalendarDateForDb(toRaw);
        if (fromD && toD) {
          const toEnd = new Date(toD);
          toEnd.setUTCHours(23, 59, 59, 999);
          createdAtWhere = { gte: fromD, lte: toEnd };
        }
      }

      const actionWhere = actionFilter
        ? { action: `${DIALYSIS_AUDIT_PREFIX}${actionFilter}` }
        : { action: { startsWith: DIALYSIS_AUDIT_PREFIX } };

      const rawRows = await prisma.activityLog.findMany({
        where: {
          ...actionWhere,
          ...(createdAtWhere ? { createdAt: createdAtWhere } : {}),
        },
        include: {
          user: { select: { id: true, name: true, username: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: Math.min(limit + offset + 200, 1000),
      });

      const filtered = rawRows.filter((row) => {
        const details = parseAuditDetails(row.details);
        const hid = details.hospital_id;
        if (hid == null) return true;
        return hospIds.includes(Number(hid));
      });

      const page = filtered.slice(offset, offset + limit).map((row) => {
        const details = parseAuditDetails(row.details);
        return {
          id: row.id,
          action: row.action,
          action_label: auditActionLabel(row.action),
          entity_type: row.entityType,
          entity_id: row.entityId,
          summary: details.summary || auditActionLabel(row.action),
          hospital_id: details.hospital_id ?? null,
          patient_name: details.patient_name ?? null,
          meta: details,
          created_at: row.createdAt,
          user: row.user
            ? { id: row.user.id, name: row.user.name, username: row.user.username }
            : null,
        };
      });

      res.json({
        items: page,
        total: filtered.length,
        limit,
        offset,
      });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'فشل جلب سجل التدقيق' });
    }
  }
);

// --- السجل الإحصائي (مصدر ب) — إدخال يدوي؛ لا يعتمد على جلسات الحوكمة ---
const statsWritePerms = requireAnyPermission('dialysis:stats:entry', 'dialysis:stats:bulk');

router.get(
  '/statistical/patient-lookup',
  authenticateToken,
  statsWritePerms,
  async (req, res) => {
    const prisma = prismaOr503(res);
    if (!prisma) return;
    try {
      const ds = await resolveDialysisDataScope(prisma, req, res);
      if (!ds) return;
      const hospitalClause =
        ds.mode === 'multi' ? { in: ds.hospitalIds } : ds.hospitalId;
      const search = (req.query.search || '').trim();
      const limitRaw = parseInt(String(req.query.limit ?? '300'), 10);
      const take = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 5000) : 300;
      const where = {
        hospitalId: hospitalClause,
        ...(search
          ? {
              OR: [
                { fullName: { contains: search, mode: 'insensitive' } },
                { phone: { contains: search } },
                { nationalId: { contains: search } },
                { biometricId: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      };
      const rows = await prisma.dialysisPatient.findMany({
        where,
        select: { id: true, fullName: true, kind: true, faceEnrolledAt: true },
        orderBy: { fullName: 'asc' },
        take,
      });
      res.json(rows.map((r) => stripFaceEmbeddingFromPatient(r)));
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'فشل البحث عن المرضى' });
    }
  }
);

router.get(
  '/statistical/entries',
  authenticateToken,
  statsWritePerms,
  async (req, res) => {
    const prisma = prismaOr503(res);
    if (!prisma) return;
    try {
      const ds = await resolveDialysisDataScope(prisma, req, res);
      if (!ds) return;
      const hospitalClause =
        ds.mode === 'multi' ? { in: ds.hospitalIds } : ds.hospitalId;
      const dateRaw = (req.query.date || '').toString().split('T')[0];
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateRaw)) {
        return res.status(400).json({ error: 'أرسل date بصيغة YYYY-MM-DD' });
      }
      const day = parseCalendarDateForDb(dateRaw);
      if (!day) return res.status(400).json({ error: 'تاريخ غير صالح' });

      const rows = await prisma.dialysisStatisticalEntry.findMany({
        where: { hospitalId: hospitalClause, sessionDate: day },
        include: {
          dialysisPatient: { select: { id: true, fullName: true } },
          hospital: { select: { id: true, name: true, code: true } },
        },
        orderBy: [{ createdAt: 'desc' }],
      });
      res.json(rows);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'فشل جلب السجل الإحصائي' });
    }
  }
);

/** مفاتيح (مريض|تاريخ|نوبة) الموجودة في السجل الإحصائي — للمطابقة مع الجلسات في التقارير */
router.get(
  '/statistical/coverage-keys',
  authenticateToken,
  requirePermission('dialysis:view'),
  async (req, res) => {
    const prisma = prismaOr503(res);
    if (!prisma) return;
    try {
      const ds = await resolveDialysisDataScope(prisma, req, res);
      if (!ds) return;
      const hospitalClause =
        ds.mode === 'multi' ? { in: ds.hospitalIds } : ds.hospitalId;
      const fromRaw = (req.query.date_from || req.query.from || '').toString().split('T')[0];
      const toRaw = (req.query.date_to || req.query.to || '').toString().split('T')[0];
      if (!/^\d{4}-\d{2}-\d{2}$/.test(fromRaw) || !/^\d{4}-\d{2}-\d{2}$/.test(toRaw)) {
        return res.status(400).json({ error: 'أرسل date_from و date_to بصيغة YYYY-MM-DD' });
      }
      const fromD = parseCalendarDateForDb(fromRaw);
      const toD = parseCalendarDateForDb(toRaw);
      if (!fromD || !toD) return res.status(400).json({ error: 'تواريخ غير صالحة' });

      const entries = await prisma.dialysisStatisticalEntry.findMany({
        where: {
          hospitalId: hospitalClause,
          sessionDate: { gte: fromD, lte: toD },
        },
        select: {
          dialysisPatientId: true,
          sessionDate: true,
          shift: true,
        },
      });
      const keys = entries.map(
        (e) => `${e.dialysisPatientId}|${sessionDateRowToYmd(e.sessionDate)}|${e.shift}`
      );
      res.json({ keys });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'فشل جلب تغطية الإحصاء' });
    }
  }
);

router.post(
  '/statistical/entry',
  authenticateToken,
  statsWritePerms,
  async (req, res) => {
    const prisma = prismaOr503(res);
    if (!prisma) return;
    try {
      const hospitalId = await requireDialysisHospital(prisma, req, res);
      if (hospitalId == null) return;
      const b = req.body;
      const pid = parseInt(String(b.dialysis_patient_id), 10);
      if (!pid) return res.status(400).json({ error: 'اختر المريض' });

      const sessionDate = parseCalendarDateForDb(String(b.session_date || '').split('T')[0]);
      if (!sessionDate) return res.status(400).json({ error: 'تاريخ غير صالح' });

      const shiftRaw = String(b.shift || 'MORNING').toUpperCase();
      const shift = shiftRaw === 'EVENING' ? 'EVENING' : 'MORNING';

      const patient = await prisma.dialysisPatient.findFirst({
        where: { id: pid, hospitalId },
      });
      if (!patient) return res.status(404).json({ error: 'المريض غير موجود في هذا المستشفى' });

      const row = await prisma.dialysisStatisticalEntry.upsert({
        where: {
          hospitalId_dialysisPatientId_sessionDate_shift: {
            hospitalId,
            dialysisPatientId: pid,
            sessionDate,
            shift,
          },
        },
        create: {
          hospitalId,
          dialysisPatientId: pid,
          sessionDate,
          shift,
          folderReference: b.folder_reference != null ? String(b.folder_reference) : null,
          notes: b.notes != null ? String(b.notes) : null,
          ...audit(req),
        },
        update: {
          folderReference: b.folder_reference !== undefined ? b.folder_reference : undefined,
          notes: b.notes !== undefined ? b.notes : undefined,
          ...audit(req),
        },
      });

      const full = await prisma.dialysisStatisticalEntry.findFirst({
        where: { id: row.id },
        include: { dialysisPatient: { select: { fullName: true, id: true } } },
      });
      res.status(201).json(full);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: e.message || 'فشل حفظ الإدخال الإحصائي' });
    }
  }
);

router.delete(
  '/statistical/entries/:id',
  authenticateToken,
  statsWritePerms,
  async (req, res) => {
    const prisma = prismaOr503(res);
    if (!prisma) return;
    try {
      const id = parseInt(req.params.id, 10);
      const hospitalId = await requireDialysisHospital(prisma, req, res);
      if (hospitalId == null) return;
      const row = await prisma.dialysisStatisticalEntry.findFirst({
        where: { id, hospitalId },
        include: { dialysisPatient: { select: { fullName: true } } },
      });
      if (!row) return res.status(404).json({ error: 'السجل غير موجود' });
      await prisma.dialysisStatisticalEntry.delete({ where: { id } });
      await logDialysisAudit(prisma, req, {
        action: 'stat_entry_delete',
        entityType: 'dialysis_stat_entry',
        entityId: id,
        summary: `حذف سطر إحصائي — ${row.dialysisPatient?.fullName || 'مريض'}`,
        meta: {
          hospital_id: hospitalId,
          patient_name: row.dialysisPatient?.fullName,
          session_date: sessionDateRowToYmd(row.sessionDate),
          shift: row.shift,
        },
      });
      res.json({ ok: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'فشل حذف السجل' });
    }
  }
);

// --- Bulk statistical (Source B) ---
router.post(
  '/statistical/bulk',
  authenticateToken,
  requirePermission('dialysis:stats:bulk'),
  async (req, res) => {
    const prisma = prismaOr503(res);
    if (!prisma) return;
    try {
      const hospitalId = await requireDialysisHospital(prisma, req, res);
      if (hospitalId == null) return;
      const entries = req.body.entries;
      if (!Array.isArray(entries) || !entries.length) {
        return res.status(400).json({ error: 'entries مطلوبة كمصفوفة' });
      }

      let created = 0;
      await prisma.$transaction(async (tx) => {
        for (const ent of entries) {
          const sessionDate = parseCalendarDateForDb(String(ent.session_date || '').split('T')[0]);
          if (!sessionDate) throw new Error('تاريخ غير صالح في أحد الإدخالات');
          const shift = ent.shift;
          const pid = ent.dialysis_patient_id;
          if (!pid || !shift) throw new Error('كل إدخال يحتاج dialysis_patient_id و shift');

          const row = await tx.dialysisStatisticalEntry.upsert({
            where: {
              hospitalId_dialysisPatientId_sessionDate_shift: {
                hospitalId,
                dialysisPatientId: pid,
                sessionDate,
                shift,
              },
            },
            create: {
              hospitalId,
              dialysisPatientId: pid,
              sessionDate,
              shift,
              folderReference: ent.folder_reference ?? null,
              notes: ent.notes ?? null,
              ...audit(req),
            },
            update: {
              folderReference: ent.folder_reference ?? undefined,
              notes: ent.notes ?? undefined,
              ...audit(req),
            },
          });

          await tx.dialysisStatisticalConsumption.deleteMany({
            where: { statisticalEntryId: row.id },
          });

          const lines = Array.isArray(ent.consumptions) ? ent.consumptions : [];
          for (const c of lines) {
            await tx.dialysisStatisticalConsumption.create({
              data: {
                hospitalId,
                statisticalEntryId: row.id,
                itemId: c.item_id,
                quantityBase: new Prisma.Decimal(String(c.quantity_base)),
                ...audit(req),
              },
            });
          }
          created += 1;
        }
      });

      res.json({ ok: true, processed: created });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: e.message || 'فشل الإدخال الإحصائي' });
    }
  }
);

// --- Reconciliation ---
router.get(
  '/reconciliation',
  authenticateToken,
  requirePermission('dialysis:reconciliation'),
  async (req, res) => {
    const prisma = prismaOr503(res);
    if (!prisma) return;
    try {
      const ds = await resolveDialysisDataScope(prisma, req, res);
      if (!ds) return;
      const hospitalClause =
        ds.mode === 'multi' ? { in: ds.hospitalIds } : ds.hospitalId;
      const from = req.query.from;
      const to = req.query.to;
      if (!from || !to) return res.status(400).json({ error: 'من parameter from و to (YYYY-MM-DD)' });

      const fromD = parseCalendarDateForDb(String(from).split('T')[0]);
      const toD = parseCalendarDateForDb(String(to).split('T')[0]);
      if (!fromD || !toD) return res.status(400).json({ error: 'من و إلى يجب أن يكونا بصيغة YYYY-MM-DD' });

      const sessions = await prisma.dialysisSession.findMany({
        where: {
          hospitalId: hospitalClause,
          sessionDate: { gte: fromD, lte: toD },
        },
        include: { consumptions: true },
      });

      const stats = await prisma.dialysisStatisticalEntry.findMany({
        where: {
          hospitalId: hospitalClause,
          sessionDate: { gte: fromD, lte: toD },
        },
        include: { consumptions: true },
      });

      const keyOf = (patientId, date, shift) =>
        `${patientId}|${new Date(date).toISOString().slice(0, 10)}|${shift}`;

      const aggConsumptions = (consumptions) => {
        const m = new Map();
        for (const c of consumptions) {
          const id = c.itemId;
          const q = new Prisma.Decimal(c.quantityBase.toString()).toNumber();
          m.set(id, (m.get(id) || 0) + q);
        }
        return m;
      };

      const mapA = new Map();
      for (const s of sessions) {
        const k = keyOf(s.dialysisPatientId, s.sessionDate, s.shift);
        if (!mapA.has(k)) {
          mapA.set(k, {
            key: k,
            dialysisPatientId: s.dialysisPatientId,
            sessionDate: s.sessionDate,
            shift: s.shift,
            items: new Map(),
          });
        }
        const bucket = mapA.get(k);
        for (const [itemId, qty] of aggConsumptions(s.consumptions)) {
          bucket.items.set(itemId, (bucket.items.get(itemId) || 0) + qty);
        }
      }

      const mapB = new Map();
      for (const s of stats) {
        const k = keyOf(s.dialysisPatientId, s.sessionDate, s.shift);
        const incoming = aggConsumptions(s.consumptions);
        if (!mapB.has(k)) {
          mapB.set(k, {
            key: k,
            dialysisPatientId: s.dialysisPatientId,
            sessionDate: s.sessionDate,
            shift: s.shift,
            items: incoming,
          });
        } else {
          const bucket = mapB.get(k);
          for (const [itemId, qty] of incoming) {
            bucket.items.set(itemId, (bucket.items.get(itemId) || 0) + qty);
          }
        }
      }

      const keysA = new Set(mapA.keys());
      const keysB = new Set(mapB.keys());

      const missedFolders = [...keysA]
        .filter((k) => !keysB.has(k))
        .map((k) => {
          const a = mapA.get(k);
          return {
            dialysisPatientId: a.dialysisPatientId,
            sessionDate: a.sessionDate,
            shift: a.shift,
          };
        });
      const ghostSessions = [...keysB]
        .filter((k) => !keysA.has(k))
        .map((k) => {
          const b = mapB.get(k);
          return {
            dialysisPatientId: b.dialysisPatientId,
            sessionDate: b.sessionDate,
            shift: b.shift,
          };
        });

      const supplyDiscrepancies = [];
      for (const k of keysA) {
        if (!keysB.has(k)) continue;
        const a = mapA.get(k);
        const b = mapB.get(k);
        const itemIds = new Set([...a.items.keys(), ...b.items.keys()]);
        for (const itemId of itemIds) {
          const qa = a.items.get(itemId) || 0;
          const qb = b.items.get(itemId) || 0;
          if (Math.abs(qa - qb) > 1e-6) {
            supplyDiscrepancies.push({
              key: k,
              dialysisPatientId: a.dialysisPatientId,
              sessionDate: a.sessionDate,
              shift: a.shift,
              item_id: itemId,
              quantity_field: qa,
              quantity_stats: qb,
              delta: qa - qb,
            });
          }
        }
      }

      const patientIds = [
        ...new Set([
          ...missedFolders.map((m) => m.dialysisPatientId),
          ...ghostSessions.map((m) => m.dialysisPatientId),
          ...supplyDiscrepancies.map((m) => m.dialysisPatientId),
        ]),
      ];
      const patients =
        patientIds.length > 0
          ? await prisma.dialysisPatient.findMany({
              where: { id: { in: patientIds } },
              select: { id: true, fullName: true },
            })
          : [];
      const pname = Object.fromEntries(patients.map((p) => [p.id, p.fullName]));

      const enrich = (rows) =>
        rows.map((r) => ({
          ...r,
          patient_name: pname[r.dialysisPatientId] || null,
        }));

      const scopeHospitalId = ds.mode === 'multi' ? 'all_my' : ds.hospitalId;

      res.json({
        period: { from, to },
        hospital_id: scopeHospitalId,
        missed_folders: enrich(missedFolders),
        ghost_sessions: enrich(ghostSessions),
        supply_discrepancies: supplyDiscrepancies.map((r) => ({
          ...r,
          patient_name: pname[r.dialysisPatientId] || null,
        })),
      });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'فشل المطابقة' });
    }
  }
);

// =============================================================================
// إدارة وصول الموظفين: صلاحيات dialysis:* تُحدَّد بمنح مباشر فقط (لا تُؤخذ من أدوار النظام الرئيسي)
// =============================================================================

/** شكل موحّد لاستجابة «مستخدم + صلاحيات غسل + مستشفيات» */
function dialysisUserAccessDto(u, hospitalAccessRows) {
  if (!u) return null;
  const direct = (u.directPermissions || [])
    .map((up) => up.permission.name)
    .filter((n) => n.startsWith('dialysis:'));
  const hospitalIds = hospitalAccessRows.map((x) => x.hospitalId);
  const primaryHospitalId = hospitalAccessRows.find((x) => x.isPrimary === 1)?.hospitalId ?? null;
  return {
    id: u.id,
    username: u.username,
    name: u.name,
    role: u.role,
    roleDisplay: u.roleRef?.displayName ?? null,
    isActive: u.isActive,
    /** لم تعد صلاحيات الغسيل تُستمد من الدور — القائمة للتوافق مع الواجهة فقط */
    rolePermissions: [],
    directPermissions: direct,
    effectivePermissions: direct,
    dialysisHospitalAccess: {
      hospitalIds,
      primaryHospitalId,
    },
  };
}

/** قائمة كل صلاحيات الغسل الكلوي المتاحة (التي تبدأ بـ dialysis:) */
router.get(
  '/access/permissions',
  authenticateToken,
  requirePermission('dialysis:access:manage'),
  async (req, res) => {
    const prisma = prismaOr503(res);
    if (!prisma) return;
    try {
      const perms = await prisma.permission.findMany({
        where: { name: { startsWith: 'dialysis:' } },
        orderBy: [{ category: 'asc' }, { displayName: 'asc' }],
      });
      res.json(perms);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'فشل جلب صلاحيات الغسل الكلوي' });
    }
  }
);

/** قائمة المستخدمين مع صلاحيات الغسيل المخزنة كمنح مباشر (user_permissions) */
router.get(
  '/access/users',
  authenticateToken,
  requirePermission('dialysis:access:manage'),
  async (req, res) => {
    const prisma = prismaOr503(res);
    if (!prisma) return;
    try {
      const search = (req.query.search || '').trim();
      const where = search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { username: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {};
      const users = await prisma.user.findMany({
        where,
        include: {
          roleRef: {
            include: { permissions: { include: { permission: true } } },
          },
          directPermissions: { include: { permission: true } },
        },
        orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
        take: 200,
      });

      const userIds = users.map((u) => u.id);
      const accRows = await prisma.userHospitalAccess.findMany({
        where: { userId: { in: userIds } },
        select: { userId: true, hospitalId: true, isPrimary: true },
      });
      const accByUser = new Map();
      for (const r of accRows) {
        if (!accByUser.has(r.userId)) accByUser.set(r.userId, []);
        accByUser.get(r.userId).push(r);
      }

      const out = users.map((u) => dialysisUserAccessDto(u, accByUser.get(u.id) || []));
      res.json(out);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'فشل جلب المستخدمين' });
    }
  }
);

/** مستخدم واحد بنفس شكل صف قائمة /access/users (لفتح التعديل من جدول المستشفيات) */
router.get(
  '/access/users/:id',
  authenticateToken,
  requirePermission('dialysis:access:manage'),
  async (req, res) => {
    const prisma = prismaOr503(res);
    if (!prisma) return;
    try {
      const userId = parseInt(req.params.id, 10);
      if (Number.isNaN(userId)) {
        return res.status(400).json({ error: 'معرّف مستخدم غير صالح' });
      }
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          roleRef: {
            include: { permissions: { include: { permission: true } } },
          },
          directPermissions: { include: { permission: true } },
        },
      });
      if (!user) return res.status(404).json({ error: 'المستخدم غير موجود' });
      const accRows = await prisma.userHospitalAccess.findMany({
        where: { userId },
        orderBy: [{ isPrimary: 'desc' }, { hospitalId: 'asc' }],
      });
      res.json(dialysisUserAccessDto(user, accRows));
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'فشل جلب المستخدم' });
    }
  }
);

/** إزالة ربط المستخدم بمستشفيات الغسيل + كل منح dialysis:* المخزنة (لا يحذف الحساب) */
router.delete(
  '/access/users/:id/dialysis',
  authenticateToken,
  requirePermission('dialysis:access:manage'),
  async (req, res) => {
    const prisma = prismaOr503(res);
    if (!prisma) return;
    try {
      const userId = parseInt(req.params.id, 10);
      if (Number.isNaN(userId)) {
        return res.status(400).json({ error: 'معرّف مستخدم غير صالح' });
      }
      if (userId === req.user.id) {
        return res.status(400).json({
          error: 'لا يمكنك إزالة ربطك بنفسك من هذه الشاشة',
        });
      }
      await prisma.$transaction([
        prisma.userHospitalAccess.deleteMany({ where: { userId } }),
        prisma.userPermission.deleteMany({
          where: { userId, permission: { name: { startsWith: 'dialysis:' } } },
        }),
      ]);
      res.json({ ok: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'فشل إزالة وصول الغسيل' });
    }
  }
);

/** مستخدمون نشطون لربطهم بمستشفى (بحث اختياري، استثناء من لديهم فعلاً وصول للمستشفى) */
router.get(
  '/access/user-pool',
  authenticateToken,
  requirePermission('dialysis:access:manage'),
  async (req, res) => {
    const prisma = prismaOr503(res);
    if (!prisma) return;
    try {
      const search = (req.query.search || '').trim();
      const excludeHospitalRaw = req.query.exclude_hospital_id;
      const excludeHospitalId =
        excludeHospitalRaw !== undefined && excludeHospitalRaw !== ''
          ? parseInt(String(excludeHospitalRaw), 10)
          : NaN;

      const where = {
        isActive: 1,
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { username: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
        ...(Number.isFinite(excludeHospitalId)
          ? {
              NOT: {
                userHospitalAccess: { some: { hospitalId: excludeHospitalId } },
              },
            }
          : {}),
      };

      const rows = await prisma.user.findMany({
        where,
        select: {
          id: true,
          username: true,
          name: true,
          role: true,
          roleRef: { select: { displayName: true } },
        },
        orderBy: [{ name: 'asc' }],
        take: 80,
      });
      res.json(
        rows.map((u) => ({
          id: u.id,
          username: u.username,
          name: u.name,
          role: u.role,
          roleDisplay: u.roleRef?.displayName ?? null,
        }))
      );
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'فشل جلب قائمة المستخدمين' });
    }
  }
);

/** ربط مستخدم موجود بمستشفى وحدة الغسيل */
router.post(
  '/access/hospital-members',
  authenticateToken,
  requirePermission('dialysis:access:manage'),
  async (req, res) => {
    const prisma = prismaOr503(res);
    if (!prisma) return;
    try {
      const userId = parseInt(String(req.body.user_id), 10);
      const hospitalId = parseInt(String(req.body.hospital_id), 10);
      const makePrimary = !!req.body.is_primary;
      if (!Number.isFinite(userId) || !Number.isFinite(hospitalId)) {
        return res.status(400).json({ error: 'user_id و hospital_id مطلوبان' });
      }

      const managerScope = await loadDialysisScope(prisma, req.user);
      if (!managerScope.canSeeAll && !managerScope.hospitalIds.includes(hospitalId)) {
        return res.status(403).json({ error: 'لا صلاحية لهذا المستشفى' });
      }

      const hosp = await prisma.hospital.findFirst({
        where: { id: hospitalId, isActive: 1 },
        select: { id: true },
      });
      if (!hosp) return res.status(400).json({ error: 'المستشفى غير موجود أو غير نشط' });

      const target = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
      if (!target) return res.status(404).json({ error: 'المستخدم غير موجود' });

      await prisma.$transaction(async (tx) => {
        const existing = await tx.userHospitalAccess.findUnique({
          where: { userId_hospitalId: { userId, hospitalId } },
        });
        if (!existing) {
          await tx.userHospitalAccess.create({
            data: { userId, hospitalId, isPrimary: makePrimary ? 1 : 0 },
          });
        } else if (makePrimary) {
          await tx.userHospitalAccess.updateMany({
            where: { userId },
            data: { isPrimary: 0 },
          });
          await tx.userHospitalAccess.update({
            where: { id: existing.id },
            data: { isPrimary: 1 },
          });
        }

        const all = await tx.userHospitalAccess.findMany({
          where: { userId },
          orderBy: [{ isPrimary: 'desc' }, { hospitalId: 'asc' }],
        });
        if (all.length === 1) {
          await tx.userHospitalAccess.update({
            where: { id: all[0].id },
            data: { isPrimary: 1 },
          });
        } else if (all.length > 1 && !all.some((r) => r.isPrimary === 1)) {
          await tx.userHospitalAccess.update({
            where: { id: all[0].id },
            data: { isPrimary: 1 },
          });
        }
      });

      res.status(201).json({ ok: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'فشل ربط المستخدم بالمستشفى' });
    }
  }
);

/** إلغاء ربط مستخدم بمستشفى محدد */
router.delete(
  '/access/hospital-members',
  authenticateToken,
  requirePermission('dialysis:access:manage'),
  async (req, res) => {
    const prisma = prismaOr503(res);
    if (!prisma) return;
    try {
      const userId = parseInt(String(req.body.user_id ?? req.query.user_id), 10);
      const hospitalId = parseInt(String(req.body.hospital_id ?? req.query.hospital_id), 10);
      if (!Number.isFinite(userId) || !Number.isFinite(hospitalId)) {
        return res.status(400).json({ error: 'user_id و hospital_id مطلوبان' });
      }

      const managerScope = await loadDialysisScope(prisma, req.user);
      if (!managerScope.canSeeAll && !managerScope.hospitalIds.includes(hospitalId)) {
        return res.status(403).json({ error: 'لا صلاحية لهذا المستشفى' });
      }

      await prisma.$transaction(async (tx) => {
        await tx.userHospitalAccess.deleteMany({ where: { userId, hospitalId } });
        const rem = await tx.userHospitalAccess.findMany({
          where: { userId },
          orderBy: { hospitalId: 'asc' },
        });
        if (rem.length && !rem.some((r) => r.isPrimary === 1)) {
          await tx.userHospitalAccess.update({
            where: { id: rem[0].id },
            data: { isPrimary: 1 },
          });
        }
      });

      res.json({ ok: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'فشل إلغاء الربط' });
    }
  }
);

/**
 * إنشاء مستخدم جديد في النظام مع ربطه بمستشفيات الغسيل (صلاحية إدارة الوصول)
 * يُسجَّل دائماً بدور تقني `dialysis_staff` (لا اختيار دور النظام الرئيسي — وحدة غسيل منفصلة).
 * body: { username, password, name, hospital_ids[], primary_hospital_id?, permissions?: string[] }
 */
router.post(
  '/access/users',
  authenticateToken,
  requirePermission('dialysis:access:manage'),
  async (req, res) => {
    const prisma = prismaOr503(res);
    if (!prisma) return;
    try {
      const managerScope = await loadDialysisScope(prisma, req.user);
      const {
        username,
        password,
        name,
        hospital_ids,
        primary_hospital_id,
        permissions: permBody,
      } = req.body;

      if (!username || !password || !name) {
        return res.status(400).json({ error: 'username و password و name مطلوبة' });
      }
      if (!Array.isArray(hospital_ids) || !hospital_ids.length) {
        return res.status(400).json({ error: 'حدد مستشفى واحداً على الأقل' });
      }

      const DIALYSIS_ONLY_ROLE = 'dialysis_staff';

      const hidSet = [
        ...new Set(
          hospital_ids.map((x) => parseInt(String(x), 10)).filter((n) => Number.isFinite(n))
        ),
      ];
      if (!hidSet.length) {
        return res.status(400).json({ error: 'معرّفات مستشفى غير صالحة' });
      }

      if (!managerScope.canSeeAll) {
        const ok = new Set(managerScope.hospitalIds);
        if (hidSet.some((id) => !ok.has(id))) {
          return res.status(403).json({ error: 'مستشفى خارج نطاق صلاحيتك' });
        }
      }

      const validH = await prisma.hospital.findMany({
        where: { id: { in: hidSet }, isActive: 1 },
        select: { id: true },
      });
      if (validH.length !== hidSet.length) {
        return res.status(400).json({ error: 'أحد المستشفيات غير موجود أو غير نشط' });
      }

      const uname = String(username).trim();
      const dup = await prisma.user.findUnique({ where: { username: uname } });
      if (dup) return res.status(409).json({ error: 'اسم المستخدم موجود مسبقاً' });

      if (String(password).length < 6) {
        return res.status(400).json({ error: 'كلمة المرور 6 أحرف على الأقل' });
      }

      const reqPerms = Array.isArray(permBody) ? permBody : [];
      const dialysisPerms = reqPerms.filter(
        (n) => typeof n === 'string' && n.startsWith('dialysis:')
      );
      if (
        !managerScope.canSeeAll &&
        reqPerms.some((n) => n === 'dialysis:scope:all_hospitals')
      ) {
        return res.status(403).json({
          error: 'لا يمكن منح صلاحية نطاق كل المستشفيات إلا لمشرف يملكها',
        });
      }

      let primaryId =
        primary_hospital_id != null && primary_hospital_id !== ''
          ? parseInt(String(primary_hospital_id), 10)
          : hidSet[0];
      if (!hidSet.includes(primaryId)) primaryId = hidSet[0];

      const roleRow = await prisma.role.findUnique({ where: { name: DIALYSIS_ONLY_ROLE } });
      if (!roleRow) {
        return res.status(503).json({
          error:
            'دور dialysis_staff غير موجود في قاعدة البيانات. شغّل البذور: npx prisma db seed',
        });
      }
      const hashed = await bcrypt.hash(String(password), 10);

      const knownPerms = dialysisPerms.length
        ? await prisma.permission.findMany({ where: { name: { in: dialysisPerms } } })
        : [];
      const wantedIds = knownPerms.map((p) => p.id);

      const newUser = await prisma.$transaction(async (tx) => {
        const u = await tx.user.create({
          data: {
            username: uname,
            password: hashed,
            role: DIALYSIS_ONLY_ROLE,
            roleId: roleRow.id,
            name: String(name).trim(),
            isActive: 1,
            createdBy: req.user?.id ?? null,
          },
        });
        await tx.userHospitalAccess.createMany({
          data: hidSet.map((hospitalId) => ({
            userId: u.id,
            hospitalId,
            isPrimary: hospitalId === primaryId ? 1 : 0,
          })),
        });
        if (wantedIds.length) {
          await tx.userPermission.createMany({
            data: wantedIds.map((permissionId) => ({
              userId: u.id,
              permissionId,
              grantedById: req.user?.id ?? null,
            })),
          });
        }
        return u;
      });

      res.status(201).json({ ok: true, id: newUser.id, username: newUser.username });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'فشل إنشاء المستخدم' });
    }
  }
);

/** دليل المستشفيات ضمن نطاق المشرف + الموظفون المرتبطون بكل مستشفى (إشراف مديرية / دائرة) */
router.get(
  '/access/hospitals-directory',
  authenticateToken,
  requirePermission('dialysis:access:manage'),
  async (req, res) => {
    const prisma = prismaOr503(res);
    if (!prisma) return;
    try {
      const scope = await loadDialysisScope(prisma, req.user);
      const search = (req.query.search || '').trim();
      const hospitalWhere = {
        isActive: 1,
        ...(scope.canSeeAll
          ? {}
          : scope.hospitalIds.length
            ? { id: { in: scope.hospitalIds } }
            : { id: { in: [-1] } }),
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { code: { contains: search, mode: 'insensitive' } },
                { province: { contains: search, mode: 'insensitive' } },
                { directorate: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      };

      const rows = await prisma.hospital.findMany({
        where: hospitalWhere,
        orderBy: [{ name: 'asc' }],
        include: {
          userAccess: {
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                  name: true,
                  role: true,
                  isActive: true,
                  roleRef: { select: { displayName: true } },
                },
              },
            },
            orderBy: [{ isPrimary: 'desc' }, { userId: 'asc' }],
          },
        },
      });

      const out = rows.map((h) => ({
        id: h.id,
        name: h.name,
        code: h.code,
        province: h.province,
        directorate: h.directorate,
        user_count: h.userAccess.length,
        users: h.userAccess.map((ua) => ({
          userId: ua.userId,
          username: ua.user.username,
          name: ua.user.name,
          role: ua.user.role,
          roleDisplay: ua.user.roleRef?.displayName ?? null,
          isPrimary: ua.isPrimary,
          isActive: ua.user.isActive,
        })),
      }));
      res.json(out);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'فشل جلب دليل المستشفيات' });
    }
  }
);

/**
 * تحديث منح المستخدم المباشر لصلاحيات الغسل الكلوي وربط المستشفيات.
 * body: { permissions: string[], hospital_ids?: number[], primary_hospital_id?: number|null }
 * — صلاحيات نشطة (dialysis:*). إن وُجدت hospital_ids تُستبدل صفوف user_hospital_access بالكامل.
 */
router.put(
  '/access/users/:id',
  authenticateToken,
  requirePermission('dialysis:access:manage'),
  async (req, res) => {
    const prisma = prismaOr503(res);
    if (!prisma) return;
    try {
      const userId = parseInt(req.params.id, 10);
      if (Number.isNaN(userId)) {
        return res.status(400).json({ error: 'معرّف مستخدم غير صالح' });
      }

      const managerScope = await loadDialysisScope(prisma, req.user);

      const reqPerms = Array.isArray(req.body.permissions) ? req.body.permissions : [];
      const dialysisPerms = reqPerms.filter(
        (n) => typeof n === 'string' && n.startsWith('dialysis:')
      );

      if (
        !managerScope.canSeeAll &&
        reqPerms.some((n) => n === 'dialysis:scope:all_hospitals')
      ) {
        return res.status(403).json({
          error: 'لا يمكن منح صلاحية نطاق كل المستشفيات إلا لمشرف يملكها',
        });
      }

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) return res.status(404).json({ error: 'المستخدم غير موجود' });

      const knownPerms = await prisma.permission.findMany({
        where: { name: { in: dialysisPerms } },
      });
      const wantedIds = knownPerms.map((p) => p.id);

      let normalizedHospitalIds = null;
      let primaryHospitalId = null;

      if (req.body.hospital_ids !== undefined) {
        if (!Array.isArray(req.body.hospital_ids)) {
          return res.status(400).json({ error: 'hospital_ids يجب أن تكون مصفوفة' });
        }
        normalizedHospitalIds = [
          ...new Set(
            req.body.hospital_ids
              .map((x) => parseInt(String(x), 10))
              .filter((n) => Number.isFinite(n))
          ),
        ];

        if (!managerScope.canSeeAll) {
          const allowed = new Set(managerScope.hospitalIds);
          if (normalizedHospitalIds.some((id) => !allowed.has(id))) {
            return res.status(403).json({
              error: 'لا يمكن ربط مستشفى خارج نطاق مستشفياتك المعتمدة',
            });
          }
        }

        const pr = req.body.primary_hospital_id;
        if (pr !== undefined && pr !== null && pr !== '') {
          primaryHospitalId = parseInt(String(pr), 10);
          if (!Number.isFinite(primaryHospitalId)) {
            return res.status(400).json({ error: 'primary_hospital_id غير صالح' });
          }
        }

        if (normalizedHospitalIds.length) {
          const validH = await prisma.hospital.findMany({
            where: { id: { in: normalizedHospitalIds }, isActive: 1 },
            select: { id: true },
          });
          const vset = new Set(validH.map((h) => h.id));
          if (normalizedHospitalIds.some((id) => !vset.has(id))) {
            return res.status(400).json({ error: 'أحد المستشفيات غير موجود أو غير نشط' });
          }
          if (primaryHospitalId != null && !normalizedHospitalIds.includes(primaryHospitalId)) {
            return res.status(400).json({
              error: 'المستشفى الافتراضي يجب أن يكون ضمن قائمة المستشفيات المحددة',
            });
          }
        }

        if (!normalizedHospitalIds.length) {
          primaryHospitalId = null;
        } else if (primaryHospitalId == null) {
          primaryHospitalId = normalizedHospitalIds[0];
        }
      }

      await prisma.$transaction(async (tx) => {
        await tx.userPermission.deleteMany({
          where: {
            userId,
            permission: { name: { startsWith: 'dialysis:' } },
          },
        });
        if (wantedIds.length) {
          await tx.userPermission.createMany({
            data: wantedIds.map((permissionId) => ({
              userId,
              permissionId,
              grantedById: req.user?.id ?? null,
            })),
          });
        }

        if (normalizedHospitalIds !== null) {
          await tx.userHospitalAccess.deleteMany({ where: { userId } });
          if (normalizedHospitalIds.length) {
            await tx.userHospitalAccess.createMany({
              data: normalizedHospitalIds.map((hospitalId) => ({
                userId,
                hospitalId,
                isPrimary: hospitalId === primaryHospitalId ? 1 : 0,
              })),
            });
          }
        }
      });

      res.json({
        ok: true,
        granted: knownPerms.map((p) => p.name),
        ...(normalizedHospitalIds !== null
          ? { hospital_ids: normalizedHospitalIds, primary_hospital_id: primaryHospitalId }
          : {}),
      });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'فشل تحديث صلاحيات الغسل الكلوي للمستخدم' });
    }
  }
);

router.use('/pharmacy', require('./dialysis-pharmacy'));

module.exports = router;
