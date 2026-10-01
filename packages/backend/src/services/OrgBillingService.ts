import Stripe from 'stripe';
import { db } from '@/config/database';
import { AppError } from '@/middleware/errorHandler';
import { logger } from '@/utils/logger';
import { PLANS, agentCount, planByKey, type Interval, type PlanKey } from './PlanService';

/**
 * A company's subscription through Stripe: Checkout to start paying, the
 * customer portal to change card or cancel, and Stripe's webhook to keep the
 * company's plan in step. Charged per agent: the subscription's quantity
 * follows the number of active agents.
 *
 * The Stripe products and prices are created by this code the first time
 * they're needed (looked up by key: bomizzel_standard_month, ...), so the
 * same code works in the sandbox and live without copying price ids.
 */

let client: Stripe | null = null;
const stripe = (): Stripe => {
  const key = process.env['STRIPE_SECRET_KEY'];
  if (!key) throw new AppError('Billing is not set up yet', 503, 'BILLING_DISABLED');
  if (!client) client = new Stripe(key);
  return client;
};
export const billingEnabled = () => !!process.env['STRIPE_SECRET_KEY'];
/** For tests: use this Stripe client instead of a real one. */
export const setStripeClient = (c: any) => {
  client = c;
};

const frontend = () =>
  (process.env['FRONTEND_URL'] || 'https://www.bomizzel.com').replace(/\/$/, '');
const lookupKey = (plan: PlanKey, interval: Interval) => `bomizzel_${plan}_${interval}`;

const priceCache = new Map<string, string>();
const productsChecked = new Set<string>();

// Stripe's tax category for the products: software as a service, business
// use. Stripe needs one to work out tax, and Managed Payments (on by default
// for new accounts) refuses checkout without it.
const TAX_CODE = () => process.env['STRIPE_TAX_CODE'] || 'txcd_10103001';

/** The Stripe product for a plan, created if missing, with its tax code set. */
const productFor = async (planKey: PlanKey): Promise<string> => {
  const productId = `bomizzel_${planKey}`;
  if (productsChecked.has(productId)) return productId;
  const s = stripe();
  const plan = planByKey(planKey);
  let product: Stripe.Product | null = null;
  try {
    product = await s.products.retrieve(productId);
  } catch {
    product = null;
  }
  if (!product) {
    await s.products.create({
      id: productId,
      name: `Bomizzel ${plan.name}`,
      description: 'Per agent',
      tax_code: TAX_CODE(),
    });
  } else if (!product.tax_code) {
    // Made before the tax code was set
    await s.products.update(productId, { tax_code: TAX_CODE() });
  }
  productsChecked.add(productId);
  return productId;
};

/** The Stripe price for a plan and interval, created if it doesn't exist yet. */
const priceFor = async (planKey: PlanKey, interval: Interval): Promise<string> => {
  const key = lookupKey(planKey, interval);
  const cached = priceCache.get(key);
  if (cached) return cached;
  const s = stripe();
  const found = await s.prices.list({ lookup_keys: [key], active: true, limit: 1 });
  if (found.data[0]) {
    await productFor(planKey);
    priceCache.set(key, found.data[0].id);
    return found.data[0].id;
  }
  const plan = planByKey(planKey);
  const productId = await productFor(plan.key);
  const price = await s.prices.create({
    product: productId,
    currency: 'usd',
    unit_amount: Math.round((interval === 'year' ? plan.yearly * 12 : plan.monthly) * 100),
    recurring: { interval, usage_type: 'licensed' },
    lookup_key: key,
    nickname: `${plan.name} (${interval === 'year' ? 'yearly' : 'monthly'}, per agent)`,
  });
  priceCache.set(key, price.id);
  return price.id;
};

/** Which plan and interval a Stripe price is. */
const planOfPrice = (
  price: Stripe.Price | null | undefined
): { plan: PlanKey; interval: Interval } | null => {
  const key = price?.lookup_key || '';
  const m = /^bomizzel_(standard|professional)_(month|year)$/.exec(key);
  return m ? { plan: m[1] as PlanKey, interval: m[2] as Interval } : null;
};

export class OrgBillingService {
  /** The company's Stripe customer, created on first use. */
  private static async customerFor(orgId: string, email: string): Promise<string> {
    const company = await db('companies').where('id', orgId).first();
    if (!company) throw new AppError('Company not found', 404, 'NOT_FOUND');
    if (company.stripe_customer_id) return company.stripe_customer_id;
    const customer = await stripe().customers.create({
      name: company.name,
      email: company.billing_email || email,
      metadata: { org_id: orgId },
    });
    await db('companies').where('id', orgId).update({ stripe_customer_id: customer.id });
    return customer.id;
  }

  /**
   * Start paying for a plan (Stripe Checkout) - or, for a company already
   * paying, switch its subscription to the new plan in place.
   */
  static async checkout(
    orgId: string,
    user: { email: string },
    planKey: string,
    interval: string
  ): Promise<{ url?: string; changed?: boolean }> {
    if (planKey !== 'standard' && planKey !== 'professional') {
      throw new AppError('Choose Standard or Professional', 400, 'BAD_PLAN');
    }
    if (interval !== 'month' && interval !== 'year') {
      throw new AppError('Choose monthly or yearly', 400, 'BAD_INTERVAL');
    }
    const price = await priceFor(planKey, interval);
    const company = await db('companies').where('id', orgId).first();
    const seats = Math.max(1, await agentCount(orgId));

    // Already subscribed: change the plan on the same subscription
    if (
      company?.stripe_subscription_id &&
      ['active', 'trialing', 'past_due'].includes(company.subscription_status)
    ) {
      const sub = await stripe().subscriptions.retrieve(company.stripe_subscription_id);
      const item = sub.items.data[0];
      const updated = await stripe().subscriptions.update(sub.id, {
        items: [{ id: item!.id, price, quantity: seats }],
        proration_behavior: 'create_prorations',
        metadata: { org_id: orgId },
      });
      await this.sync(updated);
      return { changed: true };
    }

    const customer = await this.customerFor(orgId, user.email);
    const session = await stripe().checkout.sessions.create({
      mode: 'subscription',
      customer,
      client_reference_id: orgId,
      line_items: [{ price, quantity: seats }],
      subscription_data: { metadata: { org_id: orgId } },
      allow_promotion_codes: true,
      success_url: `${frontend()}/admin/settings/billing?checkout=success`,
      cancel_url: `${frontend()}/admin/settings/billing?checkout=cancelled`,
    });
    return { url: session.url || undefined };
  }

  /** Stripe's own page to change card, see invoices, or cancel. */
  static async portal(orgId: string): Promise<{ url: string }> {
    const company = await db('companies').where('id', orgId).first();
    if (!company?.stripe_customer_id) {
      throw new AppError('Choose a plan first', 400, 'NO_CUSTOMER');
    }
    const session = await stripe().billingPortal.sessions.create({
      customer: company.stripe_customer_id,
      return_url: `${frontend()}/admin/settings/billing`,
    });
    return { url: session.url };
  }

  /** Copy a subscription's state onto its company. */
  static async sync(sub: Stripe.Subscription): Promise<void> {
    const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id;
    const orgId =
      sub.metadata?.['org_id'] ||
      (await db('companies').where('stripe_customer_id', customerId).first('id'))?.id;
    if (!orgId) {
      logger.warn('Stripe subscription for an unknown company', { subscription: sub.id });
      return;
    }
    const company = await db('companies').where('id', orgId).first();
    if (!company) return;
    const item = sub.items?.data?.[0];
    const which = planOfPrice(item?.price);
    const ended = ['canceled', 'incomplete_expired', 'unpaid'].includes(sub.status);
    const periodEnd = (item as any)?.current_period_end ?? (sub as any).current_period_end;
    await db('companies')
      .where('id', orgId)
      .update({
        stripe_customer_id: customerId || company.stripe_customer_id,
        stripe_subscription_id: sub.id,
        subscription_status: sub.status,
        plan: ended || !which ? 'free' : which.plan,
        billing_interval: which?.interval || null,
        seats: item?.quantity ?? null,
        current_period_end: periodEnd ? new Date(periodEnd * 1000) : null,
        past_due_since: sub.status === 'past_due' ? company.past_due_since || db.fn.now() : null,
        // Paying ends the trial
        ...(sub.status === 'active' ? { is_trial: false } : {}),
        updated_at: db.fn.now(),
      });
    logger.info('Billing updated from Stripe', { orgId, status: sub.status, plan: which?.plan });
  }

  /** A verified Stripe webhook event. */
  static async handleEvent(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== 'subscription' || !session.subscription) return;
        const id =
          typeof session.subscription === 'string' ? session.subscription : session.subscription.id;
        await this.sync(await stripe().subscriptions.retrieve(id));
        return;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await this.sync(event.data.object as Stripe.Subscription);
        return;
      case 'invoice.payment_failed':
      case 'invoice.paid': {
        const invoice = event.data.object as any;
        const id =
          (typeof invoice.subscription === 'string' && invoice.subscription) ||
          invoice.parent?.subscription_details?.subscription;
        if (id) await this.sync(await stripe().subscriptions.retrieve(id));
        return;
      }
      default:
        return;
    }
  }

  static verifyEvent(rawBody: Buffer, signature: string | undefined): Stripe.Event {
    const secret = process.env['STRIPE_WEBHOOK_SECRET'];
    if (!secret || !signature) throw new AppError('Webhook not configured', 400, 'NO_WEBHOOK');
    return stripe().webhooks.constructEvent(rawBody, signature, secret);
  }

  /**
   * Keep the paid seat count equal to the number of active agents (called
   * when agents are added, removed, deactivated or reactivated). Prorated by
   * Stripe. Never throws: a Stripe hiccup mustn't stop adding an agent.
   */
  static async syncSeats(orgId: string): Promise<void> {
    try {
      if (!billingEnabled() || !orgId) return;
      const company = await db('companies').where('id', orgId).first();
      if (
        !company?.stripe_subscription_id ||
        !['active', 'trialing', 'past_due'].includes(company.subscription_status)
      )
        return;
      const seats = Math.max(1, await agentCount(orgId));
      if (seats === company.seats) return;
      const sub = await stripe().subscriptions.retrieve(company.stripe_subscription_id);
      const item = sub.items.data[0];
      if (!item) return;
      await this.sync(
        await stripe().subscriptions.update(sub.id, {
          items: [{ id: item.id, quantity: seats }],
          proration_behavior: 'create_prorations',
        })
      );
    } catch (error) {
      logger.error('Seat sync failed', {
        orgId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  static plansForDisplay() {
    return PLANS.map((p) => ({
      key: p.key,
      name: p.name,
      monthly: p.monthly,
      yearly: p.yearly,
      limits: p.limits,
    }));
  }
}
