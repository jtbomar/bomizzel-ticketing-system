import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';

const Gamification: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'trophies' | 'badges'>('trophies');
  const [trophies, setTrophies] = useState<any[]>([]);
  const [badges, setBadges] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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
          {activeTab === 'trophies' ? (
            <div>
              {trophies.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-gray-400 text-6xl mb-4">🏆</div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Trophies Configured</h3>
                  <p className="text-gray-600 mb-4">
                    Create trophies to reward agents for their achievements.
                  </p>
                  <button className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700">
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
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={trophy.is_active}
                            className="sr-only peer"
                            readOnly
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              )}
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
                  <button className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700">
                    New Badge
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {badges.map((badge) => (
                    <div
                      key={badge.id}
                      className="p-6 border border-gray-200 rounded-lg text-center hover:border-gray-300"
                    >
                      <div className="text-5xl mb-3">{badge.icon || '🎖️'}</div>
                      <h4 className="font-medium text-gray-900 mb-1">{badge.name}</h4>
                      <p className="text-sm text-gray-600 mb-2">{badge.description}</p>
                      <div className="text-xs text-gray-500">
                        <span className="capitalize">{badge.level}</span> • {badge.required_points} pts
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
