const { type } = require("express/lib/response");
const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    image: { type: String },
    description: { type: String },
    isDeleted: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    isListed:{type: Boolean, default:true}, 
    isOfferCategory:{
        type: Boolean,
       default:false,
    }, offerStartDate: { type: Date },  
    offerEndDate: { type: Date },
    discountPercentage:{type:Number}
});

module.exports = mongoose.model("Category", categorySchema);