import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

interface QueryResult {
  columns: string[];
  rows: any[];
  rowCount: number;
  executionTime: number;
}

interface TableInfo {
  tableName: string;
  columns: Array<{ columnName: string; dataType: string; isNullable: boolean }>;
}

interface QueryTemplate {
  name: string;
  description: string;
  query: string;
}

const SQLQueryBuilder: React.FC = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'sql' | 'visual'>('sql');
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<QueryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [schema, setSchema] = useState<TableInfo[]>([]);
  const [templates, setTemplates] = useState<QueryTemplate[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);

  // Visual builder state
  const [selectedTable, setSelectedTable] = useState('');
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [whereClause, setWhereClause] = useState('');
  const [orderBy, setOrderBy] = useState('');
  const [limit, setLimit] = useState('100');

  const apiUrl = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001';
  const token = localStorage.getItem('token');

  useEffect(() => {
    loadSchema();
    loadTemplates();
  }, []);

  const loadSchema = async () => {
    try {
      const response = await axios.get(`${apiUrl}/api/query-builder/schema`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSchema(response.data.data);
    } catch (err) {
      console.error('Failed to load schema:', err);
    }
  };

  const loadTemplates = async () => {
    try {
      const response = await axios.get(`${apiUrl}/api/query-builder/templates`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setTemplates(response.data.data);
    } catch (err) {
      console.error('Failed to load templates:', err);
    }
  };

  const executeQuery = async () => {
    if (!query.trim()) {
      setError('Please enter a query');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await axios.post(
        `${apiUrl}/api/query-builder/execute`,
        { query },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setResult(response.data.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Query execution failed');
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = async () => {
    if (!query.trim()) {
      setError('Please enter a query');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await axios.post(
        `${apiUrl}/api/query-builder/export`,
        { query },
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob',
        }
      );

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `query_results_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err: any) {
      setError('Export failed');
    } finally {
      setLoading(false);
    }
  };

  const buildVisualQuery = () => {
    if (!selectedTable) {
      setError('Please select a table');
      return;
    }

    const cols = selectedColumns.length > 0 ? selectedColumns.join(', ') : '*';
    let builtQuery = `SELECT ${cols}\nFROM ${selectedTable}`;

    if (whereClause) {
      builtQuery += `\nWHERE ${whereClause}`;
    }

    if (orderBy) {
      builtQuery += `\nORDER BY ${orderBy}`;
    }

    if (limit) {
      builtQuery += `\nLIMIT ${limit}`;
    }

    setQuery(builtQuery);
    setMode('sql');
  };

  const loadTemplate = (template: QueryTemplate) => {
    setQuery(template.query);
    setShowTemplates(false);
    setMode('sql');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/bsi/dashboard')}
                className="inline-flex items-center text-gray-600 hover:text-gray-900"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
                Back to Dashboard
              </button>
            </div>
            <h1 className="text-xl font-semibold text-gray-900">SQL Query Builder</h1>
            <div className="w-32"></div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto p-6">
        {/* Mode Selector */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex space-x-2">
            <button
              onClick={() => setMode('sql')}
              className={`px-4 py-2 rounded-md ${
                mode === 'sql'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-300'
              }`}
            >
              SQL Editor
            </button>
            <button
              onClick={() => setMode('visual')}
              className={`px-4 py-2 rounded-md ${
                mode === 'visual'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-300'
              }`}
            >
              Visual Builder
            </button>
          </div>
          <button
            onClick={() => setShowTemplates(!showTemplates)}
            className="px-4 py-2 bg-white border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            📋 Query Templates
          </button>
        </div>

        {/* Templates Dropdown */}
        {showTemplates && (
          <div className="mb-4 bg-white border border-gray-200 rounded-lg shadow-lg p-4">
            <h3 className="font-semibold mb-3">Query Templates</h3>
            <div className="space-y-2">
              {templates.map((template, idx) => (
                <button
                  key={idx}
                  onClick={() => loadTemplate(template)}
                  className="w-full text-left p-3 border border-gray-200 rounded hover:bg-gray-50"
                >
                  <div className="font-medium text-gray-900">{template.name}</div>
                  <div className="text-sm text-gray-600">{template.description}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* SQL Editor Mode */}
        {mode === 'sql' && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                SQL Query (SELECT only)
              </label>
              <textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                rows={10}
                className="w-full font-mono text-sm p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="SELECT * FROM users LIMIT 10;"
              />
            </div>
            <div className="flex space-x-3">
              <button
                onClick={executeQuery}
                disabled={loading}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Executing...' : '▶ Execute Query'}
              </button>
              <button
                onClick={exportToCSV}
                disabled={loading || !result}
                className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
              >
                📥 Export to CSV
              </button>
            </div>
          </div>
        )}

        {/* Visual Builder Mode */}
        {mode === 'visual' && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Table</label>
                <select
                  value={selectedTable}
                  onChange={(e) => {
                    setSelectedTable(e.target.value);
                    setSelectedColumns([]);
                  }}
                  className="w-full p-2 border border-gray-300 rounded-md"
                >
                  <option value="">Choose a table...</option>
                  {schema.map((table) => (
                    <option key={table.tableName} value={table.tableName}>
                      {table.tableName}
                    </option>
                  ))}
                </select>
              </div>

              {selectedTable && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Columns (leave empty for all)
                  </label>
                  <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto border border-gray-200 rounded p-3">
                    {schema
                      .find((t) => t.tableName === selectedTable)
                      ?.columns.map((col) => (
                        <label key={col.columnName} className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={selectedColumns.includes(col.columnName)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedColumns([...selectedColumns, col.columnName]);
                              } else {
                                setSelectedColumns(
                                  selectedColumns.filter((c) => c !== col.columnName)
                                );
                              }
                            }}
                            className="rounded"
                          />
                          <span className="text-sm">{col.columnName}</span>
                        </label>
                      ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  WHERE Clause (optional)
                </label>
                <input
                  type="text"
                  value={whereClause}
                  onChange={(e) => setWhereClause(e.target.value)}
                  placeholder="is_active = true"
                  className="w-full p-2 border border-gray-300 rounded-md"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ORDER BY (optional)
                  </label>
                  <input
                    type="text"
                    value={orderBy}
                    onChange={(e) => setOrderBy(e.target.value)}
                    placeholder="created_at DESC"
                    className="w-full p-2 border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">LIMIT</label>
                  <input
                    type="number"
                    value={limit}
                    onChange={(e) => setLimit(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-md"
                  />
                </div>
              </div>

              <button
                onClick={buildVisualQuery}
                className="w-full px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                🔨 Build Query
              </button>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Results Display */}
        {result && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Query Results</h3>
                <p className="text-sm text-gray-600">
                  {result.rowCount} rows • {result.executionTime}ms
                </p>
              </div>
            </div>

            {result.rowCount === 0 ? (
              <p className="text-gray-500 text-center py-8">No results found</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      {result.columns.map((col) => (
                        <th
                          key={col}
                          className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {result.rows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        {result.columns.map((col) => (
                          <td
                            key={col}
                            className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap"
                          >
                            {row[col] === null ? (
                              <span className="text-gray-400 italic">null</span>
                            ) : typeof row[col] === 'object' ? (
                              JSON.stringify(row[col])
                            ) : (
                              String(row[col])
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SQLQueryBuilder;
