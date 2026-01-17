const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const db = require('../database/db');
const logger = require('../utils/logger');
const ExcelJS = require('exceljs');
const { createObjectCsvWriter } = require('csv-writer');

// Export Patients to Excel
router.get('/patients/excel', authenticateToken, async (req, res) => {
  try {
    let patients;
    
    if (db.prisma) {
      patients = await db.prisma.patient.findMany({
        orderBy: { createdAt: 'desc' }
      });
    } else {
      const { allQuery } = require('../database/db');
      patients = await allQuery('SELECT * FROM patients ORDER BY created_at DESC');
    }
    
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('المرضى');
    
    // Set RTL direction
    worksheet.views = [{ rightToLeft: true }];
    
    // Define columns
    worksheet.columns = [
      { header: 'الرقم', key: 'id', width: 10 },
      { header: 'الاسم', key: 'name', width: 30 },
      { header: 'رقم الهوية', key: 'national_id', width: 15 },
      { header: 'العمر', key: 'age', width: 10 },
      { header: 'الجنس', key: 'gender', width: 10 },
      { header: 'الهاتف', key: 'phone', width: 15 },
      { header: 'الجوال', key: 'mobile', width: 15 },
      { header: 'البريد الإلكتروني', key: 'email', width: 25 },
      { header: 'العنوان', key: 'address', width: 30 },
      { header: 'المدينة', key: 'city', width: 15 },
      { header: 'فئة المريض', key: 'patient_category', width: 20 },
      { header: 'فصيلة الدم', key: 'blood_type', width: 10 },
      { header: 'تاريخ التسجيل', key: 'created_at', width: 20 }
    ];
    
    // Style header
    worksheet.getRow(1).font = { bold: true, size: 12 };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' }
    };
    worksheet.getRow(1).font = { ...worksheet.getRow(1).font, color: { argb: 'FFFFFFFF' } };
    worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
    
    // Add data
    patients.forEach(patient => {
      worksheet.addRow({
        id: patient.id,
        name: patient.name,
        national_id: patient.national_id || '',
        age: patient.age || '',
        gender: patient.gender || '',
        phone: patient.phone || '',
        mobile: patient.mobile || '',
        email: patient.email || '',
        address: patient.address || '',
        city: patient.city || '',
        patient_category: patient.patient_category || '',
        blood_type: patient.blood_type || '',
        created_at: patient.created_at ? new Date(patient.created_at).toLocaleDateString('ar-SA') : ''
      });
    });
    
    // Set response headers
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=المرضى-${new Date().toISOString().split('T')[0]}.xlsx`);
    
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    logger.error('Error exporting patients to Excel:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء تصدير البيانات' });
  }
});

// Export Visits to Excel
router.get('/visits/excel', authenticateToken, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    let visits;
    
    if (db.prisma) {
      const where = {};
      if (startDate && endDate) {
        where.createdAt = {
          gte: new Date(startDate),
          lte: new Date(endDate)
        };
      }
      
      visits = await db.prisma.visit.findMany({
        where,
        include: {
          patient: true,
          creator: true
        },
        orderBy: { createdAt: 'desc' }
      });
      
      visits = visits.map(v => ({
        ...v,
        patient_name: v.patient?.name || null,
        national_id: v.patient?.nationalId || null,
        created_by_name: v.creator?.name || null
      }));
    } else {
      const { allQuery } = require('../database/db');
      let query = `
        SELECT v.*, p.name as patient_name, p.national_id, u.name as created_by_name
        FROM visits v
        LEFT JOIN patients p ON v.patient_id = p.id
        LEFT JOIN users u ON v.created_by = u.id
      `;
      const params = [];
      
      if (startDate && endDate) {
        query += ' WHERE DATE(v.created_at) BETWEEN ? AND ?';
        params.push(startDate, endDate);
      }
      
      query += ' ORDER BY v.created_at DESC';
      visits = await allQuery(query, params);
    }
    
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('الزيارات');
    
    worksheet.views = [{ rightToLeft: true }];
    
    worksheet.columns = [
      { header: 'رقم الزيارة', key: 'visit_number', width: 15 },
      { header: 'اسم المريض', key: 'patient_name', width: 25 },
      { header: 'رقم الهوية', key: 'national_id', width: 15 },
      { header: 'الحالة', key: 'status', width: 15 },
      { header: 'المختبر', key: 'lab_completed', width: 10 },
      { header: 'الصيدلية', key: 'pharmacy_completed', width: 10 },
      { header: 'الطبيب', key: 'doctor_completed', width: 10 },
      { header: 'أنشئ بواسطة', key: 'created_by_name', width: 20 },
      { header: 'تاريخ الإنشاء', key: 'created_at', width: 20 }
    ];
    
    worksheet.getRow(1).font = { bold: true, size: 12 };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' }
    };
    worksheet.getRow(1).font = { ...worksheet.getRow(1).font, color: { argb: 'FFFFFFFF' } };
    worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
    
    visits.forEach(visit => {
      worksheet.addRow({
        visit_number: visit.visit_number,
        patient_name: visit.patient_name || '',
        national_id: visit.national_id || '',
        status: visit.status === 'completed' ? 'مكتملة' : 'قيد المعالجة',
        lab_completed: visit.lab_completed === 1 ? 'نعم' : 'لا',
        pharmacy_completed: visit.pharmacy_completed === 1 ? 'نعم' : 'لا',
        doctor_completed: visit.doctor_completed === 1 ? 'نعم' : 'لا',
        created_by_name: visit.created_by_name || '',
        created_at: visit.created_at ? new Date(visit.created_at).toLocaleDateString('ar-SA') : ''
      });
    });
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=الزيارات-${new Date().toISOString().split('T')[0]}.xlsx`);
    
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    logger.error('Error exporting visits to Excel:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء تصدير البيانات' });
  }
});

// Export Patients to CSV
router.get('/patients/csv', authenticateToken, async (req, res) => {
  try {
    let patients;
    
    if (db.prisma) {
      patients = await db.prisma.patient.findMany({
        orderBy: { createdAt: 'desc' }
      });
    } else {
      const { allQuery } = require('../database/db');
      patients = await allQuery('SELECT * FROM patients ORDER BY created_at DESC');
    }
    
    const csvWriter = createObjectCsvWriter({
      path: 'temp_patients.csv',
      header: [
        { id: 'id', title: 'الرقم' },
        { id: 'name', title: 'الاسم' },
        { id: 'national_id', title: 'رقم الهوية' },
        { id: 'age', title: 'العمر' },
        { id: 'gender', title: 'الجنس' },
        { id: 'phone', title: 'الهاتف' },
        { id: 'mobile', title: 'الجوال' },
        { id: 'email', title: 'البريد الإلكتروني' },
        { id: 'address', title: 'العنوان' },
        { id: 'city', title: 'المدينة' },
        { id: 'patient_category', title: 'فئة المريض' },
        { id: 'blood_type', title: 'فصيلة الدم' },
        { id: 'created_at', title: 'تاريخ التسجيل' }
      ],
      encoding: 'utf8',
      bom: true // Add BOM for Excel compatibility with Arabic
    });
    
    const records = patients.map(p => ({
      id: p.id,
      name: p.name || '',
      national_id: p.national_id || '',
      age: p.age || '',
      gender: p.gender || '',
      phone: p.phone || '',
      mobile: p.mobile || '',
      email: p.email || '',
      address: p.address || '',
      city: p.city || '',
      patient_category: p.patient_category || '',
      blood_type: p.blood_type || '',
      created_at: p.created_at ? new Date(p.created_at).toLocaleDateString('ar-SA') : ''
    }));
    
    await csvWriter.writeRecords(records);
    
    const fs = require('fs');
    const fileContent = fs.readFileSync('temp_patients.csv', 'utf8');
    fs.unlinkSync('temp_patients.csv'); // Delete temp file
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=المرضى-${new Date().toISOString().split('T')[0]}.csv`);
    res.send('\ufeff' + fileContent); // Add BOM for Excel
  } catch (error) {
    logger.error('Error exporting patients to CSV:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء تصدير البيانات' });
  }
});

module.exports = router;
