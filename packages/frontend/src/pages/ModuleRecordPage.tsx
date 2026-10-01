import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { apiService } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import RecordFields from '../components/RecordFields';
import RelatedLists from '../components/RelatedLists';
import { errorText } from '../components/ui';

/** One record of a custom module: its fields, and what links to it. */
const ModuleRecordPage: React.FC = () => {
  const { moduleKey = '', recordId = '' } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [mod, setMod] = useState<{ name: string; singular: string } | null>(null);
  const [name, setName] = useState('');

  useEffect(() => {
    apiService
      .getFields(moduleKey)
      .then((l) => setMod(l.module || null))
      .catch(() => setMod(null));
    apiService
      .getRecord(moduleKey, recordId)
      .then((r) => setName(String(r.values?.name || '')))
      .catch(() => setName(''));
  }, [moduleKey, recordId]);

  const remove = async () => {
    if (!confirm(`Delete "${name}"? Links to it from other records are left empty.`)) return;
    try {
      await apiService.deleteRecord(moduleKey, recordId);
      navigate(`/agent/modules/${moduleKey}`);
    } catch (e) {
      alert(`Couldn't delete it: ${errorText(e)}`);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 text-sm mb-2">
        <Link to={`/agent/modules/${moduleKey}`} className="text-blue-600 hover:underline">
          ← {mod?.name || 'Back'}
        </Link>
        {user?.role === 'admin' && (
          <button
            type="button"
            onClick={remove}
            className="ml-auto text-sm text-red-600 hover:underline"
          >
            Delete {mod?.singular?.toLowerCase() || 'record'}
          </button>
        )}
      </div>
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-5">{name || '…'}</h1>
      <div className="grid grid-cols-1 lg:grid-cols-[22rem_1fr] gap-6">
        <RecordFields
          module={moduleKey}
          recordId={recordId}
          onSaved={(r) => setName(String(r.values?.name || ''))}
        />
        <div>
          <RelatedLists module={moduleKey} recordId={recordId} />
        </div>
      </div>
    </div>
  );
};

export default ModuleRecordPage;
