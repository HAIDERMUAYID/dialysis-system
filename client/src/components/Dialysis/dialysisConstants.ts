/** أيام الأسبوع حسب JavaScript Date.getDay(): 0 = الأحد … 6 = السبت */
export const WEEKDAY_OPTIONS_AR = [
  { value: 0, label: 'الأحد' },
  { value: 1, label: 'الإثنين' },
  { value: 2, label: 'الثلاثاء' },
  { value: 3, label: 'الأربعاء' },
  { value: 4, label: 'الخميس' },
  { value: 5, label: 'الجمعة' },
  { value: 6, label: 'السبت' },
];

/** يوم الأسبوع من API قد يكون Int أو نص JSON — يُطابق قيم WEEKDAY_OPTIONS_AR */
export function normalizeDialysisWeekday(weekday: unknown): number | null {
  if (weekday == null || weekday === '') return null;
  const n =
    typeof weekday === 'number' && Number.isFinite(weekday)
      ? Math.trunc(weekday)
      : parseInt(String(weekday).trim(), 10);
  if (Number.isNaN(n) || n < 0 || n > 6) return null;
  return n;
}

export function weekdayLabelAr(weekday: unknown): string {
  const n = normalizeDialysisWeekday(weekday);
  if (n === null) return '—';
  return WEEKDAY_OPTIONS_AR.find((x) => x.value === n)?.label ?? String(n);
}

/** محافظات العراق (اختصار للرمز في الواجهة) */
export const IQ_PROVINCE_OPTIONS = [
  { value: 'BG', label: 'بغداد' },
  { value: 'BB', label: 'البصرة' },
  { value: 'NJ', label: 'النجف' },
  { value: 'KB', label: 'كربلاء' },
  { value: 'NA', label: 'نينوى' },
  { value: 'DQ', label: 'ذي قار' },
  { value: 'MU', label: 'المثنى' },
  { value: 'QA', label: 'القادسية' },
  { value: 'WA', label: 'واسط' },
  { value: 'DY', label: 'ديالى' },
  { value: 'SD', label: 'صلاح الدين' },
  { value: 'AN', label: 'الأنبار' },
  { value: 'BA', label: 'بابل' },
  { value: 'ER', label: 'أربيل' },
  { value: 'SU', label: 'السليمانية' },
  { value: 'DH', label: 'دهوك' },
  { value: 'KR', label: 'كركوك' },
  { value: 'OT', label: 'أخرى' },
];

export function minutesToLabel(m: number): string {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

/** عرض تاريخ جلسة/إحصاء من API (ISO أو نص) كـ YYYY-MM-DD دون انزياح يوم بسبب المنطقة الزمنية في المتصفح */
export function formatDialysisCalendarDate(isoOrDate: string | Date | null | undefined): string {
  if (isoOrDate == null || isoOrDate === '') return '—';
  const s = typeof isoOrDate === 'string' ? isoOrDate : isoOrDate.toISOString();
  const head = s.split('T')[0];
  if (/^\d{4}-\d{2}-\d{2}$/.test(head)) return head;
  return '—';
}

/** وصول وعائي شائع في وحدات الغسيل */
export const VASCULAR_ACCESS_OPTIONS = [
  { value: 'AV_FISTULA', label: 'شريان وريدي طبيعي (Fistula)' },
  { value: 'AV_GRAFT', label: 'طعم وعائي (Graft)' },
  { value: 'CVC_TUNNELED', label: 'قسطرة مركزية مدفونة' },
  { value: 'CVC_TEMP', label: 'قسطرة وريدية مركزية مؤقتة' },
  { value: 'OTHER', label: 'أخرى' },
];

export const BLOOD_GROUP_OPTIONS = [
  { value: 'A+', label: 'A+' },
  { value: 'A-', label: 'A-' },
  { value: 'B+', label: 'B+' },
  { value: 'B-', label: 'B-' },
  { value: 'AB+', label: 'AB+' },
  { value: 'AB-', label: 'AB-' },
  { value: 'O+', label: 'O+' },
  { value: 'O-', label: 'O-' },
];

export const GENDER_OPTIONS = [
  { value: 'MALE', label: 'ذكر' },
  { value: 'FEMALE', label: 'أنثى' },
  { value: 'OTHER', label: 'غير محدد' },
];

/** رمز ISO للدولة — افتراضياً العراق */
export const COUNTRY_OPTIONS = [
  { value: 'IQ', label: 'العراق' },
  { value: 'SA', label: 'السعودية' },
  { value: 'KW', label: 'الكويت' },
  { value: 'AE', label: 'الإمارات' },
  { value: 'JO', label: 'الأردن' },
  { value: 'LB', label: 'لبنان' },
  { value: 'SY', label: 'سوريا' },
  { value: 'TR', label: 'تركيا' },
  { value: 'IR', label: 'إيران' },
  { value: 'OTHER', label: 'أخرى' },
];
