const rateLimit = require('express-rate-limit');

// General API rate limiter
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'تم تجاوز الحد المسموح من الطلبات. يرجى المحاولة مرة أخرى لاحقاً.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict rate limiter for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 login requests per windowMs
  message: 'تم تجاوز الحد المسموح من محاولات تسجيل الدخول. يرجى المحاولة بعد 15 دقيقة.',
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
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

module.exports = {
  apiLimiter,
  authLimiter,
  passwordResetLimiter,
  reportLimiter,
  uploadLimiter
};
