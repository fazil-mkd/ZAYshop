
const User = require('../../models/userSchema');
const nodemailer = require('nodemailer');
const env = require("dotenv").config();
const bcrypt = require('bcrypt');
const { render } = require('ejs');
const Category = require('../../models/categorySchema');
const Product = require('../../models/productSchema')
const cloudinary = require('cloudinary');
const { loadUpdateProduct } = require('../admin/productCotroller');
const res = require('express/lib/response');
const razorpayInstance = require('../../config/razorpay');
const Wishlist = require('../../models/wishlistSchema');
const Wallet = require('../../models/walletSchema');
const cron = require('node-cron');
const Coupon = require('../../models/couponSchema');
const passport = require('../../config/passport');
const PDFDocument = require('pdfkit'); 


const Order = require('../../models/orderSchema');
const Address = require('../../models/addressSchema')
const Cart = require('../../models/cartSchema')
const Variant = require('../../models/ProductVariants')
const mongoose = require('mongoose');

const Notification = require('../../models/NotificationSchema');

const NotFoundError = require('../../helpers/NotFoundError');




const loadSignup = async (req, res) => {
  try {
    return res.render('signUp')
  } catch (error) {
    console.log('Home page not loading:', error)
    res.status(500).send('Server Error');
  }
}


const loadShopping = async (req, res, next) => {
  try {
    const userId = req.session.userId;

    console.log("User ID:", userId);


      const sortOption = req.query.sortOption || '';
      const page = parseInt(req.query.page) || 1;
      const productsPerPage = 9; 
      const skip = (page - 1) * productsPerPage;

    
      const query = { isDeleted: false };

      let sortCriteria = {};
      switch (sortOption) {
          case 'low-to-high':
              sortCriteria = { price: 1 };
              break;
          case 'high-to-low':
              sortCriteria = { price: -1 };
              break;
          case 'latest':
              sortCriteria = { createdAt: -1 };
              break;
          case 'A-Z':
              sortCriteria = { name: 1 };
              break;
          case 'Z-A':
              sortCriteria = { name: -1 };
              break;
          default:
              sortCriteria = { createdAt: -1 }; 
      }

      // Price 
      if (req.query.maxPrice) {
          query.price = { $lte: parseInt(req.query.maxPrice) };
      }

      // Brand 
      if (req.query.brands) {
          const brands = req.query.brands.split(',');
          query.brand = { $in: brands };
      }

      // Category 
      if (req.query.categories) {
          const categories = req.query.categories.split(',');
          query.category = { $in: categories };
      }
      // Color 
      console.log('Colors in query:', req.query.colors); 
      if (req.query.colors) {
          const colors = req.query.colors.split(',');
          query['variants.color'] = { $in: colors };
      }

    
      const forfilteredProducts = await Product.find(query)
  .populate({
    path: 'category', 
    match: { isListed: true },  
  })
  .sort(sortCriteria)
  .skip(skip)
  .limit(productsPerPage)
  .exec();


  const products = forfilteredProducts.filter(filteredProduct => filteredProduct.category !== null);



      const productVariants = await Variant.find({});
      const colorSizeStockMap = {};

      productVariants.forEach((variant) => {
          if (variant.size && variant.color) {
              if (!colorSizeStockMap[variant.color]) {
                  colorSizeStockMap[variant.color] = {};
              }

              if (typeof variant.size === 'string' && variant.size.includes(',')) {
                  const sizeStockPairs = variant.size.split(',');
                  sizeStockPairs.forEach(pair => {
                      const [size, stock] = pair.split(':');
                      colorSizeStockMap[variant.color][size] = 
                          (colorSizeStockMap[variant.color][size] || 0) + parseInt(stock, 10);
                  });
              } else if (variant.size && variant.stock) {
                  colorSizeStockMap[variant.color][variant.size] = 
                      (colorSizeStockMap[variant.color][variant.size] || 0) + variant.stock;
              }
          }
      });

     
      const totalProducts = await Product.countDocuments(query);
      const totalPages = Math.ceil(totalProducts / productsPerPage);

  
      if (!products || products.length === 0) {
          return res.render('shop', {
              message: 'No products found',
              currentPage: page,
              totalPages,
              sortOption,
              colorSizeStockMap: {}
          });
      }

      const productsWithImages = products.map(product => {
        const cloudinaryImages = product.images.map(imageId => {
            const imagePath = imageId.replace(/^https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\//, ''); 
            return `https://res.cloudinary.com/dqtfnzylu/image/upload/${imagePath}`;  
        });
        return { ...product.toObject(), cloudinaryImages };
      });

      
      const brands = await Product.distinct('brand', { isDeleted: false });
      const categories = await Category.find({ isListed: true });

      if (req.xhr || req.headers.accept.indexOf('json') > -1) {
          return res.json({
              success: true,
              products: productsWithImages,
              pagination: {
                  currentPage: page,
                  totalPages,
                  totalProducts
              }
          });
      }

    
      let cart = await Cart.findOne({userId:userId})
     let wishlist = await Wishlist.findOne({ userId }).populate('products') 

let offerEndDate = products.offerEndDate

      let currentDate = new Date();
          

      res.render('shop', {
          products: productsWithImages,
          currentPage: page,
          totalPages,
          sortOption,
          colorSizeStockMap,
          brands,
          categories,
          filters: {
              maxPrice: req.query.maxPrice,
              selectedBrands: req.query.brands ? req.query.brands.split(',') : [],
              selectedCategories: req.query.categories ? req.query.categories.split(',') : [],
              selectedColors: req.query.colors ? req.query.colors.split(',') : []
          },
          userId,
          offerEndDate,
          currentDate,
          cart,
          wishlist,
      });

      if (page > totalPages) {
        return res.redirect(`/shop?page=${totalPages}&sortOption=${sortOption}`);
    }


  } catch (err) {
      res.redirect('/home')
  }
};



const filterProducts = async (req, res,next) => {
  try {
      const query = { isDeleted: false };

 
      if (req.query.maxPrice) {
          query.price = { $lte: parseInt(req.query.maxPrice) };
      }

      if (req.query.brands) {
          query.brand = { $in: req.query.brands.split(',') };
      }

      if (req.query.categories) {
          query.category = { $in: req.query.categories.split(',') };
      }



      const products = await Product.find(query)
          .populate('category')
          .populate('brand');

      const productsWithImages = products.map(product => ({
          ...product.toObject(),
          cloudinaryImages: product.images.map(imageId => 
             `https://res.cloudinary.com/<cloud_name>/image/upload/${imageId}`
          )
      }));

      res.json({
          success: true,
          products: productsWithImages
      });

  } catch (err) {
      res.redirect('/home')
  }
};




const pageNotFound = async (req, res) => {
  try {
    res.render("page-404")
  } catch (error) {
    res.redirect("/pageNotFound")
  }
}

const loadHomepage = async (req, res,next) => {
  try {

    const user = req.session.user;
    const userId = req.session.userId;
    console.log(user)

    let categoryData = await Category.find({ isDeleted: false, isListed: true })
    let productData = await Product.find({ isDeleted: false })
    let cart = await Cart.findOne({userId:userId})
    let wishlist = await Wishlist.findOne({ userId }).populate('products') 


    if (user) {
      const userData = await User.findOne({ _id: user._id });
      res.render('home', { user: userData, products: productData, categories: categoryData,cart,wishlist });
    } else {
      return res.render('home', { products: productData, categories: categoryData })
    }
  } catch (err) {
   next(err)
  }
}

const userlogin = async (req, res,next) => {
  try {
    return res.render("userlogin");
  } catch (error) {
   next(error)
  }
}


//OTP generation /////

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

//OTP Verification //////////

async function sendVerificationEmail(email, otp) {
  try {
    console.log(`Sending OTP to: ${email}`);
    console.log(`OTP: ${otp}`);

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.NODEMAILER_EMAIL,
        pass: process.env.NODEMAILER_PASSWORD
      }
    });

    const info = await transporter.sendMail({
      from: process.env.NODEMAILER_EMAIL,
      to: email,
      subject: "Verify your account",
      text: `Your OTP is ${otp}`,
      html: `<b>Your OTP: ${otp}</b>`
    });

    console.log("Email Info:", info);

    return info.accepted.length > 0;
  } catch (error) {
    console.error("Error sending email", error.message);
    return false;
  }
}

// sign up ///////////////////////////////////////////////////////////////////





const signup = async (req, res,next) => {

  try {
    const { name, phone, email,referralCode, password, confirmPassword } = req.body;
    console.log(name, phone, email, password, confirmPassword)
    if (password !== confirmPassword) {
      return res.render("signup", { message: "Passwords do not match" });
    }
    const findUser = await User.findOne({ email });
    if (findUser) {
      return res.render('signup', { message: "User with this email already exists" })
    }


    let referredByUser = null;
    if (referralCode) {
      referredByUser = await User.findOne({ referalCode:referralCode });
      if (!referredByUser) {
         return res.render('signup', { message: "Invalid referral code" })
      }
    }


    const otp = generateOtp();

    const emailSent = await sendVerificationEmail(email, otp);

    if (!emailSent) {
      return res.json("email-error ")
    }

    req.session.userOtp = otp;
    req.session.userData = { name, phone, email, password };
   

    if (referralCode) {
      req.session.userData.referralCode = referralCode; 
    }

    res.render("verify-otp")
    console.log("OTP Sent", otp);

  } catch (err) {
    next(err);
  }
}


const PostforgetPassword = async (req, res,next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.render('forget-password', { message: 'Email is required' });
    }

    const findUser = await User.findOne({ email });
    if (!findUser) {
      return res.render('forget-pass', { message: "No account found with this email address." });
    }

    const otp = generateOtp();
    const emailSent = await sendVerificationEmail(email, otp);

    if (!emailSent) {
      return res.render('forget-pass', { message: 'Failed to send OTP. Please try again later.' });
    }


    req.session.resetData = { email, otp };
   

    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
        return res.render('forget-password', { message: 'Failed to save session.' });
      }

    

    });
  } catch (err) {
    console.error('forgetPassword error:', err);
    next(err);
  }
};





const forgetResendOtp = async (req, res,next) => {
  try {


    const email = req.session.resetData?.email;



    console.log("Email in session:", email);

    if (!email) {
      return res.status(400).json({ success: false, message: "Email not found in session" });
    }


    const otp = generateOtp();


    const emailSent = await sendVerificationEmail(email, otp);
console.log('data sended')
    if (emailSent) {
      console.log("Resend OTP:", otp);
      res.status(200).json({ success: true, message: "OTP Resend Successfully" });
    } else {
      res.status(500).json({ success: false, message: "Failed to resend OTP. Please try again." });
    }
  } catch (error) {
    console.error("Error resending OTP", error);
    next(error);
  }
};









const forgetOtp = (req, res,next) => {
  try {
    const { otp } = req.body;

    console.log('Session during OTP verification:', req.session);

    const storedOtp = req.session.resetData?.otp;

    if (!otp) {
      return res.status(400).json({ message: 'OTP is required' });
    }

    if (!storedOtp) {
      return res.status(400).json({ message: 'No OTP was generated. Please request a new one.' });
    }

    if (otp === storedOtp) {
      return res.render('changeForgetPass', { message: 'OTP verified successfully. Please reset your password.' });
    } else {
      return res.render('forget-pass', { message: 'invalid OTP.' });
    }
  } catch (err) {
    console.error('forgetOtp error:', err);
    next(err);
  }
};





const forgetChange = async (req, res,next) => {
  const { password, confirmPassword } = req.body;

  if (password !== confirmPassword) {
    return res.status(400).json({ message: "Passwords do not match." });
  }

  if (password.length < 8) {
    return res.status(400).json({ message: "Password must be at least 8 characters long." });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  try {
    const user = await User.findOne({ email: req.session.resetData?.email });
    if (!user) {
      return res.status(400).json({ message: "User not found." });
    }

    const isSamePassword = await bcrypt.compare(hashedPassword, user.password);
    if (isSamePassword) {
      return res.status(400).json({ message: "New password cannot be the same as the old password." });
    }


    user.password = hashedPassword;
    await user.save();

    req.session.resetData = null;

    return res.json({ success: true, message: "Password reset successful!" });
  } catch (err) {
    console.error("Error resetting password:", err);
    next(err);
  }
};










const securePassword = async (password,next) => {

  try {
    const passwordHash = await bcrypt.hash(password, 10)
    return passwordHash;
  } catch (err) {
    next(err);
  }
}






const verifyOtp = async (req, res,next) => {
  try {
    const { otp } = req.body;
    console.log(otp)

    if (otp === req.session.userOtp) {
      const user = req.session.userData
      const passwordHash = await securePassword(user.password)

     const referralCode = user.referralCode;
  
 
      let referredByUser = null;
      if (referralCode && referralCode.trim() !== "") {  
        referredByUser = await User.findOne({ referalCode: referralCode });
      }
      
      const generateReferralCode = () => {
        return Math.random().toString(36).substr(2, 8).toUpperCase();
      };
      
      const newUser = new User({
        name: user.name,
        email: user.email,
        phone: user.phone,
        password: passwordHash,
        referalCode: generateReferralCode(),
          referredBy: referredByUser ? referredByUser.name : null,
      })

      await newUser.save()

      if(referralCode && referralCode.trim() !== ""){

      const newWallet = new Wallet({ user: newUser._id, walletBalance: 0, transactions: [] });
      newWallet.walletBalance+=50
      newWallet.transactions.push({
        type: "credit",
        amount: 50,
        balanceAfterTransaction:newWallet.walletBalance,
        description: "Amount Credited in Wallet  for using a referral code ",
      });
      await newWallet.save();
    
    }

      if (referredByUser) {
        const referrerWallet = await Wallet.findOne({ user: referredByUser._id });
    
        if (referrerWallet) {
          referrerWallet.walletBalance += 100; 
          referrerWallet.transactions.push({
            type: "credit",
            amount: 100,
            balanceAfterTransaction: referrerWallet.walletBalance,
            description: "Referral bonus",
          });
    
          await referrerWallet.save();
        }
      }

      req.session.user = newUser;
      req.session.userId=newUser._id
      res.json({ success: true, redirect: "/" })
    } else {
      res.status(400).json({ success: false, message: "Invalid OTP, please try again" })
    }
  } catch (err) {
    console.error("Error Veryfying OTP", err)
    next(err);
  }
}





const resendOtp = async (req, res,next) => {
  try {

    const { email } = req.session.userData || {};

    console.log("Email in session:", email);

    if (!email) {
      return res.status(400).json({ success: false, message: "Email not found in session" });
    }


    const otp = generateOtp();
    req.session.userOtp = otp;


    const emailSent = await sendVerificationEmail(email, otp);

    if (emailSent) {
      console.log("Resend OTP:", otp);
      res.status(200).json({ success: true, message: "OTP Resend Successfully" });
    } else {
      res.status(500).json({ success: false, message: "Failed to resend OTP. Please try again." });
    }
  } catch (error) {
    console.error("Error resending OTP", error);
    next(error);
  }
};


const loadLogin = async (req, res) => {
  try {
    if (!req.session.user) {
      return res.render("login")
    } else {
      res.redirect("/")
    }
  } catch (err) {
    res.redirect("/pageNotFound")
  }
}



const login = async (req, res) => {

  try {
    const { email, password } = req.body;

    const findUser = await User.findOne({ isAdmin: 0, email });

    if (!findUser) {
      return res.render("login", { message: "User not found" })
    }
    if (findUser.isBlocked) {
      return res.render('login', { message: "User is blocked by admin" })
    }

    if (!password || !findUser.password) {
      return res.render("login", { message: "Invalid password or user data" });
    }
    const passwordMatch = await bcrypt.compare(password, findUser.password);

    if (!passwordMatch) {
      return res.render('login', { message: "Incorrect Password " })
    }

    req.session.user = findUser;
    req.session.userId = findUser._id;
    res.redirect('/');

  } catch (err) {

    res.render("login", { message: "login failed. please try again later" })
  }
}




const userlogout = (req, res,next) => {
  try {

    req.session.destroy((err) => {
      if (err) {
        console.error("Error destroying session:", err);
        return res.status(500).send("Failed to log out");
      }

      res.clearCookie('connect.sid');
      res.redirect('/');
    });
  } catch (err) {
    next(err);
  }
};



const productDetail = async (req, res,next) => {
  try {
    const userId = req.session.userId
    let Id = req.params.id
    const product = await Product.findById(Id)
      .populate('category')
      .exec();

      const categoryId = product.category._id;

      
      const otherProductsInCategory = await Product.find({
        category: categoryId,
        _id: { $ne: Id },
        isDeleted: false
      }).exec();
      

    const ProductVariants = await Variant.find({ productId: Id })

       
let colorSizeStockMap = {};

let processedVariants = {};

ProductVariants.forEach((variant) => {
    if (variant.size && variant.color) {
        const sizeStockData = variant.size.split(',');
        
        sizeStockData.forEach((item) => {
            const [size, stock] = item.split(':').map(part => part.trim());

            const colorSizeKey = `${variant.color}-${size}`;

            if (!processedVariants[colorSizeKey]) {
                if (!colorSizeStockMap[variant.color]) {
                    colorSizeStockMap[variant.color] = {};
                }
                colorSizeStockMap[variant.color][size] = (colorSizeStockMap[variant.color][size] || 0) + parseInt(stock, 10);
                
                processedVariants[colorSizeKey] = true;
            }
        });
    }
});

console.log(colorSizeStockMap);


               
let cart = await Cart.findOne({userId:userId})
let wishlist = await Wishlist.findOne({ userId }).populate('products') 



const cloudinaryImages = product.images.slice(-4).map(imageId => {
  return `https://res.cloudinary.com/<cloud_name>/image/upload/${imageId}`;
});


    res.render('productDetails', {
      product,
      cloudinaryImages,
      colors: Object.keys(colorSizeStockMap),
      sizes: [], 
      colorSizeStockMap: JSON.stringify(colorSizeStockMap), 
      ProductVariants,
      otherProductsInCategory,
      cart,
      wishlist,
    },
   
  );

    console.log(cloudinaryImages);
  } catch (err) {
    next(err);
  }
};






const profile = async (req, res,next) => {
  try {
    const user = await User.findById(req.params.id)
      .exec();

    if (!user) {
       throw new NotFoundError('User not found');
    }
    res.render('userProfile', {
      user,
    });

    console.log(user);
  } catch (err) {
    next(err);
  }
}


const updateProfile = async (req, res) => {
  try {
    const { name, phone, email } = req.body;


    if (email && !/^\S+@\S+\.\S+$/.test(email)) {
      return res.status(400).json({ success: false, msg: 'Invalid email format' });
    }
    if (phone && !/^\d{10}$/.test(phone)) {
      return res.status(400).json({ success: false, msg: 'Invalid phone number format' });
    }

    const userId = req.session.userId; 
    if (!userId) {
      return res.status(401).json({ success: false, msg: 'Unauthorized' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, msg: 'User not found' });
    }


    if (name) user.name = name;
    if (phone) user.phone = phone;
    if (email) user.email = email;

    await user.save();

    res.status(200).json({
      success: true,
      msg: 'Profile updated successfully',
      data: { name: user.name, phone: user.phone, email: user.email },
    });


  } catch (err) {
    next(err);
  }
};




const loadUpdateProfile = async (req, res,next) => {
  try {
    const { id } = req.params;

    const user = await User.findOne({ _id: id });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    res.render('updateProfile', { user });
  } catch (err) {
    console.error('Error fetching User details:', err);
    next(err);
  }
};

const loadAddress = async (req, res,next) => {
  try {
    if (!req.session.user || !req.session.userId) {
      return res.status(400).send("User not authenticated or user ID missing.");
    }
    const userId = req.session.userId;

    console.log("User ID:", userId);


    const userAddress = await Address.findOne({ userId });

    console.log("User address:", userAddress);

    if (!userAddress || !userAddress.address || userAddress.address.length === 0) {
      return res.render('addressManagement', {
        message: 'No addresses found for this user.',
        addresses: []
      });
    }

    res.render('addressManagement', { addresses: userAddress.address || [] });
  } catch (err) {
    console.error('Error fetching addresses:', err);
    next(err);
  }
};


const addAddress = async (req, res,next) => {
  try {
    const { fullName, streetAddress, aptNumber, city, state, pincode, country, phone, altPhone, addressType } = req.body;
    const userId = req.session.userId;

    const newAddress = {
      fullName,
      streetAddress,
      aptNumber,
      city,
      state,
      pincode,
      country,
      phone,
      altPhone,
      addressType
    };

    const userAddress = await Address.findOne({ userId });

    if (!userAddress) {
      const newUserAddress = new Address({
        userId,
        address: [newAddress],
      });
      await newUserAddress.save();
      return res.status(201).json({ message: 'Address added successfully', data: newUserAddress });
    }

    userAddress.address.push(newAddress);
    await userAddress.save();

    return res.status(200).json({ message: 'Address added successfully', data: userAddress });
  } catch (err) {
    console.error(err);
    return   next(err);
  }
};





const CheckoutaddAddress = async (req, res,next) => {
  try {
    const { fullName, streetAddress, aptNumber, city, state, pincode, country, phone, altPhone, addressType } = req.body;
    const userId = req.session.userId;

    const newAddress = {
      fullName,
      streetAddress,
      aptNumber,
      city,
      state,
      pincode,
      country,
      phone,
      altPhone,
      addressType
    };

    const userAddress = await Address.findOne({ userId });

    if (!userAddress) {
      const newUserAddress = new Address({
        userId,
        address: [newAddress],
      });
      await newUserAddress.save();
      req.flash('success', 'Address added successfully!');
     return  res.redirect('/checkout');
    }

    userAddress.address.push(newAddress);
    await userAddress.save();

    req.flash('success', 'Address added successfully!');
     return  res.redirect('/checkout');
  } catch (err) {
    console.error(err);
    return   next(err);
  }
};











const loadUpdateAddress = async (req, res,next) => {
  try {
    const { addressId } = req.params;
    const userId = req.session.userId;


    const userAddress = await Address.findOne({ userId });


    if (!userAddress) {
      throw new NotFoundError( 'User address record not found');
    }

    const address = userAddress.address.find(address => address._id.toString() === addressId);


    if (!address) {
      throw new NotFoundError('Address not found' );
    }

    return res.render('updateAddress', {
      message: 'Address loaded successfully',
      address,
    });

  } catch (err) {
    console.error(err);
    return next(err);
  }
};




const loadCheckUpdateAddress = async (req, res,next) => {
  try {
    const { addressId } = req.params;
    const userId = req.session.userId;


    const userAddress = await Address.findOne({ userId });


    if (!userAddress) {
      throw new NotFoundError( 'User address record not found');
    }

    const address = userAddress.address.find(address => address._id.toString() === addressId);


    if (!address) {
      throw new NotFoundError('Address not found' );
    }

    return res.render('CheckoutUpdateAddress', {
      message: 'Address loaded successfully',
      address,
    });

  } catch (err) {
    console.error(err);
    return next(err);
  }
};









const updateAddress = async (req, res, next) => {
  try {
    const { fullName, streetAddress, aptNumber, city, state, pincode, country, phone, altPhone, addressType } = req.body;
    const userId = req.session.userId;

    console.log('Form data received:', req.body);

 
    if (!fullName || !streetAddress || !city || !state || !pincode || !country || !phone) {
      return res.status(400).json({ message: 'Missing required fields.' });
    }

    const userAddress = await Address.findOne({ userId });

    if (!userAddress) {
      return res.status(404).json({ message: 'User address record not found.' });
    }

    const address = userAddress.address.find(addr => addr._id.toString() === req.params.id);

    if (!address) {
      return res.status(404).json({ message: 'Address not found.' });
    }

  
    Object.assign(address, { fullName, streetAddress, aptNumber, city, state, pincode, country, phone, altPhone, addressType });

    await userAddress.save();

    return res.status(200).json({ message: 'Address updated successfully!', updatedAddress: address });

  } catch (err) {
    console.error('Update Address Error:', err);
    return res.status(500).json({ message: 'Internal Server Error', error: err.message });
  }
};





const deleteAddress = async (req, res,next) => {
  const { userId, addressId } = req.params;

  try {

    const addressDoc = await Address.findOne({ userId });

    if (!addressDoc) {
      throw new NotFoundError( 'User addresses not found.');
    }

    const updatedAddresses = addressDoc.address.filter(
      (addr) => addr._id.toString() !== addressId
    );

    if (addressDoc.address.length === updatedAddresses.length) {
      throw new NotFoundError('Address not found.' );
    }

    addressDoc.address = updatedAddresses;
    await addressDoc.save();

    res.status(200).json({ message: 'Address deleted successfully.' });
  } catch (err) {
    console.error('Error deleting address:', err);
    next(err);
  }
};







const loaduserOrderDetails = async (req, res,next) => {
  try {
    const userId = req.session.userId;
 
    const page = parseInt(req.query.page) || 1;
    const PerPage = 10;
    const skip = (page - 1) * PerPage;

    const orders = await Order.find({userId:userId}).sort({ createdAt: -1 }).skip(skip).limit(PerPage)
  

    const total = await Order.countDocuments({userId:userId});
    const totalPages = Math.ceil(total / PerPage);

    for (let order of orders) {

      for (let item of order.orderedItems) {
        const product = await Product.findById(item.product);
        item.productDetails = product;

      }
    }

    res.render('orderDetails', { orders,currentPage: page, totalPages  });
  } catch (err) {
    console.error('Error fetching order details:', err);
    next(err);
  }
};








const addToCart = async (req, res,next) => {
  try {
    const {
      'product-id': productId,
      'product-title': productTitle,
      'product-size': productSize,
      'product-color': productColor,
      'product-quantity': productQuantity,
      'product-brand':brand,
    } = req.body;

console.log('brand',brand)

    const userId = req.session.userId;

    if (!req.session.userId) {
      req.flash('error','please login');
      return res.redirect('/Shop');
    }



    if (!userId || !productId || !productTitle || !productSize || !productColor || !productQuantity) {
      req.flash('error','Missing required fields');
      return res.redirect('/Shop');
    }

    const product = await Product.findById(productId).populate('category') 
    .exec();
   
   console.log(product)

    if (!product) {
      req.flash('error', 'Product not found');
      return res.redirect('/Shop');
    }

    if (product.isDeleted) {
      req.flash('error', 'This Product Is Not Available Now');
      return res.redirect('/Shop');
    }

 

    if (!product.category || !product.category.isListed) {
      req.flash('error', 'This Product Category Is Unavailable');
      return res.redirect('/Shop');
    }


    const ProductVariants = await Variant.find({ productId: productId })

       
let colorSizeStockMap = {};

let processedVariants = {};

ProductVariants.forEach((variant) => {
    if (variant.size && variant.color) {
        const sizeStockData = variant.size.split(',');
        
        sizeStockData.forEach((item) => {
            const [size, stock] = item.split(':').map(part => part.trim());

            const colorSizeKey = `${variant.color}-${size}`;

            if (!processedVariants[colorSizeKey]) {
                if (!colorSizeStockMap[variant.color]) {
                    colorSizeStockMap[variant.color] = {};
                }
                colorSizeStockMap[variant.color][size] = (colorSizeStockMap[variant.color][size] || 0) + parseInt(stock, 10);
                
                processedVariants[colorSizeKey] = true;
            }
        });
    }
});



    const stockCount = colorSizeStockMap[productColor]?.[productSize];

    const currentDate = new Date();
    const offerEndDate = new Date(product.offerEndDate);
    const offerStartDate = new Date(product.offerStartDate);
    const isOfferActive = product.offerPrice > 0 && offerEndDate >= currentDate && offerStartDate <= currentDate && product.offerPrice!=product.price;
    let price = isOfferActive ? product.offerPrice : product.price;
    
    const quantityToAdd = parseInt(productQuantity, 10);

    if (quantityToAdd > stockCount) {
      req.flash('error',`Only ${stockCount} items available in stock`);
      return res.redirect('/Shop');

    }

    const totalPrice = price * quantityToAdd;

    let cart = await Cart.findOne({ userId });

    if (!cart) {
      cart = new Cart({
        userId,
        items: [],
      });
    }

    console.log('cart iteeeeeeeemmmmmmmmsssssssssss', cart.items)

    console.log('Cart Items:', cart.items);

    cart.items.forEach(item => {
      console.log('Item:', item);
      console.log('Product ID:', item.productId.toString());
      console.log('Product Size:', item.productSize);
      console.log('Product Color:', item.productColor);
    });

    const existingItem = cart.items.find(
      (item) =>
        item.productId.toString() === String(productId) &&
        item.productColor === productColor &&
        item.productSize === productSize
    );

    console.log('Existing item:', existingItem);



    if (existingItem) {

      if (existingItem.quantity === 10) {
        req.flash('error', 'Cannot add more than 10 items.');
        return res.redirect('/Shop');
      }
    

      if (existingItem.quantity < stockCount) {
        existingItem.quantity += quantityToAdd;
        existingItem.totalPrice = existingItem.quantity * price;
      } else {

        existingItem.quantity = stockCount;
        req.flash('error', `Product stock limit reached: Only ${stockCount} left.`);
        return res.redirect('/Shop');
      }
    } else {
      cart.items.push({
        productId,
        productTitle,
        productSize,
        productColor,
        quantity: quantityToAdd,
        price,
        totalPrice,
        addedAt: new Date(),
        brand:brand,
      });
    }

    cart.updatedAt = new Date();
    cart.iscouponApplied=false
    await cart.save();

    req.flash('success', 'Product added to cart successfully!');
    res.redirect('/Shop');

  } catch (err) {
    console.error('Error adding to cart:', err);
    return next(err);
  }
};





const loadCart = async (req, res,next) => {
  try {
    if (!req.session || !req.session.user) {
      throw new NotFoundError('You need to log in to view your cart.');
    }

    const userId = req.session.userId;
    const userCart = await Cart.findOne({ userId });
    let cart = await Cart.findOne({userId:userId})
    let wishlist = await Wishlist.findOne({ userId }).populate('products') 

    if (!userCart || userCart.items.length === 0) {
      return res.render('shoppingCart', { message: 'Your cart is empty', cartItems: [], stockData: {},cart,wishlist });
      
    }
 

    const cartItems = await Promise.all(
      userCart.items.map(async (item) => {
        const product = await Product.findById(item.productId).select('name price images  category isOffer offerPrice');
 
        const finalPrice = product.isOffer ? product.offerPrice : product.price;

        if (!product) {
          console.warn(`Product with ID ${item.productId} not found`);
          return null;
        }


        const ProductVariants = await Variant.find({ productId: item.productId });

        let colorSizeStockMap = {};

        let processedVariants = {};
        
        ProductVariants.forEach((variant) => {
            if (variant.size && variant.color) {
                const sizeStockData = variant.size.split(',');
                
                sizeStockData.forEach((item) => {
                    const [size, stock] = item.split(':').map(part => part.trim());
        
                    const colorSizeKey = `${variant.color}-${size}`;
        
                    if (!processedVariants[colorSizeKey]) {
                        if (!colorSizeStockMap[variant.color]) {
                            colorSizeStockMap[variant.color] = {};
                        }
                        colorSizeStockMap[variant.color][size] = (colorSizeStockMap[variant.color][size] || 0) + parseInt(stock, 10);
                        
                        processedVariants[colorSizeKey] = true;
                    }
                });
            }
        });

        console.log(finalPrice)

        return {
          ...product.toObject(),
          colorSizeStockMap,
          cloudinaryImages: product.images,
          quantity: item.quantity,
          totalPrice:finalPrice*item.quantity,
          color: item.productColor,
          size: item.productSize,
        };
      })
    );

    const validCartItems = cartItems.filter((item) => item !== null);

    const stockData = validCartItems.reduce((acc, item) => {
      acc[item._id] = item.colorSizeStockMap;
      return acc;
    }, {});


 

    
    res.render('shoppingCart', { cartItems: validCartItems, message: '', stockData,userId,cart,wishlist });
   
  } catch (err) {
    console.error('Error loading cart:', err);
    next(err);
  }
};




const removeFromCart = async (req, res,next) => {
  const { itemId, color, size } = req.body;  
  const userId = req.session.userId;        
  
  try {

    const objectId = mongoose.Types.ObjectId.isValid(itemId) ? new mongoose.Types.ObjectId(itemId) : itemId;

    const cart = await Cart.findOneAndUpdate(
      { userId: userId }, 
      {
        $pull: {
          items: {        
            productId: objectId,     
            productColor: color,   
            productSize: size,    
          },
        },
      },
      { new: true } 
    );

    if (!cart) {
      throw new NotFoundError('Cart not found or no item to remove');
    }

    return res.status(200).json({ message: 'Item removed from cart', cart });
  } catch (err) {
    console.error(err);
    return next(err);
  }
};





const loadcheckout = async (req, res) => {
  try {
    const userId = req.session.userId;
    console.log(userId);

    const userAddresses = await Address.find({ userId: userId });
    
    
    let userCart = await Cart.findOne({ userId })
      .populate({
        path: 'items.productId',
        select: 'name' 
      });

      const coupon = await Coupon.find({
        "userId": { $ne: userId }
      });
      
      let cart = await Cart.findOne({userId:userId})
      let wishlist = await Wishlist.findOne({ userId }).populate('products') 
   
    if (!userCart || !userCart.items || userCart.items.length === 0) {
     
      return res.redirect('/cart')
    }

    const validCartItems = userCart.items.filter(item => item.productId !== null);

 
    if (validCartItems.length === 0) {
      await Cart.updateOne({ userId }, { $set: { items: [] } });
      return res.redirect('/cart');
    }

    userCart.items = validCartItems; 
    let colorSizeStockMap = {};
    let processedVariants = {};

    for (const item of userCart.items) {
      if (!item.productId) {
        console.error(`Product ID is null for an item in the cart. Skipping item.`);
        continue; 
      }

      const { productColor, productSize } = item;
      if (!productColor || !productSize) {
        if (!res.headersSent) {
          return res.status(400).send(`Missing color or size for product ${item.productId.name}.`);
        }
      }

      const productVariants = await Variant.find({ productId: item.productId._id });

      if (!productVariants || productVariants.length === 0) {
        console.log(`No variants found for product: ${item.productId.name}`);
        continue;
      }

      productVariants.forEach((variant) => {
        if (variant.size && variant.color) {
          const sizeStockData = variant.size.split(',');
          sizeStockData.forEach((stockItem) => {
            const [size, stock] = stockItem.split(':').map((part) => part.trim());
            const colorSizeKey = `${variant.color}-${size}`;

            if (!processedVariants[colorSizeKey]) {
              if (!colorSizeStockMap[variant.color]) {
                colorSizeStockMap[variant.color] = {};
              }
              colorSizeStockMap[variant.color][size] =
                (colorSizeStockMap[variant.color][size] || 0) + parseInt(stock, 10);
              processedVariants[colorSizeKey] = true;
            }
          });
        }
      });
    }

    

    const totalPrice = userCart.items.reduce((total, item) => total + item.totalPrice, 0);



    const priceTracker = userCart.items.reduce((total, item) => total + item.price * item.quantity, 0);

    

    const addresses = (userAddresses.length > 0 && userAddresses[0].address) ? userAddresses[0].address : [];
    const CheckPrice = totalPrice;

    if (!res.headersSent) {
      res.render('checkout', {
        addresses,
        CheckPrice,
        totalPrice,
        priceTracker,
        cartItems: userCart.items,
        colorSizeStockMap,
        userCart,
        message: 'Please select an address for shipping.',
        coupon,
        DateNow: new Date(),
        cart,
        wishlist
      });
    }
  } catch (err) {
    console.error('Error in loadcheckout:', err);
    if (!res.headersSent) {
      return res.status(500).send('An error occurred while loading the checkout page.');
    }
  }
};





const placeOrder = async (req, res, next) => {
  const userId = req.session.userId;
  const { selectedAddress, orderNotes, paymentMethod,paymentStatus} = req.body;

  console.log('paymentMethod:', paymentMethod);

  try {
  

    const cart = await Cart.findOne({ userId }).populate({
      path: 'items.productId',
      populate: { path: 'category', select: 'isListed' },
      select: 'name price isDeleted'
    });
    
    
    console.log('Cart:', cart);
    
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ message: 'Cart is empty, cannot place order.' });
    }
    

    for (const item of cart.items) {
      const product = item.productId;
    
      if (!product) {
        return res.status(400).json({ message: 'A product in your cart was not found.' });
      }
    
      if (product.isDeleted) {
        return res.status(400).json({ message: `The product "${product.name}" is no longer available.` });
      }
    
      if (!product.category || !product.category.isListed) {
        return res.status(400).json({ message: `The category of "${product.name}" is unavailable.` });
      }
    }

    const addressDocument = await Address.findOne({ "address._id": selectedAddress });

    if (!addressDocument) {
      return res.status(400).json('Selected address not found.');
    }

    if (paymentStatus === "completed" || paymentMethod === "cod") {


    for (const item of cart.items) {
      if (!item.productId) {
        return res.status(400).json('Product not found in cart.');
      }

      const { productColor, productSize, quantity } = item;
      console.log(`Checking stock for ${item.productId.name} (${productColor}, ${productSize})`);

      const productVariants = await Variant.find({ productId: item.productId });

      let colorSizeStockMap = {};
      let processedVariants = {};

      productVariants.forEach((variant) => {
        if (variant.size && variant.color) {
          const sizeStockData = variant.size.split(',');
          sizeStockData.forEach((entry) => {
            const [size, stock] = entry.split(':').map(part => part.trim());
            const colorSizeKey = `${variant.color}-${size}`;

            if (!processedVariants[colorSizeKey]) {
              if (!colorSizeStockMap[variant.color]) {
                colorSizeStockMap[variant.color] = {};
              }
              colorSizeStockMap[variant.color][size] = (colorSizeStockMap[variant.color][size] || 0) + parseInt(stock, 10);
              processedVariants[colorSizeKey] = true;
            }
          });
        }
      });

      if (
        !colorSizeStockMap[productColor] ||
        !colorSizeStockMap[productColor][productSize] ||
        colorSizeStockMap[productColor][productSize] < quantity
      ) {
        return res.status(400).json(`Insufficient stock for product ${item.productId.name} (${productColor}, ${productSize}).`);
      }

      colorSizeStockMap[productColor][productSize] -= quantity;

      const variantToUpdate = productVariants.find(
        (variant) => variant.color === productColor && variant.size.includes(productSize)
      );

      if (variantToUpdate) {
        const sizeData = variantToUpdate.size.split(',').map((entry) => {
          const [variantSize, stock] = entry.split(':');
          if (variantSize === productSize) {
            return `${productSize}:${colorSizeStockMap[productColor][productSize]}`;
          }
          return entry;
        });

        variantToUpdate.size = sizeData.join(',');
        await variantToUpdate.save();
      }
    }
  }

    const totalPrice = cart.items.reduce((sum, item) => sum + item.totalPrice, 0);

    if (paymentMethod === 'cod' && totalPrice > 3000) {
      return res.status(400).json({ message: 'Only Can Buy Less Than 3000 With COD' });
    }

    if (paymentMethod === 'wallet') {
      const userWallet = await Wallet.findOne({ user: userId });
      if (!userWallet) {
        return res.status(404).json({ message: 'Wallet not found!' });
      }

      if (userWallet.walletBalance < totalPrice) {
        return res.status(400).json({ 
          message: `Insufficient wallet balance (${userWallet.walletBalance}). Please add funds to place this order.` 
      });
      
      }

      userWallet.walletBalance -= totalPrice;
      userWallet.transactions.push({
        type: 'debit',
        amount: totalPrice,
        balanceAfterTransaction: userWallet.walletBalance,
        description: 'Payment for Order #',
      });

      await userWallet.save();
    }

    const coupon = cart.iscouponApplied || false;
    const CouponCode = cart.CouponCode || null;
    const couponDis = cart.couponDis || 0;

    const order = new Order({
      userId,
      orderedItems: cart.items.map((item) => ({
        product: item.productId,
        quantity: item.quantity,
        price: item.price,
        totalPrice: item.totalPrice,
        size: item.productSize,
        color: item.productColor,
        brand:item.brand,
      paymentStatus:paymentStatus,
      })),
      address: addressDocument.address.find((addr) => addr._id.toString() === selectedAddress),
      orderNotes,
      totalPrice,
      paymentMethod,
      paymentStatus:paymentStatus,
      status: 'Pending',
      iscouponApplied: coupon,
      CouponCode: CouponCode,
      couponDis: couponDis,
    });

    await order.save();

    await Cart.findOneAndUpdate({ userId }, { $set: { items: [] } }, { new: true });

    res.status(201).json({
      message: 'Order placed successfully.',
      orderId: order.orderId,
      totalPrice: order.totalPrice,
      status: order.status,
      orderedItems: order.orderedItems,
    });
  } catch (err) {
    console.error('Error placing order:', err);
    next(err);
  }
};





const orderCancel = async (req, res,next) => {
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
    
      if (item.isCancelled) {
        console.log(`Item with product ${product._id} is already cancelled, skipping stock return.`);
        continue;
      }
    
      console.log(`Processing product ${product._id} for stock return.`);
    
      const variant = await Variant.findOne({ productId: product._id, color: color });
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


order.orderedItems.forEach(item => {
  item.paymentStatus = "refund";
});

order.paymentStatus = "refund";


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







const productCancel = async (req, res,next) => {
  const { orderId, productId, stock, cancelReason } = req.body;


  console.log('cancel reason',cancelReason)

  console.log('Received stock for cancellation:', stock);

  try {
  
    const order = await Order.findOne({ orderId: orderId });
    if (!order) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    if (!Array.isArray(order.orderedItems)) {
      return res.status(400).json({ error: 'Order items are missing or not an array.' });
    }

    if (order.status === 'Delivered') {
      return res.status(400).json({ error: 'Order is already  Delivered' });
    }

    if (order.status === 'Returned') {
      return res.status(400).json({ error: 'Order is returned' });
    }

    if (order.status === 'Cancelled') {
      return res.status(400).json({ error: 'Order already cancelled' });
    }

    const product = order.orderedItems.find(item => item.product.toString() === productId);
    if (!product) {
      return res.status(404).json({ error: 'Product not found ' });
    }

    if (product.isCancelled) {
      return res.status(400).json({ error: 'Product already Cancelled' });
    }


    product.isCancelled = true;
    product.CancelReason=cancelReason;
    product.paymentStatus = "refund";



    const productPrice = product.totalPrice;

console.log("product Price",productPrice)

    const wallet = await Wallet.findOne({ user: order.userId });
    if (!wallet) {
      return res.status(404).json({ error: 'Wallet not found ' });
    }

    const { color, size } = product;

    if (!color || !size) {
      return res.status(400).json({ error: 'Product variant details missing.' });
    }

    const variant = await Variant.findOne({productId:productId,color:color});
    if (!variant) {
      return res.status(404).json({ error: 'Variant not found ' });
    }

console.log(variant)

const sizeStockMap = {};
const sizeStockPairs = variant.size.split(',');

sizeStockPairs.forEach(pair => {
  const [sizeKey, stockValue] = pair.split(':');
  sizeStockMap[sizeKey.trim()] = parseInt(stockValue, 10);
});


const stockToAdd = parseInt(stock, 10);

if (sizeStockMap[size] !== undefined) {

  sizeStockMap[size] += stockToAdd;
} else {

  sizeStockMap[size] = stockToAdd;
}

const updatedSizeStockString = Object.entries(sizeStockMap)
  .map(([sizeKey, stockValue]) => `${sizeKey}:${stockValue}`)
  .join(',');

variant.size = updatedSizeStockString;
await variant.save();




if (order.paymentMethod !== "cod") {

    wallet.walletBalance += productPrice * stock;
    wallet.transactions.push({
      type: 'credit',
      amount: productPrice * stock,
      description: `Refund for cancelled product: ${productId} from order ${orderId}`,
      date: new Date(),
    });

    await wallet.save();
  } else {
    console.log('Payment method is Cash on Delivery. No refund to wallet.');
  }
    

    order.totalPrice-=productPrice;

    if (order.orderedItems.every(item => item.isCancelled === true)) {
      order.status = 'Cancelled'; 
    }
      
    const allRefunded = order.orderedItems.every(item => item.paymentStatus === "refund");

    if (allRefunded) {
      order.paymentStatus = "refund";
    }

    await order.save();

    res.json({
      message: 'Product cancelled successfully',
      updatedWalletBalance: wallet.walletBalance,
      remainingItems: order.orderedItems,
    });

  } catch (err) {
    console.error('Error canceling product:', err);
    next(err);
  }
};







const viewOderDetails = async (req, res,next) => {
  const { orderId } = req.params;

  try {
    const order = await Order.find({ orderId });

    if (!order) {
      throw new NotFoundError('Order not found');
    }

    console.log(order);

    res.json(order);
  } catch (err) {
    console.error(err);
    next(err);
  }
}




const loadChangePass = async (req, res,next) => {
  if (req.session && req.session.userId) {
    return res.render('changepass', { userId: req.session.userId });
  }
}




const changePass = async (req, res,next) => {
  console.log(req.body)

  const { userId, currentPassword, newPassword, confirmPassword } = req.body;

  console.log(userId, currentPassword, newPassword, confirmPassword)


  if (newPassword !== confirmPassword) {
    return res.status(400).json({ message: 'New password and confirm password do not match' });
  }

  try {
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    user.password = hashedPassword;
    await user.save();

    res.status(200).json({ message: 'Password changed successfully' });

  } catch (err) {
    next(err); 
  }

}




const updateQuantity = async (req, res,next) => {
  const { itemId, updatedQuantity, color, size } = req.body;
  const userId = req.session.userId;

  if (!size || !color) {
    throw new NotFoundError( 'Invalid size or color');
  }

  try {
      const userCart = await Cart.findOne({ userId });
      if (!userCart) {
        throw new NotFoundError( 'Cart not found.');
      }

      const cartItem = userCart.items.find(item => item.productId.toString() === itemId.toString());
      if (!cartItem) {
        throw new NotFoundError('Item not found in cart.');
      }

      const variant = await Variant.findOne({
          productId: cartItem.productId,
          color: color,
      });

      if (!variant) {
        throw new NotFoundError( 'Variant not found for this color.');
      }

      const sizeStockData = variant.size.split(',').reduce((acc, item) => {
          const [sizeKey, stockValue] = item.split(':');
          acc[sizeKey] = parseInt(stockValue, 10);
          return acc;
      }, {});

      if (!sizeStockData[size]) {
        throw new NotFoundError( `Size ${size} not available for color ${color}.`);
      }

      const availableStock = sizeStockData[size];
      if (updatedQuantity > availableStock) {
        throw new NotFoundError( `The maximum available stock for ${color} size ${size} is ${availableStock}. You can't purchase more than that.`);
      }

      const product = await Product.findById(cartItem.productId);

      const finalPrice = product.isOffer ? product.offerPrice : product.price;
    
      cartItem.price = finalPrice;

      cartItem.quantity = updatedQuantity;
      cartItem.totalPrice = cartItem.price * updatedQuantity;


      const cartSubtotal = userCart.items.reduce((total, item) => total + item.totalPrice, 0);
      
      await userCart.save();

      res.json({
          success: true,
          message: 'Quantity updated successfully.',
          itemTotalPrice: cartItem.totalPrice.toFixed(2),
          cartSubtotal: cartSubtotal.toFixed(2),
          cartTotal: cartSubtotal.toFixed(2),
          updatedQuantity: cartItem.quantity
      });

  } catch (err) {
      next(err); 
  }
};





const createOrder = async (req, res,next) => {
  try {
    const { amount, currency, receipt } = req.body;

  
    const options = {
      amount: amount * 100, 
      currency: currency || 'INR',
      receipt: receipt || `receipt_${Date.now()}`,
    };

    
    const order = await razorpayInstance.orders.create(options);

    res.status(200).json({
      success: true,
      order,
    });
  } catch (err) {
    next(err); 
  }
}



const forgetPassword = async (req, res,next) => {
  res.render('forget-pass',{message:''})
}


const orderSummery = async (req, res,next) => {
  const { orderId } = req.params;

  try {
    console.log("OrderId being searched:", orderId);
    const order = await Order.findOne({ orderId }).populate('orderedItems.product');
     const notification = await Notification.findOne({orderId:orderId})     

    if (!order) {
      throw new NotFoundError( 'Order not Found');
    }

    const overAllPrice = order.orderedItems.reduce((acc, item) => acc + item.totalPrice, 0);

    res.render('orderSummery', { order,overAllPrice,notification });
  } catch (err) {
    console.error(err);
    next(err); 
  }
}




const addToWishlist = async (req, res,next) => {
  const { userId, productId } = req.body;

   console.log(req.body)

  if (!userId || !productId) {
    throw new NotFoundError("User ID and Product ID are required");
  }


 

  try {
    let wishlist = await Wishlist.findOne({ userId });

    if (!wishlist) {
      wishlist = new Wishlist({ userId, products: [] });
    }

    if (wishlist.products.includes(productId)) {
      return res.status(400).json({ message: "Product already in wishlist" });
    }


    const updatedWishlist = await Wishlist.findOneAndUpdate(
      { userId },
      { $addToSet: { products: productId } },
      { new: true, upsert: true }
    );
    res.status(200).json({ message: "Product added to wishlist", isInWishlist: updatedWishlist });
  } catch (err) {
    next(err); 
  }
};



const removeFromWishlist = async (req, res,next) => {
  const { userId, productId } = req.body;

  if (!userId || !productId) {
    throw new NotFoundError( "User ID and Product ID are required");
  }

  try {
    const wishlist = await Wishlist.findOne({ userId });

    if (!wishlist) {
      throw new NotFoundError( "Wishlist not found for the user");
    }

    const updatedWishlist = await Wishlist.findOneAndUpdate(
      { userId },
      { $pull: { products: productId } },
      { new: true }
    );

    res.status(200).json({ message: "Product removed from wishlist", isInWishlist: updatedWishlist });
  } catch (err) {
    next(err); 
  }
};



const whishlist = async (req, res,next) => {
  try {
    const userId = req.session.userId;

    if (!userId) {
      throw new NotFoundError('Unauthorized: Please log in to view your wishlist.');
    }
    const wishlists = await Wishlist.findOne({ userId }).populate('products');
    let cart = await Cart.findOne({userId:userId})
    let wishlist = await Wishlist.findOne({ userId }).populate('products') 

    if (!wishlists || wishlists.products.length === 0) {
      return res.render('wishlist', { items: [],cart,wishlist });
    }
    res.render('wishlist', { items: wishlists.products,cart,wishlist});
  } catch (err) {
    next(err); 
  }
};


const wallet = async (req, res, next) => {
  try {
    const userId = req.session.userId;
    const page = parseInt(req.query.page) || 1; 
    const limit = parseInt(req.query.limit) || 15; 


    let userWallet = await Wallet.findOne({ user: userId })
      .populate('user', 'name')
      .lean();

    if (!userWallet) {
      userWallet = new Wallet({ user: userId, transactions: [] });
      await userWallet.save();
      return res.render('wallet', { wallet: userWallet, transactions: [], currentPage: page, totalPages: 1 });
    }

    const sortedTransactions = [...userWallet.transactions].sort((a, b) => new Date(b.date) - new Date(a.date));


    const totalTransactions = userWallet.transactions.length;
    const totalPages = Math.ceil(totalTransactions / limit);
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;

    const paginatedTransactions = sortedTransactions.slice(startIndex, endIndex);

    res.render('wallet', {
      wallet: userWallet,
      transactions: paginatedTransactions,
      currentPage: page,
      totalPages,
    });

  } catch (err) {
    console.error('Error fetching wallet:', err);
    next(err);
  }
};



const AddWallet = async (req, res,next) => {
  const { paymentId, amount } = req.body;
  const userId = req.session.userId;

  console.log('Received paymentId:', paymentId);
  console.log('Received amount:', amount);

  try {
      const paymentDetails = await razorpayInstance.payments.fetch(paymentId);


      if (paymentDetails.status === 'authorized') {
          console.log('Payment is authorized'); 
          const user = await User.findById(userId);

          if (!user) {
            throw new NotFoundError( 'User not found' );
          }

          let wallet = await Wallet.findOne({ user: user._id });

          if (!wallet) {
              wallet = new Wallet({
                  user: user._id,
                  walletBalance: 0,
              });
          }

          const newBalance = wallet.walletBalance + parseFloat(amount);
          wallet.walletBalance = newBalance;


          wallet.transactions.push({
              type: 'credit',
              amount: parseFloat(amount),
              balanceAfterTransaction: newBalance,
              description: 'Added money to wallet',
          });

          await wallet.save();


          res.json({ success: true, newBalance });
      } else {

        throw new NotFoundError( 'Payment not successful' );
      }
  } catch (err) {

      next(err); 
  }
};







const productReturn = async (req, res,next) => {
  const { orderId, productId, returnReason } = req.body;

  try {

    const order = await Order.findOne({ orderId });
    if (!order) {
      throw new NotFoundError( 'Order not found.');
    }

    const item = order.orderedItems.find((item) => item.product.toString() === productId);
    if (!item) {
      throw new NotFoundError('Product not found in order.');
    }

    if (item.isReturned) {
      throw new NotFoundError( 'Product is already marked as returned.');
    }

    const product = order.orderedItems.find(item => item.product.toString() === productId);
    const productPrice = product.totalPrice;
    
    if (isNaN(productPrice) || productPrice <= 0) {
      throw new NotFoundError('Invalid product price');
    }


    item.isReturned = true;
    item.returnReason = returnReason;

     order.save()
    

     req.flash('success', 'Product return requested successfully.');


  } catch (err) {
    console.error(err);
    next(err); 
  }
};







const applayCoupon = async (req, res,next) => {
  const { couponCode } = req.body;


  const userId = req.session.userId;
  console.log("User ID from session:", userId); 

  try {
   
      const coupon = await Coupon.findOne({ code: couponCode.trim() });



      if (!coupon) {
        req.flash('success', 'invalid Coupon');
      }



      if (new Date() > coupon.expireOn) {
          console.log("Coupon expired.");
          req.flash('success', 'coupon Expired');
          return res.status(400).json({ success: false, message: "coupon Expired" });
      }

      

      const cart = await Cart.findOne({ userId }).populate('items.productId');


      if (!cart || !cart.items || cart.items.length === 0) {
          console.log("Cart is empty or not found.");
          throw new NotFoundError( "Cart is empty." );
      }

      if (cart.iscouponApplied) {
        req.flash('success', "Already applied another coupon for this order");
        return res.status(400).json({ success: false, message: "Already applied another coupon for this order" });
    }
    

      const totalPrice = cart.items.reduce((sum, item) => sum + item.totalPrice, 0);


      let discount = 0;
      if (coupon.discountType === "percentage") {
          discount = (totalPrice * coupon.discountAmount) / 100;
      } else if (coupon.discountType === "fixed") {
          discount = coupon.discountAmount;
      }
      
      console.log('Calculated discount:', discount); 
      
      if (coupon.maxDiscount && discount > coupon.maxDiscount) {
          discount = coupon.maxDiscount;
          req.flash('success',"Discount exceeds max limit, applying max discount:", discount);
          console.log("Discount exceeds max limit, applying max discount:", discount);
      }
      
      if (coupon.userId.toString() === userId) {
        console.log("Coupon already used by This user.");
          req.flash('success',"coupon already Used by This user");
          cart.iscouponApplied=false
        return res.status(400).json({ success: false, message: "coupon already Used by This user" });
    }

      cart.items.forEach((item) => {
        const itemDiscount = (item.totalPrice * discount) / totalPrice;
        item.totalPrice = Math.round((item.totalPrice - itemDiscount) * 100) / 100;  
    });
      cart.CouponCode=coupon.code
      cart.iscouponApplied=true
      cart.couponDis=discount;
      await cart.save();


      coupon.userId.push(userId);
      await coupon.save();

    
    req.flash('success', 'coupon applyed!');
    req.flash('data',`discount:${discount}`);
    
      res.status(200).json({
          success: true,
          discountApplied: discount,
          message: "Coupon applied successfully!",
      });
  } catch (err) {
      console.error("Error applying coupon:", err);
      next(err); 
  }
};






const removeFromWhishlist = async (req, res,next) => {
  const {productId } = req.params;

      const userId = req.session.userId
      console.log(userId)
  try {

    const wishlist = await Wishlist.findOneAndUpdate(
      { userId: userId },
      { $pull: { products: productId } },
      { new: true }
    );

    if (!wishlist) {
      throw new NotFoundError('Wishlist not found for this user');
    }

    res.status(200).json({ message: 'Product removed from wishlist successfully', wishlist });
  } catch (err) {
    console.error('Error removing product:', err);
    next(err); 
  }
};



const removeCoupon = async (req, res, next) => {
  const userId = req.session.userId;
  console.log("User ID from session:", userId);

  try {

      const cart = await Cart.findOne({ userId }).populate('items.productId');

      if (!cart || !cart.items || cart.items.length === 0) {
          console.log("Cart is empty or not found.");
          throw new NotFoundError("Cart is empty.");
      }

      const coupon = await Coupon.findOne({ userId });

      if (!coupon) {
          console.log("No coupon found for this user.");
          req.flash('success', 'No coupon applied.');
          return res.status(400).json({
              success: false,
              message: "No coupon applied.",
          });
      }

   
      const totalDiscountedPrice = cart.items.reduce((sum, item) => sum + item.totalPrice, 0);


      const discountPercent = coupon.discountAmount;
      const effectiveDiscount = coupon.maxDiscount 
          ? Math.min(coupon.maxDiscount, (totalDiscountedPrice * discountPercent) / (100 - discountPercent))
          : (totalDiscountedPrice * discountPercent) / (100 - discountPercent);


      cart.items.forEach((item) => {

          const itemProportion = item.totalPrice / totalDiscountedPrice;
          const itemDiscount = effectiveDiscount * itemProportion;
          
          item.totalPrice = Math.round((item.totalPrice + itemDiscount) * 100) / 100;
      });

      cart.iscouponApplied = false;
      await cart.save();

      coupon.userId = coupon.userId.filter(id => id.toString() !== userId);
      await coupon.save();

      req.flash('success', 'Coupon removed successfully.');
      
      return res.status(200).json({
          success: true,
          message: "Coupon removed successfully.",
      });

  } catch (err) {
      console.error("Error removing coupon:", err);
      next(err);
  }
};







const CheckoutupdateAddress = async (req, res,next) => {
  try {
    const { fullName, streetAddress, aptNumber, city, state, pincode, country, phone, altPhone, addressType } = req.body;
    const userId = req.session.userId;


    console.log('Form data:', req.body);
    const updatedAddress = {
      fullName,
      streetAddress,
      aptNumber,
      city,
      state,
      pincode,
      country,
      phone,
      altPhone,
      addressType
    };

    const userAddress = await Address.findOne({ userId });

    if (!userAddress) {
      throw new NotFoundError('User address record not found');
    }

    const address = userAddress.address.find(address => address._id.toString() === req.params.id);

    if (!address) {
      throw new NotFoundError('Address not found');
    }

    address.fullName = updatedAddress.fullName;
    address.streetAddress = updatedAddress.streetAddress;
    address.aptNumber = updatedAddress.aptNumber;
    address.city = updatedAddress.city;
    address.state = updatedAddress.state;
    address.pincode = updatedAddress.pincode;
    address.country = updatedAddress.country;
    address.phone = updatedAddress.phone;
    address.altPhone = updatedAddress.altPhone;
    address.addressType = updatedAddress.addressType;

    await userAddress.save();

    req.flash('success', 'Address Updated  successfully!');
    res.redirect('/checkout');

  } catch (err) {
    console.error(err);
    return next(err);
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


      doc.fontSize(36)
          .font('Helvetica-Bold')
          .fillColor('#2B6CB0')  
          .text('INVOICE', 50, 130);


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
                                item.isReturned ? ' (Returned)' : '';
          
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


      currentY += 20;
      doc.fontSize(10)
          .fillColor('#4A5568')
          .text('Subtotal:', 400, currentY)
          .fillColor('#2D3748')
          .text(`${subtotal.toFixed(2)}`, 480, currentY);

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












const retryPeyment = async (req, res) => {

  try {
    const { orderId, paymentStatus } = req.body;


    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }


    for (const item of order.orderedItems) {
      if (!item.product) {
        throw new Error("Product not found in order.");
      }

      const { color, size, quantity } = item;

  

      const productVariants = await Variant.find({ productId: item.product });

      let colorSizeStockMap = {};
      let processedVariants = {};

      productVariants.forEach((variant) => {
        if (variant.size && variant.color) {
          const sizeStockData = variant.size.split(",");
          sizeStockData.forEach((entry) => {
            const [size, stock] = entry.split(":").map((part) => part.trim());
            const colorSizeKey = `${variant.color}-${size}`;

            if (!processedVariants[colorSizeKey]) {
              if (!colorSizeStockMap[variant.color]) {
                colorSizeStockMap[variant.color] = {};
              }
              colorSizeStockMap[variant.color][size] =
                (colorSizeStockMap[variant.color][size] || 0) + parseInt(stock, 10);
              processedVariants[colorSizeKey] = true;
            }
          });
        }
      });


      if (
        !colorSizeStockMap[color] ||
        !colorSizeStockMap[color][size] ||
        colorSizeStockMap[color][size] < quantity
      ) {
        throw new Error(
          `Insufficient stock for product ${item.product} (${color}, ${size}).`
        );
      }


      colorSizeStockMap[color][size] -= quantity;

      const variantToUpdate = productVariants.find(
        (variant) => variant.color === color && variant.size.includes(size)
      );

      if (variantToUpdate) {
        const sizeData = variantToUpdate.size.split(",").map((entry) => {
          const [variantSize, stock] = entry.split(":");
          if (variantSize === size) {
            return `${size}:${colorSizeStockMap[color][size]}`;
          }
          return entry;
        });

        variantToUpdate.size = sizeData.join(",");
        await variantToUpdate.save();
      }
    }

    order.orderedItems.forEach((item)=>item.paymentStatus=paymentStatus ||'completed')
    order.paymentStatus = paymentStatus || 'completed';
    order.status = 'Processing';
    order.paymentMethod='razorpay';

    await order.save();

    res.status(200).json({
      success: true,
      message: 'Peyment Successfully Done',
      orderId: order._id,
    });

  } catch (error) {
    console.error('Error retrying order:', error);
    res.status(500).json({ success: false, message: 'Failed to pay. Please try again.' });
  }
};







module.exports = {
  loadHomepage,
  pageNotFound,
  loadSignup,
  loadShopping,
  signup,
  verifyOtp,
  resendOtp,
  userlogin,
  loadLogin,
  login,
  productDetail,
  userlogout,
  profile,
  updateProfile,
  loadUpdateProfile,
  removeFromWhishlist,


  loaduserOrderDetails,
  loadCart,
  removeFromCart,
  loadcheckout,
  placeOrder,
  orderCancel,
  orderSummery,
  productCancel,


  loadAddress,
  addAddress,
  loadUpdateAddress,
  updateAddress,
  deleteAddress,
  viewOderDetails,
  filterProducts,

  forgetChange,
  forgetOtp,
  addToCart,
  updateQuantity,

  whishlist,
  changePass,
  loadChangePass,
  forgetPassword,
  PostforgetPassword,
  wallet,
  createOrder,
  addToWishlist,
  removeFromWishlist,
  AddWallet,
  productReturn,
  applayCoupon,
  removeCoupon,
  loadCheckUpdateAddress,
  CheckoutupdateAddress,
  CheckoutaddAddress,
  invoice,
  retryPeyment,
  forgetResendOtp,
}