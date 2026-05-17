/**
 * دمج صلاحيات المستخدم للتحقق ولواجهة /me:
 * - من الدور: كل الصلاحيات التي لا تبدأ بـ dialysis:
 * - مباشرة: الكل (بما فيها dialysis:*)
 *
 * بذلك تُحدَّد صلاحيات وحدة الغسيل حصرياً من user_permissions (شاشة إدارة وصول D-IRS).
 * استثناء: role === 'admin' يُعالَج في requirePermission و usePermission.
 */
function mergeRoleAndDirectPermissionSet(roleNames, directNames) {
  const fromRole = (roleNames || []).filter((n) => !String(n).startsWith('dialysis:'));
  return new Set([...fromRole, ...(directNames || [])]);
}

function mergeRoleAndDirectPermissionArray(roleNames, directNames) {
  return Array.from(mergeRoleAndDirectPermissionSet(roleNames, directNames));
}

module.exports = {
  mergeRoleAndDirectPermissionSet,
  mergeRoleAndDirectPermissionArray,
};
