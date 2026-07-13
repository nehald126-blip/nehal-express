const crypto = require('crypto');
const mongoose = require('mongoose');
const Razorpay = require('razorpay');
const Product = require('../models/Product');
const Order = require('../models/Order');
const AppError = require('../utils/AppError');
const {
  getNextOrderId,
  calcOrderTotals,
  validateCouponForSubtotal,
  incrementCouponUsage
} = require('../utils/orderHelpers');
const { finalizeOrderConfirmation } = require('../utils/orderConfirmationService');

function getRazorpayClient() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    throw new AppError(500, 'Online payments are not configured');
  }

  return new Razorpay({
    key_id: keyId,
    key_secret: keySecret
  });
}

function validateCheckoutPayload({ items, customer }) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new AppError(400, 'Cart is empty');
  }
  if (!customer || !customer.name || !customer.phone || !customer.address || !customer.pincode) {
    throw new AppError(400, 'Missing required customer details');
  }
}

async function createRazorpayOrder(req, res) {
  const { items, customer, couponCode } = req.body;
  validateCheckoutPayload({ items, customer });

  const client = getRazorpayClient();
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const productIds = [...new Set(items.map((item) => item.productId))];
    const products = await Product.find({ id: { $in: productIds } }).session(session);
    const productList = products.map((product) => product.toJSON());
    const baseTotals = calcOrderTotals(items, productList);
    const couponResult = await validateCouponForSubtotal(couponCode, baseTotals.subtotal);
    const { lineItems, subtotal, shipping, discountAmount, total } = calcOrderTotals(
      items,
      productList,
      couponResult.discountAmount
    );

    for (const li of lineItems) {
      const updated = await Product.findOneAndUpdate(
        { id: li.productId, stock: { $gte: li.qty } },
        { $inc: { stock: -li.qty } },
        { session, new: true }
      );
      if (!updated) {
        const product = productList.find((p) => p.id === li.productId);
        throw new Error(`${product?.name || li.productId} has insufficient stock`);
      }
    }

    const orderId = await getNextOrderId(session);
    const razorpayOrder = await client.orders.create({
      amount: Math.round(total * 100),
      currency: 'INR',
      receipt: orderId,
      notes: {
        nehalOrderId: orderId,
        customerPhone: String(customer.phone)
      }
    });

    const [order] = await Order.create(
      [
        {
          id: orderId,
          items: lineItems,
          customer: {
            name: customer.name,
            phone: customer.phone,
            email: customer.email || '',
            address: customer.address,
            pincode: customer.pincode,
            city: customer.city || '',
            state: customer.state || ''
          },
          paymentMethod: 'Razorpay',
          paymentStatus: 'Pending',
          razorpayOrderId: razorpayOrder.id,
          couponCode: couponResult.couponCode,
          discountAmount,
          subtotal,
          shipping,
          total,
          status: 'Placed'
        }
      ],
      { session }
    );

    await session.commitTransaction();

    res.status(201).json({
      keyId: process.env.RAZORPAY_KEY_ID,
      razorpayOrder: {
        id: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency
      },
      order: order.toJSON()
    });
  } catch (err) {
    await session.abortTransaction();
    if (err.statusCode) throw err;
    throw new AppError(400, err.message || 'Failed to create payment order');
  } finally {
    session.endSession();
  }
}

async function verifyPayment(req, res) {
  const {
    razorpay_order_id: razorpayOrderId,
    razorpay_payment_id: razorpayPaymentId,
    razorpay_signature: razorpaySignature
  } = req.body;

  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    throw new AppError(400, 'Missing payment verification details');
  }

  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keySecret) {
    throw new AppError(500, 'Online payments are not configured');
  }

  const expectedSignature = crypto
    .createHmac('sha256', keySecret)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest('hex');

  if (
    expectedSignature.length !== razorpaySignature.length ||
    !crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(razorpaySignature))
  ) {
    const failedOrder = await Order.findOne({ razorpayOrderId });
    if (failedOrder) {
      failedOrder.paymentStatus = 'Failed';
      await failedOrder.save();
    }
    throw new AppError(400, 'Payment verification failed');
  }

  const order = await Order.findOne({ razorpayOrderId });
  if (!order) {
    throw new AppError(404, 'Order not found for this payment');
  }

  const wasAlreadyPaid = order.paymentStatus === 'Paid';
  order.paymentStatus = 'Paid';
  order.razorpayPaymentId = razorpayPaymentId;
  order.razorpaySignature = razorpaySignature;
  order.paidAt = order.paidAt || new Date();
  await order.save();
  if (order.couponCode && !wasAlreadyPaid) {
    await incrementCouponUsage(order.couponCode);
  }
  await finalizeOrderConfirmation(order, { customerEmail: order.customer?.email });

  res.json(order.toJSON());
}

module.exports = {
  createRazorpayOrder,
  verifyPayment
};
