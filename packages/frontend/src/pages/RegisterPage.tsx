import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import apiService from '../services/api';

/**
 * Sign up (/register): a business creates its Bomizzel account - the
 * company and its owner's login. The owner confirms their email, then signs
 * in to their own help desk (team, queue, departments and a support email
 * address are set up for them).
 *
 * This used to create a customer login with no company, so a business that
 * signed up from the home page got nothing it could use.
 */

const field =
  'mt-1 block w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500';

const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    companyName: '',
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [trialDays, setTrialDays] = useState(14);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Everyone starts on a trial of Professional, and picks a plan later in
  // Settings > Billing
  useEffect(() => {
    apiService
      .getPlans()
      .then((r) => setTrialDays(r.trialDays || 14))
      .catch(() => undefined);
  }, []);

  const set = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    setError('');
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password.length < 8) return setError('Use a password of at least 8 characters.');
    if (form.password !== form.confirmPassword) return setError("The passwords don't match.");
    setSubmitting(true);
    try {
      await apiService.registerCompany({
        companyName: form.companyName.trim(),
        adminFirstName: form.firstName.trim(),
        adminLastName: form.lastName.trim(),
        adminEmail: form.email.trim(),
        adminPassword: form.password,
      });
      navigate(`/check-email?email=${encodeURIComponent(form.email.trim())}`);
    } catch (err: any) {
      const data = err.response?.data;
      setError(
        data?.error?.message ||
          (typeof data?.error === 'string' ? data.error : '') ||
          data?.message ||
          'Sign-up failed. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <Link to="/" className="text-2xl font-bold text-gray-900">
            Bomizzel
          </Link>
          <h1 className="mt-4 text-2xl font-semibold text-gray-900">Start your help desk</h1>
          <p className="mt-1 text-sm text-gray-600">
            {trialDays}-day free trial of Professional. No credit card needed.
          </p>
        </div>

        <form
          onSubmit={submit}
          className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-4"
        >
          {error && (
            <div
              role="alert"
              className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm"
            >
              {error}
            </div>
          )}

          <div>
            <label htmlFor="companyName" className="block text-sm font-medium text-gray-700">
              Company name
            </label>
            <input
              id="companyName"
              name="companyName"
              required
              minLength={2}
              maxLength={100}
              autoComplete="organization"
              value={form.companyName}
              onChange={set}
              className={field}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="firstName" className="block text-sm font-medium text-gray-700">
                First name
              </label>
              <input
                id="firstName"
                name="firstName"
                required
                maxLength={50}
                autoComplete="given-name"
                value={form.firstName}
                onChange={set}
                className={field}
              />
            </div>
            <div>
              <label htmlFor="lastName" className="block text-sm font-medium text-gray-700">
                Last name
              </label>
              <input
                id="lastName"
                name="lastName"
                required
                maxLength={50}
                autoComplete="family-name"
                value={form.lastName}
                onChange={set}
                className={field}
              />
            </div>
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Work email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              value={form.email}
              onChange={set}
              className={field}
            />
            <p className="mt-1 text-xs text-gray-500">We'll send a link to confirm it.</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={form.password}
                onChange={set}
                className={field}
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
                required
                autoComplete="new-password"
                value={form.confirmPassword}
                onChange={set}
                className={field}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? 'Creating your account…' : 'Create account'}
          </button>
          <p className="text-center text-sm text-gray-600">
            Already have an account?{' '}
            <Link to="/login" className="font-medium text-blue-600 hover:text-blue-500">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
};

export default RegisterPage;
