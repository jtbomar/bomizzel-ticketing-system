import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { planFeatures, priceExample, type PlanInfo } from '../utils/plans';
import { CheckIcon } from '@heroicons/react/24/outline';
import apiService from '../services/api';

const PricingPage: React.FC = () => {
  const [plans, setPlans] = useState<PlanInfo[]>([]);
  const [trialDays, setTrialDays] = useState(14);
  const [interval, setInterval] = useState<'month' | 'year'>('month');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiService
      .getPlans()
      .then((r) => {
        setPlans(r.plans || []);
        setTrialDays(r.trialDays || 14);
      })
      .catch(() => setError('Failed to load pricing plans'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading pricing plans...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 text-lg">{error}</p>
          <Link to="/" className="mt-4 btn-primary inline-block">
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-100">
      {/* Header */}
      <header className="container mx-auto px-4 py-6">
        <div className="flex justify-between items-center">
          <Link to="/" className="text-2xl font-bold text-primary-600">
            Bomizzel
          </Link>
          <div className="flex items-center space-x-4">
            <Link to="/login" className="text-gray-600 hover:text-gray-900">
              Sign In
            </Link>
            <Link to="/register" className="btn-primary px-6 py-2">
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <div className="container mx-auto px-4 py-12">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            Choose Your <span className="text-primary-600">Perfect Plan</span>
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
            Scale your support operations with flexible pricing that grows with your business. From
            startups to enterprise, we have the right solution for your team.
          </p>
          {plans.length > 0 && (
            <div className="inline-flex items-center bg-white rounded-full px-6 py-2 shadow-sm">
              <CheckIcon className="h-5 w-5 text-green-500 mr-2" />
              <span className="text-sm text-gray-600">
                {trialDays}-day free trial of Professional · no credit card needed
              </span>
            </div>
          )}
        </div>

        {/* Pricing Cards */}
        <div className="flex justify-center mb-8">
          <div
            role="radiogroup"
            aria-label="Billing period"
            className="inline-flex rounded-full bg-white shadow-sm p-1 text-sm"
          >
            {(
              [
                ['month', 'Monthly'],
                ['year', 'Yearly · save ~17%'],
              ] as const
            ).map(([value, text]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={interval === value}
                onClick={() => setInterval(value)}
                className={`px-4 py-1.5 rounded-full ${
                  interval === value ? 'bg-primary-600 text-white' : 'text-gray-600'
                }`}
              >
                {text}
              </button>
            ))}
          </div>
        </div>
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto mb-20">
          {plans.map((plan) => {
            const price = interval === 'year' ? plan.yearly : plan.monthly;
            const featured = plan.key === 'professional';
            return (
              <div
                key={plan.key}
                className={`relative bg-white rounded-2xl shadow-lg p-8 flex flex-col ${
                  featured ? 'ring-2 ring-primary-500' : ''
                }`}
              >
                {featured && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-primary-600 text-white px-4 py-1 rounded-full text-sm font-medium">
                    Most popular
                  </div>
                )}
                <h3 className="text-xl font-bold text-gray-900">{plan.name}</h3>
                <p className="mt-4">
                  <span className="text-4xl font-bold text-gray-900">${price}</span>
                  <span className="text-gray-500">
                    {price > 0 ? ' / agent / month' : ` for up to ${plan.limits.agents} agents`}
                  </span>
                </p>
                <p className="text-sm text-gray-500 min-h-[2.5rem]">
                  {price > 0 &&
                    `For each agent on your team - e.g. ${priceExample(price, 3)}${interval === 'year' ? ', billed yearly' : ''}.`}
                </p>
                <ul className="mt-6 space-y-3 flex-1">
                  {planFeatures(plan).map((f) => (
                    <li key={f} className="flex items-start gap-2 text-gray-700">
                      <CheckIcon className="h-5 w-5 text-green-500 shrink-0" aria-hidden="true" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  to="/register"
                  className={`mt-8 block text-center py-3 rounded-lg font-medium ${
                    featured
                      ? 'bg-primary-600 text-white hover:bg-primary-700'
                      : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                  }`}
                >
                  {plan.key === 'free' ? 'Get started free' : `Start ${trialDays}-day free trial`}
                </Link>
              </div>
            );
          })}
        </div>

        {/* FAQ Section */}
        <div className="mt-24 max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
            Frequently Asked Questions
          </h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-white rounded-lg p-6 shadow-sm">
              <h3 className="font-semibold text-gray-900 mb-3">
                What happens when I reach my ticket limit?
              </h3>
              <p className="text-gray-600 text-sm">
                On the Free plan, once 100 tickets have come in through the web that month, new ones
                wait until next month or until you upgrade. Tickets your customers email in always
                get through, and paid plans have no ticket limit.
              </p>
            </div>

            <div className="bg-white rounded-lg p-6 shadow-sm">
              <h3 className="font-semibold text-gray-900 mb-3">
                Can I upgrade or downgrade my plan anytime?
              </h3>
              <p className="text-gray-600 text-sm">
                Yes. Changes take effect straight away, and Stripe prorates them: you're charged, or
                credited, only for the difference. Adding or removing an agent works the same way.
              </p>
            </div>

            <div className="bg-white rounded-lg p-6 shadow-sm">
              <h3 className="font-semibold text-gray-900 mb-3">How does the free trial work?</h3>
              <p className="text-gray-600 text-sm">
                Every new account gets 14 days of Professional, free, with no credit card. Pick a
                plan any time in Settings &gt; Billing; if you don't, you move to the Free plan and
                keep all your data.
              </p>
            </div>

            <div className="bg-white rounded-lg p-6 shadow-sm">
              <h3 className="font-semibold text-gray-900 mb-3">
                What payment methods do you accept?
              </h3>
              <p className="text-gray-600 text-sm">
                We accept all major credit cards (Visa, MasterCard, American Express) and process
                payments securely through Stripe. All billing is monthly and you can update your
                payment method anytime.
              </p>
            </div>

            <div className="bg-white rounded-lg p-6 shadow-sm">
              <h3 className="font-semibold text-gray-900 mb-3">
                Is there a setup fee or long-term contract?
              </h3>
              <p className="text-gray-600 text-sm">
                No setup fees and no long-term contracts required. All plans are billed monthly and
                you can cancel anytime. We believe in earning your business every month with great
                service.
              </p>
            </div>

            <div className="bg-white rounded-lg p-6 shadow-sm">
              <h3 className="font-semibold text-gray-900 mb-3">
                What happens to my data if I cancel?
              </h3>
              <p className="text-gray-600 text-sm">
                Your data remains accessible for 30 days after cancellation, giving you time to
                export or migrate. We can also provide data exports in standard formats upon
                request.
              </p>
            </div>
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="mt-24 text-center bg-white rounded-2xl p-12 shadow-lg">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Ready to Transform Your Support Operations?
          </h2>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Join thousands of teams who trust Bomizzel to manage their customer support efficiently
            and professionally.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/register" className="btn-primary text-lg px-8 py-3">
              Start Free Trial
            </Link>
            <Link to="/login" className="btn-outline text-lg px-8 py-3">
              Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PricingPage;
