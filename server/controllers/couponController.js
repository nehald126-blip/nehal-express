const AppError = require('../utils/AppError');
const { validateCouponForSubtotal } = require('../utils/orderHelpers');

async function validateCoupon(req, res) {
  try {
    const subtotal = Number(req.body.subtotal || 0);
    const code = req.body.code;
    if (!code) throw new AppError(400, 'Coupon code is required');
    if (!Number.isFinite(subtotal) || subtotal < 0) {
      throw new AppError(400, 'Valid subtotal is required');
    }

    const result = await validateCouponForSubtotal(code, subtotal);
    res.json({
      code: result.couponCode,
      discountAmount: result.discountAmount,
      type: result.coupon?.type,
      value: result.coupon?.value,
      maxDiscount: result.coupon?.maxDiscount || null
    });
  } catch (err) {
    if (err.statusCode) throw err;
    throw new AppError(400, err.message || 'Invalid coupon');
  }
}

module.exports = { validateCoupon };
