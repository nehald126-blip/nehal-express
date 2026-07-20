const express = require('express');
const {
  signup,
  login,
  getMe,
  updateProfile,
  changePassword,
  sendOtp,
  verifyEmailOtp,
  forgotPassword,
  resetPassword
} = require('../controllers/authController');

const { requireAuth } = require('../middleware/authMiddleware');
const {
  userLoginLimiter,
  otpSendLimiter,
  otpVerificationLimiter,
  passwordResetLimiter
} = require('../middleware/authRateLimiters');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

router.post('/signup', asyncHandler(signup));
router.post('/login', userLoginLimiter, asyncHandler(login));
router.get('/me', requireAuth, asyncHandler(getMe));
router.put('/profile', requireAuth, asyncHandler(updateProfile));
router.put('/password', requireAuth, asyncHandler(changePassword));

// OTP flows (email verification + password reset)
router.post('/send-otp', otpSendLimiter, asyncHandler(sendOtp));

router.post(
  '/verify-email-otp',
  otpVerificationLimiter,
  asyncHandler(verifyEmailOtp)
);

router.post(
  '/forgot-password',
  passwordResetLimiter,
  asyncHandler(forgotPassword)
);

router.post(
  '/reset-password',
  passwordResetLimiter,
  asyncHandler(resetPassword)
);

module.exports = router;
