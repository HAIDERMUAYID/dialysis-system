const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/auth');
const db = require('../database/db');
const WorkflowEngine = require('../utils/workflow');
const logger = require('../utils/logger');

// Get workflow status
router.get('/status/:entityType/:entityId', authenticateToken, async (req, res) => {
  try {
    const { entityType, entityId } = req.params;
    const workflow = await WorkflowEngine.getWorkflowStatus(entityType, entityId);
    
    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    res.json(workflow);
  } catch (error) {
    logger.error('Error fetching workflow status:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب حالة سير العمل' });
  }
});

// Get workflow steps
router.get('/steps/:workflowId', authenticateToken, async (req, res) => {
  try {
    let steps;
    
    if (db.prisma) {
      // Note: This assumes workflow tables exist in Prisma schema
      // If not, fallback to SQL
      steps = await db.prisma.workflowInstance.findMany({
        where: { workflowId: parseInt(req.params.workflowId) },
        include: {
          step: true,
          completedBy: true
        },
        orderBy: { orderIndex: 'asc' }
      });
      
      steps = steps.map(s => ({
        ...s,
        name: s.step?.name || null,
        description: s.step?.description || null,
        assigned_to_role: s.step?.assignedToRole || null,
        requires_approval: s.step?.requiresApproval || null,
        completed_by_name: s.completedBy?.name || null
      }));
    } else {
      const { allQuery } = require('../database/db');
      steps = await allQuery(
        `SELECT wi.*, ws.name, ws.description, ws.assigned_to_role, ws.requires_approval,
                u.name as completed_by_name
         FROM workflow_instances wi
         JOIN workflow_steps ws ON wi.step_id = ws.id
         LEFT JOIN users u ON wi.completed_by = u.id
         WHERE wi.workflow_id = ?
         ORDER BY wi.order_index ASC`,
        [req.params.workflowId]
      );
    }

    res.json(steps);
  } catch (error) {
    logger.error('Error fetching workflow steps:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب خطوات سير العمل' });
  }
});

// Complete workflow step
router.post('/steps/:stepId/complete', authenticateToken, async (req, res) => {
  try {
    const { approved, notes } = req.body;
    const result = await WorkflowEngine.completeStep(
      req.params.stepId,
      req.user.id,
      approved !== false,
      notes || ''
    );

    // Broadcast real-time update if realtime service is available
    if (req.app.locals.realtimeService) {
      let step;
      if (db.prisma) {
        step = await db.prisma.workflowInstance.findUnique({
          where: { id: parseInt(req.params.stepId) },
          include: {
            workflow: true
          }
        });
        
        if (step) {
          step = {
            ...step,
            entity_type: step.workflow?.entityType || null,
            entity_id: step.workflow?.entityId || null
          };
        }
      } else {
        const { getQuery } = require('../database/db');
        step = await getQuery(
          `SELECT wi.*, w.entity_type, w.entity_id 
           FROM workflow_instances wi
           JOIN workflows w ON wi.workflow_id = w.id
           WHERE wi.id = ?`,
          [req.params.stepId]
        );
      }

      if (step) {
        const entityId = step.entityId || step.entity_id;
        req.app.locals.realtimeService.broadcastVisitUpdate(
          entityId,
          { workflow: 'updated', step: step.id }
        );
      }
    }

    res.json({
      message: approved ? 'تم الموافقة على الخطوة' : 'تم رفض الخطوة',
      workflowCompleted: result.workflowCompleted
    });
  } catch (error) {
    logger.error('Error completing workflow step:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء إكمال الخطوة' });
  }
});

// Get workflow templates
router.get('/templates', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    let templates;
    
    if (db.prisma) {
      templates = await db.prisma.workflowTemplate.findMany({
        include: {
          _count: {
            select: { steps: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      });
      
      templates = templates.map(t => ({
        ...t,
        steps_count: t._count?.steps || 0
      }));
    } else {
      const { allQuery } = require('../database/db');
      templates = await allQuery(
        `SELECT wt.*, 
         (SELECT COUNT(*) FROM workflow_steps WHERE workflow_type = wt.workflow_type) as steps_count
         FROM workflow_templates wt
         ORDER BY wt.created_at DESC`
      );
    }

    res.json(templates);
  } catch (error) {
    logger.error('Error fetching workflow templates:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب قوالب سير العمل' });
  }
});

// Create workflow template
router.post('/templates', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { workflow_type, name, description, steps } = req.body;

    if (!workflow_type || !name || !steps || !Array.isArray(steps)) {
      return res.status(400).json({ error: 'بيانات غير صحيحة' });
    }

    const templateId = await WorkflowEngine.createWorkflowTemplate(
      workflow_type,
      name,
      description,
      steps
    );

    res.status(201).json({ message: 'تم إنشاء قالب سير العمل بنجاح', templateId });
  } catch (error) {
    logger.error('Error creating workflow template:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء إنشاء قالب سير العمل' });
  }
});

module.exports = router;
