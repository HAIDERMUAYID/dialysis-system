import { ALL_MY_HOSPITALS, type DialysisHospitalScope, type HospitalRow } from './dialysisContext';

/** شعار وزارة الصحة — مستخدم في واجهة الغسل والطباعة */
export const MINISTRY_LOGO_URL = '/images/ministry-logo.png';

export const DIALYSIS_SYSTEM_TITLE = 'نظام إدارة الغسل الكلوي';
export const DIALYSIS_SYSTEM_TITLE_SHORT = 'D-IRS';
export const DIALYSIS_MINISTRY_LINE = 'وزارة الصحة — العراق';

export function getHospitalScopeLabel(
  hospitalId: DialysisHospitalScope | null,
  hospitals: HospitalRow[]
): string {
  if (hospitalId == null) return 'لم يُحدَّد مستشفى';
  if (hospitalId === ALL_MY_HOSPITALS) {
    return hospitals.length > 1
      ? `جميع المستشفيات (${hospitals.length} وحدة)`
      : 'جميع المستشفيات المسموح بها';
  }
  const h = hospitals.find((x) => x.id === hospitalId);
  if (!h) return '—';
  return h.code ? `${h.name} · ${h.code}` : h.name;
}

/** عنوان كامل للطباعة مع مسار الشعار */
export function dialysisLogoAbsoluteUrl(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}${MINISTRY_LOGO_URL}`;
  }
  return MINISTRY_LOGO_URL;
}
