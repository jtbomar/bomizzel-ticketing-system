import { TrialManagementService } from '@/services/TrialManagementService';
import { logger } from '@/utils/logger';

export class TrialScheduledJobs {
  private static reminderJobRunning = false;
  private static expiredTrialJobRunning = false;

  /**
   * Daily job to send trial reminder emails
   * Should be scheduled to run once per day
   */
  static async sendTrialReminders(): Promise<void> {
    if (this.reminderJobRunning) {
      logger.warn('Trial reminder job already running, skipping');
      return;
    }

    this.reminderJobRunning = true;
    
    try {
      logger.info('Starting trial reminder job');
      const result = await TrialManagementService.sendTrialReminders();
      
      logger.info('Trial reminder job completed', {
        sent: result.sent,
        errors: result.errors
      });
    } catch (error) {
      logger.error('Error in trial reminder job', { error });
    } finally {
      this.reminderJobRunning = false;
    }
  }

  /**
   * Daily job to process expired trials
   * Should be scheduled to run once per day
   */
  static async processExpiredTrials(): Promise<void> {
    if (this.expiredTrialJobRunning) {
      logger.warn('Expired trial processing job already running, skipping');
      return;
    }

    this.expiredTrialJobRunning = true;
    
    try {
      logger.info('Starting expired trial processing job');
      const result = await TrialManagementService.processExpiredTrials();
      
      logger.info('Expired trial processing job completed', {
        processed: result.processed,
        cancelled: result.cancelled,
        convertedToFree: result.convertedToFree,
        errors: result.errors
      });
    } catch (error) {
      logger.error('Error in expired trial processing job', { error });
    } finally {
      this.expiredTrialJobRunning = false;
    }
  }

  /**
   * Combined daily job that runs both reminder and expired trial processing
   */
  static async runDailyTrialJobs(): Promise<void> {
    logger.info('Starting daily trial jobs');
    
    try {
      // Run jobs sequentially to avoid conflicts
      await this.sendTrialReminders();
      await this.processExpiredTrials();
      
      logger.info('Daily trial jobs completed successfully');
    } catch (error) {
      logger.error('Error in daily trial jobs', { error });
    }
  }

  /**
   * Initialize scheduled jobs
   * This would typically be called from your main application startup
   */
  static initializeScheduledJobs(): void {
    // Example using node-cron (you would need to install it)
    // const cron = require('node-cron');
    
    // Run daily at 9:00 AM
    // cron.schedule('0 9 * * *', () => {
    //   this.runDailyTrialJobs();
    // });

    logger.info('Trial scheduled jobs initialized');
  }

  /**
   * Get job status for monitoring
   */
  static getJobStatus(): {
    reminderJobRunning: boolean;
    expiredTrialJobRunning: boolean;
  } {
    return {
      reminderJobRunning: this.reminderJobRunning,
      expiredTrialJobRunning: this.expiredTrialJobRunning
    };
  }
}