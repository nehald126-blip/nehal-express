const Order = require('../models/Order');
const Coupon = require('../models/Coupon');
const { currency } = require('./helpers');

async function getNextOrderId(session) {
  const query = Order.find({ id: /^NE\d+$/ }).select('id');
  const orders = session ? await query.session(session).lean() : await query.lean();
  let maxNumber = 1000;

  for (const order of orders) {
    const number = Number.parseInt(order.id.slice(2), 10);
    if (number > maxNumber) maxNumber = number;
  }

  return `NE${maxNumber + 1}`;
}

function normalizeCouponCode(code) {
  return String(code || '').trim().toUpperCase();
}

function calculateDiscount(coupon, subtotal) {
  if (!coupon) return 0;
  const rawDiscount = coupon.type === 'percentage'
    ? (subtotal * coupon.value) / 100
    : coupon.value;
  const cappedDiscount = coupon.maxDiscount != null
    ? Math.min(rawDiscount, coupon.maxDiscount)
    : rawDiscount;
  return currency(Math.min(Math.max(cappedDiscount, 0), subtotal));
}

async function validateCouponForSubtotal(code, subtotal) {
  const normalizedCode = normalizeCouponCode(code);
  if (!normalizedCode) {
    return { coupon: null, couponCode: null, discountAmount: 0 };
  }

  const coupon = await Coupon.findOne({ code: normalizedCode });
  if (!coupon) throw new Error('Coupon not found');
  if (!coupon.isActive) throw new Error('Coupon is not active');
  if (coupon.expiryDate && coupon.expiryDate < new Date()) throw new Error('Coupon has expired');
  if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) {
    throw new Error('Coupon usage limit reached');
  }
  if (subtotal < coupon.minOrderAmount) {
    throw new Error(`Minimum order amount for this coupon is ${coupon.minOrderAmount}`);
  }

  return {
    coupon,
    couponCode: coupon.code,
    discountAmount: calculateDiscount(coupon, subtotal)
  };
}

async function incrementCouponUsage(couponCode, session) {
  const normalizedCode = normalizeCouponCode(couponCode);
  if (!normalizedCode) return;

  const query = Coupon.findOneAndUpdate(
    {
      code: normalizedCode,
      $or: [
        { usageLimit: null },
        { $expr: { $lt: ['$usedCount', '$usageLimit'] } }
      ]
    },
    { $inc: { usedCount: 1 } },
    { new: true }
  );
  const updated = session ? await query.session(session) : await query;
  if (!updated) throw new Error('Coupon usage limit reached');
}

function calcOrderTotals(items, allProducts, discountAmount = 0) {
  let subtotal = 0;
  const lineItems = [];
  for (const item of items) {
    const product = allProducts.find((p) => p.id === item.productId);
    if (!product) throw new Error(`Product ${item.productId} not found`);
    if (item.qty < 1) throw new Error('Quantity must be at least 1');
    if (product.stock < item.qty) {
      throw new Error(`${product.name} has only ${product.stock} in stock`);
    }
    const lineTotal = product.price * item.qty;
    subtotal += lineTotal;
    lineItems.push({
      productId: product.id,
      name: product.name,
      price: product.price,
      qty: item.qty,
      size: item.size || null,
      color: item.color || null,
      lineTotal
    });
  }
  const shipping = subtotal >= 1499 || subtotal === 0 ? 0 : 79;
  const normalizedDiscount = currency(Math.min(Math.max(Number(discountAmount || 0), 0), subtotal));
  const total = currency(subtotal + shipping - normalizedDiscount);
  return { lineItems, subtotal: currency(subtotal), shipping, discountAmount: normalizedDiscount, total };
}

module.exports = {
  getNextOrderId,
  calcOrderTotals,
  validateCouponForSubtotal,
  incrementCouponUsage,
  normalizeCouponCode
};
