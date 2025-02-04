const mongoose = require('mongoose');
const { Schema } = mongoose;

const { v4: uuidv4 } = require('uuid');

const offerSchema = new mongoose.Schema({
  _id: { 
      type: String, 
      default: uuidv4 
  },
  offerType: {
      type: String, 
      enum: ['product', 'category'],
      required: true
  },
  item: {
      type: String,
      required: true
  },
  discount: {
      type: Number,
      min: 0,
      max: 100,
      required: true
  },
  startDate: {
      type: Date,
      required: true
  },
  endDate: {
      type: Date,
      required: true
  },
  createdAt: {
      type: Date,
      default: Date.now
  }
});



 const Offer = mongoose.model('ProductOffer', offerSchema);


module.exports = {
  Offer,
}
