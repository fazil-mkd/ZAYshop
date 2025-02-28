
const Coupon = require('../../models/couponSchema')
const User = require('../../models/userSchema');
const Order = require('../../models/orderSchema')
const Product = require('../../models/productSchema');
const Category = require('../../models/categorySchema');
const mongoose= require('mongoose')



const loadOffer = async (req, res) => {
  try {
   
    const products = await Product.find({isDeleted:false});
    const categories = await Category.find({isListed:true});

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

  if (currentDate => new Date(start) && currentDate <= new Date(end)) {
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
    const { name, code, discountType, discountAmount, expireOn, maxDiscount } = req.body;

    console.log(req.body);

    const existingCoupon = await Coupon.findOne({ code });
    const currentDate = new Date();
    const expiryDate = new Date(expireOn); 

    if (existingCoupon) {
      return res.status(400).json({ message: "This coupon already exists" });
    }

    if (expiryDate < currentDate) {
      return res.status(400).json({ message: "Invalid date. You may have selected a past date." });

    }

    const coupon = new Coupon({
      name,
      code,
      discountType,
      discountAmount,
      expireOn: expiryDate, 
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
      const totalOrders = await Order.countDocuments({ status: "Delivered" });
      const totalUsers = await User.countDocuments();
      const totalProducts = await Order.aggregate([  
        { $match: { status: "Delivered" } },
        { $unwind: "$orderedItems" },
        { $group: { _id: "$orderedItems.product" } },
        { $count: "totalProducts" }
      ]);
  
 
  
      const period = req.query.period || 'daily';
      const startDate = req.query.startDate ? new Date(req.query.startDate) : null;
      const endDate = req.query.endDate ? new Date(req.query.endDate) : null;
      
      const current = new Date();
      
   
      if (startDate && startDate > current) {
        req.flash("error", "Invalid Start Date: The start date cannot be a future date.");
        return res.redirect("/admin/sales");
      }
      

      if (startDate && endDate && startDate > endDate) {
        req.flash("error", "Invalid Date Range: The start date cannot be later than the end date.");
        return res.redirect("/admin/sales");
      }
      

      const validPeriods = ["daily", "weekly", "monthly", "yearly"];
      if (!validPeriods.includes(period)) {
        req.flash("error", "Invalid period selection.");
        return res.redirect("/admin/sales");
      }
      

      
      const matchStage = {};
      const currentDate = new Date(); 

      const startOfDay = new Date(startDate);
      startOfDay.setHours(0, 0, 0, 0); 
      
      const endOfDay = new Date(endDate);
      endOfDay.setHours(23, 59, 59, 999); 
      


      
      if (period === "daily") {
        matchStage.createdAt = {
            $gte: new Date(currentDate.setHours(0, 0, 0, 0)),
            $lte: new Date(currentDate.setHours(23, 59, 59, 999))
        };
        formattedPeriod = currentDate.toISOString().split("T")[0]; 
    } else if (period === "weekly") {
        const startOfWeek = new Date(currentDate);
        startOfWeek.setDate(currentDate.getDate() - currentDate.getDay()); 
        startOfWeek.setHours(0, 0, 0, 0);
    
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6); 
        endOfWeek.setHours(23, 59, 59, 999);
    
        matchStage.createdAt = { $gte: startOfWeek, $lte: endOfWeek };
    
  
        const year = startOfWeek.getFullYear();
        const weekNumber = Math.ceil(((startOfWeek - new Date(year, 0, 1)) / 86400000 + 1) / 7);
        formattedPeriod = `${year}-W${weekNumber}`;
    } else if (period === "monthly") {
        const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    
        startOfMonth.setHours(0, 0, 0, 0);
        endOfMonth.setHours(23, 59, 59, 999);
    
        matchStage.createdAt = { $gte: startOfMonth, $lte: endOfMonth };
    
      
        formattedPeriod = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}`;
    } else if (period === "yearly") {
        const startOfYear = new Date(currentDate.getFullYear(), 0, 1);
        const endOfYear = new Date(currentDate.getFullYear(), 11, 31);
    
        startOfYear.setHours(0, 0, 0, 0);
        endOfYear.setHours(23, 59, 59, 999);
    
        matchStage.createdAt = { $gte: startOfYear, $lte: endOfYear };
    

        formattedPeriod = `${currentDate.getFullYear()}`;
    }
    
      
     
      if (startDate && endDate) {
          matchStage.createdAt = { $gte: startOfDay, $lte: endOfDay };
      }
      

      const page = parseInt(req.query.page) || 1;  
    const limit = parseInt(req.query.limit) || 10; 
     const skip = (page - 1) * limit; 
      

      
      const salesData = await Order.aggregate([
          { $match: matchStage },
          { $unwind: "$orderedItems" },
          {
              $lookup: {
                  from: "products",
                  localField: "orderedItems.product",
                  foreignField: "_id",
                  as: "productDetails"
              }
          },
          { $unwind: "$productDetails" },
          {
              $addFields: {
                  productStatus: {
                      $cond: {
                          if: "$orderedItems.isReturnApproved",
                          then: "Returned",
                          else: {
                              $cond: {
                                  if: "$orderedItems.isCancelled",
                                  then: "Cancelled",
                                  else: "$status"
                              }
                          }
                      }
                  }
              }
          },
          {
              $project: {
                  createdAt: 1,
                  totalPrice: 1,
                  userId: 1,
                  productId: "$productDetails._id",
                  productName: "$productDetails.name",
                  productCategory: "$productDetails.category",
                  productPrice: "$orderedItems.totalPrice",
                  quantitySold: "$orderedItems.quantity",
                  color: "$orderedItems.color",
                  size: "$orderedItems.size",
                  productStatus: 1,
                  productPeyment:"$orderedItems.paymentStatus"
              }
          },
          {
              $group: {
                  _id: { 
                      productId: "$productId", 
                      color: "$color", 
                      size: "$size" 
                  },
                  latestCreatedAt: { $max: "$createdAt" }, 
                  userId: { $first: "$userId" },
                  productName: { $first: "$productName" },
                  productPrice: { $first: "$productPrice" },
                  quantitySold: { $sum: "$quantitySold" },
                  productStatus: { $first: "$productStatus" },
                  productPeyment:{ $first:"$productPeyment"}
              }
          },
          {
              $group: {
                  _id: {
                      year: { $year: "$latestCreatedAt" }, 
                      month: { $month: "$latestCreatedAt" },
                      day: { $dayOfMonth: "$latestCreatedAt" },
                      week: { $isoWeek: "$latestCreatedAt" } 
                  },
                  latestCreatedAt: { $max: "$latestCreatedAt" }, 
                  totalSales: {
                      $sum: {
                          $cond: {
                              if: { $eq: ["$productStatus", "Delivered"] }, 
                              then: "$productPrice",
                              else: 0
                          }
                      }
                  },
                  totalOrders: { $sum: 1 },
                  totalCustomers: { $addToSet: "$userId" },
                  productsSold: {
                      $push: {
                          productId: "$_id.productId",
                          productName: "$productName",
                          productPrice: "$productPrice",
                          quantitySold: "$quantitySold",
                          color: { $ifNull: ["$_id.color", "N/A"] },
                          size: { $ifNull: ["$_id.size", "N/A"] },
                          productStatus: "$productStatus",
                          productPeyment:"$productPeyment",
                      }
                  }
              }
          },
          {
              $project: {
                  period: "$_id",
                  totalSales: 1, 
                  totalOrders: 1,
                  totalCustomers: { $size: "$totalCustomers" },
                  productsSold: 1
              }
          },
          { $sort: { latestCreatedAt: -1 } }, 
          { $skip: skip }, 
          { $limit: limit } 
      ]);
      

      const totalCount = await Order.aggregate([
        { $match: matchStage },
        { $unwind: "$orderedItems" },
        {
            $lookup: {
                from: "products",
                localField: "orderedItems.product",
                foreignField: "_id",
                as: "productDetails"
            }
        },
        { $unwind: "$productDetails" },
        {
            $group: {
                _id: {
                    year: { $year: "$createdAt" },
                    month: { $month: "$createdAt" },
                    day: { $dayOfMonth: "$createdAt" },
                    week: { $isoWeek: "$createdAt" }
                },
            }
        },
        { $count: "totalRecords" }
    ]);
    
    const totalPages = Math.ceil((totalCount[0]?.totalRecords || 0) / limit);








const topSellingProducts = await Order.aggregate([
  { $unwind: "$orderedItems" }, 
  {$match:{  status: "Delivered",
    "orderedItems.isReturnApproved": false,
    "orderedItems.isCancelled": false
}},
  {
      $group: {
          _id: {
              productId: "$orderedItems.product",
              size: "$orderedItems.size",
              color: "$orderedItems.color"
          },
          totalQuantity: { $sum: "$orderedItems.quantity" }, 
          totalRevenue: { $sum: "$orderedItems.totalPrice" }, 
      }
  },
  {
      $group: {
          _id: "$_id.productId", 
          totalQuantity: { $sum: "$totalQuantity" }, 
          totalRevenue: { $sum: "$totalRevenue" }, 
      }
  },
  { $sort: { totalQuantity: -1 } }, 
  { $limit: 10 }, 
  {
      $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "productDetails",
      }
  },
  { $unwind: "$productDetails" },
  {
      $project: {
          _id: 1,
          name: "$productDetails.name",
          totalQuantity: 1,
          totalRevenue: 1,
      }
  }
]);



const topSellingCategories = await Order.aggregate([
  { $unwind: "$orderedItems" },
  {$match:{  status: "Delivered",
    "orderedItems.isReturnApproved": false,
    "orderedItems.isCancelled": false
}},  
  {
    $lookup: {
      from: "products", 
      localField: "orderedItems.product", 
      foreignField: "_id",
      as: "productDetails",
    }
  },
  { $unwind: "$productDetails" },
  {
    $group: {
      _id: "$productDetails.category",  
      totalSales: { $sum: "$orderedItems.quantity" },  
      totalRevenue: { $sum: "$orderedItems.totalPrice" },  
    }
  },
  { $sort: { totalSales: -1 } },
  { $limit: 10 }, 
  {
    $lookup: {
      from: "categories", 
      localField: "_id",
      foreignField: "_id",
      as: "categoryDetails",
    }
  },
  { $unwind: "$categoryDetails" },  
  {
    $project: {
      _id: 1,
      categoryName: "$categoryDetails.name",  
      totalSales: 1,
      totalRevenue: 1,
    }
  }
]);




const topSellingBrands = await Order.aggregate([
  { $unwind: "$orderedItems" }, 
  {
    $match: {  
      status: "Delivered",
      "orderedItems.isReturnApproved": false,
      "orderedItems.isCancelled": false,
      "orderedItems.brand": { $exists: true, $ne: null, $ne: "" }  
    }
  },
  {
    $group: {
      _id: "$orderedItems.brand",  
      totalSales: { $sum: "$orderedItems.quantity" },  
      totalRevenue: { $sum: "$orderedItems.totalPrice" }  
    }
  },
  { $sort: { totalSales: -1 } },  
  { $limit: 10 },  
  {
    $project: {
      _id: 0,
      brand: "$_id",  
      totalSales: 1,
      totalRevenue: 1
    }
  }
]);




  
const Data = salesData.length > 0 ? salesData.map(data => ({
  period: data.period,
  sales:Math.round(data.totalSales),
  orders: data.totalOrders,
  customers: data.totalCustomers || 0, 
  products: data.productsSold.map(product => ({
    name: product.productName,
    price: Math.round(product.productPrice),
    quantitySold: product.quantitySold,
    color: product.color || "N/A",
    size: product.size || "N/A",
    productStatus:product.productStatus,
    productPeyment:product.productPeyment,
  }))
})) : [];

const SaleTotal = Data.reduce((sum, item) => sum + item.sales, 0);  

      
      
        res.render('salesManagement', {
          totalOrders: totalOrders || 0,
          totalUsers: totalUsers || 0,
          totalProducts: totalProducts && totalProducts.length > 0 ? totalProducts : [{ totalProducts: 0 }], 
          salesData: Array.isArray(Data) && Data.length > 0 ? JSON.stringify(Data) : "[]",
          SaleTotal,
          period: period || "",
          topSellingProducts,
          topSellingCategories,
          topSellingBrands,
          page,
          limit,
          totalPages,
          totalRecords: totalCount[0]?.totalRecords || 0,
          periodForPage:period,
      });
      
      
  
    } catch (error) {
      console.error('Error fetching sales reports:', error);
      res.status(500).send('Failed to fetcH sales reports');
    }
  };





  const couponManagement = async (req, res) => {
      try {
          const page = parseInt(req.query.page) || 1; 
          const limit = 3; 
          const skip = (page - 1) * limit;
  
     
          const totalCoupons = await Coupon.countDocuments();
  

          const coupons = await Coupon.find()
              .skip(skip)
              .limit(limit)
              .sort({ expireOn: -1 }); 
  
          res.render('couponManagement', {
              coupons,
              currentPage: page,
              totalPages: Math.ceil(totalCoupons / limit)
          });
      } catch (error) {
          console.error("Error fetching coupons:", error);
          res.status(500).send("Error loading coupon management page");
      }
  };

  




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




  const deleteCoupon= async (req, res) => {
  try {
      const couponId = req.params.id;
      console.log(couponId)
      const result = await Coupon.findByIdAndDelete(couponId);

      if (!result) return res.status(404).json({ message: "Coupon not found" });

      res.status(200).json({ message: "Coupon deleted successfully" });
  } catch (error) {
      res.status(500).json({ message: "Error deleting coupon" });
  }
}








module.exports={
  couponManagement,
  createCoupon,
  getCoupons,
  deleteOffer,
deleteCoupon,

  getSalesReports,
  updateCoupon,
  loadOffer,
  applyOffer,
}