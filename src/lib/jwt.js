const jwt = require('jsonwebtoken');
const env = require('../config/env');

function signAccessToken(user) {
  
    
  return jwt.sign(
    { sub: user._id.toString(), role: user.role },
    env.JWT_ACCESS_SECRET,
    { expiresIn: env.ACCESS_TOKEN_TTL }
  );
}

function signRefreshToken(user) {
  return jwt.sign(
    { sub: user._id.toString(), t: 'refresh' },
    env.JWT_REFRESH_SECRET,
    { expiresIn: env.REFRESH_TOKEN_TTL }
  );
}

function verifyAccessToken(token) {
  return jwt.verify(token, env.JWT_ACCESS_SECRET);   // වැරදි නම් throw වෙනවා
}

function verifyRefreshToken(token) {
  return jwt.verify(token, env.JWT_REFRESH_SECRET);
}

module.exports = { signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken };