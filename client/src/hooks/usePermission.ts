import { useAuth } from '../context/AuthContext';

/** صلاحية من الباكند (بعد تسجيل الدخول أو GET /api/auth/me). المدير يُعتبر مخولاً لكل شيء. */
export function usePermission(permissionName: string): boolean {
  const { user } = useAuth();
  if (!user) return false;
  if (user.role === 'admin') return true;
  return user.permissions?.includes(permissionName) ?? false;
}
