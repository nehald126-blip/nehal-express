const mongoose = require('mongoose');
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

async function createOrder(req, res) {
  const { items, customer, couponCode } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    throw new AppError(400, 'Cart is empty');
  }
  if (!customer || !customer.name || !customer.phone || !customer.address || !customer.pincode) {
    throw new AppError(400, 'Missing required customer details');
  }

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
          paymentMethod: customer.paymentMethod === 'upi' ? 'UPI' : 'COD',
          paymentStatus: 'Pending',
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

    if (couponResult.couponCode) {
      await incrementCouponUsage(couponResult.couponCode, session);
    }

    await session.commitTransaction();
    order.$session(null);
    await finalizeOrderConfirmation(order, { customerEmail: customer.email });
    res.status(201).json(order.toJSON());
  } catch (err) {
    await session.abortTransaction();
    if (err.statusCode) throw err;
    throw new AppError(400, err.message);
  } finally {
    session.endSession();
  }
}

async function getCustomerOrders(req, res) {
  const { phone } = req.query;

  if (!phone) {
    throw new AppError(400, 'Phone number is required');
  }

  try {
    const orders = await Order.find({ 'customer.phone': phone }).sort({ createdAt: -1 });
    res.json(orders.map((order) => order.toJSON()));
  } catch (_err) {
    throw new AppError(500, 'Failed to load orders');
  }
}

async function getOrderById(req, res) {
  try {
    const order = await Order.findOne({ id: req.params.id });
    if (!order) {
      throw new AppError(404, 'Order not found');
    }

    const { phone } = req.query;
    if (!phone || phone !== order.customer.phone) {
      throw new AppError(403, 'Enter the phone number used at checkout to track this order');
    }

    res.json(order.toJSON());
  } catch (err) {
    if (err.statusCode) throw err;
    throw new AppError(500, 'Failed to load order');
  }
}

module.exports = { createOrder, getCustomerOrders, getOrderById };
