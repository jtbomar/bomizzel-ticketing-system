import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import Logo from '../components/Logo';

/**
 * bomizzel.com/privacy. Also the "data deletion instructions" link Facebook
 * asks for (#delete). Describes what the product actually does: keep it in
 * step when that changes (new services, analytics, retention).
 */

const EFFECTIVE = 'October 16, 2026';
const CONTACT = 'jeff@bomizzel.com';

const Section: React.FC<{ id?: string; title: string; children: React.ReactNode }> = ({
  id,
  title,
  children,
}) => (
  <section id={id} className="mt-10 scroll-mt-24">
    <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
    <div className="mt-3 space-y-3 text-gray-700 leading-relaxed">{children}</div>
  </section>
);

const PrivacyPage: React.FC = () => {
  useEffect(() => {
    document.title = 'Privacy Policy - Bomizzel';
    // Arriving at /privacy#delete: scroll to it once the page is drawn
    if (window.location.hash) {
      document.querySelector(window.location.hash)?.scrollIntoView();
    }
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex justify-between items-center">
          <Link to="/" className="hover:opacity-80">
            <Logo size={32} />
          </Link>
          <Link to="/login" className="text-gray-600 hover:text-gray-900">
            Sign in
          </Link>
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <h1 className="text-3xl font-bold text-gray-900">Privacy Policy</h1>
        <p className="mt-2 text-sm text-gray-500">Effective {EFFECTIVE}</p>

        <p className="mt-6 text-gray-700 leading-relaxed">
          Bomizzel is a help desk and ticketing service run by Bomizzel Services Inc.
          (&quot;Bomizzel&quot;, &quot;we&quot;, &quot;us&quot;). This policy explains what
          information we collect when you use bomizzel.com, a company&apos;s Bomizzel help desk, or
          a customer support portal on help.bomizzel.com, what we do with it, and the choices you
          have.
        </p>

        <Section title="Two kinds of users">
          <p>
            <strong>Companies that use Bomizzel</strong> (our subscribers) and their staff have an
            account with us. We are responsible for that account information.
          </p>
          <p>
            <strong>Customers of those companies</strong> contact them through Bomizzel: by email,
            or on the company&apos;s portal at help.bomizzel.com/&lt;company&gt;. Tickets and
            contact details there belong to that company. We store and process them on the
            company&apos;s behalf and under its instructions. If you are one of its customers, the
            company decides how your information is used, and you can contact it directly. You can
            also contact us and we will pass your request on.
          </p>
        </Section>

        <Section title="What we collect">
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong>Account details:</strong> your name, email address, phone number if you give
              one, and your password (stored only as a one-way hash, never in readable form).
            </li>
            <li>
              <strong>Company details</strong> a subscriber enters: company name, address, logo,
              colors, email signatures and portal settings.
            </li>
            <li>
              <strong>Support content:</strong> tickets, replies, notes, attachments, and emails
              sent to a company&apos;s Bomizzel support address.
            </li>
            <li>
              <strong>Satisfaction survey answers</strong>, with the IP address and browser they
              were sent from.
            </li>
            <li>
              <strong>Billing:</strong> subscriptions are paid through Stripe. Stripe collects your
              card details; we never see or store card numbers. We keep the plan, billing email and
              Stripe&apos;s reference numbers.
            </li>
            <li>
              <strong>Technical information:</strong> our servers log requests (including IP address
              and browser) for security and troubleshooting.
            </li>
          </ul>
        </Section>

        <Section title="Signing in with Google, Microsoft or Facebook">
          <p>
            If you choose to sign in with one of these, the provider tells us your email address and
            name. We use them only to match you to your Bomizzel account, or to create a customer
            account on the portal you are signing in to. We do not receive your password for that
            service, we do not post anything for you, and we do not access your contacts, friends,
            files or anything else in that account.
          </p>
        </Section>

        <Section title="How we use it">
          <ul className="list-disc pl-6 space-y-2">
            <li>To run the service: sign you in, show and route tickets, send ticket emails.</li>
            <li>To send account emails: confirmations, password resets, invitations, receipts.</li>
            <li>To bill subscribers.</li>
            <li>To keep the service secure, prevent abuse, and fix problems.</li>
          </ul>
          <p>
            We do not sell your information, use it for advertising, or share it with advertisers.
            Bomizzel has no advertising or analytics trackers.
          </p>
        </Section>

        <Section title="Cookies and browser storage">
          <p>
            We keep your sign-in in your browser&apos;s storage so you stay signed in. When you sign
            in with Google, Microsoft or Facebook, we set one short-lived cookie (ten minutes at
            most) to check that the sign-in finishes in the same browser that started it. We use no
            tracking or advertising cookies.
          </p>
        </Section>

        <Section title="Who we share it with">
          <p>
            We use these services to run Bomizzel. They handle data only to provide their service to
            us:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Railway: hosting, databases and file storage (United States)</li>
            <li>Vercel: hosting for the website</li>
            <li>Resend: sending and receiving email</li>
            <li>Stripe: payments</li>
            <li>Google, Microsoft and Facebook: only if you choose to sign in with them</li>
          </ul>
          <p>
            A company&apos;s staff can see the tickets and contact details of that company&apos;s
            customers. One company cannot see another&apos;s data. We may also disclose information
            if the law requires it, or to protect the rights and safety of our users or the public.
          </p>
        </Section>

        <Section title="How long we keep it">
          <p>
            We keep account and support information while the account is active, so tickets and
            their history stay available to the company. When an account is deleted, we delete its
            information within 30 days, except where we must keep records for legal, tax or security
            reasons.
          </p>
        </Section>

        <Section id="delete" title="Deleting your information">
          <p>
            To delete your Bomizzel account and its information, email{' '}
            <a href={`mailto:${CONTACT}`} className="text-blue-600 hover:underline">
              {CONTACT}
            </a>{' '}
            from the address on the account, with &quot;Delete my account&quot; in the subject. We
            confirm the request and complete it within 30 days.
          </p>
          <p>
            If you are a customer of a company that uses Bomizzel, you can ask that company to
            delete your information, or email us and we will pass your request on.
          </p>
          <p>
            If you signed in with Facebook, you can also remove Bomizzel from Facebook under
            Settings &amp; privacy › Settings › Apps and websites. That stops Facebook sign-in;
            email us as above to delete the information we hold.
          </p>
        </Section>

        <Section title="Security">
          <p>
            Bomizzel is served only over encrypted connections (HTTPS). Passwords are stored as
            one-way hashes. Each company&apos;s data is kept separate, and staff can reach only
            their own company&apos;s. No system is perfectly secure, but we work to protect your
            information and fix problems quickly.
          </p>
        </Section>

        <Section title="Children">
          <p>
            Bomizzel is a business tool and is not meant for children under 13. We do not knowingly
            collect information from them.
          </p>
        </Section>

        <Section title="Changes to this policy">
          <p>
            If we change this policy, we will update the date at the top. For significant changes,
            we will tell subscribers by email or in the app before they take effect.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            Questions or requests about privacy: email{' '}
            <a href={`mailto:${CONTACT}`} className="text-blue-600 hover:underline">
              {CONTACT}
            </a>
            .
          </p>
        </Section>
      </main>
    </div>
  );
};

export default PrivacyPage;
