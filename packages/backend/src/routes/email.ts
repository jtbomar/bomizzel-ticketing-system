import { Router, Request, Response, NextFunction } from 'express';
import { EmailService, SendEmailRequest } from '@/services/EmailService';
import { EmailTemplateService } from '@/services/EmailTemplateService';
import { authenticate } from '@/middleware/auth';
import { validateRequest } from '@/utils/validation';

const router = Router();

// All email routes require authentication
router.use(authenticate);

/**
 * Send email from ticket
 * POST /tickets/:ticketId/email
 */
router.post(
  '/tickets/:ticketId/email',
  validateRequest({
    params: {
      ticketId: { type: 'string', required: true, format: 'uuid' },
    },
    body: {
      to: { type: 'array', required: true },
      cc: { type: 'array', required: false },
      bcc: { type: 'array', required: false },
      subject: { type: 'string', required: true, minLength: 1 },
      htmlBody: { type: 'string', required: false },
      textBody: { type: 'string', required: false },
      templateId: { type: 'string', required: false, format: 'uuid' },
      templateVariables: { type: 'object', required: false },
      replyTo: { type: 'string', required: false, format: 'email' },
      inReplyTo: { type: 'string', required: false },
      references: { type: 'array', required: false },
    },
  }),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { ticketId } = req.params;
      const {
        to,
        cc,
        bcc,
        subject,
        htmlBody,
        textBody,
        templateId,
        templateVariables,
        replyTo,
        inReplyTo,
        references,
      } = req.body;
      const userId = req.user!.id;

      let finalSubject = subject;
      let finalHtmlBody = htmlBody;
      let finalTextBody = textBody;

      // If template is specified, render it
      if (templateId) {
        const renderedTemplate = await EmailTemplateService.renderTemplate(
          templateId,
          templateVariables || {}
        );

        if (!renderedTemplate) {
          return res.status(404).json({
            success: false,
            error: {
              code: 'TEMPLATE_NOT_FOUND',
              message: 'Email template not found',
            },
          });
        }

        finalSubject = renderedTemplate.subject;
        finalHtmlBody = renderedTemplate.htmlBody;
        finalTextBody = renderedTemplate.textBody;
      }

      // Validate that we have at least one body type
      if (!finalHtmlBody && !finalTextBody) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_BODY',
            message: 'Either htmlBody or textBody is required',
          },
        });
      }

      const emailRequest: SendEmailRequest = {
        ticketId,
        to,
        cc,
        bcc,
        subject: finalSubject,
        htmlBody: finalHtmlBody || '',
        textBody: finalTextBody || '',
        replyTo,
        inReplyTo,
        references,
      };

      const emailMetadata = await EmailService.sendTicketEmail(userId, emailRequest);

      res.json({
        success: true,
        data: {
          messageId: emailMetadata.messageId,
          sentAt: emailMetadata.sentAt,
          recipients: {
            to: emailMetadata.to,
            cc: emailMetadata.cc,
            bcc: emailMetadata.bcc,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Send ticket notification
 * POST /tickets/:ticketId/notify
 */
router.post(
  '/tickets/:ticketId/notify',
  validateRequest({
    params: {
      ticketId: { type: 'string', required: true, format: 'uuid' },
    },
    body: {
      type: {
        type: 'string',
        required: true,
        enum: ['created', 'updated', 'assigned', 'resolved', 'closed'],
      },
      recipients: { type: 'array', required: true },
      message: { type: 'string', required: false },
      additionalData: { type: 'object', required: false },
    },
  }),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { ticketId } = req.params;
      const { type, recipients, message, additionalData } = req.body;

      await EmailService.sendTicketNotification(ticketId, type, recipients, {
        message,
        ...additionalData,
      });

      res.json({
        success: true,
        message: 'Notification sent successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get email service status
 * GET /email/status
 */
router.get('/email/status', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const isInitialized = EmailService.isInitialized();
    let isConnected = false;

    if (isInitialized) {
      isConnected = await EmailService.verifyConnection();
    }

    const config = await EmailService.getEmailConfig();

    res.json({
      success: true,
      data: {
        isInitialized,
        isConnected,
        config: config
          ? {
              host: config.host,
              port: config.port,
              secure: config.secure,
              from: config.from,
            }
          : null,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Create email template
 * POST /email/templates
 */
router.post(
  '/email/templates',
  validateRequest({
    body: {
      name: { type: 'string', required: true, minLength: 1, maxLength: 255 },
      subject: { type: 'string', required: true, minLength: 1 },
      htmlBody: { type: 'string', required: false },
      textBody: { type: 'string', required: false },
      variables: { type: 'array', required: false },
    },
  }),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const templateData = req.body;

      // Validate template
      const validation = await EmailTemplateService.validateTemplate({
        subject: templateData.subject,
        htmlBody: templateData.htmlBody || '',
        textBody: templateData.textBody || '',
      });

      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_TEMPLATE',
            message: 'Template validation failed',
            details: validation.errors,
          },
        });
      }

      const template = await EmailTemplateService.createTemplate(templateData);

      res.status(201).json({
        success: true,
        data: template,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get all email templates
 * GET /email/templates
 */
router.get(
  '/email/templates',
  validateRequest({
    query: {
      activeOnly: { type: 'boolean', required: false },
    },
  }),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { activeOnly } = req.query;

      const templates =
        activeOnly === 'true'
          ? await EmailTemplateService.getActiveTemplates()
          : await EmailTemplateService.getAllTemplates();

      res.json({
        success: true,
        data: templates,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get email template by ID
 * GET /email/templates/:templateId
 */
router.get(
  '/email/templates/:templateId',
  validateRequest({
    params: {
      templateId: { type: 'string', required: true, format: 'uuid' },
    },
  }),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { templateId } = req.params;

      const template = await EmailTemplateService.getTemplateById(templateId);

      if (!template) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'TEMPLATE_NOT_FOUND',
            message: 'Email template not found',
          },
        });
      }

      res.json({
        success: true,
        data: template,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Update email template
 * PUT /email/templates/:templateId
 */
router.put(
  '/email/templates/:templateId',
  validateRequest({
    params: {
      templateId: { type: 'string', required: true, format: 'uuid' },
    },
    body: {
      name: { type: 'string', required: false, minLength: 1, maxLength: 255 },
      subject: { type: 'string', required: false, minLength: 1 },
      htmlBody: { type: 'string', required: false },
      textBody: { type: 'string', required: false },
      variables: { type: 'array', required: false },
      isActive: { type: 'boolean', required: false },
    },
  }),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { templateId } = req.params;
      const updates = req.body;

      const template = await EmailTemplateService.updateTemplate(templateId, updates);

      if (!template) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'TEMPLATE_NOT_FOUND',
            message: 'Email template not found',
          },
        });
      }

      res.json({
        success: true,
        data: template,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Delete email template
 * DELETE /email/templates/:templateId
 */
router.delete(
  '/email/templates/:templateId',
  validateRequest({
    params: {
      templateId: { type: 'string', required: true, format: 'uuid' },
    },
  }),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { templateId } = req.params;

      const deleted = await EmailTemplateService.deleteTemplate(templateId);

      if (!deleted) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'TEMPLATE_NOT_FOUND',
            message: 'Email template not found',
          },
        });
      }

      res.json({
        success: true,
        message: 'Email template deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Render email template
 * POST /email/templates/:templateId/render
 */
router.post(
  '/email/templates/:templateId/render',
  validateRequest({
    params: {
      templateId: { type: 'string', required: true, format: 'uuid' },
    },
    body: {
      variables: { type: 'object', required: false },
    },
  }),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { templateId } = req.params;
      const { variables } = req.body;

      const rendered = await EmailTemplateService.renderTemplate(templateId, variables || {});

      if (!rendered) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'TEMPLATE_NOT_FOUND',
            message: 'Email template not found',
          },
        });
      }

      res.json({
        success: true,
        data: rendered,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get template variables reference
 * GET /email/template-variables
 */
router.get(
  '/email/template-variables',
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const variables = EmailTemplateService.getDefaultTemplateVariables();

      res.json({
        success: true,
        data: variables,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
