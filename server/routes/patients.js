const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/auth');
const db = require('../database/db');
const { logActivity } = require('../middleware/activityLogger');

// Get all patients (with search and filters)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { search, category, gender, city, blood_type, is_active } = req.query;
    
    // Use Prisma if available
    if (db.prisma) {
      const where = {};
      
      if (search) {
        where.OR = [
          { name: { contains: search } },
          { nationalId: { contains: search } },
          { phone: { contains: search } },
          { mobile: { contains: search } }
        ];
      }
      
      if (category) where.patientCategory = category;
      if (gender) where.gender = gender;
      if (city) where.city = { contains: city };
      if (blood_type) where.bloodType = blood_type;
      if (is_active !== undefined) {
        where.isActive = is_active === 'true' || is_active === '1' ? 1 : 0;
      }
      
      // Add pagination
      const page = parseInt(req.query.page) || 1;
      const limit = Math.min(parseInt(req.query.limit) || 50, 100); // Max 100 per page
      const skip = (page - 1) * limit;

      const [patients, total] = await Promise.all([
        db.prisma.patient.findMany({
          where,
          select: {
            id: true,
            name: true,
            nationalId: true,
            phone: true,
            mobile: true,
            email: true,
            age: true,
            dateOfBirth: true,
            gender: true,
            bloodType: true,
            address: true,
            city: true,
            patientCategory: true,
            medicalHistory: true,
            allergies: true,
            chronicDiseases: true,
            currentMedications: true,
            emergencyContactName: true,
            emergencyContactPhone: true,
            emergencyContactRelation: true,
            insuranceNumber: true,
            insuranceType: true,
            notes: true,
            isActive: true,
            createdBy: true,
            createdAt: true,
            updatedAt: true,
            creator: {
              select: {
                name: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: skip,
        }),
        db.prisma.patient.count({ where }),
      ]);
      
      // Map to include created_by_name and convert camelCase to snake_case
      const patientsWithCreator = patients.map(p => ({
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
        updated_at: p.updatedAt,
      }));
      
      res.json({
        data: patientsWithCreator,
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
      let query = 'SELECT p.*, u.name as created_by_name FROM patients p LEFT JOIN users u ON p.created_by = u.id WHERE 1=1';
      const params = [];

      if (search) {
        query += ' AND (p.name LIKE ? OR p.national_id LIKE ? OR p.phone LIKE ? OR p.mobile LIKE ?)';
        const searchTerm = `%${search}%`;
        params.push(searchTerm, searchTerm, searchTerm, searchTerm);
      }

      if (category) {
        query += ' AND p.patient_category = ?';
        params.push(category);
      }

      if (gender) {
        query += ' AND p.gender = ?';
        params.push(gender);
      }

      if (city) {
        query += ' AND p.city LIKE ?';
        params.push(`%${city}%`);
      }

      if (blood_type) {
        query += ' AND p.blood_type = ?';
        params.push(blood_type);
      }

      if (is_active !== undefined) {
        query += ' AND p.is_active = ?';
        params.push(is_active === 'true' || is_active === '1' ? 1 : 0);
      }

      query += ' ORDER BY p.created_at DESC';
      const patients = await allQuery(query, params);
      res.json(patients);
    }
  } catch (error) {
    console.error('Error fetching patients:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب المرضى' });
  }
});

// Get patient by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    let patient;
    
    if (db.prisma) {
      patient = await db.prisma.patient.findUnique({
        where: { id: parseInt(req.params.id) },
        include: { creator: true }
      });
    } else {
      const { getQuery } = require('../database/db');
      patient = await getQuery('SELECT * FROM patients WHERE id = ?', [req.params.id]);
    }
    
    if (!patient) {
      return res.status(404).json({ error: 'المريض غير موجود' });
    }
    res.json(patient);
  } catch (error) {
    console.error('Error fetching patient:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب بيانات المريض' });
  }
});

// Create new patient (Enhanced with comprehensive fields)
router.post('/', authenticateToken, requireRole('inquiry', 'admin'), async (req, res) => {
  try {
    // Check if user is authenticated
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'غير مصرح: يجب تسجيل الدخول أولاً' });
    }

    const {
      name, national_id, phone, mobile, email, age, date_of_birth, gender, blood_type,
      address, city, patient_category, medical_history, allergies, chronic_diseases,
      current_medications, emergency_contact_name, emergency_contact_phone,
      emergency_contact_relation, insurance_number, insurance_type, notes
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'اسم المريض مطلوب' });
    }

    // Check if national_id already exists
    if (national_id) {
      let existing;
      if (db.prisma) {
        existing = await db.prisma.patient.findUnique({
          where: { nationalId: national_id }
        });
      } else {
        const { getQuery } = require('../database/db');
        existing = await getQuery('SELECT id FROM patients WHERE national_id = ?', [national_id]);
      }
      
      if (existing) {
        return res.status(400).json({ error: 'رقم الهوية موجود مسبقاً' });
      }
    }

    let result;
    if (db.prisma) {
      // Use Prisma to create patient
      // Normalize dateOfBirth: convert empty string to null and ensure proper format
      let normalizedDateOfBirth = null;
      if (date_of_birth) {
        const dateStr = String(date_of_birth).trim();
        if (dateStr && dateStr !== '' && dateStr !== 'null' && dateStr !== 'undefined') {
          try {
            // If it's in YYYY-MM-DD format, convert to ISO DateTime
            // Prisma expects DateTime in ISO-8601 format
            let date;
            if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
              // YYYY-MM-DD format - add time component
              date = new Date(dateStr + 'T00:00:00.000Z');
            } else {
              // Try to parse as-is
              date = new Date(dateStr);
            }
            
            if (!isNaN(date.getTime())) {
              // Convert to ISO string format for Prisma
              normalizedDateOfBirth = date.toISOString();
            } else {
              console.warn('Invalid date format:', dateStr);
            }
          } catch (e) {
            console.error('Error parsing date_of_birth:', e, 'Value:', dateStr);
            normalizedDateOfBirth = null;
          }
        }
      }

      const patientData = {
        name,
        nationalId: national_id || null,
        phone: phone || null,
        mobile: mobile || null,
        email: email || null,
        age: age ? parseInt(age) : null,
        dateOfBirth: normalizedDateOfBirth,
        gender: gender || null,
        bloodType: blood_type || null,
        address: address || null,
        city: city || null,
        patientCategory: patient_category || null,
        medicalHistory: medical_history || null,
        allergies: allergies || null,
        chronicDiseases: chronic_diseases || null,
        currentMedications: current_medications || null,
        emergencyContactName: emergency_contact_name || null,
        emergencyContactPhone: emergency_contact_phone || null,
        emergencyContactRelation: emergency_contact_relation || null,
        insuranceNumber: insurance_number || null,
        insuranceType: insurance_type || null,
        notes: notes || null,
        createdBy: req.user.id,
        isActive: 1
      };
      
      const newPatient = await db.prisma.patient.create({
        data: patientData,
        include: { creator: true }
      });
      
      result = { lastID: newPatient.id };
    } else {
      // Fallback to SQL
      const { runQuery } = require('../database/db');
      result = await runQuery(
        `INSERT INTO patients (
          name, national_id, phone, mobile, email, age, date_of_birth, gender, blood_type,
          address, city, patient_category, medical_history, allergies, chronic_diseases,
          current_medications, emergency_contact_name, emergency_contact_phone,
          emergency_contact_relation, insurance_number, insurance_type, notes, created_by, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [
          name, national_id, phone, mobile, email, age, date_of_birth, gender, blood_type,
          address, city, patient_category, medical_history, allergies, chronic_diseases,
          current_medications, emergency_contact_name, emergency_contact_phone,
          emergency_contact_relation, insurance_number, insurance_type, notes, req.user.id, 1
        ]
      );
    }

    await logActivity(req.user.id, 'create_patient', 'patient', result.lastID, `تم إنشاء مريض جديد: ${name}`);

    let patient;
    if (db.prisma) {
      patient = await db.prisma.patient.findUnique({
        where: { id: result.lastID },
        include: { creator: true }
      });
      if (patient) {
        patient = { ...patient, created_by_name: patient.creator?.name || null };
      }
    } else {
      const { getQuery } = require('../database/db');
      patient = await getQuery(
        `SELECT p.*, u.name as created_by_name FROM patients p LEFT JOIN users u ON p.created_by = u.id WHERE p.id = ?`,
        [result.lastID]
      );
    }
    res.status(201).json(patient);
  } catch (error) {
    console.error('Error creating patient:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      meta: error.meta,
      stack: error.stack
    });
    
    // Provide more specific error messages
    let errorMessage = 'حدث خطأ أثناء إضافة المريض';
    if (error.code === 'P2002') {
      // Unique constraint violation
      const field = error.meta?.target?.[0] || 'حقل';
      errorMessage = `قيمة ${field} موجودة مسبقاً في قاعدة البيانات`;
    } else if (error.code === 'P2003') {
      // Foreign key constraint violation
      errorMessage = 'خطأ في البيانات المرسلة: قيمة غير صحيحة';
    } else if (error.message) {
      errorMessage = `خطأ: ${error.message}`;
    }
    
    res.status(500).json({ error: errorMessage, details: process.env.NODE_ENV === 'development' ? error.message : undefined });
  }
});

// Update patient (Enhanced with comprehensive fields)
router.put('/:id', authenticateToken, requireRole('inquiry', 'admin'), async (req, res) => {
  try {
    const patientId = parseInt(req.params.id);
    const {
      name, national_id, phone, mobile, email, age, date_of_birth, gender, blood_type,
      address, city, patient_category, medical_history, allergies, chronic_diseases,
      current_medications, emergency_contact_name, emergency_contact_phone,
      emergency_contact_relation, insurance_number, insurance_type, notes, is_active
    } = req.body;

    let patient;
    if (db.prisma) {
      patient = await db.prisma.patient.findUnique({
        where: { id: patientId }
      });
    } else {
      const { getQuery } = require('../database/db');
      patient = await getQuery('SELECT id FROM patients WHERE id = ?', [req.params.id]);
    }
    
    if (!patient) {
      return res.status(404).json({ error: 'المريض غير موجود' });
    }

    // Check if national_id already exists (for another patient)
    if (national_id) {
      let existing;
      if (db.prisma) {
        existing = await db.prisma.patient.findFirst({
          where: {
            nationalId: national_id,
            id: { not: patientId }
          }
        });
      } else {
        const { getQuery } = require('../database/db');
        existing = await getQuery('SELECT id FROM patients WHERE national_id = ? AND id != ?', [national_id, req.params.id]);
      }
      
      if (existing) {
        return res.status(400).json({ error: 'رقم الهوية موجود مسبقاً لمريض آخر' });
      }
    }

    let updatedPatient;
    if (db.prisma) {
      // Normalize dateOfBirth: convert empty string to null and ensure proper format
      let normalizedDateOfBirth = null;
      if (date_of_birth) {
        const dateStr = String(date_of_birth).trim();
        if (dateStr && dateStr !== '' && dateStr !== 'null' && dateStr !== 'undefined') {
          try {
            // If it's in YYYY-MM-DD format, convert to ISO DateTime
            // Prisma expects DateTime in ISO-8601 format
            let date;
            if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
              // YYYY-MM-DD format - add time component
              date = new Date(dateStr + 'T00:00:00.000Z');
            } else {
              // Try to parse as-is
              date = new Date(dateStr);
            }
            
            if (!isNaN(date.getTime())) {
              // Convert to ISO string format for Prisma
              normalizedDateOfBirth = date.toISOString();
            } else {
              console.warn('Invalid date format:', dateStr);
            }
          } catch (e) {
            console.error('Error parsing date_of_birth:', e, 'Value:', dateStr);
            normalizedDateOfBirth = null;
          }
        }
      }

      updatedPatient = await db.prisma.patient.update({
        where: { id: patientId },
        data: {
          name,
          nationalId: national_id || null,
          phone: phone || null,
          mobile: mobile || null,
          email: email || null,
          age: age ? parseInt(age) : null,
          dateOfBirth: normalizedDateOfBirth,
          gender: gender || null,
          bloodType: blood_type || null,
          address: address || null,
          city: city || null,
          patientCategory: patient_category || null,
          medicalHistory: medical_history || null,
          allergies: allergies || null,
          chronicDiseases: chronic_diseases || null,
          currentMedications: current_medications || null,
          emergencyContactName: emergency_contact_name || null,
          emergencyContactPhone: emergency_contact_phone || null,
          emergencyContactRelation: emergency_contact_relation || null,
          insuranceNumber: insurance_number || null,
          insuranceType: insurance_type || null,
          notes: notes || null,
          isActive: is_active !== undefined ? (is_active === true || is_active === '1' ? 1 : 0) : patient.isActive
        },
        include: { creator: true }
      });
      
      updatedPatient = {
        ...updatedPatient,
        created_by_name: updatedPatient.creator?.name || null
      };
    } else {
      const { runQuery, getQuery } = require('../database/db');
      await runQuery(
        `UPDATE patients 
         SET name = ?, national_id = ?, phone = ?, mobile = ?, email = ?, age = ?, date_of_birth = ?,
             gender = ?, blood_type = ?, address = ?, city = ?, patient_category = ?,
             medical_history = ?, allergies = ?, chronic_diseases = ?, current_medications = ?,
             emergency_contact_name = ?, emergency_contact_phone = ?, emergency_contact_relation = ?,
             insurance_number = ?, insurance_type = ?, notes = ?, is_active = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [
          name, national_id, phone, mobile, email, age, date_of_birth, gender, blood_type,
          address, city, patient_category, medical_history, allergies, chronic_diseases,
          current_medications, emergency_contact_name, emergency_contact_phone,
          emergency_contact_relation, insurance_number, insurance_type, notes,
          is_active !== undefined ? is_active : 1, req.params.id
        ]
      );

      updatedPatient = await getQuery(
        `SELECT p.*, u.name as created_by_name FROM patients p LEFT JOIN users u ON p.created_by = u.id WHERE p.id = ?`,
        [req.params.id]
      );
    }

    await logActivity(req.user.id, 'update_patient', 'patient', req.params.id, `تم تحديث بيانات المريض: ${name}`);
    res.json(updatedPatient);
  } catch (error) {
    console.error('Error updating patient:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء تحديث بيانات المريض' });
  }
});

// Delete patient (soft delete by setting is_active = 0)
router.delete('/:id', authenticateToken, requireRole('inquiry', 'admin'), async (req, res) => {
  try {
    const patientId = parseInt(req.params.id);
    
    let patient;
    if (db.prisma) {
      patient = await db.prisma.patient.findUnique({
        where: { id: patientId },
        select: { id: true, name: true }
      });
    } else {
      const { getQuery } = require('../database/db');
      patient = await getQuery('SELECT id, name FROM patients WHERE id = ?', [req.params.id]);
    }
    
    if (!patient) {
      return res.status(404).json({ error: 'المريض غير موجود' });
    }

    // Soft delete - set is_active = 0 instead of deleting
    if (db.prisma) {
      await db.prisma.patient.update({
        where: { id: patientId },
        data: { isActive: 0 }
      });
    } else {
      const { runQuery } = require('../database/db');
      await runQuery('UPDATE patients SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [req.params.id]);
    }
    
    await logActivity(req.user.id, 'delete_patient', 'patient', req.params.id, `تم إلغاء تفعيل المريض: ${patient.name}`);
    res.json({ message: 'تم إلغاء تفعيل المريض بنجاح' });
  } catch (error) {
    console.error('Error deleting patient:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء حذف المريض' });
  }
});

// Helper function to generate comprehensive patient report
async function generateComprehensiveReport(patientId) {
  let patient;
  
  if (db.prisma) {
    patient = await db.prisma.patient.findUnique({
      where: { id: parseInt(patientId) },
      include: { creator: true }
    });
    
    if (!patient) {
      return null;
    }
    
    patient = {
      ...patient,
      created_by_name: patient.creator?.name || null
    };
  } else {
    const { getQuery } = require('../database/db');
    patient = await getQuery(
      `SELECT p.*, u.name as created_by_name 
       FROM patients p 
       LEFT JOIN users u ON p.created_by = u.id 
       WHERE p.id = ?`,
      [patientId]
    );
  }

  if (!patient) {
    return null;
  }

  // Get all visits with full details grouped by visit
  let visits;
  if (db.prisma) {
    visits = await db.prisma.visit.findMany({
      where: { patientId: parseInt(patientId) },
      include: { creator: true },
      orderBy: { createdAt: 'desc' }
    });
    
    visits = visits.map(v => ({
      id: v.id,
      patient_id: v.patientId,
      visit_number: v.visitNumber,
      status: v.status,
      lab_completed: v.labCompleted === true || v.labCompleted === 1 ? 1 : 0,
      pharmacy_completed: v.pharmacyCompleted === true || v.pharmacyCompleted === 1 ? 1 : 0,
      doctor_completed: v.doctorCompleted === true || v.doctorCompleted === 1 ? 1 : 0,
      created_by: v.createdBy,
      created_at: v.createdAt ? (v.createdAt instanceof Date ? v.createdAt.toISOString() : new Date(v.createdAt).toISOString()) : null,
      updated_at: v.updatedAt ? (v.updatedAt instanceof Date ? v.updatedAt.toISOString() : new Date(v.updatedAt).toISOString()) : null,
      created_by_name: v.creator?.name || null
    }));
  } else {
    const { allQuery } = require('../database/db');
    visits = await allQuery(
      `SELECT v.*, u.name as created_by_name
       FROM visits v
       LEFT JOIN users u ON v.created_by = u.id
       WHERE v.patient_id = ?
       ORDER BY v.created_at DESC`,
      [patientId]
    );
  }

  // For each visit, get lab results, prescriptions, diagnoses, and attachments
  const visitsWithDetails = await Promise.all(visits.map(async (visit) => {
    let labResults, prescriptions, diagnoses, attachments = [], statusHistory = [];
    
    if (db.prisma) {
      labResults = await db.prisma.labResult.findMany({
        where: { visitId: visit.id },
        include: { 
          creator: true,
          testCatalog: true
        },
        orderBy: { createdAt: 'desc' }
      });
      
      labResults = labResults.map(lr => {
        let createdAt = null;
        if (lr.createdAt) {
          try {
            createdAt = lr.createdAt instanceof Date 
              ? lr.createdAt.toISOString() 
              : new Date(lr.createdAt).toISOString();
          } catch (e) {
            console.warn('Error formatting lab result date:', e);
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
      });
      
      prescriptions = await db.prisma.pharmacyPrescription.findMany({
        where: { visitId: visit.id },
        include: { 
          creator: true,
          drugCatalog: true
        },
        orderBy: { createdAt: 'desc' }
      });
      
      prescriptions = prescriptions.map(pp => {
        let createdAt = null;
        if (pp.createdAt) {
          try {
            createdAt = pp.createdAt instanceof Date 
              ? pp.createdAt.toISOString() 
              : new Date(pp.createdAt).toISOString();
          } catch (e) {
            console.warn('Error formatting prescription date:', e);
          }
        }
        
        return {
          id: pp.id,
          visit_id: pp.visitId,
          drug_catalog_id: pp.drugCatalogId,
          medication_name: pp.medicationName || pp.drugCatalog?.drugName || null,
          dosage: pp.dosage,
          quantity: pp.quantity,
          instructions: pp.instructions,
          created_by: pp.createdBy,
          created_at: createdAt,
          updated_at: pp.updatedAt ? (pp.updatedAt instanceof Date ? pp.updatedAt.toISOString() : new Date(pp.updatedAt).toISOString()) : null,
          created_by_name: pp.creator?.name || null
        };
      });
      
      diagnoses = await db.prisma.diagnosis.findMany({
        where: { visitId: visit.id },
        include: { creator: true },
        orderBy: { createdAt: 'desc' }
      });
      
      diagnoses = diagnoses.map(d => {
        let createdAt = null;
        if (d.createdAt) {
          try {
            createdAt = d.createdAt instanceof Date 
              ? d.createdAt.toISOString() 
              : new Date(d.createdAt).toISOString();
          } catch (e) {
            console.warn('Error formatting diagnosis date:', e);
          }
        }
        
        return {
          id: d.id,
          visit_id: d.visitId,
          diagnosis: d.diagnosis,
          notes: d.notes,
          created_by: d.createdBy,
          created_at: createdAt,
          updated_at: d.updatedAt ? (d.updatedAt instanceof Date ? d.updatedAt.toISOString() : new Date(d.updatedAt).toISOString()) : null,
          doctor_name: d.creator?.name || null
        };
      });
      
      try {
        attachments = await db.prisma.visitAttachment.findMany({
          where: { visitId: visit.id },
          include: { creator: true },
          orderBy: { createdAt: 'desc' }
        });
        
        attachments = attachments.map(a => ({
          ...a,
          uploaded_by_name: a.creator?.name || null
        }));
      } catch (error) {
        console.warn('Attachments table might not exist:', error.message);
      }
      
      try {
        statusHistory = await db.prisma.visitStatusHistory.findMany({
          where: { visitId: visit.id },
          include: { changedBy: true },
          orderBy: { createdAt: 'asc' }
        });
        
        statusHistory = statusHistory.map(sh => ({
          ...sh,
          changed_by_name: sh.changedBy?.name || null
        }));
      } catch (error) {
        console.warn('Status history table might not exist:', error.message);
      }
    } else {
      const { allQuery } = require('../database/db');
      labResults = await allQuery(
        `SELECT lr.*, u.name as created_by_name, lt.test_name
         FROM lab_results lr
         LEFT JOIN users u ON lr.created_by = u.id
         LEFT JOIN lab_test_catalog lt ON lr.test_catalog_id = lt.id
         WHERE lr.visit_id = ?
         ORDER BY lr.created_at DESC`,
        [visit.id]
      );

      prescriptions = await allQuery(
        `SELECT pp.*, u.name as created_by_name, dc.drug_name as medication_name
         FROM pharmacy_prescriptions pp
         LEFT JOIN users u ON pp.created_by = u.id
         LEFT JOIN drug_catalog dc ON pp.drug_catalog_id = dc.id
         WHERE pp.visit_id = ?
         ORDER BY pp.created_at DESC`,
        [visit.id]
      );

      diagnoses = await allQuery(
        `SELECT d.*, u.name as doctor_name
         FROM diagnoses d
         LEFT JOIN users u ON d.created_by = u.id
         WHERE d.visit_id = ?
         ORDER BY d.created_at DESC`,
        [visit.id]
      );

      try {
        attachments = await allQuery(
          `SELECT va.*, u.name as uploaded_by_name
           FROM visit_attachments va
           LEFT JOIN users u ON va.uploaded_by = u.id
           WHERE va.visit_id = ?
           ORDER BY va.created_at DESC`,
          [visit.id]
        );
      } catch (error) {
        console.warn('Attachments table might not exist:', error.message);
      }

      try {
        statusHistory = await allQuery(
          `SELECT sh.*, u.name as changed_by_name
           FROM visit_status_history sh
           LEFT JOIN users u ON sh.changed_by = u.id
           WHERE sh.visit_id = ?
           ORDER BY sh.created_at ASC`,
          [visit.id]
        );
      } catch (error) {
        console.warn('Status history table might not exist:', error.message);
      }
    }

    // visit here is already converted from visits.map, so it should have snake_case fields
    // But we ensure the completion flags are 1 or 0
    const visitData = {
      ...visit,
      lab_completed: visit.lab_completed === true || visit.lab_completed === 1 ? 1 : 0,
      pharmacy_completed: visit.pharmacy_completed === true || visit.pharmacy_completed === 1 ? 1 : 0,
      doctor_completed: visit.doctor_completed === true || visit.doctor_completed === 1 ? 1 : 0
    };
    
    return {
      ...visitData,
      lab_results: labResults,
      prescriptions: prescriptions,
      diagnoses: diagnoses,
      attachments: attachments,
      status_history: statusHistory
    };
  }));

  return {
    patient,
    visits: visitsWithDetails
  };
}

// Get comprehensive patient report (all visits, lab results, prescriptions, diagnoses)
router.get('/:id/full-report', authenticateToken, requireRole('doctor', 'admin', 'inquiry'), async (req, res) => {
  try {
    const report = await generateComprehensiveReport(req.params.id);
    
    if (!report) {
      return res.status(404).json({ error: 'المريض غير موجود' });
    }

    res.json(report);
  } catch (error) {
    console.error('Error generating comprehensive report:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب التقرير الشامل' });
  }
});

router.get('/:id/comprehensive-report', authenticateToken, async (req, res) => {
  try {
    const report = await generateComprehensiveReport(req.params.id);
    
    if (!report) {
      return res.status(404).json({ error: 'المريض غير موجود' });
    }

    res.json(report);
  } catch (error) {
    console.error('Error generating comprehensive report:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب التقرير الشامل' });
  }
});

module.exports = router;
