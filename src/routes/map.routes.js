const express = require('express');
const { z } = require('zod');

const { optionalAuth } = require('../middleware/auth');
const ApiError = require('../lib/ApiError');
const ctrl = require('../controllers/map.controller');

const router = express.Router();

/**
 * Query params validate කරන middleware එකක්.
 * ★ validate.js එක req.body වලට. Query params strings විදිහටයි එන්නේ,
 *   ඒ නිසා වෙනම එකක් ඕන.
 */
function validateQuery(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      return next(new ApiError(400, 'Invalid query', 'VALIDATION_ERROR',
        result.error.issues.map(i => ({ field: i.path.join('.'), message: i.message }))));
    }
    req.query = { ...req.query, ...result.data };
    next();
  };
}

// ★ z.coerce.number() — query string එකේ "6.95" කියන text එක number එකක් කරනවා
const bboxSchema = z.object({
  north: z.coerce.number().min(-90).max(90),
  south: z.coerce.number().min(-90).max(90),
  east:  z.coerce.number().min(-180).max(180),
  west:  z.coerce.number().min(-180).max(180),
  zoom:  z.coerce.number().int().min(0).max(2).optional(),
  layer: z.enum(['active', 'restored', 'scheduled']).optional(),
}).refine(d => d.north > d.south, { message: 'north must be greater than south' })
  .refine(d => d.east > d.west,   { message: 'east must be greater than west' });

router.get('/cells',  optionalAuth, validateQuery(bboxSchema), ctrl.cells);
router.get('/counts', optionalAuth, ctrl.counts);
router.get('/legend', ctrl.legend);

module.exports = router;