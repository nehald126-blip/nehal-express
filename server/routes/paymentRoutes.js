const express = require('express');
const {
  createRazorpayOrder,
  verifyPayment
} = require('../controllers/paymentController');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

router.post('/create-order', asyncHandler(createRazorpayOrder));
router.post('/verify', asyncHandler(verifyPayment));

module.exports = router;
