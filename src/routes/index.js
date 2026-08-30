const express = require('express');
const authRoutes = require('./auth.routes');
const reportRoutes = require('./report.routes'); 

const router = express.Router();

router.get('/health', (req, res) => {
  res.json({ ok: true, data: { status: 'up', time: new Date() } });
});

router.use('/auth', authRoutes);
router.use('/', authRoutes);  
router.use('/reports', reportRoutes); 

module.exports = router;