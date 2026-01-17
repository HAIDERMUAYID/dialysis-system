const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/auth');
const db = require('../database/db');
const PdfPrinter = require('pdfmake');
const ExcelJS = require('exceljs');
const logger = require('../utils/logger');
const path = require('path');
const fs = require('fs');

// Helper function to get Arabic fonts for pdfmake
function getPdfMakeFonts() {
  const fontPath = path.join(__dirname, '../fonts/Cairo-Regular.ttf');
  
  // pdfmake requires fonts to be organized by font family name
  const fonts = {
    Arabic: {
      normal: null,
      bold: null,
      italics: null,
      bolditalics: null
    }
  };
  
  // Check if font exists, read it as buffer
  if (fs.existsSync(fontPath)) {
    try {
      const fontBuffer = fs.readFileSync(fontPath);
      // Use the same font buffer for all styles (Cairo-Regular supports all)
      fonts.Arabic.normal = fontBuffer;
      fonts.Arabic.bold = fontBuffer;
      fonts.Arabic.italics = fontBuffer;
      fonts.Arabic.bolditalics = fontBuffer;
      logger.info('Arabic font loaded successfully');
    } catch (err) {
      logger.warn(`Failed to read font ${fontPath}:`, err.message);
      // Fallback to default fonts
      return null;
    }
  } else {
    logger.warn(`Font not found: ${fontPath}, will use default fonts`);
    return null;
  }

  return fonts;
}

// Advanced Medical Reports with comprehensive filters
router.get('/', authenticateToken, requireRole('doctor', 'admin', 'inquiry'), async (req, res) => {
  try {
    const {
      patient_id,
      visit_id,
      patient_category,
      gender,
      blood_type,
      date_from,
      date_to,
      status,
      has_lab_results,
      has_prescriptions,
      has_diagnoses,
      search,
      limit = 100,
      offset = 0
    } = req.query;

    let query = `
      SELECT 
        v.*,
        p.name as patient_name,
        p.national_id,
        p.age,
        p.gender,
        p.phone,
        u.name as created_by_name
      FROM visits v
      LEFT JOIN patients p ON v.patient_id = p.id
      LEFT JOIN users u ON v.created_by = u.id
      WHERE 1=1
    `;
    const params = [];

    if (patient_id) {
      query += ' AND v.patient_id = ?';
      params.push(patient_id);
    }

    if (visit_id) {
      query += ' AND v.id = ?';
      params.push(visit_id);
    }

    if (patient_category) {
      query += ' AND p.category = ?';
      params.push(patient_category);
    }

    if (gender) {
      query += ' AND p.gender = ?';
      params.push(gender);
    }

    if (blood_type) {
      query += ' AND p.blood_type = ?';
      params.push(blood_type);
    }

    if (date_from) {
      query += ' AND DATE(v.created_at) >= ?';
      params.push(date_from);
    }

    if (date_to) {
      query += ' AND DATE(v.created_at) <= ?';
      params.push(date_to);
    }

    if (status) {
      query += ' AND v.status = ?';
      params.push(status);
    }

    if (has_lab_results === 'true') {
      query += ' AND EXISTS (SELECT 1 FROM lab_results WHERE visit_id = v.id)';
    }

    if (has_prescriptions === 'true') {
      query += ' AND EXISTS (SELECT 1 FROM pharmacy_prescriptions WHERE visit_id = v.id)';
    }

    if (has_diagnoses === 'true') {
      query += ' AND EXISTS (SELECT 1 FROM diagnoses WHERE visit_id = v.id)';
    }

    if (search) {
      query += ' AND (p.name LIKE ? OR p.national_id LIKE ? OR v.visit_number LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    query += ` ORDER BY v.created_at DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), parseInt(offset));

    let visits, total;
    
    if (db.prisma) {
      const where = {};
      if (patient_id) where.patientId = parseInt(patient_id);
      if (visit_id) where.id = parseInt(visit_id);
      if (status) where.status = status;
      if (date_from || date_to) {
        where.createdAt = {};
        if (date_from) where.createdAt.gte = new Date(date_from);
        if (date_to) where.createdAt.lte = new Date(date_to);
      }
      
      visits = await db.prisma.visit.findMany({
        where,
        include: {
          patient: true,
          creator: true
        },
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit),
        skip: parseInt(offset)
      });
      
      // Apply additional filters that Prisma doesn't support directly
      if (patient_category || gender || blood_type || search || has_lab_results === 'true' || has_prescriptions === 'true' || has_diagnoses === 'true') {
        const filteredVisits = [];
        for (const v of visits) {
          if (patient_category && v.patient?.patientCategory !== patient_category) continue;
          if (gender && v.patient?.gender !== gender) continue;
          if (blood_type && v.patient?.bloodType !== blood_type) continue;
          if (search) {
            const searchLower = search.toLowerCase();
            if (!v.patient?.name?.toLowerCase().includes(searchLower) &&
                !v.patient?.nationalId?.toLowerCase().includes(searchLower) &&
                !v.visitNumber?.toLowerCase().includes(searchLower)) continue;
          }
          if (has_lab_results === 'true') {
            const labCount = await db.prisma.labResult.count({ where: { visitId: v.id } });
            if (labCount === 0) continue;
          }
          if (has_prescriptions === 'true') {
            const prescCount = await db.prisma.pharmacyPrescription.count({ where: { visitId: v.id } });
            if (prescCount === 0) continue;
          }
          if (has_diagnoses === 'true') {
            const diagCount = await db.prisma.diagnosis.count({ where: { visitId: v.id } });
            if (diagCount === 0) continue;
          }
          filteredVisits.push(v);
        }
        visits = filteredVisits;
      }
      
      visits = visits.map(v => ({
        ...v,
        patient_name: v.patient?.name || null,
        national_id: v.patient?.nationalId || null,
        age: v.patient?.age || null,
        gender: v.patient?.gender || null,
        phone: v.patient?.phone || null,
        created_by_name: v.creator?.name || null
      }));
      
      // Get total count
      const countWhere = { ...where };
      if (patient_category || gender || blood_type) {
        // For complex filters, we need to count after filtering
        total = visits.length;
      } else {
        total = await db.prisma.visit.count({ where: countWhere });
      }
    } else {
      const { allQuery, getQuery } = require('../database/db');
      visits = await allQuery(query, params);

      // Get total count for pagination
      let countQuery = `
        SELECT COUNT(*) as total
        FROM visits v
        LEFT JOIN patients p ON v.patient_id = p.id
        WHERE 1=1
      `;
      const countParams = [];

      if (patient_id) {
        countQuery += ' AND v.patient_id = ?';
        countParams.push(patient_id);
      }
      if (visit_id) {
        countQuery += ' AND v.id = ?';
        countParams.push(visit_id);
      }
      if (patient_category) {
        countQuery += ' AND p.category = ?';
        countParams.push(patient_category);
      }
      if (gender) {
        countQuery += ' AND p.gender = ?';
        countParams.push(gender);
      }
      if (blood_type) {
        countQuery += ' AND p.blood_type = ?';
        countParams.push(blood_type);
      }
      if (date_from) {
        countQuery += ' AND DATE(v.created_at) >= ?';
        countParams.push(date_from);
      }
      if (date_to) {
        countQuery += ' AND DATE(v.created_at) <= ?';
        countParams.push(date_to);
      }
      if (status) {
        countQuery += ' AND v.status = ?';
        countParams.push(status);
      }
      if (has_lab_results === 'true') {
        countQuery += ' AND EXISTS (SELECT 1 FROM lab_results WHERE visit_id = v.id)';
      }
      if (has_prescriptions === 'true') {
        countQuery += ' AND EXISTS (SELECT 1 FROM pharmacy_prescriptions WHERE visit_id = v.id)';
      }
      if (has_diagnoses === 'true') {
        countQuery += ' AND EXISTS (SELECT 1 FROM diagnoses WHERE visit_id = v.id)';
      }
      if (search) {
        countQuery += ' AND (p.name LIKE ? OR p.national_id LIKE ? OR v.visit_number LIKE ?)';
        const searchTerm = `%${search}%`;
        countParams.push(searchTerm, searchTerm, searchTerm);
      }

      const countResult = await getQuery(countQuery, countParams);
      total = countResult.total;
    }

    res.json({
      visits,
      total,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    logger.error('Error fetching medical reports:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب التقارير الطبية' });
  }
});

// Export reports to Excel
router.get('/export/excel', authenticateToken, requireRole('doctor', 'admin'), async (req, res) => {
  try {
    const {
      patient_id,
      visit_id,
      date_from,
      date_to,
      status,
      search
    } = req.query;

    let query = `
      SELECT 
        v.*,
        p.name as patient_name,
        p.national_id,
        p.age,
        p.gender,
        p.phone,
        u.name as created_by_name
      FROM visits v
      LEFT JOIN patients p ON v.patient_id = p.id
      LEFT JOIN users u ON v.created_by = u.id
      WHERE 1=1
    `;
    const params = [];

    if (patient_id) {
      query += ' AND v.patient_id = ?';
      params.push(patient_id);
    }

    if (visit_id) {
      query += ' AND v.id = ?';
      params.push(visit_id);
    }

    if (date_from) {
      query += ' AND DATE(v.created_at) >= ?';
      params.push(date_from);
    }

    if (date_to) {
      query += ' AND DATE(v.created_at) <= ?';
      params.push(date_to);
    }

    if (status) {
      query += ' AND v.status = ?';
      params.push(status);
    }

    if (search) {
      query += ' AND (p.name LIKE ? OR p.national_id LIKE ? OR v.visit_number LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    query += ' ORDER BY v.created_at DESC';

    let visits;
    if (db.prisma) {
      const where = {};
      if (patient_id) where.patientId = parseInt(patient_id);
      if (visit_id) where.id = parseInt(visit_id);
      if (status) where.status = status;
      if (date_from || date_to) {
        where.createdAt = {};
        if (date_from) where.createdAt.gte = new Date(date_from);
        if (date_to) where.createdAt.lte = new Date(date_to);
      }
      
      visits = await db.prisma.visit.findMany({
        where,
        include: {
          patient: true,
          creator: true
        },
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit),
        skip: parseInt(offset)
      });
      
      // Apply additional filters
      if (patient_category || gender || blood_type || search || has_lab_results === 'true' || has_prescriptions === 'true' || has_diagnoses === 'true') {
        visits = visits.filter(v => {
          if (patient_category && v.patient?.patientCategory !== patient_category) return false;
          if (gender && v.patient?.gender !== gender) return false;
          if (blood_type && v.patient?.bloodType !== blood_type) return false;
          if (search) {
            const searchLower = search.toLowerCase();
            if (!v.patient?.name?.toLowerCase().includes(searchLower) &&
                !v.patient?.nationalId?.toLowerCase().includes(searchLower) &&
                !v.visitNumber?.toLowerCase().includes(searchLower)) return false;
          }
          // Note: has_lab_results, has_prescriptions, has_diagnoses would need additional queries
          return true;
        });
      }
      
      visits = visits.map(v => ({
        ...v,
        patient_name: v.patient?.name || null,
        national_id: v.patient?.nationalId || null,
        age: v.patient?.age || null,
        gender: v.patient?.gender || null,
        phone: v.patient?.phone || null,
        created_by_name: v.creator?.name || null
      }));
    } else {
      const { allQuery } = require('../database/db');
      visits = await allQuery(query, params);
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Medical Reports');

    worksheet.columns = [
      { header: 'Visit Number', key: 'visit_number', width: 15 },
      { header: 'Patient Name', key: 'patient_name', width: 30 },
      { header: 'National ID', key: 'national_id', width: 15 },
      { header: 'Age', key: 'age', width: 10 },
      { header: 'Gender', key: 'gender', width: 10 },
      { header: 'Phone', key: 'phone', width: 15 },
      { header: 'Status', key: 'status', width: 20 },
      { header: 'Visit Date', key: 'created_at', width: 20 },
      { header: 'Created By', key: 'created_by_name', width: 20 }
    ];

    visits.forEach(visit => {
      worksheet.addRow({
        visit_number: visit.visit_number,
        patient_name: visit.patient_name,
        national_id: visit.national_id,
        age: visit.age,
        gender: visit.gender,
        phone: visit.phone,
        status: visit.status,
        created_at: visit.created_at ? new Date(visit.created_at).toISOString().split('T')[0] : '',
        created_by_name: visit.created_by_name
      });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=medical-reports-${new Date().toISOString().split('T')[0]}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    logger.error('Error exporting reports to Excel:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء تصدير التقارير' });
  }
});

// Helper function to get Arabic fonts for pdfmake (second instance - should match first)
function getPdfMakeFonts() {
  const fontPath = path.join(__dirname, '../fonts/Cairo-Regular.ttf');
  
  // pdfmake requires fonts to be organized by font family name
  const fonts = {
    Arabic: {
      normal: null,
      bold: null,
      italics: null,
      bolditalics: null
    }
  };
  
  // Check if font exists, read it as buffer
  if (fs.existsSync(fontPath)) {
    try {
      const fontBuffer = fs.readFileSync(fontPath);
      // Use the same font buffer for all styles (Cairo-Regular supports all)
      fonts.Arabic.normal = fontBuffer;
      fonts.Arabic.bold = fontBuffer;
      fonts.Arabic.italics = fontBuffer;
      fonts.Arabic.bolditalics = fontBuffer;
      logger.info('Arabic font loaded successfully');
    } catch (err) {
      logger.warn(`Failed to read font ${fontPath}:`, err.message);
      // Fallback to default fonts
      return null;
    }
  } else {
    logger.warn(`Font not found: ${fontPath}, will use default fonts`);
    return null;
  }

  return fonts;
}

// Generate comprehensive patient report PDF using pdfmake (supports RTL and Arabic)
router.get('/patient/:patientId/pdf', authenticateToken, requireRole('doctor', 'admin', 'inquiry'), async (req, res) => {
  try {
    const { patientId } = req.params;
    logger.info(`Generating comprehensive PDF report for patient ${patientId} using pdfmake`);

    // Get patient data
    let patient;
    if (db.prisma) {
      patient = await db.prisma.patient.findUnique({
        where: { id: parseInt(patientId) },
        include: { creator: true }
      });
      
      if (!patient) {
        return res.status(404).json({ error: 'المريض غير موجود' });
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
      return res.status(404).json({ error: 'المريض غير موجود' });
    }

    // Get all visits for this patient
    let visits;
    if (db.prisma) {
      visits = await db.prisma.visit.findMany({
        where: { patientId: parseInt(patientId) },
        include: { creator: true },
        orderBy: { createdAt: 'desc' }
      });
      
      visits = visits.map(v => ({
        ...v,
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

    // Get all lab results, prescriptions, and diagnoses grouped by visit
    const labResultsMap = {};
    const prescriptionsMap = {};
    const diagnosesMap = {};

    for (const visit of visits) {
      let results, prescriptions, diagnoses;
      
      if (db.prisma) {
        results = await db.prisma.labResult.findMany({
          where: { visitId: visit.id },
          include: { creator: true },
          orderBy: { createdAt: 'desc' }
        });
        
        results = results.map(r => ({
          ...r,
          created_by_name: r.creator?.name || null
        }));
        
        prescriptions = await db.prisma.pharmacyPrescription.findMany({
          where: { visitId: visit.id },
          include: { creator: true },
          orderBy: { createdAt: 'desc' }
        });
        
        prescriptions = prescriptions.map(p => ({
          ...p,
          created_by_name: p.creator?.name || null
        }));
        
        diagnoses = await db.prisma.diagnosis.findMany({
          where: { visitId: visit.id },
          include: { creator: true },
          orderBy: { createdAt: 'desc' }
        });
        
        diagnoses = diagnoses.map(d => ({
          ...d,
          doctor_name: d.creator?.name || null
        }));
      } else {
        const { allQuery } = require('../database/db');
        results = await allQuery(
          `SELECT lr.*, u.name as created_by_name
           FROM lab_results lr
           LEFT JOIN users u ON lr.created_by = u.id
           WHERE lr.visit_id = ?
           ORDER BY lr.created_at DESC`,
          [visit.id]
        );
        
        prescriptions = await allQuery(
          `SELECT pp.*, u.name as created_by_name
           FROM pharmacy_prescriptions pp
           LEFT JOIN users u ON pp.created_by = u.id
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
      }
      
      if (results.length > 0) {
        labResultsMap[visit.id] = results;
      }

      if (prescriptions.length > 0) {
        prescriptionsMap[visit.id] = prescriptions;
      }

      if (diagnoses.length > 0) {
        diagnosesMap[visit.id] = diagnoses;
      }
    }

    logger.info(`Found ${visits.length} visits for patient ${patientId}`);

    // Get fonts - ensure all font types are defined
    let fonts;
    let printer;
    let defaultFontName = 'Roboto'; // pdfmake default font
    
    try {
      const customFonts = getPdfMakeFonts();
      if (customFonts) {
        fonts = customFonts;
        defaultFontName = 'Arabic'; // Use Arabic font if available
        printer = new PdfPrinter(fonts);
        logger.info('Using Arabic fonts for PDF generation');
      } else {
        // Use default Roboto fonts (pdfmake built-in)
        fonts = {};
        printer = new PdfPrinter(fonts);
        defaultFontName = 'Roboto';
        logger.warn('Using default Roboto fonts (Arabic may not render perfectly)');
      }
    } catch (fontError) {
      logger.error('Error initializing pdfmake fonts:', fontError);
      // Use default fonts
      fonts = {};
      printer = new PdfPrinter(fonts);
      defaultFontName = 'Roboto';
      logger.warn('Using default fonts due to font initialization error');
    }

    // Build PDF document definition with RTL support
    const currentDate = new Date();
    const dateStr = currentDate.toISOString().split('T')[0];

    const docDefinition = {
      pageSize: 'A4',
      pageMargins: [40, 60, 40, 60],
      defaultStyle: {
        font: defaultFontName,
        fontSize: 10,
        alignment: 'right',
        direction: 'rtl',
      },
      content: [
        // Header
        {
          stack: [
            {
              text: 'مستشفى الحكيم',
              fontSize: 20,
              color: '#1890ff',
              bold: true,
              alignment: 'center',
              margin: [0, 0, 0, 5],
            },
            {
              text: 'شعبة الكلية الصناعية',
              fontSize: 14,
              color: '#666666',
              alignment: 'center',
              margin: [0, 0, 0, 5],
            },
            {
              text: 'التقرير الطبي الشامل',
              fontSize: 16,
              color: '#000000',
              bold: true,
              alignment: 'center',
              margin: [0, 0, 0, 20],
            },
          ],
        },
        // Report Date and Document Number
        {
          stack: [
            {
              text: `تاريخ التقرير: ${dateStr}`,
              fontSize: 10,
              color: '#666666',
              alignment: 'right',
            },
            {
              text: `رقم الوثيقة: ${patient.national_id || patient.id}`,
              fontSize: 10,
              color: '#666666',
              alignment: 'right',
              margin: [0, 5, 0, 0],
            },
          ],
          margin: [0, 0, 0, 15],
        },
        { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: '#cccccc' }], margin: [0, 10, 0, 20] },
        
        // Patient Information
        {
          text: 'معلومات المريض',
          fontSize: 14,
          color: '#1890ff',
          bold: true,
          margin: [0, 0, 0, 15],
        },
        {
          table: {
            widths: ['*', '*'],
            body: [
              [
                {
                  stack: [
                    { text: `الاسم: ${patient.name || 'غير محدد'}`, margin: [0, 0, 0, 8] },
                    { text: `رقم الهوية: ${patient.national_id || 'غير محدد'}`, margin: [0, 0, 0, 8] },
                    { text: `تاريخ الميلاد: ${patient.date_of_birth ? new Date(patient.date_of_birth).toISOString().split('T')[0] : 'غير محدد'}`, margin: [0, 0, 0, 8] },
                    { text: `العمر: ${patient.age || 'غير محدد'}`, margin: [0, 0, 0, 8] },
                    { text: `الجنس: ${patient.gender || 'غير محدد'}`, margin: [0, 0, 0, 8] },
                    { text: `فصيلة الدم: ${patient.blood_type || 'غير محدد'}`, margin: [0, 0, 0, 8] },
                    { text: `الفئة: ${patient.patient_category || patient.category || 'غير محدد'}`, margin: [0, 0, 0, 0] },
                  ],
                  border: [false, false, false, false],
                },
                {
                  stack: [
                    { text: `الهاتف: ${patient.phone || 'غير محدد'}`, margin: [0, 0, 0, 8] },
                    { text: `الجوال: ${patient.mobile || 'غير محدد'}`, margin: [0, 0, 0, 8] },
                    { text: `البريد الإلكتروني: ${patient.email || 'غير محدد'}`, margin: [0, 0, 0, 8] },
                    { text: `العنوان: ${patient.address || 'غير محدد'}`, margin: [0, 0, 0, 8] },
                    { text: `المدينة: ${patient.city || 'غير محدد'}`, margin: [0, 0, 0, 8] },
                    { text: `تاريخ التسجيل: ${patient.created_at ? new Date(patient.created_at).toISOString().split('T')[0] : 'غير محدد'}`, margin: [0, 0, 0, 0] },
                  ],
                  border: [false, false, false, false],
                },
              ],
            ],
          },
          layout: {
            paddingLeft: () => 10,
            paddingRight: () => 10,
            paddingTop: () => 10,
            paddingBottom: () => 10,
          },
          margin: [0, 0, 0, 20],
        },

        // Medical History
        ...(patient.medical_history || patient.allergies || patient.chronic_diseases || patient.current_medications
          ? [
              {
                text: 'السجل الطبي',
                fontSize: 14,
                color: '#1890ff',
                bold: true,
                margin: [0, 0, 0, 15],
              },
              {
                stack: [
                  ...(patient.allergies ? [{ text: `الحساسية: ${patient.allergies}`, margin: [0, 0, 0, 10] }] : []),
                  ...(patient.chronic_diseases ? [{ text: `الأمراض المزمنة: ${patient.chronic_diseases}`, margin: [0, 0, 0, 10] }] : []),
                  ...(patient.medical_history ? [{ text: `التاريخ الطبي: ${patient.medical_history}`, margin: [0, 0, 0, 10] }] : []),
                  ...(patient.current_medications ? [{ text: `الأدوية الحالية: ${patient.current_medications}`, margin: [0, 0, 0, 0] }] : []),
                ],
                margin: [0, 0, 0, 20],
              },
            ]
          : []),

        // Emergency Contact
        ...(patient.emergency_contact_name
          ? [
              {
                text: 'جهة الاتصال للطوارئ',
                fontSize: 14,
                color: '#1890ff',
                bold: true,
                margin: [0, 0, 0, 15],
              },
              {
                stack: [
                  { text: `الاسم: ${patient.emergency_contact_name}`, margin: [0, 0, 0, 10] },
                  { text: `الهاتف: ${patient.emergency_contact_phone || 'غير محدد'}`, margin: [0, 0, 0, 10] },
                  { text: `العلاقة: ${patient.emergency_contact_relation || 'غير محدد'}`, margin: [0, 0, 0, 0] },
                ],
                margin: [0, 0, 0, 20],
              },
            ]
          : []),

        // Statistics
        {
          text: 'الإحصائيات',
          fontSize: 14,
          color: '#1890ff',
          bold: true,
          margin: [0, 0, 0, 15],
        },
        {
          stack: [
            { text: `إجمالي الزيارات: ${visits.length}`, margin: [0, 0, 0, 10] },
            { text: `الزيارات المكتملة: ${visits.filter(v => v.status === 'completed').length}`, margin: [0, 0, 0, 10] },
            {
              text: `أول زيارة: ${visits.length > 0 && visits[visits.length - 1].created_at ? new Date(visits[visits.length - 1].created_at).toISOString().split('T')[0] : 'غير محدد'}`,
              margin: [0, 0, 0, 10],
            },
            {
              text: `آخر زيارة: ${visits.length > 0 && visits[0].created_at ? new Date(visits[0].created_at).toISOString().split('T')[0] : 'غير محدد'}`,
              margin: [0, 0, 0, 0],
            },
          ],
          margin: [0, 0, 0, 30],
        },

        // Visits Details
        ...(visits.length > 0
          ? [
              {
                text: 'تفاصيل الزيارات',
                fontSize: 14,
                color: '#1890ff',
                bold: true,
                margin: [0, 0, 0, 20],
              },
              ...visits.flatMap((visit, index) => {
                const visitContent = [
                  {
                    text: `الزيارة رقم ${index + 1}`,
                    fontSize: 12,
                    color: '#1890ff',
                    bold: true,
                    margin: [0, 0, 0, 10],
                  },
                  {
                    table: {
                      widths: ['*', '*'],
                      body: [
                        [
                          {
                            stack: [
                              {
                                text: `تاريخ الزيارة: ${visit.created_at ? new Date(visit.created_at).toISOString().split('T')[0] : 'غير محدد'}`,
                                margin: [0, 0, 0, 8],
                              },
                              {
                                text: `الحالة: ${visit.status === 'completed' ? 'مكتملة' : 'قيد المعالجة'}`,
                                margin: [0, 0, 0, 8],
                              },
                              { text: `أنشئت بواسطة: ${visit.created_by_name || 'غير محدد'}`, margin: [0, 0, 0, 0] },
                            ],
                            border: [false, false, false, false],
                          },
                          {
                            stack: [
                              {
                                text: `المختبر: ${visit.lab_completed === 1 || visit.lab_completed === '1' ? 'مكتمل' : 'معلق'}`,
                                margin: [0, 0, 0, 8],
                              },
                              {
                                text: `الصيدلية: ${visit.pharmacy_completed === 1 || visit.pharmacy_completed === '1' ? 'مكتملة' : 'معلقة'}`,
                                margin: [0, 0, 0, 8],
                              },
                              {
                                text: `الطبيب: ${visit.doctor_completed === 1 || visit.doctor_completed === '1' ? 'مكتمل' : 'معلق'}`,
                                margin: [0, 0, 0, 0],
                              },
                            ],
                            border: [false, false, false, false],
                          },
                        ],
                      ],
                    },
                    layout: 'noBorders',
                    margin: [0, 0, 0, 15],
                  },
                ];

                // Lab Results
                if (labResultsMap[visit.id] && labResultsMap[visit.id].length > 0) {
                  visitContent.push({
                    text: 'نتائج التحاليل',
                    fontSize: 12,
                    color: '#fa8c16',
                    bold: true,
                    margin: [0, 10, 0, 10],
                  });
                  visitContent.push({
                    table: {
                      headerRows: 1,
                      widths: [120, 100, 70, 100, 75],
                      body: [
                        [
                          { text: 'اسم التحليل', fillColor: '#fa8c16', color: '#ffffff', bold: true, alignment: 'right' },
                          { text: 'النتيجة', fillColor: '#fa8c16', color: '#ffffff', bold: true, alignment: 'right' },
                          { text: 'الوحدة', fillColor: '#fa8c16', color: '#ffffff', bold: true, alignment: 'right' },
                          { text: 'المدى الطبيعي', fillColor: '#fa8c16', color: '#ffffff', bold: true, alignment: 'right' },
                          { text: 'التاريخ', fillColor: '#fa8c16', color: '#ffffff', bold: true, alignment: 'right' },
                        ],
                        ...labResultsMap[visit.id].map((result) => [
                          { text: result.test_name || 'غير محدد', alignment: 'right' },
                          { text: result.result || 'غير محدد', alignment: 'right' },
                          { text: result.unit || '-', alignment: 'right' },
                          { text: result.normal_range || '-', alignment: 'right' },
                          {
                            text: result.created_at ? new Date(result.created_at).toISOString().split('T')[0] : 'غير محدد',
                            alignment: 'right',
                          },
                        ]),
                      ],
                    },
                    margin: [0, 0, 0, 15],
                  });
                }

                // Prescriptions
                if (prescriptionsMap[visit.id] && prescriptionsMap[visit.id].length > 0) {
                  visitContent.push({
                    text: 'الأدوية المصروفة',
                    fontSize: 12,
                    color: '#1890ff',
                    bold: true,
                    margin: [0, 10, 0, 10],
                  });
                  visitContent.push({
                    table: {
                      headerRows: 1,
                      widths: [250, 120, 70, 75],
                      body: [
                        [
                          { text: 'الدواء', fillColor: '#1890ff', color: '#ffffff', bold: true, alignment: 'right' },
                          { text: 'الجرعة', fillColor: '#1890ff', color: '#ffffff', bold: true, alignment: 'right' },
                          { text: 'الكمية', fillColor: '#1890ff', color: '#ffffff', bold: true, alignment: 'right' },
                          { text: 'التاريخ', fillColor: '#1890ff', color: '#ffffff', bold: true, alignment: 'right' },
                        ],
                        ...prescriptionsMap[visit.id].map((prescription) => [
                          { text: prescription.medication_name || 'غير محدد', alignment: 'right' },
                          { text: prescription.dosage || '-', alignment: 'right' },
                          { text: prescription.quantity ? prescription.quantity.toString() : '-', alignment: 'right' },
                          {
                            text: prescription.created_at ? new Date(prescription.created_at).toISOString().split('T')[0] : 'غير محدد',
                            alignment: 'right',
                          },
                        ]),
                      ],
                    },
                    margin: [0, 0, 0, 15],
                  });
                }

                // Diagnoses
                if (diagnosesMap[visit.id] && diagnosesMap[visit.id].length > 0) {
                  visitContent.push({
                    text: 'التشخيص',
                    fontSize: 12,
                    color: '#722ed1',
                    bold: true,
                    margin: [0, 10, 0, 10],
                  });
                  visitContent.push(
                    ...diagnosesMap[visit.id].map((diagnosis, idx) => ({
                      stack: [
                        {
                          text: `${idx + 1}. ${diagnosis.diagnosis || 'غير محدد'}`,
                          fontSize: 10,
                          color: '#722ed1',
                          bold: true,
                          margin: [0, 0, 0, 8],
                        },
                        ...(diagnosis.notes ? [{ text: `ملاحظات: ${diagnosis.notes}`, margin: [0, 0, 0, 8] }] : []),
                        {
                          text: `الطبيب: ${diagnosis.doctor_name || 'غير محدد'} | التاريخ: ${diagnosis.created_at ? new Date(diagnosis.created_at).toISOString().split('T')[0] : 'غير محدد'}`,
                          fontSize: 8,
                          margin: [0, 0, 0, 0],
                        },
                      ],
                      margin: [0, 0, 0, 15],
                    }))
                  );
                }

                return visitContent;
              }),
            ]
          : []),

        // Footer
        { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: '#cccccc' }], margin: [0, 20, 0, 15] },
        {
          stack: [
            {
              text: `تاريخ إنشاء التقرير: ${new Date().toISOString().split('T')[0]}`,
              fontSize: 9,
              color: '#666666',
              alignment: 'right',
            },
            {
              text: 'هذا وثيقة رسمية',
              fontSize: 9,
              color: '#666666',
              alignment: 'right',
              margin: [0, 5, 0, 0],
            },
            {
              text: 'مستشفى الحكيم - شعبة الكلية الصناعية',
              fontSize: 10,
              color: '#1890ff',
              alignment: 'center',
              margin: [0, 10, 0, 0],
            },
            {
              text: 'يمكن استخدام هذا المستند كسجل طبي رسمي',
              fontSize: 9,
              color: '#666666',
              alignment: 'center',
              margin: [0, 5, 0, 0],
            },
          ],
        },
      ],
    };

    // Set response headers BEFORE generating PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=Medical-Report-${patient.national_id || patientId || 'patient'}-${new Date().toISOString().split('T')[0]}.pdf`
    );
    res.setHeader('Cache-Control', 'no-cache');

    // Generate PDF
    let pdfDoc;
    try {
      pdfDoc = printer.createPdfKitDocument(docDefinition);
      
      // Handle PDF stream errors
      pdfDoc.on('error', (err) => {
        logger.error('PDF stream error:', err);
        if (!res.headersSent) {
          res.status(500).json({ error: 'حدث خطأ أثناء إنشاء PDF', details: err.message });
        } else {
          res.end();
        }
      });
      
      // Pipe PDF to response
      pdfDoc.pipe(res);
      pdfDoc.end();
    } catch (pdfError) {
      logger.error('Error creating PDF document:', pdfError);
      if (!res.headersSent) {
        res.status(500).json({ 
          error: 'حدث خطأ أثناء إنشاء PDF',
          details: pdfError.message || 'Unknown error'
        });
      } else {
        res.end();
      }
      return;
    }

    logger.info(`PDF generated successfully for patient ${patientId} using pdfmake`);
    
  } catch (error) {
    logger.error('Error generating patient report PDF:', error);
    logger.error('Error details:', {
      message: error.message,
      stack: error.stack,
      patientId: req.params.patientId
    });
    
    // If response headers are already sent (PDF started), end the stream
    if (res.headersSent) {
      logger.warn('Response headers already sent, ending stream');
      res.end();
      return;
    }
    
    // Otherwise, send error as JSON
    res.status(500).json({ 
      error: 'حدث خطأ أثناء إنشاء التقرير / Error generating report',
      details: error.message || 'Unknown error',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

module.exports = router;
