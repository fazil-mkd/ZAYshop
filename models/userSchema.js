const mongoose = require("mongoose")
const { Schema } = mongoose;
const Wallet = require("../models/walletSchema"); 

const userSchema = new Schema({

    name: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
    },
    phone: {
        type: String,
        required: false,
        unique: true,
        sparse: true,
        default: null
    },
    googleId: {
        type: String,
        unique: true,
        sparse: true,
    },
    password: {
        type: String,
        required: true,
    },
    isBlocked: {
        type: Boolean,
        default: false,
    },
    isAdmin: {
        type: Boolean,
        default: false
    },
    cart: [{
        type: Schema.Types.ObjectId,
        ref: "Cart",

    }], wishlist: [{
        type: Schema.Types.ObjectId,
        ref: "Whishlist"
    }],
    orderHistory: [{
        type: Schema.Types.ObjectId,
        ref: "Order"
    }],
    createdOn: {
        type: Date,
        default: Date.now,
    },
    referalCode: {
        type: String, unique: true 
    },referredBy: { type: String, default: null },
    redeemed: {
        type: Boolean
    },
    redeemedUsers: [{
        type: Schema.Types.ObjectId,
        ref: "User"
    }],
    searchHistory: [{
        category: {
            type: Schema.Types.ObjectId,
            ref: "Category"
        },
        brand: {
            type: String
        },
        searchOn: {
            type: Date,
            default: Date.now
        }
    }],
    isDeleted: { type: Boolean, default: false }
})


const User = mongoose.model("User", userSchema);
module.exports = User;