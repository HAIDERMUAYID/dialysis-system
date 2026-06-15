const rateLimit = require('express-rate-limit');

const skipRateLimit =
  process.env.E2E_TEST === '1' || process.env.NODE_ENV === 'test';

// General API rate limiter
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'تم تجاوز الحد المسموح من الطلبات. يرجى المحاولة مرة أخرى لاحقاً.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => skipRateLimit,
});

// Strict rate limiter for POST /login only (see routes/auth.js). Do not mount on all /api/auth — GET /me 401s would count.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // failed login attempts per IP per window (successful logins are skipped below)
  message: 'تم تجاوز الحد المسموح من محاولات تسجيل الدخول. يرجى المحاولة بعد 15 دقيقة.',
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => skipRateLimit,
});

// Strict rate limiter for password reset
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // limit each IP to 3 password reset requests per hour
  message: 'تم تجاوز الحد المسموح من محاولات إعادة تعيين كلمة المرور.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter for report generation
const reportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // limit each IP to 20 report generations per hour
  message: 'تم تجاوز الحد المسموح من توليد التقارير.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter for file uploads
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // limit each IP to 50 file uploads per hour
  message: 'تم تجاوز الحد المسموح من رفع الملفات.',
  standardHeaders: true,
  legacyHeaders: false,
});

/** مطابقة الوجه — حد لكل مستخدم (أو IP) لتقليل إساءة الاستخدام */
const faceIdentifyLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: parseInt(process.env.FACE_IDENTIFY_RATE_MAX || '45', 10),
  message: 'محاولات مطابقة الوجه كثيرة — انتظر دقيقة ثم أعد المحاولة.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => skipRateLimit,
  keyGenerator: (req) => {
    const uid = req.user?.id;
    return uid ? `face-identify:user:${uid}` : `face-identify:ip:${req.ip}`;
  },
});

module.exports = {
  apiLimiter,
  authLimiter,
  passwordResetLimiter,
  reportLimiter,
  uploadLimiter,
  faceIdentifyLimiter,
};
