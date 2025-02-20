const Order = require('../../models/orderSchema');
const Products = require("../../models/productSchema");
const mongoose = require('mongoose');
const path = require('path')
const fs = require('fs')
const Variant = require('../../models/ProductVariants');
const Wallet = require('../../models/walletSchema');
const Notification = require('../../models/NotificationSchema');
const PDFDocument = require('pdfkit'); 

     const viewOrder = async (req, res) => {
      
      try {
      

const page = parseInt(req.query.page) || 1;
        const PerPage = 10;
        const skip = (page - 1) * PerPage;

        const orders = await Order.find({}).sort({ createdAt: -1 }).skip(skip).limit(PerPage)
      


        const total = await Order.countDocuments({});
        const totalPages = Math.ceil(total / PerPage);


        res.render('orderManagement', { orders,currentPage: page, totalPages }); 
      } catch (err) {
        console.error(err);
        res.status(500).send('Internal Server Error');
      }
      }
      

      const viewOderDetails = async (req, res) => {
        const { orderId } = req.params;
        console.log('Received orderId:', orderId); 
      
        try {
          const order = await Order.findOne({ _id: new mongoose.Types.ObjectId(orderId) })
          console.log('Fetched Order:', order); 
          if (!order) {
            return res.status(404).json({ error: 'Order not found' });
          }
         
          res.status(200).json(order);
        } catch (error) {
          console.error('Error fetching order:', error.message);
          res.status(500).json({ error: 'Something went wrong', details: error.message });
        }
      };

      
      const changeOrderStatus = async (req, res) => {
        const { orderId, newStatus } = req.body;
      
        try {
          console.log('Received request to change status', { orderId, newStatus });
      
          if (!orderId || !newStatus) {
            return res.status(400).json({ error: 'Order ID and new status are required' });
          }
      
          const existingOrder = await Order.findById(orderId);
          if (!existingOrder) {
            return res.status(404).json({ error: 'Order not found' });
          }
      
          const updatedFields = { status: newStatus };
      

          if (existingOrder.paymentMethod.toLowerCase() === 'cod' && newStatus === 'Delivered') {
            updatedFields.paymentStatus = 'completed';
          }
      
          const updatedOrder = await Order.findByIdAndUpdate(orderId, updatedFields, { new: true });
      
          console.log('Updated Order:', updatedOrder);
          res.status(200).json({ message: 'Order status updated successfully', order: updatedOrder });
      
        } catch (error) {
          console.error('Error updating order status:', error.message);
          res.status(500).json({ error: 'Something went wrong' });
        }
      };
      




const OrderProductDetail = async(req,res)=>{
  const  orderId = req.params.id;

  try {
    console.log("OrderId being searched:", orderId);
      const order = await Order.findOne({ _id: new mongoose.Types.ObjectId(orderId) }).populate('orderedItems.product');
    console.log(order);
         
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    const overAllPrice = order.orderedItems.reduce((acc, item) => acc + item.totalPrice, 0);

    res.render('orderProductDetail', { order,overAllPrice });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Something went wrong' });
  }
}








const approveReturn = async (req, res) => {
    try {
        const { orderId, productId} = req.body;

        const order = await Order.findOne({ orderId: orderId });
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        const item = order.orderedItems.find((item) => item.product.toString() === productId);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Product not found in order.' });
    }

    const product = order.orderedItems.find(item => item.product.toString() === productId);
    const productPrice = item.totalPrice;
    const  stockToAdd = item.quantity;
    if (isNaN(productPrice) || productPrice <= 0) {
      console.log('Invalid product price');
      return res.status(400).json({ success: false, message: 'Invalid product price' });
    }


    const wallet = await Wallet.findOne({ user: order.userId });
    if (!wallet) {
      console.log('Wallet not found');
      return res.status(404).json({ success: false, message: 'Wallet not found' });
    }

    const { color, size } = product;
    if (!color || !size) {
      console.log('Product variant details missing');
      return res.status(400).json({ success: false, message: 'Product variant details missing.' });
    }
    
    const variant = await Variant.findOne({ 
        color, 
        productId: new mongoose.Types.ObjectId(productId) 
    });
    
    if (!variant) {
      console.log('Variant not found');
      return res.status(404).json({ success: false, message: 'Variant not found' });
    }
    
    const sizeStockMap = {};
    const sizeStockPairs = variant.size.split(',');
    
    sizeStockPairs.forEach(pair => {
      const [sizeKey, stockValue] = pair.split(':');
      const stockNumber = parseInt(stockValue.trim(), 10);
    
      if (isNaN(stockNumber)) {
        console.log('Invalid stock value for size');
        return res.status(400).json({ success: false, message: 'Invalid stock value for size' });
      }


      if (sizeKey.trim() === size) {
        sizeStockMap[sizeKey.trim()] = stockNumber + stockToAdd; 
      } else {
        sizeStockMap[sizeKey.trim()] = stockNumber;  
      }
    });
    
    const updatedSizeStockString = Object.entries(sizeStockMap)
      .map(([sizeKey, stockValue]) => `${sizeKey}:${stockValue}`)
      .join(',');
    
    variant.size = updatedSizeStockString;
    await variant.save();
    


    wallet.walletBalance += productPrice;
    wallet.transactions.push({
      type: 'credit',
      amount: productPrice ,
      description: `Refund for returned product: ${productId} from order ${orderId}`,
      date: new Date(),
    });

       item.paymentStatus = 'refund';
        item.isReturnApproved = true;
        item.isReturnRejected = false;

        const allReturned = order.orderedItems.every((item) => item.isReturnApproved);
        if (allReturned) {
          order.status = 'Returned';
        }

        const allPeyment = order.orderedItems.every((item) => item.paymentStatus==="refund");
        if (allPeyment) {
          order.paymentStatus = 'refund';
        }

        order.totalPrice -= item.totalPrice ;


        await wallet.save();
    await order.save();

        await createNotification({
            type: 'RETURN_REQUEST_APPROVED',
            title: 'Return Request Approved',
            message: `Your return request has been approved.`,
            orderId: order.orderId
        });

        res.json({
            success: true,
            message: 'Return approved successfully'
        });
    } catch (error) {
        console.error('Error in approveReturn:', error);
        res.status(500).json({
            success: false,
            message: 'Error processing return approval'
        });
    }
};






const rejectReturn = async (req, res) => {
    try {
        const { orderId, productId } = req.body;

        const order = await Order.findOne({ orderId: orderId });
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        const orderItem = order.orderedItems.find(
            item => item.product._id.toString() === productId
        );

        if (!orderItem) {
            return res.status(404).json({ success: false, message: 'Order item not found' });
        }

        orderItem.isReturnRejected = true;
        orderItem.isReturnApproved = false;
        await order.save();


        await createNotification({
            userId: order.user,
            type: 'RETURN_REQUEST_REJECTED',
            title: 'Return Request Rejected',
            message: `Your return request has been rejected. bacause its too late from Deliverd`,
            orderId: order.orderId
        });

        res.json({
            success: true,
            message: 'Return rejected successfully'
        });
    } catch (error) {
        console.error('Error in rejectReturn:', error);
        res.status(500).json({
            success: false,
            message: 'Error processing return rejection'
        });
    }
};






const createNotification = async ({type, title, message, orderId }) => {
    console.log("📢 createNotification function called!");

    try {
        const notification = new Notification({
            type,
            title,
            message,
            orderId:orderId,
            createdAt: new Date()
        });
        await notification.save();
    } catch (error) {
        console.error('Error creating notification:', error);
    }
};








const AdminorderCancel = async (req, res,next) => {
  const { orderId,cancelReason } = req.body;

  try {
    const order = await Order.findOne({ orderId });
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (order.status === 'Cancelled') {
      return res.status(400).json({ error: 'Order is already cancelled' });
    }

    if (order.status === 'Delivered') {
      return res.status(400).json({ error: 'Order is already  Delivered' });
    }
       

    if (isNaN(order.totalPrice) || order.totalPrice <= 0) {
      return res.status(400).json({ error: 'Invalid order amount' });
    }

    const wallet = await Wallet.findOne({ user: order.userId });
    if (!wallet) {
      return res.status(404).json({ error: 'Wallet not found for the user' });
    }


    for (const item of order.orderedItems) {
      const { product, color, size, quantity: stockToReturn } = item;

      console.log()

      const variant = await Variant.findOne({ color });
      if (!variant) {
        console.error(`Variant not found for color: ${color}`);
        continue; 
      }

      const sizeStockMap = {};
      const sizeStockPairs = variant.size.split(',');
      sizeStockPairs.forEach(pair => {
        const [sizeKey, stockValue] = pair.split(':');
        sizeStockMap[sizeKey.trim()] = parseInt(stockValue, 10);
      });

      if (sizeStockMap[size] !== undefined) {
        sizeStockMap[size] += stockToReturn || 1; 
      } else {
        sizeStockMap[size] = stockToReturn || 1; 
      }

      const updatedSizeStockString = Object.entries(sizeStockMap)
        .map(([sizeKey, stockValue]) => `${sizeKey}:${stockValue}`)
        .join(',');

      variant.size = updatedSizeStockString;
      await variant.save();
    }

    const totalPrice=order.totalPrice


    if (order.paymentMethod !== "cod") {
      wallet.walletBalance += totalPrice;
      wallet.transactions.push({
        type: 'credit',
        amount: totalPrice,
        description: `Refund for cancelled order: ${orderId}`,
        date: new Date(),
      });
    
      await wallet.save();
    } else {
      console.log('Payment method is Cash on Delivery. No refund to wallet.');
    }

    order.totalPrice-=totalPrice;

order.orderedItems.forEach(item => {
  item.isCancelled = true;  
});

order.cancelReason=cancelReason;

order.orderedItems.forEach(item => {
  item.CancelReason = cancelReason ;  
});


if (order.orderedItems.every(item => item.isCancelled === true)) {
  order.status = 'Cancelled'; 
}
    await order.save();

    res.json({
      message: 'Order cancelled successfully',
      updatedWalletBalance: wallet.walletBalance,
    });
  } catch (err) {
    console.error('Error cancelling order:', err);
    next(err);
  }
};




const invoice = async (req, res) => {
  try {
      const orderId = req.params.orderId;
      const order = await Order.findById(orderId)
          .populate('userId')
          .populate('orderedItems.product');

      if (!order) {
          return res.status(404).send('Order not found');
      }

      const doc = new PDFDocument({ margin: 50 });
      res.setHeader('Content-Disposition', `attachment; filename=ZAY_invoice-${orderId}.pdf`);
      res.setHeader('Content-Type', 'application/pdf');
      doc.pipe(res);


      doc.save()
          .moveTo(0, 700)
          .lineTo(0, 792)
          .quadraticCurveTo(doc.page.width / 2, 750, doc.page.width, 792)
          .lineTo(doc.page.width, 700)
          .fillColor('#2B6CB0')
          .fill();

    
      doc.rect(0, 0, doc.page.width, 100)
          .fillColor('#F7FAFC')
          .fill();

    
      doc.fontSize(28)
          .fillColor('#2D3748') 
          .font('Helvetica-Bold')
          .text('ZAY', 50, 50)
          .fontSize(10)
          .font('Helvetica')
          .fillColor('#4A5568') 
          .text('NO. ' + order.orderId, doc.page.width - 150, 50);


      doc.fontSize(28)
          .font('Helvetica-Bold')
          .fillColor('#2B6CB0')  
          .text('BILLING STATEMENT', 50, 130);


      doc.fontSize(10)
          .fillColor('#4A5568')
          .font('Helvetica')
          .text('Date:', 50, 180)
          .fillColor('#2D3748')
          .text(new Date(order.createdAt).toLocaleDateString(), 90, 180);


      doc.fontSize(10)
          .fillColor('#4A5568')
          .text('Billed to:', 50, 220)
          .font('Helvetica-Bold')
          .fillColor('#2D3748')
          .text(order.address.fullName, 50, 235)
          .font('Helvetica')
          .fillColor('#4A5568')
          .text(order.address.streetAddress + (order.address.aptNumber ? `, ${order.address.aptNumber}` : ''))
          .text(`${order.address.city}, ${order.address.state} ${order.address.pincode}`)
          .text(order.address.country)
          .text(`Email: ${order.userId.email}`);

  
      doc.fontSize(10)
          .fillColor('#4A5568')
          .text('From:', doc.page.width - 250, 220)
          .font('Helvetica-Bold')
          .fillColor('#2D3748')
          .text('ZAY Fashion', doc.page.width - 250, 235)
          .font('Helvetica')
          .fillColor('#4A5568')
          .text('catalonia, barcelona, spain')
          .text('Phone: 1212121212')
          .text('Email: support@zay.com');

   
      doc.rect(50, 320, doc.page.width - 100, 20)
          .fillColor('#EBF8FF')  
          .fill();

 
          const tableTop = 325;
          doc.fontSize(10)
              .fillColor('#2B6CB0')  
              .font('Helvetica-Bold')
              .text('Item', 60, tableTop)
              .text('Color', 200, tableTop)
              .text('Size', 300, tableTop)
              .text('Quantity', 400, tableTop)
              .text('Price', 500, tableTop)
              
          
          let currentY = tableTop + 40;
          let subtotal = 0;
          let isEvenRow = true;
          
          order.orderedItems.forEach((item) => {
              if (isEvenRow) {
                  doc.rect(50, currentY - 5, doc.page.width - 100, 25)
                      .fillColor('#F7FAFC')
                      .fill();
              }
          
              const itemStatus = item.isCancelled ? ' (Cancelled)' : 
                                item.isReturnApproved ? ' (Returned)' : '';
          
              doc.fontSize(10)
                  .fillColor('#2D3748')  
                  .text(item.product.name + itemStatus, 60, currentY)
                  .text(`${item.color || 'N/A'}`, 200, currentY)
                  .text(`${item.size || 'N/A'}`, 300, currentY)
                  .text(item.quantity.toString(), 400, currentY)
                  .text(`${item.price.toFixed(2)}`, 500, currentY)
                 

          if (!item.isCancelled) {
              subtotal += item.totalPrice;
          }

          currentY += 25;
          isEvenRow = !isEvenRow;
      });



      if (order.iscouponApplied) {
          currentY += 20;
          doc.fillColor('#4A5568')
              .text(`Discount (${order.CouponCode}):`, 400, currentY)
              .fillColor('#2D3748')
              .text(`-${order.couponDis.toFixed(2)}`, 480, currentY);
      }


      currentY += 30;
      doc.fontSize(12)
          .font('Helvetica-Bold')
          .fillColor('#2B6CB0')
          .text('Total:', 400, currentY)
          .text(`${order.totalPrice.toFixed(2)}`, 480, currentY);


      doc.fontSize(10)
          .fillColor('#4A5568')
          .font('Helvetica')
          .text('Payment method:', 50, currentY + 40)
          .fillColor('#2D3748')
          .text(order.paymentMethod.toUpperCase(), 140, currentY + 40);

      doc.fontSize(10)
          .fillColor('#4A5568')
          .text('Note:', 50, currentY + 60)
          .fillColor('#2D3748')
          .text('Thank you for choosing ZAY!', 90, currentY + 60);

      doc.end();

  } catch (error) {
      console.error(error);
      res.status(500).send('Error generating invoice');
  }
};







 



module.exports = {
    viewOrder,
    viewOderDetails,
    changeOrderStatus,
    OrderProductDetail,
    rejectReturn,
    approveReturn,
    AdminorderCancel,
    invoice,
}