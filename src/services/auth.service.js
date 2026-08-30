const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const User = require('../models/User');
const OtpChallenge = require('../models/OtpChallenge');
const ApiError = require('../lib/ApiError');
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require('../lib/jwt');
const { sendSms } = require('../lib/sms');
const env = require('../config/env');

/**
 * Phone number එක E.164 format එකට හදනවා.
 * '0774128836' → '+94774128836'  |  '94774128836' → '+94774128836'
 * ★ ඇයි? — එකම number එක ක්‍රම 3කින් save වුණොත් duplicate accounts හැදෙනවා.
 */
function normalizePhone(raw) {
  const digits = String(raw).replace(/\D/g, '');    // ඉලක්කම් නොවන හැම දෙයක්ම අයින්
  if (digits.startsWith('94') && digits.length === 11) return '+' + digits;
  if (digits.startsWith('0')  && digits.length === 10) return '+94' + digits.slice(1);
  if (digits.length === 9) return '+94' + digits;
  throw new ApiError(400, 'Invalid Sri Lankan phone number', 'INVALID_PHONE');
}

/**
 * 6-digit OTP එකක්.
 * ★ Math.random() පාවිච්චි කරන්න එපා — ඒක predictable, security එකට හොඳ නෑ.
 */
function generateOtp() {
  return String(crypto.randomInt(100000, 1000000));   // 100000–999999
}

async function requestOtp(rawPhone) {
  const phone = normalizePhone(rawPhone);

  // ── Step 1: විනාඩියක් ඇතුළත කලින් එකක් යවලද? ──
  const recent = await OtpChallenge.findOne({
    phone,
    consumedAt: null,
    createdAt: { $gte: new Date(Date.now() - 60_000) },
  });
  if (recent) {
    throw new ApiError(429, 'Please wait a minute before requesting again', 'OTP_TOO_SOON');
  }

  // ── Step 2: code එක හදලා hash කරනවා ──
  const code = generateOtp();
  const codeHash = await bcrypt.hash(code, 10);

  // ── Step 3: save ──
  await OtpChallenge.create({
    phone,
    codeHash,
    expiresAt: new Date(Date.now() + env.OTP_TTL_MIN * 60_000),
  });

  // ── Step 4: යවනවා ──
  await sendSms(phone, `${code} is your GridWatch verification code. Valid for ${env.OTP_TTL_MIN} minutes.`);

  return { phone, expiresIn: env.OTP_TTL_MIN * 60 };
}

async function verifyOtp(rawPhone, code) {
  const phone = normalizePhone(rawPhone);

  // ── Step 1: අලුත්ම, use නොකරපු challenge එක ──
  const challenge = await OtpChallenge.findOne({ phone, consumedAt: null }).sort({ createdAt: -1 });
  if (!challenge) throw new ApiError(400, 'No active code. Request a new one.', 'OTP_NOT_FOUND');

  // ── Step 2: කල් ඉකුත් වෙලාද? ──
  if (challenge.expiresAt < new Date()) throw new ApiError(400, 'Code expired', 'OTP_EXPIRED');

  // ── Step 3: වැරදි උත්සාහ ගණන ──
  // ★ 6 digits = හැකියාවන් 1,000,000ක්. Limit නැත්නම් bot එකකට හැම එකක්ම try කරන්න පුළුවන්.
  if (challenge.attempts >= 5) {
    throw new ApiError(429, 'Too many attempts. Request a new code.', 'OTP_LOCKED');
  }

  // ── Step 4: compare ──
  const match = await bcrypt.compare(String(code), challenge.codeHash);
  if (!match) {
    challenge.attempts += 1;
    await challenge.save();
    throw new ApiError(400, 'Incorrect code', 'OTP_INVALID');
  }

  // ── Step 5: use කරලා ඉවරයි — ආපහු use කරන්න බෑ ──
  challenge.consumedAt = new Date();
  await challenge.save();

  // ── Step 6: user හොයනවා, නැත්නම් හදනවා ──
  // upsert:true = "තියෙනවා නම් update, නැත්නම් insert" — එකම query එකෙන්
  const user = await User.findOneAndUpdate(
    { phone },
    {
      $set: { isVerified: true, lastSeenAt: new Date() },
      $setOnInsert: { reputation: 80 },   // ★ අලුතෙන් හදනකොට විතරයි
    },
    { new: true, upsert: true }
  );

  return {
    user,
    accessToken: signAccessToken(user),
    refreshToken: signRefreshToken(user),
  };
}

async function refresh(refreshToken) {
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new ApiError(401, 'Invalid or expired refresh token', 'BAD_REFRESH');
  }

  const user = await User.findById(payload.sub);
  if (!user) throw new ApiError(401, 'Account not found', 'NO_USER');

  return { accessToken: signAccessToken(user) };
}

module.exports = { requestOtp, verifyOtp, refresh, normalizePhone };