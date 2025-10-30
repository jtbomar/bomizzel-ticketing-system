import React, { useState, useEffect } from 'react';
import { apiService as api } from '../../services/api';
import TeamStatusConfig from './TeamStatusConfig';
import {
  PlusIcon,
  UsersIcon,
  CogIcon,
} from '@heroicons/react/24/outline';

interface Team {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
}

interface TeamMember {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  teamRole: string;
  membershipDate: string;
}

const TeamManagement: React.FC = () => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showStatusConfig, setShowStatusConfig] = useState(false);
  const [newTeam, setNewTeam] = useState({ name: '', description: '' });

  console.log('TeamManagement component rendered', { teams, loading, error });

  useEffect(() => {
    fetchTeams();
  }, []);

  useEffect(() => {
    if (selectedTeam) {
      fetchTeamMembers(selectedTeam.id);
    }
  }, [selectedTeam]);

  const fetchTeams = async () => {
    console.log('fetchTeams called');
    try {
      setLoading(true);
      console.log('Calling api.getTeams()...');
      const response = await api.getTeams();
      console.log('Teams API response:', response);
      setTeams(response.data);
      if (response.data.length > 0 && !selectedTeam) {
        setSelectedTeam(response.data[0]);
      }
    } catch (err) {
      setError('Failed to fetch teams');
      console.error('Fetch teams error:', err);
      // Fallback to mock data if API fails
      setTeams([
        { 
          id: '1', 
          name: 'Technical Support', 
          description: 'Handles technical issues and bug reports',
          isActive: true,
          createdAt: new Date().toISOString()
        },
        { 
          id: '2', 
          name: 'Customer Success', 
          description: 'Manages customer onboarding and account issues',
          isActive: true,
          createdAt: new Date().toISOString()
        }
      ]);
      if (!selectedTeam) {
        setSelectedTeam({
          id: '1', 
          name: 'Technical Support', 
          description: 'Handles technical issues and bug reports',
          isActive: true,
          createdAt: new Date().toISOString()
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchTeamMembers = async (teamId: string) => {
    try {
      const response = await api.getTeamMembers(teamId);
      setTeamMembers(response.members || []);
    } catch (err) {
      console.error('Fetch team members error:', err);
      // Set empty array if API fails
      setTeamMembers([]);
    }
  };

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      console.log('Creating team:', newTeam);
      const response = await api.createTeam(newTeam);
      console.log('Team created successfully:', response);
      
      setNewTeam({ name: '', description: '' });
      setShowCreateModal(false);
      setError(null); // Clear any previous errors
      fetchTeams();
      
      // Show success message
      alert(`Team "${newTeam.name}" created successfully!`);
    } catch (err) {
      console.error('Create team error:', err);
      setError(`Failed to create team: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleUpdateTeam = async (teamId: string, updates: Partial<Team>) => {
    try {
      console.log('Updating team:', teamId, updates);
      const response = await api.updateTeam(teamId, updates);
      console.log('Team updated successfully:', response);
      
      setError(null); // Clear any previous errors
      fetchTeams();
      
      // Show success message
      alert(`Team updated successfully!`);
    } catch (err) {
      console.error('Update team error:', err);
      setError(`Failed to update team: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-800';
      case 'lead':
        return 'bg-blue-100 text-blue-800';
      case 'member':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-medium text-white">Team Management</h2>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center px-4 py-2 bg-blue-500/20 text-blue-200 border border-blue-400/50 rounded-lg hover:bg-blue-500/30 transition-all duration-200"
        >
          <PlusIcon className="h-4 w-4 mr-2" />
          Create Team
        </button>
      </div>

      {error && (
        <div className="bg-red-500/20 border border-red-400/50 rounded-md p-4">
          <p className="text-sm text-red-200">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Teams List */}
        <div className="bg-white/5 shadow rounded-lg border border-white/10">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg font-medium text-white mb-4">Teams</h3>
            <div className="space-y-2">
              {teams.map((team) => (
                <div
                  key={team.id}
                  onClick={() => setSelectedTeam(team)}
                  className={`p-3 rounded-lg cursor-pointer border transition-all duration-200 ${
                    selectedTeam?.id === team.id
                      ? 'border-blue-400/50 bg-blue-500/20'
                      : 'border-white/20 hover:bg-white/10'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-medium text-white">{team.name}</h4>
                      {team.description && (
                        <p className="text-sm text-white/60 mt-1">{team.description}</p>
                      )}
                    </div>
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        team.isActive
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {team.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Team Details */}
        {selectedTeam && (
          <div className="lg:col-span-2 space-y-6">
            {/* Team Info */}
            <div className="bg-white/5 shadow rounded-lg border border-white/10">
              <div className="px-4 py-5 sm:p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-medium text-white">{selectedTeam.name}</h3>
                    {selectedTeam.description && (
                      <p className="text-sm text-white/60 mt-1">{selectedTeam.description}</p>
                    )}
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => setShowStatusConfig(true)}
                      className="inline-flex items-center px-3 py-2 border border-white/20 shadow-sm text-sm leading-4 font-medium rounded-md text-white bg-white/10 hover:bg-white/20 transition-all duration-200"
                    >
                      <CogIcon className="h-4 w-4 mr-2" />
                      Statuses
                    </button>
                    <button
                      onClick={() => handleUpdateTeam(selectedTeam.id, { isActive: !selectedTeam.isActive })}
                      className={`inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white transition-all duration-200 ${
                        selectedTeam.isActive
                          ? 'bg-red-500/20 border-red-400/50 hover:bg-red-500/30'
                          : 'bg-green-500/20 border-green-400/50 hover:bg-green-500/30'
                      }`}
                    >
                      {selectedTeam.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Team Members */}
            <div className="bg-white/5 shadow rounded-lg border border-white/10">
              <div className="px-4 py-5 sm:p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium text-white flex items-center">
                    <UsersIcon className="h-5 w-5 mr-2" />
                    Team Members ({teamMembers.length})
                  </h3>
                </div>

                <div className="space-y-3">
                  {teamMembers.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between p-3 border border-white/20 rounded-lg bg-white/5 hover:bg-white/10 transition-all duration-200"
                    >
                      <div>
                        <div className="font-medium text-white">
                          {member.firstName} {member.lastName}
                        </div>
                        <div className="text-sm text-white/60">{member.email}</div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(
                            member.teamRole
                          )}`}
                        >
                          {member.teamRole}
                        </span>
                        <span className="text-xs text-white/60">
                          {new Date(member.membershipDate).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  ))}

                  {teamMembers.length === 0 && (
                    <div className="text-center py-8 text-white/60">
                      No team members found
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Create Team Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white/10 backdrop-blur-lg rounded-xl border border-white/20 p-6 w-full max-w-md mx-4">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold text-white">Create New Team</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-white/60 hover:text-white transition-colors duration-200"
              >
                ×
              </button>
            </div>
            <form onSubmit={handleCreateTeam} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white mb-1">
                  Team Name
                </label>
                <input
                  type="text"
                  required
                  value={newTeam.name}
                  onChange={(e) => setNewTeam(prev => ({ ...prev, name: e.target.value }))}
                  className="block w-full rounded-md bg-white/10 border border-white/20 text-white placeholder-white/60 shadow-sm focus:border-blue-400 focus:ring-blue-400 sm:text-sm px-3 py-2"
                  placeholder="Enter team name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={newTeam.description}
                  onChange={(e) => setNewTeam(prev => ({ ...prev, description: e.target.value }))}
                  className="block w-full rounded-md bg-white/10 border border-white/20 text-white placeholder-white/60 shadow-sm focus:border-blue-400 focus:ring-blue-400 sm:text-sm px-3 py-2"
                  placeholder="Enter team description (optional)"
                />
              </div>
              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-2 px-4 bg-white/10 text-white border border-white/20 rounded-lg hover:bg-white/20 transition-all duration-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 px-4 bg-blue-500/20 text-blue-200 border border-blue-400/50 rounded-lg hover:bg-blue-500/30 transition-all duration-200"
                >
                  Create Team
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Status Configuration Modal */}
      {showStatusConfig && selectedTeam && (
        <TeamStatusConfig
          team={selectedTeam}
          onClose={() => setShowStatusConfig(false)}
        />
      )}
    </div>
  );
};

export default TeamManagement;