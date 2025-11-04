import Stripe from 'stripe';
import { BillingRecord, BillingLineItem } from '@/models/BillingRecord';
import { CustomerSubscription } from '@/models/CustomerSubscription';
import { StripeService } from './StripeService';
import { AppError } from '@/middleware/errorHandler';
import { logger } from '@/utils/logger';
import { BillingRecord as BillingRecordModel } from '@/types/models';

export interface PaymentRetryResult {
  success: boolean;
  billingRecord: BillingRecordModel;
  paymentIntent?: {
    id: string;
    status: string;
    clientSecret?: string;
  };
  error?: string;
}

export interface BillingStats {
  totalRevenue: number;
  paidInvoices: number;
  pendingRevenue: number;
  failedPayments: number;
  currency: string;
}

export class BillingService {
  /**
   * Create billing record from Stripe invoice
   */
  static async createBillingRecordFromStripeInvoice(
    stripeInvoice: Stripe.Invoice
  ): Promise<BillingRecordModel> {
    try {
      // Find the subscription
      const subscriptionId =
        typeof (stripeInvoice as any).subscription === 'string'
          ? (stripeInvoice as any).subscription
          : (stripeInvoice as any).subscription?.id;

      if (!subscriptionId) {
        throw new AppError('Invoice has no associated subscription', 400);
      }

      const localSubscription =
        await CustomerSubscription.findByStripeSubscriptionId(subscriptionId);
      if (!localSubscription) {
        throw new AppError('Local subscription not found', 404);
      }

      // Check if billing record already exists
      const existingRecord = await BillingRecord.findByStripeInvoiceId(stripeInvoice.id);
      if (existingRecord) {
        logger.info('Billing record already exists for invoice', {
          invoiceId: stripeInvoice.id,
          recordId: existingRecord.id,
        });
        return BillingRecord.toModel(existingRecord);
      }

      // Map Stripe invoice status to our status
      let status: 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';
      switch (stripeInvoice.status) {
        case 'draft':
          status = 'draft';
          break;
        case 'open':
          status = 'open';
          break;
        case 'paid':
          status = 'paid';
          break;
        case 'void':
          status = 'void';
          break;
        case 'uncollectible':
          status = 'uncollectible';
          break;
        default:
          status = 'draft';
      }

      // Extract line items
      const lineItems: BillingLineItem[] = stripeInvoice.lines.data.map((line) => ({
        id: line.id,
        description: line.description || '',
        amount: line.amount,
        currency: line.currency,
        quantity: line.quantity || 1,
        priceId: (line as any).price?.id || undefined,
        productId: (line as any).price?.product?.id || undefined,
      }));

      // Create billing record
      const billingRecord = await BillingRecord.createBillingRecord({
        subscriptionId: localSubscription.id,
        stripeInvoiceId: stripeInvoice.id,
        stripePaymentIntentId:
          typeof (stripeInvoice as any).payment_intent === 'object'
            ? (stripeInvoice as any).payment_intent?.id
            : (stripeInvoice as any).payment_intent || undefined,
        invoiceNumber: stripeInvoice.number || undefined,
        status,
        amountDue: stripeInvoice.amount_due,
        amountPaid: stripeInvoice.amount_paid,
        currency: stripeInvoice.currency,
        billingDate: new Date(stripeInvoice.created * 1000),
        dueDate: stripeInvoice.due_date ? new Date(stripeInvoice.due_date * 1000) : undefined,
        paidAt: stripeInvoice.status_transitions?.paid_at
          ? new Date(stripeInvoice.status_transitions.paid_at * 1000)
          : undefined,
        hostedInvoiceUrl: stripeInvoice.hosted_invoice_url || undefined,
        invoicePdfUrl: stripeInvoice.invoice_pdf || undefined,
        paymentMethodId:
          typeof stripeInvoice.default_payment_method === 'string'
            ? stripeInvoice.default_payment_method
            : undefined,
        lineItems,
        metadata: stripeInvoice.metadata || {},
      });

      logger.info('Created billing record from Stripe invoice', {
        invoiceId: stripeInvoice.id,
        recordId: billingRecord.id,
        amount: stripeInvoice.amount_due,
        status,
      });

      return BillingRecord.toModel(billingRecord);
    } catch (error) {
      logger.error('Error creating billing record from Stripe invoice', {
        invoiceId: stripeInvoice.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Update billing record from Stripe invoice
   */
  static async updateBillingRecordFromStripeInvoice(
    stripeInvoice: Stripe.Invoice
  ): Promise<BillingRecordModel> {
    try {
      const existingRecord = await BillingRecord.findByStripeInvoiceId(stripeInvoice.id);
      if (!existingRecord) {
        // Create new record if it doesn't exist
        return this.createBillingRecordFromStripeInvoice(stripeInvoice);
      }

      // Map Stripe invoice status to our status
      let status: 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';
      switch (stripeInvoice.status) {
        case 'draft':
          status = 'draft';
          break;
        case 'open':
          status = 'open';
          break;
        case 'paid':
          status = 'paid';
          break;
        case 'void':
          status = 'void';
          break;
        case 'uncollectible':
          status = 'uncollectible';
          break;
        default:
          status = 'draft';
      }

      // Update the record based on status
      let updatedRecord;
      if (status === 'paid') {
        const updateOptions = {
          amountPaid: stripeInvoice.amount_paid,
          paidAt: (stripeInvoice as any).status_transitions?.paid_at
            ? new Date((stripeInvoice as any).status_transitions.paid_at * 1000)
            : new Date(),
          paymentMethodId:
            typeof (stripeInvoice as any).default_payment_method === 'string'
              ? (stripeInvoice as any).default_payment_method
              : undefined,
          stripePaymentIntentId:
            typeof (stripeInvoice as any).payment_intent === 'object'
              ? (stripeInvoice as any).payment_intent?.id
              : (stripeInvoice as any).payment_intent || undefined,
        };
        updatedRecord = await BillingRecord.updatePaymentStatus(
          existingRecord.id,
          status,
          updateOptions
        );
      } else if (status === 'void') {
        const updateOptions = {
          voidedAt: new Date(),
          stripePaymentIntentId:
            typeof (stripeInvoice as any).payment_intent === 'object'
              ? (stripeInvoice as any).payment_intent?.id
              : (stripeInvoice as any).payment_intent || undefined,
        };
        updatedRecord = await BillingRecord.updatePaymentStatus(
          existingRecord.id,
          status,
          updateOptions
        );
      } else if (status === 'uncollectible') {
        const updateOptions = {
          stripePaymentIntentId:
            typeof (stripeInvoice as any).payment_intent === 'object'
              ? (stripeInvoice as any).payment_intent?.id
              : (stripeInvoice as any).payment_intent || undefined,
        };
        updatedRecord = await BillingRecord.updatePaymentStatus(
          existingRecord.id,
          status,
          updateOptions
        );
      } else {
        // For draft and open status, just update basic fields
        updatedRecord = await BillingRecord.update(existingRecord.id, {
          status,
          amount_paid: stripeInvoice.amount_paid,
          amount_remaining: stripeInvoice.amount_due - stripeInvoice.amount_paid,
          stripe_payment_intent_id:
            typeof (stripeInvoice as any).payment_intent === 'object'
              ? (stripeInvoice as any).payment_intent?.id
              : (stripeInvoice as any).payment_intent || undefined,
        });
      }

      if (!updatedRecord) {
        throw new AppError('Failed to update billing record', 500);
      }

      // Update invoice URLs if available
      if (stripeInvoice.hosted_invoice_url || stripeInvoice.invoice_pdf) {
        await BillingRecord.updateInvoiceUrls(
          existingRecord.id,
          stripeInvoice.hosted_invoice_url || undefined,
          stripeInvoice.invoice_pdf || undefined
        );
      }

      logger.info('Updated billing record from Stripe invoice', {
        invoiceId: stripeInvoice.id,
        recordId: existingRecord.id,
        oldStatus: existingRecord.status,
        newStatus: status,
      });

      return BillingRecord.toModel(updatedRecord);
    } catch (error) {
      logger.error('Error updating billing record from Stripe invoice', {
        invoiceId: stripeInvoice.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get billing history for a subscription
   */
  static async getBillingHistory(
    subscriptionId: string,
    limit: number = 10
  ): Promise<BillingRecordModel[]> {
    try {
      const records = await BillingRecord.getCustomerBillingHistory(subscriptionId, limit);
      return records.map((record) => BillingRecord.toModel(record));
    } catch (error) {
      logger.error('Error getting billing history', {
        subscriptionId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get billing history for a user
   */
  static async getUserBillingHistory(
    userId: string,
    limit: number = 10
  ): Promise<BillingRecordModel[]> {
    try {
      const subscription = await CustomerSubscription.findByUserId(userId);
      if (!subscription) {
        return [];
      }

      return this.getBillingHistory(subscription.id, limit);
    } catch (error) {
      logger.error('Error getting user billing history', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Retry failed payment
   */
  static async retryFailedPayment(invoiceId: string): Promise<PaymentRetryResult> {
    try {
      const billingRecord = await BillingRecord.findByStripeInvoiceId(invoiceId);
      if (!billingRecord) {
        throw new AppError('Billing record not found', 404);
      }

      if (billingRecord.status === 'paid') {
        throw new AppError('Invoice is already paid', 400);
      }

      // Record the payment attempt
      await BillingRecord.recordPaymentAttempt(billingRecord.id);

      // Retry payment through Stripe
      const result = await StripeService.retryInvoicePayment(invoiceId);

      // Update billing record based on result
      let updatedRecord = billingRecord;
      if (result.status === 'paid') {
        const updated = await BillingRecord.updatePaymentStatus(billingRecord.id, 'paid', {
          amountPaid: billingRecord.amount_due,
          paidAt: new Date(),
          stripePaymentIntentId: result.paymentIntent?.id,
        });
        if (updated) {
          updatedRecord = updated;
        }
      }

      logger.info('Retried failed payment', {
        invoiceId,
        recordId: billingRecord.id,
        result: result.status,
      });

      return {
        success: result.status === 'paid',
        billingRecord: BillingRecord.toModel(updatedRecord),
        paymentIntent: result.paymentIntent,
      };
    } catch (error) {
      logger.error('Error retrying failed payment', {
        invoiceId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        success: false,
        billingRecord: {} as BillingRecordModel,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get pending payments
   */
  static async getPendingPayments(): Promise<BillingRecordModel[]> {
    try {
      const records = await BillingRecord.findPendingPayments();
      return records.map((record) => BillingRecord.toModel(record));
    } catch (error) {
      logger.error('Error getting pending payments', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get failed payments
   */
  static async getFailedPayments(): Promise<BillingRecordModel[]> {
    try {
      const records = await BillingRecord.findFailedPayments();
      return records.map((record) => BillingRecord.toModel(record));
    } catch (error) {
      logger.error('Error getting failed payments', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get revenue statistics
   */
  static async getRevenueStats(startDate: Date, endDate: Date): Promise<BillingStats> {
    try {
      return await BillingRecord.getRevenueStats(startDate, endDate);
    } catch (error) {
      logger.error('Error getting revenue stats', {
        startDate,
        endDate,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get monthly revenue for a year
   */
  static async getMonthlyRevenue(year: number): Promise<
    Array<{
      month: number;
      revenue: number;
      invoiceCount: number;
      currency: string;
    }>
  > {
    try {
      return await BillingRecord.getMonthlyRevenue(year);
    } catch (error) {
      logger.error('Error getting monthly revenue', {
        year,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Process invoice payment succeeded webhook
   */
  static async processInvoicePaymentSucceeded(stripeInvoice: Stripe.Invoice): Promise<void> {
    try {
      await this.updateBillingRecordFromStripeInvoice(stripeInvoice);

      logger.info('Processed invoice payment succeeded', {
        invoiceId: stripeInvoice.id,
        amount: stripeInvoice.amount_paid,
      });
    } catch (error) {
      logger.error('Error processing invoice payment succeeded', {
        invoiceId: stripeInvoice.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Process invoice payment failed webhook
   */
  static async processInvoicePaymentFailed(stripeInvoice: Stripe.Invoice): Promise<void> {
    try {
      const billingRecord = await this.updateBillingRecordFromStripeInvoice(stripeInvoice);

      // Record the failed attempt
      await BillingRecord.recordPaymentAttempt(
        billingRecord.id,
        'Payment failed - will retry automatically'
      );

      logger.info('Processed invoice payment failed', {
        invoiceId: stripeInvoice.id,
        attemptCount: stripeInvoice.attempt_count,
      });
    } catch (error) {
      logger.error('Error processing invoice payment failed', {
        invoiceId: stripeInvoice.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Generate billing summary for admin dashboard
   */
  static async getBillingSummary(): Promise<{
    currentMonth: BillingStats;
    previousMonth: BillingStats;
    pendingPayments: number;
    failedPayments: number;
    monthlyTrend: Array<{
      month: number;
      revenue: number;
      invoiceCount: number;
    }>;
  }> {
    try {
      const now = new Date();
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

      const [currentMonth, previousMonth, pendingPayments, failedPayments, monthlyTrend] =
        await Promise.all([
          this.getRevenueStats(currentMonthStart, currentMonthEnd),
          this.getRevenueStats(previousMonthStart, previousMonthEnd),
          BillingRecord.findPendingPayments(),
          BillingRecord.findFailedPayments(),
          this.getMonthlyRevenue(now.getFullYear()),
        ]);

      return {
        currentMonth,
        previousMonth,
        pendingPayments: pendingPayments.length,
        failedPayments: failedPayments.length,
        monthlyTrend: monthlyTrend.map(({ month, revenue, invoiceCount }) => ({
          month,
          revenue,
          invoiceCount,
        })),
      };
    } catch (error) {
      logger.error('Error getting billing summary', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }
}
