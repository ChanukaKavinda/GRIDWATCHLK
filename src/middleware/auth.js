const ApiError = require('../lib/ApiError');
const { verifyAccessToken } = require('../lib/jwt');
const User = require('../models/User');

async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    if (!header.startsWith('Bearer ')) {
      throw new ApiError(401, 'Not signed in', 'NO_TOKEN');
    }

    const payload = verifyAccessToken(header.slice(7));   // 'Bearer ' = අකුරු 7ක්
    const user = await User.findById(payload.sub);
    if (!user) throw new ApiError(401, 'Account not found', 'NO_USER');

    req.user = user;    // ★ ඊළඟ handler එකට user එක යවනවා
    next();
  } catch (e) {
    next(e instanceof ApiError ? e : new ApiError(401, 'Invalid or expired token', 'BAD_TOKEN'));
  }
}


async function optionalAuth(req, res, next) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) { req.user = null; return next(); }

  try {
    const payload = verifyAccessToken(header.slice(7));
    req.user = await User.findById(payload.sub);
  } catch {
    req.user = null;    
  }
  next();
}

module.exports = { requireAuth, optionalAuth };