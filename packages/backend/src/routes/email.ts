// @ts-nocheck
import { Router, Request, Response, NextFunction } from 'express';
import { EmailService, SendEmailRequest } from '@/services/EmailService';
import { EmailTemplateService } from '@/services/EmailTemplateService';
import { authenticate } from '@/middleware/auth';
import { validateRequest } from '@/utils/validation';

/**
 * Send email from ticket
 * POST /tickets/:ticketId/email
 */
// Two routers: this file serves ticket-scoped paths (/tickets/:ticketId/email)
// and email-scoped ones (/email/templates, /email/status).
//
// It used to be a single router mounted at "/", which made both families
// resolve correctly but applied authenticate to every /api request, so any
// unmatched path answered 401 instead of 404 and the frontend logged the user
// out. Mounting that same router at /email instead produced
// /api/email/email/templates, so the template endpoints 404d.
//
// ticketEmailRoutes is mounted at /tickets, emailRoutes at /email.

const router = Router();
router.use(authenticate);

const emailRouter = Router();
emailRouter.use(authenticate);

router.post(
  '/:ticketId/email',
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
          res.status(404).json({
            success: false,
            error: {
              code: 'TEMPLATE_NOT_FOUND',
              message: 'Email template not found',
            },
          });
          return;
        }

        finalSubject = renderedTemplate.subject;
        finalHtmlBody = renderedTemplate.htmlBody;
        finalTextBody = renderedTemplate.textBody;
      }

      // Validate that we have at least one body type
      if (!finalHtmlBody && !finalTextBody) {
        res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_BODY',
            message: 'Either htmlBody or textBody is required',
          },
        });
        return;
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
  '/:ticketId/notify',
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

emailRouter.get('/status', async (_req: Request, res: Response, next: NextFunction) => {
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

emailRouter.post(
  '/templates',
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
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_TEMPLATE',
            message: 'Template validation failed',
            details: validation.errors,
          },
        });
        return;
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

emailRouter.get(
  '/templates',
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

emailRouter.get(
  '/templates/:templateId',
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

emailRouter.put(
  '/templates/:templateId',
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

emailRouter.delete(
  '/templates/:templateId',
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

emailRouter.post(
  '/templates/:templateId/render',
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

emailRouter.get('/template-variables', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const variables = EmailTemplateService.getDefaultTemplateVariables();

    res.json({
      success: true,
      data: variables,
    });
  } catch (error) {
    next(error);
  }
});

export { emailRouter };
export default router;
