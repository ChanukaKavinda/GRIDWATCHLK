const Outage = require('../models/Outage');
const OutageEvent = require('../models/OutageEvent');
const Report = require('../models/Report');
const { cellLabel, cellBounds, latLngToCell } = require('../lib/grid');
const { severityOf } = require('./map.service');
const { formatDuration } = require('./report.service');

/**
 * Cell එකක සම්පූර්ණ විස්තර — Area detail screen එකට.
 * ★ Design එකේ 1c screen එකට ඕන හැම දෙයක්ම එක response එකකින්.
 *   Flutter side එකේ requests 4ක් යවන්න ඕන නෑ.
 */
async function getAreaDetail(cellId, viewer) {
  // Active එකක් තියෙනවා නම් ඒක, නැත්නම් අන්තිම එක
  const outage =
    await Outage.findOne({ cellId, status: { $in: ['reported', 'confirmed'] } }) ||
    await Outage.findOne({ cellId }).sort({ startedAt: -1 });

  if (!outage) {
    // ★ Outage නැති cell එකකුත් valid — 404 දෙන්නේ නෑ.
    //   Flutter side එකේ error handling ලේසි වෙනවා.
    return {
      cellId,
      label: cellLabel(cellId),
      bounds: cellBounds(cellId),
      hasOutage: false,
    };
  }

  const now = Date.now();
  const endedAt = outage.restoredAt?.getTime() ?? now;
  const durationMins = Math.round((endedAt - outage.startedAt.getTime()) / 60000);

  // ★ Promise.all — queries 3ක් සමාන්තරව
  const [timeline, firstReport, causeAgg] = await Promise.all([
    OutageEvent.find({ outage: outage._id }).sort({ at: -1 }).limit(20),
    Report.findOne({ outage: outage._id, kind: 'outage' }).sort({ reportedAt: 1 }).select('reportedAt cause'),
    Report.aggregate([
      { $match: { outage: outage._id, kind: 'outage', status: 'accepted' } },
      { $group: { _id: '$cause', n: { $sum: 1 } } },
      { $sort: { n: -1 } },
      { $limit: 1 },
    ]),
  ]);

  // Viewer එයාම report කරලද? — "I'm affected too" button එකේ state එකට
  const iReported = viewer
    ? !!(await Report.exists({ outage: outage._id, user: viewer._id, kind: 'outage' }))
    : false;

  return {
    hasOutage: true,
    outageId: outage._id,
    cellId,
    label: cellLabel(cellId),
    bounds: cellBounds(cellId),
    areaName: outage.areaName || null,
    feederCode: outage.feederCode,
    status: outage.status,
    severity: severityOf(durationMins),
    reports: outage.reportCount,
    uniqueUsers: outage.uniqueUserCount,
    startedAt: outage.startedAt,
    confirmedAt: outage.confirmedAt,
    restoredAt: outage.restoredAt,
    durationMins,
    durationLabel: formatDuration(durationMins),        // '2 h 18 m'
    dominantCause: causeAgg[0]?._id || firstReport?.cause || 'unknown',
    trustLabel: outage.status === 'confirmed'
      ? `CONFIRMED · ${outage.reportCount} REPORTS`
      : `${outage.reportCount} REPORT(S)`,
    iReported,
    timeline: timeline.map(e => ({
      at: e.at, type: e.type, text: e.text, confirmations: e.confirmations,
    })),
  };
}

/**
 * User ගේ තැනට ළඟ outages — 'Nearby' list එකට.
 * ★ $near query එකට 2dsphere index එක අනිවාර්යයි (Outage model එකේ දාලා තියෙනවා).
 *   $near එකෙන් ළඟම එක මුලින් — sort කරන්න ඕන නෑ.
 */
async function getNearbyOutages({ lat, lng, radiusM = 5000, limit = 10 }) {
  const outages = await Outage.find({
    status: { $in: ['reported', 'confirmed', 'restored'] },
    centroid: {
      $near: {
        $geometry: { type: 'Point', coordinates: [lng, lat] },
        $maxDistance: radiusM,
      },
    },
  }).limit(limit).select('cellId areaName status startedAt restoredAt reportCount uniqueUserCount');

  const now = Date.now();
  return outages.map(o => {
    const mins = Math.round(((o.restoredAt?.getTime() ?? now) - o.startedAt.getTime()) / 60000);
    return {
      outageId: o._id,
      cellId: o.cellId,
      label: cellLabel(o.cellId),
      areaName: o.areaName || null,
      status: o.status,
      state: o.status === 'restored' ? 'Back' : 'Out',
      reports: o.reportCount,
      durationMins: mins,
      durationLabel: o.status === 'restored' ? '—' : formatDuration(mins),
      severity: severityOf(mins),
    };
  });
}

module.exports = { getAreaDetail, getNearbyOutages };