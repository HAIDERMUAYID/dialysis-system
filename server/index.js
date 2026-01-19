const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const helmet = require('helmet');
const compression = require('compression');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5001; // Changed to 5001 because 5000 is used by macOS ControlCenter

// Trust proxy for rate limiting (required for Render)
app.set('trust proxy', 1);

// Initialize database
const db = require('./database/db');

// Initialize logger
const logger = require('./utils/logger');

// Initialize rate limiters
const { apiLimiter, authLimiter } = require('./utils/rateLimiter');

// Flag to track database initialization
let dbInitialized = false;

// Security Middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable for development, enable in production
  crossOriginEmbedderPolicy: false
}));

// Compression middleware
app.use(compression());

// CORS configuration
const allowedOrigins = [
  process.env.CLIENT_URL,
  "http://localhost:3000",
  "https://hospital-frontend-wrxu.onrender.com",
  "https://hospital-frontend.onrender.com"
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV !== 'production') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Body parser middleware
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('user-agent')
  });
  next();
});

// Root endpoint - API information
app.get('/', (req, res) => {
  res.json({
    name: 'Al-Hakim Hospital Management System API',
    version: '2.0.0',
    status: 'running',
    message: 'API is running. Use /api/health for health check.',
    endpoints: {
      health: '/api/health',
      auth: '/api/auth',
      info: '/api/info'
    },
    documentation: 'This is the Backend API. Frontend should be at: ' + (process.env.CLIENT_URL || 'https://hospital-frontend-wrxu.onrender.com')
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Server is running', 
    dbInitialized,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API Info endpoint
app.get('/api/info', (req, res) => {
  res.json({
    name: 'Al-Hakim Hospital Management System',
    version: '2.0.0',
    description: 'Enterprise-level Hospital Management System',
    features: [
      'Real-time Updates',
      'Advanced Workflow Management',
      'Document Management',
      'Analytics & Reporting',
      'API Security',
      'Multi-language Support',
      'Backup & Recovery',
      'Webhook Integration'
    ],
    endpoints: {
      auth: '/api/auth',
      users: '/api/users',
      patients: '/api/patients',
      visits: '/api/visits',
      lab: '/api/lab',
      pharmacy: '/api/pharmacy',
      doctor: '/api/doctor',
      admin: '/api/admin',
      notifications: '/api/notifications',
      reports: '/api/reports',
      analytics: '/api/analytics',
      workflows: '/api/workflows',
      documents: '/api/documents',
      webhooks: '/api/webhooks'
    }
  });
});

// Middleware to check if database is initialized (only for non-auth routes)
app.use((req, res, next) => {
  // Allow health check and auth routes even if DB is not ready
  if (req.path === '/api/health' || req.path.startsWith('/api/auth')) {
    return next();
  }
  
  if (!dbInitialized) {
    return res.status(503).json({ 
      error: 'قاعدة البيانات غير مهيأة. يرجى الانتظار قليلاً ثم المحاولة مرة أخرى' 
    });
  }
  
  next();
});

// Apply rate limiting to API routes
app.use('/api/', apiLimiter);
app.use('/api/auth', authLimiter);

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/patients', require('./routes/patients'));
app.use('/api/visits', require('./routes/visits'));
app.use('/api/lab', require('./routes/lab'));
app.use('/api/lab', require('./routes/lab-catalog'));
app.use('/api/pharmacy', require('./routes/pharmacy'));
app.use('/api/pharmacy', require('./routes/pharmacy-catalog'));
app.use('/api/doctor', require('./routes/doctor'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/medical-reports', require('./routes/medical-reports'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/notifications', require('./routes/notifications').router);
app.use('/api/advanced-reports', require('./routes/advanced-reports'));
app.use('/api/search', require('./routes/search'));
app.use('/api/export', require('./routes/export'));

// Enterprise-level routes
app.use('/api/workflows', require('./routes/workflows'));
app.use('/api/backups', require('./routes/backups'));
app.use('/api/attachments', require('./routes/attachments'));
// app.use('/api/documents', require('./routes/documents'));
// app.use('/api/analytics', require('./routes/analytics'));
// app.use('/api/webhooks', require('./routes/webhooks'));

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    ip: req.ip
  });

  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' 
      ? 'حدث خطأ في الخادم' 
      : err.message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
});

// Serve static files from React app in production (before 404 handler)
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/build')));
  app.get('*', (req, res, next) => {
    // Only serve index.html for non-API routes
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(__dirname, '../client/build/index.html'));
    } else {
      next(); // Continue to 404 handler for API routes
    }
  });
}

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'الطريق غير موجود',
    path: req.path,
    method: req.method,
    message: req.path.startsWith('/api') 
      ? 'API endpoint not found. Check /api/info for available endpoints.'
      : 'Path not found.'
  });
});

// Initialize database first, then start server
db.init()
  .then(() => {
    console.log('Database initialized successfully');
    dbInitialized = true;

    // Start server only after database is initialized
    // Use process.env.PORT for Render (required), fallback to 5001 for local
    const serverPort = process.env.PORT || 5001;
    const server = app.listen(serverPort, '0.0.0.0', () => {
      logger.info(`🚀 Enterprise Hospital Management System`);
      logger.info(`Server is running on port ${serverPort}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`API available at: http://0.0.0.0:${serverPort}/api`);
      logger.info(`Health check: http://0.0.0.0:${serverPort}/api/health`);
      logger.info(`API Info: http://0.0.0.0:${serverPort}/api/info`);
      console.log(`✅ Server started successfully on port ${serverPort}`);
    });

    // Initialize Real-time Service (WebSocket)
    try {
      const RealtimeService = require('./services/realtime');
      const realtimeService = new RealtimeService(server);
      
      // Store realtime service for use in routes
      app.locals.realtimeService = realtimeService;

      logger.info('Real-time service initialized');
    } catch (error) {
      logger.error('Error initializing real-time service:', error);
      logger.warn('Real-time service will not be available');
    }

    // Initialize Scheduled Tasks (Cron Jobs)
    if (process.env.AUTO_BACKUP_ENABLED === 'true') {
      try {
        const cron = require('node-cron');
        const BackupService = require('./services/backup');
        const backupService = new BackupService();

        // Schedule daily backup at 2 AM
        cron.schedule(process.env.AUTO_BACKUP_SCHEDULE || '0 2 * * *', async () => {
          try {
            logger.info('Starting scheduled backup...');
            await backupService.createArchiveBackup(null); // System backup
            logger.info('Scheduled backup completed successfully');
          } catch (error) {
            logger.error('Error in scheduled backup:', error);
          }
        });

        // Schedule cleanup of old backups (weekly on Sunday at 3 AM)
        cron.schedule('0 3 * * 0', async () => {
          try {
            logger.info('Starting backup cleanup...');
            const daysOld = parseInt(process.env.BACKUP_RETENTION_DAYS || '30');
            await backupService.cleanupOldBackups(daysOld);
            logger.info('Backup cleanup completed successfully');
          } catch (error) {
            logger.error('Error in backup cleanup:', error);
          }
        });

        logger.info('Scheduled tasks initialized');
      } catch (error) {
        logger.error('Error initializing scheduled tasks:', error);
      }
    }

    // Handle server errors (e.g., port already in use)
    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        logger.error(`Port ${serverPort} is already in use!`);
        logger.error(`To fix this, you can:`);
        logger.error(`1. Stop the process: kill -9 $(lsof -ti:${serverPort})`);
        logger.error(`2. Or change the port in server/index.js or .env file`);
        process.exit(1);
      } else {
        logger.error('Server error:', error);
        console.error('Server error:', error);
        process.exit(1);
      }
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      logger.info('SIGTERM signal received: closing HTTP server');
      server.close(() => {
        logger.info('HTTP server closed');
        const db = require('./database/db');
        try {
          const dbInstance = db.getDb();
          if (dbInstance) {
            dbInstance.close((err) => {
              if (err) {
                logger.error('Error closing database:', err);
              } else {
                logger.info('Database connection closed');
              }
              process.exit(0);
            });
          } else {
            process.exit(0);
          }
        } catch (error) {
          logger.error('Error accessing database:', error);
          process.exit(0);
        }
      });
    });

    process.on('SIGINT', () => {
      logger.info('SIGINT signal received: closing HTTP server');
      server.close(() => {
        logger.info('HTTP server closed');
        const db = require('./database/db');
        try {
          const dbInstance = db.getDb();
          if (dbInstance) {
            dbInstance.close((err) => {
              if (err) {
                logger.error('Error closing database:', err);
              } else {
                logger.info('Database connection closed');
              }
              process.exit(0);
            });
          } else {
            process.exit(0);
          }
        } catch (error) {
          logger.error('Error accessing database:', error);
          process.exit(0);
        }
      });
    });
  })
  .catch((error) => {
    logger.error('Failed to initialize database:', error);
    console.error('Failed to initialize database:', error);
    console.error('Error details:', error.message);
    console.error('Stack:', error.stack);
    logger.error('Server will not start without database');
    process.exit(1);
  });
