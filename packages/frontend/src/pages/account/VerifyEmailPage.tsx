import React, { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import AccountFrame from './AccountFrame';
import { apiService } from '../../services/api';

/** Where the emailed link lands: confirms the address, then offers sign-in. */
const VerifyEmailPage: React.FC = () => {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [state, setState] = useState<'checking' | 'done' | 'failed'>('checking');
  const started = useRef(false);

  useEffect(() => {
    // Once only: a second call (React strict mode) would find the link used.
    if (started.current) return;
    started.current = true;
    if (!token) {
      setState('failed');
      return;
    }
    apiService
      .verifyEmail(token)
      .then(() => setState('done'))
      .catch(() => setState('failed'));
  }, [token]);

  return (
    <AccountFrame title="Confirm your email">
      {state === 'checking' && <p className="text-gray-700">Confirming your email address...</p>}
      {state === 'done' && (
        <>
          <p className="text-gray-700">Your email address is confirmed. You can sign in now.</p>
          <Link to="/login" className="btn-primary w-full block text-center">
            Sign in
          </Link>
        </>
      )}
      {state === 'failed' && (
        <>
          <p className="text-gray-700">This link has expired or has already been used.</p>
          <p className="text-sm text-gray-500">
            Try signing in - if your address still needs confirming, you can ask for a new link
            there.
          </p>
          <Link to="/login" className="btn-primary w-full block text-center">
            Go to sign in
          </Link>
        </>
      )}
    </AccountFrame>
  );
};

export default VerifyEmailPage;
