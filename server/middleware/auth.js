const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'al-hakim-hospital-secret-key';

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'يجب تسجيل الدخول أولاً' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'رمز الوصول غير صالح' });
    }
    req.user = user;
    next();
  });
};

const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'يجب تسجيل الدخول أولاً' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'ليس لديك صلاحية للوصول لهذه الصفحة' });
    }
    next();
  };
};

module.exports = {
  authenticateToken,
  requireRole,
  JWT_SECRET
};
