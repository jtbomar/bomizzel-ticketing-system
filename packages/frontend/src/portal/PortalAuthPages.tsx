import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { portalApi, portalError } from './portalApi';
import { usePortal } from './PortalApp';

/** Sign in, sign up, forgot / reset password and confirm email, on a portal. */

export const inputClass =
  'mt-1 block w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand)] focus:border-[var(--brand)]';

export const BrandButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({
  className = '',
  ...props
}) => (
  <button
    {...props}
    className={`inline-flex justify-center items-center px-4 py-2 text-sm font-semibold rounded-md bg-[var(--brand)] text-[color:var(--on-brand)] hover:opacity-90 disabled:opacity-50 ${className}`}
  />
);

const Card: React.FC<{ title: string; subtitle?: string; children: React.ReactNode }> = ({
  title,
  subtitle,
  children,
}) => (
  <div className="max-w-md mx-auto mt-6 bg-white border border-gray-200 rounded-lg shadow-sm p-6">
    <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
    {subtitle && <p className="mt-1 text-sm text-gray-600">{subtitle}</p>}
    <div className="mt-5">{children}</div>
  </div>
);

const Alert: React.FC<{ kind?: 'error' | 'ok'; children: React.ReactNode }> = ({
  kind = 'error',
  children,
}) => (
  <div
    role={kind === 'error' ? 'alert' : 'status'}
    className={`mb-4 px-3 py-2 rounded text-sm border ${
      kind === 'error'
        ? 'bg-red-50 border-red-200 text-red-700'
        : 'bg-green-50 border-green-200 text-green-800'
    }`}
  >
    {children}
  </div>
);

export const PortalLogin: React.FC = () => {
  const { brand, session, signIn, path } = usePortal();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const next = params.get('next') || path();

  useEffect(() => {
    if (session) navigate(next, { replace: true });
  }, [session, next, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await portalApi.post('/auth/login', { email: email.trim(), password });
      await signIn(res.data.token, res.data.refreshToken);
      navigate(next, { replace: true });
    } catch (err: any) {
      // An API error, or signIn's own (not a customer of this portal)
      setError(
        err?.response ? portalError(err, 'Sign-in failed.') : err?.message || 'Sign-in failed.'
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card
      title={`Sign in to ${brand.name} support`}
      subtitle="See and reply to your support requests."
    >
      <form onSubmit={submit} className="space-y-4">
        {error && <Alert>{error}</Alert>}
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
        </div>
        <BrandButton type="submit" disabled={busy} className="w-full">
          {busy ? 'Signing in…' : 'Sign in'}
        </BrandButton>
        <div className="flex justify-between text-sm">
          <Link to={path('forgot-password')} className="text-gray-600 hover:underline">
            Forgot password?
          </Link>
          <Link
            to={path('signup')}
            className="font-medium hover:underline"
            style={{ color: brand.color }}
          >
            Create an account
          </Link>
        </div>
      </form>
    </Card>
  );
};

export const PortalSignup: React.FC = () => {
  const { brand, slug, path } = usePortal();
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    companyName: '',
    password: '',
    confirm: '',
  });
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password.length < 8) return setError('Use a password of at least 8 characters.');
    if (form.password !== form.confirm) return setError("The passwords don't match.");
    setBusy(true);
    setError('');
    try {
      await portalApi.post(`/portal/${encodeURIComponent(slug)}/signup`, {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        companyName: form.companyName.trim(),
        password: form.password,
      });
      setDone(true);
    } catch (err) {
      setError(portalError(err, 'Sign-up failed.'));
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <Card title="Check your email">
        <p className="text-sm text-gray-700">
          We sent a link to <strong>{form.email.trim()}</strong>. Open it to confirm your address,
          then sign in.
        </p>
        <p className="mt-3 text-sm text-gray-600">
          You can open and follow your own tickets straight away. To see your company's tickets too,
          {` ${brand.name}`} will approve your account.
        </p>
        <Link
          to={path('login')}
          className="mt-5 inline-block text-sm font-medium hover:underline"
          style={{ color: brand.color }}
        >
          Go to sign in
        </Link>
      </Card>
    );
  }

  const field = (
    name: keyof typeof form,
    label: string,
    type = 'text',
    extra: Record<string, any> = {}
  ) => (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-gray-700">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        value={form[name]}
        onChange={set}
        className={inputClass}
        {...extra}
      />
    </div>
  );

  return (
    <Card
      title={`Create your ${brand.name} support account`}
      subtitle="Open tickets and follow them here."
    >
      <form onSubmit={submit} className="space-y-4">
        {error && <Alert>{error}</Alert>}
        <div className="grid grid-cols-2 gap-3">
          {field('firstName', 'First name', 'text', {
            required: true,
            autoComplete: 'given-name',
            maxLength: 50,
          })}
          {field('lastName', 'Last name', 'text', {
            required: true,
            autoComplete: 'family-name',
            maxLength: 50,
          })}
        </div>
        {field('email', 'Work email', 'email', { required: true, autoComplete: 'email' })}
        {field('companyName', 'Company', 'text', { autoComplete: 'organization', maxLength: 150 })}
        {field('password', 'Password', 'password', {
          required: true,
          minLength: 8,
          autoComplete: 'new-password',
        })}
        {field('confirm', 'Confirm password', 'password', {
          required: true,
          autoComplete: 'new-password',
        })}
        <BrandButton type="submit" disabled={busy} className="w-full">
          {busy ? 'Creating account…' : 'Create account'}
        </BrandButton>
        <p className="text-sm text-center text-gray-600">
          Already have an account?{' '}
          <Link
            to={path('login')}
            className="font-medium hover:underline"
            style={{ color: brand.color }}
          >
            Sign in
          </Link>
        </p>
      </form>
    </Card>
  );
};

export const PortalForgotPassword: React.FC = () => {
  const { path, brand } = usePortal();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await portalApi.post('/auth/forgot-password', { email: email.trim() });
      setSent(true);
    } catch (err) {
      setError(portalError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title="Reset your password" subtitle="We'll email you a link to choose a new one.">
      {sent ? (
        <Alert kind="ok">If there's an account for {email.trim()}, a link is on its way.</Alert>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          {error && <Alert>{error}</Alert>}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />
          </div>
          <BrandButton type="submit" disabled={busy} className="w-full">
            {busy ? 'Sending…' : 'Send link'}
          </BrandButton>
        </form>
      )}
      <Link
        to={path('login')}
        className="mt-4 inline-block text-sm hover:underline"
        style={{ color: brand.color }}
      >
        Back to sign in
      </Link>
    </Card>
  );
};

export const PortalResetPassword: React.FC = () => {
  const { path, brand } = usePortal();
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const invite = params.get('invite') === '1';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return setError('Use at least 8 characters.');
    if (password !== confirm) return setError("The two passwords don't match.");
    setBusy(true);
    setError('');
    try {
      await portalApi.post('/auth/reset-password', { token, password });
      setDone(true);
    } catch (err) {
      setError(portalError(err, 'That link has expired. Ask for a new one.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card
      title={invite ? `Welcome to ${brand.name} support` : 'Choose a new password'}
      subtitle={invite ? 'Choose a password to finish setting up your account.' : undefined}
    >
      {done ? (
        <>
          <Alert kind="ok">Your password is set.</Alert>
          <Link
            to={path('login')}
            className="text-sm font-medium hover:underline"
            style={{ color: brand.color }}
          >
            Sign in
          </Link>
        </>
      ) : !token ? (
        <Alert>This link is missing its code. Use the link from your email.</Alert>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          {error && <Alert>{error}</Alert>}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="confirm" className="block text-sm font-medium text-gray-700">
              Confirm password
            </label>
            <input
              id="confirm"
              type="password"
              required
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className={inputClass}
            />
          </div>
          <BrandButton type="submit" disabled={busy} className="w-full">
            {busy ? 'Saving…' : 'Set password'}
          </BrandButton>
        </form>
      )}
    </Card>
  );
};

export const PortalVerifyEmail: React.FC = () => {
  const { path, brand } = usePortal();
  const [params] = useSearchParams();
  const [state, setState] = useState<'working' | 'ok' | 'failed'>('working');
  const [error, setError] = useState('');
  const once = useRef(false);

  useEffect(() => {
    if (once.current) return;
    once.current = true;
    portalApi
      .post('/auth/verify-email', { token: params.get('token') || '' })
      .then(() => setState('ok'))
      .catch((err) => {
        setError(portalError(err, 'That link has expired.'));
        setState('failed');
      });
  }, [params]);

  return (
    <Card title="Confirm your email">
      {state === 'working' && <p className="text-sm text-gray-600">Confirming…</p>}
      {state === 'ok' && (
        <>
          <Alert kind="ok">Your email is confirmed. You can sign in now.</Alert>
          <Link
            to={path('login')}
            className="text-sm font-medium hover:underline"
            style={{ color: brand.color }}
          >
            Sign in
          </Link>
        </>
      )}
      {state === 'failed' && <Alert>{error}</Alert>}
    </Card>
  );
};
