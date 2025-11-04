import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ticketLayoutApi } from '../services/ticketLayoutApi';
import { TicketLayout, CreateLayoutRequest } from '../types/ticketLayout';
import TicketLayoutBuilder from '../components/TicketLayoutBuilder';

const TicketLayoutManagement: React.FC = () => {
  const [layouts, setLayouts] = useState<TicketLayout[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingLayout, setEditingLayout] = useState<TicketLayout | null>(null);
  const [selectedTeamId] = useState('1'); // Default team for demo

  useEffect(() => {
    loadLayouts();
  }, [selectedTeamId]);

  const loadLayouts = async () => {
    try {
      setLoading(true);
      const layoutsData = await ticketLayoutApi.getLayoutsByTeam(selectedTeamId);
      setLayouts(layoutsData);
    } catch (error) {
      console.error('Error loading layouts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateLayout = () => {
    setEditingLayout(null);
    setShowBuilder(true);
  };

  const handleEditLayout = (layout: TicketLayout) => {
    setEditingLayout(layout);
    setShowBuilder(true);
  };

  const handleSaveLayout = async (layoutData: CreateLayoutRequest) => {
    try {
      if (editingLayout) {
        await ticketLayoutApi.updateLayout(editingLayout.id, layoutData);
      } else {
        await ticketLayoutApi.createLayout(selectedTeamId, layoutData);
      }

      setShowBuilder(false);
      setEditingLayout(null);
      await loadLayouts();
    } catch (error) {
      console.error('Error saving layout:', error);
      alert('Failed to save layout. Please try again.');
    }
  };

  const handleDuplicateLayout = async (layout: TicketLayout) => {
    const newName = prompt('Enter name for duplicated layout:', `${layout.name} (Copy)`);
    if (!newName) return;

    try {
      await ticketLayoutApi.duplicateLayout(layout.id, newName);
      await loadLayouts();
    } catch (error) {
      console.error('Error duplicating layout:', error);
      alert('Failed to duplicate layout. Please try again.');
    }
  };

  const handleDeleteLayout = async (layout: TicketLayout) => {
    if (!confirm(`Are you sure you want to delete "${layout.name}"?`)) return;

    try {
      await ticketLayoutApi.deleteLayout(layout.id);
      await loadLayouts();
    } catch (error) {
      console.error('Error deleting layout:', error);
      alert('Failed to delete layout. Please try again.');
    }
  };

  const handleSetDefault = async (layout: TicketLayout) => {
    try {
      await ticketLayoutApi.updateLayout(layout.id, { isDefault: true });
      await loadLayouts();
    } catch (error) {
      console.error('Error setting default layout:', error);
      alert('Failed to set default layout. Please try again.');
    }
  };

  if (showBuilder) {
    return (
      <TicketLayoutBuilder
        layout={editingLayout || undefined}
        onSave={handleSaveLayout}
        onCancel={() => {
          setShowBuilder(false);
          setEditingLayout(null);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-4">
              <Link
                to="/admin"
                className="text-gray-600 hover:text-gray-800 flex items-center space-x-1"
              >
                <span>←</span>
                <span>Back to Admin</span>
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Ticket Layouts</h1>
                <p className="text-sm text-gray-600">
                  Create and manage custom ticket forms for your team
                </p>
              </div>
            </div>
            <button
              onClick={handleCreateLayout}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center space-x-2"
            >
              <span>+</span>
              <span>New Layout</span>
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : layouts.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 text-6xl mb-4">🎨</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No layouts yet</h3>
            <p className="text-gray-600 mb-6">
              Create your first ticket layout to customize how agents collect information
            </p>
            <button
              onClick={handleCreateLayout}
              className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Create First Layout
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {layouts.map((layout) => (
              <LayoutCard
                key={layout.id}
                layout={layout}
                onEdit={() => handleEditLayout(layout)}
                onDuplicate={() => handleDuplicateLayout(layout)}
                onDelete={() => handleDeleteLayout(layout)}
                onSetDefault={() => handleSetDefault(layout)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// Layout Card Component
interface LayoutCardProps {
  layout: TicketLayout;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onSetDefault: () => void;
}

const LayoutCard: React.FC<LayoutCardProps> = ({
  layout,
  onEdit,
  onDuplicate,
  onDelete,
  onSetDefault,
}) => {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center space-x-2">
              <h3 className="text-lg font-semibold text-gray-900">{layout.name}</h3>
              {layout.isDefault && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  Default
                </span>
              )}
            </div>
            {layout.description && (
              <p className="text-sm text-gray-600 mt-1">{layout.description}</p>
            )}
          </div>
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
              </svg>
            </button>
            {showMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-10">
                <div className="py-1">
                  <button
                    onClick={() => {
                      onEdit();
                      setShowMenu(false);
                    }}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Edit Layout
                  </button>
                  <button
                    onClick={() => {
                      onDuplicate();
                      setShowMenu(false);
                    }}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Duplicate
                  </button>
                  {!layout.isDefault && (
                    <button
                      onClick={() => {
                        onSetDefault();
                        setShowMenu(false);
                      }}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      Set as Default
                    </button>
                  )}
                  <hr className="my-1" />
                  <button
                    onClick={() => {
                      onDelete();
                      setShowMenu(false);
                    }}
                    className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Fields:</span>
            <span className="font-medium">{layout.fields?.length || 0}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Grid:</span>
            <span className="font-medium">
              {layout.layoutConfig.gridColumns} × {layout.layoutConfig.gridRows}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Created:</span>
            <span className="font-medium">{new Date(layout.createdAt).toLocaleDateString()}</span>
          </div>
        </div>

        {/* Field Preview */}
        {layout.fields && layout.fields.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="text-xs text-gray-500 mb-2">Fields Preview:</div>
            <div className="flex flex-wrap gap-1">
              {layout.fields.slice(0, 6).map((field, index) => (
                <span
                  key={index}
                  className="inline-flex items-center px-2 py-1 rounded text-xs bg-gray-100 text-gray-700"
                >
                  {field.fieldLabel}
                </span>
              ))}
              {layout.fields.length > 6 && (
                <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-gray-100 text-gray-500">
                  +{layout.fields.length - 6} more
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 rounded-b-lg">
        <button
          onClick={onEdit}
          className="w-full px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-800"
        >
          Edit Layout
        </button>
      </div>
    </div>
  );
};

export default TicketLayoutManagement;
