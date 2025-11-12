import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

interface ExportOptions {
  includeUsers: boolean;
  includeTickets: boolean;
  includeAttachments: boolean;
  includeCustomFields: boolean;
  dateFrom?: string;
  dateTo?: string;
}

interface ImportOptions {
  overwriteExisting: boolean;
  skipDuplicates: boolean;
  validateOnly: boolean;
}

interface ExportResult {
  exportId: string;
  fileName: string;
  fileSize: number;
  downloadUrl: string;
  expiresAt: string;
  includedData: {
    users: number;
    tickets: number;
    attachments: number;
    customFields: number;
  };
}

interface HistoryItem {
  exportId?: string;
  importId?: string;
  exportedData?: any;
  importedData?: any;
  exportedAt?: string;
  importedAt?: string;
  exportedBy?: { email: string; firstName: string; lastName: string };
  importedBy?: { email: string; firstName: string; lastName: string };
}

const DataManagement: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'export' | 'import' | 'history'>('export');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Export state
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    includeUsers: true,
    includeTickets: true,
    includeAttachments: true,
    includeCustomFields: true
  });
  const [exportResult, setExportResult] = useState<ExportResult | null>(null);
  
  // Import state
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importOptions, setImportOptions] = useState<ImportOptions>({
    overwriteExisting: false,
    skipDuplicates: true,
    validateOnly: false
  });
  const [importResult, setImportResult] = useState<any>(null);
  
  // History state
  const [history, setHistory] = useState<{ exports: HistoryItem[]; imports: HistoryItem[] }>({
    exports: [],
    imports: []
  });

  const apiUrl = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001';
  const token = localStorage.getItem('token');
  const companyId = localStorage.getItem('companyId'); // Assuming this is stored

  useEffect(() => {
    if (activeTab === 'history') {
      fetchHistory();
    }
  }, [activeTab]);

  const fetchHistory = async () => {
    try {
      const response = await axios.get(
        `${apiUrl}/api/data-export/history/${companyId}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      setHistory(response.data.data);
    } catch (err: any) {
      console.error('Failed to fetch history:', err);
    }
  };

  const handleExport = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    setExportResult(null);

    try {
      const response = await axios.post(
        `${apiUrl}/api/data-export/export`,
        {
          companyId,
          ...exportOptions
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      setExportResult(response.data.data);
      setSuccess('Data exported successfully! Click the download button below.');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Export failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = (downloadUrl: string, fileName: string) => {
    const fullUrl = `${apiUrl}${downloadUrl}`;
    const link = document.createElement('a');
    link.href = fullUrl;
    link.download = fileName;
    link.click();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setImportFile(e.target.files[0]);
      setImportResult(null);
      setError(null);
      setSuccess(null);
    }
  };

  const handleImport = async () => {
    if (!importFile) {
      setError('Please select a file to import');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);
    setImportResult(null);

    try {
      const formData = new FormData();
      formData.append('file', importFile);
      formData.append('companyId', companyId || '');
      formData.append('overwriteExisting', importOptions.overwriteExisting.toString());
      formData.append('skipDuplicates', importOptions.skipDuplicates.toString());
      formData.append('validateOnly', importOptions.validateOnly.toString());

      const response = await axios.post(
        `${apiUrl}/api/data-export/import`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      setImportResult(response.data.data);
      
      if (importOptions.validateOnly) {
        setSuccess('Validation successful! File is ready to import.');
      } else {
        setSuccess('Data imported successfully!');
        setImportFile(null);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Import failed');
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/admin')}
                className="inline-flex items-center text-gray-600 hover:text-gray-900 transition-colors"
              >
                <svg
                  className="w-5 h-5 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
                Back to Admin Dashboard
              </button>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-500">
                Logged in as: {localStorage.getItem('userEmail') || 'User'}
              </span>
              <button
                onClick={() => {
                  localStorage.clear();
                  navigate('/login');
                }}
                className="text-sm text-red-600 hover:text-red-700"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Data Management</h1>
          <p className="mt-2 text-gray-600">
            Export your data for backup or import data from previous exports
          </p>
        </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('export')}
            className={`${
              activeTab === 'export'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            Export Data
          </button>
          <button
            onClick={() => setActiveTab('import')}
            className={`${
              activeTab === 'import'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            Import Data
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`${
              activeTab === 'history'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            History
          </button>
        </nav>
      </div>

      {/* Alerts */}
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {success && (
        <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-green-800">{success}</p>
        </div>
      )}

      {/* Export Tab */}
      {activeTab === 'export' && (
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Export Your Data</h2>
          <p className="text-gray-600 mb-6">
            Create a backup of your company data. The export will include all selected data in JSON format.
          </p>

          <div className="space-y-4 mb-6">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={exportOptions.includeUsers}
                onChange={(e) =>
                  setExportOptions({ ...exportOptions, includeUsers: e.target.checked })
                }
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span className="ml-2 text-gray-700">Include Users</span>
            </label>

            <label className="flex items-center">
              <input
                type="checkbox"
                checked={exportOptions.includeTickets}
                onChange={(e) =>
                  setExportOptions({ ...exportOptions, includeTickets: e.target.checked })
                }
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span className="ml-2 text-gray-700">Include Tickets</span>
            </label>

            <label className="flex items-center">
              <input
                type="checkbox"
                checked={exportOptions.includeAttachments}
                onChange={(e) =>
                  setExportOptions({ ...exportOptions, includeAttachments: e.target.checked })
                }
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span className="ml-2 text-gray-700">Include Attachments Metadata</span>
            </label>

            <label className="flex items-center">
              <input
                type="checkbox"
                checked={exportOptions.includeCustomFields}
                onChange={(e) =>
                  setExportOptions({ ...exportOptions, includeCustomFields: e.target.checked })
                }
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span className="ml-2 text-gray-700">Include Custom Fields</span>
            </label>

            <div className="grid grid-cols-2 gap-4 pt-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date From (Optional)
                </label>
                <input
                  type="date"
                  value={exportOptions.dateFrom || ''}
                  onChange={(e) =>
                    setExportOptions({ ...exportOptions, dateFrom: e.target.value })
                  }
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date To (Optional)
                </label>
                <input
                  type="date"
                  value={exportOptions.dateTo || ''}
                  onChange={(e) =>
                    setExportOptions({ ...exportOptions, dateTo: e.target.value })
                  }
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          <button
            onClick={handleExport}
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Exporting...' : 'Export Data'}
          </button>

          {exportResult && (
            <div className="mt-6 bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Export Complete!</h3>
              <div className="space-y-2 text-sm text-gray-600 mb-4">
                <p>
                  <strong>File:</strong> {exportResult.fileName}
                </p>
                <p>
                  <strong>Size:</strong> {formatFileSize(exportResult.fileSize)}
                </p>
                <p>
                  <strong>Expires:</strong> {formatDate(exportResult.expiresAt)}
                </p>
                <div className="mt-3">
                  <strong>Included Data:</strong>
                  <ul className="list-disc list-inside ml-4 mt-1">
                    <li>{exportResult.includedData.users} Users</li>
                    <li>{exportResult.includedData.tickets} Tickets</li>
                    <li>{exportResult.includedData.attachments} Attachments</li>
                    <li>{exportResult.includedData.customFields} Custom Fields</li>
                  </ul>
                </div>
              </div>
              <button
                onClick={() => handleDownload(exportResult.downloadUrl, exportResult.fileName)}
                className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
              >
                Download Export
              </button>
            </div>
          )}
        </div>
      )}

      {/* Import Tab */}
      {activeTab === 'import' && (
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Import Data</h2>
          <p className="text-gray-600 mb-6">
            Import data from a previous export. Make sure to review the options carefully.
          </p>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Export File (JSON)
            </label>
            <input
              type="file"
              accept=".json,.zip"
              onChange={handleFileSelect}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            {importFile && (
              <p className="mt-2 text-sm text-gray-600">
                Selected: {importFile.name} ({formatFileSize(importFile.size)})
              </p>
            )}
          </div>

          <div className="space-y-4 mb-6">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={importOptions.overwriteExisting}
                onChange={(e) =>
                  setImportOptions({ ...importOptions, overwriteExisting: e.target.checked })
                }
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span className="ml-2 text-gray-700">Overwrite Existing Records</span>
            </label>

            <label className="flex items-center">
              <input
                type="checkbox"
                checked={importOptions.skipDuplicates}
                onChange={(e) =>
                  setImportOptions({ ...importOptions, skipDuplicates: e.target.checked })
                }
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span className="ml-2 text-gray-700">Skip Duplicate Records</span>
            </label>

            <label className="flex items-center">
              <input
                type="checkbox"
                checked={importOptions.validateOnly}
                onChange={(e) =>
                  setImportOptions({ ...importOptions, validateOnly: e.target.checked })
                }
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span className="ml-2 text-gray-700">Validate Only (Don't Import)</span>
            </label>
          </div>

          <button
            onClick={handleImport}
            disabled={loading || !importFile}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Processing...' : importOptions.validateOnly ? 'Validate File' : 'Import Data'}
          </button>

          {importResult && (
            <div className="mt-6 bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-3">
                {importOptions.validateOnly ? 'Validation Results' : 'Import Complete!'}
              </h3>
              <div className="space-y-2 text-sm text-gray-600">
                <p>
                  <strong>Users Imported:</strong> {importResult.summary.usersImported}
                </p>
                <p>
                  <strong>Users Skipped:</strong> {importResult.summary.usersSkipped}
                </p>
                <p>
                  <strong>Tickets Imported:</strong> {importResult.summary.ticketsImported}
                </p>
                <p>
                  <strong>Tickets Skipped:</strong> {importResult.summary.ticketsSkipped}
                </p>
                <p>
                  <strong>Custom Fields Imported:</strong> {importResult.summary.customFieldsImported}
                </p>
                {importResult.summary.errors.length > 0 && (
                  <div className="mt-3">
                    <strong className="text-red-600">Errors:</strong>
                    <ul className="list-disc list-inside ml-4 mt-1 text-red-600">
                      {importResult.summary.errors.map((err: string, idx: number) => (
                        <li key={idx}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Export & Import History</h2>

          <div className="mb-6">
            <h3 className="text-lg font-medium text-gray-900 mb-3">Recent Exports</h3>
            {history.exports.length === 0 ? (
              <p className="text-gray-500">No exports yet</p>
            ) : (
              <div className="space-y-3">
                {history.exports.map((item, idx) => (
                  <div key={idx} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-gray-900">Export ID: {item.exportId}</p>
                        <p className="text-sm text-gray-600">
                          {formatDate(item.exportedAt || '')}
                        </p>
                        <p className="text-sm text-gray-600">
                          By: {item.exportedBy?.firstName} {item.exportedBy?.lastName} ({item.exportedBy?.email})
                        </p>
                      </div>
                      <div className="text-right text-sm text-gray-600">
                        {item.exportedData && (
                          <>
                            <p>{item.exportedData.users || 0} users</p>
                            <p>{item.exportedData.tickets || 0} tickets</p>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-3">Recent Imports</h3>
            {history.imports.length === 0 ? (
              <p className="text-gray-500">No imports yet</p>
            ) : (
              <div className="space-y-3">
                {history.imports.map((item, idx) => (
                  <div key={idx} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-gray-900">Import ID: {item.importId}</p>
                        <p className="text-sm text-gray-600">
                          {formatDate(item.importedAt || '')}
                        </p>
                        <p className="text-sm text-gray-600">
                          By: {item.importedBy?.firstName} {item.importedBy?.lastName} ({item.importedBy?.email})
                        </p>
                      </div>
                      <div className="text-right text-sm text-gray-600">
                        {item.importedData && (
                          <>
                            <p>{item.importedData.usersImported || 0} users imported</p>
                            <p>{item.importedData.ticketsImported || 0} tickets imported</p>
                          </>
                        )}
                      </div>
                    </div>
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

export default DataManagement;
