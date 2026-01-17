const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const router = express.Router();
const db = require('../database/db');
const { JWT_SECRET, authenticateToken } = require('../middleware/auth');

// Login
router.post('/login', async (req, res) => {
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

    console.log('Login successful for user:', username, 'role:', user.role);

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        name: user.name
      }
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

module.exports = router;
