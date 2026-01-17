const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/auth');
const BackupService = require('../services/backup');
const logger = require('../utils/logger');

const backupService = new BackupService();

// Create full backup
router.post('/full', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const backup = await backupService.createFullBackup(req.user.id);
    res.status(201).json({
      message: 'تم إنشاء النسخة الاحتياطية بنجاح',
      backup
    });
  } catch (error) {
    logger.error('Error creating full backup:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء إنشاء النسخة الاحتياطية' });
  }
});

// Create incremental backup
router.post('/incremental', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const backup = await backupService.createIncrementalBackup(req.user.id);
    res.status(201).json({
      message: 'تم إنشاء النسخة الاحتياطية التدريجية بنجاح',
      backup
    });
  } catch (error) {
    logger.error('Error creating incremental backup:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء إنشاء النسخة الاحتياطية التدريجية' });
  }
});

// Create archive backup
router.post('/archive', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const backup = await backupService.createArchiveBackup(req.user.id);
    res.status(201).json({
      message: 'تم إنشاء النسخة الاحتياطية المضغوطة بنجاح',
      backup
    });
  } catch (error) {
    logger.error('Error creating archive backup:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء إنشاء النسخة الاحتياطية المضغوطة' });
  }
});

// List all backups
router.get('/', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    const backups = await backupService.listBackups(parseInt(limit));
    res.json(backups);
  } catch (error) {
    logger.error('Error listing backups:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب النسخ الاحتياطية' });
  }
});

// Get backup statistics
router.get('/stats', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const stats = await backupService.getBackupStats();
    res.json(stats);
  } catch (error) {
    logger.error('Error getting backup stats:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب إحصائيات النسخ الاحتياطية' });
  }
});

// Restore from backup
router.post('/restore/:backupId', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { backupId } = req.params;
    const result = await backupService.restoreBackup(backupId, req.user.id);
    res.json({
      message: 'تم استعادة النسخة الاحتياطية بنجاح',
      ...result
    });
  } catch (error) {
    logger.error('Error restoring backup:', error);
    res.status(500).json({ error: error.message || 'حدث خطأ أثناء استعادة النسخة الاحتياطية' });
  }
});

// Cleanup old backups
router.post('/cleanup', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { daysOld = 30 } = req.body;
    const result = await backupService.cleanupOldBackups(daysOld);
    res.json({
      message: `تم حذف ${result.deletedCount} نسخة احتياطية قديمة`,
      ...result
    });
  } catch (error) {
    logger.error('Error cleaning up backups:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء تنظيف النسخ الاحتياطية القديمة' });
  }
});

module.exports = router;
