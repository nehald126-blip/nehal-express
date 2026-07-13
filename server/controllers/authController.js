const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const {
  validateName,
  validateEmail,
  validatePhone,
  validatePassword
} = require('../utils/authValidation');

const { createAndStoreOtp, verifyOtp } = require('../utils/otpService');
const { sendOtpEmailSafe } = require('../utils/otpEmailService');

function signToken(userId) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new AppError(500, 'Authentication is not configured');
  }

  return jwt.sign({ userId: userId.toString() }, secret, { expiresIn: '7d' });
}

function formatUser(user) {
  const json = user.toJSON();
  json.id = json._id.toString();
  delete json._id;
  delete json.updatedAt;
  delete json.passwordHash;
  return json;
}

function isDuplicateKeyError(err) {
  return err && (err.code === 11000 || err.code === 11001);
}

function duplicateFieldMessage(err) {
  const field = Object.keys(err.keyPattern || {})[0];
  if (field === 'email') return 'Email is already registered';
  if (field === 'phone') return 'Phone number is already registered';
  return 'Account already exists';
}

async function assertUniqueEmailAndPhone({ email, phone, excludeUserId }) {
  const checks = [];

  if (email) {
    checks.push(
      User.findOne({ email, _id: { $ne: excludeUserId } }).then((existing) => {
        if (existing) throw new AppError(409, 'Email is already registered');
      })
    );
  }

  if (phone) {
    checks.push(
      User.findOne({ phone, _id: { $ne: excludeUserId } }).then((existing) => {
        if (existing) throw new AppError(409, 'Phone number is already registered');
      })
    );
  }

  await Promise.all(checks);
}

function safeEmailNormalize(email) {
  return validateEmail(email);
}

async function signup(req, res) {
  const { name, email, phone, password } = req.body;

  const normalizedName = validateName(name);
  const normalizedEmail = validateEmail(email);
  const normalizedPhone = validatePhone(phone);
  validatePassword(password);

  await assertUniqueEmailAndPhone({
    email: normalizedEmail,
    phone: normalizedPhone
  });

  try {
    const passwordHash = bcrypt.hashSync(String(password), 10);
    const user = await User.create({
      name: normalizedName,
      email: normalizedEmail,
      phone: normalizedPhone,
      passwordHash
    });

    const token = signToken(user._id);
    res.status(201).json({ token, user: formatUser(user) });
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      throw new AppError(409, duplicateFieldMessage(err));
    }
    if (err.statusCode) throw err;
    throw new AppError(500, 'Signup failed');
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body;

    const normalizedEmail = validateEmail(email);

    if (!password) {
      throw new AppError(400, 'Password is required');
    }

    const user = await User.findOne({ email: normalizedEmail }).select('+passwordHash');

    if (!user || !bcrypt.compareSync(String(password), user.passwordHash)) {
      throw new AppError(401, 'Invalid email or password');
    }

    const token = signToken(user._id);
    res.json({ token, user: formatUser(user) });
  } catch (err) {
    if (err.statusCode) throw err;
    throw new AppError(500, 'Login failed');
  }
}

async function getMe(req, res) {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      throw new AppError(404, 'User not found');
    }

    res.json({ user: formatUser(user) });
  } catch (err) {
    if (err.statusCode) throw err;
    throw new AppError(500, 'Failed to load profile');
  }
}

async function updateProfile(req, res) {
  try {
    const { name, email, phone } = req.body;
    const hasName = name !== undefined;
    const hasEmail = email !== undefined;
    const hasPhone = phone !== undefined;

    if (!hasName && !hasEmail && !hasPhone) {
      throw new AppError(400, 'At least one profile field is required');
    }

    const user = await User.findById(req.userId);
    if (!user) {
      throw new AppError(404, 'User not found');
    }

    const updates = {};

    if (hasName) {
      updates.name = validateName(name);
    }
    if (hasEmail) {
      updates.email = validateEmail(email);
    }
    if (hasPhone) {
      updates.phone = validatePhone(phone);
    }

    await assertUniqueEmailAndPhone({
      email: updates.email,
      phone: updates.phone,
      excludeUserId: user._id
    });

    Object.assign(user, updates);
    await user.save();

    res.json({ user: formatUser(user) });
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      throw new AppError(409, duplicateFieldMessage(err));
    }
    if (err.statusCode) throw err;
    throw new AppError(500, 'Failed to update profile');
  }
}

async function changePassword(req, res) {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword) {
      throw new AppError(400, 'Current password is required');
    }

    const validatedNewPassword = validatePassword(newPassword, { field: 'New password' });

    if (confirmPassword !== undefined && String(confirmPassword) !== validatedNewPassword) {
      throw new AppError(400, 'New password and confirmation do not match');
    }

    const user = await User.findById(req.userId).select('+passwordHash');
    if (!user) {
      throw new AppError(404, 'User not found');
    }

    if (!bcrypt.compareSync(String(currentPassword), user.passwordHash)) {
      throw new AppError(401, 'Current password is incorrect');
    }

    if (bcrypt.compareSync(validatedNewPassword, user.passwordHash)) {
      throw new AppError(400, 'New password must be different from current password');
    }

    user.passwordHash = bcrypt.hashSync(validatedNewPassword, 10);
    await user.save();

    res.json({ ok: true, message: 'Password changed successfully' });
  } catch (err) {
    if (err.statusCode) throw err;
    throw new AppError(500, 'Failed to change password');
  }
}

// ================= OTP =================

async function sendOtp(req, res) {
  const { email, type } = req.body || {};
  const normalizedEmail = safeEmailNormalize(email);
  const otpType = String(type || '').toUpperCase();
  const isEmailVerification = otpType === 'EMAIL_VERIFY';

  const user = await User.findOne({ email: normalizedEmail }).select('_id');

  if (isEmailVerification && user) {
    throw new AppError(409, 'Email is already registered');
  }

  const { otp, otpId } = await createAndStoreOtp({
    email: normalizedEmail,
    userId: user ? user._id : null,
    type: otpType,
    ipAddress: req.ip || null
  });

  const purposeForEmail =
    isEmailVerification
      ? 'email verification'
      : otpType === 'FORGOT_PASSWORD'
        ? 'password reset'
        : 'password reset';

  const shouldSendEmail = isEmailVerification || Boolean(user);
  const sendResult = shouldSendEmail
    ? await sendOtpEmailSafe({ toEmail: normalizedEmail, otp, purpose: purposeForEmail })
    : { sent: false, skipped: true };

  if (shouldSendEmail && !sendResult?.sent) {
    throw new AppError(500, 'OTP email could not be sent. Please try again later.');
  }

  res.json({ ok: true, otpId, sent: Boolean(sendResult?.sent) });
}

async function verifyEmailOtp(req, res) {
  const { email, otp } = req.body || {};
  const normalizedEmail = safeEmailNormalize(email);

  await verifyOtp({
    email: normalizedEmail,
    type: 'EMAIL_VERIFY',
    otp
  });

  // Current User schema has no persistent email verification field.
  // Endpoint validates OTP without breaking existing auth/signup flows.
  res.json({ ok: true });
}

async function forgotPassword(req, res) {
  const { email } = req.body || {};
  const normalizedEmail = safeEmailNormalize(email);

  const user = await User.findOne({ email: normalizedEmail }).select('_id');

  // Never reveal whether email exists.
  if (!user) {
    return res.json({ ok: true });
  }

  const { otp } = await createAndStoreOtp({
    email: normalizedEmail,
    userId: user._id,
    type: 'RESET_PASSWORD',
    ipAddress: req.ip || null
  });

  await sendOtpEmailSafe({
    toEmail: normalizedEmail,
    otp,
    purpose: 'password reset'
  });

  res.json({ ok: true });
}

async function resetPassword(req, res) {
  const { email, otp, newPassword } = req.body || {};
  const normalizedEmail = safeEmailNormalize(email);

  const validatedNewPassword = validatePassword(newPassword, { field: 'New password' });

  await verifyOtp({
    email: normalizedEmail,
    type: 'RESET_PASSWORD',
    otp
  });

  const user = await User.findOne({ email: normalizedEmail }).select('+passwordHash');
  if (!user) throw new AppError(404, 'User not found');

  user.passwordHash = bcrypt.hashSync(validatedNewPassword, 10);
  await user.save();

  res.json({ ok: true });
}

module.exports = {
  signup,
  login,
  getMe,
  updateProfile,
  changePassword,
  sendOtp,
  verifyEmailOtp,
  forgotPassword,
  resetPassword
};
