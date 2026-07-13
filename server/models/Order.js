const mongoose = require('mongoose');

const ORDER_STATUSES = ['Placed', 'Packed', 'Shipped', 'Delivered', 'Cancelled'];
const PAYMENT_METHODS = ['UPI', 'COD', 'Razorpay'];
const PAYMENT_STATUSES = ['Pending', 'Paid', 'Failed'];

const orderItemSchema = new mongoose.Schema(
  {
    productId: {
      type: String,
      required: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    price: {
      type: Number,
      required: true,
      min: 0
    },
    qty: {
      type: Number,
      required: true,
      min: 1
    },
    size: {
      type: String,
      default: null
    },
    color: {
      type: String,
      default: null
    },
    lineTotal: {
      type: Number,
      required: true,
      min: 0
    }
  },
  { _id: false }
);

const customerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    phone: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    email: {
      type: String,
      default: '',
      trim: true,
      lowercase: true
    },
    address: {
      type: String,
      required: true,
      trim: true
    },
    pincode: {
      type: String,
      required: true,
      trim: true
    },
    city: {
      type: String,
      default: ''
    },
    state: {
      type: String,
      default: ''
    }
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    items: {
      type: [orderItemSchema],
      required: true,
      validate: {
        validator: (items) => Array.isArray(items) && items.length > 0,
        message: 'Order must contain at least one item'
      }
    },
    customer: {
      type: customerSchema,
      required: true
    },
    paymentMethod: {
      type: String,
      enum: PAYMENT_METHODS,
      required: true
    },
    paymentStatus: {
      type: String,
      enum: PAYMENT_STATUSES,
      default: 'Pending',
      index: true
    },
    razorpayOrderId: {
      type: String,
      default: null,
      trim: true,
      index: true
    },
    razorpayPaymentId: {
      type: String,
      default: null,
      trim: true
    },
    razorpaySignature: {
      type: String,
      default: null,
      trim: true
    },
    paidAt: {
      type: Date,
      default: null
    },
    couponCode: {
      type: String,
      default: null,
      trim: true,
      uppercase: true
    },
    discountAmount: {
      type: Number,
      default: 0,
      min: 0
    },
    invoiceNumber: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
      index: true
    },
    invoiceGeneratedAt: {
      type: Date,
      default: null
    },
    emailSentAt: {
      type: Date,
      default: null
    },
    subtotal: {
      type: Number,
      required: true,
      min: 0
    },
    shipping: {
      type: Number,
      required: true,
      min: 0
    },
    total: {
      type: Number,
      required: true,
      min: 0
    },
    status: {
      type: String,
      enum: ORDER_STATUSES,
      default: 'Placed',
      index: true
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

orderSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret._id;
    if (ret.createdAt instanceof Date) {
      ret.createdAt = ret.createdAt.toISOString();
    }
    if (ret.updatedAt instanceof Date) {
      delete ret.updatedAt;
    }
    return ret;
  }
});

module.exports = mongoose.model('Order', orderSchema);
module.exports.ORDER_STATUSES = ORDER_STATUSES;
module.exports.PAYMENT_METHODS = PAYMENT_METHODS;
module.exports.PAYMENT_STATUSES = PAYMENT_STATUSES;
