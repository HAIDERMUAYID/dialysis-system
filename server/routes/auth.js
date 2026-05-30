const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const router = express.Router();
const db = require('../database/db');
const { JWT_SECRET, authenticateToken } = require('../middleware/auth');
const { buildDialysisHospitalAuthFields } = require('../utils/dialysisScope');
const { authLimiter } = require('../utils/rateLimiter');

const uploadsRoot = path.join(__dirname, '../../uploads');
const profilePhotoMulter = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const userId = req.user.id;
      const dir = path.join(uploadsRoot, 'user-profiles', String(userId));
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      const ext = (path.extname(file.originalname || '') || '.jpg').toLowerCase();
      const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
      const e = allowed.includes(ext) ? (ext === '.jpeg' ? '.jpg' : ext) : '.jpg';
      cb(null, `photo${e}`);
    },
  }),
  limits: { fileSize: 4 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!/^image\/(jpeg|png|webp|gif)$/i.test(file.mimetype)) {
      cb(new Error('يجب رفع صورة (JPEG/PNG/WebP/GIF)'));
      return;
    }
    cb(null, true);
  },
});

function userPhotoPayload(user) {
  return user?.photoUrl ?? user?.photo_url ?? null;
}

// Login (rate-limited; GET /me must stay unrestricted so session bootstrap does not exhaust the limit)
router.post('/login', authLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;

    console.log('Login attempt for username:', username);

    if (!username || !password) {
      return res.status(400).json({ error: 'يرجى إدخال اسم المستخدم وكلمة المرور' });
    }

    let user;
    try {
      // Ensure database connection is active (for Prisma)
      if (db.ensureConnection) {
        const isConnected = await db.ensureConnection();
        if (!isConnected) {
          console.error('Database connection is not available');
          return res.status(503).json({ error: 'قاعدة البيانات غير متاحة حالياً. يرجى المحاولة مرة أخرى' });
        }
      }
      
      // Use Prisma if available, otherwise fallback to SQL
      if (db.prisma) {
        user = await db.prisma.user.findUnique({
          where: { username },
          include: { roleRef: true }
        });
      } else if (db.helpers && db.helpers.getUserByUsername) {
        user = await db.helpers.getUserByUsername(username);
      } else {
        // Fallback to SQL for SQLite/MySQL
        const { getQuery } = require('../database/db');
        user = await getQuery('SELECT * FROM users WHERE username = ?', [username]);
      }
    } catch (dbError) {
      console.error('Database query error:', dbError);
      console.error('Database error details:', {
        message: dbError.message,
        code: dbError.code,
        meta: dbError.meta
      });
      
      // Provide more specific error messages
      let errorMessage = 'خطأ في قاعدة البيانات. تأكد من تشغيل الخادم بشكل صحيح';
      
      if (dbError.message && dbError.message.includes('does not exist')) {
        errorMessage = 'قاعدة البيانات غير مهيأة. يرجى تشغيل migrations: npx prisma migrate deploy';
      } else if (dbError.message && dbError.message.includes('connection')) {
        errorMessage = 'لا يمكن الاتصال بقاعدة البيانات. تحقق من DATABASE_URL في Render';
      } else if (dbError.code === 'P2002') {
        errorMessage = 'خطأ في قاعدة البيانات: بيانات مكررة';
      }
      
      return res.status(500).json({ error: errorMessage });
    }

    if (!user) {
      console.log('User not found:', username);
      return res.status(401).json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
    }

    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      console.log('Invalid password for user:', username);
      return res.status(401).json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, name: user.name },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    let permissions = [];
    if (db.prisma) {
      try {
        const roleNames = [];
        if (user.roleId) {
          const rps = await db.prisma.rolePermission.findMany({
            where: { roleId: user.roleId },
            include: { permission: true },
          });
          rps.forEach((rp) => roleNames.push(rp.permission.name));
        }
        const directs = await db.prisma.userPermission.findMany({
          where: { userId: user.id },
          include: { permission: true },
        });
        const directNames = directs.map((up) => up.permission.name);
        const { mergeRoleAndDirectPermissionArray } = require('../utils/mergeUserPermissions');
        permissions = mergeRoleAndDirectPermissionArray(roleNames, directNames);
      } catch (permErr) {
        console.warn('Could not load permissions:', permErr.message);
      }
    }

    console.log('Login successful for user:', username, 'role:', user.role);

    let dialysisAuth = {};
    if (db.prisma) {
      try {
        dialysisAuth = await buildDialysisHospitalAuthFields(db.prisma, user);
      } catch (dErr) {
        console.warn('Dialysis scope on login:', dErr.message);
      }
    }

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        name: user.name,
        photoUrl: userPhotoPayload(user),
        permissions,
        ...dialysisAuth,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء تسجيل الدخول: ' + error.message });
  }
});

// Change password
router.post('/change-password', authenticateToken, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    const userId = req.user.id;

    if (!current_password || !new_password) {
      return res.status(400).json({ error: 'يرجى إدخال كلمة المرور الحالية والجديدة' });
    }

    if (new_password.length < 6) {
      return res.status(400).json({ error: 'كلمة المرور الجديدة يجب أن تكون على الأقل 6 أحرف' });
    }

    // Get current user
    let user;
    if (db.prisma) {
      user = await db.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, password: true, username: true }
      });
    } else {
      const { getQuery } = require('../database/db');
      user = await getQuery('SELECT id, password, username FROM users WHERE id = ?', [userId]);
    }

    if (!user) {
      return res.status(404).json({ error: 'المستخدم غير موجود' });
    }

    // Verify current password
    const validPassword = await bcrypt.compare(current_password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'كلمة المرور الحالية غير صحيحة' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(new_password, 10);

    // Update password
    if (db.prisma) {
      await db.prisma.user.update({
        where: { id: userId },
        data: { password: hashedPassword }
      });
    } else {
      const { runQuery } = require('../database/db');
      await runQuery(
        'UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [hashedPassword, userId]
      );
    }

    console.log('Password changed successfully for user:', user.username);

    res.json({ message: 'تم تغيير كلمة المرور بنجاح' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء تغيير كلمة المرور: ' + error.message });
  }
});

// Upload profile photo
router.post('/profile-photo', authenticateToken, (req, res, next) => {
  profilePhotoMulter.single('photo')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message || 'فشل الرفع' });
    next();
  });
}, async (req, res) => {
  try {
    const userId = req.user.id;
    if (!req.file) {
      return res.status(400).json({ error: 'لم يُرفع ملف' });
    }

    const photoUrl = `/uploads/user-profiles/${userId}/${req.file.filename}`;

    if (db.prisma) {
      await db.prisma.user.update({
        where: { id: userId },
        data: { photoUrl },
      });
    } else {
      const { runQuery } = require('../database/db');
      try {
        await runQuery(
          'UPDATE users SET photo_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [photoUrl, userId]
        );
      } catch (sqlErr) {
        if (String(sqlErr.message || '').includes('photo_url')) {
          return res.status(503).json({ error: 'ميزة الصورة الشخصية تتطلب تحديث قاعدة البيانات' });
        }
        throw sqlErr;
      }
    }

    res.json({ photo_url: photoUrl, photoUrl });
  } catch (error) {
    console.error('Profile photo upload error:', error);
    res.status(500).json({ error: 'فشل حفظ الصورة الشخصية' });
  }
});

/** المستخدم الحالي + صلاحيات الدور (للواجهة بعد تحديث البذور دون إعادة تسجيل دخول) */
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const uid = req.user.id;
    if (!db.prisma) {
      return res.json({
        id: uid,
        username: req.user.username,
        role: req.user.role,
        name: req.user.name,
        photoUrl: null,
        permissions: [],
      });
    }

    const user = await db.prisma.user.findUnique({
      where: { id: uid },
      include: {
        roleRef: {
          include: {
            permissions: { include: { permission: true } },
          },
        },
        directPermissions: { include: { permission: true } },
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'المستخدم غير موجود' });
    }

    const roleNames =
      user.roleRef?.permissions?.map((rp) => rp.permission.name) ?? [];
    const directNames = user.directPermissions?.map((up) => up.permission.name) ?? [];
    const { mergeRoleAndDirectPermissionArray } = require('../utils/mergeUserPermissions');
    const permissions = mergeRoleAndDirectPermissionArray(roleNames, directNames);

    let dialysisAuth = {};
    try {
      dialysisAuth = await buildDialysisHospitalAuthFields(db.prisma, user);
    } catch (dErr) {
      console.warn('Dialysis scope on /me:', dErr.message);
    }

    res.json({
      id: user.id,
      username: user.username,
      role: user.role,
      name: user.name,
      photoUrl: userPhotoPayload(user),
      permissions,
      ...dialysisAuth,
    });
  } catch (error) {
    console.error('GET /me error:', error);
    res.status(500).json({ error: 'فشل تحميل المستخدم' });
  }
});

module.exports = router;
