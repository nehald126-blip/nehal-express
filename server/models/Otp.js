const mongoose = require('mongoose');

const OTP_TYPES = ['EMAIL_VERIFY', 'FORGOT_PASSWORD', 'RESET_PASSWORD'];

const otpSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
      ref: 'User'
    },
    type: {
      type: String,
      enum: OTP_TYPES,
      required: true,
      index: true
    },
    hashedOtp: {
      type: String,
      required: true
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true
    },
    usedAt: {
      type: Date,
      default: null
    },
    // Basic rate limiting fields
    requestCount: {
      type: Number,
      default: 0
    },
    lastRequestedAt: {
      type: Date,
      default: null
    },
    // For security / audit
    ipAddress: {
      type: String,
      default: null,
      trim: true
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

otpSchema.index({ email: 1, type: 1, expiresAt: 1 });

otpSchema.methods.isExpired = function isExpired() {
  return this.expiresAt instanceof Date && this.expiresAt.getTime() <= Date.now();
};

otpSchema.methods.isUsed = function isUsed() {
  return Boolean(this.usedAt);
};

module.exports = mongoose.model('Otp', otpSchema);
module.exports.OTP_TYPES = OTP_TYPES;

