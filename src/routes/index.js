const express = require('express');
const authRoutes = require('./auth.routes');

const router = express.Router();

router.get('/health', (req, res) => {
  res.json({ ok: true, data: { status: 'up', time: new Date() } });
});

router.use('/auth', authRoutes);
router.use('/', authRoutes);   // /me සහ /auth/me දෙකම වැඩ කරන්න

module.exports = router;