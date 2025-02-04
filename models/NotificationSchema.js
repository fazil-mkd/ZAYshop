const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    type: {
        type: String, 
        required: true
    },
    title: {
        type: String, 
        required: true
    },
    message: {
        type: String,  
        required: true
    },
    orderId: { type: String, required: true },
    createdAt: {
        type: Date,  
        default: Date.now 
    }
});


const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification;
