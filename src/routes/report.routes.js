const express = require('express');
const rateLimit = require('express-rate-limit');
const { z } = require('zod');

const validate = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const ctrl = require('../controllers/report.controller');

const router = express.Router();

// ── Sri Lanka එකේ ඇතුළත ද කියලා බලනවා ──
// ★ ලෝකයේ ඕන තැනකින් report එකක් දාන්න දුන්නොත් map එක කුණු වෙනවා.
const lat = z.number().min(5.7).max(10.0);
const lng = z.number().min(79.4).max(82.0);

const reportSchema = z.object({
  clientReportId: z.string().min(8).max(64),
  type: z.enum(['full_blackout', 'low_voltage', 'partial']),
  cause: z.enum(['transformer', 'storm', 'scheduled', 'line_down', 'unknown']).optional(),
  lat, lng,
  photoUrl: z.string().url().optional(),
  areaName: z.string().max(80).optional(),
  feederCode: z.string().max(20).optional(),
  reportedAt: z.string().datetime().optional(),   // ISO 8601
});

const restoredSchema = z.object({
  clientReportId: z.string().min(8).max(64),
  type: z.enum(['full_blackout', 'low_voltage', 'partial']).default('full_blackout'),
  lat, lng,
  reportedAt: z.string().datetime().optional(),
});

const reportLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,                    // විනාඩියකට 10ක්
  message: { ok: false, code: 'RATE_LIMIT', message: 'Too many reports, slow down' },
});

router.post('/',          requireAuth, reportLimiter, validate(reportSchema),   ctrl.create);
router.post('/restored',  requireAuth, reportLimiter, validate(restoredSchema), ctrl.restored);
router.get('/mine',       requireAuth, ctrl.mine);

module.exports = router;