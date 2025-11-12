import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { apiService } from '../services/api';

interface BrandingData {
  logo: string;
  favicon: string;
  linkbackUrl: string;
  companyName: string;
  tagline: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
}

const Rebranding: React.FC = () => {
  const { theme } = useTheme();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  
  const [brandingData, setBrandingData] = useState<BrandingData>({
    logo: '',
    favicon: '',
    linkbackUrl: 'https://bomizzel.com',
    companyName: 'Bomizzel Services Inc.',
    tagline: 'Professional Ticketing Solutions',
    primaryColor: '#3B82F6',
    secondaryColor: '#1E40AF',
    accentColor: '#10B981',
  });

  const [editData, setEditData] = useState<BrandingData>(brandingData);
  const [logoPreview, setLogoPreview] = useState<string>('');
  const [faviconPreview, setFaviconPreview] = useState<string>('');
  const [isDragging, setIsDragging] = useState<{ logo: boolean; favicon: boolean }>({
    logo: false,
    favicon: false,
  });

  // Load branding data on mount
  useEffect(() => {
    loadBrandingData();
  }, []);

  const loadBrandingData = async () => {
    try {
      setLoading(true);
      const response = await apiService.getBranding();

      if (response.success && response.data) {
        const data = response.data;
        const loadedData: BrandingData = {
          logo: data.logo || '',
          favicon: data.favicon || '',
          linkbackUrl: data.linkbackUrl || 'https://bomizzel.com',
          companyName: data.companyName || 'Bomizzel Services Inc.',
          tagline: data.tagline || 'Professional Ticketing Solutions',
          primaryColor: data.primaryColor || '#3B82F6',
          secondaryColor: data.secondaryColor || '#1E40AF',
          accentColor: data.accentColor || '#10B981',
        };
        setBrandingData(loadedData);
        setEditData(loadedData);
      }
    } catch (err) {
      console.error('Error loading branding data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Compress and resize image
  const compressImage = (file: File, maxSize: number = 300): Promise<string> => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        let { width, height } = img;
        
        // Calculate new dimensions
        if (width > height) {
          if (width > maxSize) {
            height = (height * maxSize) / width;
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = (width * maxSize) / height;
            height = maxSize;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        ctx?.drawImage(img, 0, 0, width, height);
        const compressedDataUrl = canvas.toDataURL('image/png', 0.8);
        resolve(compressedDataUrl);
      };
      
      img.src = URL.createObjectURL(file);
    });
  };

  // Handle file upload
  const handleFileUpload = async (file: File, type: 'logo' | 'favicon') => {
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file (PNG, JPG, GIF)');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('File size must be less than 5MB');
      return;
    }

    try {
      const maxSize = type === 'favicon' ? 64 : 300;
      const compressedImage = await compressImage(file, maxSize);
      
      if (type === 'logo') {
        setLogoPreview(compressedImage);
        setEditData((prev) => ({ ...prev, logo: compressedImage }));
      } else {
        setFaviconPreview(compressedImage);
        setEditData((prev) => ({ ...prev, favicon: compressedImage }));
      }
      setError('');
    } catch (err) {
      setError('Failed to process image. Please try another file.');
    }
  };

  // Handle drag and drop
  const handleDragOver = (e: React.DragEvent, type: 'logo' | 'favicon') => {
    e.preventDefault();
    setIsDragging((prev) => ({ ...prev, [type]: true }));
  };

  const handleDragLeave = (e: React.DragEvent, type: 'logo' | 'favicon') => {
    e.preventDefault();
    setIsDragging((prev) => ({ ...prev, [type]: false }));
  };

  const handleDrop = (e: React.DragEvent, type: 'logo' | 'favicon') => {
    e.preventDefault();
    setIsDragging((prev) => ({ ...prev, [type]: false }));
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileUpload(files[0], type);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'favicon') => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileUpload(files[0], type);
    }
  };

  const handleEdit = () => {
    setEditData(brandingData);
    setIsEditing(true);
  };

  const handleCancel = () => {
    setEditData(brandingData);
    setLogoPreview('');
    setFaviconPreview('');
    setIsEditing(false);
    setError('');
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError('');
      setSuccessMessage('');

      const response = await apiService.updateBranding(editData);

      if (response.success) {
        setBrandingData(editData);
        setIsEditing(false);
        setSuccessMessage('Branding updated successfully!');
        setTimeout(() => setSuccessMessage(''), 3000);
      }
    } catch (err: any) {
      console.error('Error saving branding data:', err);
      setError(
        err.response?.data?.message || 'Failed to save branding. Please try again.'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setEditData((prev) => ({ ...prev, [field]: value }));
  };  
return (
    <div
      className={`min-h-screen transition-colors ${
        theme === 'dark'
          ? 'bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900'
          : 'bg-gray-50'
      }`}
    >
      {/* Header */}
      <div
        className={`backdrop-blur-sm border-b transition-colors ${
          theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-white border-gray-200 shadow-sm'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1
                className={`text-3xl font-bold transition-colors ${
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                }`}
              >
                Rebranding
              </h1>
              <p
                className={`text-sm mt-2 max-w-3xl transition-colors ${
                  theme === 'dark' ? 'text-white/60' : 'text-gray-600'
                }`}
              >
                Customize your brand identity including logos, colors, and visual elements. 
                Upload your favicon for website tabs, search bars, and bookmarks.
              </p>
            </div>
            <Link
              to="/admin"
              className={`px-4 py-2 rounded-md transition-colors border ${
                theme === 'dark'
                  ? 'bg-white/10 text-white hover:bg-white/20 border-white/20'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border-gray-300'
              }`}
            >
              ← Back to Settings
            </Link>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div
          className={`rounded-lg border transition-colors ${
            theme === 'dark'
              ? 'bg-white/5 border-white/10'
              : 'bg-white border-gray-200 shadow-sm'
          }`}
        >
          {/* Success/Error Messages */}
          {(successMessage || error) && (
            <div className="px-6 pt-6">
              {successMessage && (
                <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg flex items-center space-x-2">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span>{successMessage}</span>
                </div>
              )}
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg flex items-center space-x-2">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span>{error}</span>
                </div>
              )}
            </div>
          )}

          {/* Action Bar */}
          <div
            className={`px-6 py-4 border-b flex justify-between items-center ${
              theme === 'dark' ? 'border-white/10' : 'border-gray-200'
            }`}
          >
            <h2
              className={`text-lg font-semibold ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}
            >
              {isEditing ? 'Edit Brand Identity' : 'Brand Identity'}
            </h2>
            {!isEditing ? (
              <button
                onClick={handleEdit}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
                <span>{loading ? 'Loading...' : 'Edit'}</span>
              </button>
            ) : (
              <div className="flex space-x-3">
                <button
                  onClick={handleCancel}
                  disabled={saving}
                  className={`px-4 py-2 rounded-md transition-colors border disabled:opacity-50 disabled:cursor-not-allowed ${
                    theme === 'dark'
                      ? 'bg-white/10 text-white hover:bg-white/20 border-white/20'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border-gray-300'
                  }`}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  {saving && (
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                  )}
                  <span>{saving ? 'Saving...' : 'Save Changes'}</span>
                </button>
              </div>
            )}
          </div>  
        {/* Content */}
          {loading ? (
            <div className="p-12 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className={theme === 'dark' ? 'text-white/60' : 'text-gray-600'}>
                Loading branding settings...
              </p>
            </div>
          ) : (
            <div className="p-6 space-y-8">
              {/* Logo and Favicon Section */}
              <div>
                <h3
                  className={`text-lg font-semibold mb-4 ${
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}
                >
                  Visual Identity
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Logo Upload */}
                  <div>
                    <label
                      className={`block text-sm font-medium mb-2 ${
                        theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                      }`}
                    >
                      Company Logo
                    </label>
                    {isEditing ? (
                      <div>
                        <input
                          type="file"
                          id="logo-upload"
                          accept="image/*"
                          onChange={(e) => handleFileInputChange(e, 'logo')}
                          className="hidden"
                        />
                        <div
                          onDragOver={(e) => handleDragOver(e, 'logo')}
                          onDragLeave={(e) => handleDragLeave(e, 'logo')}
                          onDrop={(e) => handleDrop(e, 'logo')}
                          onClick={() => document.getElementById('logo-upload')?.click()}
                          className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                            isDragging.logo
                              ? theme === 'dark'
                                ? 'border-blue-400 bg-blue-400/10'
                                : 'border-blue-500 bg-blue-50'
                              : theme === 'dark'
                                ? 'border-white/20 bg-white/5 hover:border-white/30'
                                : 'border-gray-300 bg-gray-50 hover:border-gray-400'
                          }`}
                        >
                          {logoPreview || editData.logo ? (
                            <div className="space-y-3">
                              <img
                                src={logoPreview || editData.logo}
                                alt="Logo preview"
                                className="mx-auto h-24 w-24 object-contain rounded-lg border border-gray-200"
                              />
                              <p
                                className={`text-sm ${
                                  theme === 'dark' ? 'text-white/60' : 'text-gray-600'
                                }`}
                              >
                                Click to change logo
                              </p>
                            </div>
                          ) : (
                            <div>
                              <svg
                                className={`mx-auto h-12 w-12 ${
                                  theme === 'dark' ? 'text-white/40' : 'text-gray-400'
                                }`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                                />
                              </svg>
                              <p
                                className={`mt-2 text-sm ${
                                  theme === 'dark' ? 'text-white/60' : 'text-gray-600'
                                }`}
                              >
                                Upload company logo
                              </p>
                              <p
                                className={`text-xs ${
                                  theme === 'dark' ? 'text-white/40' : 'text-gray-500'
                                }`}
                              >
                                PNG, JPG up to 5MB
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div
                        className={`border rounded-lg p-6 text-center ${
                          theme === 'dark'
                            ? 'border-white/20 bg-white/5'
                            : 'border-gray-200 bg-gray-50'
                        }`}
                      >
                        {brandingData.logo ? (
                          <div className="space-y-2">
                            <img
                              src={brandingData.logo}
                              alt="Company logo"
                              className="mx-auto h-24 w-24 object-contain rounded-lg border border-gray-200"
                            />
                            <p
                              className={`text-sm ${
                                theme === 'dark' ? 'text-white/60' : 'text-gray-600'
                              }`}
                            >
                              Company Logo
                            </p>
                          </div>
                        ) : (
                          <div>
                            <div className="text-6xl mb-2">🏢</div>
                            <p
                              className={`text-sm ${
                                theme === 'dark' ? 'text-white/60' : 'text-gray-600'
                              }`}
                            >
                              No logo uploaded
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Favicon Upload */}
                  <div>
                    <label
                      className={`block text-sm font-medium mb-2 ${
                        theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                      }`}
                    >
                      Favicon (Website Icon)
                    </label>
                    <p
                      className={`text-xs mb-3 ${
                        theme === 'dark' ? 'text-white/40' : 'text-gray-500'
                      }`}
                    >
                      Displayed in browser tabs, bookmarks, and search results
                    </p>
                    {isEditing ? (
                      <div>
                        <input
                          type="file"
                          id="favicon-upload"
                          accept="image/*"
                          onChange={(e) => handleFileInputChange(e, 'favicon')}
                          className="hidden"
                        />
                        <div
                          onDragOver={(e) => handleDragOver(e, 'favicon')}
                          onDragLeave={(e) => handleDragLeave(e, 'favicon')}
                          onDrop={(e) => handleDrop(e, 'favicon')}
                          onClick={() => document.getElementById('favicon-upload')?.click()}
                          className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                            isDragging.favicon
                              ? theme === 'dark'
                                ? 'border-blue-400 bg-blue-400/10'
                                : 'border-blue-500 bg-blue-50'
                              : theme === 'dark'
                                ? 'border-white/20 bg-white/5 hover:border-white/30'
                                : 'border-gray-300 bg-gray-50 hover:border-gray-400'
                          }`}
                        >
                          {faviconPreview || editData.favicon ? (
                            <div className="space-y-3">
                              <img
                                src={faviconPreview || editData.favicon}
                                alt="Favicon preview"
                                className="mx-auto h-16 w-16 object-contain rounded border border-gray-200"
                              />
                              <p
                                className={`text-sm ${
                                  theme === 'dark' ? 'text-white/60' : 'text-gray-600'
                                }`}
                              >
                                Click to change favicon
                              </p>
                            </div>
                          ) : (
                            <div>
                              <svg
                                className={`mx-auto h-8 w-8 ${
                                  theme === 'dark' ? 'text-white/40' : 'text-gray-400'
                                }`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                                />
                              </svg>
                              <p
                                className={`mt-2 text-sm ${
                                  theme === 'dark' ? 'text-white/60' : 'text-gray-600'
                                }`}
                              >
                                Upload favicon
                              </p>
                              <p
                                className={`text-xs ${
                                  theme === 'dark' ? 'text-white/40' : 'text-gray-500'
                                }`}
                              >
                                16x16 or 32x32 pixels
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div
                        className={`border rounded-lg p-6 text-center ${
                          theme === 'dark'
                            ? 'border-white/20 bg-white/5'
                            : 'border-gray-200 bg-gray-50'
                        }`}
                      >
                        {brandingData.favicon ? (
                          <div className="space-y-2">
                            <img
                              src={brandingData.favicon}
                              alt="Favicon"
                              className="mx-auto h-16 w-16 object-contain rounded border border-gray-200"
                            />
                            <p
                              className={`text-sm ${
                                theme === 'dark' ? 'text-white/60' : 'text-gray-600'
                              }`}
                            >
                              Website Favicon
                            </p>
                          </div>
                        ) : (
                          <div>
                            <div className="text-4xl mb-2">🌐</div>
                            <p
                              className={`text-sm ${
                                theme === 'dark' ? 'text-white/60' : 'text-gray-600'
                              }`}
                            >
                              No favicon uploaded
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>  
            {/* Company Information */}
              <div>
                <h3
                  className={`text-lg font-semibold mb-4 ${
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}
                >
                  Company Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label
                      className={`block text-sm font-medium mb-2 ${
                        theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                      }`}
                    >
                      Company Name
                    </label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={editData.companyName}
                        onChange={(e) => handleChange('companyName', e.target.value)}
                        className={`w-full px-4 py-2 rounded-lg border transition-colors ${
                          theme === 'dark'
                            ? 'bg-white/10 border-white/20 text-white'
                            : 'bg-white border-gray-300 text-gray-900'
                        } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                      />
                    ) : (
                      <p
                        className={`text-lg font-semibold ${
                          theme === 'dark' ? 'text-white' : 'text-gray-900'
                        }`}
                      >
                        {brandingData.companyName}
                      </p>
                    )}
                  </div>

                  <div>
                    <label
                      className={`block text-sm font-medium mb-2 ${
                        theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                      }`}
                    >
                      Tagline
                    </label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={editData.tagline}
                        onChange={(e) => handleChange('tagline', e.target.value)}
                        placeholder="Professional Ticketing Solutions"
                        className={`w-full px-4 py-2 rounded-lg border transition-colors ${
                          theme === 'dark'
                            ? 'bg-white/10 border-white/20 text-white'
                            : 'bg-white border-gray-300 text-gray-900'
                        } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                      />
                    ) : (
                      <p className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>
                        {brandingData.tagline}
                      </p>
                    )}
                  </div>

                  <div className="md:col-span-2">
                    <label
                      className={`block text-sm font-medium mb-2 ${
                        theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                      }`}
                    >
                      Logo Link URL
                    </label>
                    <p
                      className={`text-xs mb-2 ${
                        theme === 'dark' ? 'text-white/40' : 'text-gray-500'
                      }`}
                    >
                      Where users go when they click your logo
                    </p>
                    {isEditing ? (
                      <input
                        type="url"
                        value={editData.linkbackUrl}
                        onChange={(e) => handleChange('linkbackUrl', e.target.value)}
                        placeholder="https://bomizzel.com"
                        className={`w-full px-4 py-2 rounded-lg border transition-colors ${
                          theme === 'dark'
                            ? 'bg-white/10 border-white/20 text-white'
                            : 'bg-white border-gray-300 text-gray-900'
                        } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                      />
                    ) : (
                      <a
                        href={brandingData.linkbackUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-700 flex items-center space-x-1"
                      >
                        <span>{brandingData.linkbackUrl}</span>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                          />
                        </svg>
                      </a>
                    )}
                  </div>
                </div>
              </div>

              {/* Brand Colors */}
              <div>
                <h3
                  className={`text-lg font-semibold mb-4 ${
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}
                >
                  Brand Colors
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label
                      className={`block text-sm font-medium mb-2 ${
                        theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                      }`}
                    >
                      Primary Color
                    </label>
                    {isEditing ? (
                      <div className="flex items-center space-x-3">
                        <input
                          type="color"
                          value={editData.primaryColor}
                          onChange={(e) => handleChange('primaryColor', e.target.value)}
                          className="w-12 h-10 rounded border border-gray-300 cursor-pointer"
                        />
                        <input
                          type="text"
                          value={editData.primaryColor}
                          onChange={(e) => handleChange('primaryColor', e.target.value)}
                          className={`flex-1 px-3 py-2 rounded-lg border transition-colors ${
                            theme === 'dark'
                              ? 'bg-white/10 border-white/20 text-white'
                              : 'bg-white border-gray-300 text-gray-900'
                          } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                        />
                      </div>
                    ) : (
                      <div className="flex items-center space-x-3">
                        <div
                          className="w-12 h-10 rounded border border-gray-300"
                          style={{ backgroundColor: brandingData.primaryColor }}
                        ></div>
                        <span className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>
                          {brandingData.primaryColor}
                        </span>
                      </div>
                    )}
                  </div>

                  <div>
                    <label
                      className={`block text-sm font-medium mb-2 ${
                        theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                      }`}
                    >
                      Secondary Color
                    </label>
                    {isEditing ? (
                      <div className="flex items-center space-x-3">
                        <input
                          type="color"
                          value={editData.secondaryColor}
                          onChange={(e) => handleChange('secondaryColor', e.target.value)}
                          className="w-12 h-10 rounded border border-gray-300 cursor-pointer"
                        />
                        <input
                          type="text"
                          value={editData.secondaryColor}
                          onChange={(e) => handleChange('secondaryColor', e.target.value)}
                          className={`flex-1 px-3 py-2 rounded-lg border transition-colors ${
                            theme === 'dark'
                              ? 'bg-white/10 border-white/20 text-white'
                              : 'bg-white border-gray-300 text-gray-900'
                          } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                        />
                      </div>
                    ) : (
                      <div className="flex items-center space-x-3">
                        <div
                          className="w-12 h-10 rounded border border-gray-300"
                          style={{ backgroundColor: brandingData.secondaryColor }}
                        ></div>
                        <span className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>
                          {brandingData.secondaryColor}
                        </span>
                      </div>
                    )}
                  </div>

                  <div>
                    <label
                      className={`block text-sm font-medium mb-2 ${
                        theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                      }`}
                    >
                      Accent Color
                    </label>
                    {isEditing ? (
                      <div className="flex items-center space-x-3">
                        <input
                          type="color"
                          value={editData.accentColor}
                          onChange={(e) => handleChange('accentColor', e.target.value)}
                          className="w-12 h-10 rounded border border-gray-300 cursor-pointer"
                        />
                        <input
                          type="text"
                          value={editData.accentColor}
                          onChange={(e) => handleChange('accentColor', e.target.value)}
                          className={`flex-1 px-3 py-2 rounded-lg border transition-colors ${
                            theme === 'dark'
                              ? 'bg-white/10 border-white/20 text-white'
                              : 'bg-white border-gray-300 text-gray-900'
                          } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                        />
                      </div>
                    ) : (
                      <div className="flex items-center space-x-3">
                        <div
                          className="w-12 h-10 rounded border border-gray-300"
                          style={{ backgroundColor: brandingData.accentColor }}
                        ></div>
                        <span className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>
                          {brandingData.accentColor}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Rebranding;