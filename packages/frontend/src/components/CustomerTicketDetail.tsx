import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeftIcon,
  PaperClipIcon,
  ArrowDownTrayIcon,
  ChatBubbleLeftRightIcon,
  ClockIcon,
  UserIcon,
  CalendarIcon,
  TagIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import { apiService } from '../services/api';
import { Ticket, TicketNote, FileAttachment } from '../types';

interface CustomerTicketDetailProps {
  onTicketUpdated?: (ticket: Ticket) => void;
}

const CustomerTicketDetail: React.FC<CustomerTicketDetailProps> = () => {
  const { ticketId } = useParams<{ ticketId: string }>();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [notes, setNotes] = useState<TicketNote[]>([]);
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const [newNote, setNewNote] = useState('');
  const [newAttachments, setNewAttachments] = useState<File[]>([]);
  const [loading, setLoading] = useState(true);

  const [submittingNote, setSubmittingNote] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ticketId) {
      loadTicketDetails();
    }
  }, [ticketId]);

  const loadTicketDetails = async () => {
    if (!ticketId) return;

    try {
      setLoading(true);
      setError(null);

      const [ticketResponse, notesResponse, attachmentsResponse] = await Promise.all([
        apiService.getTicket(ticketId),
        apiService.getTicketNotes(ticketId, { includeInternal: false }),
        apiService.getTicketAttachments(ticketId),
      ]);

      setTicket(ticketResponse.ticket || ticketResponse);
      setNotes(notesResponse.data || notesResponse);
      setAttachments(attachmentsResponse.data || attachmentsResponse);
    } catch (err: any) {
      console.error('Failed to load ticket details:', err);
      setError(err.response?.data?.error?.message || 'Failed to load ticket details');
    } finally {
      setLoading(false);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newNote.trim() || !ticketId) return;

    try {
      setSubmittingNote(true);

      // Create the note
      const noteResponse = await apiService.createTicketNote(ticketId, {
        content: newNote.trim(),
        isInternal: false,
      });

      const createdNote = noteResponse.note || noteResponse;

      // Upload attachments if any
      if (newAttachments.length > 0) {
        for (const file of newAttachments) {
          try {
            await apiService.uploadFile(ticketId, file, createdNote.id);
          } catch (err) {
            console.error('Failed to upload attachment:', file.name, err);
          }
        }
      }

      // Refresh notes and attachments
      await loadTicketDetails();

      // Clear form
      setNewNote('');
      setNewAttachments([]);
    } catch (err: any) {
      console.error('Failed to add note:', err);
      setError(err.response?.data?.error?.message || 'Failed to add note');
    } finally {
      setSubmittingNote(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setNewAttachments((prev) => [...prev, ...files]);
  };

  const removeNewAttachment = (index: number) => {
    setNewAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDownloadFile = async (attachment: FileAttachment) => {
    try {
      const blob = await apiService.downloadFile(attachment.id);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = attachment.originalName || attachment.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download file:', err);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'open':
        return <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500" />;
      case 'in_progress':
      case 'in progress':
        return <ClockIcon className="h-5 w-5 text-blue-500" />;
      case 'resolved':
      case 'closed':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
      default:
        return <ClockIcon className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'open':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'in_progress':
      case 'in progress':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'resolved':
      case 'closed':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleString();
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
        <p className="mt-2 text-gray-600">Loading ticket details...</p>
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="text-center py-8">
        <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-lg inline-block">
          <XCircleIcon className="h-6 w-6 mx-auto mb-2" />
          <p className="font-medium">Error loading ticket</p>
          <p className="text-sm mt-1">{error || 'Ticket not found'}</p>
          <button onClick={() => navigate('/customer')} className="mt-3 btn-primary text-sm">
            Back to Tickets
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/customer')}
            className="btn-secondary flex items-center space-x-2"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            <span>Back to Tickets</span>
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Ticket Details</h1>
        </div>
      </div>

      {/* Ticket Information */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">{ticket.title}</h2>
            <div className="flex items-center space-x-4 text-sm text-gray-600">
              <span className="flex items-center space-x-1">
                <TagIcon className="h-4 w-4" />
                <span>ID: {ticket.id.slice(-8)}</span>
              </span>
              <span className="flex items-center space-x-1">
                <CalendarIcon className="h-4 w-4" />
                <span>Created: {formatDate(ticket.createdAt)}</span>
              </span>
              <span className="flex items-center space-x-1">
                <ClockIcon className="h-4 w-4" />
                <span>Updated: {formatDate(ticket.updatedAt)}</span>
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div
              className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(ticket.status)}`}
            >
              {getStatusIcon(ticket.status)}
              <span className="ml-2">{ticket.status.replace('_', ' ')}</span>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-500">Priority</div>
              <div className="text-sm font-medium text-gray-900">{ticket.priority}</div>
            </div>
          </div>
        </div>

        <div className="prose max-w-none">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Description</h3>
          <div className="text-gray-700 whitespace-pre-wrap bg-gray-50 p-4 rounded-md">
            {ticket.description}
          </div>
        </div>

        {/* Custom Fields */}
        {ticket.customFieldValues && Object.keys(ticket.customFieldValues).length > 0 && (
          <div className="mt-6">
            <h3 className="text-lg font-medium text-gray-900 mb-3">Additional Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(ticket.customFieldValues).map(([key, value]) => (
                <div key={key} className="bg-gray-50 p-3 rounded-md">
                  <div className="text-sm font-medium text-gray-700 capitalize">
                    {key.replace(/([A-Z])/g, ' $1').trim()}
                  </div>
                  <div className="text-sm text-gray-900 mt-1">{value?.toString() || 'N/A'}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Assignment Info */}
        {ticket.assignedTo && (
          <div className="mt-6 p-4 bg-blue-50 rounded-md">
            <div className="flex items-center space-x-2">
              <UserIcon className="h-5 w-5 text-blue-600" />
              <span className="text-sm font-medium text-blue-900">
                Assigned to: {ticket.assignedTo.firstName} {ticket.assignedTo.lastName}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Attachments */}
      {attachments.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center space-x-2">
            <PaperClipIcon className="h-5 w-5" />
            <span>Attachments ({attachments.length})</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {attachments.map((attachment) => (
              <div
                key={attachment.id}
                className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {attachment.originalName || attachment.fileName}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {formatFileSize(attachment.fileSize)}
                    </p>
                    <p className="text-xs text-gray-500">{formatDate(attachment.createdAt)}</p>
                  </div>
                  <button
                    onClick={() => handleDownloadFile(attachment)}
                    className="ml-2 p-1 text-gray-400 hover:text-gray-600"
                    title="Download"
                  >
                    <ArrowDownTrayIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notes/Comments */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center space-x-2">
          <ChatBubbleLeftRightIcon className="h-5 w-5" />
          <span>Comments ({notes.length})</span>
        </h3>

        {/* Add New Note */}
        <form onSubmit={handleAddNote} className="mb-6 p-4 bg-gray-50 rounded-lg">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Add a comment</label>
              <textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                rows={4}
                className="input w-full"
                placeholder="Add additional information or ask a question..."
              />
            </div>

            {/* File attachments for note */}
            <div>
              <input
                type="file"
                multiple
                onChange={handleFileChange}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
              />

              {newAttachments.length > 0 && (
                <div className="mt-2 space-y-2">
                  {newAttachments.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-2 bg-white rounded-md border"
                    >
                      <div className="flex items-center space-x-2">
                        <PaperClipIcon className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-700">{file.name}</span>
                        <span className="text-xs text-gray-500">({formatFileSize(file.size)})</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeNewAttachment(index)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <XCircleIcon className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={!newNote.trim() || submittingNote}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submittingNote ? 'Adding Comment...' : 'Add Comment'}
              </button>
            </div>
          </div>
        </form>

        {/* Notes List */}
        <div className="space-y-4">
          {notes.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No comments yet</p>
          ) : (
            notes.map((note) => (
              <div key={note.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <UserIcon className="h-4 w-4 text-gray-400" />
                    <span className="text-sm font-medium text-gray-900">
                      {note.author ? `${note.author.firstName} ${note.author.lastName}` : 'Unknown'}
                    </span>
                    {note.isEmailGenerated && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                        Email
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-gray-500">{formatDate(note.createdAt)}</span>
                </div>
                <div className="text-gray-700 whitespace-pre-wrap">{note.content}</div>

                {/* Note attachments */}
                {note.attachments && note.attachments.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <div className="flex flex-wrap gap-2">
                      {note.attachments.map((attachment) => (
                        <button
                          key={attachment.id}
                          onClick={() => handleDownloadFile(attachment)}
                          className="inline-flex items-center space-x-1 text-xs text-blue-600 hover:text-blue-800"
                        >
                          <PaperClipIcon className="h-3 w-3" />
                          <span>{attachment.originalName || attachment.fileName}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default CustomerTicketDetail;
