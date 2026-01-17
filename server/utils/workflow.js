const { runQuery, getQuery, allQuery } = require('../database/db');
const logger = require('./logger');

/**
 * Enterprise Workflow Management System
 * Manages complex workflows with approvals, notifications, and state tracking
 */

class WorkflowEngine {
  /**
   * Initialize workflow for an entity
   */
  static async initWorkflow(entityType, entityId, workflowType, initiatorId, metadata = {}) {
    try {
      const workflowId = await this.createWorkflow(entityType, entityId, workflowType, initiatorId, metadata);
      const steps = await this.getWorkflowSteps(workflowType);
      
      // Create workflow instances for each step
      for (const step of steps) {
        await runQuery(
          `INSERT INTO workflow_instances (workflow_id, step_id, status, assigned_to_role, order_index)
           VALUES (?, ?, ?, ?, ?)`,
          [workflowId, step.id, 'pending', step.assigned_to_role, step.order_index]
        );
      }

      // Initialize first step
      await this.startNextStep(workflowId);

      logger.info(`Workflow ${workflowId} initialized for ${entityType} ${entityId}`);
      return workflowId;
    } catch (error) {
      logger.error('Error initializing workflow:', error);
      throw error;
    }
  }

  /**
   * Create a new workflow
   */
  static async createWorkflow(entityType, entityId, workflowType, initiatorId, metadata = {}) {
    const result = await runQuery(
      `INSERT INTO workflows (entity_type, entity_id, workflow_type, initiator_id, status, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [entityType, entityId, workflowType, initiatorId, 'active', JSON.stringify(metadata)]
    );
    return result.lastID;
  }

  /**
   * Get workflow steps configuration
   */
  static async getWorkflowSteps(workflowType) {
    return await allQuery(
      `SELECT * FROM workflow_steps WHERE workflow_type = ? ORDER BY order_index ASC`,
      [workflowType]
    );
  }

  /**
   * Start next step in workflow
   */
  static async startNextStep(workflowId) {
    const nextStep = await getQuery(
      `SELECT wi.*, ws.name, ws.assigned_to_role, ws.requires_approval
       FROM workflow_instances wi
       JOIN workflow_steps ws ON wi.step_id = ws.id
       WHERE wi.workflow_id = ? AND wi.status = 'pending'
       ORDER BY wi.order_index ASC
       LIMIT 1`,
      [workflowId]
    );

    if (nextStep) {
      await runQuery(
        `UPDATE workflow_instances SET status = 'in_progress', started_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [nextStep.id]
      );

      // Create notification for assigned role
      await runQuery(
        `INSERT INTO notifications (visit_id, from_user_id, to_role, type, title, message, status)
         VALUES (?, ?, ?, ?, ?, ?, 'unread')`,
        [
          nextStep.entity_id,
          null,
          nextStep.assigned_to_role,
          'workflow_step',
          'خطوة جديدة في سير العمل',
          `تم تفعيل الخطوة: ${nextStep.name}`
        ]
      );

      logger.info(`Workflow step ${nextStep.id} started for workflow ${workflowId}`);
      return nextStep;
    }

    return null;
  }

  /**
   * Complete a workflow step
   */
  static async completeStep(workflowInstanceId, userId, approved = true, notes = '') {
    try {
      const instance = await getQuery(
        `SELECT wi.*, w.entity_type, w.entity_id, w.workflow_type
         FROM workflow_instances wi
         JOIN workflows w ON wi.workflow_id = w.id
         WHERE wi.id = ?`,
        [workflowInstanceId]
      );

      if (!instance) {
        throw new Error('Workflow instance not found');
      }

      // Update step status
      await runQuery(
        `UPDATE workflow_instances 
         SET status = ?, completed_by = ?, completed_at = CURRENT_TIMESTAMP, approved = ?, notes = ?
         WHERE id = ?`,
        [approved ? 'completed' : 'rejected', userId, approved ? 1 : 0, notes, workflowInstanceId]
      );

      // Check if all steps are completed
      const remainingSteps = await getQuery(
        `SELECT COUNT(*) as count FROM workflow_instances 
         WHERE workflow_id = ? AND status = 'pending'`,
        [instance.workflow_id]
      );

      if (remainingSteps.count === 0) {
        // Complete workflow
        await runQuery(
          `UPDATE workflows SET status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [instance.workflow_id]
        );

        logger.info(`Workflow ${instance.workflow_id} completed`);
      } else {
        // Start next step
        await this.startNextStep(instance.workflow_id);
      }

      // Log activity
      await runQuery(
        `INSERT INTO audit_log (user_id, action, entity_type, entity_id, details, ip_address)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          userId,
          approved ? 'workflow_step_approved' : 'workflow_step_rejected',
          instance.entity_type,
          instance.entity_id,
          JSON.stringify({ workflow_instance_id: workflowInstanceId, notes }),
          null
        ]
      );

      return { workflowCompleted: remainingSteps.count === 0 };
    } catch (error) {
      logger.error('Error completing workflow step:', error);
      throw error;
    }
  }

  /**
   * Get workflow status
   */
  static async getWorkflowStatus(entityType, entityId) {
    const workflow = await getQuery(
      `SELECT w.*, 
       (SELECT COUNT(*) FROM workflow_instances WHERE workflow_id = w.id) as total_steps,
       (SELECT COUNT(*) FROM workflow_instances WHERE workflow_id = w.id AND status = 'completed') as completed_steps,
       (SELECT COUNT(*) FROM workflow_instances WHERE workflow_id = w.id AND status = 'in_progress') as in_progress_steps
       FROM workflows w
       WHERE w.entity_type = ? AND w.entity_id = ? AND w.status = 'active'
       ORDER BY w.created_at DESC
       LIMIT 1`,
      [entityType, entityId]
    );

    if (workflow) {
      const steps = await allQuery(
        `SELECT wi.*, ws.name, ws.assigned_to_role, ws.requires_approval
         FROM workflow_instances wi
         JOIN workflow_steps ws ON wi.step_id = ws.id
         WHERE wi.workflow_id = ?
         ORDER BY wi.order_index ASC`,
        [workflow.id]
      );

      return {
        ...workflow,
        steps,
        progress: workflow.total_steps > 0 
          ? Math.round((workflow.completed_steps / workflow.total_steps) * 100) 
          : 0
      };
    }

    return null;
  }

  /**
   * Create workflow template
   */
  static async createWorkflowTemplate(workflowType, name, description, steps) {
    const result = await runQuery(
      `INSERT INTO workflow_templates (workflow_type, name, description, created_at)
       VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
      [workflowType, name, description]
    );

    const templateId = result.lastID;

    // Create steps
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      await runQuery(
        `INSERT INTO workflow_steps (workflow_type, name, description, assigned_to_role, order_index, requires_approval)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          workflowType,
          step.name,
          step.description || '',
          step.assigned_to_role,
          i + 1,
          step.requires_approval || 0
        ]
      );
    }

    logger.info(`Workflow template ${templateId} created for ${workflowType}`);
    return templateId;
  }
}

module.exports = WorkflowEngine;
