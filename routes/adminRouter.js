const express = require("express");
const router = express.Router();
const adminController = require("../controllers/admin/adminController");
const customerController = require('../controllers/admin/customerController');
const categoryController = require('../controllers/admin/categoryController');
const productController = require('../controllers/admin/productCotroller');
const orderController = require('../controllers/admin/orderController');
const offerController = require('../controllers/admin/offerAndReportController');


const {multerUpload} = require('../middlewares/multer');
const { validateObjectId } = require('../middlewares/validate')



const multer = require('multer');
const { userAuth, adminAuth } = require('../middlewares/auth');
const path = require('path');
const Order = require("../models/orderSchema");
const uploadSingle = multerUpload('image');
const uploadMultiple = multerUpload('productImages', 4, true);



// Error and login routes
router.get('/pageerror', adminController.pageerror);
router.get('/adminlogin', adminController.loadLogin);
router.post('/login', adminController.login);
router.get('/logout',adminAuth,adminController.logout);

// Admin dashboard
router.get('/dashboard', adminAuth, adminController.loadDashboard);

// User management routes
router.put('/userManagement/ban',adminAuth,customerController.userBan);
router.get('/userManagement/view',adminAuth,customerController.viewUserDetails);
router.get('/userManagement',adminAuth, customerController.loadUserManagementPage);
router.get('/userManagement/Search',adminAuth, customerController.getUsersAsJson);

// Category management routes
router.get("/category",adminAuth, categoryController.loadCategoryManagement);
router.get('/categoryUpdate/:id',adminAuth,categoryController.loadUpdateCategory);
router.put("/category/update/:id",adminAuth,uploadSingle,categoryController.updateCategory);
router.get("/category/add", adminAuth,categoryController.loadAddCategoryPage);
router.post("/category/add",adminAuth,uploadSingle, categoryController.addCategory);
router.get('/category/del',adminAuth, categoryController.loadDelCategoryPage);
router.put('/category/unlink',adminAuth, categoryController.deleteCategory);
router.put('/category/recover/:id',adminAuth, categoryController.recoverCategory);

// product Management 

router.get("/products",adminAuth, productController.loadProductManagement);
router.get("/products/add",adminAuth, productController.loadAddProductsPage);
router.post('/products/add',adminAuth,uploadMultiple, productController.addProduct);
router.get("/products/:id/update",adminAuth, productController.loadUpdateProduct);
router.put('/products/:id',adminAuth, uploadMultiple, productController.updateProduct);
router.get('/products/deleted',adminAuth, productController.loadDelProductPage);
router.put('/productManagement/unlink',adminAuth, productController.deleteProduct);
router.patch('/products/recover/:id',adminAuth, productController.recoverProduct);


//Order management
router.get('/orders',adminAuth,orderController.viewOrder);
router.get('/orders/:orderId',adminAuth,orderController.viewOderDetails)
router.post('/orders/change-status',adminAuth,orderController.changeOrderStatus);
router.get('/order/view/:id',adminAuth,orderController.OrderProductDetail);

router.patch('/orders/cancel',adminAuth,orderController.AdminorderCancel);


router.patch('/orders/return/approve',adminAuth,orderController.approveReturn);
router.patch('/orders/return/reject',adminAuth,orderController.rejectReturn);
router.get('/order/invoice/:orderId',adminAuth,orderController.invoice)


//coupon
router.get('/coupon',adminAuth,offerController.couponManagement);
router.post('/coupon/add',adminAuth,offerController.createCoupon);
router.get('/coupon/view',adminAuth,offerController.getCoupons);
router.put('/coupons/:id',adminAuth,offerController.updateCoupon);

router.delete("/couponsDel/:id",offerController.deleteCoupon)

//sales
router.get('/sales',adminAuth,offerController.getSalesReports);



//offer

router.get('/offer',adminAuth,offerController.loadOffer)
router.post('/offers',adminAuth,offerController.applyOffer)
router.delete('/offer/:type/:id',adminAuth,offerController.deleteOffer)




router.use((req, res) => {
    res.status(404).render("page-404", { message: "Admin route not found" });
  });
  
module.exports = router;
