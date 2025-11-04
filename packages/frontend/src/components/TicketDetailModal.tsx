import React, { useState, useEffect } from 'react';
import { Ticket, TicketNote, FileAttachment } from '../types';
import { apiService } from '../services/api';

interface TicketDetailModalProps {
  ticket: Ticket;
  onClose: () => void;
  onUpdate?: (updatedTicket: Ticket) => void;
}

const TicketDetailModal: React.FC<TicketDetailModalProps> = ({
  ticket,
  onClose,
}) => {
  const [notes, setNotes] = useState<TicketNote[]>([]);
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newNote, setNewNote] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [addingNote, setAddingNote] = useState(false);
  
  // Tab and editing state
  const [activeTab, setActiveTab] = useState<'details' | 'notes'>('details');
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(ticket.title);
  const [editedDescription, setEditedDescription] = useState(ticket.description);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadTicketDetails();
  }, [ticket.id]);

  const loadTicketDetails = async () => {
    try {
      setLoading(true);
      const [notesResponse, attachmentsResponse] = await Promise.all([
        apiService.getTicketNotes(ticket.id, { includeInternal: true }),
        apiService.getTicketAttachments(ticket.id),
      ]);
      
      setNotes(notesResponse.data || notesResponse);
      setAttachments(attachmentsResponse.data || attachmentsResponse);
    } catch (err) {
      console.error('Error loading ticket details:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;

    try {
      setAddingNote(true);
      const note = await apiService.createTicketNote(ticket.id, {
        content: newNote,
        isInternal,
      });
      
      setNotes(prev => [note, ...prev]);
      setNewNote('');
      setIsInternal(false);
    } catch (err) {
      console.error('Error adding note:', err);
    } finally {
      setAddingNote(false);
    }
  };

  const handleSaveChanges = async () => {
    try {
      setSaving(true);
      await apiService.updateTicket(ticket.id, {
        title: editedTitle,
        description: editedDescription,
      });
      
      // Update the ticket object
      ticket.title = editedTitle;
      ticket.description = editedDescription;
      
      setIsEditing(false);
    } catch (err) {
      console.error('Error updating ticket:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditedTitle(ticket.title);
    setEditedDescription(ticket.description);
    setIsEditing(false);
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getPriorityColor = (priority: number) => {
    if (priority >= 80) return 'bg-red-100 text-red-800 border-red-200';
    if (priority >= 60) return 'bg-orange-100 text-orange-800 border-orange-200';
    if (priority >= 40) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    return 'bg-green-100 text-green-800 border-green-200';
  };

  const getPriorityLabel = (priority: number) => {
    if (priority >= 80) return 'High';
    if (priority >= 60) return 'Medium';
    if (priority >= 40) return 'Low';
    return 'Lowest';
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-10 mx-auto p-5 border w-11/12 md:w-4/5 lg:w-3/4 xl:w-2/3 shadow-lg rounded-md bg-white max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex-1">
            <div className="flex items-center space-x-3 mb-2">
              <h2 className="text-xl font-semibold text-gray-900">{ticket.title}</h2>
              <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getPriorityColor(ticket.priority)}`}>
                {getPriorityLabel(ticket.priority)}
              </span>
              <span className={`
                px-2 py-1 rounded-full text-xs font-medium
                ${ticket.status === 'open' ? 'bg-blue-100 text-blue-800' : 
                  ticket.status === 'resolved' ? 'bg-green-100 text-green-800' :
                  ticket.status === 'closed' ? 'bg-gray-100 text-gray-800' :
                  'bg-purple-100 text-purple-800'}
              `}>
                {ticket.status.charAt(0).toUpperCase() + ticket.status.slice(1)}
              </span>
            </div>
            <div className="text-sm text-gray-500 space-y-1">
              <p>Ticket #{ticket.id.slice(-8)} • Created {formatDate(ticket.createdAt)}</p>
              <p>
                Submitted by: {ticket.submitter?.firstName} {ticket.submitter?.lastName} 
                {ticket.company && ` (${ticket.company.name})`}
              </p>
              {ticket.assignedTo && (
                <p>Assigned to: {ticket.assignedTo.firstName} {ticket.assignedTo.lastName}</p>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {!isEditing && activeTab === 'details' && (
              <button
                onClick={() => setIsEditing(true)}
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Edit
              </button>
            )}
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('details')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'details'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Details
            </button>
            <button
              onClick={() => setActiveTab('notes')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'notes'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Notes ({notes.length})
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === 'details' && (
          <div>
            {/* Title */}
            <div className="mb-6">
              <h3 className="text-lg font-medium text-gray-900 mb-2">Title</h3>
              {isEditing ? (
                <input
                  type="text"
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                />
              ) : (
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-gray-700">{ticket.title}</p>
                </div>
              )}
            </div>

            {/* Description */}
            <div className="mb-6">
              <h3 className="text-lg font-medium text-gray-900 mb-2">Description</h3>
              {isEditing ? (
                <textarea
                  value={editedDescription}
                  onChange={(e) => setEditedDescription(e.target.value)}
                  rows={6}
                  className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                />
              ) : (
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-gray-700 whitespace-pre-wrap">{ticket.description}</p>
                </div>
              )}
            </div>

            {/* Edit Actions */}
            {isEditing && (
              <div className="mb-6 flex justify-end space-x-3">
                <button
                  onClick={handleCancelEdit}
                  className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveChanges}
                  disabled={saving}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            )}

            {/* Custom Fields */}
            {Object.keys(ticket.customFieldValues || {}).length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-medium text-gray-900 mb-2">Additional Information</h3>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.entries(ticket.customFieldValues).map(([key, value]) => (
                      <div key={key}>
                        <dt className="text-sm font-medium text-gray-500">{key}</dt>
                        <dd className="text-sm text-gray-900">{String(value)}</dd>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Attachments */}
            {attachments.length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-medium text-gray-900 mb-2">Attachments</h3>
                <div className="space-y-2">
                  {attachments.map((attachment) => (
                    <div key={attachment.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center">
                        <svg className="w-5 h-5 text-gray-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M8 4a3 3 0 00-3 3v4a5 5 0 0010 0V7a1 1 0 112 0v4a7 7 0 11-14 0V7a5 5 0 0110 0v4a3 3 0 11-6 0V7a1 1 0 012 0v4a1 1 0 102 0V7a3 3 0 00-3-3z" clipRule="evenodd" />
                        </svg>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{attachment.originalName}</p>
                          <p className="text-xs text-gray-500">
                            {(attachment.fileSize / 1024).toFixed(1)} KB • {formatDate(attachment.createdAt)}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          // TODO: Implement file download
                          console.log('Download file:', attachment.id);
                        }}
                        className="text-blue-600 hover:text-blue-900 text-sm"
                      >
                        Download
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'notes' && (
          <div>
            {/* Add Note Form */}
            <div className="mb-6">
              <h3 className="text-lg font-medium text-gray-900 mb-2">Add Note</h3>
              <form onSubmit={handleAddNote} className="space-y-3">
                <textarea
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  rows={3}
                  className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Add a note to this ticket..."
                />
                <div className="flex items-center justify-between">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={isInternal}
                      onChange={(e) => setIsInternal(e.target.checked)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <span className="ml-2 text-sm text-gray-700">Internal note (not visible to customer)</span>
                  </label>
                  <button
                    type="submit"
                    disabled={!newNote.trim() || addingNote}
                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                  >
                    {addingNote ? 'Adding...' : 'Add Note'}
                  </button>
                </div>
              </form>
            </div>

            {/* Notes */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Notes & Communication</h3>
              {loading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : notes.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>No notes yet.</p>
                </div>
              ) : (
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {notes.map((note) => (
                    <div key={note.id} className={`p-4 rounded-lg ${note.isInternal ? 'bg-yellow-50 border-l-4 border-yellow-400' : 'bg-blue-50 border-l-4 border-blue-400'}`}>
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-medium text-gray-900">
                            {note.author?.firstName} {note.author?.lastName}
                          </span>
                          {note.isInternal && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                              Internal
                            </span>
                          )}
                          {note.isEmailGenerated && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              Email
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-gray-500">{formatDate(note.createdAt)}</span>
                      </div>
                      <p className="text-gray-700 whitespace-pre-wrap">{note.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TicketDetailModal;