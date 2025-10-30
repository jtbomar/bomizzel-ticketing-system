import { Request, Response, NextFunction } from 'express';
import { UsageTrackingService } from '@/services/UsageTrackingService';
import { AppError } from '@/middleware/errorHandler';
import { logger } from '@/utils/logger';

/**
 * Middleware to check if user can create a new ticket
 */
export const checkTicketCreationLimit = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.id;
    
    const canCreateResult = await UsageTrackingService.canCreateTicket(userId);
    
    if (!canCreateResult.canCreate) {
      logger.warn('Ticket creation blocked due to subscription limits', {
        userId,
        reason: canCreateResult.reason,
        limitType: canCreateResult.limitType,
        usage: canCreateResult.usage,
        limits: canCreateResult.limits
      });

      // Return detailed error with upgrade information
      throw new AppError(
        canCreateResult.reason || 'Ticket creation limit reached',
        403,
        'SUBSCRIPTION_LIMIT_REACHED',
        {
          limitType: canCreateResult.limitType,
          usage: canCreateResult.usage,
          limits: canCreateResult.limits,
          upgradeRequired: true,
          message: 'You have reached your subscription limit. Please upgrade your plan to create more tickets.'
        }
      );
    }

    // Add usage information to request for potential use in response
    req.subscriptionUsage = {
      usage: canCreateResult.usage,
      limits: canCreateResult.limits
    };

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware to check if user can complete a ticket
 */
export const checkTicketCompletionLimit = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.id;
    
    const canCompleteResult = await UsageTrackingService.canCompleteTicket(userId);
    
    if (!canCompleteResult.canComplete) {
      logger.warn('Ticket completion blocked due to subscription limits', {
        userId,
        reason: canCompleteResult.reason,
        usage: canCompleteResult.usage,
        limits: canCompleteResult.limits
      });

      throw new AppError(
        canCompleteResult.reason || 'Ticket completion limit reached',
        403,
        'SUBSCRIPTION_LIMIT_REACHED',
        {
          limitType: 'completed',
          usage: canCompleteResult.usage,
          limits: canCompleteResult.limits,
          upgradeRequired: true,
          message: 'You have reached your completed ticket limit. Please upgrade your plan or archive some completed tickets.'
        }
      );
    }

    // Add usage information to request
    req.subscriptionUsage = {
      usage: canCompleteResult.usage,
      limits: canCompleteResult.limits
    };

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware to track ticket creation
 */
export const trackTicketCreation = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.id;
    
    // Store original res.json to intercept response
    const originalJson = res.json;
    
    res.json = function(body: any) {
      // Check if ticket was successfully created
      if (res.statusCode === 201 && body.success && body.data && body.data.id) {
        const ticketId = body.data.id;
        
        // Track ticket creation asynchronously
        UsageTrackingService.recordTicketCreation(userId, ticketId, {
          title: body.data.title,
          companyId: body.data.companyId,
          teamId: body.data.teamId
        }).catch(error => {
          logger.error('Failed to track ticket creation', { userId, ticketId, error });
        });
      }
      
      // Call original json method
      return originalJson.call(this, body);
    };

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware to track ticket status changes
 */
export const trackTicketStatusChange = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.id;
    const ticketId = req.params.id;
    
    // Get current ticket status before update (if this is a status change)
    let previousStatus: string | undefined;
    
    if (req.body.status || req.path.includes('/status')) {
      try {
        // We'll need to get the current status from the ticket
        // This will be handled in the service layer
        previousStatus = req.body.previousStatus;
      } catch (error) {
        logger.warn('Could not get previous status for tracking', { ticketId, error });
      }
    }
    
    // Store original res.json to intercept response
    const originalJson = res.json;
    
    res.json = function(body: any) {
      // Check if ticket was successfully updated
      if (res.statusCode === 200 && body.success && body.data) {
        const newStatus = body.data.status;
        
        // Track status change if status was modified
        if (newStatus && (req.body.status || req.path.includes('/status'))) {
          UsageTrackingService.recordTicketStatusChange(
            userId, 
            ticketId, 
            previousStatus || 'unknown', 
            newStatus,
            {
              updatedBy: userId,
              endpoint: req.path,
              method: req.method
            }
          ).catch(error => {
            logger.error('Failed to track ticket status change', { 
              userId, 
              ticketId, 
              previousStatus, 
              newStatus, 
              error 
            });
          });
        }
      }
      
      // Call original json method
      return originalJson.call(this, body);
    };

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware to add usage warnings to responses
 */
export const addUsageWarnings = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.id;
    
    // Store original res.json to intercept response
    const originalJson = res.json;
    
    res.json = function(body: any) {
      // Only add warnings to successful responses
      if (res.statusCode < 400 && body.success) {
        // Get usage percentages asynchronously and add to response
        UsageTrackingService.getUsagePercentages(userId)
          .then(percentages => {
            // Add usage warnings if approaching limits
            const warnings = [];
            
            if (percentages.active >= 90) {
              warnings.push({
                type: 'active_tickets_limit',
                message: 'You are approaching your active ticket limit',
                percentage: percentages.active,
                severity: 'high'
              });
            } else if (percentages.active >= 75) {
              warnings.push({
                type: 'active_tickets_limit',
                message: 'You are approaching your active ticket limit',
                percentage: percentages.active,
                severity: 'medium'
              });
            }
            
            if (percentages.completed >= 90) {
              warnings.push({
                type: 'completed_tickets_limit',
                message: 'You are approaching your completed ticket limit',
                percentage: percentages.completed,
                severity: 'high'
              });
            } else if (percentages.completed >= 75) {
              warnings.push({
                type: 'completed_tickets_limit',
                message: 'You are approaching your completed ticket limit',
                percentage: percentages.completed,
                severity: 'medium'
              });
            }
            
            if (percentages.total >= 90) {
              warnings.push({
                type: 'total_tickets_limit',
                message: 'You are approaching your total ticket limit',
                percentage: percentages.total,
                severity: 'high'
              });
            } else if (percentages.total >= 75) {
              warnings.push({
                type: 'total_tickets_limit',
                message: 'You are approaching your total ticket limit',
                percentage: percentages.total,
                severity: 'medium'
              });
            }
            
            if (warnings.length > 0) {
              body.subscriptionWarnings = warnings;
            }
          })
          .catch(error => {
            logger.error('Failed to get usage percentages for warnings', { userId, error });
          });
      }
      
      // Call original json method
      return originalJson.call(this, body);
    };

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Combined middleware for ticket operations that need both limit checking and tracking
 */
export const enforceAndTrackTicketCreation = [
  checkTicketCreationLimit,
  trackTicketCreation,
  addUsageWarnings
];

/**
 * Combined middleware for ticket status changes that need both limit checking and tracking
 */
export const enforceAndTrackTicketStatusChange = [
  trackTicketStatusChange,
  addUsageWarnings
];

/**
 * Middleware to check subscription limits for ticket completion specifically
 */
export const enforceAndTrackTicketCompletion = [
  checkTicketCompletionLimit,
  trackTicketStatusChange,
  addUsageWarnings
];

// Extend Request interface to include subscription usage data
declare global {
  namespace Express {
    interface Request {
      subscriptionUsage?: {
        usage?: {
          activeTickets: number;
          completedTickets: number;
          totalTickets: number;
          archivedTickets: number;
        };
        limits?: {
          activeTickets: number;
          completedTickets: number;
          totalTickets: number;
        };
      };
    }
  }
}