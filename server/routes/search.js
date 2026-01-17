const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const db = require('../database/db');
const logger = require('../utils/logger');

// Advanced Search - Search across all entities
router.get('/global', authenticateToken, async (req, res) => {
  try {
    const { q, type, limit = 50 } = req.query;
    
    if (!q || q.trim().length < 2) {
      return res.status(400).json({ error: 'يجب إدخال على الأقل حرفين للبحث' });
    }

    const searchTerm = `%${q.trim()}%`;
    const results = {
      patients: [],
      visits: [],
      users: [],
      lab_results: [],
      prescriptions: [],
      diagnoses: []
    };

    // Search Patients
    if (!type || type === 'patients') {
      let patients;
      if (db.prisma) {
        patients = await db.prisma.patient.findMany({
          where: {
            OR: [
              { name: { contains: q.trim(), mode: 'insensitive' } },
              { nationalId: { contains: q.trim() } },
              { phone: { contains: q.trim() } },
              { mobile: { contains: q.trim() } }
            ]
          },
          take: parseInt(limit),
          orderBy: { createdAt: 'desc' }
        });
      } else {
        const { allQuery } = require('../database/db');
        patients = await allQuery(
          `SELECT id, name, national_id, phone, mobile, age, gender, patient_category, created_at
           FROM patients
           WHERE name LIKE ? OR national_id LIKE ? OR phone LIKE ? OR mobile LIKE ?
           ORDER BY created_at DESC
           LIMIT ?`,
          [searchTerm, searchTerm, searchTerm, searchTerm, parseInt(limit)]
        );
      }
      results.patients = patients.map(p => ({ ...p, type: 'patient' }));
    }

    // Search Visits
    if (!type || type === 'visits') {
      let visits;
      if (db.prisma) {
        visits = await db.prisma.visit.findMany({
          where: {
            OR: [
              { visitNumber: { contains: q.trim() } },
              { patient: { name: { contains: q.trim() } } },
              { patient: { nationalId: { contains: q.trim() } } }
            ]
          },
          include: { patient: true },
          take: parseInt(limit),
          orderBy: { createdAt: 'desc' }
        });
        
        visits = visits.map(v => ({
          id: v.id,
          visit_number: v.visitNumber,
          status: v.status,
          created_at: v.createdAt,
          patient_name: v.patient?.name || null,
          national_id: v.patient?.nationalId || null
        }));
      } else {
        const { allQuery } = require('../database/db');
        visits = await allQuery(
          `SELECT v.id, v.visit_number, v.status, v.created_at, p.name as patient_name, p.national_id
           FROM visits v
           LEFT JOIN patients p ON v.patient_id = p.id
           WHERE v.visit_number LIKE ? OR p.name LIKE ? OR p.national_id LIKE ?
           ORDER BY v.created_at DESC
           LIMIT ?`,
          [searchTerm, searchTerm, searchTerm, parseInt(limit)]
        );
      }
      results.visits = visits.map(v => ({ ...v, type: 'visit' }));
    }

    // Search Users
    if (!type || type === 'users') {
      let users;
      if (db.prisma) {
        users = await db.prisma.user.findMany({
          where: {
            OR: [
              { username: { contains: q.trim() } },
              { name: { contains: q.trim() } },
              { email: { contains: q.trim() } }
            ]
          },
          take: parseInt(limit),
          orderBy: { createdAt: 'desc' }
        });
      } else {
        const { allQuery } = require('../database/db');
        users = await allQuery(
          `SELECT id, username, name, email, role, created_at
           FROM users
           WHERE username LIKE ? OR name LIKE ? OR email LIKE ?
           ORDER BY created_at DESC
           LIMIT ?`,
          [searchTerm, searchTerm, searchTerm, parseInt(limit)]
        );
      }
      results.users = users.map(u => ({ ...u, type: 'user' }));
    }

    // Search Lab Results
    if (!type || type === 'lab_results') {
      let labResults;
      if (db.prisma) {
        labResults = await db.prisma.labResult.findMany({
          where: {
            OR: [
              { testName: { contains: q.trim() } },
              { result: { contains: q.trim() } },
              { visit: { patient: { name: { contains: q.trim() } } } }
            ]
          },
          include: {
            visit: {
              include: { patient: true }
            }
          },
          take: parseInt(limit),
          orderBy: { createdAt: 'desc' }
        });
        
        labResults = labResults.map(lr => ({
          id: lr.id,
          test_name: lr.testName,
          result: lr.result,
          created_at: lr.createdAt,
          visit_number: lr.visit?.visitNumber || null,
          patient_name: lr.visit?.patient?.name || null
        }));
      } else {
        const { allQuery } = require('../database/db');
        labResults = await allQuery(
          `SELECT lr.id, lr.test_name, lr.result, lr.created_at, v.visit_number, p.name as patient_name
           FROM lab_results lr
           LEFT JOIN visits v ON lr.visit_id = v.id
           LEFT JOIN patients p ON v.patient_id = p.id
           WHERE lr.test_name LIKE ? OR lr.result LIKE ? OR p.name LIKE ?
           ORDER BY lr.created_at DESC
           LIMIT ?`,
          [searchTerm, searchTerm, searchTerm, parseInt(limit)]
        );
      }
      results.lab_results = labResults.map(lr => ({ ...lr, type: 'lab_result' }));
    }

    // Search Prescriptions
    if (!type || type === 'prescriptions') {
      let prescriptions;
      if (db.prisma) {
        prescriptions = await db.prisma.pharmacyPrescription.findMany({
          where: {
            OR: [
              { medicationName: { contains: q.trim() } },
              { dosage: { contains: q.trim() } },
              { visit: { patient: { name: { contains: q.trim() } } } }
            ]
          },
          include: {
            visit: {
              include: { patient: true }
            }
          },
          take: parseInt(limit),
          orderBy: { createdAt: 'desc' }
        });
        
        prescriptions = prescriptions.map(pr => ({
          id: pr.id,
          medication_name: pr.medicationName,
          dosage: pr.dosage,
          created_at: pr.createdAt,
          visit_number: pr.visit?.visitNumber || null,
          patient_name: pr.visit?.patient?.name || null
        }));
      } else {
        const { allQuery } = require('../database/db');
        prescriptions = await allQuery(
          `SELECT pr.id, pr.medication_name, pr.dosage, pr.created_at, v.visit_number, p.name as patient_name
           FROM pharmacy_prescriptions pr
           LEFT JOIN visits v ON pr.visit_id = v.id
           LEFT JOIN patients p ON v.patient_id = p.id
           WHERE pr.medication_name LIKE ? OR pr.dosage LIKE ? OR p.name LIKE ?
           ORDER BY pr.created_at DESC
           LIMIT ?`,
          [searchTerm, searchTerm, searchTerm, parseInt(limit)]
        );
      }
      results.prescriptions = prescriptions.map(pr => ({ ...pr, type: 'prescription' }));
    }

    // Search Diagnoses
    if (!type || type === 'diagnoses') {
      let diagnoses;
      if (db.prisma) {
        diagnoses = await db.prisma.diagnosis.findMany({
          where: {
            OR: [
              { diagnosis: { contains: q.trim() } },
              { notes: { contains: q.trim() } },
              { visit: { patient: { name: { contains: q.trim() } } } }
            ]
          },
          include: {
            visit: {
              include: { patient: true }
            },
            creator: true
          },
          take: parseInt(limit),
          orderBy: { createdAt: 'desc' }
        });
        
        diagnoses = diagnoses.map(d => ({
          id: d.id,
          diagnosis: d.diagnosis,
          notes: d.notes,
          created_at: d.createdAt,
          visit_number: d.visit?.visitNumber || null,
          patient_name: d.visit?.patient?.name || null,
          doctor_name: d.creator?.name || null
        }));
      } else {
        const { allQuery } = require('../database/db');
        diagnoses = await allQuery(
          `SELECT d.id, d.diagnosis, d.notes, d.created_at, v.visit_number, p.name as patient_name, u.name as doctor_name
           FROM diagnoses d
           LEFT JOIN visits v ON d.visit_id = v.id
           LEFT JOIN patients p ON v.patient_id = p.id
           LEFT JOIN users u ON d.created_by = u.id
           WHERE d.diagnosis LIKE ? OR d.notes LIKE ? OR p.name LIKE ?
           ORDER BY d.created_at DESC
           LIMIT ?`,
          [searchTerm, searchTerm, searchTerm, parseInt(limit)]
        );
      }
      results.diagnoses = diagnoses.map(d => ({ ...d, type: 'diagnosis' }));
    }

    // Calculate totals
    const totals = {
      patients: results.patients.length,
      visits: results.visits.length,
      users: results.users.length,
      lab_results: results.lab_results.length,
      prescriptions: results.prescriptions.length,
      diagnoses: results.diagnoses.length
    };

    res.json({
      query: q,
      results,
      totals,
      total: Object.values(totals).reduce((sum, val) => sum + val, 0)
    });
  } catch (error) {
    logger.error('Error in global search:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء البحث' });
  }
});

// Quick Search - Fast search for common entities
router.get('/quick', authenticateToken, async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q || q.trim().length < 2) {
      return res.status(400).json({ error: 'يجب إدخال على الأقل حرفين للبحث' });
    }

    const searchTerm = `%${q.trim()}%`;
    
    // Quick search in patients and visits only
    let patients, visits;
    
    if (db.prisma) {
      [patients, visits] = await Promise.all([
        db.prisma.patient.findMany({
          where: {
            OR: [
              { name: { contains: q.trim() } },
              { nationalId: { contains: q.trim() } },
              { phone: { contains: q.trim() } }
            ]
          },
          take: 10,
          select: {
            id: true,
            name: true,
            nationalId: true,
            phone: true,
            age: true,
            gender: true
          }
        }),
        db.prisma.visit.findMany({
          where: {
            OR: [
              { visitNumber: { contains: q.trim() } },
              { patient: { name: { contains: q.trim() } } }
            ]
          },
          include: { patient: true },
          take: 10
        })
      ]);
      
      visits = visits.map(v => ({
        id: v.id,
        visit_number: v.visitNumber,
        status: v.status,
        patient_name: v.patient?.name || null
      }));
    } else {
      const { allQuery } = require('../database/db');
      [patients, visits] = await Promise.all([
        allQuery(
          `SELECT id, name, national_id, phone, age, gender
           FROM patients
           WHERE name LIKE ? OR national_id LIKE ? OR phone LIKE ?
           LIMIT 10`,
          [searchTerm, searchTerm, searchTerm]
        ),
        allQuery(
          `SELECT v.id, v.visit_number, v.status, p.name as patient_name
           FROM visits v
           LEFT JOIN patients p ON v.patient_id = p.id
           WHERE v.visit_number LIKE ? OR p.name LIKE ?
           LIMIT 10`,
          [searchTerm, searchTerm]
        )
      ]);
    }

    res.json({
      patients,
      visits,
      total: patients.length + visits.length
    });
  } catch (error) {
    logger.error('Error in quick search:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء البحث السريع' });
  }
});

module.exports = router;
