import express from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { db } from '../config/database';

const router = express.Router();

// Get all products (optionally filtered by department)
router.get('/', authenticate, async (req, res) => {
  try {
    // Check if products table exists
    const tableExists = await db.schema.hasTable('products');
    if (!tableExists) {
      console.log('Products table does not exist yet');
      return res.json([]); // Return empty array if table doesn't exist
    }

    const { department_id } = req.query;

    // Get user's company
    const userCompany = await db('user_company_associations')
      .where('user_id', req.user!.id)
      .first();

    if (!userCompany) {
      return res.status(400).json({ error: 'User not associated with any company' });
    }

    const companyId = userCompany.company_id;

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
    console.error('Error stack:', error.stack);
    return res.status(500).json({
      error: 'Failed to fetch products',
      details: error.message,
      code: error.code,
    });
  }
});

// Get specific product by ID
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const userCompany = await db('user_company_associations')
      .where('user_id', req.user!.id)
      .first();

    if (!userCompany) {
      return res.status(400).json({ error: 'User not associated with any company' });
    }

    const companyId = userCompany.company_id;

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
    // Check if products table exists
    const tableExists = await db.schema.hasTable('products');
    if (!tableExists) {
      return res.status(503).json({
        error: 'Products feature not yet available',
        details: 'Database migration pending. Please try again in a few minutes.',
      });
    }

    const { product_code, name, description, department_id } = req.body;

    if (!product_code || !name || !department_id) {
      return res.status(400).json({ error: 'Product code, name, and department are required' });
    }

    // Get user's company
    const userCompany = await db('user_company_associations')
      .where('user_id', req.user!.id)
      .first();

    if (!userCompany) {
      return res.status(400).json({ error: 'User not associated with any company' });
    }

    const companyId = userCompany.company_id;

    // Get org_id - only use if it exists in organizations table
    const user = await db('users').where('id', req.user!.id).first();
    let orgId = user?.current_org_id;

    // Verify org_id exists in organizations table
    if (orgId) {
      const orgExists = await db('organizations').where('id', orgId).first();
      if (!orgExists) {
        console.log(`⚠️  org_id ${orgId} not found in organizations table, setting to null`);
        orgId = null;
      }
    }

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

    // Only add org_id if it's valid and column exists
    const hasOrgId = await db.schema.hasColumn('products', 'org_id');
    if (hasOrgId && orgId) {
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

    const userCompany = await db('user_company_associations')
      .where('user_id', req.user!.id)
      .first();

    if (!userCompany) {
      return res.status(400).json({ error: 'User not associated with any company' });
    }

    const companyId = userCompany.company_id;

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

    const userCompany = await db('user_company_associations')
      .where('user_id', req.user!.id)
      .first();

    if (!userCompany) {
      return res.status(400).json({ error: 'User not associated with any company' });
    }

    const companyId = userCompany.company_id;

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
