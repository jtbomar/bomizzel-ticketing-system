import { EmailService, EmailConfig } from '@/services/EmailService';

export function initializeEmailService(): void {
  const emailConfig: EmailConfig = {
    host: process.env['SMTP_HOST'] || 'localhost',
    port: parseInt(process.env['SMTP_PORT'] || '587', 10),
    secure: process.env['SMTP_SECURE'] === 'true',
    auth: {
      user: process.env['SMTP_USER'] || '',
      pass: process.env['SMTP_PASS'] || '',
    },
    from: process.env['SMTP_FROM'] || 'noreply@bomizzel.com',
  };

  // Only initialize if SMTP configuration is provided
  if (emailConfig.auth.user && emailConfig.auth.pass) {
    EmailService.initialize(emailConfig);
    console.log('Email service initialized successfully');
  } else {
    console.warn('Email service not initialized - missing SMTP configuration');
  }
}

export function getEmailConfig(): EmailConfig | null {
  return {
    host: process.env['SMTP_HOST'] || 'localhost',
    port: parseInt(process.env['SMTP_PORT'] || '587', 10),
    secure: process.env['SMTP_SECURE'] === 'true',
    auth: {
      user: process.env['SMTP_USER'] || '',
      pass: process.env['SMTP_PASS'] || '',
    },
    from: process.env['SMTP_FROM'] || 'noreply@bomizzel.com',
  };
}