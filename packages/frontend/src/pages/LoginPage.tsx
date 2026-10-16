import React, { useEffect, useState } from 'react';
import axios from 'axios';
import FindPortal from '../components/FindPortal';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Logo from '../components/Logo';
import { useAuth } from '../contexts/AuthContext';
import { apiService, getApiBaseUrl } from '../services/api';
import { customerPortalBase, isStaffPortalHost } from '../portal/portalApi';
import { companyInAddress, onBomizzelSite } from '../utils/companyAddress';

interface CompanyBrand {
  portalName: string;
  renamed: boolean;
  name: string;
  logoUrl: string | null;
  iconUrl?: string | null;
}

/**
 * The staff sign-in. On portal.bomizzel.com/<name>/login it's that company's
 * own: their name and logo, and a pointer for their customers to
 * help.bomizzel.com/<name>. Elsewhere (/login) it's Bomizzel's.
 */
const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  // portal.bomizzel.com/<company>/login: that company's own sign-in
  const slug = companyInAddress() || undefined;
  const { login, isLoading } = useAuth();
  const [company, setCompany] = useState<CompanyBrand | null>(null);
  const [companyMissing, setCompanyMissing] = useState(false);

  useEffect(() => {
    if (!slug) return;
    let live = true;
    axios
      .get(`${getApiBaseUrl()}/portal/${encodeURIComponent(slug)}`)
      .then((r) => {
        if (!live) return;
        const brand: CompanyBrand = r.data;
        // An old name: move to the current one
        if (brand.renamed && brand.portalName !== slug) {
          window.location.replace(`/${brand.portalName}/login${location.search}`);
          return;
        }
        setCompany(brand);
        document.title = `${brand.name} - Sign in`;
      })
      .catch(() => live && setCompanyMissing(true));
    return () => {
      live = false;
    };
  }, [slug, navigate, location.search]);

  const customerPortal = slug ? `${customerPortalBase()}/${company?.portalName || slug}` : '';
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [error, setError] = useState('');
  // Set when the account exists but its email isn't confirmed yet.
  const [unverified, setUnverified] = useState(false);
  const [resendState, setResendState] = useState<'idle' | 'sending' | 'sent'>('idle');

  const resendLink = async () => {
    setResendState('sending');
    try {
      await apiService.resendVerification(formData.email);
    } finally {
      setResendState('sent');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError('');
    setUnverified(false);
    setResendState('idle');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      console.log('Attempting login for:', formData.email);
      // On a company's own sign-in, as its staff: the server refuses anyone else
      const result = await login(
        formData.email,
        formData.password,
        slug ? { company: company?.portalName || slug, audience: 'staff' } : undefined
      );

      // Signed in on bomizzel.com (or portal.bomizzel.com with no company):
      // on to their company's own address - staff to
      // portal.bomizzel.com/<company>/agent, customers to its customer portal
      const theirs = result?.company?.portalName;
      if (!slug && theirs && onBomizzelSite()) {
        if (isStaffPortalHost() && result.user?.role !== 'customer') {
          window.location.assign(`/${theirs}/agent`);
          return;
        }
        try {
          const { url } = await apiService.handoff();
          // This site's copy of the sign-in isn't needed: it continues there
          ['token', 'refreshToken', 'user', 'company'].forEach((k) => localStorage.removeItem(k));
          window.location.assign(url);
          return;
        } catch {
          // No address for their company yet: carry on here
        }
      }

      // Get the user from localStorage to determine redirect
      const userStr = localStorage.getItem('user');
      const token = localStorage.getItem('token');

      console.log(
        'Login successful, user:',
        userStr ? 'exists' : 'missing',
        'token:',
        token ? 'exists' : 'missing'
      );

      if (userStr) {
        const user = JSON.parse(userStr);
        console.log('User role:', user.role);

        // Small delay to ensure localStorage is updated
        setTimeout(() => {
          // Redirect based on role
          switch (user.role) {
            case 'admin':
              console.log('Redirecting to agent dashboard');
              navigate('/agent', { replace: true });
              break;
            case 'employee':
              console.log('Redirecting to agent dashboard');
              navigate('/agent', { replace: true });
              break;
            case 'customer':
              console.log('Redirecting to customer dashboard');
              navigate('/customer', { replace: true });
              break;
            default:
              console.log('Unknown role, redirecting to agent dashboard');
              navigate('/agent', { replace: true });
          }
        }, 100);
      } else {
        console.log('No user data found, redirecting to employee dashboard');
        navigate('/employee', { replace: true });
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setUnverified(err.code === 'EMAIL_NOT_VERIFIED');
      setError(err.message || 'Login failed. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header Banner */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            {slug ? (
              <div className="flex items-center space-x-3 min-h-[32px]">
                {company?.logoUrl && (
                  <img
                    src={company.logoUrl}
                    alt=""
                    className="h-8 w-auto max-w-[160px] object-contain"
                  />
                )}
                <span className="text-lg font-semibold text-gray-900">{company?.name}</span>
              </div>
            ) : (
              <Link
                to="/"
                className="flex items-center space-x-2 hover:opacity-80 transition-opacity"
              >
                <Logo size={32} />
              </Link>
            )}
            <div className={slug ? 'hidden' : 'flex items-center space-x-4'}>
              <Link to="/" className="text-gray-600 hover:text-gray-900 transition-colors">
                Home
              </Link>
              <Link to="/pricing" className="text-gray-600 hover:text-gray-900 transition-colors">
                Pricing
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Login Form */}
      <div className="flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          {slug ? (
            <div>
              {company?.logoUrl && (
                <img
                  src={company.logoUrl}
                  alt=""
                  className="mx-auto h-24 w-auto max-w-full object-contain"
                />
              )}
              <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
                {companyMissing ? 'Company not found' : `Sign in to ${company?.name || '…'}`}
              </h2>
              <p className="mt-2 text-center text-sm text-gray-600">
                {companyMissing ? (
                  <>
                    There's no company at this address.{' '}
                    <a href="/login" className="font-medium text-blue-600 hover:text-blue-500">
                      Go to the Bomizzel sign-in
                    </a>
                  </>
                ) : (
                  <>
                    Staff sign-in. Customer of {company?.name || 'this company'}?{' '}
                    <a
                      href={customerPortal}
                      className="font-medium text-blue-600 hover:text-blue-500"
                    >
                      Go to the customer portal
                    </a>
                  </>
                )}
              </p>
            </div>
          ) : (
            <div>
              {/* Room for the full lockup here, where the "Software Solutions"
                line and tagline are actually readable. */}
              <img
                src="/logo-full.png"
                alt="Bomizzel Software Solutions"
                width={720}
                height={435}
                className="mx-auto h-28 w-auto"
              />
              <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
                Sign in to your account
              </h2>
              <p className="mt-2 text-center text-sm text-gray-600">
                New to Bomizzel?{' '}
                <Link to="/register" className="font-medium text-blue-600 hover:text-blue-500">
                  Start a free trial for your company
                </Link>
              </p>
            </div>
          )}
          <div className="card">
            <div className="card-body">
              <form className="space-y-6" onSubmit={handleSubmit}>
                {error && !unverified && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                    {error}
                  </div>
                )}

                {unverified && (
                  <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded space-y-2">
                    <p className="font-medium">Please confirm your email address first.</p>
                    <p className="text-sm">
                      We sent a link to {formData.email}. Open it, then sign in again.
                    </p>
                    {resendState === 'sent' ? (
                      <p className="text-sm">
                        A new link is on its way - check your inbox and spam.
                      </p>
                    ) : (
                      <button
                        type="button"
                        onClick={resendLink}
                        disabled={resendState === 'sending'}
                        className="text-sm font-medium text-blue-700 hover:text-blue-800 underline disabled:opacity-50"
                      >
                        {resendState === 'sending' ? 'Sending...' : 'Send me a new link'}
                      </button>
                    )}
                  </div>
                )}

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
                    autoComplete="current-password"
                    required
                    value={formData.password}
                    onChange={handleChange}
                    className="input mt-1"
                    placeholder="Enter your password"
                  />
                  <div className="mt-2 text-right">
                    <Link
                      to="/forgot-password"
                      className="text-sm text-blue-600 hover:text-blue-500"
                    >
                      Forgot your password?
                    </Link>
                  </div>
                </div>

                <div>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? 'Signing in...' : 'Sign in'}
                  </button>
                </div>
              </form>

              {/* Customers of a company on Bomizzel sign in on its portal, not here */}
              {!slug && <FindPortal className="mt-8 pt-6 border-t border-gray-200" />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
