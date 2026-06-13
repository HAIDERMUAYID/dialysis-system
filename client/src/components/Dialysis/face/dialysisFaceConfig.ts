/**
 * تفعيل ميزة الوجه (محلي + Render + PWA):
 * - مفعّلة افتراضياً في كل البيئات
 * - لتعطيلها صراحةً: REACT_APP_DIALYSIS_FACE_ENABLED=false عند build
 */
export const DIALYSIS_FACE_ENABLED =
  process.env.REACT_APP_DIALYSIS_FACE_ENABLED !== 'false';

export const FACE_MODEL_CDN =
  'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model';

/** إصدار خط أنابيب الاستخراج — يُخزَّن مع التسجيل */
export const FACE_PIPELINE_VERSION = 'face-api-aligned-v2';

export const FACE_ENROLL_SAMPLES = 5;
export const FACE_ENROLL_MIN_SAMPLES = 3;

export const FACE_MIN_DETECTION_SCORE = 0.75;
export const FACE_MIN_FACE_RATIO = 0.22;
export const FACE_MAX_HEAD_TILT_DEG = 15;
/** أقصى انحراف أفقي عند «انظر للأمام» — متوافق مع مؤشر الجودة */
export const FACE_LIVENESS_CENTER_YAW_MAX = 0.3;
export const FACE_LIVENESS_YAW_MIN = 0.08;
export const FACE_CENTER_YAW_MAX = 0.3;

export const FACE_AUTO_MATCH_THRESHOLD = 0.88;
export const FACE_STRONG_MATCH_THRESHOLD = 0.91;
export const FACE_MIN_MARGIN = 0.06;
export const FACE_STRONG_MIN_MARGIN = 0.025;
export const FACE_VERIFY_MIN_SCORE = 0.86;
export const FACE_SUGGEST_THRESHOLD = 0.62;

export const FACE_VERIFY_FRAMES = 3;
export const FACE_VERIFY_FRAME_DELAY_MS = 280;
export const FACE_QUALITY_POLL_MS = 1000;

export const FACE_ENROLL_MIN_PAIRWISE = 0.72;
export const FACE_LIVENESS_MIN_PAIRWISE = 0.68;

export const FACE_REJECT_REASON_AR: Record<string, string> = {
  NO_FACE: 'لم يُكتشف وجه',
  LOW_SCORE: 'الوجه غير واضح — حسّن الإضاءة',
  FACE_TOO_SMALL: 'قرّب وجهك داخل الإطار البيضاوي',
  HEAD_TILT: 'ثبّت رأسك — الميل زائد',
  MULTIPLE_FACES: 'وجوه متعددة — يجب وجه واحد فقط',
  LIVENESS_FAIL: 'حرّك رأسك قليلاً كما هو مطلوب',
  NO_MATCH: 'لم تُطابق أي بصمة مسجّلة',
  LOW_CONFIDENCE: 'الثقة غير كافية للقبول التلقائي',
  AMBIGUOUS: 'يوجد مرشّحان متقاربان — اختر يدوياً',
  FRAME_DISAGREE: 'الإطارات غير متطابقة — ثبّت وجهك',
  FRAME_LOW_SCORE: 'جودة إحدى اللقطات منخفضة',
};

export const FACE_CAPTURE_TIPS = [
  'الوجه فقط — بدون قبعة أو كمامة',
  'إضاءة أمامية واضحة — تجنب الضوء من الخلف',
  'خلفية بسيطة — لا يُعتمد على المكان أو الملابس',
  'نفس نوع الكامره عند التسجيل والتعرف',
];
