import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import apiService from '../services/api';

interface SubscriptionPlan {
  id: string;
  name: string;
  slug: string;
  price: number;
  trialDays: number;
  features: string[];
  description?: string;
}

const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const { register, isLoading } = useAuth();
  const [searchParams] = useSearchParams();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [availablePlans, setAvailablePlans] = useState<SubscriptionPlan[]>([]);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [showPlanSelection, setShowPlanSelection] = useState(false);

  useEffect(() => {
    // Load available plans
    const loadPlans = async () => {
      try {
        setLoadingPlan(true);
        const response = await apiService.getAvailablePlans();
        const plans = response.data || response;
        setAvailablePlans(plans);

        // Check if a specific plan was selected from pricing page
        const planSlug = searchParams.get('plan');
        if (planSlug) {
          const plan = plans.find((p: SubscriptionPlan) => p.slug === planSlug);
          if (plan) {
            setSelectedPlan(plan);
          }
        } else {
          // Default to Free Tier if no plan specified
          const freeTier = plans.find((p: SubscriptionPlan) => p.slug === 'free-tier');
          if (freeTier) {
            setSelectedPlan(freeTier);
          }
        }
      } catch (err) {
        console.error('Error loading plans:', err);
        setError('Failed to load subscription plans. Please try again.');
      } finally {
        setLoadingPlan(false);
      }
    };

    loadPlans();
  }, [searchParams]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (!selectedPlan) {
      setError('Please select a subscription plan');
      return;
    }
    
    try {
      // Register user with selected plan information
      await register({
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        password: formData.password,
        role: 'customer',
        selectedPlanId: selectedPlan.id,
        startTrial: selectedPlan.trialDays > 0 && selectedPlan.price > 0
      });
      
      navigate('/customer');
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please try again.');
    }
  };

  const handlePlanSelect = (plan: SubscriptionPlan) => {
    setSelectedPlan(plan);
    setShowPlanSelection(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Create your account
          </h2>
          {selectedPlan && (
            <div className="mt-4 text-center">
              <div className="inline-flex items-center bg-primary-50 rounded-lg px-4 py-2">
                <span className="text-sm text-primary-700">
                  Selected Plan: <strong>{selectedPlan.name}</strong>
                  {selectedPlan.price === 0 ? ' (Free)' : ` ($${selectedPlan.price}/month)`}
                  {selectedPlan.trialDays > 0 && selectedPlan.price > 0 && (
                    <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                      {selectedPlan.trialDays}-day free trial
                    </span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => setShowPlanSelection(true)}
                  className="ml-2 text-xs text-primary-600 hover:text-primary-800 underline"
                >
                  Change Plan
                </button>
              </div>
            </div>
          )}
          <p className="mt-2 text-center text-sm text-gray-600">
            Already have an account?{' '}
            <Link to="/login" className="font-medium text-primary-600 hover:text-primary-500">
              Sign in here
            </Link>
          </p>
        </div>
        <div className="card">
          <div className="card-body">
            <form className="space-y-6" onSubmit={handleSubmit}>
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                  {error}
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="firstName" className="block text-sm font-medium text-gray-700">
                    First name
                  </label>
                  <input
                    id="firstName"
                    name="firstName"
                    type="text"
                    required
                    value={formData.firstName}
                    onChange={handleChange}
                    className="input mt-1"
                    placeholder="First name"
                  />
                </div>
                <div>
                  <label htmlFor="lastName" className="block text-sm font-medium text-gray-700">
                    Last name
                  </label>
                  <input
                    id="lastName"
                    name="lastName"
                    type="text"
                    required
                    value={formData.lastName}
                    onChange={handleChange}
                    className="input mt-1"
                    placeholder="Last name"
                  />
                </div>
              </div>
              
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Email address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  className="input mt-1"
                  placeholder="Enter your email"
                />
              </div>
              
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  className="input mt-1"
                  placeholder="Create a password"
                />
              </div>
              
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                  Confirm password
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className="input mt-1"
                  placeholder="Confirm your password"
                />
              </div>
              
              <div>
                <button 
                  type="submit" 
                  disabled={isLoading || loadingPlan}
                  className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Creating account...' : 
                   loadingPlan ? 'Loading plan...' :
                   selectedPlan && selectedPlan.price > 0 && selectedPlan.trialDays > 0 ? 
                   `Start ${selectedPlan.trialDays}-Day Free Trial` : 'Create account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Plan Selection Modal */}
      {showPlanSelection && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Choose Your Plan</h3>
                <button
                  onClick={() => setShowPlanSelection(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <span className="sr-only">Close</span>
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {availablePlans.map((plan) => (
                  <div
                    key={plan.id}
                    className={`border rounded-lg p-4 cursor-pointer transition-all ${
                      selectedPlan?.id === plan.id
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => handlePlanSelect(plan)}
                  >
                    <div className="text-center">
                      <h4 className="text-lg font-semibold text-gray-900">{plan.name}</h4>
                      <div className="mt-2">
                        {plan.price === 0 ? (
                          <span className="text-2xl font-bold text-gray-900">Free</span>
                        ) : (
                          <>
                            <span className="text-2xl font-bold text-gray-900">${plan.price}</span>
                            <span className="text-gray-600">/month</span>
                          </>
                        )}
                      </div>
                      {plan.trialDays > 0 && plan.price > 0 && (
                        <div className="mt-1">
                          <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                            {plan.trialDays}-day free trial
                          </span>
                        </div>
                      )}
                      {plan.description && (
                        <p className="text-sm text-gray-600 mt-2">{plan.description}</p>
                      )}
                      <div className="mt-3">
                        <ul className="text-xs text-gray-600 space-y-1">
                          {plan.features.slice(0, 3).map((feature, index) => (
                            <li key={index} className="flex items-center">
                              <svg className="h-3 w-3 text-green-500 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                              {feature}
                            </li>
                          ))}
                          {plan.features.length > 3 && (
                            <li className="text-gray-500">
                              +{plan.features.length - 3} more features
                            </li>
                          )}
                        </ul>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  onClick={() => setShowPlanSelection(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={() => setShowPlanSelection(false)}
                  disabled={!selectedPlan}
                  className="px-4 py-2 text-sm font-medium text-white bg-primary-600 border border-transparent rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Select Plan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RegisterPage;