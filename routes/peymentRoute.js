const express = require("express")
const router = express.Router()



router.post('/verify-payment', (req, res) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
  
    const generated_signature = crypto
      .createHmac('sha256', razorpayInstance.key_secret)
      .update(razorpay_order_id + '|' + razorpay_payment_id)
      .digest('hex');
  
    if (generated_signature === razorpay_signature) {
      res.status(200).json({ success: true, message: 'Payment verified successfully' });
    } else {
      res.status(400).json({ success: false, message: 'Payment verification failed' });
    }
  });
  
  module.exports = router;