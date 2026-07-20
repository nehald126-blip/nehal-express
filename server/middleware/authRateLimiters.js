const { rateLimit } = require('express-rate-limit');

function createAuthLimiter({ windowMs, limit, message, skipSuccessfulRequests = false }) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests,
    handler: (_req, res) => res.status(429).json({ error: message })
  });
}

const userLoginLimiter = createAuthLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  message: 'Too many login attempts. Please try again later.'
});

const adminLoginLimiter = createAuthLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  skipSuccessfulRequests: true,
  message: 'Too many login attempts. Please try again later.'
});

const otpSendLimiter = createAuthLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  message: 'Too many OTP requests. Please try again later.'
});

const otpVerificationLimiter = createAuthLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  message: 'Too many OTP verification attempts. Please try again later.'
});

const passwordResetLimiter = createAuthLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  message: 'Too many password reset requests. Please try again later.'
});

module.exports = {
  userLoginLimiter,
  adminLoginLimiter,
  otpSendLimiter,
  otpVerificationLimiter,
  passwordResetLimiter
};
