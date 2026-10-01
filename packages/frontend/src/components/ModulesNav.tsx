import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Squares2X2Icon } from '@heroicons/react/24/outline';
import { apiService } from '../services/api';

/** A link in the agent header for each custom module (Settings > Modules). */
const ModulesNav: React.FC = () => {
  const navigate = useNavigate();
  const [modules, setModules] = useState<{ key: string; name: string }[]>([]);
  useEffect(() => {
    apiService
      .getModules()
      .then(setModules)
      .catch(() => setModules([]));
  }, []);
  return (
    <>
      {modules.map((m) => (
        <button
          key={m.key}
          onClick={() => navigate(`/agent/modules/${m.key}`)}
          className="flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          <Squares2X2Icon className="w-4 h-4" aria-hidden="true" />
          <span>{m.name}</span>
        </button>
      ))}
    </>
  );
};

export default ModulesNav;
