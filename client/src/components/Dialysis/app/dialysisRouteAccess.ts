import { useAuth } from '../../../context/AuthContext';
import { usePermission } from '../../../hooks/usePermission';

export type DialysisRouteCaps = {
  isAdmin: boolean;
  canView: boolean;
  canPharmacyNav: boolean;
  canRecon: boolean;
  canStatsEntry: boolean;
  canStatsBulk: boolean;
  canAccess: boolean;
  reconciliationLanding: boolean;
  pharmacyOnly: boolean;
};

export function useDialysisRouteCaps(): DialysisRouteCaps {
  const { user } = useAuth();
  const canView = usePermission('dialysis:view');
  const permPharmView = usePermission('dialysis:pharmacy:view');
  const permPharmDisp = usePermission('dialysis:pharmacy:dispense');
  const permPharmInv = usePermission('dialysis:pharmacy:inventory');
  const canPharmacyNav = permPharmView || permPharmDisp || permPharmInv;
  const canRecon = usePermission('dialysis:reconciliation');
  const canStatsEntry = usePermission('dialysis:stats:entry');
  const canStatsBulk = usePermission('dialysis:stats:bulk');
  const canAccess = usePermission('dialysis:access:manage');
  const canSessionCreate = usePermission('dialysis:session:create');
  const canPatientCreate = usePermission('dialysis:patient:create');
  const canSessionEdit = usePermission('dialysis:session:edit');

  const isAdmin = user?.role === 'admin';
  const pharmacyOnly = !canView && canPharmacyNav;
  const reconciliationLanding =
    !isAdmin &&
    (canRecon || canStatsEntry || canStatsBulk) &&
    !canSessionCreate &&
    !canPatientCreate &&
    !canSessionEdit;

  return {
    isAdmin,
    canView,
    canPharmacyNav,
    canRecon,
    canStatsEntry,
    canStatsBulk,
    canAccess,
    reconciliationLanding,
    pharmacyOnly,
  };
}

export function useDialysisDefaultRoute(): string {
  const caps = useDialysisRouteCaps();
  if (caps.pharmacyOnly) return '/dialysis/pharmacy';
  if (caps.reconciliationLanding) return '/dialysis/statistics';
  return '/dialysis';
}

function normalizeDialysisPath(pathname: string): string {
  const p = pathname.replace(/\/+$/, '') || '/dialysis';
  return p.startsWith('/dialysis') ? p : '/dialysis';
}

/** هل المستخدم يمكنه فتح هذا المسار؟ */
export function canAccessDialysisPath(pathname: string, caps: DialysisRouteCaps): boolean {
  if (caps.isAdmin) return true;

  const p = normalizeDialysisPath(pathname);

  if (caps.pharmacyOnly) {
    return p === '/dialysis' || p === '/dialysis/pharmacy' || p === '/dialysis/pharmacy-stock';
  }

  if (p === '/dialysis/pharmacy' || p === '/dialysis/pharmacy-stock') {
    return caps.canPharmacyNav || caps.canView;
  }

  if (p === '/dialysis/statistics') {
    return caps.canRecon || caps.canStatsEntry || caps.canStatsBulk;
  }

  if (p === '/dialysis/ministry') {
    return caps.canView;
  }

  if (p === '/dialysis/access') {
    return caps.canAccess;
  }

  if (caps.reconciliationLanding) {
    const blocked = [
      '/dialysis/patients',
      '/dialysis/sessions',
      '/dialysis/live',
      '/dialysis/halls',
      '/dialysis/shifts',
      '/dialysis/machines',
      '/dialysis/inventory',
    ];
    if (blocked.some((b) => p === b || p.startsWith(`${b}/`))) {
      return false;
    }
  }

  if (p.startsWith('/dialysis')) {
    return caps.canView;
  }

  return true;
}
