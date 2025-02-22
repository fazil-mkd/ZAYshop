const mongoose = require('mongoose');
const { Schema } = mongoose;

const productSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String, required: true },
    price: { type: Number, required: true },
    offerPrice: {
        type: Number,
        default: 0, 
      },
      offerStartDate: { type: Date },  
    offerEndDate: { type: Date }, 
    images: {
        type: [{ type: String }],
        validate: {
            validator: function (arr) {
                return arr.length <= 4;
            }
        }
    },
    tags: [{ type: String }],
    category: { type: mongoose.Schema.ObjectId, ref: 'Category' },
    brand: { type: String },
    warranty: { type: String },
    returnPolicy: { type: String },
    rating: { type: Number, default: 0 },
    isOffer:{
        type: Boolean,
       default:false,
    },  discountPercentage:{type:Number},
    reviews: [
        {
            user: { type: mongoose.Schema.Types.ObjectId, ref: "Users" },
            rating: { type: Number, required: true },
            comment: { type: String },
        },
    ],
    isDeleted: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
});


productSchema.pre("save", function (next) {
    if (this.images.length > 4) {
        this.images = this.images.slice(0, 4); 
    }
    next();
});

module.exports = mongoose.model('Products', productSchema);
