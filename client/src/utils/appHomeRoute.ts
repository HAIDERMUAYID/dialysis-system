/**
 * تحديد الصفحة الافتراضية بعد تسجيل الدخول حسب النظام:
 * - الكلية الصناعية (النظام الرئيسي): أدوار الاستعلامات / المختبر / الصيدلية / الطبيب …
 * - الغسل الكلوي (D-IRS): دور dialysis_staff أو صلاحيات dialysis:* فقط
 */

export const MAIN_KIDNEY_ROLES = [
  'admin',
  'inquiry',
  'lab',
  'lab_manager',
  'pharmacist',
  'pharmacy_manager',
  'doctor',
] as const;

export type MainKidneyRole = (typeof MAIN_KIDNEY_ROLES)[number];

export function hasDialysisModuleAccess(user: {
  role?: string;
  permissions?: string[];
}): boolean {
  if (user.role === 'dialysis_staff') return true;
  return (user.permissions ?? []).some((p) => p.startsWith('dialysis:'));
}

export function hasMainKidneyModuleAccess(user: { role?: string }): boolean {
  if (!user.role) return false;
  return (MAIN_KIDNEY_ROLES as readonly string[]).includes(user.role);
}

/** حساب مخصّص لوحدة الغسيل فقط — لا يدخل النظام الرئيسي */
export function isDialysisOnlyAccount(user: {
  role?: string;
  permissions?: string[];
}): boolean {
  if (!hasDialysisModuleAccess(user)) return false;
  if (user.role === 'dialysis_staff') return true;
  return !hasMainKidneyModuleAccess(user);
}

export function resolveDialysisEntryPath(user: { permissions?: string[] }): string {
  const perms = user.permissions ?? [];
  if (perms.includes('dialysis:view')) return '/dialysis';
  if (perms.some((p) => p.startsWith('dialysis:pharmacy:'))) {
    return '/dialysis/pharmacy';
  }
  return '/dialysis';
}

export function getMainKidneyRouteByRole(role: string | undefined): string {
  if (!role) return '/login';
  switch (role) {
    case 'admin':
      return '/admin';
    case 'inquiry':
      return '/inquiry';
    case 'lab':
    case 'lab_manager':
      return '/lab';
    case 'pharmacist':
    case 'pharmacy_manager':
      return '/pharmacist';
    case 'doctor':
      return '/doctor';
    case 'dialysis_staff':
      return '/dialysis';
    default:
      return '/login';
  }
}

/** المسار الافتراضي بعد الدخول */
export function resolveAppHomeRoute(user: {
  role?: string;
  permissions?: string[];
}): string {
  if (!user?.role) return '/login';

  if (isDialysisOnlyAccount(user)) {
    return resolveDialysisEntryPath(user);
  }

  return getMainKidneyRouteByRole(user.role);
}
