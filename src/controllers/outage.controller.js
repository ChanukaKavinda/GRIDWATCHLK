const outageService = require('../services/outage.service');
const reportService = require('../services/report.service');
const { sendWithETag } = require('../lib/etag');

const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const areaDetail = asyncHandler(async (req, res) => {
  const data = await outageService.getAreaDetail(req.params.cellId, req.user);
  // ★ iReported එක user එකට අනුව වෙනස් වෙනවා → private cache
  res.set('Cache-Control', 'private, max-age=30');
  res.json({ ok: true, data });
});

const nearby = asyncHandler(async (req, res) => {
  const data = await outageService.getNearbyOutages({
    lat: Number(req.query.lat),
    lng: Number(req.query.lng),
    radiusM: Number(req.query.radius) || 5000,
    limit: Math.min(20, Number(req.query.limit) || 10),
  });
  res.json({ ok: true, data });
});

const confirm = asyncHandler(async (req, res) => {
  const { report, outage } = await reportService.confirmAffected(
    req.user, req.params.id, req.body.clientReportId
  );
  res.status(201).json({
    ok: true,
    data: {
      reportId: report._id,
      outage: outage && {
        id: outage._id, status: outage.status,
        reports: outage.reportCount, uniqueUsers: outage.uniqueUserCount,
      },
    },
  });
});

module.exports = { areaDetail, nearby, confirm };