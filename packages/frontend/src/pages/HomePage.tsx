import React from 'react';
import { Link } from 'react-router-dom';
import TicketMascot from '../components/TicketMascot';

const HomePage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-100">
      {/* Header with Sign In */}
      <header className="container mx-auto px-4 py-6">
        <div className="flex justify-between items-center">
          <div className="text-2xl font-bold text-primary-600">Bomizzel</div>
          <div className="flex items-center space-x-6">
            <Link to="/pricing" className="text-gray-600 hover:text-gray-900 font-medium">
              Pricing
            </Link>
            <Link to="/login" className="btn-outline px-6 py-2">
              Sign In
            </Link>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          {/* Hero Section with Mascot */}
          <div className="flex flex-col lg:flex-row items-center justify-center gap-12 mb-12">
            <div className="lg:text-left">
              <h1 className="text-5xl font-bold text-gray-900 mb-6">
                Welcome to <span className="text-primary-600">Bomizzel</span>
              </h1>
              <p className="text-xl text-gray-600 mb-8 max-w-2xl">
                A comprehensive ticketing system that connects customers with support teams through
                powerful tools for ticket management, custom workflows, and real-time collaboration.
              </p>
              <p className="text-lg text-gray-500 italic mb-4">
                "Don't worry, we'll get you fixed up in no time!"
              </p>
            </div>

            {/* Mascot Character */}
            <div className="flex-shrink-0">
              <div className="relative">
                <TicketMascot
                  size="xl"
                  className="hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute -bottom-4 left-1/2 transform -translate-x-1/2 text-sm text-gray-400 font-medium">
                  Meet Tixy, our support mascot!
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-center gap-4 mb-8">
            <Link to="/company-register" className="btn-primary text-lg px-8 py-3">
              Start Your Company Trial
            </Link>
            <Link to="/register" className="btn-outline text-lg px-8 py-3">
              Join Existing Company
            </Link>
            <Link to="/pricing" className="btn-outline text-lg px-8 py-3">
              View Pricing Plans
            </Link>
          </div>

          {/* Demo Section */}
          <div className="mb-16 p-6 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-xl border border-blue-200 dark:border-blue-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              🎨 Try Our Interactive Features
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Try our simple color picker - type hex codes or drag to select colors for statuses and
              priorities
            </p>
            <Link
              to="/color-picker-demo"
              className="inline-flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-200 transform hover:scale-105"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zM7 3H5a2 2 0 00-2 2v12a4 4 0 004 4h2M9 3h10a2 2 0 012 2v12a4 4 0 01-4 4H9"
                />
              </svg>
              <span>Try Color Picker</span>
            </Link>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            <div className="card p-6 text-center">
              <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4 relative overflow-hidden">
                <TicketMascot size="sm" className="scale-75" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Easy Ticket Submission</h3>
              <p className="text-gray-600">
                Submit support tickets with custom fields and file attachments through our intuitive
                customer portal. Tixy is here to help!
              </p>
            </div>

            <div className="card p-6 text-center">
              <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-8 h-8 text-primary-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">Team Collaboration</h3>
              <p className="text-gray-600">
                Powerful employee dashboard with Kanban boards, custom workflows, and real-time
                notifications.
              </p>
            </div>

            <div className="card p-6 text-center">
              <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-8 h-8 text-primary-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">Analytics & Insights</h3>
              <p className="text-gray-600">
                Track performance with comprehensive dashboards, metrics, and reporting tools.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
