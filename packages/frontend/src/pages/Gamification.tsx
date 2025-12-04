import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';

const Gamification: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'trophies' | 'badges'>('trophies');
  const [trophies, setTrophies] = useState<any[]>([]);
  const [badges, setBadges] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  const [trophyForm, setTrophyForm] = useState({
    name: '',
    description: '',
    icon: '🏆',
    category: 'response',
    criteria_type: 'time',
    points: 5,
  });

  const [badgeForm, setBadgeForm] = useState({
    name: '',
    description: '',
    icon: '🎖️',
    level: 'bronze',
    required_points: 10,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [trophiesData, badgesData] = await Promise.all([
        apiService.getTrophies(),
        apiService.getBadges(),
      ]);
      setTrophies(trophiesData);
      setBadges(badgesData);
    } catch (error) {
      console.error('Error fetching gamification data:', error);
    } finally {
      setLoading(false);
    }
  };

  const startEditingTrophy = (trophy?: any) => {
    if (trophy) {
      setTrophyForm({
        name: trophy.name,
        description: trophy.description || '',
        icon: trophy.icon || '🏆',
        category: trophy.category,
        criteria_type: trophy.criteria_type,
        points: trophy.points,
      });
      setEditingItem(trophy);
    } else {
      setTrophyForm({
        name: '',
        description: '',
        icon: '🏆',
        category: 'response',
        criteria_type: 'time',
        points: 5,
      });
      setEditingItem(null);
    }
    setIsEditing(true);
  };

  const startEditingBadge = (badge?: any) => {
    if (badge) {
      setBadgeForm({
        name: badge.name,
        description: badge.description || '',
        icon: badge.icon || '🎖️',
        level: badge.level,
        required_points: badge.required_points,
      });
      setEditingItem(badge);
    } else {
      setBadgeForm({
        name: '',
        description: '',
        icon: '🎖️',
        level: 'bronze',
        required_points: 10,
      });
      setEditingItem(null);
    }
    setIsEditing(true);
  };

  const saveTrophy = async () => {
    if (!trophyForm.name.trim()) {
      alert('Please enter a trophy name');
      return;
    }

    try {
      setSaving(true);
      if (editingItem) {
        await apiService.updateTrophy(editingItem.id, trophyForm);
      } else {
        await apiService.createTrophy(trophyForm);
      }
      await fetchData();
      setIsEditing(false);
      setEditingItem(null);
    } catch (error: any) {
      alert(`Failed to save trophy: ${error.response?.data?.error || error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const saveBadge = async () => {
    if (!badgeForm.name.trim()) {
      alert('Please enter a badge name');
      return;
    }

    try {
      setSaving(true);
      if (editingItem) {
        await apiService.updateBadge(editingItem.id, badgeForm);
      } else {
        await apiService.createBadge(badgeForm);
      }
      await fetchData();
      setIsEditing(false);
      setEditingItem(null);
    } catch (error: any) {
      alert(`Failed to save badge: ${error.response?.data?.error || error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const toggleTrophy = async (id: number, isActive: boolean) => {
    try {
      await apiService.updateTrophy(id, { is_active: !isActive });
      await fetchData();
    } catch (error: any) {
      alert(`Failed to update trophy: ${error.response?.data?.error || error.message}`);
    }
  };

  const toggleBadge = async (id: number, isActive: boolean) => {
    try {
      await apiService.updateBadge(id, { is_active: !isActive });
      await fetchData();
    } catch (error: any) {
      alert(`Failed to update badge: ${error.response?.data?.error || error.message}`);
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
    <div className="max-w-7xl mx-auto">
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
              <h2 className="text-2xl font-bold text-gray-900">Gamescope</h2>
              <p className="text-sm text-gray-600 mt-1">
                Motivate your team with badges and trophies
              </p>
            </div>
            {!isEditing && (
              <button
                onClick={() => activeTab === 'trophies' ? startEditingTrophy() : startEditingBadge()}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
              >
                New {activeTab === 'trophies' ? 'Trophy' : 'Badge'}
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px px-6">
            <button
              onClick={() => setActiveTab('trophies')}
              className={`py-4 px-6 border-b-2 font-medium text-sm ${
                activeTab === 'trophies'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Trophy
            </button>
            <button
              onClick={() => setActiveTab('badges')}
              className={`py-4 px-6 border-b-2 font-medium text-sm ${
                activeTab === 'badges'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Badges
            </button>
          </nav>
        </div>

        <div className="p-6">
          {isEditing && activeTab === 'trophies' ? (
            <div className="max-w-2xl">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-medium text-gray-900">
                  {editingItem ? 'Edit Trophy' : 'Create Trophy'}
                </h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => setIsEditing(false)}
                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveTrophy}
                    disabled={saving}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Trophy Name *</label>
                  <input
                    type="text"
                    value={trophyForm.name}
                    onChange={(e) => setTrophyForm({ ...trophyForm, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="e.g., First Response"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <input
                    type="text"
                    value={trophyForm.description}
                    onChange={(e) => setTrophyForm({ ...trophyForm, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="Brief description"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Icon</label>
                    <input
                      type="text"
                      value={trophyForm.icon}
                      onChange={(e) => setTrophyForm({ ...trophyForm, icon: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      placeholder="🏆"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Points</label>
                    <input
                      type="number"
                      value={trophyForm.points}
                      onChange={(e) => setTrophyForm({ ...trophyForm, points: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                    <select
                      value={trophyForm.category}
                      onChange={(e) => setTrophyForm({ ...trophyForm, category: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    >
                      <option value="response">Response</option>
                      <option value="resolution">Resolution</option>
                      <option value="rating">Rating</option>
                      <option value="volume">Volume</option>
                      <option value="quality">Quality</option>
                      <option value="speed">Speed</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Criteria Type</label>
                    <select
                      value={trophyForm.criteria_type}
                      onChange={(e) => setTrophyForm({ ...trophyForm, criteria_type: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    >
                      <option value="time">Time</option>
                      <option value="tickets">Tickets</option>
                      <option value="rating">Rating</option>
                      <option value="count">Count</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          ) : activeTab === 'trophies' ? (
            <div>
              {trophies.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-gray-400 text-6xl mb-4">🏆</div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Trophies Configured</h3>
                  <p className="text-gray-600 mb-4">
                    Create trophies to reward agents for their achievements.
                  </p>
                  <button
                    onClick={() => startEditingTrophy()}
                    className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
                  >
                    New Trophy
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {trophies.map((trophy) => (
                    <div
                      key={trophy.id}
                      className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-gray-300"
                    >
                      <div className="flex items-center gap-4">
                        <div className="text-4xl">{trophy.icon || '🏆'}</div>
                        <div>
                          <h4 className="font-medium text-gray-900">{trophy.name}</h4>
                          <p className="text-sm text-gray-600">{trophy.description}</p>
                          <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                            <span className="capitalize">{trophy.category}</span>
                            <span>•</span>
                            <span>{trophy.points} Pts</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <button
                          onClick={() => startEditingTrophy(trophy)}
                          className="text-blue-600 hover:text-blue-800 text-sm"
                        >
                          Edit
                        </button>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={trophy.is_active}
                            onChange={() => toggleTrophy(trophy.id, trophy.is_active)}
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
          ) : isEditing && activeTab === 'badges' ? (
            <div className="max-w-2xl">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-medium text-gray-900">
                  {editingItem ? 'Edit Badge' : 'Create Badge'}
                </h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => setIsEditing(false)}
                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveBadge}
                    disabled={saving}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Badge Name *</label>
                  <input
                    type="text"
                    value={badgeForm.name}
                    onChange={(e) => setBadgeForm({ ...badgeForm, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="e.g., Rising Star"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <input
                    type="text"
                    value={badgeForm.description}
                    onChange={(e) => setBadgeForm({ ...badgeForm, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="Brief description"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Icon</label>
                    <input
                      type="text"
                      value={badgeForm.icon}
                      onChange={(e) => setBadgeForm({ ...badgeForm, icon: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      placeholder="🎖️"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Required Points</label>
                    <input
                      type="number"
                      value={badgeForm.required_points}
                      onChange={(e) => setBadgeForm({ ...badgeForm, required_points: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Level</label>
                  <select
                    value={badgeForm.level}
                    onChange={(e) => setBadgeForm({ ...badgeForm, level: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="bronze">Bronze</option>
                    <option value="silver">Silver</option>
                    <option value="gold">Gold</option>
                    <option value="platinum">Platinum</option>
                    <option value="diamond">Diamond</option>
                  </select>
                </div>
              </div>
            </div>
          ) : (
            <div>
              {badges.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-gray-400 text-6xl mb-4">🎖️</div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Badges Configured</h3>
                  <p className="text-gray-600 mb-4">
                    Create badges to recognize agent milestones.
                  </p>
                  <button
                    onClick={() => startEditingBadge()}
                    className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
                  >
                    New Badge
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {badges.map((badge) => (
                    <div
                      key={badge.id}
                      className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-gray-300"
                    >
                      <div className="flex items-center gap-4">
                        <div className="text-4xl">{badge.icon || '🎖️'}</div>
                        <div>
                          <h4 className="font-medium text-gray-900">{badge.name}</h4>
                          <p className="text-sm text-gray-600">{badge.description}</p>
                          <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                            <span className="capitalize">{badge.level}</span>
                            <span>•</span>
                            <span>{badge.required_points} Pts Required</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <button
                          onClick={() => startEditingBadge(badge)}
                          className="text-blue-600 hover:text-blue-800 text-sm"
                        >
                          Edit
                        </button>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={badge.is_active}
                            onChange={() => toggleBadge(badge.id, badge.is_active)}
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
          )}
        </div>
      </div>
    </div>
  );
};

export default Gamification;
