import { UsageAlertService } from './UsageAlertService';
import { logger } from '@/utils/logger';

export class UsageMonitoringJob {
  private static intervalId: NodeJS.Timeout | null = null;
  private static isRunning = false;

  /**
   * Start the usage monitoring job
   * Runs every hour by default
   */
  static start(intervalMinutes: number = 60): void {
    if (this.intervalId) {
      logger.warn('Usage monitoring job is already running');
      return;
    }

    const intervalMs = intervalMinutes * 60 * 1000;

    logger.info('Starting usage monitoring job', { intervalMinutes });

    // Run immediately on start
    this.runCheck();

    // Schedule recurring checks
    this.intervalId = setInterval(() => {
      this.runCheck();
    }, intervalMs);
  }

  /**
   * Stop the usage monitoring job
   */
  static stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info('Usage monitoring job stopped');
    }
  }

  /**
   * Run a single usage check
   */
  static async runCheck(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Usage monitoring job is already running, skipping this cycle');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      logger.info('Starting scheduled usage monitoring check');

      await UsageAlertService.checkAllUsersUsage();

      const duration = Date.now() - startTime;
      logger.info('Completed scheduled usage monitoring check', {
        durationMs: duration,
      });
    } catch (error) {
      logger.error('Error in scheduled usage monitoring check', { error });
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Get job status
   */
  static getStatus(): {
    isScheduled: boolean;
    isRunning: boolean;
    nextRun?: Date;
  } {
    return {
      isScheduled: this.intervalId !== null,
      isRunning: this.isRunning,
      // Note: We can't easily get the next run time from setInterval
      // This would require a more sophisticated scheduler like node-cron
    };
  }
}
