import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { apiService } from '../services/api';

interface CompanyData {
  logo: string;
  companyName: string;
  website: string;
  primaryContact: string;
  primaryEmail: string;
  primaryPhone: string;
  address: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  phoneNumbers: {
    main: string;
    fax: string;
    support: string;
  };
}

const CompanyProfile: React.FC = () => {
  const { theme } = useTheme();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [companyData, setCompanyData] = useState<CompanyData>({
    logo: '',
    companyName: 'Bomizzel Services Inc.',
    website: 'https://bomizzel.com',
    primaryContact: 'Jeff Bomar',
    primaryEmail: 'jeffrey.t.bomar@gmail.com',
    primaryPhone: '(555) 123-4567',
    address: {
      street: '123 Business Street',
      city: 'San Francisco',
      state: 'CA',
      zipCode: '94102',
      country: 'United States',
    },
    phoneNumbers: {
      main: '(555) 123-4567',
      fax: '(555) 123-4568',
      support: '(555) 123-4569',
    },
  });

  const [editData, setEditData] = useState<CompanyData>(companyData);
  const [phoneErrors, setPhoneErrors] = useState<{ [key: string]: string }>({});
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);

  // Load company data on mount
  useEffect(() => {
    loadCompanyData();
  }, []);

  // Format phone number to (XXX) XXX-XXXX
  const formatPhoneNumber = (value: string): string => {
    // Remove all non-numeric characters
    const numbers = value.replace(/\D/g, '');

    // Limit to 10 digits
    const limited = numbers.slice(0, 10);

    // Format based on length
    if (limited.length <= 3) {
      return limited;
    } else if (limited.length <= 6) {
      return `(${limited.slice(0, 3)}) ${limited.slice(3)}`;
    } else {
      return `(${limited.slice(0, 3)}) ${limited.slice(3, 6)}-${limited.slice(6)}`;
    }
  };

  // Validate phone number (must be 10 digits)
  const validatePhoneNumber = (value: string, fieldName: string): boolean => {
    const numbers = value.replace(/\D/g, '');

    if (numbers.length === 0) {
      setPhoneErrors((prev) => ({ ...prev, [fieldName]: '' }));
      return true;
    }

    if (numbers.length !== 10) {
      setPhoneErrors((prev) => ({
        ...prev,
        [fieldName]: 'Phone number must be 10 digits',
      }));
      return false;
    }

    setPhoneErrors((prev) => ({ ...prev, [fieldName]: '' }));
    return true;
  };

  // Compress and resize image
  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      img.onload = () => {
        // Set max dimensions (smaller for better compression)
        const maxWidth = 300;
        const maxHeight = 300;

        let { width, height } = img;

        // Calculate new dimensions
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

        // Draw and compress (higher compression)
        ctx?.drawImage(img, 0, 0, width, height);
        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.7);
        resolve(compressedDataUrl);
      };

      img.src = URL.createObjectURL(file);
    });
  };

  // Handle file upload
  const handleFileUpload = async (file: File) => {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file (PNG, JPG, GIF)');
      return;
    }

    // Validate file size (5MB limit for original file)
    if (file.size > 5 * 1024 * 1024) {
      setError('File size must be less than 5MB');
      return;
    }

    setLogoFile(file);

    try {
      // Compress the image
      const compressedImage = await compressImage(file);
      setLogoPreview(compressedImage);
      setEditData((prev) => ({ ...prev, logo: compressedImage }));
      setError('');
    } catch (err) {
      setError('Failed to process image. Please try another file.');
    }
  };

  // Handle drag and drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  // Handle file input change
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  const loadCompanyData = async () => {
    try {
      setLoading(true);

      const response = await apiService.getCompanyProfile();

      if (response.success && response.data) {
        const data = response.data;
        const loadedData: CompanyData = {
          logo: data.logoUrl || '',
          companyName: data.name || 'Bomizzel',
          website: data.websiteUrl || 'https://bomar.com',
          primaryContact: data.primaryContactName || 'Jeffrey Bomar',
          primaryEmail: data.primaryContactEmail || 'jeffrey.t.bomar@gmail.com',
          primaryPhone: data.primaryContactPhone || '(801) 389-0168',
          address: {
            street: data.addressLine1 || '277 E 1000 N',
            city: data.city || 'North ogden',
            state: data.stateProvince || 'UT',
            zipCode: data.postalCode || '84414',
            country: data.country || 'United States',
          },
          phoneNumbers: {
            main: data.primaryContactPhone || '(801) 389-0168',
            fax: data.mobilePhone || '',
            support: data.primaryContactPhone || '(801) 389-0168',
          },
        };
        setCompanyData(loadedData);
        setEditData(loadedData);
      }
    } catch (err) {
      console.error('Error loading company data:', err);
      // Use default data if load fails
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = () => {
    setEditData(companyData);
    setIsEditing(true);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError('');
      setSuccessMessage('');

      // Validate all phone numbers before saving
      const phoneFields = [
        { value: editData.primaryPhone, name: 'primaryPhone' },
        { value: editData.phoneNumbers.main, name: 'phoneNumbers.main' },
        { value: editData.phoneNumbers.fax, name: 'phoneNumbers.fax' },
        { value: editData.phoneNumbers.support, name: 'phoneNumbers.support' },
      ];

      let hasErrors = false;
      phoneFields.forEach((field) => {
        if (field.value && !validatePhoneNumber(field.value, field.name)) {
          hasErrors = true;
        }
      });

      if (hasErrors) {
        setError('Please fix phone number errors before saving.');
        setSaving(false);
        return;
      }

      const payload = {
        name: editData.companyName,
        logoUrl: editData.logo,
        websiteUrl: editData.website,
        primaryContactName: editData.primaryContact,
        primaryContactEmail: editData.primaryEmail,
        primaryContactPhone: editData.primaryPhone,
        mobilePhone: editData.phoneNumbers.fax,
        addressLine1: editData.address.street,
        city: editData.address.city,
        stateProvince: editData.address.state,
        postalCode: editData.address.zipCode,
        country: editData.address.country,
      };

      console.log('Saving company profile with payload:', payload);
      const response = await apiService.updateCompanyProfile(payload);
      console.log('Save response:', response);

      if (response.success) {
        setCompanyData(editData);
        setIsEditing(false);
        setPhoneErrors({});
        setSuccessMessage('Company profile updated successfully!');

        // Clear success message after 3 seconds
        setTimeout(() => setSuccessMessage(''), 3000);
      }
    } catch (err: any) {
      console.error('Error saving company data:', err);
      setError(err.response?.data?.message || 'Failed to save company profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditData(companyData);
    setLogoFile(null);
    setLogoPreview('');
    setIsEditing(false);
    setPhoneErrors({});
    setError('');
  };

  const handleChange = (field: string, value: string) => {
    // Format phone numbers for primaryPhone field
    if (field === 'primaryPhone') {
      const formatted = formatPhoneNumber(value);
      setEditData((prev) => ({ ...prev, [field]: formatted }));
      validatePhoneNumber(formatted, field);
    } else {
      setEditData((prev) => ({ ...prev, [field]: value }));
    }
  };

  const handleAddressChange = (field: string, value: string) => {
    setEditData((prev) => ({
      ...prev,
      address: { ...prev.address, [field]: value },
    }));
  };

  const handlePhoneChange = (field: string, value: string) => {
    const formatted = formatPhoneNumber(value);
    setEditData((prev) => ({
      ...prev,
      phoneNumbers: { ...prev.phoneNumbers, [field]: formatted },
    }));
    validatePhoneNumber(formatted, `phoneNumbers.${field}`);
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
                Company Profile
              </h1>
              <p
                className={`text-sm mt-2 max-w-3xl transition-colors ${
                  theme === 'dark' ? 'text-white/60' : 'text-gray-600'
                }`}
              >
                The company profile allows you to define and manage key information about your
                organization. This includes your brand identity, contact details, and more.
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
            theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-white border-gray-200 shadow-sm'
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
              {isEditing ? 'Edit Company Information' : 'Company Information'}
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
                Loading company profile...
              </p>
            </div>
          ) : (
            <div className="p-6 space-y-8">
              {/* Logo Section */}
              <div>
                <h3
                  className={`text-lg font-semibold mb-4 ${
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}
                >
                  Brand Identity
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                          onChange={handleFileInputChange}
                          className="hidden"
                        />
                        <div
                          onDragOver={handleDragOver}
                          onDragLeave={handleDragLeave}
                          onDrop={handleDrop}
                          onClick={() => document.getElementById('logo-upload')?.click()}
                          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                            isDragging
                              ? theme === 'dark'
                                ? 'border-blue-400 bg-blue-400/10'
                                : 'border-blue-500 bg-blue-50'
                              : theme === 'dark'
                                ? 'border-white/20 bg-white/5 hover:border-white/30'
                                : 'border-gray-300 bg-gray-50 hover:border-gray-400'
                          }`}
                        >
                          {logoPreview || editData.logo ? (
                            <div className="space-y-4">
                              <img
                                src={logoPreview || editData.logo}
                                alt="Logo preview"
                                className="mx-auto h-32 w-32 object-contain rounded-lg border border-gray-200"
                              />
                              <div>
                                <p
                                  className={`text-sm ${
                                    theme === 'dark' ? 'text-white/60' : 'text-gray-600'
                                  }`}
                                >
                                  Click to change or drag and drop a new image
                                </p>
                                <p
                                  className={`text-xs ${
                                    theme === 'dark' ? 'text-white/40' : 'text-gray-500'
                                  }`}
                                >
                                  PNG, JPG up to 2MB
                                </p>
                              </div>
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
                                Click to upload or drag and drop
                              </p>
                              <p
                                className={`text-xs ${
                                  theme === 'dark' ? 'text-white/40' : 'text-gray-500'
                                }`}
                              >
                                PNG, JPG up to 2MB
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div
                        className={`border rounded-lg p-8 text-center ${
                          theme === 'dark'
                            ? 'border-white/20 bg-white/5'
                            : 'border-gray-200 bg-gray-50'
                        }`}
                      >
                        {companyData.logo ? (
                          <div className="space-y-2">
                            <img
                              src={companyData.logo}
                              alt="Company logo"
                              className="mx-auto h-32 w-32 object-contain rounded-lg border border-gray-200"
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
                        {companyData.companyName}
                      </p>
                    )}

                    <label
                      className={`block text-sm font-medium mb-2 mt-4 ${
                        theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                      }`}
                    >
                      Website
                    </label>
                    {isEditing ? (
                      <input
                        type="url"
                        value={editData.website}
                        onChange={(e) => handleChange('website', e.target.value)}
                        className={`w-full px-4 py-2 rounded-lg border transition-colors ${
                          theme === 'dark'
                            ? 'bg-white/10 border-white/20 text-white'
                            : 'bg-white border-gray-300 text-gray-900'
                        } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                      />
                    ) : (
                      <a
                        href={companyData.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-700 flex items-center space-x-1"
                      >
                        <span>{companyData.website}</span>
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
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

              {/* Primary Contact */}
              <div>
                <h3
                  className={`text-lg font-semibold mb-4 ${
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}
                >
                  Primary Contact
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label
                      className={`block text-sm font-medium mb-2 ${
                        theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                      }`}
                    >
                      Contact Name
                    </label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={editData.primaryContact}
                        onChange={(e) => handleChange('primaryContact', e.target.value)}
                        className={`w-full px-4 py-2 rounded-lg border transition-colors ${
                          theme === 'dark'
                            ? 'bg-white/10 border-white/20 text-white'
                            : 'bg-white border-gray-300 text-gray-900'
                        } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                      />
                    ) : (
                      <p className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>
                        {companyData.primaryContact}
                      </p>
                    )}
                  </div>

                  <div>
                    <label
                      className={`block text-sm font-medium mb-2 ${
                        theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                      }`}
                    >
                      Email Address
                    </label>
                    {isEditing ? (
                      <input
                        type="email"
                        value={editData.primaryEmail}
                        onChange={(e) => handleChange('primaryEmail', e.target.value)}
                        className={`w-full px-4 py-2 rounded-lg border transition-colors ${
                          theme === 'dark'
                            ? 'bg-white/10 border-white/20 text-white'
                            : 'bg-white border-gray-300 text-gray-900'
                        } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                      />
                    ) : (
                      <p className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>
                        {companyData.primaryEmail}
                      </p>
                    )}
                  </div>

                  <div>
                    <label
                      className={`block text-sm font-medium mb-2 ${
                        theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                      }`}
                    >
                      Phone Number
                    </label>
                    {isEditing ? (
                      <div>
                        <input
                          type="tel"
                          value={editData.primaryPhone}
                          onChange={(e) => handleChange('primaryPhone', e.target.value)}
                          placeholder="(555) 123-4567"
                          className={`w-full px-4 py-2 rounded-lg border transition-colors ${
                            phoneErrors.primaryPhone
                              ? 'border-red-500 focus:ring-red-500'
                              : theme === 'dark'
                                ? 'bg-white/10 border-white/20 text-white'
                                : 'bg-white border-gray-300 text-gray-900'
                          } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                        />
                        {phoneErrors.primaryPhone && (
                          <p className="text-red-500 text-xs mt-1">{phoneErrors.primaryPhone}</p>
                        )}
                      </div>
                    ) : (
                      <p className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>
                        {companyData.primaryPhone}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Address Information */}
              <div>
                <h3
                  className={`text-lg font-semibold mb-4 ${
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}
                >
                  Address Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                    <label
                      className={`block text-sm font-medium mb-2 ${
                        theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                      }`}
                    >
                      Street Address
                    </label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={editData.address.street}
                        onChange={(e) => handleAddressChange('street', e.target.value)}
                        className={`w-full px-4 py-2 rounded-lg border transition-colors ${
                          theme === 'dark'
                            ? 'bg-white/10 border-white/20 text-white'
                            : 'bg-white border-gray-300 text-gray-900'
                        } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                      />
                    ) : (
                      <p className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>
                        {companyData.address.street}
                      </p>
                    )}
                  </div>

                  <div>
                    <label
                      className={`block text-sm font-medium mb-2 ${
                        theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                      }`}
                    >
                      City
                    </label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={editData.address.city}
                        onChange={(e) => handleAddressChange('city', e.target.value)}
                        className={`w-full px-4 py-2 rounded-lg border transition-colors ${
                          theme === 'dark'
                            ? 'bg-white/10 border-white/20 text-white'
                            : 'bg-white border-gray-300 text-gray-900'
                        } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                      />
                    ) : (
                      <p className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>
                        {companyData.address.city}
                      </p>
                    )}
                  </div>

                  <div>
                    <label
                      className={`block text-sm font-medium mb-2 ${
                        theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                      }`}
                    >
                      State/Province
                    </label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={editData.address.state}
                        onChange={(e) => handleAddressChange('state', e.target.value)}
                        className={`w-full px-4 py-2 rounded-lg border transition-colors ${
                          theme === 'dark'
                            ? 'bg-white/10 border-white/20 text-white'
                            : 'bg-white border-gray-300 text-gray-900'
                        } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                      />
                    ) : (
                      <p className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>
                        {companyData.address.state}
                      </p>
                    )}
                  </div>

                  <div>
                    <label
                      className={`block text-sm font-medium mb-2 ${
                        theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                      }`}
                    >
                      ZIP/Postal Code
                    </label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={editData.address.zipCode}
                        onChange={(e) => handleAddressChange('zipCode', e.target.value)}
                        className={`w-full px-4 py-2 rounded-lg border transition-colors ${
                          theme === 'dark'
                            ? 'bg-white/10 border-white/20 text-white'
                            : 'bg-white border-gray-300 text-gray-900'
                        } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                      />
                    ) : (
                      <p className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>
                        {companyData.address.zipCode}
                      </p>
                    )}
                  </div>

                  <div>
                    <label
                      className={`block text-sm font-medium mb-2 ${
                        theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                      }`}
                    >
                      Country
                    </label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={editData.address.country}
                        onChange={(e) => handleAddressChange('country', e.target.value)}
                        className={`w-full px-4 py-2 rounded-lg border transition-colors ${
                          theme === 'dark'
                            ? 'bg-white/10 border-white/20 text-white'
                            : 'bg-white border-gray-300 text-gray-900'
                        } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                      />
                    ) : (
                      <p className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>
                        {companyData.address.country}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Company Phone Numbers */}
              <div>
                <h3
                  className={`text-lg font-semibold mb-4 ${
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}
                >
                  Company Phone Numbers
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label
                      className={`block text-sm font-medium mb-2 ${
                        theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                      }`}
                    >
                      Main Phone
                    </label>
                    {isEditing ? (
                      <div>
                        <input
                          type="tel"
                          value={editData.phoneNumbers.main}
                          onChange={(e) => handlePhoneChange('main', e.target.value)}
                          placeholder="(555) 123-4567"
                          className={`w-full px-4 py-2 rounded-lg border transition-colors ${
                            phoneErrors['phoneNumbers.main']
                              ? 'border-red-500 focus:ring-red-500'
                              : theme === 'dark'
                                ? 'bg-white/10 border-white/20 text-white'
                                : 'bg-white border-gray-300 text-gray-900'
                          } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                        />
                        {phoneErrors['phoneNumbers.main'] && (
                          <p className="text-red-500 text-xs mt-1">
                            {phoneErrors['phoneNumbers.main']}
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>
                        {companyData.phoneNumbers.main}
                      </p>
                    )}
                  </div>

                  <div>
                    <label
                      className={`block text-sm font-medium mb-2 ${
                        theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                      }`}
                    >
                      Fax Number
                    </label>
                    {isEditing ? (
                      <div>
                        <input
                          type="tel"
                          value={editData.phoneNumbers.fax}
                          onChange={(e) => handlePhoneChange('fax', e.target.value)}
                          placeholder="(555) 123-4567"
                          className={`w-full px-4 py-2 rounded-lg border transition-colors ${
                            phoneErrors['phoneNumbers.fax']
                              ? 'border-red-500 focus:ring-red-500'
                              : theme === 'dark'
                                ? 'bg-white/10 border-white/20 text-white'
                                : 'bg-white border-gray-300 text-gray-900'
                          } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                        />
                        {phoneErrors['phoneNumbers.fax'] && (
                          <p className="text-red-500 text-xs mt-1">
                            {phoneErrors['phoneNumbers.fax']}
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>
                        {companyData.phoneNumbers.fax}
                      </p>
                    )}
                  </div>

                  <div>
                    <label
                      className={`block text-sm font-medium mb-2 ${
                        theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                      }`}
                    >
                      Support Phone
                    </label>
                    {isEditing ? (
                      <div>
                        <input
                          type="tel"
                          value={editData.phoneNumbers.support}
                          onChange={(e) => handlePhoneChange('support', e.target.value)}
                          placeholder="(555) 123-4567"
                          className={`w-full px-4 py-2 rounded-lg border transition-colors ${
                            phoneErrors['phoneNumbers.support']
                              ? 'border-red-500 focus:ring-red-500'
                              : theme === 'dark'
                                ? 'bg-white/10 border-white/20 text-white'
                                : 'bg-white border-gray-300 text-gray-900'
                          } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                        />
                        {phoneErrors['phoneNumbers.support'] && (
                          <p className="text-red-500 text-xs mt-1">
                            {phoneErrors['phoneNumbers.support']}
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>
                        {companyData.phoneNumbers.support}
                      </p>
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

export default CompanyProfile;
