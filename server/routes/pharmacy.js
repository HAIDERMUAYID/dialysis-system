const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/auth');
const db = require('../database/db');

// Get prescriptions for a visit
router.get('/visit/:visitId', authenticateToken, async (req, res) => {
  try {
    let prescriptions;
    
    if (db.prisma) {
      prescriptions = await db.prisma.pharmacyPrescription.findMany({
        where: { visitId: parseInt(req.params.visitId) },
        include: { drugCatalog: true, creator: true },
        orderBy: { createdAt: 'desc' }
      });
      
      prescriptions = prescriptions.map(p => ({
        ...p,
        created_by_name: p.creator?.name || null
      }));
    } else {
      const { allQuery } = require('../database/db');
      prescriptions = await allQuery(
        'SELECT * FROM pharmacy_prescriptions WHERE visit_id = ? ORDER BY created_at DESC',
        [req.params.visitId]
      );
    }
    
    res.json(prescriptions);
  } catch (error) {
    console.error('Error fetching prescriptions:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب الأدوية' });
  }
});

// Add prescription (supports catalog or manual entry)
router.post('/', authenticateToken, requireRole('pharmacist', 'pharmacy_manager'), async (req, res) => {
  try {
    const { visit_id, drug_catalog_id, medication_name, dosage, quantity, instructions } = req.body;

    if (!visit_id || (!drug_catalog_id && !medication_name)) {
      return res.status(400).json({ error: 'رقم الزيارة واسم الدواء أو معرف الكتالوج مطلوبان' });
    }

    if (!quantity || quantity <= 0) {
      return res.status(400).json({ error: 'الكمية مطلوبة ويجب أن تكون أكبر من صفر' });
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

    let finalMedicationName = medication_name;

    // If drug_catalog_id provided, fetch details from catalog
    if (drug_catalog_id) {
      let drugCatalog;
      if (db.prisma) {
        drugCatalog = await db.prisma.drugCatalog.findFirst({
          where: { id: parseInt(drug_catalog_id), isActive: 1 }
        });
      } else {
        const { getQuery } = require('../database/db');
        drugCatalog = await getQuery('SELECT * FROM drugs_catalog WHERE id = ? AND is_active = 1', [drug_catalog_id]);
      }
      
      if (!drugCatalog) {
        return res.status(404).json({ error: 'الدواء غير موجود في الكتالوج أو معطل' });
      }
      finalMedicationName = drugCatalog.drugNameAr || drugCatalog.drugName;
      if (drugCatalog.strength) {
        finalMedicationName += ` ${drugCatalog.strength}`;
      }
      if (drugCatalog.form) {
        finalMedicationName += ` (${drugCatalog.form})`;
      }
    }

    let newPrescription;
    if (db.prisma) {
      newPrescription = await db.prisma.pharmacyPrescription.create({
        data: {
          visitId: parseInt(visit_id),
          drugCatalogId: drug_catalog_id ? parseInt(drug_catalog_id) : null,
          medicationName: finalMedicationName,
          dosage: dosage || null,
          quantity: parseInt(quantity),
          instructions: instructions || null,
          createdBy: req.user.id
        },
        include: { drugCatalog: true, creator: true }
      });

      // Don't auto-complete - user must click "Save and Complete Session" button
    } else {
      const { runQuery, getQuery } = require('../database/db');
      const prescription = await runQuery(
        `INSERT INTO pharmacy_prescriptions (visit_id, drug_catalog_id, medication_name, dosage, quantity, instructions, created_by) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [visit_id, drug_catalog_id || null, finalMedicationName, dosage || null, quantity, instructions || null, req.user.id]
      );
      newPrescription = await getQuery('SELECT * FROM pharmacy_prescriptions WHERE id = ?', [prescription.lastID]);

      // Don't auto-complete - user must click "Save and Complete Session" button
    }
    
    res.status(201).json(newPrescription);
  } catch (error) {
    console.error('Error adding prescription:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء إضافة الدواء' });
  }
});

// Add prescriptions from set (multiple drugs at once)
router.post('/from-set', authenticateToken, requireRole('pharmacist', 'pharmacy_manager'), async (req, res) => {
  try {
    const { visit_id, set_id, prescriptions } = req.body; // prescriptions: [{drug_catalog_id, dosage, quantity, instructions}]

    if (!visit_id || !set_id) {
      return res.status(400).json({ error: 'رقم الزيارة ورقم المجموعة مطلوبان' });
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

    // Get set with drugs
    let set;
    if (db.prisma) {
      set = await db.prisma.prescriptionSet.findFirst({
        where: { id: parseInt(set_id), isActive: 1 }
      });
    } else {
      const { getQuery } = require('../database/db');
      set = await getQuery('SELECT * FROM prescription_sets WHERE id = ? AND is_active = 1', [set_id]);
    }
    
    if (!set) {
      return res.status(404).json({ error: 'المجموعة غير موجودة أو معطلة' });
    }

    let setDrugs;
    if (db.prisma) {
      setDrugs = await db.prisma.prescriptionSetItem.findMany({
        where: {
          setId: parseInt(set_id),
          drugCatalog: { isActive: 1 }
        },
        include: {
          drugCatalog: true
        },
        orderBy: { displayOrder: 'asc' }
      });
      
      // Transform to match expected format
      setDrugs = setDrugs.map(sd => ({
        ...sd,
        drug_catalog_id: sd.drugCatalogId,
        drug_name: sd.drugCatalog?.drugName,
        drug_name_ar: sd.drugCatalog?.drugNameAr,
        form: sd.drugCatalog?.form,
        strength: sd.drugCatalog?.strength
      }));
    } else {
      const { allQuery } = require('../database/db');
      setDrugs = await allQuery(
        `SELECT psi.*, d.drug_name, d.drug_name_ar, d.form, d.strength
         FROM prescription_set_items psi
         JOIN drugs_catalog d ON psi.drug_catalog_id = d.id
         WHERE psi.set_id = ? AND d.is_active = 1
         ORDER BY psi.display_order ASC`,
        [set_id]
      );
    }

    if (setDrugs.length === 0) {
      return res.status(400).json({ error: 'المجموعة لا تحتوي على أدوية' });
    }

    const addedPrescriptions = [];

    for (const setDrug of setDrugs) {
      // Find prescription data for this drug in prescriptions array
      const prescriptionData = prescriptions?.find(p => p.drug_catalog_id === setDrug.drug_catalog_id);

      if (!prescriptionData || !prescriptionData.quantity || prescriptionData.quantity <= 0) {
        continue; // Skip drugs without quantity
      }

      let medicationName = setDrug.drug_name_ar || setDrug.drug_name;
      if (setDrug.strength) {
        medicationName += ` ${setDrug.strength}`;
      }
      if (setDrug.form) {
        medicationName += ` (${setDrug.form})`;
      }

      let newPrescription;
      if (db.prisma) {
        newPrescription = await db.prisma.pharmacyPrescription.create({
          data: {
            visitId: parseInt(visit_id),
            drugCatalogId: setDrug.drug_catalog_id || setDrug.drugCatalogId ? parseInt(setDrug.drug_catalog_id || setDrug.drugCatalogId) : null,
            medicationName,
            dosage: prescriptionData.dosage || setDrug.defaultDosage || null,
            quantity: parseInt(prescriptionData.quantity),
            instructions: prescriptionData.instructions || null,
            createdBy: req.user.id
          }
        });
      } else {
        const { runQuery, getQuery } = require('../database/db');
        const result = await runQuery(
          `INSERT INTO pharmacy_prescriptions (visit_id, drug_catalog_id, medication_name, dosage, quantity, instructions, created_by) 
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            visit_id,
            setDrug.drug_catalog_id,
            medicationName,
            prescriptionData.dosage || setDrug.default_dosage || null,
            prescriptionData.quantity,
            prescriptionData.instructions || null,
            req.user.id
          ]
        );
        newPrescription = await getQuery('SELECT * FROM pharmacy_prescriptions WHERE id = ?', [result.lastID]);
      }
      
      addedPrescriptions.push(newPrescription);
    }

    // Don't auto-complete - user must click "Save and Complete Session" button

    res.status(201).json({ message: `تم إضافة ${addedPrescriptions.length} دواء`, prescriptions: addedPrescriptions });
  } catch (error) {
    console.error('Error adding prescriptions from set:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء إضافة الأدوية' });
  }
});

// Update prescription
router.put('/:id', authenticateToken, requireRole('pharmacist', 'pharmacy_manager'), async (req, res) => {
  try {
    const { medication_name, dosage, quantity, instructions } = req.body;

    let prescription;
    if (db.prisma) {
      prescription = await db.prisma.pharmacyPrescription.findUnique({
        where: { id: parseInt(req.params.id) }
      });
    } else {
      const { getQuery } = require('../database/db');
      prescription = await getQuery('SELECT * FROM pharmacy_prescriptions WHERE id = ?', [req.params.id]);
    }
    
    if (!prescription) {
      return res.status(404).json({ error: 'الدواء غير موجود' });
    }

    let updatedPrescription;
    if (db.prisma) {
      updatedPrescription = await db.prisma.pharmacyPrescription.update({
        where: { id: parseInt(req.params.id) },
        data: {
          medicationName: medication_name,
          dosage: dosage || null,
          quantity: parseInt(quantity),
          instructions: instructions || null
        }
      });
    } else {
      const { runQuery, getQuery } = require('../database/db');
      await runQuery(
        `UPDATE pharmacy_prescriptions 
         SET medication_name = ?, dosage = ?, quantity = ?, instructions = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [medication_name, dosage, quantity, instructions, req.params.id]
      );
      updatedPrescription = await getQuery('SELECT * FROM pharmacy_prescriptions WHERE id = ?', [req.params.id]);
    }
    
    res.json(updatedPrescription);
  } catch (error) {
    console.error('Error updating prescription:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء تحديث الدواء' });
  }
});

// Delete prescription
router.delete('/:id', authenticateToken, requireRole('pharmacist', 'pharmacy_manager'), async (req, res) => {
  try {
    let prescription;
    if (db.prisma) {
      prescription = await db.prisma.pharmacyPrescription.findUnique({
        where: { id: parseInt(req.params.id) }
      });
    } else {
      const { getQuery } = require('../database/db');
      prescription = await getQuery('SELECT * FROM pharmacy_prescriptions WHERE id = ?', [req.params.id]);
    }
    
    if (!prescription) {
      return res.status(404).json({ error: 'الدواء غير موجود' });
    }

    if (db.prisma) {
      await db.prisma.pharmacyPrescription.delete({
        where: { id: parseInt(req.params.id) }
      });
    } else {
      const { runQuery } = require('../database/db');
      await runQuery('DELETE FROM pharmacy_prescriptions WHERE id = ?', [req.params.id]);
    }
    
    res.json({ message: 'تم حذف الدواء بنجاح' });
  } catch (error) {
    console.error('Error deleting prescription:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء حذف الدواء' });
  }
});

// Mark pharmacy work as completed (can be toggled) - OPTIMIZED
router.post('/complete/:visitId', authenticateToken, requireRole('pharmacist', 'pharmacy_manager'), async (req, res) => {
  try {
    const visitId = parseInt(req.params.visitId);
    
    // Get visit and check prescriptions in parallel
    const [visit, prescriptions] = await Promise.all([
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
        ? db.prisma.pharmacyPrescription.findMany({
            where: { visitId },
            select: { id: true }
          })
        : (async () => {
            const { allQuery } = require('../database/db');
            return await allQuery('SELECT id FROM pharmacy_prescriptions WHERE visit_id = ?', [visitId]);
          })()
    ]);
    
    if (!visit) {
      return res.status(404).json({ error: 'الزيارة غير موجودة' });
    }
    
    if (prescriptions.length === 0 && (visit.pharmacyCompleted === 0 || visit.pharmacy_completed === 0)) {
      return res.status(400).json({ error: 'يجب إضافة على الأقل دواء واحد قبل الإكمال' });
    }

    // Toggle pharmacy_completed status
    const currentPharmacyCompleted = visit.pharmacyCompleted ?? visit.pharmacy_completed ?? 0;
    const newPharmacyCompleted = currentPharmacyCompleted === 0 ? 1 : 0;
    const currentLabCompleted = visit.labCompleted ?? visit.lab_completed ?? 0;
    const currentDoctorCompleted = visit.doctorCompleted ?? visit.doctor_completed ?? 0;
    const currentStatus = visit.status;

    // Determine new status based on all departments
    let newStatus = currentStatus;
    
    // If all departments are completed, status is 'completed'
    if (currentLabCompleted === 1 && newPharmacyCompleted === 1 && currentDoctorCompleted === 1) {
      newStatus = 'completed';
    } 
    // If status was 'completed' but now any department is incomplete, revert to 'pending_all'
    else if (currentStatus === 'completed' && (currentLabCompleted === 0 || newPharmacyCompleted === 0 || currentDoctorCompleted === 0)) {
      newStatus = 'pending_all';
    }
    // If pharmacy is being completed and status is 'pending_pharmacy', update to 'pending_all'
    else if (newPharmacyCompleted === 1 && currentStatus === 'pending_pharmacy') {
      newStatus = 'pending_all';
    }
    // If any department is incomplete, ensure status is 'pending_all' (not 'completed')
    else if (currentLabCompleted === 0 || newPharmacyCompleted === 0 || currentDoctorCompleted === 0) {
      if (currentStatus === 'completed') {
        newStatus = 'pending_all';
      }
    }

    // Update visit with all changes at once
    let updatedVisit;
    if (db.prisma) {
      updatedVisit = await db.prisma.visit.update({
        where: { id: visitId },
        data: { 
          pharmacyCompleted: newPharmacyCompleted,
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
        'UPDATE visits SET pharmacy_completed = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [newPharmacyCompleted, newStatus, visitId]
      );
      updatedVisit = await getQuery('SELECT * FROM visits WHERE id = ?', [visitId]);
    }

    // Add status history in background (non-blocking)
    if (db.prisma) {
      db.prisma.visitStatusHistory.create({
        data: {
          visitId,
          status: newPharmacyCompleted === 1 ? 'pharmacy_completed' : 'pharmacy_incomplete',
          changedBy: req.user.id,
          notes: newPharmacyCompleted === 1 ? 'تم صرف العلاج' : 'تم إلغاء إكمال الصيدلية'
        }
      }).catch(() => null);
    } else {
      const { runQuery } = require('../database/db');
      runQuery(
        `INSERT INTO visit_status_history (visit_id, status, changed_by, notes) 
         VALUES (?, ?, ?, ?)`,
        [visitId, newPharmacyCompleted === 1 ? 'pharmacy_completed' : 'pharmacy_incomplete', req.user.id, newPharmacyCompleted === 1 ? 'تم صرف العلاج' : 'تم إلغاء إكمال الصيدلية']
      ).catch(() => null);
    }
    
    res.json({ 
      message: newPharmacyCompleted === 1 ? 'تم صرف العلاج بنجاح' : 'تم إلغاء إكمال الصيدلية',
      visit: updatedVisit 
    });
  } catch (error) {
    console.error('Error completing pharmacy work:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء صرف العلاج' });
  }
});

module.exports = router;
