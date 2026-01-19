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

// Select lab tests and drugs for doctor-directed visit
router.post('/select-items/:visitId', authenticateToken, requireRole('doctor'), async (req, res) => {
  try {
    const visitId = parseInt(req.params.visitId);
    const { lab_tests, drugs, lab_test_ids, drug_ids, diagnosis_only } = req.body;
    
    // Support both old format (arrays) and new format (objects with notes)
    let labTests = [];
    let drugList = [];
    
    if (lab_tests && Array.isArray(lab_tests)) {
      labTests = lab_tests;
    } else if (lab_test_ids && Array.isArray(lab_test_ids)) {
      labTests = lab_test_ids.map(id => ({ id: parseInt(id), notes: '' }));
    }
    
    if (drugs && Array.isArray(drugs)) {
      drugList = drugs;
    } else if (drug_ids && Array.isArray(drug_ids)) {
      drugList = drug_ids.map(id => ({ id: parseInt(id), notes: '' }));
    }

    // Verify visit exists and is doctor-directed
    let visit;
    if (db.prisma) {
      visit = await db.prisma.visit.findUnique({
        where: { id: visitId },
        select: { 
          id: true, 
          visitType: true,
          status: true,
          visitNumber: true
        }
      });
    } else {
      const { getQuery } = require('../database/db');
      visit = await getQuery('SELECT id, visit_type, status, visit_number FROM visits WHERE id = ?', [visitId]);
    }

    if (!visit) {
      return res.status(404).json({ error: 'الزيارة غير موجودة' });
    }

    const visitType = visit.visitType || visit.visit_type;
    if (visitType !== 'doctor_directed') {
      return res.status(400).json({ error: 'هذه الزيارة ليست من نوع "زيارة من خلال الطبيب"' });
    }

    // Create lab results from catalog if lab_test_ids provided
    if (lab_test_ids && Array.isArray(lab_test_ids) && lab_test_ids.length > 0) {
      if (db.prisma) {
        // Get lab tests from catalog
        const labTests = await db.prisma.labTestCatalog.findMany({
          where: { 
            id: { in: lab_test_ids.map((id) => parseInt(id)) },
            isActive: 1
          }
        });

        // Create lab results
        await Promise.all(
          labTests.map(test =>
            db.prisma.labResult.create({
              data: {
                visitId: visitId,
                testCatalogId: test.id,
                testName: test.testName,
                unit: test.unit || null,
                normalRange: test.normalRangeText || null,
                createdBy: req.user.id
              }
            })
          )
        );
      } else {
        const { allQuery, runQuery } = require('../database/db');
        const placeholders = lab_test_ids.map(() => '?').join(',');
        const labTests = await allQuery(
          `SELECT * FROM lab_tests_catalog WHERE id IN (${placeholders}) AND is_active = 1`,
          lab_test_ids.map((id) => parseInt(id))
        );

        for (const testItem of labTests) {
          const testId = typeof testItem === 'object' ? testItem.id : parseInt(testItem);
          const notes = typeof testItem === 'object' ? (testItem.notes || '') : '';
          const test = labTests.find(t => t.id === testId);
          if (!test) continue;
          
          await runQuery(
            `INSERT INTO lab_results (visit_id, test_catalog_id, test_name, unit, normal_range, notes, created_by) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [visitId, test.id, test.test_name, test.unit || null, test.normal_range_text || null, notes || null, req.user.id]
          );
        }
      }
    }

    // Create prescriptions from catalog if drug_ids provided
    if (drug_ids && Array.isArray(drug_ids) && drug_ids.length > 0) {
      if (db.prisma) {
        // Get drugs from catalog
        const drugs = await db.prisma.drugCatalog.findMany({
          where: { 
            id: { in: drug_ids.map((id) => parseInt(id)) },
            isActive: 1
          }
        });

        // Create prescriptions
        await Promise.all(
          drugs.map(drug =>
            db.prisma.pharmacyPrescription.create({
              data: {
                visitId: visitId,
                drugCatalogId: drug.id,
                medicationName: drug.drugName,
                createdBy: req.user.id
              }
            })
          )
        );
      } else {
        const { allQuery, runQuery } = require('../database/db');
        const placeholders = drug_ids.map(() => '?').join(',');
        const drugs = await allQuery(
          `SELECT * FROM drugs_catalog WHERE id IN (${placeholders}) AND is_active = 1`,
          drug_ids.map((id) => parseInt(id))
        );

        for (const drug of drugs) {
          await runQuery(
            `INSERT INTO pharmacy_prescriptions (visit_id, drug_catalog_id, medication_name, created_by) 
             VALUES (?, ?, ?, ?)`,
            [visitId, drug.id, drug.drug_name, req.user.id]
          );
        }
      }
    }

    // Update visit status based on selections
    let newStatus = 'pending_doctor';
    if (lab_test_ids && lab_test_ids.length > 0 && drug_ids && drug_ids.length > 0) {
      newStatus = 'pending_all';
    } else if (lab_test_ids && lab_test_ids.length > 0) {
      newStatus = 'pending_lab';
    } else if (drug_ids && drug_ids.length > 0) {
      newStatus = 'pending_pharmacy';
    }

    if (db.prisma) {
      await db.prisma.visit.update({
        where: { id: visitId },
        data: { status: newStatus }
      });

      // Create status history
      await db.prisma.visitStatusHistory.create({
        data: {
          visitId: visitId,
          status: newStatus,
          changedBy: req.user.id,
          notes: `الطبيب اختار ${lab_test_ids?.length || 0} تحليل و ${drug_ids?.length || 0} دواء`
        }
      });
    } else {
      const { runQuery } = require('../database/db');
      await runQuery('UPDATE visits SET status = ? WHERE id = ?', [newStatus, visitId]);
      await runQuery(
        `INSERT INTO visit_status_history (visit_id, status, changed_by, notes) 
         VALUES (?, ?, ?, ?)`,
        [visitId, newStatus, req.user.id, `الطبيب اختار ${lab_test_ids?.length || 0} تحليل و ${drug_ids?.length || 0} دواء`]
      );
    }

    // Create notifications
    const { createNotification } = require('./notifications');
    const visitNumber = visit.visitNumber || visit.visit_number;
    
    if (lab_test_ids && lab_test_ids.length > 0) {
      createNotification(
        req.user.id,
        null,
        'lab',
        visitId,
        'new_visit',
        'زيارة من خلال الطبيب - تحاليل مطلوبة',
        `تم اختيار ${lab_test_ids.length} تحليل للزيارة ${visitNumber}. يرجى إدخال النتائج`
      ).catch(() => null);
    }

    if (drug_ids && drug_ids.length > 0) {
      createNotification(
        req.user.id,
        null,
        'pharmacist',
        visitId,
        'new_visit',
        'زيارة من خلال الطبيب - أدوية مطلوبة',
        `تم اختيار ${drug_ids.length} دواء للزيارة ${visitNumber}. يرجى صرف العلاج`
      ).catch(() => null);
    }

    res.json({ 
      message: 'تم اختيار التحاليل والأدوية بنجاح',
      lab_tests_count: lab_test_ids?.length || 0,
      drugs_count: drug_ids?.length || 0,
      new_status: newStatus
    });
  } catch (error) {
    console.error('Error selecting items:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء اختيار التحاليل والأدوية' });
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
