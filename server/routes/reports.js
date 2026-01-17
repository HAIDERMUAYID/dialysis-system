const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/auth');
const db = require('../database/db');
const PDFDocument = require('pdfkit');

// Generate medical report
router.get('/:visitId', authenticateToken, requireRole('doctor'), async (req, res) => {
  try {
    // Get visit with all details
    let visit, labResults, prescriptions, diagnoses;
    
    if (db.prisma) {
      visit = await db.prisma.visit.findUnique({
        where: { id: parseInt(req.params.visitId) },
        include: {
          patient: true,
          creator: true
        }
      });
      
      if (!visit) {
        return res.status(404).json({ error: 'الزيارة غير موجودة' });
      }
      
      visit = {
        ...visit,
        patient_name: visit.patient?.name || null,
        national_id: visit.patient?.nationalId || null,
        phone: visit.patient?.phone || null,
        age: visit.patient?.age || null,
        gender: visit.patient?.gender || null,
        address: visit.patient?.address || null,
        created_by_name: visit.creator?.name || null
      };
      
      labResults = await db.prisma.labResult.findMany({
        where: { visitId: parseInt(req.params.visitId) }
      });
      
      prescriptions = await db.prisma.pharmacyPrescription.findMany({
        where: { visitId: parseInt(req.params.visitId) }
      });
      
      diagnoses = await db.prisma.diagnosis.findMany({
        where: { visitId: parseInt(req.params.visitId) },
        include: { creator: true }
      });
      
      diagnoses = diagnoses.map(d => ({
        ...d,
        doctor_name: d.creator?.name || null
      }));
    } else {
      const { getQuery, allQuery } = require('../database/db');
      visit = await getQuery(
        `SELECT v.*, p.name as patient_name, p.national_id, p.phone, p.age, p.gender, p.address,
                u.name as created_by_name
         FROM visits v
         LEFT JOIN patients p ON v.patient_id = p.id
         LEFT JOIN users u ON v.created_by = u.id
         WHERE v.id = ?`,
        [req.params.visitId]
      );

      if (!visit) {
        return res.status(404).json({ error: 'الزيارة غير موجودة' });
      }

      labResults = await allQuery('SELECT * FROM lab_results WHERE visit_id = ?', [req.params.visitId]);
      prescriptions = await allQuery('SELECT * FROM pharmacy_prescriptions WHERE visit_id = ?', [req.params.visitId]);
      diagnoses = await allQuery(
        `SELECT d.*, u.name as doctor_name
         FROM diagnoses d
         LEFT JOIN users u ON d.created_by = u.id
         WHERE d.visit_id = ?`,
        [req.params.visitId]
      );
    }

    // Generate PDF
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    
    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=report-${visit.visit_number}.pdf`);

    doc.pipe(res);

    // Header
    doc.fontSize(20).text('مستشفى الحكيم - شعبة الكلية الصناعية', { align: 'right' });
    doc.fontSize(16).text('تقرير طبي', { align: 'right' });
    doc.moveDown();

    // Patient Information
    doc.fontSize(14).text('معلومات المريض:', { align: 'right' });
    doc.fontSize(12);
    doc.text(`الاسم: ${visit.patient_name || 'غير محدد'}`, { align: 'right' });
    doc.text(`رقم الهوية: ${visit.national_id || 'غير محدد'}`, { align: 'right' });
    doc.text(`العمر: ${visit.age || 'غير محدد'}`, { align: 'right' });
    doc.text(`الجنس: ${visit.gender || 'غير محدد'}`, { align: 'right' });
    doc.text(`رقم الزيارة: ${visit.visit_number}`, { align: 'right' });
    doc.text(`تاريخ الزيارة: ${new Date(visit.created_at).toLocaleDateString('ar-SA')}`, { align: 'right' });
    doc.moveDown();

    // Lab Results
    if (labResults.length > 0) {
      doc.fontSize(14).text('نتائج التحاليل:', { align: 'right' });
      doc.moveDown(0.5);
      doc.fontSize(11);
      labResults.forEach((result, index) => {
        doc.text(`${index + 1}. ${result.test_name}: ${result.result || 'غير محدد'} ${result.unit || ''}`, { align: 'right' });
        if (result.normal_range) {
          doc.text(`   المدى الطبيعي: ${result.normal_range}`, { align: 'right' });
        }
        if (result.notes) {
          doc.text(`   ملاحظات: ${result.notes}`, { align: 'right' });
        }
        doc.moveDown(0.3);
      });
      doc.moveDown();
    }

    // Prescriptions
    if (prescriptions.length > 0) {
      doc.fontSize(14).text('الأدوية المصروفة:', { align: 'right' });
      doc.moveDown(0.5);
      doc.fontSize(11);
      prescriptions.forEach((prescription, index) => {
        doc.text(`${index + 1}. ${prescription.medication_name}`, { align: 'right' });
        if (prescription.dosage) {
          doc.text(`   الجرعة: ${prescription.dosage}`, { align: 'right' });
        }
        if (prescription.quantity) {
          doc.text(`   الكمية: ${prescription.quantity}`, { align: 'right' });
        }
        if (prescription.instructions) {
          doc.text(`   التعليمات: ${prescription.instructions}`, { align: 'right' });
        }
        doc.moveDown(0.3);
      });
      doc.moveDown();
    }

    // Diagnoses
    if (diagnoses.length > 0) {
      doc.fontSize(14).text('التشخيص:', { align: 'right' });
      doc.moveDown(0.5);
      doc.fontSize(11);
      diagnoses.forEach((diagnosis, index) => {
        doc.text(`${index + 1}. ${diagnosis.diagnosis}`, { align: 'right' });
        if (diagnosis.notes) {
          doc.text(`   ملاحظات: ${diagnosis.notes}`, { align: 'right' });
        }
        if (diagnosis.doctor_name) {
          doc.text(`   الطبيب: ${diagnosis.doctor_name}`, { align: 'right' });
        }
        doc.text(`   التاريخ: ${new Date(diagnosis.created_at).toLocaleDateString('ar-SA')}`, { align: 'right' });
        doc.moveDown(0.3);
      });
    }

    // Footer
    doc.moveDown(2);
    doc.fontSize(10).text(`تاريخ طباعة التقرير: ${new Date().toLocaleDateString('ar-SA')}`, { align: 'right' });
    doc.text('مستشفى الحكيم - شعبة الكلية الصناعية', { align: 'right' });

    doc.end();
  } catch (error) {
    console.error('Error generating report:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء إنشاء التقرير' });
  }
});

// Get report data as JSON (for preview)
router.get('/:visitId/data', authenticateToken, requireRole('doctor'), async (req, res) => {
  try {
    let visit, labResults, prescriptions, diagnoses;
    
    if (db.prisma) {
      visit = await db.prisma.visit.findUnique({
        where: { id: parseInt(req.params.visitId) },
        include: {
          patient: true,
          creator: true
        }
      });
      
      if (!visit) {
        return res.status(404).json({ error: 'الزيارة غير موجودة' });
      }
      
      visit = {
        ...visit,
        patient_name: visit.patient?.name || null,
        national_id: visit.patient?.nationalId || null,
        phone: visit.patient?.phone || null,
        age: visit.patient?.age || null,
        gender: visit.patient?.gender || null,
        address: visit.patient?.address || null,
        created_by_name: visit.creator?.name || null
      };
      
      labResults = await db.prisma.labResult.findMany({
        where: { visitId: parseInt(req.params.visitId) }
      });
      
      prescriptions = await db.prisma.pharmacyPrescription.findMany({
        where: { visitId: parseInt(req.params.visitId) }
      });
      
      diagnoses = await db.prisma.diagnosis.findMany({
        where: { visitId: parseInt(req.params.visitId) },
        include: { creator: true }
      });
      
      diagnoses = diagnoses.map(d => ({
        ...d,
        doctor_name: d.creator?.name || null
      }));
    } else {
      const { getQuery, allQuery } = require('../database/db');
      visit = await getQuery(
        `SELECT v.*, p.name as patient_name, p.national_id, p.phone, p.age, p.gender, p.address,
                u.name as created_by_name
         FROM visits v
         LEFT JOIN patients p ON v.patient_id = p.id
         LEFT JOIN users u ON v.created_by = u.id
         WHERE v.id = ?`,
        [req.params.visitId]
      );

      if (!visit) {
        return res.status(404).json({ error: 'الزيارة غير موجودة' });
      }

      labResults = await allQuery('SELECT * FROM lab_results WHERE visit_id = ?', [req.params.visitId]);
      prescriptions = await allQuery('SELECT * FROM pharmacy_prescriptions WHERE visit_id = ?', [req.params.visitId]);
      diagnoses = await allQuery(
        `SELECT d.*, u.name as doctor_name
         FROM diagnoses d
         LEFT JOIN users u ON d.created_by = u.id
         WHERE d.visit_id = ?`,
        [req.params.visitId]
      );
    }

    res.json({
      visit,
      lab_results: labResults,
      prescriptions: prescriptions,
      diagnoses: diagnoses
    });
  } catch (error) {
    console.error('Error fetching report data:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب بيانات التقرير' });
  }
});

module.exports = router;
