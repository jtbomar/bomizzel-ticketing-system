import React from 'react';
import { Link } from 'react-router-dom';
import Logo from '../components/Logo';

type Feature = {
  title: string;
  description: string;
  icon: React.ReactNode;
};

const iconProps = {
  className: 'w-5 h-5',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  viewBox: '0 0 24 24',
  'aria-hidden': true,
} as const;

const features: Feature[] = [
  {
    title: 'Ticket management',
    description:
      'Queues, statuses and priorities you define yourself, so the workflow matches how your team already works rather than the other way round.',
    icon: (
      <svg {...iconProps}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"
        />
      </svg>
    ),
  },
  {
    title: 'Shared queues and notes',
    description:
      'Internal notes stay internal. Customers see the conversation; your team sees the working out behind it.',
    icon: (
      <svg {...iconProps}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
        />
      </svg>
    ),
  },
  {
    title: 'Custom fields',
    description:
      'Capture the details that matter for your work — asset tags, order numbers, site codes — and search on them later.',
    icon: (
      <svg {...iconProps}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
        />
      </svg>
    ),
  },
  {
    title: 'Reporting',
    description:
      'Volume, resolution times and workload per agent, so you can answer where the time is going without exporting anything.',
    icon: (
      <svg {...iconProps}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
        />
      </svg>
    ),
  },
  {
    title: 'Email to ticket',
    description:
      'Mail sent to your support address becomes a ticket, and replies land back in the thread. Customers never need an account to get help.',
    icon: (
      <svg {...iconProps}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
        />
      </svg>
    ),
  },
  {
    title: 'Role-based access',
    description:
      'Admins, team leads, agents and customers each see what they should. Company boundaries are enforced on every query, not just in the interface.',
    icon: (
      <svg {...iconProps}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
        />
      </svg>
    ),
  },
];

const steps = [
  {
    number: '01',
    title: 'Create your workspace',
    description: 'Register your company and you land in an empty, working system. No sales call.',
  },
  {
    number: '02',
    title: 'Set up teams and queues',
    description:
      'Add the people who answer tickets, the queues they answer from, and the statuses you use.',
  },
  {
    number: '03',
    title: 'Point your support address at it',
    description: 'Forward your support inbox and tickets start arriving. Customers do nothing new.',
  },
];

/** A still of the ticket list, drawn rather than screenshotted so it stays sharp and in theme. */
const ProductPreview: React.FC = () => {
  const rows = [
    { id: '1284', subject: 'VPN disconnects on the third floor', status: 'Open', tone: 'amber' },
    {
      id: '1283',
      subject: 'New starter — laptop and accounts',
      status: 'In progress',
      tone: 'blue',
    },
    { id: '1281', subject: 'Invoice export missing March', status: 'Resolved', tone: 'green' },
    { id: '1279', subject: 'Printer queue stuck in Accounts', status: 'Open', tone: 'amber' },
  ];

  const toneClasses: Record<string, string> = {
    amber: 'bg-amber-50 text-amber-700 ring-amber-600/20',
    blue: 'bg-blue-50 text-blue-700 ring-blue-600/20',
    green: 'bg-green-50 text-green-700 ring-green-600/20',
  };

  return (
    <div
      className="rounded-xl border border-gray-200 bg-white shadow-xl shadow-gray-900/5 overflow-hidden"
      aria-hidden="true"
    >
      <div className="flex items-center gap-1.5 border-b border-gray-200 bg-gray-50 px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-gray-300" />
        <span className="h-2.5 w-2.5 rounded-full bg-gray-300" />
        <span className="h-2.5 w-2.5 rounded-full bg-gray-300" />
        <span className="ml-3 text-xs font-medium text-gray-500">Support queue</span>
      </div>
      <div className="divide-y divide-gray-100">
        {rows.map((row) => (
          <div key={row.id} className="flex items-center gap-4 px-4 py-3.5">
            <span className="w-12 shrink-0 font-mono text-xs text-gray-400">#{row.id}</span>
            <span className="min-w-0 flex-1 truncate text-sm text-gray-700">{row.subject}</span>
            <span
              className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
                toneClasses[row.tone]
              }`}
            >
              {row.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

const HomePage: React.FC = () => {
  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-30 border-b border-gray-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link
            to="/"
            className="rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-2"
          >
            <Logo size={32} />
            <span className="sr-only">Bomizzel home</span>
          </Link>
          <nav className="flex items-center gap-2 sm:gap-6" aria-label="Main">
            <Link
              to="/pricing"
              className="hidden rounded-md px-2 py-1 text-sm font-medium text-gray-600 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 sm:block"
            >
              Pricing
            </Link>
            <Link
              to="/login"
              className="rounded-md px-2 py-1 text-sm font-medium text-gray-600 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
            >
              Sign in
            </Link>
            <Link
              to="/company-register"
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-2"
            >
              Get started
            </Link>
          </nav>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="border-b border-gray-200 bg-gradient-to-b from-gray-50 to-white">
          <div className="mx-auto grid max-w-6xl gap-12 px-6 py-20 lg:grid-cols-2 lg:items-center lg:gap-16 lg:py-28">
            <div>
              <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1 text-sm font-medium text-gray-600">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                Free to start — no card required
              </p>
              <h1 className="text-4xl font-bold leading-[1.1] tracking-tight text-gray-900 sm:text-5xl">
                Support tickets your team can actually keep on top of
              </h1>
              <p className="mt-6 text-lg leading-relaxed text-gray-600">
                Bomizzel gives you queues, custom fields, internal notes and email-to-ticket in one
                place — set up in an afternoon, not a quarter.
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Link
                  to="/company-register"
                  className="rounded-lg bg-primary-600 px-6 py-3.5 text-center text-base font-semibold text-white shadow-sm transition-colors hover:bg-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-2"
                >
                  Create your workspace
                </Link>
                <Link
                  to="/register"
                  className="rounded-lg border border-gray-300 bg-white px-6 py-3.5 text-center text-base font-semibold text-gray-900 transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-2"
                >
                  Join an existing company
                </Link>
              </div>
              <p className="mt-6 text-sm text-gray-500">
                Unlimited tickets · Set up in minutes · Your data stays yours
              </p>
            </div>

            <div className="lg:pl-4">
              <ProductPreview />
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="mx-auto max-w-6xl px-6 py-20 lg:py-24">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              Everything a support desk needs, and not much else
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-gray-600">
              The pieces below are the whole product. There is no tier where the useful parts live.
            </p>
          </div>

          <div className="mt-14 grid gap-px overflow-hidden rounded-xl border border-gray-200 bg-gray-200 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <div key={feature.title} className="bg-white p-8">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
                  {feature.icon}
                </div>
                <h3 className="mt-5 text-base font-semibold text-gray-900">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section className="border-y border-gray-200 bg-gray-50">
          <div className="mx-auto max-w-6xl px-6 py-20 lg:py-24">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              Running by the end of the afternoon
            </h2>
            <ol className="mt-14 grid gap-10 sm:grid-cols-3 sm:gap-8">
              {steps.map((step) => (
                <li key={step.number}>
                  <span className="font-mono text-sm font-semibold text-primary-600">
                    {step.number}
                  </span>
                  <h3 className="mt-3 text-lg font-semibold text-gray-900">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-gray-600">{step.description}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Closing call to action */}
        <section className="mx-auto max-w-6xl px-6 py-20 lg:py-24">
          <div className="rounded-2xl bg-navy-900 px-8 py-14 text-center sm:px-16">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Start with one queue and grow into it
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg leading-relaxed text-gray-300">
              Create a workspace, forward your support address, and see how it handles a real week.
            </p>
            <Link
              to="/company-register"
              className="mt-9 inline-block rounded-lg bg-white px-7 py-3.5 text-base font-semibold text-gray-900 transition-colors hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-navy-900"
            >
              Create your workspace
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-gray-200 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
            <div className="max-w-xs">
              <Logo size={28} />
              <p className="mt-3 text-sm leading-relaxed text-gray-500">
                Support ticketing for teams that would rather be answering tickets than configuring
                them.
              </p>
            </div>
            <nav aria-label="Footer" className="flex gap-16">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Product</h2>
                <ul className="mt-3 space-y-2 text-sm text-gray-600">
                  <li>
                    <Link to="/pricing" className="hover:text-gray-900">
                      Pricing
                    </Link>
                  </li>
                  <li>
                    <Link to="/company-register" className="hover:text-gray-900">
                      Get started
                    </Link>
                  </li>
                </ul>
              </div>
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Account</h2>
                <ul className="mt-3 space-y-2 text-sm text-gray-600">
                  <li>
                    <Link to="/login" className="hover:text-gray-900">
                      Sign in
                    </Link>
                  </li>
                  <li>
                    <Link to="/register" className="hover:text-gray-900">
                      Join a company
                    </Link>
                  </li>
                </ul>
              </div>
            </nav>
          </div>
          <p className="mt-10 border-t border-gray-100 pt-6 text-sm text-gray-500">
            © {new Date().getFullYear()} Bomizzel
          </p>
        </div>
      </footer>
    </div>
  );
};

export default HomePage;
