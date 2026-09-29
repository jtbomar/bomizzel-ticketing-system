import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import AccountFrame from './AccountFrame';
import { apiService } from '../../services/api';

/** Shown after signing up: the account can't be used until the email is confirmed. */
const CheckEmailPage: React.FC = () => {
  const [params] = useSearchParams();
  const email = params.get('email') || '';
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');

  const resend = async () => {
    setState('sending');
    try {
      await apiService.resendVerification(email);
    } finally {
      setState('sent');
    }
  };

  return (
    <AccountFrame title="Check your email">
      <p className="text-gray-700">
        We sent a link to <strong>{email || 'your email address'}</strong>. Open it to confirm your
        address, then sign in.
      </p>
      <p className="text-sm text-gray-500">
        The link works for 24 hours. If you don't see the email, check your spam folder.
      </p>
      {email &&
        (state === 'sent' ? (
          <p className="text-sm text-green-700">A new link is on its way.</p>
        ) : (
          <button
            type="button"
            onClick={resend}
            disabled={state === 'sending'}
            className="text-sm font-medium text-blue-600 hover:text-blue-500 underline disabled:opacity-50"
          >
            {state === 'sending' ? 'Sending...' : 'Send me a new link'}
          </button>
        ))}
      <Link to="/login" className="btn-primary w-full block text-center">
        Go to sign in
      </Link>
    </AccountFrame>
  );
};

export default CheckEmailPage;
