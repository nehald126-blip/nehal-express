const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const Otp = require('../models/Otp');
const AppError = require('./../utils/AppError');

function isValidOtpType(type) {
  return Otp.OTP_TYPES.includes(type);
}

function generateOtp6Digits() {
  // 000000-999999 allowed; pad to 6 digits
  const n = crypto.randomInt(0, 1000000);
  return String(n).padStart(6, '0');
}

async function hashOtp(otp) {
  // bcrypt is already in dependencies; use it for OTP hashing
  const saltRounds = 10;
  return bcrypt.hash(String(otp), saltRounds);
}

async function compareOtp(otp, hashedOtp) {
  // bcrypt.compareSync/async both ok; use async for non-blocking
  return bcrypt.compare(String(otp), hashedOtp);
}

function now() {
  return new Date();
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

async function enforceOtpRateLimit({ email, type, maxRequestsPerHour = 5, minResendIntervalSec = 30 }) {
  // Simple rate limiting based on OTP record history.
  const cutoff = new Date(Date.now() - 60 * 60 * 1000);
  const recent = await Otp.countDocuments({ email, type, lastRequestedAt: { $gte: cutoff } });

  if (recent >= maxRequestsPerHour) {
    throw new AppError(429, 'Too many OTP requests. Please try again later.');
  }

  const latest = await Otp.findOne({ email, type }).sort({ lastRequestedAt: -1 });
  if (latest && latest.lastRequestedAt) {
    const elapsedSec = (Date.now() - latest.lastRequestedAt.getTime()) / 1000;
    if (elapsedSec < minResendIntervalSec) {
      throw new AppError(429, `OTP already sent. Please wait ${Math.ceil(minResendIntervalSec - elapsedSec)} seconds.`);
    }
  }
}

async function createAndStoreOtp({ email, userId = null, type, ipAddress = null }) {
  if (!email) throw new AppError(400, 'Email is required');
  if (!isValidOtpType(type)) throw new AppError(400, 'Invalid OTP type');

  // rate limiting
  await enforceOtpRateLimit({ email, type });

  const otp = generateOtp6Digits();
  const hashedOtp = await hashOtp(otp);

  const createdAt = now();
  const expiresAt = addMinutes(createdAt, 10);

  // We keep history but mark old OTPs logically expired by expiresAt naturally.
  // Create a new OTP record for each send.
  const doc = await Otp.create({
    email,
    userId,
    type,
    hashedOtp,
    expiresAt,
    requestCount: 1,
    lastRequestedAt: createdAt,
    ipAddress
  });

  return { otp, otpId: doc._id.toString() };
}

async function verifyOtp({ email, type, otp }) {
  if (!email) throw new AppError(400, 'Email is required');
  if (!isValidOtpType(type)) throw new AppError(400, 'Invalid OTP type');
  const normalizedOtp = String(otp ?? '').trim();
  if (!/^\d{6}$/.test(normalizedOtp)) throw new AppError(400, 'OTP must be a 6-digit number');

  const record = await Otp.findOne({ email, type }).sort({ expiresAt: -1, createdAt: -1 });
  if (!record) {
    throw new AppError(400, 'Invalid or expired OTP');
  }

  // Attempt count based on requestCount
  if (record.isExpired()) {
    throw new AppError(400, 'Invalid or expired OTP');
  }
  if (record.isUsed()) {
    throw new AppError(400, 'OTP already used');
  }

  const match = await compareOtp(normalizedOtp, record.hashedOtp);
  if (!match) {
    // increment requestCount as attempts proxy
    record.requestCount = (record.requestCount || 0) + 1;
    await record.save();
    throw new AppError(400, 'Invalid or expired OTP');
  }

  record.usedAt = new Date();
  await record.save();

  return record;
}

module.exports = {
  generateOtp6Digits,
  hashOtp,
  compareOtp,
  createAndStoreOtp,
  verifyOtp
};

