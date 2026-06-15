/**
 * تفعيل ميزة الوجه (محلي + Render + PWA):
 * - مفعّلة افتراضياً في كل البيئات
 * - لتعطيلها: REACT_APP_DIALYSIS_FACE_ENABLED=false
 *
 * وضع التشغيل:
 * - staff (افتراضي): الموظف يصوّر المريض — كاميرا أمامية أو خلفية، لقطتان، بدون liveness
 * - selfie: REACT_APP_DIALYSIS_FACE_MODE=selfie — للاختبار فقط
 */
export const DIALYSIS_FACE_ENABLED =
  process.env.REACT_APP_DIALYSIS_FACE_ENABLED !== 'false';

export type FaceOperatingMode = 'staff' | 'selfie';

export const FACE_OPERATING_MODE: FaceOperatingMode =
  process.env.REACT_APP_DIALYSIS_FACE_MODE === 'selfie' ? 'selfie' : 'staff';

export const FACE_IS_STAFF_MODE = FACE_OPERATING_MODE === 'staff';

export const FACE_MODEL_CDN =
  'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model';

/** مسار محلي — يُنسخ إلى `public/models/face-api` عند start/build */
export function faceModelLocalUri(): string {
  const base = (process.env.PUBLIC_URL || '').replace(/\/$/, '');
  return `${base}/models/face-api`;
}

export const FACE_PIPELINE_VERSION = 'face-api-aligned-v3-staff';

/** عينات التسجيل — staff: لقطتان سريعتان | selfie: ثلاث + liveness */
export const FACE_ENROLL_SAMPLES = FACE_IS_STAFF_MODE ? 2 : 3;
export const FACE_ENROLL_MIN_SAMPLES = FACE_IS_STAFF_MODE ? 2 : 3;
export const FACE_SKIP_LIVENESS = FACE_IS_STAFF_MODE;

/** selfie: وجه كبير في الإطار | staff: وجه أصغر (مسافة ~50–80 سم) */
export const FACE_MIN_DETECTION_SCORE = FACE_IS_STAFF_MODE ? 0.78 : 0.75;
export const FACE_MIN_FACE_RATIO = FACE_IS_STAFF_MODE ? 0.09 : 0.22;

export const FACE_MAX_HEAD_TILT_DEG = FACE_IS_STAFF_MODE ? 18 : 15;
export const FACE_LIVENESS_CENTER_YAW_MAX = 0.3;
export const FACE_LIVENESS_YAW_MIN = 0.06;
export const FACE_CENTER_YAW_MAX = FACE_IS_STAFF_MODE ? 0.38 : 0.3;

export const FACE_AUTO_MATCH_THRESHOLD = FACE_IS_STAFF_MODE ? 0.86 : 0.88;
export const FACE_STRONG_MATCH_THRESHOLD = FACE_IS_STAFF_MODE ? 0.9 : 0.91;
export const FACE_MIN_MARGIN = FACE_IS_STAFF_MODE ? 0.05 : 0.06;
export const FACE_STRONG_MIN_MARGIN = FACE_IS_STAFF_MODE ? 0.022 : 0.025;
export const FACE_VERIFY_MIN_SCORE = FACE_IS_STAFF_MODE ? 0.84 : 0.86;
export const FACE_SUGGEST_THRESHOLD = 0.62;

export const FACE_VERIFY_FRAMES = FACE_IS_STAFF_MODE ? 2 : 3;
export const FACE_IDENTIFY_FRAMES = 2;
export const FACE_VERIFY_FRAME_DELAY_MS = FACE_IS_STAFF_MODE ? 100 : 280;
export const FACE_IDENTIFY_FRAME_DELAY_MS = FACE_IS_STAFF_MODE ? 80 : 120;
export const FACE_QUALITY_POLL_MS = 1000;
export const FACE_QUALITY_POLL_MOBILE_MS = FACE_IS_STAFF_MODE ? 320 : 480;

export const FACE_AUTO_SCAN_STABLE_MS = FACE_IS_STAFF_MODE ? 380 : 500;
export const FACE_AUTO_SCAN_STABLE_FAST_MS = FACE_IS_STAFF_MODE ? 220 : 320;
export const FACE_AUTO_SCAN_COOLDOWN_MS = FACE_IS_STAFF_MODE ? 900 : 1400;

export const FACE_ENROLL_AUTO_STABLE_MS = FACE_IS_STAFF_MODE ? 280 : 420;
export const FACE_ENROLL_TURN_STABLE_MS = 300;

export const FACE_ENROLL_MIN_PAIRWISE = 0.72;
export const FACE_LIVENESS_MIN_PAIRWISE = 0.68;

export const FACE_REJECT_REASON_AR: Record<string, string> = {
  NO_FACE: FACE_IS_STAFF_MODE ? 'لم يُكتشف وجه المريض — وجّه الكاميرا' : 'لم يُكتشف وجه',
  LOW_SCORE: FACE_IS_STAFF_MODE
    ? 'الوجه غير واضح — حسّن الإضاءة أو قرّب قليلاً'
    : 'الوجه غير واضح — حسّن الإضاءة',
  FACE_TOO_SMALL: FACE_IS_STAFF_MODE
    ? 'الوجه بعيد — قرّب قليلاً أو كبّر داخل الإطار'
    : 'قرّب وجهك داخل الإطار البيضاوي',
  HEAD_TILT: FACE_IS_STAFF_MODE ? 'ثبّت رأس المريض' : 'ثبّت رأسك — الميل زائد',
  MULTIPLE_FACES: 'وجوه متعددة — يجب وجه المريض فقط',
  LIVENESS_FAIL: 'حرّك الرأس قليلاً كما هو مطلوب',
  NO_MATCH: 'لم تُطابق أي بصمة مسجّلة',
  LOW_CONFIDENCE: 'الثقة غير كافية — أعد المحاولة',
  AMBIGUOUS: 'يوجد مرشّحان متقاربان — اختر يدوياً',
  FRAME_DISAGREE: 'الإطارات غير متطابقة — ثبّت الوجه',
  FRAME_LOW_SCORE: 'جودة إحدى اللقطات منخفضة',
};

export const FACE_CAPTURE_TIPS = FACE_IS_STAFF_MODE
  ? [
      'يمكن استخدام الكاميرا الأمامية أو الخلفية — حسب راحة الموظف',
      'مسافة مريحة (~50–80 سم) — لا حاجة لقرّب الوجه',
      'إضاءة أمامية على المريض — تجنب الضوء من الخلف',
      'وجه واحد فقط — بدون كمامة أو قبعة',
      'استخدم نفس نوع الكاميرا عند التسجيل والتعرف إن أمكن',
    ]
  : [
      'الوجه فقط — بدون قبعة أو كمامة',
      'إضاءة أمامية واضحة — تجنب الضوء من الخلف',
      'خلفية بسيطة — لا يُعتمد على المكان أو الملابس',
      'نفس نوع الكامره عند التسجيل والتعرف',
    ];

export const FACE_STAFF_INTRO =
  'وجّه الكاميرا (أمامية أو خلفية) نحو المريض — يُلتقط تلقائياً خلال ثوانٍ.';

export const FACE_IDENTIFY_STATUS_IDLE = FACE_IS_STAFF_MODE
  ? 'وجّه الكاميرا نحو المريض'
  : 'وجّه وجهك داخل الإطار';

export const FACE_QUALITY_SIZE_LABEL = FACE_IS_STAFF_MODE ? 'ظهور الوجه' : 'القرب';

export const FACE_QUALITY_SIZE_HINT = FACE_IS_STAFF_MODE
  ? 'يُفضّل أن يملأ الوجه نصف الإطار — يمكن من مسافة'
  : 'قرّب الوجه داخل الإطار';

export const FACE_STAFF_GUIDE_STEPS = [
  {
    title: 'اختر الكاميرا المناسبة',
    detail: 'أمامية أو خلفية — زر التبديل في الأسفل. الخلفية أفضل غالباً لتصوير المريض.',
  },
  {
    title: 'إضاءة على الوجه',
    detail: 'تجنّب الضوء من خلف المريض — الوجه يجب أن يكون واضحاً.',
  },
  {
    title: 'ثبّت ثم انتظر',
    detail: 'يُلتقط تلقائياً خلال ثوانٍ — لا حاجة لقرّب الوجه.',
  },
] as const;
