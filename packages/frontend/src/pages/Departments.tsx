import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';

interface Department {
  id: number;
  company_id: string;
  name: string;
  description?: string;
  logo?: string;
  color: string;
  is_active: boolean;
  is_default: boolean;
  created_at: string;
  updated_at: string;
  agents: Array<{
    user_id: string;
    first_name: string;
    last_name: string;
    email: string;
    role: string;
    department_role: 'member' | 'lead' | 'manager';
    is_active: boolean;
  }>;
  agent_count: number;
  template_count: number;
}

interface User {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
}

const DEPARTMENT_COLORS = [
  '#3B82F6', // Blue
  '#10B981', // Green
  '#F59E0B', // Yellow
  '#EF4444', // Red
  '#8B5CF6', // Purple
  '#F97316', // Orange
  '#06B6D4', // Cyan
  '#84CC16', // Lime
  '#EC4899', // Pink
  '#6B7280', // Gray
];

const Departments: React.FC = () => {
  const navigate = useNavigate();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [showAddAgent, setShowAddAgent] = useState(false);

  // Form state
  const [formData, setFormData] = useState<{
    name: string;
    description: string;
    logo: string;
    color: string;
    is_active: boolean;
    is_default: boolean;
  }>({
    name: '',
    description: '',
    logo: '',
    color: '#3B82F6',
    is_active: true,
    is_default: false,
  });

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>('');

  useEffect(() => {
    fetchDepartments();
    fetchAvailableUsers();
  }, []);

  const fetchDepartments = async () => {
    try {
      setLoading(true);
      
      // Fetch both departments and companies
      const [departmentsData, companiesResponse] = await Promise.all([
        apiService.getDepartments(),
        apiService.getCompanies({ limit: 100 })
      ]);
      
      // Create company lookup map
      const companies = companiesResponse.companies || companiesResponse.data || [];
      const companyMap = new Map(
        companies.map((c: any) => [c.id, c.name])
      );
      
      // Add default agents and templates arrays if missing, plus company name
      const dataWithDefaults = departmentsData.map((dept: any) => ({
        ...dept,
        agents: dept.agents || [],
        templates: dept.templates || [],
        company_name: companyMap.get(dept.company_id) || 'Unknown Company'
      }));
      
      setDepartments(dataWithDefaults);
      
      // Select the default one if available
      const defaultDept = dataWithDefaults.find((dept: Department) => dept.is_default);
      if (defaultDept) {
        setSelectedDepartment(defaultDept);
      } else if (dataWithDefaults.length > 0) {
        setSelectedDepartment(dataWithDefaults[0]);
      }
    } catch (error) {
      console.error('Error fetching departments:', error);
      alert('Failed to load departments. Please check your authentication and try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableUsers = async () => {
    try {
      // Get all users (you might want to filter this based on role)
      const response = await apiService.getUsers({ limit: 100 });
      setAvailableUsers(response.data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const handleSave = async () => {
    // Basic validation
    if (!formData.name.trim()) {
      alert('Please enter a name for the department.');
      return;
    }

    try {
      setSaving(true);
      
      const payload = {
        name: formData.name,
        description: formData.description,
        logo: formData.logo,
        color: formData.color,
        is_active: formData.is_active,
        is_default: formData.is_default,
      };

      if (isCreating) {
        await apiService.createDepartment(payload);
      } else if (selectedDepartment?.id) {
        await apiService.updateDepartment(selectedDepartment.id, payload);
      }

      await fetchDepartments();
      setIsEditing(false);
      setIsCreating(false);
      setLogoFile(null);
      setLogoPreview('');
    } catch (error: any) {
      console.error('Error saving department:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Unknown error';
      alert(`Failed to save department: ${errorMessage}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this department? This will remove all agent assignments and templates.')) {
      return;
    }

    try {
      await apiService.deleteDepartment(id);
      await fetchDepartments();
      
      if (selectedDepartment?.id === id) {
        setSelectedDepartment(departments.length > 1 ? departments[0] : null);
      }
    } catch (error: any) {
      console.error('Error deleting department:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Unknown error';
      alert(`Failed to delete department: ${errorMessage}`);
    }
  };

  const startEditing = (department?: Department) => {
    if (department) {
      setFormData({
        name: department.name,
        description: department.description || '',
        logo: department.logo || '',
        color: department.color,
        is_active: department.is_active,
        is_default: department.is_default,
      });
      setSelectedDepartment(department);
      setLogoPreview(department.logo || '');
      setIsEditing(true);
      setIsCreating(false);
    } else {
      // Create new
      setFormData({
        name: '',
        description: '',
        logo: '',
        color: '#3B82F6',
        is_active: true,
        is_default: false,
      });
      setLogoPreview('');
      setIsCreating(true);
      setIsEditing(true);
    }
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setIsCreating(false);
    setLogoFile(null);
    setLogoPreview('');
    setFormData({
      name: '',
      description: '',
      logo: '',
      color: '#3B82F6',
      is_active: true,
      is_default: false,
    });
  };

  const handleLogoUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file (PNG, JPG, GIF)');
      return;
    }

    if (file.size > 2 * 1024 * 1024) { // 2MB limit
      alert('Image size must be less than 2MB');
      return;
    }

    try {
      const compressedDataUrl = await compressImage(file);
      setLogoFile(file);
      setLogoPreview(compressedDataUrl);
      setFormData({ ...formData, logo: compressedDataUrl });
    } catch (error) {
      console.error('Error processing image:', error);
      alert('Failed to process image. Please try again.');
    }
  };

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        const maxWidth = 200;
        const maxHeight = 200;
        
        let { width, height } = img;
        
        if (width > height) {
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = (width * maxHeight) / height;
            height = maxHeight;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        
        ctx?.drawImage(img, 0, 0, width, height);
        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
        resolve(compressedDataUrl);
      };
      
      img.src = URL.createObjectURL(file);
    });
  };

  const handleAddAgent = async (userId: string, role: 'member' | 'lead' | 'manager') => {
    if (!selectedDepartment) return;

    try {
      await apiService.addAgentToDepartment(selectedDepartment.id, userId, role);
      await fetchDepartments();
      setShowAddAgent(false);
    } catch (error: any) {
      console.error('Error adding agent:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Unknown error';
      alert(`Failed to add agent: ${errorMessage}`);
    }
  };

  const handleRemoveAgent = async (userId: string) => {
    if (!selectedDepartment) return;

    if (!confirm('Are you sure you want to remove this agent from the department?')) {
      return;
    }

    try {
      await apiService.removeAgentFromDepartment(selectedDepartment.id, userId);
      await fetchDepartments();
    } catch (error: any) {
      console.error('Error removing agent:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Unknown error';
      alert(`Failed to remove agent: ${errorMessage}`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/admin/settings')}
                className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to Settings
              </button>
              <div>
                <h1 className="text-2xl font-semibold text-gray-900">Departments</h1>
                <p className="text-sm text-gray-600 mt-1">
                  Organize your teams into departments with their own agents and ticket templates
                </p>
              </div>
            </div>
            <button
              onClick={() => startEditing()}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
            >
              Add New Department
            </button>
          </div>
        </div>

        <div className="p-6">
          {departments.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-400 text-6xl mb-4">🏢</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Departments Configured</h3>
              <p className="text-gray-600 mb-4">
                Create departments to organize your agents and customize ticket workflows.
              </p>
              <button
                onClick={() => startEditing()}
                className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition-colors"
              >
                Create Department
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Departments List */}
              <div className="lg:col-span-1">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Departments</h3>
                <div className="space-y-2">
                  {departments.map((dept) => (
                    <div
                      key={dept.id}
                      className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                        selectedDepartment?.id === dept.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => setSelectedDepartment(dept)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {dept.logo ? (
                            <img
                              src={dept.logo}
                              alt={dept.name}
                              className="w-10 h-10 rounded-lg object-cover"
                            />
                          ) : (
                            <div
                              className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-semibold"
                              style={{ backgroundColor: dept.color }}
                            >
                              {dept.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <h4 className="font-medium text-gray-900">{dept.name}</h4>
                            <p className="text-xs text-gray-500">{(dept as any).company_name}</p>
                            {dept.description && (
                              <p className="text-sm text-gray-600 mt-1 line-clamp-2">{dept.description}</p>
                            )}
                            <div className="flex items-center gap-2 mt-2">
                              {dept.is_default && (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                  Default
                                </span>
                              )}
                              {dept.is_active ? (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                  Active
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                  Inactive
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                              <span>{dept.agent_count} agent{dept.agent_count !== 1 ? 's' : ''}</span>
                              <span>{dept.template_count} template{dept.template_count !== 1 ? 's' : ''}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              startEditing(dept);
                            }}
                            className="text-blue-600 hover:text-blue-800 text-sm"
                          >
                            Edit
                          </button>
                          {!dept.is_default && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(dept.id);
                              }}
                              className="text-red-600 hover:text-red-800 text-sm"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Department Details */}
              <div className="lg:col-span-2">
                {isEditing ? (
                  <div>
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-lg font-medium text-gray-900">
                        {isCreating ? 'Create Department' : 'Edit Department'}
                      </h3>
                      <div className="flex gap-2">
                        <button
                          onClick={cancelEditing}
                          className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleSave}
                          disabled={saving}
                          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
                        >
                          {saving ? 'Saving...' : 'Save'}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-6">
                      {/* Basic Information */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Name *
                          </label>
                          <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="e.g., Technical Support"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Color
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={formData.color}
                              onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                              className="w-12 h-10 border border-gray-300 rounded-md"
                            />
                            <div className="flex flex-wrap gap-1">
                              {DEPARTMENT_COLORS.map((color) => (
                                <button
                                  key={color}
                                  type="button"
                                  onClick={() => setFormData({ ...formData, color })}
                                  className={`w-6 h-6 rounded border-2 ${
                                    formData.color === color ? 'border-gray-800' : 'border-gray-300'
                                  }`}
                                  style={{ backgroundColor: color }}
                                />
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Description
                        </label>
                        <textarea
                          value={formData.description}
                          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                          rows={3}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Optional description for this department"
                        />
                      </div>

                      {/* Logo Upload */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Department Logo
                        </label>
                        <div className="flex items-center gap-4">
                          {logoPreview ? (
                            <img
                              src={logoPreview}
                              alt="Logo preview"
                              className="w-16 h-16 rounded-lg object-cover border border-gray-300"
                            />
                          ) : (
                            <div
                              className="w-16 h-16 rounded-lg flex items-center justify-center text-white font-semibold text-xl border border-gray-300"
                              style={{ backgroundColor: formData.color }}
                            >
                              {formData.name.charAt(0).toUpperCase() || '?'}
                            </div>
                          )}
                          <div>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleLogoUpload(file);
                              }}
                              className="hidden"
                              id="logo-upload"
                            />
                            <label
                              htmlFor="logo-upload"
                              className="cursor-pointer bg-white px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                            >
                              Upload Logo
                            </label>
                            {logoPreview && (
                              <button
                                type="button"
                                onClick={() => {
                                  setLogoPreview('');
                                  setFormData({ ...formData, logo: '' });
                                  setLogoFile(null);
                                }}
                                className="ml-2 text-red-600 hover:text-red-800 text-sm"
                              >
                                Remove
                              </button>
                            )}
                            <p className="text-xs text-gray-500 mt-1">
                              PNG, JPG, GIF up to 2MB. Recommended: 200x200px
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={formData.is_active}
                            onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="ml-2 text-sm text-gray-700">Active</span>
                        </label>
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={formData.is_default}
                            onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="ml-2 text-sm text-gray-700">Set as Default</span>
                        </label>
                      </div>
                    </div>
                  </div>
                ) : selectedDepartment ? (
                  <div>
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-4">
                        {selectedDepartment.logo ? (
                          <img
                            src={selectedDepartment.logo}
                            alt={selectedDepartment.name}
                            className="w-16 h-16 rounded-lg object-cover"
                          />
                        ) : (
                          <div
                            className="w-16 h-16 rounded-lg flex items-center justify-center text-white font-semibold text-xl"
                            style={{ backgroundColor: selectedDepartment.color }}
                          >
                            {selectedDepartment.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <h3 className="text-lg font-medium text-gray-900">
                            {selectedDepartment.name}
                          </h3>
                          {selectedDepartment.description && (
                            <p className="text-gray-600">{selectedDepartment.description}</p>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => startEditing(selectedDepartment)}
                        className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
                      >
                        Edit
                      </button>
                    </div>

                    {/* Agents Section */}
                    <div className="mb-8">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-md font-medium text-gray-900">
                          Agents ({selectedDepartment.agents?.length || 0})
                        </h4>
                        <button
                          onClick={() => setShowAddAgent(true)}
                          className="bg-green-600 text-white px-3 py-1 rounded-md hover:bg-green-700 transition-colors text-sm"
                        >
                          Add Agent
                        </button>
                      </div>
                      
                      {selectedDepartment.agents.length === 0 ? (
                        <div className="text-center py-8 bg-gray-50 rounded-lg">
                          <p className="text-gray-600">No agents assigned to this department yet.</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {selectedDepartment.agents.map((agent) => (
                            <div key={agent.user_id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                              <div>
                                <span className="font-medium text-gray-900">
                                  {agent.first_name} {agent.last_name}
                                </span>
                                <span className="text-sm text-gray-600 ml-2">({agent.email})</span>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                    agent.department_role === 'manager' ? 'bg-purple-100 text-purple-800' :
                                    agent.department_role === 'lead' ? 'bg-blue-100 text-blue-800' :
                                    'bg-gray-100 text-gray-800'
                                  }`}>
                                    {agent.department_role}
                                  </span>
                                  <span className="text-xs text-gray-500">System Role: {agent.role}</span>
                                </div>
                              </div>
                              <button
                                onClick={() => handleRemoveAgent(agent.user_id)}
                                className="text-red-600 hover:text-red-800 text-sm"
                              >
                                Remove
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Templates Section */}
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-md font-medium text-gray-900">
                          Ticket Templates ({selectedDepartment.template_count})
                        </h4>
                        <button
                          onClick={() => {
                            // Navigate to template management (to be implemented)
                            alert('Template management coming soon!');
                          }}
                          className="bg-purple-600 text-white px-3 py-1 rounded-md hover:bg-purple-700 transition-colors text-sm"
                        >
                          Manage Templates
                        </button>
                      </div>
                      
                      <div className="text-center py-8 bg-gray-50 rounded-lg">
                        <p className="text-gray-600">Template management interface coming soon.</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="text-gray-400 text-4xl mb-4">🏢</div>
                    <p className="text-gray-600">Select a department to view details</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Agent Modal */}
      {showAddAgent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Add Agent to Department</h3>
            
            <div className="space-y-4">
              {availableUsers
                .filter(user => !selectedDepartment?.agents.some(agent => agent.user_id === user.id))
                .map((user) => (
                  <div key={user.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <span className="font-medium text-gray-900">
                        {user.first_name} {user.last_name}
                      </span>
                      <span className="text-sm text-gray-600 block">{user.email}</span>
                      <span className="text-xs text-gray-500">Role: {user.role}</span>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleAddAgent(user.id, 'member')}
                        className="bg-gray-600 text-white px-2 py-1 rounded text-xs hover:bg-gray-700"
                      >
                        Member
                      </button>
                      <button
                        onClick={() => handleAddAgent(user.id, 'lead')}
                        className="bg-blue-600 text-white px-2 py-1 rounded text-xs hover:bg-blue-700"
                      >
                        Lead
                      </button>
                      <button
                        onClick={() => handleAddAgent(user.id, 'manager')}
                        className="bg-purple-600 text-white px-2 py-1 rounded text-xs hover:bg-purple-700"
                      >
                        Manager
                      </button>
                    </div>
                  </div>
                ))}
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowAddAgent(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Departments;