// @ts-nocheck
import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { AdvancedSearchService } from '../services/AdvancedSearchService';
import { validateRequest, validate } from '../utils/validation';
import Joi from 'joi';

const router = Router();

// Validation schemas
const searchFilterSchema = Joi.object({
  field: Joi.string().required(),
  operator: Joi.string()
    .valid(
      'equals',
      'contains',
      'starts_with',
      'ends_with',
      'greater_than',
      'less_than',
      'in',
      'not_in',
      'is_null',
      'is_not_null'
    )
    .required(),
  value: Joi.any(),
  values: Joi.array().items(Joi.any()),
});

const advancedSearchSchema = Joi.object({
  query: Joi.string().allow(''),
  filters: Joi.array().items(searchFilterSchema).default([]),
  sortBy: Joi.string().default('created_at'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  teamId: Joi.string().uuid(),
  companyIds: Joi.array().items(Joi.string().uuid()),
});

/**
 * GET /api/search/fields/:teamId
 * Get searchable fields for a team
 */
router.get('/fields/:teamId', authenticate, async (req, res, next): Promise<void> => {
  try {
    const { teamId } = req.params;

    if (!teamId) {
      return res.status(400).json({
        success: false,
        error: 'Team ID is required',
      });
    }

    const fields = await AdvancedSearchService.getSearchableFields(teamId);

    res.json({
      success: true,
      data: fields,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/search/tickets
 * Perform advanced ticket search
 */
router.post('/tickets', authenticate, validate(advancedSearchSchema), async (req, res, next) => {
  try {
    const searchRequest = req.body;
    const userId = req.user!.id;
    const userRole = req.user!.role;

    const results = await AdvancedSearchService.search(searchRequest, userId, userRole);

    res.json({
      success: true,
      data: results.data,
      pagination: results.pagination,
      meta: {
        searchQuery: searchRequest.query,
        filtersApplied: searchRequest.filters.length,
        sortBy: searchRequest.sortBy,
        sortOrder: searchRequest.sortOrder,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/search/save
 * Save a search query for later use
 */
router.post('/save', authenticate, async (req, res, next): Promise<void> => {
  try {
    const { name, searchRequest } = req.body;
    const userId = req.user!.id;

    if (!name || !searchRequest) {
      return res.status(400).json({
        success: false,
        error: 'Name and search request are required',
      });
    }

    await AdvancedSearchService.saveSearch(userId, name, searchRequest);

    res.json({
      success: true,
      message: 'Search saved successfully',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/search/saved
 * Get user's saved searches
 */
router.get('/saved', authenticate, async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const savedSearches = await AdvancedSearchService.getSavedSearches(userId);

    res.json({
      success: true,
      data: savedSearches,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
