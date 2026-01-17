const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');

// Create logs directory if it doesn't exist
const fs = require('fs');
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...metadata }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(metadata).length > 0) {
      msg += ` ${JSON.stringify(metadata)}`;
    }
    return msg;
  })
);

// Create logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'hospital-system' },
  transports: [
    // Error log file
    new DailyRotateFile({
      filename: path.join(logsDir, 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxSize: '20m',
      maxFiles: '14d',
      zippedArchive: true
    }),
    // Combined log file
    new DailyRotateFile({
      filename: path.join(logsDir, 'combined-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '30d',
      zippedArchive: true
    }),
    // Access log file
    new DailyRotateFile({
      filename: path.join(logsDir, 'access-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      level: 'http',
      maxSize: '20m',
      maxFiles: '30d',
      zippedArchive: true
    })
  ],
  // Disable exception handlers to avoid system permission issues
  // exceptionHandlers: [
  //   new DailyRotateFile({
  //     filename: path.join(logsDir, 'exceptions-%DATE%.log'),
  //     datePattern: 'YYYY-MM-DD',
  //     maxSize: '20m',
  //     maxFiles: '14d',
  //     zippedArchive: true
  //   })
  // ],
  // rejectionHandlers: [
  //   new DailyRotateFile({
  //     filename: path.join(logsDir, 'rejections-%DATE%.log'),
  //     datePattern: 'YYYY-MM-DD',
  //     maxSize: '20m',
  //     maxFiles: '14d',
  //     zippedArchive: true
  //   })
  // ],
  // Handle uncaught exceptions manually
  exitOnError: false
});

// Add console transport in development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat,
    level: 'debug'
  }));
}

// Helper methods
logger.stream = {
  write: (message) => {
    logger.info(message.trim());
  }
};

// Handle uncaught exceptions manually (safer than winston's exception handlers)
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  // Don't exit - let the application handle it
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit - let the application handle it
});

module.exports = logger;
