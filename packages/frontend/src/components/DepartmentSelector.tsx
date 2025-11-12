import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';

interface Department {
  id: number;
  name: string;
  color: string;
  logo?: string;
  is_active: boolean;
}

interface DepartmentSelectorProps {
  selectedDepartmentId?: number | null;
  onDepartmentChange: (departmentId: number | null) => void;
  showAllOption?: boolean;
  className?: string;
}

const DepartmentSelector: React.FC<DepartmentSelectorProps> = ({
  selectedDepartmentId,
  onDepartmentChange,
  showAllOption = true,
  className = '',
}) => {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDepartments();
  }, []);

  const fetchDepartments = async () => {
    try {
      setLoading(true);
      const departmentsData = await apiService.getDepartments();
      setDepartments(departmentsData.filter((dept: Department) => dept.is_active));
    } catch (error) {
      console.error('Error fetching departments:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectedDepartment = departments.find(dept => dept.id === selectedDepartmentId);

  if (loading) {
    return (
      <div className={`animate-pulse bg-gray-200 h-10 rounded-md ${className}`}></div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <select
        value={selectedDepartmentId || ''}
        onChange={(e) => {
          const value = e.target.value;
          onDepartmentChange(value === '' ? null : parseInt(value));
        }}
        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
      >
        {showAllOption && (
          <option value="">All Departments</option>
        )}
        {departments.map((department) => (
          <option key={department.id} value={department.id}>
            {department.name}
          </option>
        ))}
      </select>
      
      {/* Department icon/logo */}
      <div className="absolute left-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
        {selectedDepartment ? (
          selectedDepartment.logo ? (
            <img
              src={selectedDepartment.logo}
              alt={selectedDepartment.name}
              className="w-5 h-5 rounded object-cover"
            />
          ) : (
            <div
              className="w-5 h-5 rounded flex items-center justify-center text-white text-xs font-semibold"
              style={{ backgroundColor: selectedDepartment.color }}
            >
              {selectedDepartment.name.charAt(0).toUpperCase()}
            </div>
          )
        ) : (
          <div className="w-5 h-5 rounded bg-gray-400 flex items-center justify-center text-white text-xs font-semibold">
            🏢
          </div>
        )}
      </div>
    </div>
  );
};

export default DepartmentSelector;