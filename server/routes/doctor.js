const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/auth');
const db = require('../database/db');

// Get all patient visits for doctor (completed and pending)
router.get('/patients/:patientId/visits', authenticateToken, requireRole('doctor'), async (req, res) => {
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
        patient_name: v.patient?.name || null,
        national_id: v.patient?.nationalId || null,
        age: v.patient?.age || null,
        gender: v.patient?.gender || null
      }));
    } else {
      const { allQuery } = require('../database/db');
      visits = await allQuery(
        `SELECT v.*, p.name as patient_name, p.national_id, p.age, p.gender
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

// Add diagnosis
router.post('/diagnosis', authenticateToken, requireRole('doctor'), async (req, res) => {
  try {
    const { visit_id, diagnosis, notes } = req.body;

    if (!visit_id || !diagnosis) {
      return res.status(400).json({ error: 'رقم الزيارة والتشخيص مطلوبان' });
    }

    // Verify visit exists
    let visit;
    if (db.prisma) {
      visit = await db.prisma.visit.findUnique({
        where: { id: parseInt(visit_id) }
      });
    } else {
      const { getQuery } = require('../database/db');
      visit = await getQuery('SELECT * FROM visits WHERE id = ?', [visit_id]);
    }
    
    if (!visit) {
      return res.status(404).json({ error: 'الزيارة غير موجودة' });
    }

    let newDiagnosis;
    if (db.prisma) {
      newDiagnosis = await db.prisma.diagnosis.create({
        data: {
          visitId: parseInt(visit_id),
          diagnosis,
          notes: notes || null,
          createdBy: req.user.id
        },
        include: { creator: true }
      });

      // Don't auto-complete - user must click "Save and Complete Session" button
    } else {
      const { runQuery, getQuery } = require('../database/db');
      const result = await runQuery(
        `INSERT INTO diagnoses (visit_id, diagnosis, notes, created_by) 
         VALUES (?, ?, ?, ?)`,
        [visit_id, diagnosis, notes, req.user.id]
      );
      newDiagnosis = await getQuery('SELECT * FROM diagnoses WHERE id = ?', [result.lastID]);

      // Don't auto-complete - user must click "Save and Complete Session" button
    }
    
    res.status(201).json(newDiagnosis);
  } catch (error) {
    console.error('Error adding diagnosis:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء إضافة التشخيص' });
  }
});

// Update diagnosis
router.put('/diagnosis/:id', authenticateToken, requireRole('doctor'), async (req, res) => {
  try {
    const { diagnosis, notes } = req.body;

    let existingDiagnosis;
    if (db.prisma) {
      existingDiagnosis = await db.prisma.diagnosis.findUnique({
        where: { id: parseInt(req.params.id) }
      });
    } else {
      const { getQuery } = require('../database/db');
      existingDiagnosis = await getQuery('SELECT * FROM diagnoses WHERE id = ?', [req.params.id]);
    }
    
    if (!existingDiagnosis) {
      return res.status(404).json({ error: 'التشخيص غير موجود' });
    }

    let updatedDiagnosis;
    if (db.prisma) {
      updatedDiagnosis = await db.prisma.diagnosis.update({
        where: { id: parseInt(req.params.id) },
        data: {
          diagnosis,
          notes: notes || null
        }
      });
    } else {
      const { runQuery, getQuery } = require('../database/db');
      await runQuery(
        `UPDATE diagnoses 
         SET diagnosis = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [diagnosis, notes, req.params.id]
      );
      updatedDiagnosis = await getQuery('SELECT * FROM diagnoses WHERE id = ?', [req.params.id]);
    }
    
    res.json(updatedDiagnosis);
  } catch (error) {
    console.error('Error updating diagnosis:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء تحديث التشخيص' });
  }
});

// Delete diagnosis
router.delete('/diagnosis/:id', authenticateToken, requireRole('doctor'), async (req, res) => {
  try {
    let diagnosis;
    if (db.prisma) {
      diagnosis = await db.prisma.diagnosis.findUnique({
        where: { id: parseInt(req.params.id) }
      });
    } else {
      const { getQuery } = require('../database/db');
      diagnosis = await getQuery('SELECT * FROM diagnoses WHERE id = ?', [req.params.id]);
    }
    
    if (!diagnosis) {
      return res.status(404).json({ error: 'التشخيص غير موجود' });
    }

    if (db.prisma) {
      await db.prisma.diagnosis.delete({
        where: { id: parseInt(req.params.id) }
      });
    } else {
      const { runQuery } = require('../database/db');
      await runQuery('DELETE FROM diagnoses WHERE id = ?', [req.params.id]);
    }
    
    res.json({ message: 'تم حذف التشخيص بنجاح' });
  } catch (error) {
    console.error('Error deleting diagnosis:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء حذف التشخيص' });
  }
});

// Mark doctor work as completed (can be toggled) - OPTIMIZED
router.post('/complete/:visitId', authenticateToken, requireRole('doctor'), async (req, res) => {
  try {
    const visitId = parseInt(req.params.visitId);
    
    // Get visit and check diagnoses in parallel
    const [visit, diagnoses] = await Promise.all([
      db.prisma 
        ? db.prisma.visit.findUnique({
            where: { id: visitId },
            select: { 
              id: true, 
              labCompleted: true, 
              pharmacyCompleted: true, 
              doctorCompleted: true,
              status: true,
              visitNumber: true
            }
          })
        : (async () => {
            const { getQuery } = require('../database/db');
            return await getQuery('SELECT id, lab_completed, pharmacy_completed, doctor_completed, status, visit_number FROM visits WHERE id = ?', [visitId]);
          })(),
      db.prisma
        ? db.prisma.diagnosis.findMany({
            where: { visitId },
            select: { id: true }
          })
        : (async () => {
            const { allQuery } = require('../database/db');
            return await allQuery('SELECT id FROM diagnoses WHERE visit_id = ?', [visitId]);
          })()
    ]);
    
    if (!visit) {
      return res.status(404).json({ error: 'الزيارة غير موجودة' });
    }
    
    if (diagnoses.length === 0 && (visit.doctorCompleted === 0 || visit.doctor_completed === 0)) {
      return res.status(400).json({ error: 'يجب إضافة تشخيص قبل الإكمال' });
    }

    // Toggle doctor_completed status
    const currentDoctorCompleted = visit.doctorCompleted ?? visit.doctor_completed ?? 0;
    const newDoctorCompleted = currentDoctorCompleted === 0 ? 1 : 0;
    const currentLabCompleted = visit.labCompleted ?? visit.lab_completed ?? 0;
    const currentPharmacyCompleted = visit.pharmacyCompleted ?? visit.pharmacy_completed ?? 0;
    const currentStatus = visit.status;
    const visitNumber = visit.visitNumber ?? visit.visit_number;

    // Determine new status
    let newStatus = currentStatus;
    const allCompleted = currentLabCompleted === 1 && currentPharmacyCompleted === 1 && newDoctorCompleted === 1;
    const anyIncomplete = currentLabCompleted === 0 || currentPharmacyCompleted === 0 || newDoctorCompleted === 0;
    
    if (allCompleted) {
      newStatus = 'completed';
    } else if (currentStatus === 'completed' && anyIncomplete) {
      newStatus = 'pending_all';
    }

    // Update visit with all changes at once
    let updatedVisit;
    if (db.prisma) {
      updatedVisit = await db.prisma.visit.update({
        where: { id: visitId },
        data: { 
          doctorCompleted: newDoctorCompleted,
          ...(newStatus !== currentStatus ? { status: newStatus } : {})
        },
        select: {
          id: true,
          visitNumber: true,
          status: true,
          labCompleted: true,
          pharmacyCompleted: true,
          doctorCompleted: true,
          createdAt: true,
          updatedAt: true
        }
      });
    } else {
      const { runQuery, getQuery } = require('../database/db');
      await runQuery(
        'UPDATE visits SET doctor_completed = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [newDoctorCompleted, newStatus, visitId]
      );
      updatedVisit = await getQuery('SELECT * FROM visits WHERE id = ?', [visitId]);
    }

    // Create notification and status history in background (non-blocking)
    if (allCompleted) {
      const { createNotification } = require('./notifications');
      createNotification(
        req.user.id,
        null,
        'inquiry',
        visitId,
        'visit_completed',
        'اكتملت الزيارة',
        `تم إكمال الزيارة ${visitNumber || visitId} بنجاح - جميع الأقسام مكتملة`
      ).catch(() => null);
    }

    // Add status history in background (non-blocking)
    if (db.prisma) {
      db.prisma.visitStatusHistory.create({
        data: {
          visitId,
          status: newDoctorCompleted === 1 ? 'doctor_completed' : 'doctor_incomplete',
          changedBy: req.user.id,
          notes: newDoctorCompleted === 1 ? 'تم إكمال التشخيص' : 'تم إلغاء إكمال التشخيص'
        }
      }).catch(() => null);
    } else {
      const { runQuery } = require('../database/db');
      runQuery(
        `INSERT INTO visit_status_history (visit_id, status, changed_by, notes) 
         VALUES (?, ?, ?, ?)`,
        [visitId, newDoctorCompleted === 1 ? 'doctor_completed' : 'doctor_incomplete', req.user.id, newDoctorCompleted === 1 ? 'تم إكمال التشخيص' : 'تم إلغاء إكمال التشخيص']
      ).catch(() => null);
    }
    
    res.json({ 
      message: newDoctorCompleted === 1 ? 'تم إكمال التشخيص بنجاح' : 'تم إلغاء إكمال التشخيص',
      visit: updatedVisit 
    });
  } catch (error) {
    console.error('Error completing visit:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء إكمال الزيارة' });
  }
});

// Search patients by name or national ID
router.get('/search', authenticateToken, requireRole('doctor'), async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res.status(400).json({ error: 'يرجى إدخال كلمة البحث' });
    }

    let patients;
    if (db.prisma) {
      patients = await db.prisma.patient.findMany({
        where: {
          OR: [
            { name: { contains: q } },
            { nationalId: { contains: q } }
          ]
        },
        orderBy: { name: 'asc' }
      });
    } else {
      const { allQuery } = require('../database/db');
      patients = await allQuery(
        `SELECT * FROM patients 
         WHERE name LIKE ? OR national_id LIKE ?
         ORDER BY name`,
        [`%${q}%`, `%${q}%`]
      );
    }
    
    res.json(patients);
  } catch (error) {
    console.error('Error searching patients:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء البحث' });
  }
});

module.exports = router;
