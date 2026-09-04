const express = require('express');
const authRoutes = require('./auth.routes');
const reportRoutes = require('./report.routes');
const mapRoutes = require('./map.routes');           
const outageRoutes = require('./outage.routes');     
const { optionalAuth } = require('../middleware/auth');
const outageCtrl = require('../controllers/outage.controller');

const router = express.Router();

router.get('/health', (req, res) => {
  res.json({ ok: true, data: { status: 'up', time: new Date() } });
});

router.use('/auth', authRoutes);
router.use('/', authRoutes);
router.use('/reports', reportRoutes);
router.use('/map', mapRoutes);                       
router.use('/outages', outageRoutes);                

// Area detail — cellId එකේ '-' තියෙන නිසා වෙනම route එකක්
router.get('/areas/:cellId', optionalAuth, outageCtrl.areaDetail);   // ← අලුත්

module.exports = router;