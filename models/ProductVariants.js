

const mongoose = require('mongoose');

const variantSchema = new mongoose.Schema({
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    color: { type: String, required: true },
    size: { type: String, required: true },

});

module.exports = mongoose.model('Variant', variantSchema);