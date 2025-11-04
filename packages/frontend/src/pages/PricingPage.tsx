import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { CheckIcon } from '@heroicons/react/24/outline';
import apiService from '../services/api';

interface SubscriptionPlan {
  id: string;
  name: string;
  slug: string;
  price: number;
  currency: string;
  billingInterval: string;
  limits: {
    activeTickets: number;
    completedTickets: number;
    totalTickets: number;
  };
  features: string[];
  trialDays: number;
  description: string;
  sortOrder: number;
}

const PricingPage: React.FC = () => {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const response = await apiService.getAvailablePlans();
        // Handle both direct array and nested data structure
        const plansData = response.data?.data || response.data || response;
        setPlans(plansData);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching plans:', err);
        setError('Failed to load pricing plans');
        setLoading(false);
      }
    };

    fetchPlans();
  }, []);

  const formatPrice = (price: number) => {
    return price === 0 ? 'Free' : `$${price}`;
  };

  const formatTicketLimit = (limit: number) => {
    return limit === -1 ? 'Unlimited' : limit.toLocaleString();
  };

  const getPlanButtonText = (plan: SubscriptionPlan) => {
    if (plan.price === 0) return 'Get Started Free';
    if (plan.trialDays > 0) return `Start ${plan.trialDays}-Day Free Trial`;
    return 'Get Started';
  };

  const getPlanButtonStyle = (index: number) => {
    // Highlight the Professional plan (index 2) as most popular
    if (index === 2) {
      return 'btn-primary w-full text-lg py-3';
    }
    return 'btn-outline w-full text-lg py-3';
  };

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
          <div className="inline-flex items-center bg-white rounded-full px-6 py-2 shadow-sm">
            <CheckIcon className="h-5 w-5 text-green-500 mr-2" />
            <span className="text-sm text-gray-600">14-day free trial on all paid plans</span>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid lg:grid-cols-5 md:grid-cols-3 sm:grid-cols-2 gap-8 max-w-7xl mx-auto">
          {plans.map((plan, index) => (
            <div
              key={plan.id}
              className={`relative bg-white rounded-2xl shadow-lg overflow-hidden ${
                index === 2 ? 'ring-2 ring-primary-500 scale-105' : ''
              }`}
            >
              {/* Most Popular Badge */}
              {index === 2 && (
                <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                  <div className="bg-primary-600 text-white px-4 py-1 rounded-full text-sm font-medium">
                    Most Popular
                  </div>
                </div>
              )}

              <div className="p-8">
                {/* Plan Header */}
                <div className="text-center mb-8">
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                  <div className="mb-4">
                    <span className="text-4xl font-bold text-gray-900">
                      {formatPrice(plan.price)}
                    </span>
                    {plan.price > 0 && <span className="text-gray-500 ml-1">/month</span>}
                  </div>
                  <p className="text-gray-600 text-sm">{plan.description}</p>
                </div>

                {/* Ticket Limits */}
                <div className="mb-8">
                  <div className="bg-gray-50 rounded-lg p-4 mb-4">
                    <h4 className="font-semibold text-gray-900 mb-3">Ticket Limits</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Active Tickets:</span>
                        <span className="font-medium">
                          {formatTicketLimit(plan.limits.activeTickets)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Completed Tickets:</span>
                        <span className="font-medium">
                          {formatTicketLimit(plan.limits.completedTickets)}
                        </span>
                      </div>
                      <div className="flex justify-between border-t pt-2">
                        <span className="text-gray-900 font-medium">Total Tickets:</span>
                        <span className="font-bold text-primary-600">
                          {formatTicketLimit(plan.limits.totalTickets)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Features */}
                <div className="mb-8">
                  <h4 className="font-semibold text-gray-900 mb-4">Features Included</h4>
                  <ul className="space-y-3">
                    {plan.features.map((feature, featureIndex) => (
                      <li key={featureIndex} className="flex items-start">
                        <CheckIcon className="h-5 w-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                        <span className="text-gray-600 text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* CTA Button */}
                <Link to={`/register?plan=${plan.slug}`} className={getPlanButtonStyle(index)}>
                  {getPlanButtonText(plan)}
                </Link>
              </div>
            </div>
          ))}
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
                When you reach your active ticket limit, you won't be able to create new tickets
                until you complete some existing ones or upgrade your plan. You can always complete
                existing tickets regardless of your completed ticket limit.
              </p>
            </div>

            <div className="bg-white rounded-lg p-6 shadow-sm">
              <h3 className="font-semibold text-gray-900 mb-3">
                Can I upgrade or downgrade my plan anytime?
              </h3>
              <p className="text-gray-600 text-sm">
                Yes! You can upgrade your plan at any time and the changes take effect immediately.
                Downgrades take effect at the end of your current billing cycle to ensure you don't
                lose access to features you've paid for.
              </p>
            </div>

            <div className="bg-white rounded-lg p-6 shadow-sm">
              <h3 className="font-semibold text-gray-900 mb-3">How does the free trial work?</h3>
              <p className="text-gray-600 text-sm">
                All paid plans include a 14-day free trial with full access to all features. No
                credit card required to start. You can cancel anytime during the trial period
                without being charged.
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
