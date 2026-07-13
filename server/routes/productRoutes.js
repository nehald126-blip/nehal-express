const express = require('express');
const {
  getProducts,
  getProductById,
  getProductReviews,
  createProductReview,
  deleteProductReview
} = require('../controllers/productController');
const { requireAuth, optionalAuth } = require('../middleware/authMiddleware');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

router.get('/', asyncHandler(getProducts));
router.get('/:id/reviews', optionalAuth, asyncHandler(getProductReviews));
router.post('/:id/reviews', requireAuth, asyncHandler(createProductReview));
router.delete('/:id/reviews/:reviewId', requireAuth, asyncHandler(deleteProductReview));
router.get('/:id', asyncHandler(getProductById));

module.exports = router;
