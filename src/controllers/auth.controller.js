const authService = require('../services/auth.service');

/**
 * ★ Async controller එකක් throw කරාම Express එකට ඒක අහුවෙන්නේ නෑ (Express 4 එකේ).
 *   මේ wrapper එකෙන් catch කරලා next(err) කරනවා → errorHandler එකට යනවා.
 *   Express 5 එකේ මේක automatic, ඒත් දෙකටම වැඩ කරන නිසා තියාගමු.
 */
const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const requestOtp = asyncHandler(async (req, res) => {
  const data = await authService.requestOtp(req.body.phone);
  res.json({ ok: true, data });
});

const verifyOtp = asyncHandler(async (req, res) => {
  const { user, accessToken, refreshToken } = await authService.verifyOtp(req.body.phone, req.body.code);
  res.json({
    ok: true,
    data: {
      accessToken,
      refreshToken,
      user: {                        // ★ user document එක මුළුමනින්ම යවන්නේ නෑ
        id: user._id,
        phone: user.phone,
        displayName: user.displayName,
        reputation: user.reputation,
        role: user.role,
      },
    },
  });
});

const refresh = asyncHandler(async (req, res) => {
  const data = await authService.refresh(req.body.refreshToken);
  res.json({ ok: true, data });
});

const me = asyncHandler(async (req, res) => {
  res.json({
    ok: true,
    data: {
      id: req.user._id,
      phone: req.user.phone,
      displayName: req.user.displayName,
      areaLabel: req.user.areaLabel,
      reputation: req.user.reputation,
      role: req.user.role,
      createdAt: req.user.createdAt,
    },
  });
});

const updateMe = asyncHandler(async (req, res) => {
  const { displayName, areaLabel } = req.body;
  if (displayName !== undefined) req.user.displayName = displayName;
  if (areaLabel !== undefined) req.user.areaLabel = areaLabel;
  await req.user.save();
  res.json({ ok: true, data: { id: req.user._id, displayName: req.user.displayName, areaLabel: req.user.areaLabel } });
});

module.exports = { requestOtp, verifyOtp, refresh, me, updateMe };