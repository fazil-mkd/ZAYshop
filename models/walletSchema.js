const mongoose = require('mongoose');

const walletSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', 
        required: true, 
    },
    walletBalance: {
        type: Number,
        default: 0, 
        min: [0, 'Wallet balance cannot be negative'], 
    },
    transactions: [{
        type: {
            type: String,
            enum: ['credit', 'debit'],
            required: true,
        },
        amount: {
            type: Number,
            required: true, 
        },
        balanceAfterTransaction: {
            type: Number,
            required: false, 
        },
        date: {
            type: Date,
            default: Date.now, 
        },
        description: {
            type: String,
            default: '', 
        },
    }],
});

const Wallet = mongoose.model("Wallet", walletSchema);
module.exports = Wallet;
