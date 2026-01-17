const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/auth');
const db = require('../database/db');

// Get dashboard statistics (enhanced)
router.get('/dashboard/stats', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const stats = {
      total_patients: 0,
      total_visits: 0,
      pending_lab: 0,
      pending_pharmacy: 0,
      pending_doctor: 0,
      completed_visits: 0,
      today_visits: 0,
      this_week_visits: 0,
      this_month_visits: 0,
      total_users: 0,
      active_users: 0,
      total_lab_results: 0,
      total_prescriptions: 0,
      total_diagnoses: 0,
      unread_notifications: 0,
      visit_trends: [],
      department_performance: {
        lab: { completed: 0, pending: 0, avg_time: 0 },
        pharmacy: { completed: 0, pending: 0, avg_time: 0 },
        doctor: { completed: 0, pending: 0, avg_time: 0 }
      }
    };

    if (db.prisma) {
      // Use Promise.all to run all counts in parallel for better performance
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      const [
        total_patients,
        total_visits,
        pending_lab,
        pending_pharmacy,
        pending_doctor,
        completed_visits,
        today_visits,
        this_week_visits,
        this_month_visits,
        total_users,
        total_lab_results,
        total_prescriptions,
        total_diagnoses,
        unread_notifications,
      ] = await Promise.all([
        db.prisma.patient.count(),
        db.prisma.visit.count(),
        db.prisma.visit.count({ 
          where: { 
            OR: [
              { status: 'pending_lab' },
              { status: 'pending_all', labCompleted: 0 }
            ]
          } 
        }),
        db.prisma.visit.count({ 
          where: { 
            OR: [
              { status: 'pending_pharmacy' },
              { status: 'pending_all', pharmacyCompleted: 0 }
            ]
          } 
        }),
        db.prisma.visit.count({ 
          where: { 
            OR: [
              { status: 'pending_doctor' },
              { status: 'pending_all', doctorCompleted: 0 }
            ]
          } 
        }),
        db.prisma.visit.count({ where: { status: 'completed' } }),
        db.prisma.visit.count({ where: { createdAt: { gte: today } } }),
        db.prisma.visit.count({ where: { createdAt: { gte: weekAgo } } }),
        db.prisma.visit.count({ where: { createdAt: { gte: monthStart } } }),
        db.prisma.user.count({ where: { isActive: 1 } }),
        db.prisma.labResult.count(),
        db.prisma.pharmacyPrescription.count(),
        db.prisma.diagnosis.count(),
        db.prisma.notification.count({ where: { isRead: 0 } }),
      ]);

      stats.total_patients = total_patients;
      stats.total_visits = total_visits;
      stats.pending_lab = pending_lab;
      stats.pending_pharmacy = pending_pharmacy;
      stats.pending_doctor = pending_doctor;
      stats.completed_visits = completed_visits;
      stats.today_visits = today_visits;
      stats.this_week_visits = this_week_visits;
      stats.this_month_visits = this_month_visits;
      stats.total_users = total_users;
      stats.total_lab_results = total_lab_results;
      stats.total_prescriptions = total_prescriptions;
      stats.total_diagnoses = total_diagnoses;
      stats.unread_notifications = unread_notifications;
    } else {
      // Fallback to SQL
      const { allQuery } = require('../database/db');
      const patientsCount = await allQuery('SELECT COUNT(*) as count FROM patients');
      stats.total_patients = patientsCount[0]?.count || 0;

      const visitsCount = await allQuery('SELECT COUNT(*) as count FROM visits');
      stats.total_visits = visitsCount[0]?.count || 0;

      // Pending lab: status = 'pending_lab' OR (status = 'pending_all' AND lab_completed = 0)
      const pendingLab = await allQuery(`
        SELECT COUNT(*) as count FROM visits 
        WHERE status = 'pending_lab' 
        OR (status = 'pending_all' AND lab_completed = 0)
      `);
      stats.pending_lab = pendingLab[0]?.count || 0;

      // Pending pharmacy: status = 'pending_pharmacy' OR (status = 'pending_all' AND pharmacy_completed = 0)
      const pendingPharmacy = await allQuery(`
        SELECT COUNT(*) as count FROM visits 
        WHERE status = 'pending_pharmacy' 
        OR (status = 'pending_all' AND pharmacy_completed = 0)
      `);
      stats.pending_pharmacy = pendingPharmacy[0]?.count || 0;

      // Pending doctor: status = 'pending_doctor' OR (status = 'pending_all' AND doctor_completed = 0)
      const pendingDoctor = await allQuery(`
        SELECT COUNT(*) as count FROM visits 
        WHERE status = 'pending_doctor' 
        OR (status = 'pending_all' AND doctor_completed = 0)
      `);
      stats.pending_doctor = pendingDoctor[0]?.count || 0;

      const completed = await allQuery("SELECT COUNT(*) as count FROM visits WHERE status = 'completed'");
      stats.completed_visits = completed[0]?.count || 0;

      const todayVisits = await allQuery("SELECT COUNT(*) as count FROM visits WHERE DATE(created_at) = DATE('now')");
      stats.today_visits = todayVisits[0]?.count || 0;

      const weekVisits = await allQuery(`
        SELECT COUNT(*) as count FROM visits 
        WHERE created_at >= datetime('now', '-7 days')
      `);
      stats.this_week_visits = weekVisits[0]?.count || 0;

      const monthVisits = await allQuery(`
        SELECT COUNT(*) as count FROM visits 
        WHERE created_at >= datetime('now', 'start of month')
      `);
      stats.this_month_visits = monthVisits[0]?.count || 0;

      const usersCount = await allQuery('SELECT COUNT(*) as count FROM users WHERE is_active = 1');
      stats.total_users = usersCount[0]?.count || 0;

      const activeUsers = await allQuery(`
        SELECT COUNT(DISTINCT user_id) as count FROM user_sessions 
        WHERE expires_at > datetime('now') AND created_at >= datetime('now', '-1 day')
      `);
      stats.active_users = activeUsers[0]?.count || 0;

      const labResults = await allQuery('SELECT COUNT(*) as count FROM lab_results');
      stats.total_lab_results = labResults[0]?.count || 0;

      const prescriptions = await allQuery('SELECT COUNT(*) as count FROM pharmacy_prescriptions');
      stats.total_prescriptions = prescriptions[0]?.count || 0;

      const diagnoses = await allQuery('SELECT COUNT(*) as count FROM diagnoses');
      stats.total_diagnoses = diagnoses[0]?.count || 0;

      const unreadNotif = await allQuery(`
        SELECT COUNT(*) as count FROM notifications 
        WHERE (to_role = 'admin' OR to_user_id IS NULL) AND status = 'unread'
      `);
      stats.unread_notifications = unreadNotif[0]?.count || 0;
    }

    // Visit trends (last 7 days)
    let trends;
    if (db.prisma) {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const visits = await db.prisma.visit.findMany({
        where: { createdAt: { gte: weekAgo } },
        select: { createdAt: true }
      });
      
      // Group by date
      const trendsMap = {};
      visits.forEach(v => {
        const date = v.createdAt.toISOString().split('T')[0];
        trendsMap[date] = (trendsMap[date] || 0) + 1;
      });
      
      trends = Object.entries(trendsMap).map(([date, count]) => ({ date, count }));
      trends.sort((a, b) => a.date.localeCompare(b.date));
    } else {
      const { allQuery } = require('../database/db');
      trends = await allQuery(`
        SELECT DATE(created_at) as date, COUNT(*) as count
        FROM visits
        WHERE created_at >= datetime('now', '-7 days')
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `);
    }
    stats.visit_trends = trends.map(t => ({ date: t.date, count: t.count }));

    // Department performance (optimized - use count instead of findMany)
    if (db.prisma) {
      const [
        labCompleted,
        pharmCompleted,
        doctorCompleted,
      ] = await Promise.all([
        db.prisma.visit.count({
          where: {
            status: { in: ['pending_pharmacy', 'pending_doctor', 'completed'] },
            labResults: { some: {} }
          }
        }),
        db.prisma.visit.count({
          where: {
            status: { in: ['pending_doctor', 'completed'] },
            prescriptions: { some: {} }
          }
        }),
        db.prisma.visit.count({
          where: {
            status: 'completed',
            diagnoses: { some: {} }
          }
        }),
      ]);

      stats.department_performance.lab.completed = labCompleted;
      stats.department_performance.lab.pending = stats.pending_lab;
      stats.department_performance.pharmacy.completed = pharmCompleted;
      stats.department_performance.pharmacy.pending = stats.pending_pharmacy;
      stats.department_performance.doctor.completed = doctorCompleted;
      stats.department_performance.doctor.pending = stats.pending_doctor;
    } else {
      const { allQuery } = require('../database/db');
      const labCompleted = await allQuery(`
        SELECT COUNT(*) as count FROM visits 
        WHERE status IN ('pending_pharmacy', 'pending_doctor', 'completed')
        AND id IN (SELECT DISTINCT visit_id FROM lab_results)
      `);
      stats.department_performance.lab.completed = labCompleted[0]?.count || 0;
      stats.department_performance.lab.pending = stats.pending_lab;

      const pharmCompleted = await allQuery(`
        SELECT COUNT(*) as count FROM visits 
        WHERE status IN ('pending_doctor', 'completed')
        AND id IN (SELECT DISTINCT visit_id FROM pharmacy_prescriptions)
      `);
      stats.department_performance.pharmacy.completed = pharmCompleted[0]?.count || 0;
      stats.department_performance.pharmacy.pending = stats.pending_pharmacy;

      const doctorCompleted = await allQuery(`
        SELECT COUNT(*) as count FROM visits 
        WHERE status = 'completed'
        AND id IN (SELECT DISTINCT visit_id FROM diagnoses)
      `);
      stats.department_performance.doctor.completed = doctorCompleted[0]?.count || 0;
      stats.department_performance.doctor.pending = stats.pending_doctor;
    }

    res.json(stats);
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب الإحصائيات' });
  }
});

// Get all visits with details
router.get('/visits', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { status, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    let visits;
    if (db.prisma) {
      const where = {};
      if (status) {
        where.status = status;
      }
      
      visits = await db.prisma.visit.findMany({
        where,
        select: {
          id: true,
          patientId: true,
          visitNumber: true,
          status: true,
          labCompleted: true,
          pharmacyCompleted: true,
          doctorCompleted: true,
          createdBy: true,
          createdAt: true,
          updatedAt: true,
          patient: {
            select: {
              name: true,
              nationalId: true,
              age: true,
              gender: true,
            },
          },
          creator: {
            select: {
              name: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit),
        skip: parseInt(offset)
      });
      
      visits = visits.map(v => ({
        ...v,
        // Patient info
        patient_name: v.patient?.name || null,
        national_id: v.patient?.nationalId || null,
        age: v.patient?.age || null,
        gender: v.patient?.gender || null,
        // Creator info
        created_by_name: v.creator?.name || null,
        // Convert camelCase to snake_case for compatibility
        visit_number: v.visitNumber,
        lab_completed: v.labCompleted,
        pharmacy_completed: v.pharmacyCompleted,
        doctor_completed: v.doctorCompleted,
        created_by: v.createdBy,
        patient_id: v.patientId,
        created_at: v.createdAt,
        updated_at: v.updatedAt
      }));
    } else {
      const { allQuery } = require('../database/db');
      let query = `
        SELECT v.*, p.name as patient_name, p.national_id, p.age, p.gender,
               u.name as created_by_name
        FROM visits v
        LEFT JOIN patients p ON v.patient_id = p.id
        LEFT JOIN users u ON v.created_by = u.id
      `;

      const params = [];
      if (status) {
        query += ' WHERE v.status = ?';
        params.push(status);
      }

      query += ' ORDER BY v.created_at DESC LIMIT ? OFFSET ?';
      params.push(parseInt(limit), parseInt(offset));

      visits = await allQuery(query, params);
    }
    
    res.json(visits);
  } catch (error) {
    console.error('Error fetching visits:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب الزيارات' });
  }
});

// Get all patients
router.get('/patients', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    let patients;
    
    if (db.prisma) {
      patients = await db.prisma.patient.findMany({
        include: { creator: true },
        orderBy: { createdAt: 'desc' }
      });
      
      patients = patients.map(p => ({
        ...p,
        // Convert camelCase to snake_case for frontend compatibility
        national_id: p.nationalId,
        date_of_birth: p.dateOfBirth,
        blood_type: p.bloodType,
        patient_category: p.patientCategory,
        medical_history: p.medicalHistory,
        emergency_contact_name: p.emergencyContactName,
        emergency_contact_phone: p.emergencyContactPhone,
        emergency_contact_relation: p.emergencyContactRelation,
        insurance_number: p.insuranceNumber,
        insurance_type: p.insuranceType,
        is_active: p.isActive,
        created_by: p.createdBy,
        created_by_name: p.creator?.name || null,
        created_at: p.createdAt,
        updated_at: p.updatedAt
      }));
    } else {
      const { allQuery } = require('../database/db');
      patients = await allQuery(`
        SELECT p.*, u.name as created_by_name
        FROM patients p
        LEFT JOIN users u ON p.created_by = u.id
        ORDER BY p.created_at DESC
      `);
    }
    
    res.json(patients);
  } catch (error) {
    console.error('Error fetching patients:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب المرضى' });
  }
});

// Get all users
router.get('/users', authenticateToken, requireRole('admin'), async (req, res) => {
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
        created_by_name: u.creator?.name || null
      }));
    } else {
      const { allQuery } = require('../database/db');
      users = await allQuery(`
        SELECT u.*, r.display_name as role_display_name, 
               creator.name as created_by_name
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

// Get activity log
router.get('/activity-log', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { limit = 100 } = req.query;
    let activities;
    
    if (db.prisma) {
      activities = await db.prisma.activityLog.findMany({
        include: {
          user: {
            select: {
              name: true,
              role: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit)
      });
      
      activities = activities.map(a => ({
        ...a,
        // Convert camelCase to snake_case for frontend compatibility
        entity_type: a.entityType,
        entity_id: a.entityId,
        user_id: a.userId,
        created_at: a.createdAt,
        user_name: a.user?.name || null,
        user_role: a.user?.role || null
      }));
    } else {
      const { allQuery } = require('../database/db');
      activities = await allQuery(
        `SELECT al.*, u.name as user_name, u.role as user_role
         FROM activity_log al
         LEFT JOIN users u ON al.user_id = u.id
         ORDER BY al.created_at DESC
         LIMIT ?`,
        [parseInt(limit)]
      );
    }
    
    res.json(activities);
  } catch (error) {
    console.error('Error fetching activity log:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب سجل الأنشطة' });
  }
});

// Force close visit (admin only)
router.post('/visits/:id/force-close', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const visitId = parseInt(req.params.id);
    
    let visit;
    if (db.prisma) {
      visit = await db.prisma.visit.findUnique({
        where: { id: visitId }
      });
    } else {
      const { getQuery } = require('../database/db');
      visit = await getQuery('SELECT * FROM visits WHERE id = ?', [req.params.id]);
    }
    
    if (!visit) {
      return res.status(404).json({ error: 'الزيارة غير موجودة' });
    }

    if (db.prisma) {
      await db.prisma.visit.update({
        where: { id: visitId },
        data: { status: 'completed' }
      });
      
      await db.prisma.visitStatusHistory.create({
        data: {
          visitId,
          status: 'completed',
          changedBy: req.user.id,
          notes: 'تم إغلاق الزيارة من قبل المدير'
        }
      });
      
      await db.prisma.activityLog.create({
        data: {
          userId: req.user.id,
          action: 'force_close_visit',
          entityType: 'visit',
          entityId: visitId,
          details: `تم إغلاق الزيارة ${visit.visitNumber || visit.visit_number} من قبل المدير`
        }
      });
    } else {
      const { runQuery } = require('../database/db');
      await runQuery(
        'UPDATE visits SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        ['completed', req.params.id]
      );

      await runQuery(
        `INSERT INTO visit_status_history (visit_id, status, changed_by, notes) 
         VALUES (?, ?, ?, ?)`,
        [req.params.id, 'completed', req.user.id, 'تم إغلاق الزيارة من قبل المدير']
      );

      await runQuery(
        `INSERT INTO activity_log (user_id, action, entity_type, entity_id, details) 
         VALUES (?, ?, ?, ?, ?)`,
        [req.user.id, 'force_close_visit', 'visit', req.params.id, `تم إغلاق الزيارة ${visit.visit_number} من قبل المدير`]
      );
    }

    res.json({ message: 'تم إغلاق الزيارة بنجاح' });
  } catch (error) {
    console.error('Error force closing visit:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء إغلاق الزيارة' });
  }
});

// Get database tables information (admin only)
router.get('/database/tables', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    if (db.prisma) {
      // Get all tables from PostgreSQL
      const tables = await db.prisma.$queryRaw`
        SELECT 
          table_name,
          (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
        FROM information_schema.tables t
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        ORDER BY table_name
      `;

      // Get row counts for each table
      const tablesWithCounts = await Promise.all(
        tables.map(async (table) => {
          try {
            const tableName = table.table_name;
            // Escape table name for safety
            const result = await db.prisma.$queryRawUnsafe(
              `SELECT COUNT(*) as count FROM "${tableName}"`
            );
            const count = result[0]?.count || 0;
            return {
              name: tableName,
              columns: parseInt(table.column_count) || 0,
              rows: parseInt(count) || 0
            };
          } catch (error) {
            return {
              name: table.table_name,
              columns: parseInt(table.column_count) || 0,
              rows: -1,
              error: error.message
            };
          }
        })
      );

      res.json({
        success: true,
        database_type: 'PostgreSQL',
        total_tables: tablesWithCounts.length,
        tables: tablesWithCounts
      });
    } else {
      // SQLite fallback
      const { allQuery } = require('../database/db');
      const tables = await allQuery(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
      );

      const tablesWithCounts = await Promise.all(
        tables.map(async (table) => {
          try {
            const result = await allQuery(`SELECT COUNT(*) as count FROM ${table.name}`);
            return {
              name: table.name,
              rows: result[0]?.count || 0
            };
          } catch (error) {
            return {
              name: table.name,
              rows: -1,
              error: error.message
            };
          }
        })
      );

      res.json({
        success: true,
        database_type: 'SQLite',
        total_tables: tablesWithCounts.length,
        tables: tablesWithCounts
      });
    }
  } catch (error) {
    console.error('Error fetching database tables:', error);
    res.status(500).json({ 
      success: false,
      error: 'حدث خطأ أثناء جلب معلومات الجداول',
      details: error.message 
    });
  }
});

module.exports = router;
