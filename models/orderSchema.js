const { type } = require('express/lib/response');
const mongoose = require('mongoose');
const { Schema } = mongoose;
const { v4: uuidv4 } = require('uuid');

const orderSchema = new Schema({
    orderId: {
        type: String,
        default: () => uuidv4(),
        unique: true
    },
    userId: {  
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    orderedItems: [
        {
            product: {
                type: Schema.Types.ObjectId,
                ref: 'Products',  
                required: true
            },
            quantity: {
                type: Number,
                required: true
            },
            price: {
                type: Number,
                required: true
            },
            totalPrice: {
                type: Number,  
                required: true
            },
            size: {
                type: String,  
                required: false
            },
            color: {
                type: String,  
                required: false
            },returnReason: {
                type: String, 
                default: ''
            },
            isReturned: {
                type: Boolean,
                default: false 
            }, isCancelled: {
                type: Boolean,
                default: false 
            },CancelReason: {
                type: String, 
                default: ''
            },isCancelApproved:{
                type: Boolean,
               default:false,
            },isCancelRejected:{
                type: Boolean,
               default:false,
            },isReturnApproved:{
                type: Boolean,
               default:false,
        },isReturnRejected:{
            type: Boolean,
           default:false,
    }
    }
    ],
    address: {
        type: Object,  
        required: true
    },
    orderNotes: {
        type: String,
        default: ''
    },
    totalPrice: {
        type: Number,
        required: true
    },
    paymentMethod: {
        type: String,
        required: true,
        enum: ['Cash On Delivery', 'COD', 'cod', 'Credit Card','Razorpay', 'razorpay', 'check','wallet'],  
    },
    status: {
        type: String,
        required: true,
        enum: ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Returned'],
        default: 'Pending'
    },paymentStatus: { 
        type: String, 
        enum: ['pending', 'completed'], 
        default: 'pending' 
    },returnReason: {
        type: String, 
        default: ''
    },cancelReason: {
        type: String, 
        default: ''
    },
    isReturned: {
        type: Boolean,
        default: false 
    },
    createdAt: {
        type: Date,
        default: Date.now,
        required: true
    },iscouponApplied: {
        type: Boolean,
        default: false 
    }, CouponCode: {
        type: String,
        required: false, 
    },couponDis: {
        type: Number,
        required: false
    }
});

const Order = mongoose.model("Order",orderSchema);
module.exports = Order;