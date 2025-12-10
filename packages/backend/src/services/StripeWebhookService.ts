import Stripe from 'stripe';
import { stripe, STRIPE_CONFIG, STRIPE_WEBHOOK_EVENTS } from '@/config/stripe';
import { StripeService } from './StripeService';
import { BillingService } from './BillingService';
import { CustomerSubscription } from '@/models/CustomerSubscription';
import { User } from '@/models/User';
import { logger } from '@/utils/logger';
import { AppError } from '@/middleware/errorHandler';

export interface WebhookProcessingResult {
  processed: boolean;
  eventType: string;
  eventId: string;
  message?: string;
  error?: string;
}

export class StripeWebhookService {
  /**
   * Process incoming Stripe webhook
   */
  static async processWebhook(
    payload: string | Buffer,
    signature: string
  ): Promise<WebhookProcessingResult> {
    try {
      if (!STRIPE_CONFIG.webhookSecret) {
        throw new AppError('Webhook secret not configured', 500);
      }

      // Verify webhook signature
      if (!stripe) {
        throw new AppError('Stripe not configured', 500);
      }
      const event = stripe.webhooks.constructEvent(payload, signature, STRIPE_CONFIG.webhookSecret);

      logger.info('Processing Stripe webhook', {
        eventType: event.type,
        eventId: event.id,
        livemode: event.livemode,
      });

      // Process the event based on type
      let processed = false;
      let message = '';

      switch (event.type) {
        case STRIPE_WEBHOOK_EVENTS.CUSTOMER_SUBSCRIPTION_CREATED:
          await this.handleSubscriptionCreated(event.data.object as Stripe.Subscription);
          processed = true;
          message = 'Subscription created';
          break;

        case STRIPE_WEBHOOK_EVENTS.CUSTOMER_SUBSCRIPTION_UPDATED:
          await this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
          processed = true;
          message = 'Subscription updated';
          break;

        case STRIPE_WEBHOOK_EVENTS.CUSTOMER_SUBSCRIPTION_DELETED:
          await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
          processed = true;
          message = 'Subscription deleted';
          break;

        case STRIPE_WEBHOOK_EVENTS.INVOICE_PAYMENT_SUCCEEDED:
          await this.handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
          processed = true;
          message = 'Invoice payment succeeded';
          break;

        case STRIPE_WEBHOOK_EVENTS.INVOICE_PAYMENT_FAILED:
          await this.handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
          processed = true;
          message = 'Invoice payment failed';
          break;

        case STRIPE_WEBHOOK_EVENTS.PAYMENT_METHOD_ATTACHED:
          await this.handlePaymentMethodAttached(event.data.object as Stripe.PaymentMethod);
          processed = true;
          message = 'Payment method attached';
          break;

        case STRIPE_WEBHOOK_EVENTS.PAYMENT_METHOD_DETACHED:
          await this.handlePaymentMethodDetached(event.data.object as Stripe.PaymentMethod);
          processed = true;
          message = 'Payment method detached';
          break;

        case STRIPE_WEBHOOK_EVENTS.CUSTOMER_CREATED:
          await this.handleCustomerCreated(event.data.object as Stripe.Customer);
          processed = true;
          message = 'Customer created';
          break;

        case STRIPE_WEBHOOK_EVENTS.CUSTOMER_UPDATED:
          await this.handleCustomerUpdated(event.data.object as Stripe.Customer);
          processed = true;
          message = 'Customer updated';
          break;

        case STRIPE_WEBHOOK_EVENTS.CUSTOMER_DELETED:
          await this.handleCustomerDeleted(event.data.object as Stripe.Customer);
          processed = true;
          message = 'Customer deleted';
          break;

        default:
          logger.info('Unhandled webhook event type', {
            eventType: event.type,
            eventId: event.id,
          });
          message = `Unhandled event type: ${event.type}`;
      }

      logger.info('Webhook processed successfully', {
        eventType: event.type,
        eventId: event.id,
        processed,
        message,
      });

      return {
        processed,
        eventType: event.type,
        eventId: event.id,
        message,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error processing webhook', {
        error: errorMessage,
        signature: signature.substring(0, 20) + '...',
      });

      return {
        processed: false,
        eventType: 'unknown',
        eventId: 'unknown',
        error: errorMessage,
      };
    }
  }

  /**
   * Handle subscription created event
   */
  private static async handleSubscriptionCreated(subscription: Stripe.Subscription): Promise<void> {
    try {
      // Sync the subscription with our database
      await StripeService.syncSubscriptionFromStripe(subscription.id);

      logger.info('Handled subscription created', {
        subscriptionId: subscription.id,
        customerId: subscription.customer,
        status: subscription.status,
      });
    } catch (error) {
      logger.error('Error handling subscription created', {
        subscriptionId: subscription.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Handle subscription updated event
   */
  private static async handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
    try {
      // Sync the subscription with our database
      await StripeService.syncSubscriptionFromStripe(subscription.id);

      logger.info('Handled subscription updated', {
        subscriptionId: subscription.id,
        customerId: subscription.customer,
        status: subscription.status,
      });
    } catch (error) {
      logger.error('Error handling subscription updated', {
        subscriptionId: subscription.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Handle subscription deleted event
   */
  private static async handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
    try {
      const localSubscription = await CustomerSubscription.findByStripeSubscriptionId(
        subscription.id
      );

      if (localSubscription) {
        await CustomerSubscription.updateSubscriptionStatus(localSubscription.id, 'cancelled');

        logger.info('Handled subscription deleted', {
          subscriptionId: subscription.id,
          localSubscriptionId: localSubscription.id,
        });
      } else {
        logger.warn('Local subscription not found for deleted Stripe subscription', {
          subscriptionId: subscription.id,
        });
      }
    } catch (error) {
      logger.error('Error handling subscription deleted', {
        subscriptionId: subscription.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Handle invoice payment succeeded event
   */
  private static async handleInvoicePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
    try {
      // Process billing record
      await BillingService.processInvoicePaymentSucceeded(invoice);

      const invoiceWithSub = invoice as any;
      if (invoiceWithSub.subscription) {
        const subscriptionId =
          typeof invoiceWithSub.subscription === 'string' ? invoiceWithSub.subscription : invoiceWithSub.subscription.id;

        // Sync subscription status
        await StripeService.syncSubscriptionFromStripe(subscriptionId);

        // Find local subscription
        const localSubscription =
          await CustomerSubscription.findByStripeSubscriptionId(subscriptionId);

        if (localSubscription) {
          // Update subscription to active if payment succeeded
          if (localSubscription.status === 'past_due') {
            await CustomerSubscription.updateSubscriptionStatus(localSubscription.id, 'active');
          }

          logger.info('Handled invoice payment succeeded', {
            invoiceId: invoice.id,
            subscriptionId,
            amount: invoice.amount_paid,
            currency: invoice.currency,
          });
        }
      }
    } catch (error) {
      logger.error('Error handling invoice payment succeeded', {
        invoiceId: invoice.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Handle invoice payment failed event
   */
  private static async handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    try {
      // Process billing record
      await BillingService.processInvoicePaymentFailed(invoice);

      const invoiceWithSub = invoice as any;
      if (invoiceWithSub.subscription) {
        const subscriptionId =
          typeof invoiceWithSub.subscription === 'string' ? invoiceWithSub.subscription : invoiceWithSub.subscription.id;

        // Find local subscription
        const localSubscription =
          await CustomerSubscription.findByStripeSubscriptionId(subscriptionId);

        if (localSubscription) {
          // Update subscription to past_due
          await CustomerSubscription.updateSubscriptionStatus(localSubscription.id, 'past_due');

          // TODO: Send notification to customer about failed payment
          // This could trigger an email notification or in-app notification

          logger.info('Handled invoice payment failed', {
            invoiceId: invoice.id,
            subscriptionId,
            amount: invoice.amount_due,
            currency: invoice.currency,
            attemptCount: invoice.attempt_count,
          });
        }
      }
    } catch (error) {
      logger.error('Error handling invoice payment failed', {
        invoiceId: invoice.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Handle payment method attached event
   */
  private static async handlePaymentMethodAttached(
    paymentMethod: Stripe.PaymentMethod
  ): Promise<void> {
    try {
      if (paymentMethod.customer) {
        const customerId =
          typeof paymentMethod.customer === 'string'
            ? paymentMethod.customer
            : paymentMethod.customer.id;

        // Find subscriptions for this customer
        const subscriptions = await CustomerSubscription.findByStripeCustomerId(customerId);

        // Update the default payment method for active subscriptions
        for (const subscription of subscriptions) {
          if (subscription.status === 'active' || subscription.status === 'trial') {
            await CustomerSubscription.updatePaymentMethod(subscription.id, paymentMethod.id);
          }
        }

        logger.info('Handled payment method attached', {
          paymentMethodId: paymentMethod.id,
          customerId,
          subscriptionsUpdated: subscriptions.length,
        });
      }
    } catch (error) {
      logger.error('Error handling payment method attached', {
        paymentMethodId: paymentMethod.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Handle payment method detached event
   */
  private static async handlePaymentMethodDetached(
    paymentMethod: Stripe.PaymentMethod
  ): Promise<void> {
    try {
      // Find subscriptions using this payment method
      const subscriptions = await CustomerSubscription.query.where(
        'payment_method_id',
        paymentMethod.id
      );

      // Clear the payment method from subscriptions
      for (const subscription of subscriptions) {
        await CustomerSubscription.updatePaymentMethod(subscription.id, '');
      }

      logger.info('Handled payment method detached', {
        paymentMethodId: paymentMethod.id,
        subscriptionsUpdated: subscriptions.length,
      });
    } catch (error) {
      logger.error('Error handling payment method detached', {
        paymentMethodId: paymentMethod.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Handle customer created event
   */
  private static async handleCustomerCreated(customer: Stripe.Customer): Promise<void> {
    try {
      // Log customer creation - we don't need to do much here since
      // customer creation is handled in our application flow
      logger.info('Handled customer created', {
        customerId: customer.id,
        email: customer.email,
        created: customer.created,
      });
    } catch (error) {
      logger.error('Error handling customer created', {
        customerId: customer.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Handle customer updated event
   */
  private static async handleCustomerUpdated(customer: Stripe.Customer): Promise<void> {
    try {
      // Find subscriptions for this customer and potentially update user info
      const subscriptions = await CustomerSubscription.findByStripeCustomerId(customer.id);

      logger.info('Handled customer updated', {
        customerId: customer.id,
        email: customer.email,
        subscriptionsFound: subscriptions.length,
      });
    } catch (error) {
      logger.error('Error handling customer updated', {
        customerId: customer.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Handle customer deleted event
   */
  private static async handleCustomerDeleted(customer: Stripe.Customer): Promise<void> {
    try {
      // Find and cancel subscriptions for this customer
      const subscriptions = await CustomerSubscription.findByStripeCustomerId(customer.id);

      for (const subscription of subscriptions) {
        if (subscription.status !== 'cancelled') {
          await CustomerSubscription.updateSubscriptionStatus(subscription.id, 'cancelled');
        }
      }

      logger.info('Handled customer deleted', {
        customerId: customer.id,
        subscriptionsCancelled: subscriptions.length,
      });
    } catch (error) {
      logger.error('Error handling customer deleted', {
        customerId: customer.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Validate webhook signature without processing
   */
  static validateWebhookSignature(payload: string | Buffer, signature: string): boolean {
    try {
      if (!STRIPE_CONFIG.webhookSecret) {
        return false;
      }

      if (!stripe) return false;
      stripe.webhooks.constructEvent(payload, signature, STRIPE_CONFIG.webhookSecret);
      return true;
    } catch (error) {
      logger.warn('Invalid webhook signature', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Get webhook event without processing
   */
  static getWebhookEvent(payload: string | Buffer, signature: string): Stripe.Event | null {
    try {
      if (!STRIPE_CONFIG.webhookSecret) {
        return null;
      }

      if (!stripe) return null;
      return stripe.webhooks.constructEvent(payload, signature, STRIPE_CONFIG.webhookSecret);
    } catch (error) {
      logger.warn('Failed to construct webhook event', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }
}
