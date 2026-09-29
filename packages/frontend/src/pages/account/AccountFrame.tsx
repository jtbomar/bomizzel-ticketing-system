import React from 'react';
import { Link } from 'react-router-dom';
import Logo from '../../components/Logo';

/** The header and centred card the sign-in pages share. */
const AccountFrame: React.FC<{ title: string; children: React.ReactNode }> = ({
  title,
  children,
}) => (
  <div className="min-h-screen bg-gray-50">
    <div className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-4">
          <Link to="/" className="flex items-center space-x-2 hover:opacity-80 transition-opacity">
            <Logo size={32} />
          </Link>
          <Link to="/login" className="text-gray-600 hover:text-gray-900 transition-colors">
            Sign in
          </Link>
        </div>
      </div>
    </div>
    <div className="flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        <h1 className="text-2xl font-bold text-gray-900 text-center mb-6">{title}</h1>
        <div className="card">
          <div className="card-body space-y-4">{children}</div>
        </div>
      </div>
    </div>
  </div>
);

export default AccountFrame;
