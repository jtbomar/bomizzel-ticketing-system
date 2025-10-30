import { BaseModel } from './BaseModel';
import { BillingRecordTable } from '@/types/database';
import { BillingRecord as BillingRecordModel } from '@/types/models';

export interface BillingLineItem {
  id: string;
  description: string;
  amount: number;
  currency: string;
  quantity: number;
  priceId?: string;
  productId?: string;
}

export class BillingRecord extends BaseModel {
  protected static tableName = 'billing_records';

  static async findBySubscriptionId(subscriptionId: string): Promise<BillingRecordTable[]> {
    return this.query
      .where('subscription_id', subscriptionId)
      .orderBy('billing_date', 'desc');
  }

  static async findByStripeInvoiceId(stripeInvoiceId: string): Promise<BillingRecordTable | null> {
    const result = await this.query
      .where('stripe_invoice_id', stripeInvoiceId)
      .first();
    return result || null;
  }

  static async findPendingPayments(): Promise<BillingRecordTable[]> {
    return this.query
      .whereIn('status', ['open', 'draft'])
      .where('due_date', '<=', new Date())
      .orderBy('due_date', 'asc');
  }

  static async findFailedPayments(): Promise<BillingRecordTable[]> {
    return this.query
      .where('status', 'open')
      .where('attempt_count', '>', 0)
      .whereNotNull('failure_reason')
      .orderBy('billing_date', 'desc');
  }

  static async createBillingRecord(recordData: {
    subscriptionId: string;
    stripeInvoiceId?: string;
    stripePaymentIntentId?: string;
    invoiceNumber?: string;
    status?: 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';
    amountDue: number;
    amountPaid?: number;
    currency?: string;
    billingDate: Date;
    dueDate?: Date;
    paidAt?: Date;
    hostedInvoiceUrl?: string;
    invoicePdfUrl?: string;
    paymentMethodId?: string;
    lineItems?: BillingLineItem[];
    metadata?: Record<string, any>;
  }): Promise<BillingRecordTable> {
    const amountRemaining = recordData.amountDue - (recordData.amountPaid || 0);
    
    return this.create({
      subscription_id: recordData.subscriptionId,
      stripe_invoice_id: recordData.stripeInvoiceId,
      stripe_payment_intent_id: recordData.stripePaymentIntentId,
      invoice_number: recordData.invoiceNumber,
      status: recordData.status || 'draft',
      amount_due: recordData.amountDue,
      amount_paid: recordData.amountPaid || 0,
      amount_remaining: amountRemaining,
      currency: recordData.currency || 'usd',
      billing_date: recordData.billingDate,
      due_date: recordData.dueDate,
      paid_at: recordData.paidAt,
      hosted_invoice_url: recordData.hostedInvoiceUrl,
      invoice_pdf_url: recordData.invoicePdfUrl,
      payment_method_id: recordData.paymentMethodId,
      line_items: JSON.stringify(recordData.lineItems || []),
      metadata: JSON.stringify(recordData.metadata || {}),
    });
  }

  static async updatePaymentStatus(
    recordId: string,
    status: 'paid' | 'void' | 'uncollectible',
    options: {
      amountPaid?: number;
      paidAt?: Date;
      voidedAt?: Date;
      paymentMethodId?: string;
      stripePaymentIntentId?: string;
    } = {}
  ): Promise<BillingRecordTable | null> {
    const updateData: any = { status };

    if (status === 'paid') {
      updateData.paid_at = options.paidAt || new Date();
      if (options.amountPaid !== undefined) {
        updateData.amount_paid = options.amountPaid;
        // Recalculate remaining amount
        const record = await this.findById(recordId);
        if (record) {
          updateData.amount_remaining = record.amount_due - options.amountPaid;
        }
      }
      if (options.paymentMethodId) {
        updateData.payment_method_id = options.paymentMethodId;
      }
      if (options.stripePaymentIntentId) {
        updateData.stripe_payment_intent_id = options.stripePaymentIntentId;
      }
    } else if (status === 'void') {
      updateData.voided_at = options.voidedAt || new Date();
      updateData.amount_remaining = 0;
    }

    return this.update(recordId, updateData);
  }

  static async recordPaymentAttempt(
    recordId: string,
    failureReason?: string
  ): Promise<BillingRecordTable | null> {
    const record = await this.findById(recordId);
    if (!record) {
      return null;
    }

    const updateData: any = {
      attempt_count: record.attempt_count + 1,
    };

    if (failureReason) {
      updateData.failure_reason = failureReason;
    }

    return this.update(recordId, updateData);
  }

  static async updateInvoiceUrls(
    recordId: string,
    hostedInvoiceUrl?: string,
    invoicePdfUrl?: string
  ): Promise<BillingRecordTable | null> {
    const updateData: any = {};

    if (hostedInvoiceUrl) {
      updateData.hosted_invoice_url = hostedInvoiceUrl;
    }

    if (invoicePdfUrl) {
      updateData.invoice_pdf_url = invoicePdfUrl;
    }

    if (Object.keys(updateData).length === 0) {
      return null;
    }

    return this.update(recordId, updateData);
  }

  static async getRevenueStats(
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalRevenue: number;
    paidInvoices: number;
    pendingRevenue: number;
    failedPayments: number;
    currency: string;
  }> {
    const stats = await this.db(this.tableName)
      .whereBetween('billing_date', [startDate, endDate])
      .select(
        this.db.raw('SUM(CASE WHEN status = ? THEN amount_paid ELSE 0 END) as total_revenue', ['paid']),
        this.db.raw('COUNT(CASE WHEN status = ? THEN 1 END) as paid_invoices', ['paid']),
        this.db.raw('SUM(CASE WHEN status IN (?, ?) THEN amount_due ELSE 0 END) as pending_revenue', ['open', 'draft']),
        this.db.raw('COUNT(CASE WHEN status = ? AND attempt_count > 0 THEN 1 END) as failed_payments', ['open']),
        this.db.raw('? as currency', ['usd'])
      )
      .first();

    return {
      totalRevenue: parseInt(stats.total_revenue) || 0,
      paidInvoices: parseInt(stats.paid_invoices) || 0,
      pendingRevenue: parseInt(stats.pending_revenue) || 0,
      failedPayments: parseInt(stats.failed_payments) || 0,
      currency: stats.currency,
    };
  }

  static async getMonthlyRevenue(year: number): Promise<Array<{
    month: number;
    revenue: number;
    invoiceCount: number;
    currency: string;
  }>> {
    const results = await this.db(this.tableName)
      .whereRaw('EXTRACT(YEAR FROM billing_date) = ?', [year])
      .where('status', 'paid')
      .select(
        this.db.raw('EXTRACT(MONTH FROM billing_date) as month'),
        this.db.raw('SUM(amount_paid) as revenue'),
        this.db.raw('COUNT(*) as invoice_count'),
        this.db.raw('? as currency', ['usd'])
      )
      .groupByRaw('EXTRACT(MONTH FROM billing_date)')
      .orderByRaw('EXTRACT(MONTH FROM billing_date)');

    return results.map(row => ({
      month: parseInt(row.month),
      revenue: parseInt(row.revenue),
      invoiceCount: parseInt(row.invoice_count),
      currency: row.currency,
    }));
  }

  static async getCustomerBillingHistory(
    subscriptionId: string,
    limit: number = 10
  ): Promise<BillingRecordTable[]> {
    return this.query
      .where('subscription_id', subscriptionId)
      .orderBy('billing_date', 'desc')
      .limit(limit);
  }

  // Convert database record to API model
  static toModel(record: BillingRecordTable): BillingRecordModel {
    return {
      id: record.id,
      subscriptionId: record.subscription_id,
      stripeInvoiceId: record.stripe_invoice_id,
      stripePaymentIntentId: record.stripe_payment_intent_id,
      invoiceNumber: record.invoice_number,
      status: record.status,
      amountDue: record.amount_due,
      amountPaid: record.amount_paid,
      amountRemaining: record.amount_remaining,
      currency: record.currency,
      billingDate: record.billing_date,
      dueDate: record.due_date,
      paidAt: record.paid_at,
      voidedAt: record.voided_at,
      hostedInvoiceUrl: record.hosted_invoice_url,
      invoicePdfUrl: record.invoice_pdf_url,
      paymentMethodId: record.payment_method_id,
      attemptCount: record.attempt_count,
      failureReason: record.failure_reason,
      lineItems: typeof record.line_items === 'string' ? 
        JSON.parse(record.line_items) : record.line_items,
      metadata: typeof record.metadata === 'string' ? 
        JSON.parse(record.metadata) : record.metadata,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
    };
  }
}