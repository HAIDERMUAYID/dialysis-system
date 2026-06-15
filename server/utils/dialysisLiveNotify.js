const dialysisLiveHub = require('../services/dialysisLiveHub');

/**
 * Push live-hall refresh signal to WebSocket rooms and SSE subscribers.
 * @param {import('express').Request} req
 * @param {number} hospitalId
 * @param {string} [reason]
 */
function notifyDialysisLiveChange(req, hospitalId, reason = 'update') {
  if (!Number.isFinite(hospitalId)) return;
  const meta = { hospitalId, reason };

  const realtime = req.app?.locals?.realtimeService;
  if (realtime && typeof realtime.broadcastDialysisLiveChange === 'function') {
    realtime.broadcastDialysisLiveChange(hospitalId, meta);
  }

  dialysisLiveHub.broadcast([hospitalId], meta);
}

/**
 * @param {import('express').Request} req
 * @param {{ closedCount?: number, hospitalIds?: number[] }} result
 */
function notifyDialysisLiveAfterAutoComplete(req, result) {
  if (!result?.closedCount || !Array.isArray(result.hospitalIds)) return;
  for (const hid of result.hospitalIds) {
    notifyDialysisLiveChange(req, hid, 'auto-complete');
  }
}

module.exports = { notifyDialysisLiveChange, notifyDialysisLiveAfterAutoComplete };
