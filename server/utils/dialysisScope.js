/**
 * نطاق مستشفيات وحدة الغسيل الكلوي لكل مستخدم:
 * - صلاحية dialysis:scope:all_hospitals أو دور admin = رؤية كل المستشفيات النشطة
 * - غير ذلك: فقط المستشفيات في user_hospital_access
 */

const SCOPE_ALL_PERM = 'dialysis:scope:all_hospitals';

async function loadPermissionNameSet(prisma, userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      roleRef: {
        include: { permissions: { include: { permission: true } } },
      },
      directPermissions: { include: { permission: true } },
    },
  });
  if (!user) return new Set();
  const roleNames = user.roleRef?.permissions?.map((rp) => rp.permission.name) ?? [];
  const directNames = user.directPermissions?.map((up) => up.permission.name) ?? [];
  const { mergeRoleAndDirectPermissionSet } = require('./mergeUserPermissions');
  return mergeRoleAndDirectPermissionSet(roleNames, directNames);
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ id: number, role?: string }} user — req.user من JWT
 */
async function loadDialysisScope(prisma, user) {
  const userId = user.id;
  const role = user.role;
  const perms = await loadPermissionNameSet(prisma, userId);
  const canSeeAll = role === 'admin' || perms.has(SCOPE_ALL_PERM);

  const accessRows = await prisma.userHospitalAccess.findMany({
    where: { userId },
    orderBy: [{ isPrimary: 'desc' }, { hospitalId: 'asc' }],
    select: { hospitalId: true, isPrimary: true },
  });
  const hospitalIds = accessRows.map((r) => r.hospitalId);
  const primaryRow = accessRows.find((r) => r.isPrimary === 1);
  const primaryHospitalId =
    primaryRow?.hospitalId ?? (hospitalIds.length === 1 ? hospitalIds[0] : null);

  return {
    canSeeAll,
    hospitalIds,
    primaryHospitalId,
  };
}

function attachDialysisScope(prisma, req) {
  if (!req._dialysisScopePromise) {
    req._dialysisScopePromise = loadDialysisScope(prisma, req.user);
  }
  return req._dialysisScopePromise;
}

/**
 * يحدد hospital_id للطلب مع التحقق من النطاق.
 * عند الخطأ يُرسل الاستجابة ويعيد null.
 * @returns {Promise<number|null>}
 */
async function requireDialysisHospital(prisma, req, res) {
  const scope = await attachDialysisScope(prisma, req);
  const raw = req.query?.hospital_id ?? req.body?.hospital_id ?? req.headers['x-hospital-id'];
  const parsed = raw !== undefined && raw !== null && raw !== '' ? parseInt(String(raw), 10) : NaN;

  if (Number.isFinite(parsed)) {
    const exists = await prisma.hospital.findFirst({
      where: { id: parsed, isActive: 1 },
      select: { id: true },
    });
    if (!exists) {
      res.status(400).json({ error: 'مستشفى غير موجود أو غير نشط' });
      return null;
    }
    if (scope.canSeeAll) return parsed;
    if (!scope.hospitalIds.length) {
      res.status(403).json({
        error: 'لم يُربط حسابك بأي مستشفى لوحدة الغسيل. راجع المشرف.',
      });
      return null;
    }
    if (!scope.hospitalIds.includes(parsed)) {
      res.status(403).json({ error: 'لا صلاحية للوصول إلى هذا المستشفى' });
      return null;
    }
    return parsed;
  }

  if (!scope.canSeeAll) {
    if (!scope.hospitalIds.length) {
      res.status(403).json({
        error: 'لم يُربط حسابك بأي مستشفى لوحدة الغسيل. راجع المشرف.',
      });
      return null;
    }
    if (scope.hospitalIds.length === 1) return scope.hospitalIds[0];
    if (scope.primaryHospitalId && scope.hospitalIds.includes(scope.primaryHospitalId)) {
      return scope.primaryHospitalId;
    }
    res.status(400).json({
      error: 'حدد المستشفى (hospital_id) — لديك أكثر من مستشفى مرتبط بحسابك',
    });
    return null;
  }

  if (scope.primaryHospitalId) {
    const ok = await prisma.hospital.findFirst({
      where: { id: scope.primaryHospitalId, isActive: 1 },
      select: { id: true },
    });
    if (ok) return scope.primaryHospitalId;
  }
  const first = await prisma.hospital.findFirst({
    where: { isActive: 1 },
    orderBy: { id: 'asc' },
    select: { id: true },
  });
  if (!first) {
    res.status(400).json({ error: 'لا توجد مستشفى نشط في النظام' });
    return null;
  }
  return first.id;
}

/**
 * حقول إضافية لاستجابة تسجيل الدخول و /me
 */
async function buildDialysisHospitalAuthFields(prisma, userRow) {
  const scope = await loadDialysisScope(prisma, {
    id: userRow.id,
    role: userRow.role,
  });
  let dialysisHospitalIds = scope.hospitalIds;
  if (scope.canSeeAll) {
    const all = await prisma.hospital.findMany({
      where: { isActive: 1 },
      orderBy: { id: 'asc' },
      select: { id: true },
    });
    dialysisHospitalIds = all.map((h) => h.id);
  }
  return {
    dialysisHospitalIds,
    dialysisCanSeeAllHospitals: scope.canSeeAll,
    dialysisPrimaryHospitalId: scope.primaryHospitalId,
  };
}

const ALL_MY_SENTINELS = new Set(['all_my', 'all']);

/**
 * نطاق جلب بيانات الغسيل: مستشفى واحد، أو دمج كل المستشفيات المسموحة عند hospital_id=all_my
 */
async function resolveDialysisDataScope(prisma, req, res) {
  const scope = await attachDialysisScope(prisma, req);
  const raw = req.query?.hospital_id ?? req.body?.hospital_id ?? req.headers['x-hospital-id'];
  const str = raw !== undefined && raw !== null ? String(raw).trim().toLowerCase() : '';

  if (ALL_MY_SENTINELS.has(str)) {
    let ids;
    if (scope.canSeeAll) {
      const all = await prisma.hospital.findMany({
        where: { isActive: 1 },
        select: { id: true },
        orderBy: { id: 'asc' },
      });
      ids = all.map((h) => h.id);
    } else {
      ids = [...scope.hospitalIds];
    }
    if (!ids.length) {
      res.status(403).json({
        error: 'لم يُربط حسابك بأي مستشفى لوحدة الغسيل. راجع المشرف.',
      });
      return null;
    }
    return { mode: 'multi', hospitalIds: ids };
  }

  const hid = await requireDialysisHospital(prisma, req, res);
  if (hid == null) return null;
  return { mode: 'single', hospitalId: hid };
}

/** تحقق أن المستشفى التابع للسجل ضمن نطاق المستخدم */
async function assertRecordHospitalInDialysisScope(prisma, req, res, recordHospitalId) {
  const scope = await attachDialysisScope(prisma, req);
  if (scope.canSeeAll) return recordHospitalId;
  if (!scope.hospitalIds.includes(recordHospitalId)) {
    res.status(403).json({ error: 'لا صلاحية لهذا المستشفى' });
    return null;
  }
  return recordHospitalId;
}

module.exports = {
  SCOPE_ALL_PERM,
  loadDialysisScope,
  loadPermissionNameSet,
  attachDialysisScope,
  requireDialysisHospital,
  buildDialysisHospitalAuthFields,
  resolveDialysisDataScope,
  assertRecordHospitalInDialysisScope,
};
