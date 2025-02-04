const mongoose = require("mongoose");

const { Schema } = mongoose;

const couponSchema = new Schema({
  name: {
    type: String,
    required: true,
    unique: true,
  },
  code: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  discountType: {
    type: String,
    required: true,
    enum: ["percentage", "fixed"], 
    default: "percentage",
  },
  discountAmount: {
    type: Number,
    required: true,
    min: 0, 
  },
  maxDiscount: {
    type: Number,
    min: 0, 
    default: 0, 
  },
  expireOn: {
    type: Date,
    required: true,
  },
  userId: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    unique: true,
    sparse: true,
}],
});

const Coupon = mongoose.model("Coupon", couponSchema);

module.exports = Coupon;
