

const mongoose = require('mongoose');

const variantSchema = new mongoose.Schema({
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    color: { type: String, required: false },
    size: { type: String, required: false },

});

module.exports = mongoose.model('Variant', variantSchema);