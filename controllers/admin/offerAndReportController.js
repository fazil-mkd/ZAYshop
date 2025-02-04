
const Coupon = require('../../models/couponSchema')
const User = require('../../models/userSchema');
const Order = require('../../models/orderSchema')
const Product = require('../../models/productSchema');
const Category = require('../../models/categorySchema');
const mongoose= require('mongoose')



const loadOffer = async (req, res) => {
  try {
   
    const products = await Product.find();
    const categories = await Category.find();

    const offerAppliedProduct = await Product.find({isOffer:true})
    const offerAppliedCategory = await Category.find({isOfferCategory:true})
var message='Add valueble Offer to User '


    res.render('offerManagement', {
      products, 
      categories,
      offerAppliedCategory,
      offerAppliedProduct,
      message,
    });
  } catch (error) {
    console.error('Error fetching products and categories:', error);
    res.status(500).send('Internal Server Error');
  }
};




const applyDiscountToProduct = async (req,res,itemId, discount,start,end) => {
  try {
     
      const product = await Product.findById(itemId);
     
      const Categorys = await Category.findOne({_id:product.category})
  const highDiscount = Categorys.discountPercentage>discount?Categorys.discountPercentage:discount;

     if(Categorys.discountPercentage>discount){
      return res.status(200).json({ 
        success: true, 
        message: "Category offer is Higher than Product offer", 
      });
     }


      const newOfferPrice = product.price - (product.price * (highDiscount / 100));

      product.offerPrice = Math.round(newOfferPrice)
      product.offerStartDate=start;
      product.offerEndDate=end;
      product.isOffer=true;
      product.discountPercentage=discount;
    if(Categorys.discountPercentage>discount){
      product.isOffer=false;
    }

      await product.save();

      return res.status(200).json({ 
        success: true, 
        message: "Discount applied successfully", 
      });

  } catch (error) {
      console.error("Error applying discount:", error.message);
      throw error;
  }
};


const applyDiscountToCategory = async (req,res,category, discountPercentage,start,end) => {
  const products = await Product.find({ category });


  const Categorys = await Category.findOne({_id:category})
  const highDiscount = Product.discountPercentage>discountPercentage?Product.discountPercentage:discountPercentage;

  const updatedProducts = products.map(product => {
    const discountedPrice = product.price * (1 - (highDiscount / 100));
    product.offerPrice = Math.round(discountedPrice * 100) / 100; 
    product.offerStartDate=start;
    product.offerEndDate=end;

   if(product.discountPercentage<discountPercentage){
    product.isOffer=false
   }
    return product.save();
  });
  Categorys.isOfferCategory=true;
  Categorys.offerStartDate=start;
  Categorys.offerEndDate=end;
  Categorys.discountPercentage=highDiscount;

  Categorys.save()
res.status(200).json({ 
    success: true, 
    message: "Discount applied to category successfully", 
  });
   
  await Promise.all(updatedProducts);
  return updatedProducts;
 
};


const applyOffer = async (req,res) => {
     
  const { type, item, discount, start, end } = req.body;
    console.log(req.body)
  const currentDate = new Date();

  if (currentDate >= new Date(start) && currentDate <= new Date(end)) {
    if (type === 'product') {
      return applyDiscountToProduct(req,res,item, discount,start,end);
    } else if (type === 'category') {
      return applyDiscountToCategory(req,res,item, discount,start,end);
    } else {
      console.log('Invalid offer type');
    }
  } else {
    console.log('Offer not currently valid');
  }
};




 const createCoupon = async (req, res) => {
  try {
    const { name, code, discountType, discountValue, expireOn,maxDiscount} = req.body;


     console.log(req.body)


     const existingCoupon = await Coupon.findOne({ code });

     if (existingCoupon) {
      res.status(201).json({ message: "Coupon created successfully"});
     }

    const coupon = new Coupon({
      name,
      code,
      discountType,
      discountAmount:discountValue,
      expireOn,
      maxDiscount,
    });

    await coupon.save();
    res.status(201).json({ message: "Coupon created successfully", coupon });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

  

  const getCoupons = async (req, res) => {
    try {
      const coupons = await Coupon.find();
      res.status(200).json(coupons);
  } catch (error) {
      res.status(500).json({ message: 'Error fetching coupons', error: error.message });
  }
  };









  const getSalesReports = async (req, res) => {
    try {
      const totalOrders = await Order.countDocuments();
      const totalUsers = await User.countDocuments();
      const totalProducts = await Order.aggregate([  
        { $match: { status: "Delivered" } },
        { $unwind: "$orderedItems" },
        { $group: { _id: "$orderedItems.product" } },
        { $count: "totalProducts" }
      ]);
  
      const totalSalesResult = await Order.aggregate([ 
         { $match: { status: "Delivered" } },
        { $group: { _id: null, totalSales: { $sum: "$totalPrice" } } }
      ]);
  
      const avarageOrders = await Order.aggregate([ 
         { $match: { status: "Delivered" } },
        { $group: { _id: null, avarageOrder: { $avg: "$totalPrice" } } }
      ]);
  
      const AvarageOrder = avarageOrders.length > 0 ? avarageOrders[0].avarageOrder : 0;
      const totalSales = totalSalesResult.length > 0 ? totalSalesResult[0].totalSales : 0;
  
  
      const period = req.query.period || 'daily';
      const startDate = req.query.startDate ? new Date(req.query.startDate) : null;
      const endDate = req.query.endDate ? new Date(req.query.endDate) : null;

  const current=new Date()
     
      if(startDate>current){
        req.flash(
          "error",
          "Invalid Start Date: The start date cannot be a future date."
        );
        return res.redirect("/admin/sales");

      }

      if(startDate>endDate){
        req.flash(
          "error",
          "Invalid Date Range: The start date cannot be later than the end date."
        );
        return res.redirect("/admin/sales");

      }



let matchStage = { status: "Delivered" };




if (startDate && endDate) {
  matchStage.createdAt = { $gte: startDate, $lte: endDate };
}

function getGroupByPeriod(period) {
  switch (period) {
    case "daily":
      return { year: { $year: "$createdAt" }, month: { $month: "$createdAt" }, day: { $dayOfMonth: "$createdAt" } };
    case "weekly":
      return { year: { $year: "$createdAt" }, week: { $isoWeek: "$createdAt" } };
    case "monthly":
      return { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } };
    case "yearly":
      return { year: { $year: "$createdAt" } };
    default:
      throw new Error("Invalid period");
  }
}

const salesData = await Order.aggregate([
  { $match: matchStage }, 
  {
    $project: {
      createdAt: 1,
      totalPrice: 1,
      userId: 1
    }
  },
  {
    $group: {
      _id: getGroupByPeriod(period),
      totalSales: { $sum: "$totalPrice" },
      totalOrders: { $sum: 1 },
      totalCustomers: { $addToSet: "$userId" }
    }
  },
  {
    $project: {
      period: "$_id",
      totalSales: 1,
      totalOrders: 1,
      totalCustomers: { $size: "$totalCustomers" }
    }
  }
]);

  
      const Data = salesData.map(data => ({
        period: data.period,
        sales: data.totalSales,
        orders: data.totalOrders,
        customers: data.totalCustomers
      }));
  
     console.log('data is here',Data)
      
        const avarageOrder = Math.round(AvarageOrder)

      res.render('salesManagement', {
        totalOrders,
        totalUsers,
        totalProducts,
        totalSales,
        avarageOrder,
        salesData: JSON.stringify(Data),
        period 
      });
  
    } catch (error) {
      console.error('Error fetching sales reports:', error);
      res.status(500).send('Failed to fetch sales reports');
    }
  };



  const couponManagement = async(req,res)=>{
    res.render('couponManagement')
  }





 const updateCoupon = async (req, res) => {
    const { id } = req.params;
    const { discountAmount, expireOn, discountType, maxDiscount } = req.body;
     

    try {
        
        if (!discountAmount || !expireOn || !discountType) {
            return res.status(400).json({ message: 'All fields are required.' });
        }

     
        const updatedCoupon = await Coupon.findByIdAndUpdate(
            id,
            {
                discountAmount,
                expireOn,
                discountType,
                maxDiscount,
            },
            { new: true } 
        );

        if (!updatedCoupon) {
            return res.status(404).json({ message: 'Coupon not found.' });
        }

        res.status(200).json({ message: 'Coupon updated successfully.', coupon: updatedCoupon });
    } catch (error) {
        console.error('Error updating coupon:', error);
        res.status(500).json({ message: 'An error occurred while updating the coupon.' });
    }
}






const deleteOffer = async (req, res) => {
  const { type, id } = req.params;
  const objectId = new mongoose.Types.ObjectId(id);

  try {
    let deletedItem = false;

    if (type === 'product') {

      const product = await Product.findById(objectId);
      if (!product) {
        return res.status(404).json({ message: 'Product not found' });
      }

      const category = await Category.findById(product.category);
      if (!category) {
        return res.status(404).json({ message: 'Category not found for this product' });
      }


      product.isOffer = false;
      product.offerPrice = product.price;

    
      if (product.discountPercentage < category.discountPercentage) {
        const discountedPrice = product.price * (1 - (category.discountPercentage / 100));
        product.offerPrice = Math.round(discountedPrice * 100) / 100;
      }

      await product.save();
      deletedItem = true;

    } else if (type === 'category') {
 
      const products = await Product.find({ category: objectId });
      if (products.length === 0) {
        return res.status(404).json({ message: 'No products found for this category' });
      }


      const category = await Category.findById(objectId);
      if (!category) {
        return res.status(404).json({ message: 'Category not found' });
      }

     
      await Promise.all(
        products.map(async (product) => {
          product.offerPrice = product.price;

    
          if (product.discountPercentage > category.discountPercentage) {
            const discountedPrice = product.price * (1 - (product.discountPercentage / 100));
            product.offerPrice = Math.round(discountedPrice * 100) / 100;
          }

          await product.save();
        })
      );


      category.isOfferCategory = false;
      await category.save();
      deletedItem = true;

    } else {
      return res.status(400).json({ message: 'Invalid type' });
    }

    if (deletedItem) {
      return res.status(200).json({
        message: `${type.charAt(0).toUpperCase() + type.slice(1)} deleted successfully`,
      });
    } else {
      return res.status(404).json({ message: `${type.charAt(0).toUpperCase() + type.slice(1)} not found` });
    }

  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: `Error deleting ${type}` });
  }
};








module.exports={
  couponManagement,
  createCoupon,
  getCoupons,
  deleteOffer,

  getSalesReports,
  updateCoupon,
  loadOffer,
  applyOffer,
}