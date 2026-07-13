require('dotenv').config({
  path: require('path').join(__dirname, '..', '..', '.env'),
  quiet: true
});

const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const Admin = require('../models/Admin');

const SALT_ROUNDS = 10;

async function changeAdminCredentials() {
  try {
    const mongoUri = process.env.MONGO_URI;
    const newUsername = String(process.env.ADMIN_NEW_USERNAME || '').trim();
    const newPassword = process.env.ADMIN_NEW_PASSWORD || '';

    if (!mongoUri || !newUsername || !newPassword || newPassword.length < 12) {
      throw new Error('Invalid configuration');
    }

    await mongoose.connect(mongoUri);

    const admin = await Admin.findOne({ username: 'admin' });
    if (!admin) {
      throw new Error('Admin not found');
    }

    admin.username = newUsername;
    admin.passwordHash = bcrypt.hashSync(newPassword, SALT_ROUNDS);
    await admin.save();

    console.log('Admin credentials changed successfully.');
  } catch (_error) {
    console.error('Failed to change admin credentials.');
    console.error(_error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect().catch(() => {});
  }
}

changeAdminCredentials();
