const Outage = require('../models/Outage');
const ScheduledCut = require('../models/ScheduledCut');
const { parentCell, cellBounds, cellLabel, BASE_CELL_M } = require('../lib/grid');

// Design එකේ zoom levels 3: '1 km' / '500 m' / '250 m'
const ZOOM_CELL_M = { 0: 1000, 1: 500, 2: 250 };

/**
 * Duration → severity.
 * ★ Design එකේ legend එකට හරියටම ගැලපෙනවා:
 *   under 1 h = කහ · 1–3 h = තැඹිලි · over 3 h = රතු
 */
function severityOf(mins) {
  if (mins > 180) return 'high';
  if (mins > 60)  return 'medium';
  return 'low';
}

/**
 * ★★ ප්‍රධාන function එක — map එකේ පෙන්නන cells ටික.
 *
 * ලොකුම trick එක: DB එකේ තියෙන්නේ 250 m cells විතරයි.
 * Zoom out කරද්දී ඒවා parentCell() එකෙන් ලොකු cells වලට fold කරනවා.
 */
async function getMapCells({ north, south, east, west, zoom = 2, layer = 'active' }) {
  const cellM = ZOOM_CELL_M[zoom] ?? 250;

  if (layer === 'scheduled') return getScheduledCells({ north, south, east, west, cellM });

  // ── Step 1: bounding box එකට වැටෙන outages ──
  // $geoWithin + $box = MongoDB එකේ built-in geo filter එක.
  // ★ box එකේ පිළිවෙළ: [[බටහිර-දකුණ], [නැගෙනහිර-උතුරු]] — lng මුලින්!
  const statusFilter = layer === 'restored'
    ? { status: 'restored', restoredAt: { $gte: new Date(Date.now() - 86400_000) } }
    : { status: { $in: ['reported', 'confirmed'] } };

  const outages = await Outage.find({
    ...statusFilter,
    centroid: { $geoWithin: { $box: [[west, south], [east, north]] } },
  }).select('cellId areaName feederCode status startedAt restoredAt reportCount uniqueUserCount');

  // ── Step 2: zoom level එකට fold කරනවා ──
  const now = Date.now();
  const buckets = new Map();

  for (const o of outages) {
    const key = cellM === BASE_CELL_M ? o.cellId : parentCell(o.cellId, cellM);
    const mins = Math.round(((o.restoredAt?.getTime() ?? now) - o.startedAt.getTime()) / 60000);

    const b = buckets.get(key) || {
      cellId: key, reports: 0, users: 0, maxMins: 0,
      names: [], outageIds: [], confirmed: false,
    };

    b.reports += o.reportCount;
    b.users   += o.uniqueUserCount;
    b.maxMins  = Math.max(b.maxMins, mins);      // ★ ලොකු cell එකේ නරකම තත්ත්වය පෙන්නනවා
    if (o.areaName) b.names.push(o.areaName);
    if (o.status === 'confirmed') b.confirmed = true;
    b.outageIds.push(o._id);

    buckets.set(key, b);
  }

  // ── Step 3: Flutter එකට ඕන shape එකට ──
  return [...buckets.values()].map(b => ({
    cellId: b.cellId,
    label: cellLabel(b.cellId),
    bounds: cellBounds(b.cellId),                // map එකේ අඳින්න
    areaName: b.names[0] || null,
    reports: b.reports,
    uniqueUsers: b.users,
    durationMins: b.maxMins,
    severity: severityOf(b.maxMins),
    confirmed: b.confirmed,
    intensity: Math.min(1, b.users / 12),        // ★ පාට කොච්චර තදද (0–1)
    outageIds: b.outageIds,
  }));
}

/** Scheduled cuts layer එක */
async function getScheduledCells({ north, south, east, west, cellM }) {
  const cuts = await ScheduledCut.find({
    endsAt: { $gte: new Date() },
    startsAt: { $lte: new Date(Date.now() + 48 * 3600_000) },   // ඉදිරි පැය 48
  });

  const buckets = new Map();
  for (const cut of cuts) {
    for (const baseCellId of cut.cellIds) {
      const key = cellM === BASE_CELL_M ? baseCellId : parentCell(baseCellId, cellM);
      const b = buckets.get(key) || { cellId: key, cuts: [] };
      b.cuts.push({ source: cut.source, startsAt: cut.startsAt, endsAt: cut.endsAt, noticeUrl: cut.noticeUrl });
      buckets.set(key, b);
    }
  }

  return [...buckets.values()].map(b => ({
    cellId: b.cellId,
    label: cellLabel(b.cellId),
    bounds: cellBounds(b.cellId),
    scheduled: true,
    cuts: b.cuts,
  }));
}


async function getLayerCounts() {
  const dayAgo = new Date(Date.now() - 86400_000);

  // ★ Promise.all — queries 3ක් සමාන්තරව. එකින් එක await කරොත් කාලය 3 ගුණයක්.
  const [activeAgg, restoredCount, scheduledCount] = await Promise.all([
    Outage.aggregate([
      { $match: { status: { $in: ['reported', 'confirmed'] } } },
      { $group: { _id: null, areas: { $sum: 1 }, reports: { $sum: '$reportCount' } } },
    ]),
    Outage.countDocuments({ status: 'restored', restoredAt: { $gte: dayAgo } }),
    ScheduledCut.countDocuments({ startsAt: { $gte: new Date() } }),
  ]);

  const a = activeAgg[0] || { areas: 0, reports: 0 };

  return {
    active:    { areas: a.areas, reports: a.reports, label: `${a.areas} areas · ${a.reports} reports` },
    restored:  { areas: restoredCount, label: `${restoredCount} areas today` },
    scheduled: { cuts: scheduledCount, label: `${scheduledCount} cuts tomorrow` },
  };
}

function getLegend() {
  return {
    severity: [
      { key: 'low',    maxMins: 60,   label: 'under 1 h' },
      { key: 'medium', maxMins: 180,  label: '1–3 h' },
      { key: 'high',   maxMins: null, label: 'over 3 h' },
    ],
    zoomLevels: [
      { zoom: 0, cellMeters: 1000, scaleLabel: '1 km cells', grid: '4 × 6' },
      { zoom: 1, cellMeters: 500,  scaleLabel: '500 m cells', grid: '6 × 8' },
      { zoom: 2, cellMeters: 250,  scaleLabel: '250 m cells', grid: '8 × 11' },
    ],
    clusterRule: { minUsers: 5, windowMinutes: 15, radiusMeters: 400 },
  };
}

module.exports = { getMapCells, getLayerCounts, getLegend, severityOf, ZOOM_CELL_M };