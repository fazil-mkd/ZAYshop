const mongoose = require("mongoose");
const { schema } = require("./addressSchema");
const { Schema } = mongoose;

const cartSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    items: [{
        productId: {
            type: Schema.Types.ObjectId,
            ref: 'Products',
            required: true
        },
        quantity: {
            type: Number,
            default: 1,
        },
        price: {
            type: Number,
            required: true
        },
        totalPrice: {
            type: Number,
            required: true,
        },
        status: {
            type: String,
            default: 'placed'
        },
        addedAt: {
            type: Date,
            default: Date.now
        },
        productSize: {
            type: String,
            required: false,  
        },
        productColor: {
            type: String,
            required: false, 
        }
    }],
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});
const Cart = mongoose.model("Cart", cartSchema)

module.exports = Cart