import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiService } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

/**
 * A line across the top of the dashboard about the plan, when there's
 * something to act on: the trial (days left), a failed payment (grace
 * period), or a trial that ended. Admins get a link to Settings > Billing.
 */
const TrialBanner: React.FC = () => {
  const { user } = useAuth();
  const [info, setInfo] = useState<any>(null);
  const [hidden, setHidden] = useState(() => {
    try {
      return sessionStorage.getItem('plan-banner-hidden') === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    apiService
      .getBilling()
      .then(setInfo)
      .catch(() => setInfo(null));
  }, []);

  if (!info || hidden) return null;
  const trialEnded = info.source === 'free' && info.trialEndsAt && !info.hasStripeCustomer;
  let text = '';
  if (info.source === 'trial')
    text = `Free trial of Professional: ${info.trialDaysLeft} day${info.trialDaysLeft === 1 ? '' : 's'} left.`;
  else if (info.source === 'grace')
    text = "Your last payment didn't go through - update your card to keep your plan.";
  else if (trialEnded) text = 'Your trial has ended - you are on the Free plan.';
  if (!text) return null;

  return (
    <div
      role="status"
      className={`flex items-center justify-center gap-3 px-4 py-1.5 text-sm ${
        info.source === 'grace' ? 'bg-amber-100 text-amber-900' : 'bg-blue-50 text-blue-900'
      }`}
    >
      <span>{text}</span>
      {user?.role === 'admin' && (
        <Link to="/admin/settings/billing" className="font-medium underline">
          {info.source === 'grace' ? 'Update card' : 'Choose a plan'}
        </Link>
      )}
      <button
        type="button"
        aria-label="Hide"
        onClick={() => {
          setHidden(true);
          try {
            sessionStorage.setItem('plan-banner-hidden', '1');
          } catch {
            // just this page view, then
          }
        }}
        className="ml-2 opacity-60 hover:opacity-100"
      >
        ✕
      </button>
    </div>
  );
};

export default TrialBanner;
