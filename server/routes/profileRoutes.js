const express = require('express');
const {
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
} = require('../controllers/profileController');
const { requireAuth } = require('../middleware/authMiddleware');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

router.use(requireAuth);

router.get('/', asyncHandler(getProfile));
router.put('/', asyncHandler(updateProfile));
router.delete('/', asyncHandler(deleteAccount));
router.get('/orders', asyncHandler(getOrders));
router.get('/orders/:id/invoice', asyncHandler(getOrderInvoice));
router.get('/orders/:id', asyncHandler(getOrderById));
router.get('/wishlist', asyncHandler(getWishlist));
router.post('/wishlist/:productId', asyncHandler(addWishlistItem));
router.delete('/wishlist/:productId', asyncHandler(removeWishlistItem));
router.get('/addresses', asyncHandler(getAddresses));
router.post('/addresses', asyncHandler(createAddress));
router.put('/addresses/:id', asyncHandler(updateAddress));
router.delete('/addresses/:id', asyncHandler(deleteAddress));

module.exports = router;
