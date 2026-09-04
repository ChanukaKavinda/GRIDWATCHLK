const mapService = require('../services/map.service');
const { sendWithETag } = require('../lib/etag');

const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const cells = asyncHandler(async (req, res) => {
  const { north, south, east, west, zoom, layer } = req.query;

  const data = await mapService.getMapCells({
    north: Number(north), south: Number(south),
    east: Number(east),   west: Number(west),
    zoom: zoom === undefined ? 2 : Number(zoom),
    layer: layer || 'active',
  });

  // ★ ETag — offline map caching එකට
  sendWithETag(req, res, { cells: data, count: data.length }, 60);
});

const counts = asyncHandler(async (req, res) => {
  const data = await mapService.getLayerCounts();
  sendWithETag(req, res, data, 60);
});

const legend = asyncHandler(async (req, res) => {
  // ★ Legend එක වෙනස් වෙන්නේ නෑ — පැයක් cache කරන්න පුළුවන්
  sendWithETag(req, res, mapService.getLegend(), 3600);
});

module.exports = { cells, counts, legend };