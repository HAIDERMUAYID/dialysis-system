const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticateToken, requireRole } = require('../middleware/auth');
const db = require('../database/db');
const logger = require('../utils/logger');

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const visitId = req.body.visit_id || req.params.visitId;
    const deptDir = path.join(uploadsDir, `visit-${visitId}`);
    if (!fs.existsSync(deptDir)) {
      fs.mkdirSync(deptDir, { recursive: true });
    }
    cb(null, deptDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  },
  fileFilter: (req, file, cb) => {
    // Allow images, PDFs, and documents
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|xls|xlsx/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('نوع الملف غير مدعوم. يُسمح فقط بالصور و PDF والوثائق'));
    }
  }
});

// Get attachments for a visit/department
router.get('/visit/:visitId', authenticateToken, async (req, res) => {
  try {
    const { department, entity_type, entity_id } = req.query;
    
    if (db.prisma) {
      const where = { visitId: parseInt(req.params.visitId) };
      if (department) where.department = department;
      if (entity_type) where.entityType = entity_type;
      if (entity_id) where.entityId = parseInt(entity_id);
      
      const attachments = await db.prisma.visitAttachment.findMany({
        where,
        include: { uploader: true },
        orderBy: { createdAt: 'desc' }
      });
      
      const attachmentsWithCreator = attachments.map(a => ({
        ...a,
        uploaded_by_name: a.uploader?.name || null
      }));
      
      res.json(attachmentsWithCreator);
    } else {
      const { allQuery } = require('../database/db');
      let query = `
        SELECT va.*, u.name as uploaded_by_name
        FROM visit_attachments va
        LEFT JOIN users u ON va.uploaded_by = u.id
        WHERE va.visit_id = ?
      `;
      const params = [req.params.visitId];

      if (department) {
        query += ' AND va.department = ?';
        params.push(department);
      }
      if (entity_type) {
        query += ' AND va.entity_type = ?';
        params.push(entity_type);
      }
      if (entity_id) {
        query += ' AND va.entity_id = ?';
        params.push(entity_id);
      }

      query += ' ORDER BY va.created_at DESC';
      const attachments = await allQuery(query, params);
      res.json(attachments);
    }
  } catch (error) {
    logger.error('Error fetching attachments:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب المرفقات' });
  }
});

// Upload attachment
router.post('/', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'يرجى اختيار ملف للرفع' });
    }

    const { visit_id, department, entity_type, entity_id, description } = req.body;

    if (!visit_id || !department) {
      return res.status(400).json({ error: 'رقم الزيارة والقسم مطلوبان' });
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
      // Delete uploaded file if visit doesn't exist
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ error: 'الزيارة غير موجودة' });
    }

    // Check department permission - users can upload files for their own department
    const deptMap = {
      'lab': 'lab',
      'pharmacist': 'pharmacy',
      'doctor': 'doctor',
      'inquiry': 'inquiry',
      'admin': 'inquiry' // Admin defaults to inquiry but can upload for any
    };

    const userDept = req.user.role;
    const userDeptName = deptMap[userDept] || 'inquiry';
    
    // Allow users to upload for their own department, or admin can upload for any
    if (userDept !== 'admin' && userDeptName !== department) {
      fs.unlinkSync(req.file.path);
      return res.status(403).json({ error: 'ليس لديك صلاحية لرفع ملفات لهذا القسم' });
    }

    // Store relative path from project root
    const relativePath = path.relative(path.join(__dirname, '../..'), req.file.path);
    
    let attachment;
    if (db.prisma) {
      attachment = await db.prisma.visitAttachment.create({
        data: {
          visitId: parseInt(visit_id),
          department,
          entityType: entity_type || null,
          entityId: entity_id ? parseInt(entity_id) : null,
          filename: req.file.filename,
          originalFilename: req.file.originalname,
          filePath: relativePath,
          fileSize: req.file.size,
          mimeType: req.file.mimetype,
          uploadedBy: req.user.id,
          description: description || null
        },
        include: { creator: true }
      });
      
      attachment = {
        ...attachment,
        uploaded_by_name: attachment.creator?.name || null
      };
    } else {
      const { runQuery, getQuery } = require('../database/db');
      const result = await runQuery(
        `INSERT INTO visit_attachments 
         (visit_id, department, entity_type, entity_id, filename, original_filename, file_path, file_size, mime_type, uploaded_by, description)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          visit_id,
          department,
          entity_type || null,
          entity_id || null,
          req.file.filename,
          req.file.originalname,
          relativePath,
          req.file.size,
          req.file.mimetype,
          req.user.id,
          description || null
        ]
      );

      attachment = await getQuery(
        `SELECT va.*, u.name as uploaded_by_name
         FROM visit_attachments va
         LEFT JOIN users u ON va.uploaded_by = u.id
         WHERE va.id = ?`,
        [result.lastID]
      );
    }

    logger.info(`Attachment uploaded: ${req.file.originalname} for visit ${visit_id} by ${req.user.name}`);
    res.status(201).json(attachment);
  } catch (error) {
    logger.error('Error uploading attachment:', error);
    // Delete file if error occurred
    if (req.file && req.file.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (unlinkError) {
        logger.error('Error deleting file:', unlinkError);
      }
    }
    res.status(500).json({ error: error.message || 'حدث خطأ أثناء رفع الملف' });
  }
});

// Download attachment
router.get('/:id/download', authenticateToken, async (req, res) => {
  try {
    let attachment;
    if (db.prisma) {
      attachment = await db.prisma.visitAttachment.findUnique({
        where: { id: parseInt(req.params.id) }
      });
    } else {
      const { getQuery } = require('../database/db');
      attachment = await getQuery('SELECT * FROM visit_attachments WHERE id = ?', [req.params.id]);
    }
    
    if (!attachment) {
      return res.status(404).json({ error: 'المرفق غير موجود' });
    }

    // Get file path and metadata
    const originalFilename = attachment.originalFilename || attachment.original_filename;
    const mimeType = attachment.mimeType || attachment.mime_type;
    const filePath = attachment.filePath || attachment.file_path;
    
    // Resolve full path
    const fullPath = path.isAbsolute(filePath) 
      ? filePath 
      : path.join(__dirname, '../..', filePath);
    
    // Check if file exists
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: 'الملف غير موجود على الخادم' });
    }

    // All authenticated users can download attachments for their visits
    // No additional permission check needed

    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(originalFilename)}"`);
    res.setHeader('Content-Type', mimeType || 'application/octet-stream');
    
    res.sendFile(path.resolve(fullPath));
  } catch (error) {
    logger.error('Error downloading attachment:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء تحميل الملف' });
  }
});

// Delete attachment
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    let attachment;
    if (db.prisma) {
      attachment = await db.prisma.visitAttachment.findUnique({
        where: { id: parseInt(req.params.id) }
      });
    } else {
      const { getQuery } = require('../database/db');
      attachment = await getQuery('SELECT * FROM visit_attachments WHERE id = ?', [req.params.id]);
    }
    
    if (!attachment) {
      return res.status(404).json({ error: 'المرفق غير موجود' });
    }

    // Check permission - uploader, same department, or admin can delete
    const deptMap = {
      'lab': 'lab',
      'pharmacist': 'pharmacy',
      'doctor': 'doctor',
      'inquiry': 'inquiry',
      'admin': ''
    };
    
    const userDept = deptMap[req.user.role] || '';
    const uploadedBy = attachment.uploadedBy || attachment.uploaded_by;
    const department = attachment.department;
    const canDelete = 
      uploadedBy === req.user.id || 
      req.user.role === 'admin' || 
      (userDept && department === userDept);
    
    if (!canDelete) {
      return res.status(403).json({ error: 'ليس لديك صلاحية لحذف هذا الملف' });
    }

    // Delete file from disk
    const filePath = attachment.filePath || attachment.file_path;
    const fullPath = path.isAbsolute(filePath) 
      ? filePath 
      : path.join(__dirname, '../..', filePath);
    
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }

    // Delete from database
    if (db.prisma) {
      await db.prisma.visitAttachment.delete({
        where: { id: parseInt(req.params.id) }
      });
    } else {
      const { runQuery } = require('../database/db');
      await runQuery('DELETE FROM visit_attachments WHERE id = ?', [req.params.id]);
    }

    const originalFilename = attachment.originalFilename || attachment.original_filename;
    logger.info(`Attachment deleted: ${originalFilename} by ${req.user.name}`);
    res.json({ message: 'تم حذف المرفق بنجاح' });
  } catch (error) {
    logger.error('Error deleting attachment:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء حذف المرفق' });
  }
});

module.exports = router;
