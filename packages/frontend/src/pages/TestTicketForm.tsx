import React, { useState } from 'react';
import DefaultTicketForm from '../components/DefaultTicketForm';

interface TicketFormData {
  title: string;
  description: string;
  status: string;
  priority: string;
  customer?: string;
  assignedTo?: string;
}

const TestTicketForm: React.FC = () => {
  const [submittedTickets, setSubmittedTickets] = useState<TicketFormData[]>([]);
  const [showForm, setShowForm] = useState(true);

  const handleSubmit = (data: TicketFormData) => {
    console.log('Ticket submitted:', data);
    setSubmittedTickets(prev => [...prev, data]);
    setShowForm(false);
    
    // Show success message
    alert('Ticket created successfully!');
  };

  const handleCancel = () => {
    setShowForm(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Test Default Ticket Form</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Test the default ticket layout with configured statuses and priorities.
          </p>
          <div className="mt-4 flex space-x-4">
            <a
              href="/admin"
              className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
            >
              Admin Panel → System Settings
            </a>
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Create New Ticket
            </button>
          </div>
        </div>

        {/* Form */}
        {showForm && (
          <div className="mb-8">
            <DefaultTicketForm
              onSubmit={handleSubmit}
              onCancel={handleCancel}
              submitLabel="Create Test Ticket"
            />
          </div>
        )}

        {/* Submitted Tickets */}
        {submittedTickets.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Submitted Tickets ({submittedTickets.length})
            </h2>
            <div className="space-y-4">
              {submittedTickets.map((ticket, index) => (
                <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900 dark:text-white">{ticket.title}</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{ticket.description}</p>
                      {ticket.customer && (
                        <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                          Customer: {ticket.customer}
                        </p>
                      )}
                      {ticket.assignedTo && (
                        <p className="text-sm text-gray-500 dark:text-gray-500">
                          Assigned: {ticket.assignedTo}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end space-y-2">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
                        {ticket.status}
                      </span>
                      <span className="text-sm font-medium text-purple-600">
                        {ticket.priority}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="mt-8 bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-700 rounded-lg p-6">
          <h3 className="text-lg font-medium text-blue-900 dark:text-blue-100 mb-2">How to Test</h3>
          <ol className="list-decimal list-inside space-y-2 text-sm text-blue-800 dark:text-blue-200">
            <li>Click "Admin Panel → System Settings" to access configuration</li>
            <li>Go to the "System Settings" tab in the admin panel</li>
            <li>Add new statuses or priorities with different colors</li>
            <li>Come back to this page and create a new ticket</li>
            <li>See how the form uses your configured options</li>
            <li>The core fields (Title, Description, Status, Priority) cannot be removed</li>
          </ol>
        </div>

        {/* Back Navigation */}
        <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
          <div className="flex space-x-4">
            <a
              href="/admin"
              className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              ← Back to Admin Dashboard
            </a>
            <a
              href="/employee"
              className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              → Employee Dashboard
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TestTicketForm;