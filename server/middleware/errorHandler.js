function errorHandler(err, req, res, _next) {
  const statusCode = err.statusCode || 500;
  const isProduction = process.env.NODE_ENV === 'production';
  const message = isProduction && statusCode >= 500
    ? 'Internal server error'
    : err.message || 'Internal server error';

  if (statusCode >= 500) {
    console.error(isProduction ? err.message : err.stack || err);
  }

  res.status(statusCode).json({ error: message });
}

module.exports = errorHandler;
