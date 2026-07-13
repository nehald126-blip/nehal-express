const { getSession } = require('../auth');

function requireAdmin(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const session = token ? getSession(token) : null;
  if (!session) {
    return res.status(401).json({ error: 'Not authenticated. Please log in again.' });
  }
  req.adminId = session.adminId;
  next();
}

module.exports = { requireAdmin };
