const AppError = require('./AppError');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\d{10}$/;
const NAME_MAX_LENGTH = 100;

function normalizeEmail(email) {
  return String(email).trim().toLowerCase();
}

function normalizePhone(phone) {
  return String(phone).trim();
}

function validateName(name, { required = true } = {}) {
  if (name === undefined || name === null || name === '') {
    if (required) throw new AppError(400, 'Name is required');
    return null;
  }

  const trimmed = String(name).trim();
  if (!trimmed) throw new AppError(400, 'Name is required');
  if (trimmed.length > NAME_MAX_LENGTH) {
    throw new AppError(400, `Name must be at most ${NAME_MAX_LENGTH} characters`);
  }
  return trimmed;
}

function validateEmail(email, { required = true } = {}) {
  if (email === undefined || email === null || email === '') {
    if (required) throw new AppError(400, 'Email is required');
    return null;
  }

  const normalized = normalizeEmail(email);
  if (!EMAIL_REGEX.test(normalized)) {
    throw new AppError(400, 'Invalid email address');
  }
  return normalized;
}

function validatePhone(phone, { required = true } = {}) {
  if (phone === undefined || phone === null || phone === '') {
    if (required) throw new AppError(400, 'Phone number is required');
    return null;
  }

  const normalized = normalizePhone(phone);
  if (!PHONE_REGEX.test(normalized)) {
    throw new AppError(400, 'Phone number must be 10 digits');
  }
  return normalized;
}

function validatePassword(password, { field = 'Password', minLength = 6 } = {}) {
  if (!password || String(password).length < minLength) {
    throw new AppError(400, `${field} must be at least ${minLength} characters`);
  }
  return String(password);
}

module.exports = {
  EMAIL_REGEX,
  PHONE_REGEX,
  NAME_MAX_LENGTH,
  normalizeEmail,
  normalizePhone,
  validateName,
  validateEmail,
  validatePhone,
  validatePassword
};
