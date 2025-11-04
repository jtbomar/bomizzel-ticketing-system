import winston from 'winston';
import * as fs from 'fs';
import * as path from 'path';

// Ensure logs directory exists
const logsDir = 'logs';
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Custom format for structured logging
const customFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
    return JSON.stringify({
      timestamp,
      level,
      service,
      message,
      ...meta,
    });
  })
);

const logger = winston.createLogger({
  level: process.env['LOG_LEVEL'] || 'info',
  format: customFormat,
  defaultMeta: {
    service: 'bomizzel-backend',
    environment: process.env['NODE_ENV'] || 'development',
    version: process.env['APP_VERSION'] || '1.0.0',
  },
  transports: [
    // Error logs
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      tailable: true,
    }),

    // Combined logs
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      tailable: true,
    }),

    // Security logs
    new winston.transports.File({
      filename: path.join(logsDir, 'security.log'),
      level: 'warn',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      tailable: true,
    }),

    // Performance logs
    new winston.transports.File({
      filename: path.join(logsDir, 'performance.log'),
      level: 'info',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 3,
      tailable: true,
    }),
  ],

  // Handle uncaught exceptions and rejections
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'exceptions.log'),
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 3,
    }),
  ],

  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'rejections.log'),
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 3,
    }),
  ],
});

// Add console transport for development
if (process.env['NODE_ENV'] !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
          return `${timestamp} [${level}]: ${message} ${metaStr}`;
        })
      ),
    })
  );
}

// Enhanced logging methods
export const enhancedLogger = {
  ...logger,

  // Security event logging
  security: (message: string, meta: any = {}) => {
    logger.warn(message, {
      ...meta,
      category: 'security',
      timestamp: new Date().toISOString(),
    });
  },

  // Performance logging
  performance: (message: string, meta: any = {}) => {
    logger.info(message, {
      ...meta,
      category: 'performance',
      timestamp: new Date().toISOString(),
    });
  },

  // Database operation logging
  database: (message: string, meta: any = {}) => {
    logger.info(message, {
      ...meta,
      category: 'database',
      timestamp: new Date().toISOString(),
    });
  },

  // API request logging
  api: (message: string, meta: any = {}) => {
    logger.info(message, {
      ...meta,
      category: 'api',
      timestamp: new Date().toISOString(),
    });
  },

  // Business logic logging
  business: (message: string, meta: any = {}) => {
    logger.info(message, {
      ...meta,
      category: 'business',
      timestamp: new Date().toISOString(),
    });
  },

  // Authentication logging
  auth: (message: string, meta: any = {}) => {
    logger.info(message, {
      ...meta,
      category: 'auth',
      timestamp: new Date().toISOString(),
    });
  },
};

export { logger };
