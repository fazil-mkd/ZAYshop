const express = require("express")
const router = express.Router()
const userController = require("../controllers/user/userController")
const passport = require("passport")
const crypto = require('crypto');
const session = require('express-session')

const User =require('../models/userSchema')
router.get('/pageNotFound',userController.pageNotFound)

router.get("/pageNotFound",userController.pageNotFound)
router.get("/",userController.loadHomepage)
router.get('/signup',userController.loadSignup)
router.get('/shop',userController.loadShopping)
router.post('/signup',userController.signup)
router.post("/verify-otp",userController.verifyOtp);
router.post("/resend-otp",userController.resendOtp);
router.get("/userlogin",userController.userlogin);

const { userAuth, adminAuth } = require('../middlewares/auth');

const isBlockedMiddleware = require('../middlewares/UserBlock');





router.use(isBlockedMiddleware);

router.get('/auth/google', 
    passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get('/auth/google/callback', 
    passport.authenticate('google', { failureRedirect: '/' }),
    async (req, res) => {
        try {
            const email = req.user.email;
            const findUser = await User.findOne({ isAdmin: 0, email });

            if (!findUser) {
                return res.redirect('/register'); 
            }

            req.session.user = findUser;
            req.session.userId = findUser._id;
            res.redirect('/'); 
        } catch (error) {
            res.redirect('/');  
        }
    }
);





router.post("/forget-verify-otp",userController.verifyOtp);
router.post("/forget-resend-otp",userController.resendOtp);




router.get('/auth/google/callback',passport.authenticate('google',{failureRedirect:'/signup'}),(req,res)=>{
res.redirect('/')
});

router.get("/login",userController.loadLogin);
router.post('/login',userController.login)
router.get('/product/:id',userController.productDetail)
router.get('/logout',userController.userlogout)
router.get('/profile/:id',userAuth,userController.profile)


router.get("/checkout",userAuth,userController.loadcheckout);



router.put('/update-profile',userAuth,userController.updateProfile)
router.get('/update-profile/:id',userAuth,userController.loadUpdateProfile)



//order

router.get('/orderDetails',userAuth,userController.loaduserOrderDetails)
router.post('/place-order',userAuth,userController.placeOrder)
router.post('/checkout/add-address',userAuth,userController.CheckoutaddAddress);
router.post('/user/orders/cancel',userAuth,userController.orderCancel);
router.get('/user/orders/:orderId',userAuth,userController.viewOderDetails);
router.get('/order/:orderId',userAuth,userController.orderSummery);
router.delete('/product/cancel',userAuth, userController.productCancel);


// address
router.post('/add-address',userAuth,userController.addAddress);
router.get('/address',userAuth,userController.loadAddress);
router.get('/update-Address/:addressId',userAuth,userController.loadUpdateAddress);
router.put('/update-address/:id',userAuth,userController.updateAddress);
router.delete('/delete-address/:userId/:addressId',userAuth,userController.deleteAddress);


//cart manage
router.get("/cart",userAuth,userController.loadCart);
router.post('/cart/add',userAuth,userController.addToCart);
router.post('/update-quantity',userAuth,userController.updateQuantity);
router.delete('/cart/remove-item',userAuth,userController.removeFromCart);


router.get('/changepassword',userAuth,userController.loadChangePass)
router.post('/changePass',userAuth,userController.changePass);





router.get('/forget',userController.forgetPassword);
router.get('/shop/filter',userAuth,userController.filterProducts);
router.get('/wallet',userAuth,userController.wallet)
router.post('/create-order',userAuth,userController.createOrder);


router.get('/wishlist',userAuth,userController.whishlist)
router.post("/wishlist/add",userAuth,userController.addToWishlist);
router.post("/wishlist/remove",userAuth,userController.removeFromWishlist);
router.delete('/wishlist/:productId',userAuth,userController.removeFromWhishlist);


router.post('/update-wallet',userAuth,userController.AddWallet);

router.post("/forget-password",userController.PostforgetPassword);
router.post('/verify-forget-otp',userController.forgetOtp)
router.patch("/reset-password",userController.forgetChange)

router.patch('/product/return',userAuth,userController.productReturn);



//coupon
router.post('/apply-coupon',userAuth,userController.applayCoupon);
router.post("/remove-coupon",userAuth,userController.removeCoupon)


router.get('/checkout/updateAddress/:addressId',userAuth,userController.loadCheckUpdateAddress);

router.put('/checkout/updateAddress/:id',userAuth,userController.CheckoutupdateAddress);



router.get('/order/invoice/:orderId',userAuth,userController.invoice)


module.exports = router;