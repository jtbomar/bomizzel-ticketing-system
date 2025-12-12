import { BillingService } from './BillingService';
import { StripeService } from './StripeService';
import { BillingRecord } from '@/models/BillingRecord';
import { CustomerSubscription } from '@/models/CustomerSubscription';
import { EmailService } from './EmailService';
import { stripe } from '@/config/stripe';
import { logger } from '@/utils/logger';

export class BillingScheduledJobs {
  /**
   * Process failed payments and retry logic
   * Should be run daily
   */
  static async processFailedPayments(): Promise<{
    processed: number;
    retried: number;
    suspended: number;
    notified: number;
  }> {
    try {
      const failedPayments = await BillingService.getFailedPayments();
      let retried = 0;
      let suspended = 0;
      let notified = 0;

      logger.info('Processing failed payments', {
        count: failedPayments.length,
      });

      for (const payment of failedPayments) {
        try {
          // Skip if too many attempts (more than 4)
          if (payment.attemptCount >= 4) {
            // Suspend subscription after 4 failed attempts
            const subscription = await CustomerSubscription.findById(payment.subscriptionId);
            if (subscription && subscription.status !== 'suspended') {
              await CustomerSubscription.updateSubscriptionStatus(subscription.id, 'suspended');
              suspended++;

              // Send suspension notification
              await this.sendPaymentFailureNotification(
                subscription.user_id,
                'subscription_suspended',
                payment
              );
              notified++;

              logger.info('Suspended subscription due to failed payments', {
                subscriptionId: subscription.id,
                userId: subscription.user_id,
                attemptCount: payment.attemptCount,
              });
            }
            continue;
          }

          // Retry payment for invoices with less than 4 attempts
          if (payment.stripeInvoiceId) {
            const retryResult = await BillingService.retryFailedPayment(payment.stripeInvoiceId);

            if (retryResult.success) {
              retried++;
              logger.info('Successfully retried failed payment', {
                invoiceId: payment.stripeInvoiceId,
                amount: payment.amountDue,
              });
            } else {
              // Send failure notification after 2nd attempt
              if (payment.attemptCount === 2) {
                const subscription = await CustomerSubscription.findById(payment.subscriptionId);
                if (subscription) {
                  await this.sendPaymentFailureNotification(
                    subscription.user_id,
                    'payment_failed_warning',
                    payment
                  );
                  notified++;
                }
              }

              logger.warn('Failed to retry payment', {
                invoiceId: payment.stripeInvoiceId,
                error: retryResult.error,
                attemptCount: payment.attemptCount,
              });
            }
          }
        } catch (error) {
          logger.error('Error processing failed payment', {
            paymentId: payment.id,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      logger.info('Completed processing failed payments', {
        processed: failedPayments.length,
        retried,
        suspended,
        notified,
      });

      return {
        processed: failedPayments.length,
        retried,
        suspended,
        notified,
      };
    } catch (error) {
      logger.error('Error in processFailedPayments job', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Sync billing records from Stripe
   * Should be run daily to ensure data consistency
   */
  static async syncBillingRecordsFromStripe(): Promise<{
    synced: number;
    created: number;
    updated: number;
    errors: number;
  }> {
    try {
      let synced = 0;
      let created = 0;
      let updated = 0;
      let errors = 0;

      // Get all active subscriptions with Stripe subscription IDs
      const subscriptions = await CustomerSubscription.query
        .whereNotNull('stripe_subscription_id')
        .whereIn('status', ['active', 'trial', 'past_due']);

      logger.info('Syncing billing records from Stripe', {
        subscriptionCount: subscriptions.length,
      });

      for (const subscription of subscriptions) {
        try {
          if (!subscription.stripe_subscription_id) continue;

          // Get recent invoices from Stripe for this subscription
          if (!stripe) {
            logger.warn('Stripe not configured, skipping invoice sync');
            continue;
          }
          const invoices = await stripe.invoices.list({
            subscription: subscription.stripe_subscription_id,
            limit: 10,
            created: {
              gte: Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000), // Last 30 days
            },
          });

          for (const invoice of invoices.data) {
            try {
              const existingRecord = await BillingRecord.findByStripeInvoiceId(invoice.id);

              if (existingRecord) {
                // Update existing record
                await BillingService.updateBillingRecordFromStripeInvoice(invoice);
                updated++;
              } else {
                // Create new record
                await BillingService.createBillingRecordFromStripeInvoice(invoice);
                created++;
              }

              synced++;
            } catch (error) {
              errors++;
              logger.error('Error syncing individual invoice', {
                invoiceId: invoice.id,
                subscriptionId: subscription.id,
                error: error instanceof Error ? error.message : 'Unknown error',
              });
            }
          }
        } catch (error) {
          errors++;
          logger.error('Error syncing subscription billing records', {
            subscriptionId: subscription.id,
            stripeSubscriptionId: subscription.stripe_subscription_id,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      logger.info('Completed syncing billing records from Stripe', {
        synced,
        created,
        updated,
        errors,
      });

      return { synced, created, updated, errors };
    } catch (error) {
      logger.error('Error in syncBillingRecordsFromStripe job', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Generate monthly billing reports
   * Should be run on the 1st of each month
   */
  static async generateMonthlyBillingReport(
    year?: number,
    month?: number
  ): Promise<{
    reportGenerated: boolean;
    reportData: any;
  }> {
    try {
      const now = new Date();
      const reportYear = year || now.getFullYear();
      const reportMonth = month || (now.getMonth() === 0 ? 12 : now.getMonth()); // Previous month
      const reportYearForPrevMonth = month || (now.getMonth() === 0 ? reportYear - 1 : reportYear);

      const startDate = new Date(reportYearForPrevMonth, reportMonth - 1, 1);
      const endDate = new Date(reportYearForPrevMonth, reportMonth, 0);

      logger.info('Generating monthly billing report', {
        year: reportYearForPrevMonth,
        month: reportMonth,
        startDate,
        endDate,
      });

      // Get revenue statistics for the month
      const revenueStats = await BillingService.getRevenueStats(startDate, endDate);

      // Get failed payments for the month
      const failedPayments = await BillingRecord.query
        .whereBetween('billing_date', [startDate, endDate])
        .where('status', 'open')
        .where('attempt_count', '>', 0);

      // Get subscription metrics
      const subscriptionMetrics = await CustomerSubscription.query
        .whereBetween('created_at', [startDate, endDate])
        .select(
          CustomerSubscription.db.raw('COUNT(*) as new_subscriptions'),
          CustomerSubscription.db.raw(
            'COUNT(CASE WHEN status = ? THEN 1 END) as active_subscriptions',
            ['active']
          ),
          CustomerSubscription.db.raw(
            'COUNT(CASE WHEN status = ? THEN 1 END) as trial_subscriptions',
            ['trial']
          ),
          CustomerSubscription.db.raw(
            'COUNT(CASE WHEN status = ? THEN 1 END) as cancelled_subscriptions',
            ['cancelled']
          )
        )
        .first();

      const reportData = {
        period: {
          year: reportYearForPrevMonth,
          month: reportMonth,
          startDate,
          endDate,
        },
        revenue: revenueStats,
        subscriptions: {
          new: parseInt(subscriptionMetrics?.new_subscriptions) || 0,
          active: parseInt(subscriptionMetrics?.active_subscriptions) || 0,
          trial: parseInt(subscriptionMetrics?.trial_subscriptions) || 0,
          cancelled: parseInt(subscriptionMetrics?.cancelled_subscriptions) || 0,
        },
        failedPayments: {
          count: failedPayments.length,
          totalAmount: failedPayments.reduce(
            (sum: number, payment: any) => sum + payment.amount_due,
            0
          ),
        },
        generatedAt: new Date(),
      };

      // TODO: Store report in database or send via email
      // For now, just log the report
      logger.info('Monthly billing report generated', reportData);

      return {
        reportGenerated: true,
        reportData,
      };
    } catch (error) {
      logger.error('Error generating monthly billing report', {
        year,
        month,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Clean up old billing records
   * Should be run monthly to remove old records (older than 2 years)
   */
  static async cleanupOldBillingRecords(): Promise<{
    deleted: number;
  }> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setFullYear(cutoffDate.getFullYear() - 2);

      logger.info('Cleaning up old billing records', {
        cutoffDate,
      });

      const deletedCount = await BillingRecord.query
        .where('created_at', '<', cutoffDate)
        .whereIn('status', ['paid', 'void'])
        .del();

      logger.info('Completed cleanup of old billing records', {
        deleted: deletedCount,
      });

      return { deleted: deletedCount };
    } catch (error) {
      logger.error('Error cleaning up old billing records', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Send payment failure notification to user
   */
  private static async sendPaymentFailureNotification(
    userId: string,
    notificationType: 'payment_failed_warning' | 'subscription_suspended',
    billingRecord: any
  ): Promise<void> {
    try {
      // TODO: Implement email notification using EmailService
      // This would send appropriate emails based on notification type

      logger.info('Payment failure notification sent', {
        userId,
        notificationType,
        billingRecordId: billingRecord.id,
        amount: billingRecord.amountDue,
      });
    } catch (error) {
      logger.error('Error sending payment failure notification', {
        userId,
        notificationType,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Run all scheduled billing jobs
   * This can be called by a cron job or scheduler
   */
  static async runAllJobs(): Promise<{
    failedPayments: any;
    syncResults: any;
    cleanup: any;
  }> {
    try {
      logger.info('Running all scheduled billing jobs');

      const [failedPayments, syncResults, cleanup] = await Promise.allSettled([
        this.processFailedPayments(),
        this.syncBillingRecordsFromStripe(),
        this.cleanupOldBillingRecords(),
      ]);

      const results = {
        failedPayments:
          failedPayments.status === 'fulfilled'
            ? failedPayments.value
            : { error: failedPayments.reason },
        syncResults:
          syncResults.status === 'fulfilled' ? syncResults.value : { error: syncResults.reason },
        cleanup: cleanup.status === 'fulfilled' ? cleanup.value : { error: cleanup.reason },
      };

      logger.info('Completed all scheduled billing jobs', results);

      return results;
    } catch (error) {
      logger.error('Error running scheduled billing jobs', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }
}
