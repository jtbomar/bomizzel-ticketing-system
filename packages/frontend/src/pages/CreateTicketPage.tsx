import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { ticketLayoutApi } from '../services/ticketLayoutApi';
import { TicketLayout } from '../types/ticketLayout';
import DynamicTicketForm from '../components/DynamicTicketForm';

const CreateTicketPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [availableLayouts, setAvailableLayouts] = useState<TicketLayout[]>([]);
  const [selectedLayoutId, setSelectedLayoutId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [selectedTeamId] = useState('1'); // Default team for demo

  useEffect(() => {
    loadAvailableLayouts();
  }, []);

  const loadAvailableLayouts = async () => {
    try {
      setLoading(true);
      const layouts = await ticketLayoutApi.getLayoutsByTeam(selectedTeamId);
      setAvailableLayouts(layouts);

      // Auto-select default layout if available
      const defaultLayout = layouts.find((layout) => layout.isDefault);
      if (defaultLayout) {
        setSelectedLayoutId(defaultLayout.id);
      } else if (layouts.length > 0) {
        setSelectedLayoutId(layouts[0].id);
      }
    } catch (error) {
      console.error('Error loading layouts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitTicket = async (formData: Record<string, any>) => {
    try {
      // In a real application, you would submit to your tickets API
      console.log('Submitting ticket with data:', formData);

      // Extract core fields and custom fields
      const { title, description, status, priority, ...customFields } = formData;

      // Mock API call - in production, submit to your tickets API
      console.log('Ticket data:', {
        title: title || 'New Ticket',
        description: description || '',
        status: status || 'open',
        priority: priority || 'medium',
        customFieldValues: customFields,
        submitterId: user?.id,
        teamId: selectedTeamId,
        layoutId: selectedLayoutId,
      });

      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      alert('Ticket created successfully!');
      navigate('/dashboard');
    } catch (error) {
      console.error('Error creating ticket:', error);
      alert('Failed to create ticket. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Create New Ticket</h1>
              <p className="text-sm text-gray-600">
                Fill out the form below to submit your support request
              </p>
            </div>
            <button
              onClick={() => navigate('/dashboard')}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              ← Back to Dashboard
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {availableLayouts.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 text-6xl mb-4">📝</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No ticket forms available</h3>
            <p className="text-gray-600">
              Please contact your administrator to set up ticket forms for your team.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Layout Selector */}
            {availableLayouts.length > 1 && (
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Ticket Type
                </label>
                <select
                  value={selectedLayoutId}
                  onChange={(e) => setSelectedLayoutId(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {availableLayouts.map((layout) => (
                    <option key={layout.id} value={layout.id}>
                      {layout.name}
                      {layout.isDefault && ' (Default)'}
                    </option>
                  ))}
                </select>
                {selectedLayoutId && (
                  <p className="text-sm text-gray-600 mt-2">
                    {availableLayouts.find((l) => l.id === selectedLayoutId)?.description}
                  </p>
                )}
              </div>
            )}

            {/* Dynamic Form */}
            {selectedLayoutId && (
              <DynamicTicketForm
                teamId={selectedTeamId}
                layoutId={selectedLayoutId}
                onSubmit={handleSubmitTicket}
                onCancel={() => navigate('/dashboard')}
                submitLabel="Create Ticket"
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CreateTicketPage;
