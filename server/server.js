const path = require('path');
require('dotenv').config({
  path: path.join(__dirname, '..', '.env')
});

const express = require('express');

const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorHandler');
const { verifyEmailTransporter } = require('./utils/emailService');

const categoryRoutes = require('./routes/categoryRoutes');
const productRoutes = require('./routes/productRoutes');
const orderRoutes = require('./routes/orderRoutes');
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const profileRoutes = require('./routes/profileRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const couponRoutes = require('./routes/couponRoutes');
const uploadRoutes = require('./routes/uploadRoutes');

const app = express();
const PORT = process.env.PORT || 4000;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const CACHEABLE_STATIC_EXTENSIONS = new Set([
  '.css', '.js', '.woff', '.woff2', '.ttf', '.otf',
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.svg', '.ico'
]);

function setStaticCacheHeaders(res, filePath) {
  const extension = path.extname(filePath).toLowerCase();
  const fileName = path.basename(filePath).toLowerCase();

  if (extension === '.html' || fileName === 'sw.js') {
    res.setHeader('Cache-Control', 'no-cache');
    return;
  }

  if (CACHEABLE_STATIC_EXTENSIONS.has(extension)) {
    res.setHeader('Cache-Control', 'public, max-age=86400');
  }
}

app.disable('x-powered-by');
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Permissions-Policy', 'camera=(), geolocation=(), microphone=()');
  next();
});
app.use(express.json());
// TODO: Enable response compression when an approved compression middleware dependency is available.
app.use(express.static(PUBLIC_DIR, { setHeaders: setStaticCacheHeaders }));

// ================= API ROUTES =================

app.use('/api/categories', categoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api', orderRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin', uploadRoutes);

// ================= FRONTEND PAGES =================

app.get('/profile', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(path.join(PUBLIC_DIR, 'profile.html'));
});

app.get('/admin', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(path.join(PUBLIC_DIR, 'admin.html'));
});

app.get('/', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

// ================= ERROR HANDLING =================

app.use(errorHandler);

async function startServer() {
  try {
    await connectDB();

    void verifyEmailTransporter();

    app.listen(PORT, () => {
      console.log(`Nehal Express server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Server startup failed:', error.message);
    process.exit(1);
  }
}

void startServer();
