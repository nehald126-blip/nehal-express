const bcrypt = require('bcryptjs');
const Admin = require('../models/Admin');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Coupon = require('../models/Coupon');
const User = require('../models/User');
const { createSession, destroySession } = require('../auth');
const { currency } = require('../utils/helpers');
const AppError = require('../utils/AppError');
const { sendOrderStatusEmailSafe } = require('../utils/orderStatusEmailService');


const VALID_STATUSES = Order.ORDER_STATUSES;
const DEFAULT_PRODUCT_IMAGE = 'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=800&q=80';

function toJsonList(docs) {
  return docs.map((doc) => doc.toJSON());
}

function adminProduct(product) {
  const p = product.toJSON ? product.toJSON() : product;
  return {
    id: p.id,
    name: p.name,
    category: p.category,
    price: p.price,
    mrp: p.mrp,
    stock: p.stock,
    sizes: p.sizes,
    colors: p.colors,
    rating: p.rating,
    reviews: p.reviews,
    description: p.description,
    images: p.images,
    tags: p.tags
  };
}

function splitList(value, fallback = []) {
  if (Array.isArray(value)) return value;
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .concat(value ? [] : fallback);
}

function validateCouponPayload(body, { partial = false } = {}) {
  const data = {};
  const has = (field) => body[field] !== undefined;
  const optionalNumber = (value, fieldName) => {
    if (value === '' || value == null) return null;
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0) throw new AppError(400, `${fieldName} must be 0 or greater`);
    return number;
  };

  if (!partial || has('code')) {
    const code = String(body.code || '').trim().toUpperCase();
    if (!code) throw new AppError(400, 'Coupon code is required');
    data.code = code;
  }
  if (!partial || has('type')) {
    if (!['percentage', 'fixed'].includes(body.type)) {
      throw new AppError(400, 'Coupon type must be percentage or fixed');
    }
    data.type = body.type;
  }
  if (!partial || has('value')) {
    const value = Number(body.value);
    if (!Number.isFinite(value) || value <= 0) throw new AppError(400, 'Coupon value must be greater than 0');
    data.value = value;
  }
  if (has('minOrderAmount') || !partial) {
    data.minOrderAmount = optionalNumber(body.minOrderAmount || 0, 'Minimum order amount') || 0;
  }
  if (has('maxDiscount') || !partial) {
    data.maxDiscount = optionalNumber(body.maxDiscount, 'Max discount');
  }
  if (has('expiryDate') || !partial) {
    data.expiryDate = body.expiryDate ? new Date(body.expiryDate) : null;
    if (data.expiryDate && Number.isNaN(data.expiryDate.getTime())) {
      throw new AppError(400, 'Invalid expiry date');
    }
  }
  if (has('isActive') || !partial) {
    data.isActive = body.isActive !== undefined ? Boolean(body.isActive) : true;
  }
  if (has('usageLimit') || !partial) {
    data.usageLimit = optionalNumber(body.usageLimit, 'Usage limit');
  }

  return data;
}

async function getNextProductId() {
  const products = await Product.find({ id: /^p\d+$/ }).select('id').lean();
  let maxNumber = 0;

  for (const product of products) {
    const number = Number.parseInt(product.id.slice(1), 10);
    if (number > maxNumber) maxNumber = number;
  }

  return `p${String(maxNumber + 1).padStart(3, '0')}`;
}

async function login(req, res) {
  const { username, password } = req.body;
  const normalizedUsername = String(username || '').trim().toLowerCase();
  const admin = await Admin.findOne({ username: normalizedUsername }).select('+passwordHash');
  if (!admin || !bcrypt.compareSync(password || '', admin.passwordHash)) {
    throw new AppError(401, 'Invalid username or password');
  }
  const token = createSession(admin.id);
  res.json({ token, name: admin.name, username: admin.username });
}

async function logout(req, res) {
  const header = req.headers.authorization || '';
  const token = header.slice(7);
  destroySession(token);
  res.json({ ok: true });
}

async function getStats(_req, res) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfWeek.getDate() - 6);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [products, orders, totalCustomers, coupons] = await Promise.all([
    Product.find().lean(),
    Order.find().sort({ createdAt: -1 }),
    User.countDocuments(),
    Coupon.find().lean()
  ]);
  const orderList = toJsonList(orders);
  const revenueOrders = orders.filter((o) => o.status !== 'Cancelled');
  const sumRevenue = (list) => currency(list.reduce((sum, order) => sum + Number(order.total || 0), 0));
  const ordersSince = (date) => orders.filter((order) => new Date(order.createdAt) >= date);
  const revenueSince = (date) => revenueOrders.filter((order) => new Date(order.createdAt) >= date);

  const paymentMethodBreakdown = orders.reduce((acc, order) => {
    acc[order.paymentMethod] = (acc[order.paymentMethod] || 0) + 1;
    return acc;
  }, {});

  const paymentStatusBreakdown = orders.reduce((acc, order) => {
    acc[order.paymentStatus] = (acc[order.paymentStatus] || 0) + 1;
    return acc;
  }, {});

  const soldByProduct = new Map();
  orders
    .filter((order) => order.status !== 'Cancelled')
    .forEach((order) => {
      order.items.forEach((item) => {
        const current = soldByProduct.get(item.productId) || {
          id: item.productId,
          name: item.name,
          qty: 0,
          revenue: 0
        };
        current.qty += Number(item.qty || 0);
        current.revenue += Number(item.lineTotal || 0);
        soldByProduct.set(item.productId, current);
      });
    });

  const bestSellingProducts = Array.from(soldByProduct.values())
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 6)
    .map((item) => ({
      ...item,
      revenue: currency(item.revenue)
    }));

  const lowStockProducts = products
    .filter((product) => product.stock > 0 && product.stock <= 5)
    .sort((a, b) => a.stock - b.stock)
    .slice(0, 8)
    .map((product) => ({
      id: product.id,
      name: product.name,
      stock: product.stock
    }));

  const outOfStockProducts = products
    .filter((product) => product.stock <= 0)
    .map((product) => ({
      id: product.id,
      name: product.name,
      stock: product.stock
    }));

  const recentPaidOrders = orderList
    .filter((order) => order.paymentStatus === 'Paid')
    .slice(0, 5);

  const totalDiscountGiven = currency(
    orders.reduce((sum, order) => sum + Number(order.discountAmount || 0), 0)
  );

  res.json({
    totalRevenue: sumRevenue(revenueOrders),
    todayRevenue: sumRevenue(revenueSince(startOfToday)),
    weekRevenue: sumRevenue(revenueSince(startOfWeek)),
    monthRevenue: sumRevenue(revenueSince(startOfMonth)),
    totalOrders: orders.length,
    todayOrders: ordersSince(startOfToday).length,
    pendingOrders: orders.filter((order) => order.status === 'Placed' || order.status === 'Packed').length,
    deliveredOrders: orders.filter((order) => order.status === 'Delivered').length,
    cancelledOrders: orders.filter((order) => order.status === 'Cancelled').length,
    totalProducts: products.length,
    lowStock: lowStockProducts.length,
    lowStockProducts,
    bestSellingProducts,
    outOfStockProducts,
    totalCustomers,
    paymentMethodBreakdown,
    paymentStatusBreakdown,
    activeCoupons: coupons.filter((coupon) => coupon.isActive).length,
    couponUsageCount: coupons.reduce((sum, coupon) => sum + Number(coupon.usedCount || 0), 0),
    totalDiscountGiven,
    recentOrders: orderList.slice(0, 5),
    recentPaidOrders
  });
}

async function getProducts(_req, res) {
  const products = await Product.find().sort({ createdAt: -1 });
  res.json(products.map(adminProduct));
}

async function createProduct(req, res) {
  const p = req.body;
  if (!p.name || !p.category || p.price == null) {
    throw new AppError(400, 'Name, category and price are required');
  }

  const product = await Product.create({
    id: await getNextProductId(),
    name: p.name,
    category: p.category,
    price: Number(p.price),
    mrp: Number(p.mrp || p.price),
    stock: Number(p.stock || 0),
    sizes: splitList(p.sizes, ['One Size']),
    colors: splitList(p.colors),
    rating: 0,
    reviews: 0,
    description: p.description || '',
    images: p.images && p.images.length ? p.images : [DEFAULT_PRODUCT_IMAGE],
    tags: Array.isArray(p.tags) ? p.tags : []
  });

  res.status(201).json(adminProduct(product));
}

async function updateProduct(req, res) {
  const product = await Product.findOne({ id: req.params.id });
  if (!product) {
    throw new AppError(404, 'Product not found');
  }
  const p = req.body;
  Object.assign(product, {
    name: p.name ?? product.name,
    category: p.category ?? product.category,
    price: p.price != null ? Number(p.price) : product.price,
    mrp: p.mrp != null ? Number(p.mrp) : product.mrp,
    stock: p.stock != null ? Number(p.stock) : product.stock,
    sizes: p.sizes ? splitList(p.sizes) : product.sizes,
    colors: p.colors ? splitList(p.colors) : product.colors,
    description: p.description ?? product.description,
    images: p.images && p.images.length ? p.images : product.images,
    tags: p.tags ? p.tags : product.tags
  });

  await product.save();
  res.json(adminProduct(product));
}

async function deleteProduct(req, res) {
  const product = await Product.findOneAndDelete({ id: req.params.id });
  if (!product) {
    throw new AppError(404, 'Product not found');
  }
  res.json({ ok: true });
}

async function getOrders(req, res) {
  const { status } = req.query;
  const query = {};
  if (status && status !== 'all') query.status = status;

  const orders = await Order.find(query).sort({ createdAt: -1 });
  res.json(toJsonList(orders));
}

async function updateOrderStatus(req, res) {
  const order = await Order.findOne({ id: req.params.id });
  if (!order) {
    throw new AppError(404, 'Order not found');
  }

  const { status } = req.body;
  if (!VALID_STATUSES.includes(status)) {
    throw new AppError(400, 'Invalid status');
  }

  const oldStatus = order.status;
  order.status = status;
  await order.save();

  const notifyStatuses = ['Packed', 'Shipped', 'Delivered', 'Cancelled'];
  if (oldStatus !== status && notifyStatuses.includes(status) && order.customer?.email) {
    // Best-effort notification: never break the admin status update.
    await sendOrderStatusEmailSafe(order, oldStatus, status);
  }

  res.json(order.toJSON());
}


async function getCoupons(_req, res) {
  const coupons = await Coupon.find().sort({ createdAt: -1 });
  res.json(toJsonList(coupons));
}

async function createCoupon(req, res) {
  try {
    const coupon = await Coupon.create(validateCouponPayload(req.body));
    res.status(201).json(coupon.toJSON());
  } catch (err) {
    if (err.code === 11000) throw new AppError(409, 'Coupon code already exists');
    if (err.statusCode) throw err;
    throw new AppError(500, 'Failed to create coupon');
  }
}

async function updateCoupon(req, res) {
  try {
    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) throw new AppError(404, 'Coupon not found');
    Object.assign(coupon, validateCouponPayload(req.body, { partial: true }));
    await coupon.save();
    res.json(coupon.toJSON());
  } catch (err) {
    if (err.code === 11000) throw new AppError(409, 'Coupon code already exists');
    if (err.statusCode) throw err;
    throw new AppError(500, 'Failed to update coupon');
  }
}

async function deleteCoupon(req, res) {
  const coupon = await Coupon.findByIdAndDelete(req.params.id);
  if (!coupon) throw new AppError(404, 'Coupon not found');
  res.json({ ok: true });
}

module.exports = {
  login,
  logout,
  getStats,
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  getOrders,
  updateOrderStatus,
  getCoupons,
  createCoupon,
  updateCoupon,
  deleteCoupon
};
