const db = require('../database/db');

const logActivity = async (userId, action, entityType, entityId, details, req = null) => {
  try {
    // Log to activity_log
    try {
      if (db.prisma) {
        await db.prisma.activityLog.create({
          data: {
            userId,
            action,
            entityType,
            entityId,
            details: details || null,
            ipAddress: req?.ip || null
          }
        });
      } else {
        const { runQuery } = require('../database/db');
        await runQuery(
          `INSERT INTO activity_log (user_id, action, entity_type, entity_id, details, ip_address) 
           VALUES (?, ?, ?, ?, ?, ?)`,
          [userId, action, entityType, entityId, details, req?.ip || null]
        );
      }
    } catch (error) {
      // Silently fail if table doesn't exist or other non-critical errors
      if (!error.message?.includes('no such table') && !error.message?.includes('does not exist')) {
        console.error('Error logging to activity_log:', error);
      }
    }

    // Also log to audit_log (more detailed)
    try {
      const oldValues = req?.body?.old_values ? JSON.stringify(req.body.old_values) : null;
      const newValues = req?.body?.new_values ? JSON.stringify(req.body.new_values) : JSON.stringify(req?.body || {});
      
      if (db.prisma) {
        await db.prisma.auditLog.create({
          data: {
            userId,
            action,
            entityType,
            entityId,
            oldValues: oldValues || null,
            newValues: newValues || null,
            details: details || null,
            ipAddress: req?.ip || null,
            userAgent: req?.get('user-agent') || null
          }
        });
      } else {
        const { runQuery } = require('../database/db');
        await runQuery(
          `INSERT INTO audit_log (user_id, action, entity_type, entity_id, old_values, new_values, details, ip_address, user_agent) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [userId, action, entityType, entityId, oldValues, newValues, details || null, req?.ip || null, req?.get('user-agent') || null]
        );
      }
    } catch (error) {
      // Silently fail if table doesn't exist or other non-critical errors
      if (!error.message?.includes('no such table') && !error.message?.includes('does not exist')) {
        console.error('Error logging to audit_log:', error);
      }
    }
  } catch (error) {
    // Don't throw - activity logging should never break the main flow
    console.error('Error logging activity:', error);
  }
};

// Middleware factory for logging
const activityLogger = (action, entityType, detailsFn = null) => {
  return async (req, res, next) => {
    // Store original json method
    const originalJson = res.json.bind(res);
    
    // Override json method to log after response
    res.json = function(body) {
      // Call original json method first to send response
      const result = originalJson(body);
      
      // Log activity after response (non-blocking, don't affect response)
      if (req.user && req.user.id) {
        const entityId = req.params?.id || req.body?.id || body?.user?.id || body?.id || null;
        const details = detailsFn ? (typeof detailsFn === 'function' ? detailsFn(req, body) : detailsFn) : JSON.stringify(req.body || {});
        
        // Use setImmediate to ensure response is sent before logging
        setImmediate(() => {
          logActivity(req.user.id, action, entityType, entityId, details, req).catch(err => {
            // Silently fail - don't log to console to avoid noise
            // Only log if it's a critical error (not table missing, etc.)
            if (err.message && !err.message.includes('no such table') && !err.message.includes('does not exist') && !err.message.includes('Unknown argument')) {
              console.error('Error in activity logger (non-critical):', err.message);
            }
          });
        });
      }
      
      return result;
    };
    
    next();
  };
};

module.exports = { logActivity, activityLogger };
