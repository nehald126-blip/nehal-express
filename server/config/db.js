const dns = require('dns');
const mongoose = require('mongoose');

dns.setServers(['8.8.8.8', '1.1.1.1']);

async function connectDB() {
  try {
    const mongoUri = process.env.MONGO_URI;

    if (!mongoUri) {
      console.log('⚠️ MONGO_URI not found. Running with JSON database for now.');
      return false;
    }

    console.log('Mongo URI:', mongoUri.replace(/:([^:@]+)@/, ':****@'));

    await mongoose.connect(mongoUri);

    console.log('✅ MongoDB Atlas connected');
    return true;
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    return false;
  }
}

module.exports = connectDB;