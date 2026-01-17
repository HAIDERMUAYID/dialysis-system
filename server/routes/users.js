const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { authenticateToken, requireRole } = require('../middleware/auth');
const db = require('../database/db');
const { activityLogger } = require('../middleware/activityLogger');

// Get all users (admin only)
router.get('/', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    let users;
    
    if (db.prisma) {
      users = await db.prisma.user.findMany({
        include: {
          roleRef: true,
          creator: true
        },
        orderBy: { createdAt: 'desc' }
      });
      
      users = users.map(u => ({
        ...u,
        // Convert camelCase to snake_case for frontend compatibility
        created_at: u.createdAt,
        updated_at: u.updatedAt,
        is_active: u.isActive,
        created_by: u.createdBy,
        role_display_name: u.roleRef?.displayName || null,
        created_by_name: u.creator?.name || null,
        active_sessions: 0 // TODO: implement if needed
      }));
    } else {
      const { allQuery } = require('../database/db');
      users = await allQuery(`
        SELECT u.*, r.display_name as role_display_name, 
               creator.name as created_by_name,
               (SELECT COUNT(*) FROM user_sessions WHERE user_id = u.id AND expires_at > datetime('now')) as active_sessions
        FROM users u
        LEFT JOIN roles r ON u.role_id = r.id
        LEFT JOIN users creator ON u.created_by = creator.id
        ORDER BY u.created_at DESC
      `);
    }
    
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب المستخدمين' });
  }
});

// Get user by ID
router.get('/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    
    let user, permissions;
    
    if (db.prisma) {
      user = await db.prisma.user.findUnique({
        where: { id: userId },
        include: {
          roleRef: true,
          creator: true
        }
      });
      
      if (!user) {
        return res.status(404).json({ error: 'المستخدم غير موجود' });
      }
      
      user = {
        ...user,
        // Convert camelCase to snake_case for frontend compatibility
        created_at: user.createdAt,
        updated_at: user.updatedAt,
        is_active: user.isActive,
        created_by: user.createdBy,
        role_display_name: user.roleRef?.displayName || null,
        created_by_name: user.creator?.name || null
      };
      
      // Get user permissions
      if (user.roleId) {
        permissions = await db.prisma.permission.findMany({
          where: {
            rolePermissions: {
              some: {
                roleId: user.roleId
              }
            }
          },
          orderBy: [
            { category: 'asc' },
            { displayName: 'asc' }
          ]
        });
      } else {
        permissions = [];
      }
    } else {
      const { getQuery, allQuery } = require('../database/db');
      user = await getQuery(`
        SELECT u.*, r.display_name as role_display_name,
               creator.name as created_by_name
        FROM users u
        LEFT JOIN roles r ON u.role_id = r.id
        LEFT JOIN users creator ON u.created_by = creator.id
        WHERE u.id = ?
      `, [req.params.id]);

      if (!user) {
        return res.status(404).json({ error: 'المستخدم غير موجود' });
      }

      permissions = await allQuery(`
        SELECT p.* 
        FROM permissions p
        INNER JOIN role_permissions rp ON p.id = rp.permission_id
        INNER JOIN roles r ON rp.role_id = r.id
        INNER JOIN users u ON u.role_id = r.id
        WHERE u.id = ?
        ORDER BY p.category, p.display_name
      `, [req.params.id]);
    }

    res.json({ ...user, permissions });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب بيانات المستخدم' });
  }
});

// Create new user
router.post('/', authenticateToken, requireRole('admin'), activityLogger('create', 'user'), async (req, res) => {
  try {
    const { username, password, role, role_id, name, email, phone, is_active } = req.body;

    if (!username || !password || !name || !role) {
      return res.status(400).json({ error: 'جميع الحقول المطلوبة يجب ملؤها' });
    }

    // Check if username exists
    let existing;
    if (db.prisma) {
      existing = await db.prisma.user.findUnique({
        where: { username }
      });
    } else {
      const { getQuery } = require('../database/db');
      existing = await getQuery('SELECT id FROM users WHERE username = ?', [username]);
    }
    
    if (existing) {
      return res.status(400).json({ error: 'اسم المستخدم موجود بالفعل' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Determine role_id if not provided
    let finalRoleId = role_id;
    if (!finalRoleId) {
      let roleRecord;
      if (db.prisma) {
        roleRecord = await db.prisma.role.findUnique({
          where: { name: role }
        });
      } else {
        const { getQuery } = require('../database/db');
        roleRecord = await getQuery('SELECT id FROM roles WHERE name = ?', [role]);
      }
      finalRoleId = roleRecord?.id || null;
    }

    // Create user
    let result;
    if (db.prisma) {
      const newUser = await db.prisma.user.create({
        data: {
          username,
          password: hashedPassword,
          role,
          roleId: finalRoleId,
          name,
          email: email || null,
          phone: phone || null,
          isActive: is_active !== undefined ? is_active : 1,
          createdBy: req.user.id
        }
      });
      result = { lastID: newUser.id };
    } else {
      const { runQuery } = require('../database/db');
      result = await runQuery(
        `INSERT INTO users (username, password, role, role_id, name, email, phone, is_active, created_by) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [username, hashedPassword, role, finalRoleId, name, email || null, phone || null, is_active !== undefined ? is_active : 1, req.user.id]
      );
    }

    // Log activity
    if (db.prisma) {
      await db.prisma.auditLog.create({
        data: {
          userId: req.user.id,
          action: 'create_user',
          entityType: 'user',
          entityId: result.lastID,
          newValues: JSON.stringify({ username, name, role }),
          ipAddress: req.ip,
          details: `تم إنشاء مستخدم جديد: ${username}`
        }
      });
    } else {
      const { runQuery } = require('../database/db');
      await runQuery(
        `INSERT INTO audit_log (user_id, action, entity_type, entity_id, new_values, ip_address, details)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [req.user.id, 'create_user', 'user', result.lastID, JSON.stringify({ username, name, role }), req.ip, `تم إنشاء مستخدم جديد: ${username}`]
      );
    }

    let newUser;
    if (db.prisma) {
      newUser = await db.prisma.user.findUnique({
        where: { id: result.lastID },
        include: { roleRef: true }
      });
      if (newUser) {
        newUser = {
          ...newUser,
          // Convert camelCase to snake_case for frontend compatibility
          created_at: newUser.createdAt,
          updated_at: newUser.updatedAt,
          is_active: newUser.isActive,
          created_by: newUser.createdBy,
          role_display_name: newUser.roleRef?.displayName || null
        };
      }
    } else {
      const { getQuery } = require('../database/db');
      newUser = await getQuery(
        `SELECT u.*, r.display_name as role_display_name 
         FROM users u 
         LEFT JOIN roles r ON u.role_id = r.id 
         WHERE u.id = ?`,
        [result.lastID]
      );
    }

    res.status(201).json({ message: 'تم إنشاء المستخدم بنجاح', user: newUser });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء إنشاء المستخدم' });
  }
});

// Update user
router.put('/:id', authenticateToken, requireRole('admin'), activityLogger('update', 'user'), async (req, res) => {
  try {
    const { username, password, role, role_id, name, email, phone, is_active } = req.body;
    const userId = parseInt(req.params.id);

    // Get old user data for audit
    let oldUser;
    if (db.prisma) {
      oldUser = await db.prisma.user.findUnique({
        where: { id: userId }
      });
    } else {
      const { getQuery } = require('../database/db');
      oldUser = await getQuery('SELECT * FROM users WHERE id = ?', [userId]);
    }
    
    if (!oldUser) {
      return res.status(404).json({ error: 'المستخدم غير موجود' });
    }

    // Check if username is taken by another user
    if (username && username !== oldUser.username) {
      let existing;
      if (db.prisma) {
        existing = await db.prisma.user.findFirst({
          where: {
            username,
            id: { not: userId }
          }
        });
      } else {
        const { getQuery } = require('../database/db');
        existing = await getQuery('SELECT id FROM users WHERE username = ? AND id != ?', [username, userId]);
      }
      
      if (existing) {
        return res.status(400).json({ error: 'اسم المستخدم موجود بالفعل' });
      }
    }

    // Determine role_id if not provided
    let finalRoleId = role_id;
    if (role !== undefined && !finalRoleId) {
      // Only look up roleId if role is being updated
      let roleRecord;
      if (db.prisma) {
        roleRecord = await db.prisma.role.findUnique({
          where: { name: role }
        });
      } else {
        const { getQuery } = require('../database/db');
        roleRecord = await getQuery('SELECT id FROM roles WHERE name = ?', [role]);
      }
      finalRoleId = roleRecord?.id || null;
    }

    let updatedUser;
    if (db.prisma) {
      const updateData = {};
      if (username !== undefined) updateData.username = username;
      if (password) updateData.password = await bcrypt.hash(password, 10);
      if (role !== undefined) {
        updateData.role = role;
        // Only update roleId if we have a valid value
        if (finalRoleId !== undefined && finalRoleId !== null) {
          updateData.roleId = finalRoleId;
        } else if (role) {
          // If role is provided but roleId is null/undefined, try to find it
          try {
            const roleRecord = await db.prisma.role.findUnique({
              where: { name: role }
            });
            if (roleRecord) {
              updateData.roleId = roleRecord.id;
            }
          } catch (err) {
            console.error('Error finding role:', err);
            // Continue without roleId if role lookup fails
          }
        }
      }
      if (name !== undefined) updateData.name = name;
      if (email !== undefined) updateData.email = email || null; // Allow setting email to null
      if (phone !== undefined) updateData.phone = phone || null; // Allow setting phone to null
      if (is_active !== undefined) updateData.isActive = is_active;
      
      // Check if updateData is empty
      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ error: 'لا توجد بيانات للتحديث' });
      }
      
      try {
        updatedUser = await db.prisma.user.update({
          where: { id: userId },
          data: updateData,
          include: { roleRef: true }
        });
      } catch (error) {
        console.error('Prisma update error:', error);
        // Provide more specific error messages
        if (error.code === 'P2002') {
          return res.status(400).json({ error: 'اسم المستخدم موجود بالفعل' });
        } else if (error.code === 'P2025') {
          return res.status(404).json({ error: 'المستخدم غير موجود' });
        }
        throw error; // Re-throw to be caught by outer catch
      }
      
      updatedUser = {
        ...updatedUser,
        // Convert camelCase to snake_case for frontend compatibility
        created_at: updatedUser.createdAt,
        updated_at: updatedUser.updatedAt,
        is_active: updatedUser.isActive,
        created_by: updatedUser.createdBy,
        role_display_name: updatedUser.roleRef?.displayName || null
      };
    } else {
      const { runQuery, getQuery } = require('../database/db');
      // Build update query
      const updates = [];
      const params = [];

      if (username !== undefined) {
        updates.push('username = ?');
        params.push(username);
      }
      if (password) {
        const hashedPassword = await bcrypt.hash(password, 10);
        updates.push('password = ?');
        params.push(hashedPassword);
      }
      if (role !== undefined) {
        updates.push('role = ?');
        params.push(role);
        if (finalRoleId !== undefined) {
          updates.push('role_id = ?');
          params.push(finalRoleId);
        }
      }
      if (name !== undefined) {
        updates.push('name = ?');
        params.push(name);
      }
      if (email !== undefined) {
        updates.push('email = ?');
        params.push(email);
      }
      if (phone !== undefined) {
        updates.push('phone = ?');
        params.push(phone);
      }
      if (is_active !== undefined) {
        updates.push('is_active = ?');
        params.push(is_active);
      }
      
      updates.push('updated_at = CURRENT_TIMESTAMP');
      params.push(userId);

      await runQuery(
        `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
        params
      );

      updatedUser = await getQuery(
        `SELECT u.*, r.display_name as role_display_name 
         FROM users u 
         LEFT JOIN roles r ON u.role_id = r.id 
         WHERE u.id = ?`,
        [userId]
      );
    }

    // Log activity in background (non-blocking) - activityLogger middleware will also log
    // This is a duplicate log but ensures we have the audit trail even if middleware fails
    if (db.prisma) {
      db.prisma.auditLog.create({
        data: {
          userId: req.user.id,
          action: 'update_user',
          entityType: 'user',
          entityId: userId,
          oldValues: JSON.stringify(oldUser),
          newValues: JSON.stringify(req.body),
          ipAddress: req.ip,
          details: `تم تحديث بيانات المستخدم: ${oldUser.username}`
        }
      }).catch(err => {
        // Silently fail - don't break the response
        if (err.message && !err.message.includes('no such table') && !err.message.includes('does not exist')) {
          console.error('Error logging audit (non-critical):', err.message);
        }
      });
    } else {
      const { runQuery } = require('../database/db');
      runQuery(
        `INSERT INTO audit_log (user_id, action, entity_type, entity_id, old_values, new_values, ip_address, details)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [req.user.id, 'update_user', 'user', userId, JSON.stringify(oldUser), JSON.stringify(req.body), req.ip, `تم تحديث بيانات المستخدم: ${oldUser.username}`]
      ).catch(err => {
        // Silently fail - don't break the response
        if (err.message && !err.message.includes('no such table') && !err.message.includes('does not exist')) {
          console.error('Error logging audit (non-critical):', err.message);
        }
      });
    }

    res.json({ message: 'تم تحديث المستخدم بنجاح', user: updatedUser });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء تحديث المستخدم' });
  }
});

// Delete user
router.delete('/:id', authenticateToken, requireRole('admin'), activityLogger('delete', 'user'), async (req, res) => {
  try {
    const userId = parseInt(req.params.id);

    // Prevent deleting self
    if (userId === req.user.id) {
      return res.status(400).json({ error: 'لا يمكنك حذف حسابك الخاص' });
    }

    let user;
    if (db.prisma) {
      user = await db.prisma.user.findUnique({
        where: { id: userId }
      });
    } else {
      const { getQuery } = require('../database/db');
      user = await getQuery('SELECT * FROM users WHERE id = ?', [userId]);
    }
    
    if (!user) {
      return res.status(404).json({ error: 'المستخدم غير موجود' });
    }

    // Prevent deleting admin users
    if (user.role === 'admin') {
      return res.status(400).json({ error: 'لا يمكن حذف مستخدمين الإدارة' });
    }

    if (db.prisma) {
      await db.prisma.user.delete({
        where: { id: userId }
      });
    } else {
      const { runQuery } = require('../database/db');
      await runQuery('DELETE FROM users WHERE id = ?', [userId]);
    }

    // Log activity
    if (db.prisma) {
      await db.prisma.auditLog.create({
        data: {
          userId: req.user.id,
          action: 'delete_user',
          entityType: 'user',
          entityId: userId,
          oldValues: JSON.stringify(user),
          ipAddress: req.ip,
          details: `تم حذف المستخدم: ${user.username}`
        }
      });
    } else {
      const { runQuery } = require('../database/db');
      await runQuery(
        `INSERT INTO audit_log (user_id, action, entity_type, entity_id, old_values, ip_address, details)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [req.user.id, 'delete_user', 'user', userId, JSON.stringify(user), req.ip, `تم حذف المستخدم: ${user.username}`]
      );
    }

    res.json({ message: 'تم حذف المستخدم بنجاح' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء حذف المستخدم' });
  }
});

// Get all roles
router.get('/roles/list', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    let roles;
    
    if (db.prisma) {
      roles = await db.prisma.role.findMany({
        include: {
          _count: {
            select: {
              users: true,
              permissions: true
            }
          }
        },
        orderBy: [
          { isSystemRole: 'desc' },
          { displayName: 'asc' }
        ]
      });
      
      roles = roles.map(r => ({
        ...r,
        users_count: r._count?.users || 0,
        permissions_count: r._count?.permissions || 0
      }));
    } else {
      const { allQuery } = require('../database/db');
      roles = await allQuery(`
        SELECT r.*, 
               (SELECT COUNT(*) FROM users WHERE role_id = r.id) as users_count,
               (SELECT COUNT(*) FROM role_permissions WHERE role_id = r.id) as permissions_count
        FROM roles r
        ORDER BY r.is_system_role DESC, r.display_name
      `);
    }
    
    res.json(roles);
  } catch (error) {
    console.error('Error fetching roles:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب الأدوار' });
  }
});

// Get role with permissions
router.get('/roles/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const roleId = parseInt(req.params.id);
    
    let role, permissions;
    
    if (db.prisma) {
      role = await db.prisma.role.findUnique({
        where: { id: roleId }
      });
      
      if (!role) {
        return res.status(404).json({ error: 'الدور غير موجود' });
      }
      
      permissions = await db.prisma.permission.findMany({
        where: {
          rolePermissions: {
            some: {
              roleId
            }
          }
        },
        orderBy: [
          { category: 'asc' },
          { displayName: 'asc' }
        ]
      });
    } else {
      const { getQuery, allQuery } = require('../database/db');
      role = await getQuery('SELECT * FROM roles WHERE id = ?', [req.params.id]);
      
      if (!role) {
        return res.status(404).json({ error: 'الدور غير موجود' });
      }

      permissions = await allQuery(`
        SELECT p.* 
        FROM permissions p
        INNER JOIN role_permissions rp ON p.id = rp.permission_id
        WHERE rp.role_id = ?
        ORDER BY p.category, p.display_name
      `, [req.params.id]);
    }

    res.json({ ...role, permissions });
  } catch (error) {
    console.error('Error fetching role:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب بيانات الدور' });
  }
});

// Get all permissions
router.get('/permissions/list', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    let permissions;
    
    if (db.prisma) {
      permissions = await db.prisma.permission.findMany({
        include: {
          _count: {
            select: {
              rolePermissions: true
            }
          }
        },
        orderBy: [
          { category: 'asc' },
          { displayName: 'asc' }
        ]
      });
      
      permissions = permissions.map(p => ({
        ...p,
        roles_count: p._count?.rolePermissions || 0
      }));
    } else {
      const { allQuery } = require('../database/db');
      permissions = await allQuery(`
        SELECT p.*, 
               (SELECT COUNT(*) FROM role_permissions WHERE permission_id = p.id) as roles_count
        FROM permissions p
        ORDER BY p.category, p.display_name
      `);
    }
    
    res.json(permissions);
  } catch (error) {
    console.error('Error fetching permissions:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب الصلاحيات' });
  }
});

// Update role permissions
router.put('/roles/:id/permissions', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { permission_ids } = req.body;
    const roleId = parseInt(req.params.id);

    if (!Array.isArray(permission_ids)) {
      return res.status(400).json({ error: 'يجب إرسال قائمة بمعرفات الصلاحيات' });
    }

    // Check if role exists
    let role;
    if (db.prisma) {
      role = await db.prisma.role.findUnique({
        where: { id: roleId }
      });
    } else {
      const { getQuery } = require('../database/db');
      role = await getQuery('SELECT * FROM roles WHERE id = ?', [roleId]);
    }
    
    if (!role) {
      return res.status(404).json({ error: 'الدور غير موجود' });
    }

    // Prevent modifying system roles permissions
    if (role.isSystemRole || role.is_system_role) {
      return res.status(400).json({ error: 'لا يمكن تعديل صلاحيات الأدوار النظامية' });
    }

    if (db.prisma) {
      // Delete existing permissions
      await db.prisma.rolePermission.deleteMany({
        where: { roleId }
      });

      // Add new permissions
      if (permission_ids.length > 0) {
        await db.prisma.rolePermission.createMany({
          data: permission_ids.map(permId => ({
            roleId,
            permissionId: parseInt(permId)
          }))
        });
      }
    } else {
      const { runQuery } = require('../database/db');
      // Delete existing permissions
      await runQuery('DELETE FROM role_permissions WHERE role_id = ?', [roleId]);

      // Add new permissions
      if (permission_ids.length > 0) {
        for (const permId of permission_ids) {
          await runQuery(
            'INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)',
            [roleId, permId]
          );
        }
      }
    }

    // Log activity
    const displayName = role.displayName || role.display_name;
    if (db.prisma) {
      await db.prisma.auditLog.create({
        data: {
          userId: req.user.id,
          action: 'update_role_permissions',
          entityType: 'role',
          entityId: roleId,
          newValues: JSON.stringify({ permission_ids }),
          ipAddress: req.ip,
          details: `تم تحديث صلاحيات الدور: ${displayName}`
        }
      });
    } else {
      const { runQuery } = require('../database/db');
      await runQuery(
        `INSERT INTO audit_log (user_id, action, entity_type, entity_id, new_values, ip_address, details)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [req.user.id, 'update_role_permissions', 'role', roleId, JSON.stringify({ permission_ids }), req.ip, `تم تحديث صلاحيات الدور: ${displayName}`]
      );
    }

    res.json({ message: 'تم تحديث صلاحيات الدور بنجاح' });
  } catch (error) {
    console.error('Error updating role permissions:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء تحديث صلاحيات الدور' });
  }
});

// Create custom role
router.post('/roles', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { name, display_name, description, permission_ids } = req.body;

    if (!name || !display_name) {
      return res.status(400).json({ error: 'اسم الدور والاسم المعروض مطلوبان' });
    }

    // Check if role name exists
    let existing;
    if (db.prisma) {
      existing = await db.prisma.role.findUnique({
        where: { name }
      });
    } else {
      const { getQuery } = require('../database/db');
      existing = await getQuery('SELECT id FROM roles WHERE name = ?', [name]);
    }
    
    if (existing) {
      return res.status(400).json({ error: 'اسم الدور موجود بالفعل' });
    }

    let newRole;
    if (db.prisma) {
      // Create role
      newRole = await db.prisma.role.create({
        data: {
          name,
          displayName: display_name,
          description: description || null,
          isSystemRole: 0
        }
      });

      // Add permissions if provided
      if (Array.isArray(permission_ids) && permission_ids.length > 0) {
        await db.prisma.rolePermission.createMany({
          data: permission_ids.map(permId => ({
            roleId: newRole.id,
            permissionId: parseInt(permId)
          }))
        });
      }
    } else {
      const { runQuery, getQuery } = require('../database/db');
      // Create role
      const result = await runQuery(
        `INSERT INTO roles (name, display_name, description, is_system_role) VALUES (?, ?, ?, ?)`,
        [name, display_name, description || null, 0]
      );

      // Add permissions if provided
      if (Array.isArray(permission_ids) && permission_ids.length > 0) {
        for (const permId of permission_ids) {
          await runQuery(
            'INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)',
            [result.lastID, permId]
          );
        }
      }

      newRole = await getQuery('SELECT * FROM roles WHERE id = ?', [result.lastID]);
    }

    // Log activity
    if (db.prisma) {
      await db.prisma.auditLog.create({
        data: {
          userId: req.user.id,
          action: 'create_role',
          entityType: 'role',
          entityId: newRole.id,
          newValues: JSON.stringify({ name, display_name }),
          ipAddress: req.ip,
          details: `تم إنشاء دور جديد: ${display_name}`
        }
      });
    } else {
      const { runQuery } = require('../database/db');
      await runQuery(
        `INSERT INTO audit_log (user_id, action, entity_type, entity_id, new_values, ip_address, details)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [req.user.id, 'create_role', 'role', newRole.id, JSON.stringify({ name, display_name }), req.ip, `تم إنشاء دور جديد: ${display_name}`]
      );
    }

    res.status(201).json({ message: 'تم إنشاء الدور بنجاح', role: newRole });
  } catch (error) {
    console.error('Error creating role:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء إنشاء الدور' });
  }
});

module.exports = router;
