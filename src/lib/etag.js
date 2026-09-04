const crypto = require('crypto');

function sendWithETag(req, res, payload, maxAgeSeconds = 60) {
  const body = { ok: true, data: payload };
  const etag = crypto.createHash('sha1').update(JSON.stringify(body)).digest('hex');

  if (req.headers['if-none-match'] === etag) {
    return res.status(304).end();      
  }

  res.set('ETag', etag);
  res.set('Cache-Control', `public, max-age=${maxAgeSeconds}`);
  return res.json(body);
}

module.exports = { sendWithETag };