const express = require('express');
const { getCategories } = require('../controllers/categoryController');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

router.get('/', asyncHandler(getCategories));

module.exports = router;
