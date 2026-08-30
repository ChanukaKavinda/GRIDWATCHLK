const express = require('express');
const rateLimit = require('express-rate-limit');
const { z } = require('zod');

const validate = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const ctrl = require('../controllers/auth.controller');

const router = express.Router();

// ── Validation schemas ──
const otpRequestSchema = z.object({
  phone: z.string().min(9, 'Phone number is too short'),
});

const otpVerifySchema = z.object({
  phone: z.string().min(9),
  code: z.string().length(6, 'Code must be 6 digits'),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(10),
});

const updateMeSchema = z.object({
  displayName: z.string().max(60).optional(),
  areaLabel: z.string().max(80).optional(),
});

// ── Rate limit — OTP endpoint එකට විතරයි ──
// ★ SMS එකකට ගාණක් යනවා. Limit නැත්නම් කවුරු හරි OTP 10,000ක් යවලා ඔයාගේ බිල පුරවනවා.
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,      // විනාඩි 15ක්
  max: 5,                         // IP එකකට 5යි
  message: { ok: false, code: 'RATE_LIMIT', message: 'Too many requests, try later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ── Routes ──
router.post('/otp/request', otpLimiter, validate(otpRequestSchema), ctrl.requestOtp);
router.post('/otp/verify',  otpLimiter, validate(otpVerifySchema),  ctrl.verifyOtp);
router.post('/refresh',                 validate(refreshSchema),    ctrl.refresh);

router.get('/me',    requireAuth, ctrl.me);
router.patch('/me',  requireAuth, validate(updateMeSchema), ctrl.updateMe);

module.exports = router;