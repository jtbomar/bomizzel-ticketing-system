import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import AccountFrame from './AccountFrame';
import { apiService } from '../../services/api';

/**
 * Where password-reset links and contact invitations land (?invite=1 changes
 * the wording). Choosing a password here also confirms the email address.
 */
const ResetPasswordPage: React.FC = () => {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const isInvite = params.get('invite') === '1';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [state, setState] = useState<'idle' | 'saving' | 'done'>('idle');
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) return setError('Use at least 8 characters.');
    if (password !== confirm) return setError("The two passwords don't match.");
    setState('saving');
    try {
      await apiService.resetPassword(token, password);
      setState('done');
    } catch (err: any) {
      setState('idle');
      const code = err.response?.data?.error?.code;
      setError(
        code === 'INVALID_RESET_TOKEN'
          ? 'This link has expired or has already been used. Ask for a new one below.'
          : err.response?.data?.error?.message || 'Something went wrong. Please try again.'
      );
    }
  };

  const title = isInvite ? 'Set your password' : 'Choose a new password';

  if (!token) {
    return (
      <AccountFrame title={title}>
        <p className="text-gray-700">This link is incomplete. Ask for a new one.</p>
        <Link to="/forgot-password" className="btn-primary w-full block text-center">
          Get a new link
        </Link>
      </AccountFrame>
    );
  }

  return (
    <AccountFrame title={title}>
      {state === 'done' ? (
        <>
          <p className="text-gray-700">Your password is set. You can sign in now.</p>
          <Link to="/login" className="btn-primary w-full block text-center">
            Sign in
          </Link>
        </>
      ) : (
        <form className="space-y-4" onSubmit={submit}>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700">New password</label>
            <input
              type="password"
              required
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input mt-1"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Type it again</label>
            <input
              type="password"
              required
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="input mt-1"
            />
          </div>
          <button
            type="submit"
            disabled={state === 'saving'}
            className="btn-primary w-full disabled:opacity-50"
          >
            {state === 'saving' ? 'Saving...' : 'Save password'}
          </button>
          <p className="text-center text-sm">
            <Link to="/forgot-password" className="text-blue-600 hover:text-blue-500">
              Need a new link?
            </Link>
          </p>
        </form>
      )}
    </AccountFrame>
  );
};

export default ResetPasswordPage;
