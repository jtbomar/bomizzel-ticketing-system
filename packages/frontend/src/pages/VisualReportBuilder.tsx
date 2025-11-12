import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

interface TableInfo {
  tableName: string;
  columns: Array<{ columnName: string; dataType: string; isNullable: boolean }>;
}

interface SelectedTable {
  table: string;
  alias: string;
  columns: string[];
}

interface Join {
  fromTable: string;
  fromColumn: string;
  toTable: string;
  toColumn: string;
  type: 'INNER' | 'LEFT';
}

interface QueryResult {
  columns: string[];
  rows: any[];
  rowCount: number;
  executionTime: number;
}

const VisualReportBuilder: React.FC = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'wizard' | 'sql'>('wizard');
  const [step, setStep] = useState(1);
  const [schema, setSchema] = useState<TableInfo[]>([]);
  const [selectedTables, setSelectedTables] = useState<SelectedTable[]>([]);
  const [joins, setJoins] = useState<Join[]>([]);
  const [whereConditions, setWhereConditions] = useState<string[]>([]);
  const [orderBy, setOrderBy] = useState('');
  const [limit, setLimit] = useState('100');
  const [generatedQuery, setGeneratedQuery] = useState('');
  const [customQuery, setCustomQuery] = useState('');
  const [result, setResult] = useState<QueryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSchema, setShowSchema] = useState(false);

  const apiUrl = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001';
  const token = localStorage.getItem('token');
  const companyId = localStorage.getItem('companyId');

  // Common table relationships
  const tableRelationships: Record<string, Array<{ table: string; from: string; to: string }>> = {
    tickets: [
      { table: 'ticket_notes', from: 'id', to: 'ticket_id' },
      { table: 'ticket_attachments', from: 'id', to: 'ticket_id' }
    ],
    ticket_notes: [
      { table: 'tickets', from: 'ticket_id', to: 'id' }
    ],
    ticket_attachments: [
      { table: 'tickets', from: 'ticket_id', to: 'id' }
    ]
  };

  useEffect(() => {
    loadSchema();
  }, []);

  const loadSchema = async () => {
    try {
      console.log('Loading schema from:', `${apiUrl}/api/customer-query-builder/schema`);
      const response = await axios.get(`${apiUrl}/api/customer-query-builder/schema`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('Schema response:', response.data);
      if (response.data.success && response.data.data) {
        setSchema(response.data.data);
        console.log('Schema loaded:', response.data.data.length, 'tables');
      } else {
        console.error('Invalid schema response:', response.data);
        // Fallback to hardcoded schema
        loadFallbackSchema();
      }
    } catch (err: any) {
      console.error('Failed to load schema:', err);
      // Fallback to hardcoded schema
      loadFallbackSchema();
    }
  };

  const loadFallbackSchema = () => {
    // Fallback schema when API is unavailable
    setSchema([
      {
        tableName: 'tickets',
        columns: [
          { columnName: 'id', dataType: 'uuid', isNullable: false },
          { columnName: 'company_id', dataType: 'uuid', isNullable: false },
          { columnName: 'title', dataType: 'text', isNullable: false },
          { columnName: 'description', dataType: 'text', isNullable: true },
          { columnName: 'status', dataType: 'text', isNullable: false },
          { columnName: 'priority', dataType: 'text', isNullable: false },
          { columnName: 'category', dataType: 'text', isNullable: true },
          { columnName: 'created_at', dataType: 'timestamp', isNullable: false },
          { columnName: 'updated_at', dataType: 'timestamp', isNullable: false },
          { columnName: 'resolved_at', dataType: 'timestamp', isNullable: true }
        ]
      },
      {
        tableName: 'ticket_notes',
        columns: [
          { columnName: 'id', dataType: 'uuid', isNullable: false },
          { columnName: 'ticket_id', dataType: 'uuid', isNullable: false },
          { columnName: 'content', dataType: 'text', isNullable: false },
          { columnName: 'is_internal', dataType: 'boolean', isNullable: false },
          { columnName: 'created_by', dataType: 'uuid', isNullable: false },
          { columnName: 'created_at', dataType: 'timestamp', isNullable: false }
        ]
      },
      {
        tableName: 'ticket_attachments',
        columns: [
          { columnName: 'id', dataType: 'uuid', isNullable: false },
          { columnName: 'ticket_id', dataType: 'uuid', isNullable: false },
          { columnName: 'file_name', dataType: 'text', isNullable: false },
          { columnName: 'file_size', dataType: 'integer', isNullable: false },
          { columnName: 'file_type', dataType: 'text', isNullable: false },
          { columnName: 'uploaded_at', dataType: 'timestamp', isNullable: false }
        ]
      },
      {
        tableName: 'users',
        columns: [
          { columnName: 'id', dataType: 'uuid', isNullable: false },
          { columnName: 'email', dataType: 'text', isNullable: false },
          { columnName: 'first_name', dataType: 'text', isNullable: false },
          { columnName: 'last_name', dataType: 'text', isNullable: false },
          { columnName: 'role', dataType: 'text', isNullable: false },
          { columnName: 'is_active', dataType: 'boolean', isNullable: false },
          { columnName: 'created_at', dataType: 'timestamp', isNullable: false }
        ]
      },
      {
        tableName: 'custom_fields',
        columns: [
          { columnName: 'id', dataType: 'uuid', isNullable: false },
          { columnName: 'company_id', dataType: 'uuid', isNullable: false },
          { columnName: 'name', dataType: 'text', isNullable: false },
          { columnName: 'field_type', dataType: 'text', isNullable: false },
          { columnName: 'is_required', dataType: 'boolean', isNullable: false },
          { columnName: 'is_active', dataType: 'boolean', isNullable: false }
        ]
      }
    ]);
    console.log('Loaded fallback schema');
  };

  const addTable = (tableName: string) => {
    if (selectedTables.find(t => t.table === tableName)) {
      setError('Table already added');
      return;
    }

    const tableInfo = schema.find(t => t.tableName === tableName);
    if (!tableInfo) return;

    const alias = tableName.substring(0, 1);
    setSelectedTables([...selectedTables, {
      table: tableName,
      alias,
      columns: []
    }]);
    setError(null);
  };

  const removeTable = (tableName: string) => {
    setSelectedTables(selectedTables.filter(t => t.table !== tableName));
    setJoins(joins.filter(j => j.fromTable !== tableName && j.toTable !== tableName));
  };

  const toggleColumn = (tableName: string, columnName: string) => {
    setSelectedTables(selectedTables.map(t => {
      if (t.table === tableName) {
        const columns = t.columns.includes(columnName)
          ? t.columns.filter(c => c !== columnName)
          : [...t.columns, columnName];
        return { ...t, columns };
      }
      return t;
    }));
  };

  const addJoin = (fromTable: string, toTable: string) => {
    const relationships = tableRelationships[fromTable];
    const relationship = relationships?.find(r => r.table === toTable);

    if (relationship) {
      setJoins([...joins, {
        fromTable,
        fromColumn: relationship.from,
        toTable,
        toColumn: relationship.to,
        type: 'LEFT'
      }]);
    } else {
      setError('No automatic relationship found. Please add join manually.');
    }
  };

  const buildQuery = () => {
    if (selectedTables.length === 0) {
      setError('Please select at least one table');
      return;
    }

    const mainTable = selectedTables[0];
    let query = 'SELECT ';

    // Build column list
    const allColumns: string[] = [];
    selectedTables.forEach(t => {
      if (t.columns.length === 0) {
        allColumns.push(`${t.alias}.*`);
      } else {
        t.columns.forEach(col => {
          allColumns.push(`${t.alias}.${col}`);
        });
      }
    });
    query += allColumns.join(', ');

    // FROM clause
    query += `\nFROM ${mainTable.table} ${mainTable.alias}`;

    // JOIN clauses
    joins.forEach(join => {
      const toTableAlias = selectedTables.find(t => t.table === join.toTable)?.alias || join.toTable;
      query += `\n${join.type} JOIN ${join.toTable} ${toTableAlias} ON ${mainTable.alias}.${join.fromColumn} = ${toTableAlias}.${join.toColumn}`;
    });

    // WHERE clauses
    if (whereConditions.length > 0) {
      query += '\nWHERE ' + whereConditions.join(' AND ');
    }

    // ORDER BY
    if (orderBy) {
      query += `\nORDER BY ${orderBy}`;
    }

    // LIMIT
    if (limit) {
      query += `\nLIMIT ${limit}`;
    }

    setGeneratedQuery(query);
    setStep(4);
  };

  const executeQuery = async (queryToExecute?: string) => {
    const query = queryToExecute || (mode === 'sql' ? customQuery : generatedQuery);
    if (!query || !companyId) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await axios.post(
        `${apiUrl}/api/customer-query-builder/execute`,
        { query, companyId },
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
    const query = mode === 'sql' ? customQuery : generatedQuery;
    if (!query || !companyId) return;

    try {
      const response = await axios.post(
        `${apiUrl}/api/customer-query-builder/export`,
        { query, companyId },
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob'
        }
      );

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `report_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      setError('Export failed');
    }
  };

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center mb-8">
      {[1, 2, 3, 4].map((s) => (
        <React.Fragment key={s}>
          <div
            className={`flex items-center justify-center w-10 h-10 rounded-full ${
              step >= s ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
            }`}
          >
            {s}
          </div>
          {s < 4 && (
            <div className={`w-16 h-1 ${step > s ? 'bg-blue-600' : 'bg-gray-200'}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate('/employee')}
              className="inline-flex items-center text-gray-600 hover:text-gray-900"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Dashboard
            </button>
            <h1 className="text-xl font-semibold text-gray-900">Visual Report Builder</h1>
            <div className="w-32"></div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto p-6">
        {/* Mode Selector */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex space-x-2">
            <button
              onClick={() => setMode('wizard')}
              className={`px-4 py-2 rounded-md ${
                mode === 'wizard'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              🧙 Wizard Mode
            </button>
            <button
              onClick={() => setMode('sql')}
              className={`px-4 py-2 rounded-md ${
                mode === 'sql'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              💻 SQL Editor
            </button>
          </div>
          <button
            onClick={() => setShowSchema(!showSchema)}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
          >
            {showSchema ? '📋 Hide Tables' : '📋 Show Tables'}
          </button>
        </div>

        {/* Schema Viewer */}
        {showSchema && (
          <div className="mb-6 bg-white rounded-lg shadow p-6">
            <h3 className="font-semibold mb-4">Available Tables & Columns</h3>
            {schema.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500">Loading tables...</p>
                <button
                  onClick={loadSchema}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Retry Loading Tables
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {schema.map((table) => (
                  <div key={table.tableName} className="border border-gray-200 rounded p-3">
                    <h4 className="font-medium text-blue-600 mb-2">{table.tableName}</h4>
                    <div className="text-sm text-gray-600 space-y-1 max-h-48 overflow-y-auto">
                      {table.columns.map((col) => (
                        <div key={col.columnName} className="flex items-center space-x-2">
                          <span className="font-mono text-xs">{col.columnName}</span>
                          <span className="text-xs text-gray-400">({col.dataType})</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {mode === 'wizard' && renderStepIndicator()}

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* SQL Editor Mode */}
        {mode === 'sql' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">SQL Query Editor</h2>
              <p className="text-gray-600 mb-4">
                Write your own SQL query. Only SELECT queries are allowed, and results are automatically scoped to your company.
              </p>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  SQL Query (SELECT only)
                </label>
                <textarea
                  value={customQuery}
                  onChange={(e) => setCustomQuery(e.target.value)}
                  rows={12}
                  className="w-full font-mono text-sm p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="SELECT * FROM tickets WHERE status = 'open' ORDER BY created_at DESC LIMIT 10"
                />
                <div className="mt-2 space-y-1">
                  <p className="text-xs text-gray-500">
                    💡 Tip: Click "Show Tables" above to see available tables and columns
                  </p>
                  <p className="text-xs text-gray-500">
                    📋 Available tables: tickets, ticket_notes, ticket_attachments, users, custom_fields, teams, queues
                  </p>
                </div>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={() => executeQuery(customQuery)}
                  disabled={loading || !customQuery.trim()}
                  className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Running...' : '▶ Run Query'}
                </button>
                <button
                  onClick={exportToCSV}
                  disabled={!result}
                  className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  📥 Export to CSV
                </button>
              </div>
            </div>

            {/* Results */}
            {result && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold mb-2">Query Results</h3>
                <p className="text-sm text-gray-600 mb-4">
                  {result.rowCount} rows • {result.executionTime}ms
                </p>

                {result.rowCount === 0 ? (
                  <p className="text-gray-500 text-center py-8">No results found</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          {result.columns.map((col) => (
                            <th key={col} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {result.rows.slice(0, 100).map((row, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            {result.columns.map((col) => (
                              <td key={col} className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                                {row[col] === null ? (
                                  <span className="text-gray-400 italic">null</span>
                                ) : (
                                  String(row[col])
                                )}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {result.rowCount > 100 && (
                      <p className="mt-4 text-center text-sm text-gray-600">
                        Showing first 100 of {result.rowCount} rows. Export to CSV to see all.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Step 1: Select Tables */}
        {mode === 'wizard' && step === 1 && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Step 1: Select Tables</h2>
            <p className="text-gray-600 mb-6">Choose the tables you want to include in your report</p>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <h3 className="font-medium mb-3">Available Tables</h3>
                <div className="space-y-2">
                  {schema.map((table) => (
                    <button
                      key={table.tableName}
                      onClick={() => addTable(table.tableName)}
                      disabled={selectedTables.some(t => t.table === table.tableName)}
                      className="w-full text-left p-3 border border-gray-200 rounded hover:bg-blue-50 hover:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <div className="font-medium">{table.tableName}</div>
                      <div className="text-sm text-gray-500">{table.columns.length} columns</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="font-medium mb-3">Selected Tables ({selectedTables.length})</h3>
                {selectedTables.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No tables selected yet</p>
                ) : (
                  <div className="space-y-2">
                    {selectedTables.map((table) => (
                      <div key={table.table} className="p-3 border border-blue-200 bg-blue-50 rounded flex items-center justify-between">
                        <div>
                          <div className="font-medium">{table.table}</div>
                          <div className="text-sm text-gray-600">Alias: {table.alias}</div>
                        </div>
                        <button
                          onClick={() => removeTable(table.table)}
                          className="text-red-600 hover:text-red-700"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setStep(2)}
                disabled={selectedTables.length === 0}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                Next: Select Columns →
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Select Columns */}
        {mode === 'wizard' && step === 2 && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Step 2: Select Columns</h2>
            <p className="text-gray-600 mb-6">Choose which columns to include (leave empty for all)</p>

            <div className="space-y-6">
              {selectedTables.map((table) => {
                const tableInfo = schema.find(t => t.tableName === table.table);
                return (
                  <div key={table.table} className="border border-gray-200 rounded-lg p-4">
                    <h3 className="font-medium mb-3">{table.table}</h3>
                    <div className="grid grid-cols-3 gap-2">
                      {tableInfo?.columns.map((col) => (
                        <label key={col.columnName} className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={table.columns.includes(col.columnName)}
                            onChange={() => toggleColumn(table.table, col.columnName)}
                            className="rounded"
                          />
                          <span className="text-sm">{col.columnName}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 flex justify-between">
              <button
                onClick={() => setStep(1)}
                className="px-6 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                ← Back
              </button>
              <button
                onClick={() => setStep(3)}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Next: Add Filters →
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Add Filters & Sorting */}
        {mode === 'wizard' && step === 3 && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Step 3: Add Filters & Sorting</h2>
            <p className="text-gray-600 mb-6">Optional: Add conditions and sorting</p>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  WHERE Conditions (optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g., status = 'open'"
                  className="w-full p-2 border border-gray-300 rounded-md"
                  onChange={(e) => setWhereConditions([e.target.value])}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ORDER BY (optional)
                </label>
                <input
                  type="text"
                  value={orderBy}
                  onChange={(e) => setOrderBy(e.target.value)}
                  placeholder="e.g., created_at DESC"
                  className="w-full p-2 border border-gray-300 rounded-md"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  LIMIT
                </label>
                <input
                  type="number"
                  value={limit}
                  onChange={(e) => setLimit(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-between">
              <button
                onClick={() => setStep(2)}
                className="px-6 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                ← Back
              </button>
              <button
                onClick={buildQuery}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Build Query →
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Review & Execute */}
        {mode === 'wizard' && step === 4 && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">Step 4: Review & Execute</h2>
              <p className="text-gray-600 mb-4">Generated SQL Query:</p>
              <pre className="bg-gray-50 p-4 rounded border border-gray-200 overflow-x-auto text-sm font-mono">
                {generatedQuery}
              </pre>

              <div className="mt-6 flex space-x-3">
                <button
                  onClick={() => setStep(3)}
                  className="px-6 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  ← Back
                </button>
                <button
                  onClick={() => executeQuery(generatedQuery)}
                  disabled={loading}
                  className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Running...' : '▶ Run Report'}
                </button>
                <button
                  onClick={exportToCSV}
                  disabled={!result}
                  className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
                >
                  📥 Export CSV
                </button>
              </div>
            </div>

            {/* Results */}
            {result && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold mb-2">Results</h3>
                <p className="text-sm text-gray-600 mb-4">
                  {result.rowCount} rows • {result.executionTime}ms
                </p>

                {result.rowCount === 0 ? (
                  <p className="text-gray-500 text-center py-8">No results found</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          {result.columns.map((col) => (
                            <th key={col} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {result.rows.slice(0, 50).map((row, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            {result.columns.map((col) => (
                              <td key={col} className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                                {row[col] === null ? (
                                  <span className="text-gray-400 italic">null</span>
                                ) : (
                                  String(row[col])
                                )}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {result.rowCount > 50 && (
                      <p className="mt-4 text-center text-sm text-gray-600">
                        Showing first 50 of {result.rowCount} rows
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default VisualReportBuilder;
