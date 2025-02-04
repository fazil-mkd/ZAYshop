const mongoose = require("mongoose");
const { Schema } = mongoose;
const addressSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: "User",  // This links the address to the User model
        required: true
    },
    address: [{
        fullName: {
            type: String,
            required: true
        },
        streetAddress: {
            type: String,
            required: true
        },
        aptNumber: {
            type: String,
            required: false  // This can be optional
        },
        city: {
            type: String,
            required: true
        },
        state: {
            type: String,
            required: true
        },
        pincode: {
            type: Number,
            required: true
        },
        country: {
            type: String,
            required: true
        },
        phone: {
            type: String,
            required: true
        },
        altPhone: {
            type: String,
            required: false
        },
        addressType: {
            type: String,
            required: true
        }
    }]
});

const Address = mongoose.model("Address", addressSchema)

module.exports = Address;