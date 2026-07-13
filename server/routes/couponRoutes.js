const express = require('express');
const { validateCoupon } = require('../controllers/couponController');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

router.post('/validate', asyncHandler(validateCoupon));

module.exports = router;
