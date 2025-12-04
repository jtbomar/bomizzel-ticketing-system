import express from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { db } from '../config/database';
import { getUserCompanyAndOrg } from '../utils/orgContext';

const router = express.Router();

// Get all products (optionally filtered by department)
router.get('/', authenticate, async (req, res) => {
  console.log('Fetching products...');

  try {
    const { department_id } = req.query;
    const { companyId, orgId } = await getUserCompanyAndOrg(req.user!.id);

    let query = db('products')
      .where('company_id', companyId)
      .where('is_active', true)
      .orderBy('name', 'asc');

    if (department_id) {
      query = query.where('department_id', department_id);
    }

    const products = await query;

    // Enrich with department info
    const enrichedProducts = await Promise.all(
      products.map(async (product) => {
        const department = await db('departments').where('id', product.department_id).first();
        return {
          ...product,
          department_name: department?.name,
        };
      })
    );

    return res.json(enrichedProducts);
  } catch (error: any) {
    console.error('Error fetching products:', error);
    return res.status(500).json({ error: 'Failed to fetch products', details: error.message });
  }
});

// Get specific product by ID
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { companyId } = await getUserCompanyAndOrg(req.user!.id);

    const product = await db('products')
      .where('id', parseInt(id))
      .where('company_id', companyId)
      .first();

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const department = await db('departments').where('id', product.department_id).first();

    return res.json({
      ...product,
      department_name: department?.name,
    });
  } catch (error: any) {
    console.error('Error fetching product:', error);
    return res.status(500).json({ error: 'Failed to fetch product', details: error.message });
  }
});

// Create new product
router.post('/', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { product_code, name, description, department_id } = req.body;

    if (!product_code || !name || !department_id) {
      return res.status(400).json({ error: 'Product code, name, and department are required' });
    }

    const { companyId, orgId } = await getUserCompanyAndOrg(req.user!.id);

    // Check if product code already exists in this department
    const existing = await db('products')
      .where('department_id', department_id)
      .where('product_code', product_code)
      .first();

    if (existing) {
      return res.status(409).json({ error: 'Product code already exists in this department' });
    }

    const productData: any = {
      company_id: companyId,
      department_id,
      product_code,
      name,
      description,
      is_active: true,
    };

    // Only add org_id if column exists
    const hasOrgId = await db.schema.hasColumn('products', 'org_id');
    if (hasOrgId) {
      productData.org_id = orgId;
    }

    const [product] = await db('products').insert(productData).returning('*');

    return res.status(201).json(product);
  } catch (error: any) {
    console.error('Error creating product:', error);
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Product code already exists in this department' });
    }
    return res.status(500).json({ error: 'Failed to create product', details: error.message });
  }
});

// Update product
router.put('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { product_code, name, description, is_active } = req.body;
    const { companyId } = await getUserCompanyAndOrg(req.user!.id);

    const product = await db('products')
      .where('id', parseInt(id))
      .where('company_id', companyId)
      .first();

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // If changing product code, check for duplicates
    if (product_code && product_code !== product.product_code) {
      const existing = await db('products')
        .where('department_id', product.department_id)
        .where('product_code', product_code)
        .whereNot('id', parseInt(id))
        .first();

      if (existing) {
        return res.status(409).json({ error: 'Product code already exists in this department' });
      }
    }

    const updateData: any = {
      updated_at: db.fn.now(),
    };

    if (product_code !== undefined) updateData.product_code = product_code;
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (is_active !== undefined) updateData.is_active = is_active;

    const [updated] = await db('products')
      .where('id', parseInt(id))
      .update(updateData)
      .returning('*');

    return res.json(updated);
  } catch (error: any) {
    console.error('Error updating product:', error);
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Product code already exists in this department' });
    }
    return res.status(500).json({ error: 'Failed to update product', details: error.message });
  }
});

// Delete product (soft delete)
router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { companyId } = await getUserCompanyAndOrg(req.user!.id);

    const product = await db('products')
      .where('id', parseInt(id))
      .where('company_id', companyId)
      .first();

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    await db('products')
      .where('id', parseInt(id))
      .update({ is_active: false, updated_at: db.fn.now() });

    return res.json({ message: 'Product deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting product:', error);
    return res.status(500).json({ error: 'Failed to delete product', details: error.message });
  }
});

export default router;
