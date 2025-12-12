import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';

interface Product {
  id: number;
  company_id: string;
  department_id: number;
  department_name?: string;
  product_code: string;
  name: string;
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface Department {
  id: number;
  name: string;
}

const Products: React.FC = () => {
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    product_code: '',
    name: '',
    description: '',
    department_id: '',
  });

  useEffect(() => {
    fetchDepartments();
    fetchProducts();
  }, []);

  useEffect(() => {
    if (selectedDepartmentId !== 'all') {
      fetchProducts(selectedDepartmentId);
    } else {
      fetchProducts();
    }
  }, [selectedDepartmentId]);

  const fetchDepartments = async () => {
    try {
      const data = await apiService.getDepartments();
      setDepartments(data);
    } catch (error) {
      console.error('Error fetching departments:', error);
    }
  };

  const fetchProducts = async (departmentId?: string) => {
    try {
      setLoading(true);
      const params = departmentId ? { department_id: departmentId } : {};
      const data = await apiService.getProducts(params);
      setProducts(data);
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  const startEditing = (product?: Product) => {
    if (product) {
      setFormData({
        product_code: product.product_code,
        name: product.name,
        description: product.description || '',
        department_id: product.department_id.toString(),
      });
      setSelectedProduct(product);
      setIsEditing(true);
      setIsCreating(false);
    } else {
      setFormData({
        product_code: '',
        name: '',
        description: '',
        department_id: selectedDepartmentId !== 'all' ? selectedDepartmentId : '',
      });
      setSelectedProduct(null);
      setIsCreating(true);
      setIsEditing(true);
    }
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setIsCreating(false);
    setSelectedProduct(null);
    setFormData({
      product_code: '',
      name: '',
      description: '',
      department_id: '',
    });
  };

  const handleSave = async () => {
    if (!formData.product_code.trim() || !formData.name.trim() || !formData.department_id) {
      alert('Please fill in product code, name, and select a department.');
      return;
    }

    try {
      setSaving(true);

      if (isCreating) {
        await apiService.createProduct(formData);
      } else if (selectedProduct) {
        await apiService.updateProduct(selectedProduct.id, formData);
      }

      await fetchProducts(selectedDepartmentId !== 'all' ? selectedDepartmentId : undefined);
      cancelEditing();
    } catch (error: any) {
      console.error('Error saving product:', error);
      alert(`Failed to save product: ${error.response?.data?.error || error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this product?')) {
      return;
    }

    try {
      await apiService.deleteProduct(id);
      await fetchProducts(selectedDepartmentId !== 'all' ? selectedDepartmentId : undefined);
    } catch (error: any) {
      console.error('Error deleting product:', error);
      alert(`Failed to delete product: ${error.response?.data?.error || error.message}`);
    }
  };

  const filteredProducts = products;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading products...</div>
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
              <h2 className="text-2xl font-bold text-gray-900">Products</h2>
              <p className="text-sm text-gray-600 mt-1">Manage products by department</p>
            </div>
            {!isEditing && (
              <button
                onClick={() => startEditing()}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
              >
                Add New Product
              </button>
            )}
          </div>
        </div>

        <div className="p-6">
          {/* Department Filter */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Filter by Department
            </label>
            <select
              value={selectedDepartmentId}
              onChange={(e) => setSelectedDepartmentId(e.target.value)}
              className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Departments ({products.length} products)</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name} ({products.filter((p) => p.department_id === dept.id).length})
                </option>
              ))}
            </select>
          </div>

          {filteredProducts.length === 0 && !isEditing ? (
            <div className="text-center py-12">
              <div className="text-gray-400 text-6xl mb-4">📦</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Products Configured</h3>
              <p className="text-gray-600 mb-4">
                Create products to organize your offerings by department.
              </p>
              <button
                onClick={() => startEditing()}
                className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition-colors"
              >
                Create Product
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Products List */}
              <div className="lg:col-span-1">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Products</h3>
                <div className="space-y-2">
                  {filteredProducts.map((product) => (
                    <div
                      key={product.id}
                      className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                        selectedProduct?.id === product.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => setSelectedProduct(product)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-gray-900">{product.name}</h4>
                            <span className="text-xs text-gray-500">({product.product_code})</span>
                          </div>
                          <p className="text-sm text-gray-600">{product.department_name}</p>
                          {product.description && (
                            <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                              {product.description}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              startEditing(product);
                            }}
                            className="text-blue-600 hover:text-blue-800 text-sm"
                          >
                            Edit
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(product.id);
                            }}
                            className="text-red-600 hover:text-red-800 text-sm"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Product Details/Form */}
              <div className="lg:col-span-2">
                {isEditing ? (
                  <div>
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-lg font-medium text-gray-900">
                        {isCreating ? 'Create Product' : 'Edit Product'}
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

                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Department *
                        </label>
                        <select
                          value={formData.department_id}
                          onChange={(e) =>
                            setFormData({ ...formData, department_id: e.target.value })
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          disabled={!isCreating}
                        >
                          <option value="">Select department...</option>
                          {departments.map((dept) => (
                            <option key={dept.id} value={dept.id}>
                              {dept.name}
                            </option>
                          ))}
                        </select>
                        {!isCreating && (
                          <p className="text-sm text-gray-500 mt-1">
                            Department cannot be changed after creation
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Product Code *
                        </label>
                        <input
                          type="text"
                          value={formData.product_code}
                          onChange={(e) =>
                            setFormData({ ...formData, product_code: e.target.value })
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="e.g., PROD-001"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Product Name *
                        </label>
                        <input
                          type="text"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Product name"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Description
                        </label>
                        <textarea
                          value={formData.description}
                          onChange={(e) =>
                            setFormData({ ...formData, description: e.target.value })
                          }
                          rows={4}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Optional product description"
                        />
                      </div>
                    </div>
                  </div>
                ) : selectedProduct ? (
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Product Details</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Department
                        </label>
                        <p className="mt-1 text-gray-900">{selectedProduct.department_name}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Product Code
                        </label>
                        <p className="mt-1 text-gray-900">{selectedProduct.product_code}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Name</label>
                        <p className="mt-1 text-gray-900">{selectedProduct.name}</p>
                      </div>
                      {selectedProduct.description && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700">
                            Description
                          </label>
                          <p className="mt-1 text-gray-900">{selectedProduct.description}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    Select a product to view details
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Products;
