const express = require('express');
const {
  login,
  resetCredentials,
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
} = require('../controllers/adminController');
const { requireAdmin } = require('../middleware/adminMiddleware');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

router.post('/login', asyncHandler(login));
// TEMPORARY ADMIN RESET ROUTE — remove after successful credential rotation.
router.post('/reset-credentials', asyncHandler(resetCredentials));
router.post('/logout', requireAdmin, asyncHandler(logout));
router.get('/stats', requireAdmin, asyncHandler(getStats));
router.get('/products', requireAdmin, asyncHandler(getProducts));
router.post('/products', requireAdmin, asyncHandler(createProduct));
router.put('/products/:id', requireAdmin, asyncHandler(updateProduct));
router.delete('/products/:id', requireAdmin, asyncHandler(deleteProduct));
router.get('/orders', requireAdmin, asyncHandler(getOrders));
router.patch('/orders/:id/status', requireAdmin, asyncHandler(updateOrderStatus));
router.get('/coupons', requireAdmin, asyncHandler(getCoupons));
router.post('/coupons', requireAdmin, asyncHandler(createCoupon));
router.put('/coupons/:id', requireAdmin, asyncHandler(updateCoupon));
router.delete('/coupons/:id', requireAdmin, asyncHandler(deleteCoupon));

module.exports = router;
