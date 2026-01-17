const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/auth');
const db = require('../database/db');

// Get lab results for a visit
router.get('/visit/:visitId', authenticateToken, async (req, res) => {
  try {
    let results;
    
    if (db.prisma) {
      results = await db.prisma.labResult.findMany({
        where: { visitId: parseInt(req.params.visitId) },
        include: { testCatalog: true, creator: true },
        orderBy: { createdAt: 'desc' }
      });
      
      results = results.map(r => ({
        ...r,
        created_by_name: r.creator?.name || null
      }));
    } else {
      const { allQuery } = require('../database/db');
      results = await allQuery(
        'SELECT * FROM lab_results WHERE visit_id = ? ORDER BY created_at DESC',
        [req.params.visitId]
      );
    }
    
    res.json(results);
  } catch (error) {
    console.error('Error fetching lab results:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب نتائج التحاليل' });
  }
});

// Add lab result (supports catalog or manual entry)
router.post('/', authenticateToken, requireRole('lab', 'lab_manager'), async (req, res) => {
  try {
    const { visit_id, test_catalog_id, test_name, result, unit, normal_range, notes } = req.body;

    if (!visit_id || (!test_catalog_id && !test_name)) {
      return res.status(400).json({ error: 'رقم الزيارة واسم التحليل أو معرف الكتالوج مطلوبان' });
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

    let finalTestName = test_name;
    let finalUnit = unit;
    let finalNormalRange = normal_range;

    // If test_catalog_id provided, fetch details from catalog
    if (test_catalog_id) {
      let testCatalog;
      if (db.prisma) {
        testCatalog = await db.prisma.labTestCatalog.findFirst({
          where: { id: parseInt(test_catalog_id), isActive: 1 }
        });
      } else {
        const { getQuery } = require('../database/db');
        testCatalog = await getQuery('SELECT * FROM lab_tests_catalog WHERE id = ? AND is_active = 1', [test_catalog_id]);
      }
      
      if (!testCatalog) {
        return res.status(404).json({ error: 'التحليل غير موجود في الكتالوج أو معطل' });
      }
      finalTestName = testCatalog.testNameAr || testCatalog.testName;
      finalUnit = testCatalog.unit;
      // Build normal range
      if (testCatalog.normalRangeText) {
        finalNormalRange = testCatalog.normalRangeText;
      } else if (testCatalog.normalRangeMin && testCatalog.normalRangeMax) {
        finalNormalRange = `${testCatalog.normalRangeMin} - ${testCatalog.normalRangeMax}`;
      } else if (testCatalog.normalRangeMin) {
        finalNormalRange = `≥ ${testCatalog.normalRangeMin}`;
      } else if (testCatalog.normalRangeMax) {
        finalNormalRange = `≤ ${testCatalog.normalRangeMax}`;
      }
    }

    let newResult;
    if (db.prisma) {
      // Create lab result and mark visit as completed in a transaction
      newResult = await db.prisma.labResult.create({
        data: {
          visitId: parseInt(visit_id),
          testCatalogId: test_catalog_id ? parseInt(test_catalog_id) : null,
          testName: finalTestName,
          result: result || null,
          unit: finalUnit || null,
          normalRange: finalNormalRange || null,
          notes: notes || null,
          createdBy: req.user.id
        },
        include: { testCatalog: true, creator: true }
      });

      // Don't auto-complete - user must click "Save and Complete Session" button
    } else {
      const { runQuery, getQuery } = require('../database/db');
      const labResult = await runQuery(
        `INSERT INTO lab_results (visit_id, test_catalog_id, test_name, result, unit, normal_range, notes, created_by) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [visit_id, test_catalog_id || null, finalTestName, result, finalUnit, finalNormalRange, notes || null, req.user.id]
      );
      newResult = await getQuery('SELECT * FROM lab_results WHERE id = ?', [labResult.lastID]);

      // Don't auto-complete - user must click "Save and Complete Session" button
    }
    
    res.status(201).json(newResult);
  } catch (error) {
    console.error('Error adding lab result:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء إضافة نتيجة التحليل' });
  }
});

// Add lab results from panel (multiple tests at once)
router.post('/from-panel', authenticateToken, requireRole('lab', 'lab_manager'), async (req, res) => {
  try {
    const { visit_id, panel_id, results } = req.body; // results: [{test_catalog_id, result, notes}]

    if (!visit_id || !panel_id) {
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

    // Get panel with tests
    let panel;
    if (db.prisma) {
      panel = await db.prisma.labTestPanel.findFirst({
        where: { id: parseInt(panel_id), isActive: 1 }
      });
    } else {
      const { getQuery } = require('../database/db');
      panel = await getQuery('SELECT * FROM lab_test_panels WHERE id = ? AND is_active = 1', [panel_id]);
    }
    
    if (!panel) {
      return res.status(404).json({ error: 'المجموعة غير موجودة أو معطلة' });
    }

    let panelTests;
    if (db.prisma) {
      panelTests = await db.prisma.labTestPanelItem.findMany({
        where: {
          panelId: parseInt(panel_id),
          testCatalog: { isActive: 1 }
        },
        include: {
          testCatalog: true
        },
        orderBy: { displayOrder: 'asc' }
      });
      
      // Transform to match expected format
      panelTests = panelTests.map(pt => ({
        ...pt,
        test_catalog_id: pt.testCatalogId,
        test_name: pt.testCatalog?.testName,
        test_name_ar: pt.testCatalog?.testNameAr,
        unit: pt.testCatalog?.unit,
        normal_range_min: pt.testCatalog?.normalRangeMin,
        normal_range_max: pt.testCatalog?.normalRangeMax,
        normal_range_text: pt.testCatalog?.normalRangeText
      }));
    } else {
      const { allQuery } = require('../database/db');
      panelTests = await allQuery(
        `SELECT pi.*, lt.test_name, lt.test_name_ar, lt.unit, lt.normal_range_min, 
                lt.normal_range_max, lt.normal_range_text
         FROM lab_test_panel_items pi
         JOIN lab_tests_catalog lt ON pi.test_catalog_id = lt.id
         WHERE pi.panel_id = ? AND lt.is_active = 1
         ORDER BY pi.display_order ASC`,
        [panel_id]
      );
    }

    if (panelTests.length === 0) {
      return res.status(400).json({ error: 'المجموعة لا تحتوي على تحاليل' });
    }

    const addedResults = [];

    for (const panelTest of panelTests) {
      // Find result for this test in results array
      const resultData = results?.find(r => r.test_catalog_id === panelTest.test_catalog_id) || {};

      const testName = panelTest.test_name_ar || panelTest.test_name;
      let normalRange = panelTest.normal_range_text;
      if (!normalRange && panelTest.normal_range_min && panelTest.normal_range_max) {
        normalRange = `${panelTest.normal_range_min} - ${panelTest.normal_range_max}`;
      } else if (!normalRange && panelTest.normal_range_min) {
        normalRange = `≥ ${panelTest.normal_range_min}`;
      } else if (!normalRange && panelTest.normal_range_max) {
        normalRange = `≤ ${panelTest.normal_range_max}`;
      }

      let newResult;
      if (db.prisma) {
        newResult = await db.prisma.labResult.create({
          data: {
            visitId: parseInt(visit_id),
            testCatalogId: panelTest.test_catalog_id || panelTest.testCatalogId ? parseInt(panelTest.test_catalog_id || panelTest.testCatalogId) : null,
            testName,
            result: resultData.result || null,
            unit: panelTest.unit,
            normalRange: normalRange || null,
            notes: resultData.notes || null,
            createdBy: req.user.id
          }
        });
      } else {
        const { runQuery, getQuery } = require('../database/db');
        const result = await runQuery(
          `INSERT INTO lab_results (visit_id, test_catalog_id, test_name, result, unit, normal_range, notes, created_by) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            visit_id,
            panelTest.test_catalog_id,
            testName,
            resultData.result || null,
            panelTest.unit,
            normalRange,
            resultData.notes || null,
            req.user.id
          ]
        );
        newResult = await getQuery('SELECT * FROM lab_results WHERE id = ?', [result.lastID]);
      }
      
      addedResults.push(newResult);
    }

    // Don't auto-complete - user must click "Save and Complete Session" button

    res.status(201).json({ message: `تم إضافة ${addedResults.length} تحليل`, results: addedResults });
  } catch (error) {
    console.error('Error adding lab results from panel:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء إضافة نتائج التحاليل' });
  }
});

// Update lab result
router.put('/:id', authenticateToken, requireRole('lab', 'lab_manager'), async (req, res) => {
  try {
    const { test_name, result, unit, normal_range, notes } = req.body;

    let labResult;
    if (db.prisma) {
      labResult = await db.prisma.labResult.findUnique({
        where: { id: parseInt(req.params.id) }
      });
    } else {
      const { getQuery } = require('../database/db');
      labResult = await getQuery('SELECT * FROM lab_results WHERE id = ?', [req.params.id]);
    }
    
    if (!labResult) {
      return res.status(404).json({ error: 'نتيجة التحليل غير موجودة' });
    }

    let updatedResult;
    if (db.prisma) {
      updatedResult = await db.prisma.labResult.update({
        where: { id: parseInt(req.params.id) },
        data: {
          testName: test_name,
          result: result || null,
          unit: unit || null,
          normalRange: normal_range || null,
          notes: notes || null
        }
      });
    } else {
      const { runQuery, getQuery } = require('../database/db');
      await runQuery(
        `UPDATE lab_results 
         SET test_name = ?, result = ?, unit = ?, normal_range = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [test_name, result, unit, normal_range, notes, req.params.id]
      );
      updatedResult = await getQuery('SELECT * FROM lab_results WHERE id = ?', [req.params.id]);
    }
    
    res.json(updatedResult);
  } catch (error) {
    console.error('Error updating lab result:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء تحديث نتيجة التحليل' });
  }
});

// Delete lab result
router.delete('/:id', authenticateToken, requireRole('lab', 'lab_manager'), async (req, res) => {
  try {
    let labResult;
    if (db.prisma) {
      labResult = await db.prisma.labResult.findUnique({
        where: { id: parseInt(req.params.id) }
      });
    } else {
      const { getQuery } = require('../database/db');
      labResult = await getQuery('SELECT * FROM lab_results WHERE id = ?', [req.params.id]);
    }
    
    if (!labResult) {
      return res.status(404).json({ error: 'نتيجة التحليل غير موجودة' });
    }

    if (db.prisma) {
      await db.prisma.labResult.delete({
        where: { id: parseInt(req.params.id) }
      });
    } else {
      const { runQuery } = require('../database/db');
      await runQuery('DELETE FROM lab_results WHERE id = ?', [req.params.id]);
    }
    
    res.json({ message: 'تم حذف نتيجة التحليل بنجاح' });
  } catch (error) {
    console.error('Error deleting lab result:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء حذف نتيجة التحليل' });
  }
});

// Mark lab work as completed (can be toggled) - OPTIMIZED
router.post('/complete/:visitId', authenticateToken, requireRole('lab', 'lab_manager'), async (req, res) => {
  try {
    const visitId = parseInt(req.params.visitId);
    
    // Get visit and check results in parallel
    const [visit, results] = await Promise.all([
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
        ? db.prisma.labResult.findMany({
            where: { visitId },
            select: { id: true }
          })
        : (async () => {
            const { allQuery } = require('../database/db');
            return await allQuery('SELECT id FROM lab_results WHERE visit_id = ?', [visitId]);
          })()
    ]);
    
    if (!visit) {
      return res.status(404).json({ error: 'الزيارة غير موجودة' });
    }
    
    if (results.length === 0 && (visit.labCompleted === 0 || visit.lab_completed === 0)) {
      return res.status(400).json({ error: 'يجب إضافة على الأقل نتيجة تحليل واحدة قبل الإكمال' });
    }

    // Toggle lab_completed status
    const currentLabCompleted = visit.labCompleted ?? visit.lab_completed ?? 0;
    const newLabCompleted = currentLabCompleted === 0 ? 1 : 0;
    const currentPharmacyCompleted = visit.pharmacyCompleted ?? visit.pharmacy_completed ?? 0;
    const currentDoctorCompleted = visit.doctorCompleted ?? visit.doctor_completed ?? 0;
    const currentStatus = visit.status;

    // Determine new status
    let newStatus = currentStatus;
    if (newLabCompleted === 1 && currentPharmacyCompleted === 1 && currentDoctorCompleted === 1) {
      newStatus = 'completed';
    } else if (currentStatus === 'completed' && (newLabCompleted === 0 || currentPharmacyCompleted === 0 || currentDoctorCompleted === 0)) {
      newStatus = 'pending_all';
    }

    // Update visit with all changes at once
    let updatedVisit;
    if (db.prisma) {
      updatedVisit = await db.prisma.visit.update({
        where: { id: visitId },
        data: { 
          labCompleted: newLabCompleted,
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
        'UPDATE visits SET lab_completed = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [newLabCompleted, newStatus, visitId]
      );
      updatedVisit = await getQuery('SELECT * FROM visits WHERE id = ?', [visitId]);
    }

    // Add status history in background (non-blocking)
    if (db.prisma) {
      db.prisma.visitStatusHistory.create({
        data: {
          visitId,
          status: newLabCompleted === 1 ? 'lab_completed' : 'lab_incomplete',
          changedBy: req.user.id,
          notes: newLabCompleted === 1 ? 'تم إكمال التحاليل' : 'تم إلغاء إكمال التحاليل'
        }
      }).catch(() => null);
    } else {
      const { runQuery } = require('../database/db');
      runQuery(
        `INSERT INTO visit_status_history (visit_id, status, changed_by, notes) 
         VALUES (?, ?, ?, ?)`,
        [visitId, newLabCompleted === 1 ? 'lab_completed' : 'lab_incomplete', req.user.id, newLabCompleted === 1 ? 'تم إكمال التحاليل' : 'تم إلغاء إكمال التحاليل']
      ).catch(() => null);
    }
    
    res.json({ 
      message: newLabCompleted === 1 ? 'تم إكمال التحاليل بنجاح' : 'تم إلغاء إكمال التحاليل',
      visit: updatedVisit 
    });
  } catch (error) {
    console.error('Error completing lab work:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء إكمال التحاليل' });
  }
});

module.exports = router;
