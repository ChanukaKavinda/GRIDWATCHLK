const express = require('express');
const { z } = require('zod');

const validate = require('../middleware/validate');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const ctrl = require('../controllers/outage.controller');

const router = express.Router();

const confirmSchema = z.object({
  clientReportId: z.string().min(8).max(64),
});

router.get('/nearby', requireAuth, ctrl.nearby);
router.post('/:id/confirm', requireAuth, validate(confirmSchema), ctrl.confirm);

module.exports = router;