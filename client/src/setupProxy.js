const { createProxyMiddleware } = require('http-proxy-middleware');

/**
 * Proxy API only — do NOT proxy webpack HMR assets (hot-update.json, etc.).
 * A blanket package.json "proxy" breaks dev HMR and causes infinite reload loops.
 */
module.exports = function setupProxy(app) {
  app.use(
    '/api',
    createProxyMiddleware({
      target: 'http://localhost:5001',
      changeOrigin: true,
    })
  );
};
