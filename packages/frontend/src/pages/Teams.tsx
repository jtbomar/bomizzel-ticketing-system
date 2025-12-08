import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';

interface Team {
  id: string;
  name: string;
  description?: string;
  is_active: boolean;
  created_at: string;
  member_count?: number;
}

const Teams: React.FC = () => {
  const navigate = useNavigate();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });

  useEffect(() => {
    fetchTeams();
  }, []);

  const fetchTeams = async () => {
    try {
      setLoading(true);
      const response = await apiService.getTeams();
      setTeams(response.data || response);
    } catch (error) {
      console.error('Error fetching teams:', error);
    } finally {
      setLoading(false);
    }
  };

  const startEditing = (team?: Team) => {
    if (team) {
      setFormData({
        name: team.name,
        description: team.description || '',
      });
      setEditingTeam(team);
    } else {
      setFormData({
        name: '',
        description: '',
      });
      setEditingTeam(null);
    }
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      alert('Please enter a team name');
      return;
    }

    try {
      setSaving(true);
      if (editingTeam) {
        await apiService.updateTeam(editingTeam.id, formData);
      } else {
        await apiService.createTeam(formData);
      }
      await fetchTeams();
      setIsEditing(false);
      setEditingTeam(null);
    } catch (error: any) {
      alert(`Failed to save team: ${error.response?.data?.error || error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const toggleTeamStatus = async (team: Team) => {
    try {
      await apiService.updateTeam(team.id, { isActive: !team.is_active });
      await fetchTeams();
    } catch (error: any) {
      alert(`Failed to update team: ${error.response?.data?.error || error.message}`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <button
                  onClick={() => navigate('/admin/settings')}
                  className="text-blue-600 hover:text-blue-800 mb-2 flex items-center gap-1"
                >
                  ← Back to Settings
                </button>
                <h2 className="text-2xl font-bold text-gray-900">Teams</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Organize agents into teams for better ticket management
                </p>
              </div>
              {!isEditing && (
                <button
                  onClick={() => startEditing()}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
                >
                  New Team
                </button>
              )}
            </div>
          </div>

          <div className="p-6">
            {isEditing ? (
              <div className="max-w-2xl">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-medium text-gray-900">
                    {editingTeam ? 'Edit Team' : 'Create Team'}
                  </h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setIsEditing(false)}
                      className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                    >
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Team Name *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      placeholder="e.g., Support Team"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      rows={3}
                      placeholder="Brief description of the team"
                    />
                  </div>
                </div>
              </div>
            ) : teams.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-gray-400 text-6xl mb-4">👥</div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Teams Configured</h3>
                <p className="text-gray-600 mb-4">
                  Create teams to organize your support agents.
                </p>
                <button
                  onClick={() => startEditing()}
                  className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
                >
                  Create Your First Team
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {teams.map((team) => (
                  <div
                    key={team.id}
                    className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-gray-300"
                  >
                    <div className="flex items-center gap-4">
                      <div className="text-4xl">👥</div>
                      <div>
                        <h4 className="font-medium text-gray-900">{team.name}</h4>
                        {team.description && (
                          <p className="text-sm text-gray-600">{team.description}</p>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                          <span>{team.member_count || 0} members</span>
                          <span>•</span>
                          <span className={team.is_active ? 'text-green-600' : 'text-gray-400'}>
                            {team.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => startEditing(team)}
                        className="text-blue-600 hover:text-blue-800 text-sm"
                      >
                        Edit
                      </button>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={team.is_active}
                          onChange={() => toggleTeamStatus(team)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Teams;
