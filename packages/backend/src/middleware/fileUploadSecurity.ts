import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from '@/utils/logger';
import { fileUploadRateLimiter } from './rateLimiter';

// File type validation
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/zip',
  'application/x-zip-compressed',
];

const DANGEROUS_EXTENSIONS = [
  '.exe',
  '.bat',
  '.cmd',
  '.com',
  '.pif',
  '.scr',
  '.vbs',
  '.js',
  '.jar',
  '.app',
  '.deb',
  '.pkg',
  '.dmg',
  '.rpm',
  '.msi',
  '.run',
  '.bin',
  '.sh',
  '.ps1',
  '.php',
  '.asp',
  '.aspx',
  '.jsp',
  '.py',
  '.rb',
  '.pl',
];

const MAX_FILE_SIZE = parseInt(process.env['MAX_FILE_SIZE'] || '10485760'); // 10MB
const MAX_FILES = parseInt(process.env['MAX_FILES_PER_REQUEST'] || '5');

/**
 * Multer configuration with security checks
 */
const storage = multer.memoryStorage();

const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  try {
    // Check MIME type
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      logger.warn('File upload blocked - invalid MIME type', {
        filename: file.originalname,
        mimetype: file.mimetype,
        userId: req.user?.id,
        ip: req.ip,
      });
      return cb(new Error(`File type ${file.mimetype} is not allowed`));
    }

    // Check file extension
    const ext = path.extname(file.originalname).toLowerCase();
    if (DANGEROUS_EXTENSIONS.includes(ext)) {
      logger.warn('File upload blocked - dangerous extension', {
        filename: file.originalname,
        extension: ext,
        userId: req.user?.id,
        ip: req.ip,
      });
      return cb(new Error(`File extension ${ext} is not allowed`));
    }

    // Check filename for path traversal attempts
    if (
      file.originalname.includes('..') ||
      file.originalname.includes('/') ||
      file.originalname.includes('\\')
    ) {
      logger.warn('File upload blocked - invalid filename', {
        filename: file.originalname,
        userId: req.user?.id,
        ip: req.ip,
      });
      return cb(new Error('Invalid filename'));
    }

    // Check for null bytes in filename
    if (file.originalname.includes('\0')) {
      logger.warn('File upload blocked - null byte in filename', {
        filename: file.originalname,
        userId: req.user?.id,
        ip: req.ip,
      });
      return cb(new Error('Invalid filename'));
    }

    cb(null, true);
  } catch (error) {
    logger.error('File filter error:', error);
    cb(new Error('File validation failed'));
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: MAX_FILES,
    fields: 10,
    fieldNameSize: 100,
    fieldSize: 1024 * 1024, // 1MB for form fields
  },
});

/**
 * File content security scanning middleware
 */
export const scanFileContent = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.file && !req.files) {
      return next();
    }

    const files = req.files
      ? Array.isArray(req.files)
        ? req.files
        : Object.values(req.files).flat()
      : [req.file];

    for (const file of files) {
      if (!file) continue;

      // Check for malicious content patterns
      await scanForMaliciousContent(file);

      // Validate file headers match MIME type
      await validateFileHeaders(file);
    }

    next();
  } catch (error) {
    logger.error('File content scanning error:', error);
    res.status(400).json({
      error: {
        code: 'FILE_SECURITY_ERROR',
        message: error instanceof Error ? error.message : 'File security check failed',
        timestamp: new Date().toISOString(),
        requestId: req.id || 'unknown',
      },
    });
  }
};

/**
 * Scan file content for malicious patterns
 */
async function scanForMaliciousContent(file: Express.Multer.File): Promise<void> {
  const content = file.buffer.toString('utf8', 0, Math.min(file.buffer.length, 1024));

  // Check for script tags and other dangerous patterns
  const maliciousPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /vbscript:/gi,
    /onload\s*=/gi,
    /onerror\s*=/gi,
    /onclick\s*=/gi,
    /eval\s*\(/gi,
    /document\.write/gi,
    /window\.location/gi,
    /%3Cscript/gi,
    /%3C%2Fscript%3E/gi,
  ];

  for (const pattern of maliciousPatterns) {
    if (pattern.test(content)) {
      throw new Error('File contains potentially malicious content');
    }
  }

  // Check for embedded executables (PE header)
  if (file.buffer.length >= 2) {
    const header = file.buffer.readUInt16LE(0);
    if (header === 0x5a4d) {
      // MZ header (PE executable)
      throw new Error('Executable files are not allowed');
    }
  }

  // Check for ZIP bomb indicators
  if (file.mimetype.includes('zip') && file.buffer.length > 0) {
    // Simple check for suspicious compression ratios
    const compressionRatio = file.size / file.buffer.length;
    if (compressionRatio > 100) {
      throw new Error('Suspicious compression ratio detected');
    }
  }
}

/**
 * Validate file headers match declared MIME type
 */
async function validateFileHeaders(file: Express.Multer.File): Promise<void> {
  if (file.buffer.length < 4) {
    return; // Too small to validate
  }

  const header = file.buffer.subarray(0, 4);

  // Common file signatures
  const signatures: Record<string, number[]> = {
    'image/jpeg': [0xff, 0xd8, 0xff],
    'image/png': [0x89, 0x50, 0x4e, 0x47],
    'image/gif': [0x47, 0x49, 0x46, 0x38],
    'application/pdf': [0x25, 0x50, 0x44, 0x46],
    'application/zip': [0x50, 0x4b, 0x03, 0x04],
    'application/x-zip-compressed': [0x50, 0x4b, 0x03, 0x04],
  };

  const expectedSignature = signatures[file.mimetype];
  if (expectedSignature) {
    const matches = expectedSignature.every(
      (byte, index) => index < header.length && header[index] === byte
    );

    if (!matches) {
      throw new Error(`File header does not match declared MIME type ${file.mimetype}`);
    }
  }
}

/**
 * File upload middleware with rate limiting and security
 */
export const secureFileUpload = [fileUploadRateLimiter, upload.single('file'), scanFileContent];

/**
 * Multiple file upload middleware with rate limiting and security
 */
export const secureMultipleFileUpload = [
  fileUploadRateLimiter,
  upload.array('files', MAX_FILES),
  scanFileContent,
];

/**
 * File upload error handler
 */
export const handleFileUploadError = (
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (error instanceof multer.MulterError) {
    let message = 'File upload error';
    let code = 'FILE_UPLOAD_ERROR';

    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        message = `File too large. Maximum size is ${MAX_FILE_SIZE} bytes`;
        code = 'FILE_TOO_LARGE';
        break;
      case 'LIMIT_FILE_COUNT':
        message = `Too many files. Maximum is ${MAX_FILES} files`;
        code = 'TOO_MANY_FILES';
        break;
      case 'LIMIT_UNEXPECTED_FILE':
        message = 'Unexpected file field';
        code = 'UNEXPECTED_FILE';
        break;
      case 'LIMIT_FIELD_COUNT':
        message = 'Too many form fields';
        code = 'TOO_MANY_FIELDS';
        break;
      case 'LIMIT_FIELD_SIZE':
        message = 'Form field too large';
        code = 'FIELD_TOO_LARGE';
        break;
    }

    logger.warn('File upload error', {
      error: error.code,
      message: error.message,
      userId: req.user?.id,
      ip: req.ip,
    });

    return res.status(400).json({
      error: {
        code,
        message,
        timestamp: new Date().toISOString(),
        requestId: req.id || 'unknown',
      },
    });
  }

  if (error.message) {
    return res.status(400).json({
      error: {
        code: 'FILE_VALIDATION_ERROR',
        message: error.message,
        timestamp: new Date().toISOString(),
        requestId: req.id || 'unknown',
      },
    });
  }

  next(error);
};
