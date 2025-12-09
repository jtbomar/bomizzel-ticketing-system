import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';

interface Team {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
  member_count?: number;
}

interface TeamMember {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  teamRole: string;
  membershipDate: string;
}

const Teams: React.FC = () => {
  const navigate = useNavigate();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [saving, setSaving] = useState(false);
  const [viewingTeam, setViewingTeam] = useState<Team | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<any[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRole, setSelectedRole] = useState<'member' | 'lead' | 'admin'>('member');

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
      console.log('[Teams] API Response:', response);
      
      // Handle different response structures
      const teamsData = response.data?.data || response.data || response;
      console.log('[Teams] Teams data:', teamsData);
      
      setTeams(Array.isArray(teamsData) ? teamsData : []);
    } catch (error: any) {
      console.error('[Teams] Error fetching teams:', error);
      console.error('[Teams] Error details:', error.response?.data);
      alert(`Failed to load teams: ${error.response?.data?.error?.message || error.message}`);
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
      console.log('[Teams] Saving team:', formData, 'Editing:', editingTeam?.id);
      
      if (editingTeam) {
        const response = await apiService.updateTeam(editingTeam.id, formData);
        console.log('[Teams] Update response:', response);
      } else {
        const response = await apiService.createTeam(formData);
        console.log('[Teams] Create response:', response);
      }
      
      await fetchTeams();
      setIsEditing(false);
      setEditingTeam(null);
    } catch (error: any) {
      console.error('[Teams] Save error:', error);
      console.error('[Teams] Error response:', error.response?.data);
      const errorMsg = error.response?.data?.error?.message || error.response?.data?.error || error.message;
      alert(`Failed to save team: ${errorMsg}`);
    } finally {
      setSaving(false);
    }
  };

  const toggleTeamStatus = async (team: Team) => {
    try {
      console.log('[Teams] Toggling team status:', team.id, 'from', team.isActive, 'to', !team.isActive);
      const response = await apiService.updateTeam(team.id, { isActive: !team.isActive });
      console.log('[Teams] Toggle response:', response);
      await fetchTeams();
    } catch (error: any) {
      console.error('[Teams] Toggle error:', error);
      console.error('[Teams] Error response:', error.response?.data);
      const errorMsg = error.response?.data?.error?.message || error.response?.data?.error || error.message;
      alert(`Failed to update team: ${errorMsg}`);
    }
  };

  const viewTeamMembers = async (team: Team) => {
    setViewingTeam(team);
    setLoadingMembers(true);
    try {
      const response = await apiService.getTeamMembers(team.id);
      setTeamMembers(response.members || response.data || response);
    } catch (error: any) {
      console.error('[Teams] Error loading members:', error);
      alert(`Failed to load team members: ${error.response?.data?.error?.message || error.message}`);
    } finally {
      setLoadingMembers(false);
    }
  };

  const loadAvailableUsers = async () => {
    try {
      const response = await apiService.listUsers({ role: 'employee' });
      setAvailableUsers(response.data || response);
    } catch (error: any) {
      console.error('[Teams] Error loading users:', error);
    }
  };

  const handleAddMember = async () => {
    if (!selectedUserId || !viewingTeam) return;

    try {
      setSaving(true);
      await apiService.addTeamMember(viewingTeam.id, selectedUserId, selectedRole);
      await viewTeamMembers(viewingTeam);
      await fetchTeams();
      setShowAddMember(false);
      setSelectedUserId('');
      setSelectedRole('member');
    } catch (error: any) {
      alert(`Failed to add member: ${error.response?.data?.error?.message || error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!viewingTeam || !confirm('Are you sure you want to remove this member?')) return;

    try {
      await apiService.removeTeamMember(viewingTeam.id, userId);
      await viewTeamMembers(viewingTeam);
      await fetchTeams();
    } catch (error: any) {
      alert(`Failed to remove member: ${error.response?.data?.error?.message || error.message}`);
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
                          <span className={team.isActive ? 'text-green-600' : 'text-gray-400'}>
                            {team.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => viewTeamMembers(team)}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                      >
                        Manage Members
                      </button>
                      <button
                        onClick={() => startEditing(team)}
                        className="text-gray-600 hover:text-gray-800 text-sm"
                      >
                        Edit
                      </button>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={team.isActive}
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

        {/* Team Members Modal */}
        {viewingTeam && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">{viewingTeam.name} - Members</h3>
                  <p className="text-sm text-gray-600 mt-1">{teamMembers.length} members</p>
                </div>
                <button
                  onClick={() => {
                    setViewingTeam(null);
                    setShowAddMember(false);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                {loadingMembers ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="text-gray-500">Loading members...</div>
                  </div>
                ) : (
                  <>
                    {!showAddMember && (
                      <button
                        onClick={() => {
                          setShowAddMember(true);
                          loadAvailableUsers();
                        }}
                        className="mb-4 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm"
                      >
                        + Add Member
                      </button>
                    )}

                    {showAddMember && (
                      <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <h4 className="font-medium text-gray-900 mb-3">Add Team Member</h4>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Select User
                            </label>
                            <select
                              value={selectedUserId}
                              onChange={(e) => setSelectedUserId(e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md"
                            >
                              <option value="">Choose a user...</option>
                              {availableUsers.map((user) => (
                                <option key={user.id} value={user.id}>
                                  {user.firstName} {user.lastName} ({user.email})
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Role
                            </label>
                            <select
                              value={selectedRole}
                              onChange={(e) => setSelectedRole(e.target.value as any)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md"
                            >
                              <option value="member">Member</option>
                              <option value="lead">Team Lead</option>
                              <option value="admin">Admin</option>
                            </select>
                          </div>
                        </div>
                        <div className="flex gap-2 mt-3">
                          <button
                            onClick={handleAddMember}
                            disabled={!selectedUserId || saving}
                            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 text-sm"
                          >
                            {saving ? 'Adding...' : 'Add'}
                          </button>
                          <button
                            onClick={() => {
                              setShowAddMember(false);
                              setSelectedUserId('');
                            }}
                            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    {teamMembers.length === 0 ? (
                      <div className="text-center py-12">
                        <div className="text-gray-400 text-5xl mb-3">👤</div>
                        <p className="text-gray-600">No members in this team yet.</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {teamMembers.map((member) => (
                          <div
                            key={member.id}
                            className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                          >
                            <div>
                              <div className="font-medium text-gray-900">
                                {member.firstName} {member.lastName}
                              </div>
                              <div className="text-sm text-gray-600">{member.email}</div>
                              <div className="text-xs text-gray-500 mt-1">
                                <span className="capitalize font-medium">{member.teamRole}</span>
                                {' • '}
                                Joined {new Date(member.membershipDate).toLocaleDateString()}
                              </div>
                            </div>
                            <button
                              onClick={() => handleRemoveMember(member.id)}
                              className="text-red-600 hover:text-red-800 text-sm"
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Teams;
