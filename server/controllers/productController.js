const Product = require('../models/Product');
const mongoose = require('mongoose');
const Review = require('../models/Review');
const User = require('../models/User');
const Order = require('../models/Order');
const AppError = require('../utils/AppError');
const { publicProduct } = require('../utils/helpers');
const { buildProductQuery, getProductSort, applyNewSort } = require('../utils/productHelpers');

function formatReview(review, currentUserId) {
  const data = review.toJSON();
  data.canDelete = currentUserId ? String(review.userId) === String(currentUserId) : false;
  return data;
}

async function recalculateProductReviewStats(productId) {
  const reviews = await Review.find({ productId });
  const count = reviews.length;
  const average = count
    ? reviews.reduce((sum, review) => sum + review.rating, 0) / count
    : 0;

  await Product.findOneAndUpdate(
    { id: productId },
    {
      rating: Number(average.toFixed(1)),
      reviews: count
    }
  );
}

async function hasPurchasedProduct(user, productId) {
  if (!user) return false;

  const phone = user.phone;
  const email = user.email;
  const order = await Order.findOne({
    'items.productId': productId,
    $or: [
      { 'customer.phone': phone },
      { 'customer.email': email }
    ],
    $and: [
      {
        $or: [
          { paymentMethod: 'Razorpay', paymentStatus: 'Paid' },
          { paymentMethod: { $in: ['COD', 'UPI'] }, paymentStatus: { $in: ['Pending', 'Paid'] } }
        ]
      }
    ]
  });

  return Boolean(order);
}

async function getProducts(req, res) {
  try {
    const { category, search, sort, minPrice, maxPrice } = req.query;
    const query = buildProductQuery({ category, search, minPrice, maxPrice });
    const sortOption = getProductSort(sort);

    let productsQuery = Product.find(query);
    if (sortOption) {
      productsQuery = productsQuery.sort(sortOption);
    }

    let list = (await productsQuery).map((product) => product.toJSON());

    if (sort === 'new') {
      list = applyNewSort(list);
    }

    res.json(list.map(publicProduct));
  } catch (_err) {
    throw new AppError(500, 'Failed to load products');
  }
}

async function getProductById(req, res) {
  try {
    const product = await Product.findOne({ id: req.params.id });
    if (!product) {
      throw new AppError(404, 'Product not found');
    }
    res.json(publicProduct(product.toJSON()));
  } catch (err) {
    if (err.statusCode) throw err;
    throw new AppError(500, 'Failed to load product');
  }
}

async function getProductReviews(req, res) {
  try {
    const product = await Product.findOne({ id: req.params.id });
    if (!product) {
      throw new AppError(404, 'Product not found');
    }

    const reviews = await Review.find({ productId: req.params.id }).sort({ createdAt: -1 });
    res.json({ reviews: reviews.map((review) => formatReview(review, req.userId)) });
  } catch (err) {
    if (err.statusCode) throw err;
    throw new AppError(500, 'Failed to load reviews');
  }
}

async function createProductReview(req, res) {
  try {
    const productId = req.params.id;
    const product = await Product.findOne({ id: productId });
    if (!product) {
      throw new AppError(404, 'Product not found');
    }

    const rating = Number(req.body.rating);
    const text = String(req.body.text || '').trim();
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new AppError(400, 'Rating must be between 1 and 5');
    }
    if (!text) {
      throw new AppError(400, 'Review text is required');
    }
    if (text.length > 800) {
      throw new AppError(400, 'Review must be 800 characters or less');
    }

    const user = await User.findById(req.userId);
    if (!user) {
      throw new AppError(404, 'User not found');
    }

    const verifiedPurchase = await hasPurchasedProduct(user, productId);
    if (!verifiedPurchase) {
      throw new AppError(403, 'Only customers who purchased this product can review it');
    }

    const review = await Review.findOneAndUpdate(
      { productId, userId: user._id },
      {
        productId,
        userId: user._id,
        userName: user.name,
        rating,
        text,
        verifiedPurchase
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    await recalculateProductReviewStats(productId);
    const updatedProduct = await Product.findOne({ id: productId });
    const reviews = await Review.find({ productId }).sort({ createdAt: -1 });

    res.status(201).json({
      review: formatReview(review, req.userId),
      product: publicProduct(updatedProduct.toJSON()),
      reviews: reviews.map((item) => formatReview(item, req.userId))
    });
  } catch (err) {
    if (err.statusCode) throw err;
    if (err.code === 11000) throw new AppError(409, 'You have already reviewed this product');
    throw new AppError(500, 'Failed to save review');
  }
}

async function deleteProductReview(req, res) {
  try {
    const productId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(req.params.reviewId)) {
      throw new AppError(404, 'Review not found');
    }

    const review = await Review.findOne({ _id: req.params.reviewId, productId });
    if (!review) {
      throw new AppError(404, 'Review not found');
    }
    if (String(review.userId) !== String(req.userId)) {
      throw new AppError(403, 'You can only delete your own review');
    }

    await review.deleteOne();
    await recalculateProductReviewStats(productId);
    const updatedProduct = await Product.findOne({ id: productId });
    const reviews = await Review.find({ productId }).sort({ createdAt: -1 });

    res.json({
      ok: true,
      product: publicProduct(updatedProduct.toJSON()),
      reviews: reviews.map((item) => formatReview(item, req.userId))
    });
  } catch (err) {
    if (err.statusCode) throw err;
    throw new AppError(500, 'Failed to delete review');
  }
}

module.exports = {
  getProducts,
  getProductById,
  getProductReviews,
  createProductReview,
  deleteProductReview
};
