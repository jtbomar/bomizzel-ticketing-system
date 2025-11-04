import { Router, Request, Response, NextFunction } from 'express';
import { TicketNoteService } from '@/services/TicketNoteService';
import { authenticate } from '@/middleware/auth';
import { validateRequest } from '@/utils/validation';
import { CreateNoteRequest } from '@/types/models';

const router = Router();

// All ticket note routes require authentication
router.use(authenticate);

/**
 * Create a new note for a ticket
 * POST /tickets/:ticketId/notes
 */
router.post(
  '/:ticketId/notes',
  validateRequest({
    params: {
      ticketId: { type: 'string', required: true, format: 'uuid' },
    },
    body: {
      content: { type: 'string', required: true, minLength: 1 },
      isInternal: { type: 'boolean', required: false },
    },
  }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { ticketId } = req.params;
      const noteData: CreateNoteRequest = req.body;
      const userId = req.user!.id;

      const note = await TicketNoteService.createNote(ticketId, userId, noteData);

      res.status(201).json({
        success: true,
        data: note,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get notes for a ticket
 * GET /tickets/:ticketId/notes
 */
router.get(
  '/:ticketId/notes',
  validateRequest({
    params: {
      ticketId: { type: 'string', required: true, format: 'uuid' },
    },
    query: {
      includeInternal: { type: 'boolean', required: false },
      page: { type: 'number', required: false, min: 1 },
      limit: { type: 'number', required: false, min: 1, max: 100 },
    },
  }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { ticketId } = req.params;
      const { includeInternal, page, limit } = req.query;
      const user = req.user!;

      // Customers cannot see internal notes
      const shouldIncludeInternal = user.role === 'customer' ? false : includeInternal === 'true';

      const result = await TicketNoteService.getTicketNotes(ticketId, {
        includeInternal: shouldIncludeInternal,
        page: page ? parseInt(page as string) : 1,
        limit: limit ? parseInt(limit as string) : 50,
      });

      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get a specific note
 * GET /notes/:noteId
 */
router.get(
  '/notes/:noteId',
  validateRequest({
    params: {
      noteId: { type: 'string', required: true, format: 'uuid' },
    },
  }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { noteId } = req.params;
      const user = req.user!;

      // Check if user has access to this note
      const hasAccess = await TicketNoteService.validateNoteAccess(
        noteId,
        user.id,
        user.role,
        user.companyIds || []
      );

      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Access denied to this note',
          },
        });
      }

      const note = await TicketNoteService.getNoteById(noteId);

      if (!note) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Note not found',
          },
        });
      }

      res.json({
        success: true,
        data: note,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Update a note
 * PUT /notes/:noteId
 */
router.put(
  '/notes/:noteId',
  validateRequest({
    params: {
      noteId: { type: 'string', required: true, format: 'uuid' },
    },
    body: {
      content: { type: 'string', required: false, minLength: 1 },
      isInternal: { type: 'boolean', required: false },
    },
  }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { noteId } = req.params;
      const updates = req.body;
      const userId = req.user!.id;

      const note = await TicketNoteService.updateNote(noteId, userId, updates);

      if (!note) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Note not found',
          },
        });
      }

      res.json({
        success: true,
        data: note,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Delete a note
 * DELETE /notes/:noteId
 */
router.delete(
  '/notes/:noteId',
  validateRequest({
    params: {
      noteId: { type: 'string', required: true, format: 'uuid' },
    },
  }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { noteId } = req.params;
      const userId = req.user!.id;

      const deleted = await TicketNoteService.deleteNote(noteId, userId);

      if (!deleted) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Note not found',
          },
        });
      }

      res.json({
        success: true,
        message: 'Note deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Search notes
 * GET /notes/search
 */
router.get(
  '/notes/search',
  validateRequest({
    query: {
      q: { type: 'string', required: false, minLength: 1 },
      ticketIds: { type: 'string', required: false }, // Comma-separated UUIDs
      authorId: { type: 'string', required: false, format: 'uuid' },
      isInternal: { type: 'boolean', required: false },
      isEmailGenerated: { type: 'boolean', required: false },
      page: { type: 'number', required: false, min: 1 },
      limit: { type: 'number', required: false, min: 1, max: 100 },
    },
  }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { q, ticketIds, authorId, isInternal, isEmailGenerated, page, limit } = req.query;
      const user = req.user!;

      // Parse ticket IDs if provided
      const ticketIdArray = ticketIds ? (ticketIds as string).split(',') : undefined;

      // Customers cannot search internal notes
      const shouldIncludeInternal = user.role === 'customer' ? false : isInternal === 'true';

      const searchOptions: any = {
        page: page ? parseInt(page as string) : 1,
        limit: limit ? parseInt(limit as string) : 50,
        isInternal: shouldIncludeInternal,
        isEmailGenerated: isEmailGenerated === 'true',
      };

      if (q) searchOptions.query = q as string;
      if (ticketIdArray) searchOptions.ticketIds = ticketIdArray;
      if (authorId) searchOptions.authorId = authorId as string;

      const result = await TicketNoteService.searchNotes(searchOptions);

      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get note history for a ticket
 * GET /tickets/:ticketId/notes/history
 */
router.get(
  '/:ticketId/notes/history',
  validateRequest({
    params: {
      ticketId: { type: 'string', required: true, format: 'uuid' },
    },
  }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { ticketId } = req.params;

      const history = await TicketNoteService.getNotesHistory(ticketId);

      res.json({
        success: true,
        data: history,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Link an attachment to a note
 * POST /notes/:noteId/attachments/:attachmentId
 */
router.post(
  '/notes/:noteId/attachments/:attachmentId',
  validateRequest({
    params: {
      noteId: { type: 'string', required: true, format: 'uuid' },
      attachmentId: { type: 'string', required: true, format: 'uuid' },
    },
  }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { noteId, attachmentId } = req.params;

      await TicketNoteService.linkAttachmentToNote(noteId, attachmentId);

      res.json({
        success: true,
        message: 'Attachment linked to note successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Unlink an attachment from a note
 * DELETE /notes/:noteId/attachments/:attachmentId
 */
router.delete(
  '/notes/:noteId/attachments/:attachmentId',
  validateRequest({
    params: {
      noteId: { type: 'string', required: true, format: 'uuid' },
      attachmentId: { type: 'string', required: true, format: 'uuid' },
    },
  }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { attachmentId } = req.params;

      await TicketNoteService.unlinkAttachmentFromNote(attachmentId);

      res.json({
        success: true,
        message: 'Attachment unlinked from note successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get attachments for a note
 * GET /notes/:noteId/attachments
 */
router.get(
  '/notes/:noteId/attachments',
  validateRequest({
    params: {
      noteId: { type: 'string', required: true, format: 'uuid' },
    },
  }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { noteId } = req.params;

      const attachments = await TicketNoteService.getNoteAttachments(noteId);

      res.json({
        success: true,
        data: attachments,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
