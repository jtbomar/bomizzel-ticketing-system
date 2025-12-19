import Stripe from 'stripe';
import { logger } from '@/utils/logger';

// Initialize Stripe with API key
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

if (!stripeSecretKey) {
  logger.warn('STRIPE_SECRET_KEY not set - Stripe features will be disabled');
}

export const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, {
      apiVersion: '2025-10-29.clover',
      typescript: true,
    })
  : null;

export const STRIPE_CONFIG = {
  webhookSecret: stripeWebhookSecret,
  currency: 'usd',
  successUrl: `${process.env.FRONTEND_URL}/subscription/success`,
  cancelUrl: `${process.env.FRONTEND_URL}/subscription/cancel`,
  customerPortalUrl: `${process.env.FRONTEND_URL}/subscription/manage`,
} as const;

// Stripe webhook event types we handle
export const STRIPE_WEBHOOK_EVENTS = {
  CUSTOMER_SUBSCRIPTION_CREATED: 'customer.subscription.created',
  CUSTOMER_SUBSCRIPTION_UPDATED: 'customer.subscription.updated',
  CUSTOMER_SUBSCRIPTION_DELETED: 'customer.subscription.deleted',
  INVOICE_PAYMENT_SUCCEEDED: 'invoice.payment_succeeded',
  INVOICE_PAYMENT_FAILED: 'invoice.payment_failed',
  PAYMENT_METHOD_ATTACHED: 'payment_method.attached',
  PAYMENT_METHOD_DETACHED: 'payment_method.detached',
  CUSTOMER_CREATED: 'customer.created',
  CUSTOMER_UPDATED: 'customer.updated',
  CUSTOMER_DELETED: 'customer.deleted',
} as const;

export type StripeWebhookEvent = (typeof STRIPE_WEBHOOK_EVENTS)[keyof typeof STRIPE_WEBHOOK_EVENTS];

logger.info('Stripe configuration initialized', {
  hasWebhookSecret: !!stripeWebhookSecret,
  currency: STRIPE_CONFIG.currency,
});
