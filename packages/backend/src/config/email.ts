import { EmailService, EmailConfig } from '@/services/EmailService';
import { ResendTransport } from '@/services/ResendTransport';

export function initializeEmailService(): void {
  // Resend over HTTPS when a key is set. Railway blocks outbound SMTP on the
  // Free/Trial/Hobby plans, so the SMTP settings below can't reach Gmail there.
  const resendKey = process.env['RESEND_API_KEY'];
  if (resendKey) {
    EmailService.initializeWithTransport(new ResendTransport(resendKey) as any, {
      host: 'api.resend.com',
      port: 443,
      secure: true,
      auth: { user: 'resend', pass: '' },
      from:
        process.env['EMAIL_FROM'] || process.env['SMTP_FROM'] || 'Bomizzel <noreply@bomizzel.com>',
    });
    console.log('Email service initialized (Resend)');
    return;
  }

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
