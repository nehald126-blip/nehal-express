const mongoose = require('mongoose');

const COUPON_TYPES = ['percentage', 'fixed'];

const couponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true
    },
    type: {
      type: String,
      enum: COUPON_TYPES,
      required: true
    },
    value: {
      type: Number,
      required: true,
      min: 0
    },
    minOrderAmount: {
      type: Number,
      default: 0,
      min: 0
    },
    maxDiscount: {
      type: Number,
      default: null,
      min: 0
    },
    expiryDate: {
      type: Date,
      default: null
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    },
    usageLimit: {
      type: Number,
      default: null,
      min: 0
    },
    usedCount: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

couponSchema.set('toJSON', {
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    if (ret.expiryDate instanceof Date) ret.expiryDate = ret.expiryDate.toISOString();
    if (ret.createdAt instanceof Date) ret.createdAt = ret.createdAt.toISOString();
    if (ret.updatedAt instanceof Date) ret.updatedAt = ret.updatedAt.toISOString();
    return ret;
  }
});

module.exports = mongoose.model('Coupon', couponSchema);
module.exports.COUPON_TYPES = COUPON_TYPES;
