const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'al-hakim-hospital-secret-key';

async function loadPermissionSet(userId) {
  const db = require('../database/db');
  if (!db.prisma) return null;
  const user = await db.prisma.user.findUnique({
    where: { id: userId },
    include: {
      roleRef: {
        include: {
          permissions: { include: { permission: true } },
        },
      },
      directPermissions: { include: { permission: true } },
    },
  });

  const roleNames =
    user?.roleRef?.permissions?.map((rp) => rp.permission.name) ?? [];
  const directNames =
    user?.directPermissions?.map((up) => up.permission.name) ?? [];
  const { mergeRoleAndDirectPermissionSet } = require('../utils/mergeUserPermissions');
  return mergeRoleAndDirectPermissionSet(roleNames, directNames);
}

/** صلاحية واحدة من جدول permissions (ربطها بالدور عبر role_permissions). المدير يُسمَح له تلقائياً. */
const requirePermission = (permissionName) => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'يجب تسجيل الدخول أولاً' });
    }
    if (req.user.role === 'admin') {
      return next();
    }

    try {
      const names = await loadPermissionSet(req.user.id);
      if (!names) {
        return res.status(503).json({ error: 'الصلاحيات الدقيقة تتطلب PostgreSQL / Prisma' });
      }

      if (names.has(permissionName)) {
        return next();
      }

      return res.status(403).json({ error: 'ليس لديك صلاحية لتنفيذ هذه العملية' });
    } catch (err) {
      console.error('requirePermission:', err);
      return res.status(500).json({ error: 'فشل التحقق من الصلاحيات' });
    }
  };
};

/** أيّ صلاحية من القائمة (مدير النظام يمرّ دائماً). */
const requireAnyPermission = (...permissionNames) => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'يجب تسجيل الدخول أولاً' });
    }
    if (req.user.role === 'admin') {
      return next();
    }

    try {
      const names = await loadPermissionSet(req.user.id);
      if (!names) {
        return res.status(503).json({ error: 'الصلاحيات الدقيقة تتطلب PostgreSQL / Prisma' });
      }

      if (permissionNames.some((p) => names.has(p))) {
        return next();
      }

      return res.status(403).json({ error: 'ليس لديك صلاحية لتنفيذ هذه العملية' });
    } catch (err) {
      console.error('requireAnyPermission:', err);
      return res.status(500).json({ error: 'فشل التحقق من الصلاحيات' });
    }
  };
};

function verifyJwtToken(token) {
  return new Promise((resolve, reject) => {
    jwt.verify(token, JWT_SECRET, (err, user) => {
      if (err) reject(err);
      else resolve(user);
    });
  });
}

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'يجب تسجيل الدخول أولاً' });
  }

  verifyJwtToken(token)
    .then((user) => {
      req.user = user;
      next();
    })
    .catch(() => res.status(401).json({ error: 'رمز الوصول غير صالح أو منتهي' }));
};

/** Like authenticateToken but accepts ?token= for EventSource (SSE). */
const authenticateTokenOrQuery = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  let token = authHeader && authHeader.split(' ')[1];
  if (!token && req.query.token) {
    token = String(req.query.token);
  }

  if (!token) {
    return res.status(401).json({ error: 'يجب تسجيل الدخول أولاً' });
  }

  verifyJwtToken(token)
    .then((user) => {
      req.user = user;
      next();
    })
    .catch(() => res.status(401).json({ error: 'رمز الوصول غير صالح أو منتهي' }));
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
  authenticateTokenOrQuery,
  requireRole,
  requirePermission,
  requireAnyPermission,
  JWT_SECRET,
};
