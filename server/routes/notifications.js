const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const db = require('../database/db');

// Get user notifications
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { status } = req.query;
    
    if (db.prisma) {
      const where = {
        OR: [
          { userId: req.user.id },
          // Note: to_role field might not exist in schema, adjust if needed
        ]
      };
      
      if (status) {
        where.isRead = status === 'read' ? 1 : 0;
      }
      
      const notifications = await db.prisma.notification.findMany({
        where,
        include: {
          user: true,
          // visit relation if exists
        },
        orderBy: { createdAt: 'desc' }
      });
      
      res.json(notifications);
    } else {
      const { allQuery } = require('../database/db');
      let query = `
        SELECT n.*, u.name as from_user_name, v.visit_number
        FROM notifications n
        LEFT JOIN users u ON n.from_user_id = u.id
        LEFT JOIN visits v ON n.visit_id = v.id
        WHERE (n.to_user_id = ? OR n.to_role = ?)
      `;

      const params = [req.user.id, req.user.role];
      if (status) {
        query += ' AND n.status = ?';
        params.push(status);
      }

      query += ' ORDER BY n.created_at DESC';
      const notifications = await allQuery(query, params);
      res.json(notifications);
    }
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب الإشعارات' });
  }
});

// Get unread count
router.get('/unread-count', authenticateToken, async (req, res) => {
  try {
    let count = 0;
    
    if (db.prisma) {
      count = await db.prisma.notification.count({
        where: {
          userId: req.user.id,
          isRead: 0
        }
      });
    } else {
      const { allQuery } = require('../database/db');
      const result = await allQuery(
        `SELECT COUNT(*) as count FROM notifications 
         WHERE (to_user_id = ? OR to_role = ?) AND status = 'unread'`,
        [req.user.id, req.user.role]
      );
      count = result[0]?.count || 0;
    }
    
    res.json({ count });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب عدد الإشعارات' });
  }
});

// Mark notification as read
router.patch('/:id/read', authenticateToken, async (req, res) => {
  try {
    if (db.prisma) {
      await db.prisma.notification.update({
        where: { id: parseInt(req.params.id) },
        data: { isRead: 1 }
      });
    } else {
      const { runQuery } = require('../database/db');
      await runQuery(
        `UPDATE notifications SET status = 'read', read_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [req.params.id]
      );
    }
    
    res.json({ message: 'تم تحديد الإشعار كمقروء' });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء تحديث حالة الإشعار' });
  }
});

// Mark all as read
router.patch('/mark-all-read', authenticateToken, async (req, res) => {
  try {
    if (db.prisma) {
      await db.prisma.notification.updateMany({
        where: {
          userId: req.user.id,
          isRead: 0
        },
        data: { isRead: 1 }
      });
    } else {
      const { runQuery } = require('../database/db');
      await runQuery(
        `UPDATE notifications 
         SET status = 'read', read_at = CURRENT_TIMESTAMP 
         WHERE (to_user_id = ? OR to_role = ?) AND status = 'unread'`,
        [req.user.id, req.user.role]
      );
    }
    
    res.json({ message: 'تم تحديد جميع الإشعارات كمقروءة' });
  } catch (error) {
    console.error('Error marking all as read:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء تحديث الإشعارات' });
  }
});

// Create notification (helper function - optimized for performance)
const createNotification = async (fromUserId, toUserId, toRole, visitId, type, title, message) => {
  try {
    if (db.prisma) {
      // If toUserId is provided, use it directly
      if (toUserId) {
        await db.prisma.notification.create({
          data: {
            userId: toUserId,
            title,
            message: message || null,
            type: type || null,
            isRead: 0
          }
        });
      } else if (toRole) {
        // For role-based notifications, create for all active users with that role
        // This is more efficient than finding one user
        const users = await db.prisma.user.findMany({
          where: { role: toRole, isActive: 1 },
          select: { id: true }
        });
        
        // Create notifications for all users with this role in parallel
        if (users.length > 0) {
          await db.prisma.notification.createMany({
            data: users.map(user => ({
              userId: user.id,
              title,
              message: message || null,
              type: type || null,
              isRead: 0
            }))
          });
        }
      }
    } else {
      const { runQuery } = require('../database/db');
      await runQuery(
        `INSERT INTO notifications (from_user_id, to_user_id, to_role, visit_id, type, title, message) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [fromUserId, toUserId, toRole, visitId, type, title, message]
      );
    }
  } catch (error) {
    // Check if error is due to missing table (for backward compatibility)
    if (error.message && error.message.includes('no such table: notifications')) {
      console.warn('Notifications table not found. Please restart the server to create it.');
    } else {
      console.error('Error creating notification:', error);
    }
  }
};

module.exports = { router, createNotification };
