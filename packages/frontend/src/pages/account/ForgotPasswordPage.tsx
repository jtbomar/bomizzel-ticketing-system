import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import AccountFrame from './AccountFrame';
import { apiService } from '../../services/api';

const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setState('sending');
    try {
      await apiService.forgotPassword(email);
      setState('sent');
    } catch (err: any) {
      setState('idle');
      setError(err.response?.data?.error?.message || 'Something went wrong. Please try again.');
    }
  };

  return (
    <AccountFrame title="Reset your password">
      {state === 'sent' ? (
        <>
          <p className="text-gray-700">
            If <strong>{email}</strong> has an account, a link to choose a new password is on its
            way. It works for 1 hour.
          </p>
          <Link to="/login" className="btn-primary w-full block text-center">
            Back to sign in
          </Link>
        </>
      ) : (
        <form className="space-y-4" onSubmit={submit}>
          <p className="text-gray-700">
            Enter the email address you sign in with and we'll send you a link.
          </p>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input"
            placeholder="you@example.com"
          />
          <button
            type="submit"
            disabled={state === 'sending'}
            className="btn-primary w-full disabled:opacity-50"
          >
            {state === 'sending' ? 'Sending...' : 'Send me a link'}
          </button>
          <p className="text-center text-sm">
            <Link to="/login" className="text-blue-600 hover:text-blue-500">
              Back to sign in
            </Link>
          </p>
        </form>
      )}
    </AccountFrame>
  );
};

export default ForgotPasswordPage;
