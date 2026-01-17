const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/auth');
const db = require('../database/db');

// ============================================
// LAB TESTS CATALOG (Master List) - Lab Manager Only
// ============================================

// Get all lab tests in catalog
router.get('/catalog', authenticateToken, async (req, res) => {
  try {
    const { search, is_active } = req.query;
    
    if (db.prisma) {
      const where = {};
      
      if (search) {
        where.OR = [
          { testName: { contains: search } },
          { testNameAr: { contains: search } }
        ];
      }
      
      if (is_active !== undefined) {
        where.isActive = is_active === 'true' ? 1 : 0;
      }
      
      const tests = await db.prisma.labTestCatalog.findMany({
        where,
        include: { creator: true },
        orderBy: { testName: 'asc' }
      });
      
      const testsWithCreator = tests.map(t => ({
        ...t,
        // Map Prisma field names to snake_case for frontend compatibility
        test_name: t.testName,
        test_name_ar: t.testNameAr,
        normal_range_min: t.normalRangeMin,
        normal_range_max: t.normalRangeMax,
        normal_range_text: t.normalRangeText,
        is_active: t.isActive,
        created_by: t.createdBy,
        created_by_name: t.creator?.name || null,
        created_at: t.createdAt,
        updated_at: t.updatedAt
      }));
      
      res.json(testsWithCreator);
    } else {
      const { allQuery } = require('../database/db');
      let query = `
        SELECT lt.*, u.name as created_by_name
        FROM lab_tests_catalog lt
        LEFT JOIN users u ON lt.created_by = u.id
        WHERE 1=1
      `;
      const params = [];

      if (search) {
        query += ' AND (lt.test_name LIKE ? OR lt.test_name_ar LIKE ?)';
        const searchTerm = `%${search}%`;
        params.push(searchTerm, searchTerm);
      }

      if (is_active !== undefined) {
        query += ' AND lt.is_active = ?';
        params.push(is_active === 'true' ? 1 : 0);
      }

      query += ' ORDER BY lt.test_name ASC';
      const tests = await allQuery(query, params);
      res.json(tests);
    }
  } catch (error) {
    console.error('Error fetching lab tests catalog:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب كتالوج التحاليل' });
  }
});

// Get single lab test from catalog
router.get('/catalog/:id', authenticateToken, async (req, res) => {
  try {
    let test;
    
    if (db.prisma) {
      test = await db.prisma.labTestCatalog.findUnique({
        where: { id: parseInt(req.params.id) },
        include: { creator: true }
      });
      
      if (!test) {
        return res.status(404).json({ error: 'التحليل غير موجود في الكتالوج' });
      }
      
      test = {
        ...test,
        // Map Prisma field names to snake_case for frontend compatibility
        test_name: test.testName,
        test_name_ar: test.testNameAr,
        normal_range_min: test.normalRangeMin,
        normal_range_max: test.normalRangeMax,
        normal_range_text: test.normalRangeText,
        is_active: test.isActive,
        created_by: test.createdBy,
        created_by_name: test.creator?.name || null,
        created_at: test.createdAt,
        updated_at: test.updatedAt
      };
    } else {
      const { getQuery } = require('../database/db');
      test = await getQuery(
        `SELECT lt.*, u.name as created_by_name
         FROM lab_tests_catalog lt
         LEFT JOIN users u ON lt.created_by = u.id
         WHERE lt.id = ?`,
        [req.params.id]
      );
    }

    if (!test) {
      return res.status(404).json({ error: 'التحليل غير موجود في الكتالوج' });
    }

    res.json(test);
  } catch (error) {
    console.error('Error fetching lab test:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب التحليل' });
  }
});

// Add new lab test to catalog (Lab Manager/Admin only)
router.post('/catalog', authenticateToken, requireRole('admin', 'lab_manager'), async (req, res) => {
  try {
    const { test_name, test_name_ar, unit, normal_range_min, normal_range_max, normal_range_text, description } = req.body;

    if (!test_name || !unit) {
      return res.status(400).json({ error: 'اسم التحليل ووحدة القياس مطلوبان' });
    }

    // Check if test already exists
    let existing;
    if (db.prisma) {
      existing = await db.prisma.labTestCatalog.findUnique({
        where: { testName: test_name }
      });
    } else {
      const { getQuery } = require('../database/db');
      existing = await getQuery('SELECT id FROM lab_tests_catalog WHERE test_name = ?', [test_name]);
    }
    
    if (existing) {
      return res.status(400).json({ error: 'هذا التحليل موجود بالفعل في الكتالوج' });
    }

    let newTest;
    if (db.prisma) {
      newTest = await db.prisma.labTestCatalog.create({
        data: {
          testName: test_name,
          testNameAr: test_name_ar || null,
          unit,
          normalRangeMin: normal_range_min || null,
          normalRangeMax: normal_range_max || null,
          normalRangeText: normal_range_text || null,
          description: description || null,
          createdBy: req.user.id
        },
        include: { creator: true }
      });
      
      newTest = {
        ...newTest,
        created_by_name: newTest.creator?.name || null
      };
    } else {
      const { runQuery, getQuery } = require('../database/db');
      const result = await runQuery(
        `INSERT INTO lab_tests_catalog 
         (test_name, test_name_ar, unit, normal_range_min, normal_range_max, normal_range_text, description, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [test_name, test_name_ar || null, unit, normal_range_min || null, normal_range_max || null, normal_range_text || null, description || null, req.user.id]
      );
      newTest = await getQuery(
        `SELECT lt.*, u.name as created_by_name
         FROM lab_tests_catalog lt
         LEFT JOIN users u ON lt.created_by = u.id
         WHERE lt.id = ?`,
        [result.lastID]
      );
    }

    res.status(201).json(newTest);
  } catch (error) {
    console.error('Error adding lab test to catalog:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء إضافة التحليل للكتالوج' });
  }
});

// Update lab test in catalog (Lab Manager/Admin only)
router.put('/catalog/:id', authenticateToken, requireRole('admin', 'lab_manager'), async (req, res) => {
  try {
    const testId = parseInt(req.params.id);
    const { test_name, test_name_ar, unit, normal_range_min, normal_range_max, normal_range_text, description, is_active } = req.body;

    let test;
    if (db.prisma) {
      test = await db.prisma.labTestCatalog.findUnique({
        where: { id: testId }
      });
    } else {
      const { getQuery } = require('../database/db');
      test = await getQuery('SELECT * FROM lab_tests_catalog WHERE id = ?', [req.params.id]);
    }
    
    if (!test) {
      return res.status(404).json({ error: 'التحليل غير موجود' });
    }

    // Check if name conflicts with another test
    if (test_name && test_name !== (test.testName || test.test_name)) {
      let existing;
      if (db.prisma) {
        existing = await db.prisma.labTestCatalog.findFirst({
          where: {
            testName: test_name,
            id: { not: testId }
          }
        });
      } else {
        const { getQuery } = require('../database/db');
        existing = await getQuery('SELECT id FROM lab_tests_catalog WHERE test_name = ? AND id != ?', [test_name, req.params.id]);
      }
      
      if (existing) {
        return res.status(400).json({ error: 'هذا الاسم موجود بالفعل لتحليل آخر' });
      }
    }

    let updatedTest;
    if (db.prisma) {
      updatedTest = await db.prisma.labTestCatalog.update({
        where: { id: testId },
        data: {
          testName: test_name || test.testName,
          testNameAr: test_name_ar !== undefined ? test_name_ar : test.testNameAr,
          unit: unit || test.unit,
          normalRangeMin: normal_range_min !== undefined ? normal_range_min : test.normalRangeMin,
          normalRangeMax: normal_range_max !== undefined ? normal_range_max : test.normalRangeMax,
          normalRangeText: normal_range_text !== undefined ? normal_range_text : test.normalRangeText,
          description: description !== undefined ? description : test.description,
          isActive: is_active !== undefined ? (is_active === true || is_active === '1' ? 1 : 0) : test.isActive
        },
        include: { creator: true }
      });
      
      updatedTest = {
        ...updatedTest,
        created_by_name: updatedTest.creator?.name || null
      };
    } else {
      const { runQuery, getQuery } = require('../database/db');
      await runQuery(
        `UPDATE lab_tests_catalog 
         SET test_name = COALESCE(?, test_name),
             test_name_ar = ?,
             unit = COALESCE(?, unit),
             normal_range_min = ?,
             normal_range_max = ?,
             normal_range_text = ?,
             description = ?,
             is_active = COALESCE(?, is_active),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [test_name, test_name_ar, unit, normal_range_min, normal_range_max, normal_range_text, description, is_active, req.params.id]
      );

      updatedTest = await getQuery(
        `SELECT lt.*, u.name as created_by_name
         FROM lab_tests_catalog lt
         LEFT JOIN users u ON lt.created_by = u.id
         WHERE lt.id = ?`,
        [req.params.id]
      );
    }

    res.json(updatedTest);
  } catch (error) {
    console.error('Error updating lab test:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء تحديث التحليل' });
  }
});

// Delete lab test from catalog (Lab Manager/Admin only)
router.delete('/catalog/:id', authenticateToken, requireRole('admin', 'lab_manager'), async (req, res) => {
  try {
    const testId = parseInt(req.params.id);
    
    let test;
    if (db.prisma) {
      test = await db.prisma.labTestCatalog.findUnique({
        where: { id: testId }
      });
    } else {
      const { getQuery } = require('../database/db');
      test = await getQuery('SELECT * FROM lab_tests_catalog WHERE id = ?', [req.params.id]);
    }
    
    if (!test) {
      return res.status(404).json({ error: 'التحليل غير موجود' });
    }

    // Check if test is used in any lab results
    let usedCount = 0;
    if (db.prisma) {
      usedCount = await db.prisma.labResult.count({
        where: { testCatalogId: testId }
      });
    } else {
      const { getQuery } = require('../database/db');
      const used = await getQuery('SELECT COUNT(*) as count FROM lab_results WHERE test_catalog_id = ?', [req.params.id]);
      usedCount = used?.count || 0;
    }
    
    if (usedCount > 0) {
      // Instead of deleting, just deactivate
      if (db.prisma) {
        await db.prisma.labTestCatalog.update({
          where: { id: testId },
          data: { isActive: 0 }
        });
      } else {
        const { runQuery } = require('../database/db');
        await runQuery('UPDATE lab_tests_catalog SET is_active = 0 WHERE id = ?', [req.params.id]);
      }
      return res.json({ message: 'تم تعطيل التحليل (يستخدم في نتائج موجودة)' });
    }

    if (db.prisma) {
      await db.prisma.labTestCatalog.delete({
        where: { id: testId }
      });
    } else {
      const { runQuery } = require('../database/db');
      await runQuery('DELETE FROM lab_tests_catalog WHERE id = ?', [req.params.id]);
    }
    
    res.json({ message: 'تم حذف التحليل من الكتالوج' });
  } catch (error) {
    console.error('Error deleting lab test:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء حذف التحليل' });
  }
});

// ============================================
// LAB TEST PANELS (Groups) - Lab Staff
// ============================================

// Get all panels
router.get('/panels', authenticateToken, async (req, res) => {
  try {
    const { search, is_active } = req.query;
    
    if (db.prisma) {
      const where = {};
      if (search) {
        where.OR = [
          { panelName: { contains: search } },
          { panelNameAr: { contains: search } }
        ];
      }
      if (is_active !== undefined) {
        where.isActive = is_active === 'true' ? 1 : 0;
      }
      
      const panels = await db.prisma.labTestPanel.findMany({
        where,
        include: {
          creator: true,
          items: {
            select: { id: true }
          }
        },
        orderBy: { panelName: 'asc' }
      });
      
      const panelsWithCount = panels.map(p => ({
        ...p,
        // Map Prisma field names to snake_case for frontend compatibility
        panel_name: p.panelName,
        panel_name_ar: p.panelNameAr,
        is_active: p.isActive,
        created_by: p.createdBy,
        created_by_name: p.creator?.name || null,
        created_at: p.createdAt,
        updated_at: p.updatedAt,
        tests_count: p.items?.length || 0
      }));
      
      res.json(panelsWithCount);
    } else {
      const { allQuery } = require('../database/db');
      let query = `
        SELECT p.*, u.name as created_by_name,
               (SELECT COUNT(*) FROM lab_test_panel_items WHERE panel_id = p.id) as tests_count
        FROM lab_test_panels p
        LEFT JOIN users u ON p.created_by = u.id
        WHERE 1=1
      `;
      const params = [];

      if (search) {
        query += ' AND (p.panel_name LIKE ? OR p.panel_name_ar LIKE ?)';
        const searchTerm = `%${search}%`;
        params.push(searchTerm, searchTerm);
      }

      if (is_active !== undefined) {
        query += ' AND p.is_active = ?';
        params.push(is_active === 'true' ? 1 : 0);
      }

      query += ' ORDER BY p.panel_name ASC';
      const panels = await allQuery(query, params);
      res.json(panels);
    }
  } catch (error) {
    console.error('Error fetching lab test panels:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب مجموعات التحاليل' });
  }
});

// Get single panel with its tests
router.get('/panels/:id', authenticateToken, async (req, res) => {
  try {
    const panelId = parseInt(req.params.id);
    
    let panel, tests;
    
    if (db.prisma) {
      panel = await db.prisma.labTestPanel.findUnique({
        where: { id: panelId },
        include: { creator: true }
      });
      
      if (!panel) {
        return res.status(404).json({ error: 'المجموعة غير موجودة' });
      }
      
      tests = await db.prisma.labTestPanelItem.findMany({
        where: { panelId },
        include: {
          testCatalog: true
        },
        orderBy: [
          { displayOrder: 'asc' },
          { testCatalog: { testName: 'asc' } }
        ]
      });
      
      tests = tests.map(t => ({
        ...t,
        test_name: t.testCatalog?.testName || null,
        test_name_ar: t.testCatalog?.testNameAr || null,
        unit: t.testCatalog?.unit || null,
        normal_range_min: t.testCatalog?.normalRangeMin || null,
        normal_range_max: t.testCatalog?.normalRangeMax || null,
        normal_range_text: t.testCatalog?.normalRangeText || null
      }));
      
      panel = {
        ...panel,
        // Map Prisma field names to snake_case for frontend compatibility
        panel_name: panel.panelName,
        panel_name_ar: panel.panelNameAr,
        is_active: panel.isActive,
        created_by: panel.createdBy,
        created_by_name: panel.creator?.name || null,
        created_at: panel.createdAt,
        updated_at: panel.updatedAt,
        tests
      };
    } else {
      const { getQuery, allQuery } = require('../database/db');
      panel = await getQuery(
        `SELECT p.*, u.name as created_by_name
         FROM lab_test_panels p
         LEFT JOIN users u ON p.created_by = u.id
         WHERE p.id = ?`,
        [req.params.id]
      );

      if (!panel) {
        return res.status(404).json({ error: 'المجموعة غير موجودة' });
      }

      tests = await allQuery(
        `SELECT pi.*, lt.test_name, lt.test_name_ar, lt.unit, lt.normal_range_min, 
                lt.normal_range_max, lt.normal_range_text
         FROM lab_test_panel_items pi
         JOIN lab_tests_catalog lt ON pi.test_catalog_id = lt.id
         WHERE pi.panel_id = ?
         ORDER BY pi.display_order ASC, lt.test_name ASC`,
        [req.params.id]
      );
      
      panel = { ...panel, tests };
    }

    res.json(panel);
  } catch (error) {
    console.error('Error fetching panel:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب المجموعة' });
  }
});

// Create new panel (Lab Staff can create)
router.post('/panels', authenticateToken, requireRole('admin', 'lab', 'lab_manager'), async (req, res) => {
  try {
    const { panel_name, panel_name_ar, description, test_ids, is_active } = req.body;

    if (!panel_name) {
      return res.status(400).json({ error: 'اسم المجموعة مطلوب' });
    }

    if (!test_ids || !Array.isArray(test_ids) || test_ids.length === 0) {
      return res.status(400).json({ error: 'يجب إضافة تحليل واحد على الأقل للمجموعة' });
    }

    let newPanel;
    
    if (db.prisma) {
      // Create panel
      newPanel = await db.prisma.labTestPanel.create({
        data: {
          panelName: panel_name,
          panelNameAr: panel_name_ar || null,
          description: description || null,
          isActive: is_active !== undefined ? (is_active === true || is_active === 1 || is_active === '1' ? 1 : 0) : 1,
          createdBy: req.user.id
        },
        include: { creator: true }
      });

      // Add tests to panel
      const panelItems = [];
      for (let i = 0; i < test_ids.length; i++) {
        const testId = parseInt(test_ids[i]);
        // Verify test exists
        const test = await db.prisma.labTestCatalog.findFirst({
          where: { id: testId, isActive: 1 }
        });
        if (test) {
          panelItems.push({
            panelId: newPanel.id,
            testCatalogId: testId,
            displayOrder: i
          });
        }
      }
      
      if (panelItems.length > 0) {
        await db.prisma.labTestPanelItem.createMany({
          data: panelItems
        });
      }
      
      newPanel = {
        ...newPanel,
        created_by_name: newPanel.creator?.name || null
      };
    } else {
      const { runQuery, getQuery } = require('../database/db');
      // Create panel
      const isActiveValue = is_active !== undefined ? (is_active === true || is_active === 1 || is_active === '1' ? 1 : 0) : 1;
      const panelResult = await runQuery(
        `INSERT INTO lab_test_panels (panel_name, panel_name_ar, description, is_active, created_by)
         VALUES (?, ?, ?, ?, ?)`,
        [panel_name, panel_name_ar || null, description || null, isActiveValue, req.user.id]
      );

      // Add tests to panel
      for (let i = 0; i < test_ids.length; i++) {
        const testId = test_ids[i];
        // Verify test exists
        const test = await getQuery('SELECT id FROM lab_tests_catalog WHERE id = ? AND is_active = 1', [testId]);
        if (test) {
          await runQuery(
            `INSERT INTO lab_test_panel_items (panel_id, test_catalog_id, display_order)
             VALUES (?, ?, ?)`,
            [panelResult.lastID, testId, i]
          );
        }
      }

      newPanel = await getQuery(
        `SELECT p.*, u.name as created_by_name
         FROM lab_test_panels p
         LEFT JOIN users u ON p.created_by = u.id
         WHERE p.id = ?`,
        [panelResult.lastID]
      );
    }

    res.status(201).json(newPanel);
  } catch (error) {
    console.error('Error creating panel:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء إنشاء المجموعة' });
  }
});

// Update panel
router.put('/panels/:id', authenticateToken, requireRole('admin', 'lab', 'lab_manager'), async (req, res) => {
  try {
    const panelId = parseInt(req.params.id);
    const { panel_name, panel_name_ar, description, test_ids, is_active } = req.body;

    let panel;
    if (db.prisma) {
      panel = await db.prisma.labTestPanel.findUnique({
        where: { id: panelId }
      });
    } else {
      const { getQuery } = require('../database/db');
      panel = await getQuery('SELECT * FROM lab_test_panels WHERE id = ?', [req.params.id]);
    }
    
    if (!panel) {
      return res.status(404).json({ error: 'المجموعة غير موجودة' });
    }

    let updatedPanel;
    if (db.prisma) {
      updatedPanel = await db.prisma.labTestPanel.update({
        where: { id: panelId },
        data: {
          panelName: panel_name !== undefined ? panel_name : panel.panelName,
          panelNameAr: panel_name_ar !== undefined ? panel_name_ar : panel.panelNameAr,
          description: description !== undefined ? description : panel.description,
          isActive: is_active !== undefined ? (is_active === true || is_active === '1' ? 1 : 0) : panel.isActive
        },
        include: { creator: true }
      });

      // Update tests if provided
      if (test_ids && Array.isArray(test_ids)) {
        // Delete existing items
        await db.prisma.labTestPanelItem.deleteMany({
          where: { panelId }
        });

        // Add new items
        const panelItems = [];
        for (let i = 0; i < test_ids.length; i++) {
          const testId = parseInt(test_ids[i]);
          const test = await db.prisma.labTestCatalog.findFirst({
            where: { id: testId, isActive: 1 }
          });
          if (test) {
            panelItems.push({
              panelId,
              testCatalogId: testId,
              displayOrder: i
            });
          }
        }
        
        if (panelItems.length > 0) {
          await db.prisma.labTestPanelItem.createMany({
            data: panelItems
          });
        }
      }
      
      // Get tests count
      const testsCount = await db.prisma.labTestPanelItem.count({
        where: { panelId }
      });
      
      updatedPanel = {
        ...updatedPanel,
        panel_name: updatedPanel.panelName,
        panel_name_ar: updatedPanel.panelNameAr,
        is_active: updatedPanel.isActive,
        created_by: updatedPanel.createdBy,
        created_by_name: updatedPanel.creator?.name || null,
        created_at: updatedPanel.createdAt,
        updated_at: updatedPanel.updatedAt,
        tests_count: testsCount
      };
    } else {
      const { runQuery, getQuery } = require('../database/db');
      const isActiveValue = is_active !== undefined ? (is_active === true || is_active === 1 || is_active === '1' ? 1 : 0) : undefined;
      await runQuery(
        `UPDATE lab_test_panels 
         SET panel_name = COALESCE(?, panel_name),
             panel_name_ar = COALESCE(?, panel_name_ar),
             description = COALESCE(?, description),
             is_active = COALESCE(?, is_active),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [panel_name, panel_name_ar, description, isActiveValue, req.params.id]
      );

      // Update tests if provided
      if (test_ids && Array.isArray(test_ids)) {
        // Delete existing items
        await runQuery('DELETE FROM lab_test_panel_items WHERE panel_id = ?', [req.params.id]);

        // Add new items
        for (let i = 0; i < test_ids.length; i++) {
          const testId = test_ids[i];
          const test = await getQuery('SELECT id FROM lab_tests_catalog WHERE id = ? AND is_active = 1', [testId]);
          if (test) {
            await runQuery(
              `INSERT INTO lab_test_panel_items (panel_id, test_catalog_id, display_order)
               VALUES (?, ?, ?)`,
              [req.params.id, testId, i]
            );
          }
        }
      }

      updatedPanel = await getQuery(
        `SELECT p.*, u.name as created_by_name,
                (SELECT COUNT(*) FROM lab_test_panel_items WHERE panel_id = p.id) as tests_count
         FROM lab_test_panels p
         LEFT JOIN users u ON p.created_by = u.id
         WHERE p.id = ?`,
        [req.params.id]
      );
    }

    res.json(updatedPanel);
  } catch (error) {
    console.error('Error updating panel:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء تحديث المجموعة' });
  }
});

// Delete panel
router.delete('/panels/:id', authenticateToken, requireRole('admin', 'lab', 'lab_manager'), async (req, res) => {
  try {
    const panelId = parseInt(req.params.id);
    
    let panel;
    if (db.prisma) {
      panel = await db.prisma.labTestPanel.findUnique({
        where: { id: panelId }
      });
    } else {
      const { getQuery } = require('../database/db');
      panel = await getQuery('SELECT * FROM lab_test_panels WHERE id = ?', [req.params.id]);
    }
    
    if (!panel) {
      return res.status(404).json({ error: 'المجموعة غير موجودة' });
    }

    if (db.prisma) {
      // Delete items first (cascade should handle this, but explicit is safer)
      await db.prisma.labTestPanelItem.deleteMany({
        where: { panelId }
      });
      
      await db.prisma.labTestPanel.delete({
        where: { id: panelId }
      });
    } else {
      const { runQuery } = require('../database/db');
      await runQuery('DELETE FROM lab_test_panels WHERE id = ?', [req.params.id]);
    }
    
    res.json({ message: 'تم حذف المجموعة' });
  } catch (error) {
    console.error('Error deleting panel:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء حذف المجموعة' });
  }
});

module.exports = router;
