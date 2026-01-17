const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/auth');
const db = require('../database/db');

// ============================================
// DRUGS CATALOG (Master List) - Pharmacy Manager Only
// ============================================

// Get all drugs in catalog
router.get('/catalog', authenticateToken, async (req, res) => {
  try {
    const { search, is_active } = req.query;
    
    if (db.prisma) {
      const where = {};
      
      if (search) {
        where.OR = [
          { drugName: { contains: search } },
          { drugNameAr: { contains: search } }
        ];
      }
      
      if (is_active !== undefined) {
        where.isActive = is_active === 'true' ? 1 : 0;
      }
      
      const drugs = await db.prisma.drugCatalog.findMany({
        where,
        include: { creator: true },
        orderBy: { drugName: 'asc' }
      });
      
      const drugsWithCreator = drugs.map(d => ({
        ...d,
        // Map Prisma field names to snake_case for frontend compatibility
        drug_name: d.drugName,
        drug_name_ar: d.drugNameAr,
        is_active: d.isActive,
        created_by: d.createdBy,
        created_by_name: d.creator?.name || null,
        created_at: d.createdAt,
        updated_at: d.updatedAt,
        // Keep other fields as they are (strength, form, manufacturer, etc. are already in snake_case or don't need conversion)
      }));
      
      res.json(drugsWithCreator);
    } else {
      const { allQuery } = require('../database/db');
      let query = `
        SELECT d.*, u.name as created_by_name
        FROM drugs_catalog d
        LEFT JOIN users u ON d.created_by = u.id
        WHERE 1=1
      `;
      const params = [];

      if (search) {
        query += ' AND (d.drug_name LIKE ? OR d.drug_name_ar LIKE ?)';
        const searchTerm = `%${search}%`;
        params.push(searchTerm, searchTerm);
      }

      if (is_active !== undefined) {
        query += ' AND d.is_active = ?';
        params.push(is_active === 'true' ? 1 : 0);
      }

      query += ' ORDER BY d.drug_name ASC';
      const drugs = await allQuery(query, params);
      res.json(drugs);
    }
  } catch (error) {
    console.error('Error fetching drugs catalog:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب كتالوج الأدوية' });
  }
});

// Get single drug from catalog
router.get('/catalog/:id', authenticateToken, async (req, res) => {
  try {
    let drug;
    
    if (db.prisma) {
      drug = await db.prisma.drugCatalog.findUnique({
        where: { id: parseInt(req.params.id) },
        include: { creator: true }
      });
      
      if (!drug) {
        return res.status(404).json({ error: 'الدواء غير موجود في الكتالوج' });
      }
      
      drug = {
        ...drug,
        // Map Prisma field names to snake_case for frontend compatibility
        drug_name: drug.drugName,
        drug_name_ar: drug.drugNameAr,
        is_active: drug.isActive,
        created_by: drug.createdBy,
        created_by_name: drug.creator?.name || null,
        created_at: drug.createdAt,
        updated_at: drug.updatedAt
      };
    } else {
      const { getQuery } = require('../database/db');
      drug = await getQuery(
        `SELECT d.*, u.name as created_by_name
         FROM drugs_catalog d
         LEFT JOIN users u ON d.created_by = u.id
         WHERE d.id = ?`,
        [req.params.id]
      );
    }

    if (!drug) {
      return res.status(404).json({ error: 'الدواء غير موجود في الكتالوج' });
    }

    res.json(drug);
  } catch (error) {
    console.error('Error fetching drug:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب الدواء' });
  }
});

// Add new drug to catalog (Pharmacy Manager/Admin only)
router.post('/catalog', authenticateToken, requireRole('admin', 'pharmacy_manager'), async (req, res) => {
  try {
    const { drug_name, drug_name_ar, form, strength, manufacturer, description } = req.body;

    if (!drug_name) {
      return res.status(400).json({ error: 'اسم الدواء مطلوب' });
    }

    // Check if drug already exists
    let existing;
    if (db.prisma) {
      existing = await db.prisma.drugCatalog.findUnique({
        where: { drugName: drug_name }
      });
    } else {
      const { getQuery } = require('../database/db');
      existing = await getQuery('SELECT id FROM drugs_catalog WHERE drug_name = ?', [drug_name]);
    }
    
    if (existing) {
      return res.status(400).json({ error: 'هذا الدواء موجود بالفعل في الكتالوج' });
    }

    let newDrug;
    if (db.prisma) {
      newDrug = await db.prisma.drugCatalog.create({
        data: {
          drugName: drug_name,
          drugNameAr: drug_name_ar || null,
          form: form || null,
          strength: strength || null,
          manufacturer: manufacturer || null,
          description: description || null,
          createdBy: req.user.id
        },
        include: { creator: true }
      });
      
      newDrug = {
        ...newDrug,
        created_by_name: newDrug.creator?.name || null
      };
    } else {
      const { runQuery, getQuery } = require('../database/db');
      const result = await runQuery(
        `INSERT INTO drugs_catalog 
         (drug_name, drug_name_ar, form, strength, manufacturer, description, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [drug_name, drug_name_ar || null, form || null, strength || null, manufacturer || null, description || null, req.user.id]
      );
      newDrug = await getQuery(
        `SELECT d.*, u.name as created_by_name
         FROM drugs_catalog d
         LEFT JOIN users u ON d.created_by = u.id
         WHERE d.id = ?`,
        [result.lastID]
      );
    }

    res.status(201).json(newDrug);
  } catch (error) {
    console.error('Error adding drug to catalog:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء إضافة الدواء للكتالوج' });
  }
});

// Update drug in catalog (Pharmacy Manager/Admin only)
router.put('/catalog/:id', authenticateToken, requireRole('admin', 'pharmacy_manager'), async (req, res) => {
  try {
    const drugId = parseInt(req.params.id);
    const { drug_name, drug_name_ar, form, strength, manufacturer, description, is_active } = req.body;

    let drug;
    if (db.prisma) {
      drug = await db.prisma.drugCatalog.findUnique({
        where: { id: drugId }
      });
    } else {
      const { getQuery } = require('../database/db');
      drug = await getQuery('SELECT * FROM drugs_catalog WHERE id = ?', [req.params.id]);
    }
    
    if (!drug) {
      return res.status(404).json({ error: 'الدواء غير موجود' });
    }

    // Check if name conflicts with another drug
    if (drug_name && drug_name !== (drug.drugName || drug.drug_name)) {
      let existing;
      if (db.prisma) {
        existing = await db.prisma.drugCatalog.findFirst({
          where: {
            drugName: drug_name,
            id: { not: drugId }
          }
        });
      } else {
        const { getQuery } = require('../database/db');
        existing = await getQuery('SELECT id FROM drugs_catalog WHERE drug_name = ? AND id != ?', [drug_name, req.params.id]);
      }
      
      if (existing) {
        return res.status(400).json({ error: 'هذا الاسم موجود بالفعل لدواء آخر' });
      }
    }

    let updatedDrug;
    if (db.prisma) {
      updatedDrug = await db.prisma.drugCatalog.update({
        where: { id: drugId },
        data: {
          drugName: drug_name || drug.drugName,
          drugNameAr: drug_name_ar !== undefined ? drug_name_ar : drug.drugNameAr,
          form: form !== undefined ? form : drug.form,
          strength: strength !== undefined ? strength : drug.strength,
          manufacturer: manufacturer !== undefined ? manufacturer : drug.manufacturer,
          description: description !== undefined ? description : drug.description,
          isActive: is_active !== undefined ? (is_active === true || is_active === '1' ? 1 : 0) : drug.isActive
        },
        include: { creator: true }
      });
      
      updatedDrug = {
        ...updatedDrug,
        created_by_name: updatedDrug.creator?.name || null
      };
    } else {
      const { runQuery, getQuery } = require('../database/db');
      await runQuery(
        `UPDATE drugs_catalog 
         SET drug_name = COALESCE(?, drug_name),
             drug_name_ar = ?,
             form = ?,
             strength = ?,
             manufacturer = ?,
             description = ?,
             is_active = COALESCE(?, is_active),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [drug_name, drug_name_ar, form, strength, manufacturer, description, is_active, req.params.id]
      );

      updatedDrug = await getQuery(
        `SELECT d.*, u.name as created_by_name
         FROM drugs_catalog d
         LEFT JOIN users u ON d.created_by = u.id
         WHERE d.id = ?`,
        [req.params.id]
      );
    }

    res.json(updatedDrug);
  } catch (error) {
    console.error('Error updating drug:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء تحديث الدواء' });
  }
});

// Delete drug from catalog (Pharmacy Manager/Admin only)
router.delete('/catalog/:id', authenticateToken, requireRole('admin', 'pharmacy_manager'), async (req, res) => {
  try {
    const drugId = parseInt(req.params.id);
    
    let drug;
    if (db.prisma) {
      drug = await db.prisma.drugCatalog.findUnique({
        where: { id: drugId }
      });
    } else {
      const { getQuery } = require('../database/db');
      drug = await getQuery('SELECT * FROM drugs_catalog WHERE id = ?', [req.params.id]);
    }
    
    if (!drug) {
      return res.status(404).json({ error: 'الدواء غير موجود' });
    }

    // Check if drug is used in any prescriptions
    let usedCount = 0;
    if (db.prisma) {
      usedCount = await db.prisma.pharmacyPrescription.count({
        where: { drugCatalogId: drugId }
      });
    } else {
      const { getQuery } = require('../database/db');
      const used = await getQuery('SELECT COUNT(*) as count FROM pharmacy_prescriptions WHERE drug_catalog_id = ?', [req.params.id]);
      usedCount = used?.count || 0;
    }
    
    if (usedCount > 0) {
      // Instead of deleting, just deactivate
      if (db.prisma) {
        await db.prisma.drugCatalog.update({
          where: { id: drugId },
          data: { isActive: 0 }
        });
      } else {
        const { runQuery } = require('../database/db');
        await runQuery('UPDATE drugs_catalog SET is_active = 0 WHERE id = ?', [req.params.id]);
      }
      return res.json({ message: 'تم تعطيل الدواء (يستخدم في وصفات موجودة)' });
    }

    if (db.prisma) {
      await db.prisma.drugCatalog.delete({
        where: { id: drugId }
      });
    } else {
      const { runQuery } = require('../database/db');
      await runQuery('DELETE FROM drugs_catalog WHERE id = ?', [req.params.id]);
    }
    
    res.json({ message: 'تم حذف الدواء من الكتالوج' });
  } catch (error) {
    console.error('Error deleting drug:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء حذف الدواء' });
  }
});

// ============================================
// PRESCRIPTION SETS (Groups) - Pharmacy Staff
// ============================================

// Get all prescription sets
router.get('/sets', authenticateToken, async (req, res) => {
  try {
    const { search, is_active } = req.query;
    
    if (db.prisma) {
      const where = {};
      if (search) {
        where.OR = [
          { setName: { contains: search } },
          { setNameAr: { contains: search } }
        ];
      }
      if (is_active !== undefined) {
        where.isActive = is_active === 'true' ? 1 : 0;
      }
      
      const sets = await db.prisma.prescriptionSet.findMany({
        where,
        include: {
          creator: true,
          items: {
            select: { id: true }
          }
        },
        orderBy: { setName: 'asc' }
      });
      
      const setsWithCount = sets.map(s => ({
        id: s.id,
        set_name: s.setName,
        set_name_ar: s.setNameAr,
        description: s.description,
        is_active: s.isActive,
        created_by: s.createdBy,
        created_at: s.createdAt,
        updated_at: s.updatedAt,
        created_by_name: s.creator?.name || null,
        drugs_count: s.items?.length || 0
      }));
      
      res.json(setsWithCount);
    } else {
      const { allQuery } = require('../database/db');
      let query = `
        SELECT ps.*, u.name as created_by_name,
               (SELECT COUNT(*) FROM prescription_set_items WHERE set_id = ps.id) as drugs_count
        FROM prescription_sets ps
        LEFT JOIN users u ON ps.created_by = u.id
        WHERE 1=1
      `;
      const params = [];

      if (search) {
        query += ' AND (ps.set_name LIKE ? OR ps.set_name_ar LIKE ?)';
        const searchTerm = `%${search}%`;
        params.push(searchTerm, searchTerm);
      }

      if (is_active !== undefined) {
        query += ' AND ps.is_active = ?';
        params.push(is_active === 'true' ? 1 : 0);
      }

      query += ' ORDER BY ps.set_name ASC';
      const sets = await allQuery(query, params);
      res.json(sets);
    }
  } catch (error) {
    console.error('Error fetching prescription sets:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب مجموعات الوصفات' });
  }
});

// Get single prescription set with its drugs
router.get('/sets/:id', authenticateToken, async (req, res) => {
  try {
    const setId = parseInt(req.params.id);
    
    let set, drugs;
    
    if (db.prisma) {
      set = await db.prisma.prescriptionSet.findUnique({
        where: { id: setId },
        include: { creator: true }
      });
      
      if (!set) {
        return res.status(404).json({ error: 'المجموعة غير موجودة' });
      }
      
      drugs = await db.prisma.prescriptionSetItem.findMany({
        where: { setId },
        include: {
          drugCatalog: true
        },
        orderBy: [
          { displayOrder: 'asc' },
          { drugCatalog: { drugName: 'asc' } }
        ]
      });
      
      drugs = drugs.map(d => ({
        id: d.id,
        set_id: d.setId,
        drug_catalog_id: d.drugCatalogId,
        default_dosage: d.dosage,
        display_order: d.displayOrder,
        drug_name: d.drugCatalog?.drugName || null,
        drug_name_ar: d.drugCatalog?.drugNameAr || null,
        form: d.drugCatalog?.form || null,
        strength: d.drugCatalog?.strength || null
      }));
      
      set = {
        id: set.id,
        set_name: set.setName,
        set_name_ar: set.setNameAr,
        description: set.description,
        is_active: set.isActive,
        created_by: set.createdBy,
        created_at: set.createdAt,
        updated_at: set.updatedAt,
        created_by_name: set.creator?.name || null,
        drugs
      };
    } else {
      const { getQuery, allQuery } = require('../database/db');
      set = await getQuery(
        `SELECT ps.*, u.name as created_by_name
         FROM prescription_sets ps
         LEFT JOIN users u ON ps.created_by = u.id
         WHERE ps.id = ?`,
        [req.params.id]
      );

      if (!set) {
        return res.status(404).json({ error: 'المجموعة غير موجودة' });
      }

      drugs = await allQuery(
        `SELECT psi.*, d.drug_name, d.drug_name_ar, d.form, d.strength
         FROM prescription_set_items psi
         JOIN drugs_catalog d ON psi.drug_catalog_id = d.id
         WHERE psi.set_id = ?
         ORDER BY psi.display_order ASC, d.drug_name ASC`,
        [req.params.id]
      );
      
      set = { ...set, drugs };
    }

    res.json(set);
  } catch (error) {
    console.error('Error fetching prescription set:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب المجموعة' });
  }
});

// Create new prescription set (Pharmacy Staff can create)
router.post('/sets', authenticateToken, requireRole('admin', 'pharmacist', 'pharmacy_manager'), async (req, res) => {
  try {
    const { set_name, set_name_ar, description, drug_ids, default_dosages } = req.body;

    if (!set_name) {
      return res.status(400).json({ error: 'اسم المجموعة مطلوب' });
    }

    if (!drug_ids || !Array.isArray(drug_ids) || drug_ids.length === 0) {
      return res.status(400).json({ error: 'يجب إضافة دواء واحد على الأقل للمجموعة' });
    }

    let newSet;
    
    if (db.prisma) {
      // Create set
      newSet = await db.prisma.prescriptionSet.create({
        data: {
          setName: set_name,
          setNameAr: set_name_ar || null,
          description: description || null,
          createdBy: req.user.id
        },
        include: { creator: true }
      });

      // Add drugs to set
      const setItems = [];
      for (let i = 0; i < drug_ids.length; i++) {
        const drugId = parseInt(drug_ids[i]);
        // Verify drug exists
        const drug = await db.prisma.drugCatalog.findFirst({
          where: { id: drugId, isActive: 1 }
        });
        if (drug) {
          const defaultDosage = default_dosages && default_dosages[i] ? default_dosages[i] : null;
          setItems.push({
            setId: newSet.id,
            drugCatalogId: drugId,
            dosage: defaultDosage || null,
            displayOrder: i
          });
        }
      }
      
      if (setItems.length > 0) {
        await db.prisma.prescriptionSetItem.createMany({
          data: setItems
        });
      }
      
      newSet = {
        id: newSet.id,
        set_name: newSet.setName,
        set_name_ar: newSet.setNameAr,
        description: newSet.description,
        is_active: newSet.isActive,
        created_by: newSet.createdBy,
        created_at: newSet.createdAt,
        updated_at: newSet.updatedAt,
        created_by_name: newSet.creator?.name || null
      };
    } else {
      const { runQuery, getQuery } = require('../database/db');
      // Create set
      const setResult = await runQuery(
        `INSERT INTO prescription_sets (set_name, set_name_ar, description, created_by)
         VALUES (?, ?, ?, ?)`,
        [set_name, set_name_ar || null, description || null, req.user.id]
      );

      // Add drugs to set
      for (let i = 0; i < drug_ids.length; i++) {
        const drugId = drug_ids[i];
        // Verify drug exists
        const drug = await getQuery('SELECT id FROM drugs_catalog WHERE id = ? AND is_active = 1', [drugId]);
        if (drug) {
          const defaultDosage = default_dosages && default_dosages[i] ? default_dosages[i] : null;
          await runQuery(
            `INSERT INTO prescription_set_items (set_id, drug_catalog_id, dosage, display_order)
             VALUES (?, ?, ?, ?)`,
            [setResult.lastID, drugId, defaultDosage, i]
          );
        }
      }

      newSet = await getQuery(
        `SELECT ps.*, u.name as created_by_name
         FROM prescription_sets ps
         LEFT JOIN users u ON ps.created_by = u.id
         WHERE ps.id = ?`,
        [setResult.lastID]
      );
    }

    res.status(201).json(newSet);
  } catch (error) {
    console.error('Error creating prescription set:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء إنشاء المجموعة' });
  }
});

// Update prescription set
router.put('/sets/:id', authenticateToken, requireRole('admin', 'pharmacist', 'pharmacy_manager'), async (req, res) => {
  try {
    const setId = parseInt(req.params.id);
    const { set_name, set_name_ar, description, drug_ids, default_dosages, is_active } = req.body;

    let set;
    if (db.prisma) {
      set = await db.prisma.prescriptionSet.findUnique({
        where: { id: setId }
      });
    } else {
      const { getQuery } = require('../database/db');
      set = await getQuery('SELECT * FROM prescription_sets WHERE id = ?', [req.params.id]);
    }
    
    if (!set) {
      return res.status(404).json({ error: 'المجموعة غير موجودة' });
    }

    let updatedSet;
    if (db.prisma) {
      updatedSet = await db.prisma.prescriptionSet.update({
        where: { id: setId },
        data: {
          setName: set_name !== undefined ? set_name : set.setName,
          setNameAr: set_name_ar !== undefined ? set_name_ar : set.setNameAr,
          description: description !== undefined ? description : set.description,
          isActive: is_active !== undefined ? (is_active === true || is_active === '1' ? 1 : 0) : set.isActive
        },
        include: { creator: true }
      });

      // Update drugs if provided
      if (drug_ids && Array.isArray(drug_ids)) {
        // Delete existing items
        await db.prisma.prescriptionSetItem.deleteMany({
          where: { setId }
        });

        // Add new items
        const setItems = [];
        for (let i = 0; i < drug_ids.length; i++) {
          const drugId = parseInt(drug_ids[i]);
          const drug = await db.prisma.drugCatalog.findFirst({
            where: { id: drugId, isActive: 1 }
          });
          if (drug) {
            const defaultDosage = default_dosages && default_dosages[i] ? default_dosages[i] : null;
            setItems.push({
              setId,
              drugCatalogId: drugId,
              dosage: defaultDosage || null,
              displayOrder: i
            });
          }
        }
        
        if (setItems.length > 0) {
          await db.prisma.prescriptionSetItem.createMany({
            data: setItems
          });
        }
      }
      
      updatedSet = {
        id: updatedSet.id,
        set_name: updatedSet.setName,
        set_name_ar: updatedSet.setNameAr,
        description: updatedSet.description,
        is_active: updatedSet.isActive,
        created_by: updatedSet.createdBy,
        created_at: updatedSet.createdAt,
        updated_at: updatedSet.updatedAt,
        created_by_name: updatedSet.creator?.name || null
      };
    } else {
      const { runQuery, getQuery } = require('../database/db');
      await runQuery(
        `UPDATE prescription_sets 
         SET set_name = COALESCE(?, set_name),
             set_name_ar = ?,
             description = ?,
             is_active = COALESCE(?, is_active),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [set_name, set_name_ar, description, is_active, req.params.id]
      );

      // Update drugs if provided
      if (drug_ids && Array.isArray(drug_ids)) {
        // Delete existing items
        await runQuery('DELETE FROM prescription_set_items WHERE set_id = ?', [req.params.id]);

        // Add new items
        for (let i = 0; i < drug_ids.length; i++) {
          const drugId = drug_ids[i];
          const drug = await getQuery('SELECT id FROM drugs_catalog WHERE id = ? AND is_active = 1', [drugId]);
          if (drug) {
            const defaultDosage = default_dosages && default_dosages[i] ? default_dosages[i] : null;
            await runQuery(
              `INSERT INTO prescription_set_items (set_id, drug_catalog_id, dosage, display_order)
               VALUES (?, ?, ?, ?)`,
              [req.params.id, drugId, defaultDosage, i]
            );
          }
        }
      }

      updatedSet = await getQuery(
        `SELECT ps.*, u.name as created_by_name
         FROM prescription_sets ps
         LEFT JOIN users u ON ps.created_by = u.id
         WHERE ps.id = ?`,
        [req.params.id]
      );
    }

    res.json(updatedSet);
  } catch (error) {
    console.error('Error updating prescription set:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء تحديث المجموعة' });
  }
});

// Delete prescription set
router.delete('/sets/:id', authenticateToken, requireRole('admin', 'pharmacist', 'pharmacy_manager'), async (req, res) => {
  try {
    const setId = parseInt(req.params.id);
    
    let set;
    if (db.prisma) {
      set = await db.prisma.prescriptionSet.findUnique({
        where: { id: setId }
      });
    } else {
      const { getQuery } = require('../database/db');
      set = await getQuery('SELECT * FROM prescription_sets WHERE id = ?', [req.params.id]);
    }
    
    if (!set) {
      return res.status(404).json({ error: 'المجموعة غير موجودة' });
    }

    if (db.prisma) {
      // Delete items first (cascade should handle this, but explicit is safer)
      await db.prisma.prescriptionSetItem.deleteMany({
        where: { setId }
      });
      
      await db.prisma.prescriptionSet.delete({
        where: { id: setId }
      });
    } else {
      const { runQuery } = require('../database/db');
      await runQuery('DELETE FROM prescription_sets WHERE id = ?', [req.params.id]);
    }
    
    res.json({ message: 'تم حذف المجموعة' });
  } catch (error) {
    console.error('Error deleting prescription set:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء حذف المجموعة' });
  }
});

module.exports = router;
