const reportService = require('../services/report.service');
const { cellLabel } = require('../lib/grid');

const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const Report = require('../models/Report');

const create = asyncHandler(async (req, res) => {
  const { report, outage, deduped } = await reportService.submitReport(req.user, req.body);

  res.status(deduped ? 200 : 201).json({
    ok: true,
    data: {
      reportId: report._id,
      deduped,
      cellId: report.cellId,
      cellLabel: cellLabel(report.cellId),
      reportedAt: report.reportedAt,     // ★ device timestamp එක ආපහු — preserve වුණා කියලා තහවුරු
      receivedAt: report.receivedAt,
      outage: outage && {
        id: outage._id,
        status: outage.status,
        reports: outage.reportCount,
        uniqueUsers: outage.uniqueUserCount,
        startedAt: outage.startedAt,
        confirmedAt: outage.confirmedAt,
      },
    },
  });
});

const restored = asyncHandler(async (req, res) => {
  const { report, outage } = await reportService.submitRestoration(req.user, req.body);
  res.status(201).json({
    ok: true,
    data: {
      reportId: report._id,
      outage: outage && {
        id: outage._id,
        status: outage.status,
        durationMins: outage.durationMins,
        durationLabel: outage.durationMins ? reportService.formatDuration(outage.durationMins) : null,
      },
    },
  });
});

const mine = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Number(req.query.limit) || 20);

  const [items, total] = await Promise.all([
    Report.find({ user: req.user._id })
      .sort({ reportedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select('type cause cellId reportedAt status outage'),
    Report.countDocuments({ user: req.user._id }),
  ]);

  res.json({
    ok: true,
    data: items.map(r => ({
      id: r._id, type: r.type, cause: r.cause,
      cellId: r.cellId, cellLabel: cellLabel(r.cellId),
      reportedAt: r.reportedAt, status: r.status, outageId: r.outage,
    })),
    meta: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

module.exports = { create, restored, mine };