const mongoose = require('mongoose');

const validateObjectId = (req, res, next) => {
  const productId = req.params.id;

  if (!mongoose.Types.ObjectId.isValid(productId) || productId.length !== 24) {
    return res.status(400).json({ message: 'Invalid product ID' });
  }

  next();
};

module.exports = {validateObjectId}