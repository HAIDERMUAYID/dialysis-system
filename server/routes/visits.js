const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/auth');
const db = require('../database/db');
const { createNotification } = require('./notifications');

// Generate visit number (optimized)
const generateVisitNumber = async () => {
  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, '0');
  const date = String(new Date().getDate()).padStart(2, '0');
  
  let count = 0;
  if (db.prisma) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // Use count with date range for better performance
    count = await db.prisma.visit.count({
      where: {
        createdAt: {
          gte: today,
          lt: tomorrow
        }
      }
    });
    count = count + 1;
  } else {
    const { allQuery } = require('../database/db');
    const todayVisits = await allQuery(
      `SELECT COUNT(*) as count FROM visits WHERE DATE(created_at) = DATE('now')`
    );
    count = (todayVisits[0]?.count || 0) + 1;
  }
  
  const visitNumber = `${year}${month}${date}-${String(count).padStart(4, '0')}`;
  return visitNumber;
};

// Get all visits
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { status, role } = req.user;
    
    if (db.prisma) {
      // Use Prisma
      const where = {};
      
      if (role === 'lab') {
        where.OR = [
          { status: 'pending_all', labCompleted: 0 },
          { labCompleted: 1 }
        ];
      } else if (role === 'pharmacist') {
        where.OR = [
          { status: 'pending_all', pharmacyCompleted: 0 },
          { pharmacyCompleted: 1 }
        ];
      } else if (role === 'doctor') {
        where.OR = [
          { status: 'pending_all', doctorCompleted: 0 },
          { status: 'completed' },
          { doctorCompleted: 1 }
        ];
      }
      // inquiry and admin can see all - no filter
      
      // Add pagination
      const page = parseInt(req.query.page) || 1;
      const limit = Math.min(parseInt(req.query.limit) || 50, 100); // Max 100 per page
      const skip = (page - 1) * limit;

      const visits = await db.prisma.visit.findMany({
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
        take: limit,
        skip: skip,
      });
      
      // Get total count for pagination
      const total = await db.prisma.visit.count({ where });

      // Map to include patient_name, created_by_name, and convert camelCase to snake_case
      const visitsWithNames = visits.map(v => ({
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
      
      res.json({
        data: visitsWithNames,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } else {
      // Fallback to SQL
      const { allQuery } = require('../database/db');
      let query = `
        SELECT v.*, p.name as patient_name, p.national_id, p.age, p.gender,
               u.name as created_by_name
        FROM visits v
        LEFT JOIN patients p ON v.patient_id = p.id
        LEFT JOIN users u ON v.created_by = u.id
      `;
      
      const params = [];
      if (role === 'lab') {
        query += ' WHERE (v.status = ? AND v.lab_completed = 0) OR (v.lab_completed = 1)';
        params.push('pending_all');
      } else if (role === 'pharmacist') {
        query += ' WHERE (v.status = ? AND v.pharmacy_completed = 0) OR (v.pharmacy_completed = 1)';
        params.push('pending_all');
      } else if (role === 'doctor') {
        query += ' WHERE ((v.status = ? AND v.doctor_completed = 0) OR v.status = ? OR v.doctor_completed = 1)';
        params.push('pending_all', 'completed');
      }

      query += ' ORDER BY v.created_at DESC';
      const visits = await allQuery(query, params);
      res.json(visits);
    }
  } catch (error) {
    console.error('Error fetching visits:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب الزيارات' });
  }
});

// Get visit by ID with full details
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    let visit;
    
    if (db.prisma) {
      visit = await db.prisma.visit.findUnique({
        where: { id: parseInt(req.params.id) },
        include: {
          patient: true,
          creator: true,
          labResults: {
            include: { creator: true, testCatalog: true },
            orderBy: { createdAt: 'desc' }
          },
          prescriptions: {
            include: { creator: true, drugCatalog: true },
            orderBy: { createdAt: 'desc' }
          },
          diagnoses: {
            include: { creator: true },
            orderBy: { createdAt: 'desc' }
          },
          statusHistory: {
            include: { changer: true },
            orderBy: { createdAt: 'asc' }
          },
          attachments: {
            include: { uploader: true },
            orderBy: { createdAt: 'desc' }
          }
        }
      });
      
      if (!visit) {
        return res.status(404).json({ error: 'الزيارة غير موجودة' });
      }
      
      // Map to include names and convert camelCase to snake_case
      const visitData = {
        id: visit.id,
        patient_id: visit.patientId,
        visit_number: visit.visitNumber,
        status: visit.status,
        lab_completed: visit.labCompleted,
        pharmacy_completed: visit.pharmacyCompleted,
        doctor_completed: visit.doctorCompleted,
        created_by: visit.createdBy,
        created_at: visit.createdAt,
        updated_at: visit.updatedAt,
        patient_name: visit.patient?.name || null,
        national_id: visit.patient?.nationalId || null,
        phone: visit.patient?.phone || null,
        age: visit.patient?.age || null,
        gender: visit.patient?.gender || null,
        address: visit.patient?.address || null,
        created_by_name: visit.creator?.name || null,
        lab_results: visit.labResults.map(lr => {
          // Ensure created_at is properly formatted
          let createdAt = null;
          if (lr.createdAt) {
            try {
              createdAt = lr.createdAt instanceof Date 
                ? lr.createdAt.toISOString() 
                : new Date(lr.createdAt).toISOString();
            } catch (e) {
              console.warn('Error formatting lab result date:', e);
              createdAt = null;
            }
          }
          
          return {
            id: lr.id,
            visit_id: lr.visitId,
            test_catalog_id: lr.testCatalogId,
            test_name: lr.testName || lr.testCatalog?.testName || null,
            result: lr.result,
            unit: lr.unit,
            normal_range: lr.normalRange,
            notes: lr.notes,
            created_by: lr.createdBy,
            created_at: createdAt,
            updated_at: lr.updatedAt ? (lr.updatedAt instanceof Date ? lr.updatedAt.toISOString() : new Date(lr.updatedAt).toISOString()) : null,
            created_by_name: lr.creator?.name || null
          };
        }),
        prescriptions: visit.prescriptions.map(p => {
          // Ensure created_at is properly formatted
          let createdAt = null;
          if (p.createdAt) {
            try {
              createdAt = p.createdAt instanceof Date 
                ? p.createdAt.toISOString() 
                : new Date(p.createdAt).toISOString();
            } catch (e) {
              console.warn('Error formatting prescription date:', e);
              createdAt = null;
            }
          }
          
          return {
            id: p.id,
            visit_id: p.visitId,
            drug_catalog_id: p.drugCatalogId,
            medication_name: p.medicationName || p.drugCatalog?.drugName || null,
            dosage: p.dosage,
            quantity: p.quantity,
            instructions: p.instructions,
            created_by: p.createdBy,
            created_at: createdAt,
            updated_at: p.updatedAt ? (p.updatedAt instanceof Date ? p.updatedAt.toISOString() : new Date(p.updatedAt).toISOString()) : null,
            created_by_name: p.creator?.name || null
          };
        }),
        diagnoses: visit.diagnoses.map(d => ({
          id: d.id,
          visit_id: d.visitId,
          diagnosis: d.diagnosis,
          notes: d.notes,
          created_by: d.createdBy,
          created_at: d.createdAt ? new Date(d.createdAt).toISOString() : null,
          updated_at: d.updatedAt ? new Date(d.updatedAt).toISOString() : null,
          doctor_name: d.creator?.name || null
        })),
        status_history: visit.statusHistory.map(sh => ({
          id: sh.id,
          visit_id: sh.visitId,
          status: sh.status,
          notes: sh.notes,
          changed_by: sh.changedBy,
          created_at: sh.createdAt,
          changed_by_name: sh.changer?.name || null
        })),
        attachments: visit.attachments.map(a => ({
          id: a.id,
          visit_id: a.visitId,
          file_name: a.fileName,
          file_path: a.filePath,
          file_size: a.fileSize,
          mime_type: a.mimeType,
          uploaded_by: a.uploadedBy,
          created_at: a.createdAt,
          uploaded_by_name: a.uploader?.name || null
        }))
      };
      
      res.json(visitData);
    } else {
      // Fallback to SQL
      const { getQuery, allQuery } = require('../database/db');
      visit = await getQuery(
        `SELECT v.*, p.name as patient_name, p.national_id, p.phone, p.age, p.gender, p.address,
                u.name as created_by_name
         FROM visits v
         LEFT JOIN patients p ON v.patient_id = p.id
         LEFT JOIN users u ON v.created_by = u.id
         WHERE v.id = ?`,
        [req.params.id]
      );

      if (!visit) {
        return res.status(404).json({ error: 'الزيارة غير موجودة' });
      }

      const labResults = await allQuery(
        `SELECT lr.*, u.name as created_by_name
         FROM lab_results lr
         LEFT JOIN users u ON lr.created_by = u.id
         WHERE lr.visit_id = ?
         ORDER BY lr.created_at DESC`,
        [req.params.id]
      );

      const prescriptions = await allQuery(
        `SELECT pp.*, u.name as created_by_name
         FROM pharmacy_prescriptions pp
         LEFT JOIN users u ON pp.created_by = u.id
         WHERE pp.visit_id = ?
         ORDER BY pp.created_at DESC`,
        [req.params.id]
      );

      const diagnoses = await allQuery(
        `SELECT d.*, u.name as doctor_name
         FROM diagnoses d
         LEFT JOIN users u ON d.created_by = u.id
         WHERE d.visit_id = ?
         ORDER BY d.created_at DESC`,
        [req.params.id]
      );

      const statusHistory = await allQuery(
        `SELECT sh.*, u.name as changed_by_name
         FROM visit_status_history sh
         LEFT JOIN users u ON sh.changed_by = u.id
         WHERE sh.visit_id = ?
         ORDER BY sh.created_at ASC`,
        [req.params.id]
      );

      let attachments = [];
      try {
        attachments = await allQuery(
          `SELECT va.*, u.name as uploaded_by_name
           FROM visit_attachments va
           LEFT JOIN users u ON va.uploaded_by = u.id
           WHERE va.visit_id = ?
           ORDER BY va.created_at DESC`,
          [req.params.id]
        );
      } catch (error) {
        console.warn('Attachments table might not exist:', error.message);
      }

      res.json({
        ...visit,
        lab_results: labResults || [],
        prescriptions: prescriptions || [],
        diagnoses: diagnoses || [],
        status_history: statusHistory || [],
        attachments: attachments || []
      });
    }
  } catch (error) {
    console.error('Error fetching visit:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب بيانات الزيارة' });
  }
});

// Create new visit
router.post('/', authenticateToken, requireRole('inquiry'), async (req, res) => {
  try {
    const { patient_id } = req.body;

    if (!patient_id) {
      return res.status(400).json({ error: 'رقم المريض مطلوب' });
    }

    // Validate patient and check for incomplete visits
    let patient, existingIncompleteVisit;
    
    if (db.prisma) {
      [patient, existingIncompleteVisit] = await Promise.all([
        db.prisma.patient.findUnique({
          where: { id: parseInt(patient_id) },
          select: { id: true, name: true, nationalId: true, age: true, gender: true }
        }),
        db.prisma.visit.findFirst({
          where: {
            patientId: parseInt(patient_id),
            status: { not: 'completed' }
          },
          select: {
            id: true,
            visitNumber: true,
            status: true,
            createdAt: true,
            labCompleted: true,
            pharmacyCompleted: true,
            doctorCompleted: true
          },
          orderBy: { createdAt: 'desc' }
        })
      ]);
    } else {
      const { getQuery } = require('../database/db');
      patient = await getQuery('SELECT id, name, national_id, age, gender FROM patients WHERE id = ?', [patient_id]);
      const incompleteVisits = await getQuery(
        `SELECT id, visit_number, status, created_at, lab_completed, pharmacy_completed, doctor_completed 
         FROM visits 
         WHERE patient_id = ? AND status != 'completed' 
         ORDER BY created_at DESC 
         LIMIT 1`,
        [patient_id]
      );
      existingIncompleteVisit = incompleteVisits[0] || null;
    }
    
    if (!patient) {
      return res.status(404).json({ error: 'المريض غير موجود' });
    }

    // Check if patient has an incomplete visit
    if (existingIncompleteVisit) {
      const visitDate = existingIncompleteVisit.createdAt || existingIncompleteVisit.created_at;
      const formattedDate = visitDate instanceof Date 
        ? visitDate.toLocaleString('ar-IQ', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric', 
            hour: '2-digit', 
            minute: '2-digit' 
          })
        : new Date(visitDate).toLocaleString('ar-IQ', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric', 
            hour: '2-digit', 
            minute: '2-digit' 
          });
      
      const patientName = patient.name || 'المريض';
      return res.status(400).json({ 
        error: 'لا يمكن إضافة زيارة جديدة',
        message: `لا يمكن إضافة زيارة جديدة للمريض "${patientName}" لأنه لديه زيارة غير مكتملة حالياً منذ ${formattedDate}.`,
        details: {
          visit_id: existingIncompleteVisit.id,
          visit_number: existingIncompleteVisit.visitNumber || existingIncompleteVisit.visit_number,
          status: existingIncompleteVisit.status,
          created_at: formattedDate,
          lab_completed: existingIncompleteVisit.labCompleted || existingIncompleteVisit.lab_completed,
          pharmacy_completed: existingIncompleteVisit.pharmacyCompleted || existingIncompleteVisit.pharmacy_completed,
          doctor_completed: existingIncompleteVisit.doctorCompleted || existingIncompleteVisit.doctor_completed
        },
        instruction: 'يرجى متابعة الجلسة المفتوحة حالياً أو إنهاؤها يدوياً قبل إنشاء زيارة جديدة.'
      });
    }

    // Generate visit number
    const visitNumber = await generateVisitNumber();

    let result;
    if (db.prisma) {
      // Create visit
      const newVisit = await db.prisma.visit.create({
        data: {
          patientId: parseInt(patient_id),
          visitNumber,
          status: 'pending_all',
          labCompleted: 0,
          pharmacyCompleted: 0,
          doctorCompleted: 0,
          createdBy: req.user.id
        },
        select: {
          id: true,
          visitNumber: true,
          status: true,
          patientId: true,
          createdAt: true
        }
      });
      
      // Create status history in background (non-blocking)
      db.prisma.visitStatusHistory.create({
        data: {
          visitId: newVisit.id,
          status: 'pending_all',
          changedBy: req.user.id,
          notes: 'تم إنشاء زيارة جديدة - متاحة لجميع الأقسام'
        }
      }).catch(() => null); // Don't fail if this fails
      
      result = { lastID: newVisit.id };
    } else {
      // Fallback to SQL
      const { runQuery } = require('../database/db');
      result = await runQuery(
        `INSERT INTO visits (patient_id, visit_number, status, lab_completed, pharmacy_completed, doctor_completed, created_by) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [patient_id, visitNumber, 'pending_all', 0, 0, 0, req.user.id]
      );

      await runQuery(
        `INSERT INTO visit_status_history (visit_id, status, changed_by, notes) 
         VALUES (?, ?, ?, ?)`,
        [result.lastID, 'pending_all', req.user.id, 'تم إنشاء زيارة جديدة - متاحة لجميع الأقسام']
      );
    }

    // Create notifications for ALL departments simultaneously (lab, pharmacy, doctor) - in parallel
    // Run notifications in background (non-blocking) to improve response time
    Promise.all([
      createNotification(
        req.user.id,
        null,
        'lab',
        result.lastID,
        'new_visit',
        'زيارة جديدة - متاحة للتحاليل',
        `تم إنشاء زيارة جديدة برقم ${visitNumber}. يمكنك البدء بإجراء التحاليل الآن`
      ),
      createNotification(
        req.user.id,
        null,
        'pharmacist',
        result.lastID,
        'new_visit',
        'زيارة جديدة - متاحة للصيدلية',
        `تم إنشاء زيارة جديدة برقم ${visitNumber}. يمكنك البدء بصرف العلاج الآن`
      ),
      createNotification(
        req.user.id,
        null,
        'doctor',
        result.lastID,
        'new_visit',
        'زيارة جديدة - متاحة للطبيب',
        `تم إنشاء زيارة جديدة برقم ${visitNumber}. يمكنك البدء بالتشخيص الآن`
      )
    ]).catch(error => {
      console.error('Error creating notifications (non-critical):', error);
    });

      // Broadcast real-time update if realtime service is available (non-blocking)
      if (req.app.locals?.realtimeService) {
        setImmediate(() => {
          try {
            req.app.locals.realtimeService.broadcastVisitUpdate(result.lastID, {
              type: 'visit_created',
              visit_number: visitNumber,
              status: 'pending_all'
            });
            
            // Notify all roles in real-time simultaneously
            ['lab', 'pharmacist', 'doctor'].forEach(role => {
              req.app.locals.realtimeService.sendNotificationToRole(role, {
                visit_id: result.lastID,
                title: 'زيارة جديدة - متاحة للعمل',
                message: `تم إنشاء زيارة جديدة برقم ${visitNumber}. يمكنك البدء بالعمل الآن`,
                type: 'new_visit'
              });
            });
          } catch (error) {
            console.error('Error broadcasting real-time update (non-critical):', error);
          }
        });
      }

    // Return visit data immediately without additional query (we already have patient data)
    const visit = {
      id: result.lastID,
      visit_number: visitNumber,
      patient_id: parseInt(patient_id),
      status: 'pending_all',
      lab_completed: 0,
      pharmacy_completed: 0,
      doctor_completed: 0,
      created_by: req.user.id,
      patient_name: patient.name || null,
      national_id: patient.nationalId || patient.national_id || null,
      age: patient.age || null,
      gender: patient.gender || null,
      created_at: new Date().toISOString()
    };

    res.status(201).json(visit);
  } catch (error) {
    console.error('Error creating visit:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء إنشاء الزيارة' });
  }
});

// Update visit status (for lab, pharmacy, doctor)
router.patch('/:id/status', authenticateToken, async (req, res) => {
  try {
    const visitId = parseInt(req.params.id);
    const { status, notes } = req.body;
    const { role } = req.user;

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

    // Validate status transition based on role
    const validTransitions = {
      lab: { from: 'pending_lab', to: 'pending_pharmacy' },
      pharmacist: { from: 'pending_pharmacy', to: 'pending_doctor' },
      doctor: { from: 'pending_doctor', to: 'completed' }
    };

    const transition = validTransitions[role];
    if (!transition || visit.status !== transition.from) {
      return res.status(400).json({ error: 'لا يمكن تغيير حالة الزيارة' });
    }

    if (db.prisma) {
      await db.prisma.visit.update({
        where: { id: visitId },
        data: { status: transition.to }
      });
      
      await db.prisma.visitStatusHistory.create({
        data: {
          visitId,
          status: transition.to,
          changedBy: req.user.id,
          notes: notes || `تم تحديث الحالة من قبل ${role}`
        }
      });
      
      visit = await db.prisma.visit.findUnique({
        where: { id: visitId }
      });
    } else {
      const { runQuery, getQuery } = require('../database/db');
      await runQuery(
        'UPDATE visits SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [transition.to, req.params.id]
      );

      await runQuery(
        `INSERT INTO visit_status_history (visit_id, status, changed_by, notes) 
         VALUES (?, ?, ?, ?)`,
        [req.params.id, transition.to, req.user.id, notes || `تم تحديث الحالة من قبل ${role}`]
      );

      visit = await getQuery('SELECT * FROM visits WHERE id = ?', [req.params.id]);
    }

    res.json(visit);
  } catch (error) {
    console.error('Error updating visit status:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء تحديث حالة الزيارة' });
  }
});

// Get patient visits history
router.get('/patient/:patientId', authenticateToken, async (req, res) => {
  try {
    let visits;
    
    if (db.prisma) {
      visits = await db.prisma.visit.findMany({
        where: { patientId: parseInt(req.params.patientId) },
        include: { patient: true },
        orderBy: { createdAt: 'desc' }
      });
      
      visits = visits.map(v => ({
        ...v,
        patient_name: v.patient?.name || null
      }));
    } else {
      const { allQuery } = require('../database/db');
      visits = await allQuery(
        `SELECT v.*, p.name as patient_name
         FROM visits v
         LEFT JOIN patients p ON v.patient_id = p.id
         WHERE v.patient_id = ?
         ORDER BY v.created_at DESC`,
        [req.params.patientId]
      );
    }
    
    res.json(visits);
  } catch (error) {
    console.error('Error fetching patient visits:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب تاريخ الزيارات' });
  }
});

// Inquiry can close visit directly
router.post('/:id/close', authenticateToken, requireRole('inquiry', 'admin'), async (req, res) => {
  try {
    const visitId = parseInt(req.params.id);
    const { notes } = req.body;
    
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

    if (visit.status === 'completed') {
      return res.status(400).json({ error: 'الزيارة مغلقة بالفعل' });
    }

    const oldStatus = visit.status;
    const visitNumber = visit.visitNumber || visit.visit_number;

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
          notes: notes || 'تم إغلاق الزيارة من قبل موظف الاستعلامات'
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
        [req.params.id, 'completed', req.user.id, notes || 'تم إغلاق الزيارة من قبل موظف الاستعلامات']
      );
    }

    // Create notification for related departments
    if (oldStatus === 'pending_lab') {
      await createNotification(
        req.user.id,
        null,
        'lab',
        visitId,
        'visit_closed',
        'تم إغلاق زيارة',
        `تم إغلاق الزيارة ${visitNumber} من قبل موظف الاستعلامات`
      );
    } else if (oldStatus === 'pending_pharmacy') {
      await createNotification(
        req.user.id,
        null,
        'pharmacist',
        visitId,
        'visit_closed',
        'تم إغلاق زيارة',
        `تم إغلاق الزيارة ${visitNumber} من قبل موظف الاستعلامات`
      );
    } else if (oldStatus === 'pending_doctor') {
      await createNotification(
        req.user.id,
        null,
        'doctor',
        visitId,
        'visit_closed',
        'تم إغلاق زيارة',
        `تم إغلاق الزيارة ${visitNumber} من قبل موظف الاستعلامات`
      );
    }

    res.json({ message: 'تم إغلاق الزيارة بنجاح' });
  } catch (error) {
    console.error('Error closing visit:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء إغلاق الزيارة' });
  }
});

// Send notification to department
router.post('/:id/send-notification', authenticateToken, requireRole('inquiry', 'admin'), async (req, res) => {
  try {
    const visitId = parseInt(req.params.id);
    const { to_role, message } = req.body;
    
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

    const visitNumber = visit.visitNumber || visit.visit_number;
    await createNotification(
      req.user.id,
      null,
      to_role,
      visitId,
      'reminder',
      'تذكير بإنهاء العمل',
      message || `يرجى إنهاء العمل على الزيارة ${visitNumber}`
    );

    res.json({ message: 'تم إرسال الإشعار بنجاح' });
  } catch (error) {
    console.error('Error sending notification:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء إرسال الإشعار' });
  }
});

module.exports = router;
