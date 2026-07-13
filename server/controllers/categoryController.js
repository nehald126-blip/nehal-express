const Category = require('../models/Category');
const AppError = require('../utils/AppError');

async function getCategories(_req, res) {
  try {
    const categories = await Category.find().sort({ _id: 1 });
    res.json(categories.map((category) => category.toJSON()));
  } catch (_err) {
    throw new AppError(500, 'Failed to load categories');
  }
}

module.exports = { getCategories };
