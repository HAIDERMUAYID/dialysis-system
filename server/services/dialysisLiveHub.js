/**
 * SSE hub for dialysis live hall updates (fallback when WebSocket unavailable).
 */
class DialysisLiveHub {
  constructor() {
    /** @type {Map<number, Set<import('express').Response>>} */
    this.byHospital = new Map();
    /** @type {WeakMap<import('express').Response, number[]>} */
    this.clientHospitals = new WeakMap();
  }

  subscribe(hospitalIds, res) {
    const ids = [...new Set(hospitalIds.filter((id) => Number.isFinite(id)))];
    this.clientHospitals.set(res, ids);
    for (const id of ids) {
      if (!this.byHospital.has(id)) this.byHospital.set(id, new Set());
      this.byHospital.get(id).add(res);
    }
  }

  unsubscribe(res) {
    const ids = this.clientHospitals.get(res) || [];
    for (const id of ids) {
      const set = this.byHospital.get(id);
      if (set) {
        set.delete(res);
        if (!set.size) this.byHospital.delete(id);
      }
    }
    this.clientHospitals.delete(res);
  }

  broadcast(hospitalIds, payload) {
    const data = JSON.stringify({
      ...payload,
      timestamp: payload.timestamp || new Date().toISOString(),
    });
    const line = `event: dialysis:live:changed\ndata: ${data}\n\n`;
    const notified = new Set();

    for (const id of hospitalIds) {
      const set = this.byHospital.get(id);
      if (!set) continue;
      for (const res of set) {
        if (notified.has(res)) continue;
        notified.add(res);
        try {
          res.write(line);
        } catch {
          this.unsubscribe(res);
        }
      }
    }
  }
}

module.exports = new DialysisLiveHub();
