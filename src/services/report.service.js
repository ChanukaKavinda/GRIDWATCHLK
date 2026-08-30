const Report = require('../models/Report');
const Outage = require('../models/Outage');
const OutageEvent = require('../models/OutageEvent');
const ApiError = require('../lib/ApiError');
const { latLngToCell, cellLabel, cellBounds } = require('../lib/grid');

// ★ Design එකේ නීතිය: "≥5 reports / 400 m / 15 min"
const CONFIRM_MIN_USERS  = 5;
const CONFIRM_WINDOW_MS  = 15 * 60 * 1000;
const SELF_DUP_WINDOW_MS = 30 * 60 * 1000;

/** 138 → '2 h 18 m' */
function formatDuration(mins) {
  const h = Math.floor(mins / 60), m = mins % 60;
  return h ? `${h} h ${m} m` : `${m} m`;
}


function trustWeight(user) {
  return Math.max(0.4, Math.min(1.2, 0.4 + (user.reputation / 100) * 0.8));
}


async function submitReport(user, dto) {
  // ═══ Step 1: IDEMPOTENCY ═══
  // Flutter app එක offline එකේදී UUID එකක් හදලා report එකට දානවා.
  // Network එක නරක් වෙලා දෙපාරක් යැව්වත්, දෙවෙනි එකේදී අලුත් report එකක් හැදෙන්නේ නෑ.
  const existing = await Report.findOne({ user: user._id, clientReportId: dto.clientReportId });
  if (existing) {
    const outage = existing.outage ? await Outage.findById(existing.outage) : null;
    return { report: existing, outage, deduped: true };
  }

  // ═══ Step 2: GPS → CELL ═══
  const cellId = latLngToCell(dto.lat, dto.lng);
  const reportedAt = dto.reportedAt ? new Date(dto.reportedAt) : new Date();

  // ═══ Step 3: SELF-DUPLICATE ═══
  // මේ user එයාම මේ cell එකට විනාඩි 30ක් ඇතුළත report කරලද?
  const selfDup = await Report.findOne({
    user: user._id,
    cellId,
    kind: dto.kind || 'outage',
    status: 'accepted',
    reportedAt: { $gte: new Date(reportedAt.getTime() - SELF_DUP_WINDOW_MS) },
  });

  // ═══ Step 4: OUTAGE CLUSTER එක හොයනවා / හදනවා ═══
  let outage = await Outage.findOne({
    cellId,
    status: { $in: ['reported', 'confirmed'] },
  });

  if (!outage) {
    outage = await Outage.create({
      cellId,
      cellLabel: cellLabel(cellId),
      areaName: dto.areaName || '',
      feederCode: dto.feederCode || null,
      centroid: { type: 'Point', coordinates: [dto.lng, dto.lat] },
      status: 'reported',
      startedAt: reportedAt,
      dominantCause: dto.cause || 'unknown',
    });

    await OutageEvent.create({
      outage: outage._id,
      at: reportedAt,
      type: 'first_report',
      text: `First report · ${String(dto.type).replace(/_/g, ' ')}, cause reported as ${dto.cause || 'unknown'}`,
    });
  }

  // ═══ Step 5: REPORT එක SAVE ═══
  const report = await Report.create({
    user: user._id,
    clientReportId: dto.clientReportId,
    kind: dto.kind || 'outage',
    type: dto.type,
    cause: dto.cause || 'unknown',
    location: { type: 'Point', coordinates: [dto.lng, dto.lat] },
    cellId,
    feederCode: outage.feederCode,
    photoUrl: dto.photoUrl || null,
    reportedAt,
    receivedAt: new Date(),
    outage: outage._id,
    status: selfDup ? 'duplicate' : 'accepted',
    weight: trustWeight(user),
  });

  if (selfDup) return { report, outage, deduped: true };

  // ═══ Step 6: COUNTERS ═══
  outage.reportCount += 1;

  // ★ පරණ offline report එකක් ආවොත් outage එකේ ආරම්භය ආපස්සට යනවා
  if (reportedAt < outage.startedAt) outage.startedAt = reportedAt;

  await recomputeUniqueUsers(outage);
  await evaluateCluster(outage);
  await outage.save();

  return { report, outage, deduped: false };
}

async function recomputeUniqueUsers(outage) {
  const users = await Report.distinct('user', {
    outage: outage._id,
    kind: 'outage',
    status: 'accepted',
  });
  outage.uniqueUserCount = users.length;
}

async function evaluateCluster(outage) {
  if (outage.status !== 'reported') return;      // දැනටමත් confirmed නම් වැඩක් නෑ

  const since = new Date(Date.now() - CONFIRM_WINDOW_MS);
  const recentUsers = await Report.distinct('user', {
    outage: outage._id,
    kind: 'outage',
    status: 'accepted',
    reportedAt: { $gte: since },
  });

  if (recentUsers.length >= CONFIRM_MIN_USERS) {
    outage.status = 'confirmed';
    outage.confirmedAt = new Date();
    outage.trustScore = Math.min(1, recentUsers.length / 10);

    await OutageEvent.create({
      outage: outage._id,
      at: outage.confirmedAt,
      type: 'confirmed',
      text: `Cluster threshold met — ${recentUsers.length} reports in ${CONFIRM_WINDOW_MS / 60000} minutes, marked CONFIRMED`,
    });
  }
}


async function submitRestoration(user, dto) {
  const { report, outage, deduped } = await submitReport(user, { ...dto, kind: 'restored' });
  if (!outage || deduped) return { report, outage };

  const restoredUsers = await Report.distinct('user', {
    outage: outage._id,
    kind: 'restored',
  });
  const activeUsers = outage.uniqueUserCount - restoredUsers.length;

  // Design එකේ නීතිය: "sent as soon as the cell drops below 2 active reports"
  const halfConfirmed = restoredUsers.length >= Math.ceil(outage.uniqueUserCount * 0.5);

  if (activeUsers < 2 || halfConfirmed) {
    outage.status = 'restored';
    outage.restoredAt = new Date(dto.reportedAt || Date.now());
    outage.durationMins = Math.round((outage.restoredAt - outage.startedAt) / 60000);
    await outage.save();

    await OutageEvent.create({
      outage: outage._id,
      at: outage.restoredAt,
      type: 'restored',
      text: `Power restored · outage lasted ${formatDuration(outage.durationMins)}`,
    });
  }

  return { report, outage };
}

/** "I'm affected too" — cell එකේ මැදින් report එකක්, exact GPS එකක් ඕන නෑ */
async function confirmAffected(user, outageId, clientReportId) {
  const outage = await Outage.findById(outageId);
  if (!outage) throw new ApiError(404, 'Outage not found', 'NO_OUTAGE');

  const b = cellBounds(outage.cellId);
  return submitReport(user, {
    clientReportId,
    type: 'full_blackout',
    cause: 'unknown',
    lat: (b.north + b.south) / 2,
    lng: (b.east + b.west) / 2,
  });
}

module.exports = { submitReport, submitRestoration, confirmAffected, formatDuration, trustWeight };