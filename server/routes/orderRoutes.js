const express = require('express');
const { createOrder, getCustomerOrders, getOrderById } = require('../controllers/orderController');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

router.post('/orders', asyncHandler(createOrder));
router.get('/customer/orders', asyncHandler(getCustomerOrders));
router.get('/orders/:id', asyncHandler(getOrderById));

module.exports = router;
