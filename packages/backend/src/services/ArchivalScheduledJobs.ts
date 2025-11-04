import { AutomatedArchivalService } from './AutomatedArchivalService';
import { logger } from '@/utils/logger';

export class ArchivalScheduledJobs {
  private static isRunning = false;
  private static intervalId: NodeJS.Timeout | null = null;

  /**
   * Start the archival scheduler
   * Runs automated archival every 24 hours
   */
  static start(): void {
    if (this.isRunning) {
      logger.warn('Archival scheduler is already running');
      return;
    }

    logger.info('Starting archival scheduler');
    this.isRunning = true;

    // Run immediately on start
    this.runArchivalJob();

    // Schedule to run every 24 hours (86400000 ms)
    this.intervalId = setInterval(
      () => {
        this.runArchivalJob();
      },
      24 * 60 * 60 * 1000
    );
  }

  /**
   * Stop the archival scheduler
   */
  static stop(): void {
    if (!this.isRunning) {
      logger.warn('Archival scheduler is not running');
      return;
    }

    logger.info('Stopping archival scheduler');
    this.isRunning = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Run the archival job manually
   */
  static async runArchivalJob(): Promise<void> {
    try {
      logger.info('Running scheduled archival job');
      await AutomatedArchivalService.scheduleAutomatedArchival();
      logger.info('Scheduled archival job completed successfully');
    } catch (error) {
      logger.error('Error running scheduled archival job', { error });
    }
  }

  /**
   * Get scheduler status
   */
  static getStatus(): {
    isRunning: boolean;
    nextRun?: Date;
  } {
    return {
      isRunning: this.isRunning,
      nextRun: this.isRunning ? new Date(Date.now() + 24 * 60 * 60 * 1000) : undefined,
    };
  }
}
