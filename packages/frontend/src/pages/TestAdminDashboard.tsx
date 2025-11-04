import React from 'react';

const TestAdminDashboard: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Admin Dashboard</h1>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">User Management</h2>
          <p className="text-gray-600 mb-4">Manage system users and their permissions.</p>

          <div className="space-y-4">
            <div className="border rounded-lg p-4">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-medium">Admin User</h3>
                  <p className="text-sm text-gray-500">admin@bomizzel.com</p>
                </div>
                <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm">Admin</span>
              </div>
            </div>

            <div className="border rounded-lg p-4">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-medium">Employee User</h3>
                  <p className="text-sm text-gray-500">employee@test.com</p>
                </div>
                <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm">
                  Employee
                </span>
              </div>
            </div>
          </div>

          <button className="mt-6 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
            Add New User
          </button>
        </div>
      </div>
    </div>
  );
};

export default TestAdminDashboard;
