const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Order = require('../models/Order');
const Product = require('../models/Product');
const AppError = require('../utils/AppError');
const { formatUser, formatAddress } = require('../utils/userFormatter');
const { generateInvoicePdf } = require('../utils/invoiceService');
const { publicProduct } = require('../utils/helpers');
const {
  validateName,
  validateEmail,
  validatePhone,
  validatePassword
} = require('../utils/authValidation');

const PINCODE_REGEX = /^\d{6}$/;

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

async function findUserOrThrow(userId) {
  const user = await User.findById(userId);
  if (!user) throw new AppError(404, 'User not found');
  return user;
}

function validateAddressInput(body, { partial = false } = {}) {
  const data = {};

  if (!partial || body.label !== undefined) {
    data.label = body.label ? String(body.label).trim() || 'Home' : 'Home';
  }
  if (!partial || body.name !== undefined) {
    if (!body.name || !String(body.name).trim()) {
      throw new AppError(400, 'Recipient name is required');
    }
    data.name = String(body.name).trim();
  }
  if (!partial || body.phone !== undefined) {
    data.phone = validatePhone(body.phone);
  }
  if (!partial || body.address !== undefined) {
    if (!body.address || !String(body.address).trim()) {
      throw new AppError(400, 'Address is required');
    }
    data.address = String(body.address).trim();
  }
  if (!partial || body.pincode !== undefined) {
    const pincode = String(body.pincode || '').trim();
    if (!PINCODE_REGEX.test(pincode)) {
      throw new AppError(400, 'Pincode must be 6 digits');
    }
    data.pincode = pincode;
  }
  if (!partial || body.city !== undefined) {
    data.city = body.city ? String(body.city).trim() : '';
  }
  if (!partial || body.state !== undefined) {
    data.state = body.state ? String(body.state).trim() : '';
  }
  if (!partial || body.isDefault !== undefined) {
    data.isDefault = Boolean(body.isDefault);
  }

  return data;
}

function findAddressOrThrow(user, addressId) {
  if (!mongoose.Types.ObjectId.isValid(addressId)) {
    throw new AppError(404, 'Address not found');
  }

  const address = user.addresses.id(addressId);
  if (!address) throw new AppError(404, 'Address not found');
  return address;
}

function clearDefaultAddresses(user) {
  user.addresses.forEach((addr) => {
    addr.isDefault = false;
  });
}

async function getWishlistProducts(user) {
  const wishlistIds = [...new Set((user.wishlist || []).map(String))];
  if (!wishlistIds.length) return [];

  const products = await Product.find({ id: { $in: wishlistIds } });
  const byId = new Map(products.map((product) => [product.id, publicProduct(product.toJSON())]));
  return wishlistIds.map((id) => byId.get(id)).filter(Boolean);
}

async function getProfile(req, res) {
  try {
    const user = await findUserOrThrow(req.userId);
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

    const user = await findUserOrThrow(req.userId);
    const updates = {};

    if (hasName) updates.name = validateName(name);
    if (hasEmail) updates.email = validateEmail(email);
    if (hasPhone) updates.phone = validatePhone(phone);

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

async function getOrders(req, res) {
  try {
    const user = await findUserOrThrow(req.userId);
    const orders = await Order.find({ 'customer.phone': user.phone }).sort({ createdAt: -1 });
    res.json({ orders: orders.map(formatProfileOrder) });
  } catch (err) {
    if (err.statusCode) throw err;
    throw new AppError(500, 'Failed to load orders');
  }
}

function formatProfileOrder(order) {
  const data = order.toJSON();
  return {
    id: data.id,
    orderId: data.id,
    items: data.items || [],
    customer: data.customer || {},
    paymentMethod: data.paymentMethod,
    paymentStatus: data.paymentStatus,
    invoiceNumber: data.invoiceNumber || null,
    invoiceGeneratedAt: data.invoiceGeneratedAt || null,
    status: data.status,
    orderStatus: data.status,
    subtotal: data.subtotal,
    shipping: data.shipping,
    couponCode: data.couponCode || null,
    discountAmount: data.discountAmount || 0,
    total: data.total,
    createdAt: data.createdAt,
    paidAt: data.paidAt instanceof Date ? data.paidAt.toISOString() : data.paidAt || null
  };
}

async function getOrderById(req, res) {
  try {
    const user = await findUserOrThrow(req.userId);
    const order = await Order.findOne({
      id: req.params.id,
      'customer.phone': user.phone
    });

    if (!order) {
      throw new AppError(404, 'Order not found');
    }

    res.json({ order: formatProfileOrder(order) });
  } catch (err) {
    if (err.statusCode) throw err;
    throw new AppError(500, 'Failed to load order');
  }
}

async function getOrderInvoice(req, res) {
  try {
    const user = await findUserOrThrow(req.userId);
    const order = await Order.findOne({
      id: req.params.id,
      'customer.phone': user.phone
    });

    if (!order) {
      throw new AppError(404, 'Order not found');
    }

    const pdf = await generateInvoicePdf(order);
    const invoiceNumber = order.invoiceNumber || order.id;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${invoiceNumber}.pdf"`);
    res.send(pdf);
  } catch (err) {
    if (err.statusCode) throw err;
    throw new AppError(500, 'Failed to generate invoice');
  }
}

async function getWishlist(req, res) {
  try {
    const user = await findUserOrThrow(req.userId);
    const products = await getWishlistProducts(user);
    res.json({ wishlist: products });
  } catch (err) {
    if (err.statusCode) throw err;
    throw new AppError(500, 'Failed to load wishlist');
  }
}

async function addWishlistItem(req, res) {
  try {
    const productId = String(req.params.productId || '').trim();
    const product = await Product.findOne({ id: productId });
    if (!product) {
      throw new AppError(404, 'Product not found');
    }

    const user = await User.findByIdAndUpdate(
      req.userId,
      { $addToSet: { wishlist: productId } },
      { new: true }
    );
    if (!user) throw new AppError(404, 'User not found');

    const products = await getWishlistProducts(user);
    res.json({ wishlist: products });
  } catch (err) {
    if (err.statusCode) throw err;
    throw new AppError(500, 'Failed to update wishlist');
  }
}

async function removeWishlistItem(req, res) {
  try {
    const productId = String(req.params.productId || '').trim();
    const user = await User.findByIdAndUpdate(
      req.userId,
      { $pull: { wishlist: productId } },
      { new: true }
    );
    if (!user) throw new AppError(404, 'User not found');

    const products = await getWishlistProducts(user);
    res.json({ wishlist: products });
  } catch (err) {
    if (err.statusCode) throw err;
    throw new AppError(500, 'Failed to update wishlist');
  }
}

async function getAddresses(req, res) {
  try {
    const user = await findUserOrThrow(req.userId);
    res.json({ addresses: user.addresses.map(formatAddress) });
  } catch (err) {
    if (err.statusCode) throw err;
    throw new AppError(500, 'Failed to load addresses');
  }
}

async function createAddress(req, res) {
  try {
    const user = await findUserOrThrow(req.userId);
    const data = validateAddressInput(req.body);

    if (data.isDefault || user.addresses.length === 0) {
      clearDefaultAddresses(user);
      data.isDefault = true;
    }

    user.addresses.push(data);
    await user.save();

    const created = user.addresses[user.addresses.length - 1];
    res.status(201).json({ address: formatAddress(created) });
  } catch (err) {
    if (err.statusCode) throw err;
    throw new AppError(500, 'Failed to add address');
  }
}

async function updateAddress(req, res) {
  try {
    const user = await findUserOrThrow(req.userId);
    const address = findAddressOrThrow(user, req.params.id);
    const data = validateAddressInput(req.body, { partial: true });

    if (data.isDefault) {
      clearDefaultAddresses(user);
    }

    Object.assign(address, data);
    await user.save();

    res.json({ address: formatAddress(address) });
  } catch (err) {
    if (err.statusCode) throw err;
    throw new AppError(500, 'Failed to update address');
  }
}

async function deleteAddress(req, res) {
  try {
    const user = await findUserOrThrow(req.userId);
    const address = findAddressOrThrow(user, req.params.id);
    const wasDefault = address.isDefault;

    address.deleteOne();
    await user.save();

    if (wasDefault && user.addresses.length > 0) {
      user.addresses[0].isDefault = true;
      await user.save();
    }

    res.json({ ok: true });
  } catch (err) {
    if (err.statusCode) throw err;
    throw new AppError(500, 'Failed to delete address');
  }
}

async function deleteAccount(req, res) {
  try {
    const { password, confirmText } = req.body || {};
    const user = await User.findById(req.userId).select('+passwordHash');

    if (!user) throw new AppError(404, 'User not found');
    if (String(confirmText || '').trim().toUpperCase() !== 'DELETE') {
      throw new AppError(400, 'Please type DELETE to confirm account deletion');
    }
    if (!password || !bcrypt.compareSync(String(password), user.passwordHash)) {
      throw new AppError(401, 'Current password is incorrect');
    }

    await User.deleteOne({ _id: user._id });
    res.json({ ok: true, message: 'Account deleted successfully' });
  } catch (err) {
    if (err.statusCode) throw err;
    throw new AppError(500, 'Failed to delete account');
  }
}

module.exports = {
  getProfile,
  updateProfile,
  getOrders,
  getOrderById,
  getOrderInvoice,
  getWishlist,
  addWishlistItem,
  removeWishlistItem,
  getAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
  deleteAccount
};
