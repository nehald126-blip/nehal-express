const crypto = require('crypto');

// In-memory session store: token -> { adminId, expiresAt }
const sessions = new Map();
const TOKEN_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

function createSession(adminId) {
  const token = crypto.randomBytes(24).toString('hex');
  sessions.set(token, { adminId, expiresAt: Date.now() + TOKEN_TTL_MS });
  return token;
}

function getSession(token) {
  const session = sessions.get(token);
  if (!session) return null;
  if (session.expiresAt < Date.now()) {
    sessions.delete(token);
    return null;
  }
  return session;
}

function destroySession(token) {
  sessions.delete(token);
}

module.exports = { createSession, getSession, destroySession };
