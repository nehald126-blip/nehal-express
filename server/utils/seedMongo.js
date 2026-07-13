require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Category = require('../models/Category');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Admin = require('../models/Admin');

const DATA_PATH = path.join(__dirname, '..', 'data.json');

async function seedMongo() {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error('MONGO_URI is required in .env to seed MongoDB');
    }

    const connected = await connectDB();
    if (!connected) {
      throw new Error('Could not connect to MongoDB Atlas');
    }

    if (!fs.existsSync(DATA_PATH)) {
      throw new Error(`Data file not found: ${DATA_PATH}`);
    }

    const data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));
    const categories = data.categories || [];
    const products = data.products || [];
    const orders = (data.orders || []).map((order) => ({
      ...order,
      createdAt: order.createdAt ? new Date(order.createdAt) : new Date()
    }));
    const admins = data.admins || [];

    await Promise.all([
      Category.deleteMany({}),
      Product.deleteMany({}),
      Order.deleteMany({}),
      Admin.deleteMany({})
    ]);
    console.log('Cleared existing Category, Product, Order, and Admin collections');

    const [categoryResult, productResult, orderResult, adminResult] = await Promise.all([
      categories.length ? Category.insertMany(categories) : [],
      products.length ? Product.insertMany(products) : [],
      orders.length ? Order.insertMany(orders) : [],
      admins.length ? Admin.insertMany(admins) : []
    ]);

    console.log(`Categories inserted: ${categoryResult.length}`);
    console.log(`Products inserted:   ${productResult.length}`);
    console.log(`Orders inserted:     ${orderResult.length}`);
    console.log(`Admins inserted:     ${adminResult.length}`);
    console.log('MongoDB seed completed successfully');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('MongoDB seed failed:', error.message);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  }
}

seedMongo();
