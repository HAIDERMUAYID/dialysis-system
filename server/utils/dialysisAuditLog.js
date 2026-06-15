const DIALYSIS_AUDIT_PREFIX = 'dialysis:';

const DIALYSIS_AUDIT_ACTION_LABELS = {
  session_delete: 'حذف جلسة',
  stat_entry_delete: 'حذف سطر إحصائي',
  face_enroll: 'تسجيل بصمة وجه',
  face_enroll_clear: 'إزالة بصمة وجه',
  patient_promote: 'ترقية مريض إلى دائم',
  dispense_complete: 'تأكيد صرف صيدلية',
};

/**
 * Append-only audit for sensitive dialysis operations (activity_log).
 */
async function logDialysisAudit(prisma, req, { action, entityType, entityId, summary, meta = {} }) {
  if (!prisma?.activityLog) return;
  const hospitalId = meta.hospital_id ?? meta.hospitalId ?? null;
  try {
    await prisma.activityLog.create({
      data: {
        userId: req.user?.id ?? null,
        action: `${DIALYSIS_AUDIT_PREFIX}${action}`,
        entityType: entityType ?? 'dialysis',
        entityId: entityId != null && Number.isFinite(Number(entityId)) ? Number(entityId) : null,
        details: JSON.stringify({
          summary: summary || DIALYSIS_AUDIT_ACTION_LABELS[action] || action,
          hospital_id: hospitalId,
          actor: req.user?.name ?? req.user?.username ?? null,
          ip: req.ip ?? null,
          ...meta,
        }),
      },
    });
  } catch (err) {
    console.error('dialysis audit log:', err?.message || err);
  }
}

function parseAuditDetails(raw) {
  if (!raw) return {};
  try {
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return { summary: String(raw) };
  }
}

function auditActionLabel(action) {
  const key = String(action || '').replace(DIALYSIS_AUDIT_PREFIX, '');
  return DIALYSIS_AUDIT_ACTION_LABELS[key] || key || action;
}

module.exports = {
  logDialysisAudit,
  parseAuditDetails,
  auditActionLabel,
  DIALYSIS_AUDIT_PREFIX,
  DIALYSIS_AUDIT_ACTION_LABELS,
};
