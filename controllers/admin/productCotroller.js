
const Category = require('../../models/categorySchema.js')
const Products = require('../../models/productSchema.js')
const multer = require('multer');
const path = require('path');
const mongoose = require('mongoose');
const fs = require('fs')
const cloudinary = require('../../config/cloudinary.js');
const Variant = require('../../models/ProductVariants.js');




const addProduct = async (req, res, next) => {
    try {
        const {
            productName,
            productPrice,
            productDescription,
            productCategory,
            productSizes,
            productColors,
            productTags,
            productbrand,
        } = req.body;

        const productImages = req.files;

        // ✅ Validation: Ensure all required fields exist
        if (
            !productName ||
            !productPrice ||
            !productDescription ||
            !productCategory ||
            !Array.isArray(productSizes) ||
            !Array.isArray(productColors) ||
            !Array.isArray(productImages) ||
            productImages.length === 0 ||
            productColors.length === 0 ||
            productSizes.length === 0
        ) {
            return res.status(400).json({ error: "All fields are required." });
        }

        // ✅ Check if the product already exists
        const regex = new RegExp("^" + productName + "$", "i");
        const existingProduct = await Products.findOne({ name: { $regex: regex } });
        if (existingProduct) {
            return res.status(409).json({ error: "This product already exists!" });
        }

        // ✅ Handle Image Upload to Cloudinary
        const uploadImageToCloudinary = (file) => {
            return new Promise((resolve, reject) => {
                cloudinary.uploader.upload_stream(
                    { resource_type: "auto", folder: "products" },
                    (error, result) => {
                        if (error) return reject(error);
                        resolve(result.secure_url);
                    }
                ).end(file.buffer);
            });
        };

        const imageUrls = await Promise.all(productImages.map(uploadImageToCloudinary));

        // ✅ Create Product
        const newProduct = new Products({
            name: productName,
            description: productDescription,
            price: productPrice,
            images: imageUrls,
            tags: productTags,
            category: productCategory,
            brand: productbrand,
        });

        // ✅ Add Variants
        const newVariants = productColors.map((color, index) => ({
            productId: newProduct._id,
            color: color,
            size: productSizes[index] || null, 
        }));

        await Variant.insertMany(newVariants);

        // ✅ Apply Category Discount (if exists)
        const categoryOffer = await Category.findById(productCategory);
        if (categoryOffer && categoryOffer.isOfferCategory) {
            const discountPercentage = categoryOffer.discountPercentage;
            newProduct.offerPrice = Math.round(newProduct.price * (1 - discountPercentage / 100) * 100) / 100;
            newProduct.offerStartDate = categoryOffer.offerStartDate;
            newProduct.offerEndDate = categoryOffer.offerEndDate;
        }

        await newProduct.save();

        return res.status(201).json({ success: true, message: "Product added successfully!" });
    } catch (err) {
        console.error("Error in addProduct function:", err);
        return res.status(500).json({ error: "Internal server error." });
    }
};





 //------ProductManagement--------------> 
 const loadProductManagement = async(req, res)=>{
    try {
        if (!req.session.admin) {
            return res.status(200).render('admin-login', { message: "" });
        }
        
  
        const page = parseInt(req.query.page) || 1;
        const productsPerPage = 10;
        const skip = (page - 1) * productsPerPage;

        
        const products = await Products.find({ isDeleted: false })
            .skip(skip)
            .limit(productsPerPage)
            .populate('category');

        
        const totalProducts = await Products.countDocuments({ isDeleted: false });
        const totalPages = Math.ceil(totalProducts / productsPerPage);

        if (!products || products.length === 0) {
            return res.status(200).render('productManagement', { msg: 'No products found', products: [], currentPage: page, totalPages });
        }
       
        return res.status(200).render('productManagement', { products, currentPage: page, totalPages });
    } catch (error) {
        console.log('Error loading product management ➡️' + error);
        next(err); 
    }
}



const  loadAddProductsPage = async (req, res)=>{
    try {
        const categories = await Category.find({ isDeleted: false });
        res.render('productAdd', { categories: categories ,});
    } catch (error) {
        console.error('Error loading product adding page:', error);
        res.status(500).json({ message: 'Error loading product adding page' });
    }
}

const loadUpdateProduct = async (req, res) => {
    const productId = req.params.id;
   

    if (!mongoose.Types.ObjectId.isValid(productId) || productId.length !== 24) {
        console.error('Invalid productId:', productId);
        return res.status(400).json({ message: 'Invalid product ID' });
    }

    try {
       
        const product = await Products.findById(productId).populate('category');
        const categories = await Category.find();

        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

 const productVariants = await Variant.find({ productId:productId });

  

     
let colorSizeStockMap = {};

let processedVariants = {};

productVariants.forEach((variant) => {
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
         

        res.render('productUpdate', { product, categories,colorSizeStockMap});
    } catch (err) {
        console.error('Error loading product update page:', err);
        next(err); 
    }
};






const updateProduct = async (req, res, next) => {
    try {

        const { id } = req.params;
        const { 
            productName, 
            productPrice, 
            productDescription, 
            productCategory, 
            productSizes, 
            productColors, 
            productTags, 
            productbrand,
            existingImages,
            removedImages 
        } = req.body;

       
        if (!productName || !productPrice || !productDescription || !productCategory) {
            return res.status(400).json({
                success: false,
                message: 'Required fields are missing'
            });
        }

       
        const product = await Products.findById(id);
        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

       
        let finalImages = [];

       
        if (existingImages) {
            const existingImagesArray = Array.isArray(existingImages) 
                ? existingImages 
                : [existingImages];
            finalImages = [...existingImagesArray];
        } else {
            finalImages = [...product.images];
        }

       
        if (removedImages) {
            const removedIndexes = Array.isArray(removedImages)
                ? removedImages.map(Number)
                : [Number(removedImages)];
            
            finalImages = finalImages.filter((_, index) => 
                !removedIndexes.includes(index)
            );
        }

        
        if (req.files && req.files.length > 0) {
            const uploadImageToCloudinary = (file) => {
                return new Promise((resolve, reject) => {
                    const stream = cloudinary.uploader.upload_stream(
                        {
                            resource_type: 'auto',
                            folder: 'products',
                            public_id: `${Date.now()}-${file.originalname}`,
                            transformation: [
                                { width: 800, height: 800, crop: 'limit' },
                                { quality: 'auto' }
                            ]
                        },
                        (error, result) => {
                            if (error) {
                                console.error('Cloudinary upload error:', error);
                                return reject(error);
                            }
                            resolve(result.secure_url);
                        }
                    );
                    stream.end(file.buffer);
                });
            };

            const newImageUrls = await Promise.all(
                req.files.map(file => uploadImageToCloudinary(file))
            );

            finalImages = [...finalImages, ...newImageUrls];
        }

    
        product.name = productName;
        product.price = productPrice;
        product.description = productDescription;
        product.category = productCategory;
        product.tags = productTags || product.tags;
        product.brand = productbrand || product.brand;
        product.images = finalImages;

       
        const categoryOffer = await Category.findById(productCategory);
        if (categoryOffer?.isOfferCategory) {
            const discountPercentage = categoryOffer.discountPercentage;
            const discountedPrice = product.price * (1 - (discountPercentage / 100));
            
            product.offerPrice = Math.round(discountedPrice * 100) / 100;
            product.offerStartDate = categoryOffer.offerStartDate;
            product.offerEndDate = categoryOffer.offerEndDate;
        } else {
          
            product.offerPrice = null;
            product.offerStartDate = null;
            product.offerEndDate = null;
        }

       
        const updatedProduct = await product.save();

      
        if (productColors && productSizes) {
            const colorsArray = Array.isArray(productColors) 
                ? productColors 
                : productColors.split(',');
            const sizesArray = Array.isArray(productSizes) 
                ? productSizes 
                : productSizes.split(',');

            if (colorsArray.length > 0 && sizesArray.length > 0) {
            
                await Variant.deleteMany({ productId: updatedProduct._id });

              
                const newVariants = colorsArray.flatMap(color => 
                    sizesArray.map(size => ({
                        productId: updatedProduct._id,
                        color: color.trim(),
                        size: size.trim()
                    }))
                );

                await Variant.insertMany(newVariants);
                console.log('varient updated')
            }
        }

     
        req.flash('success', 'Product updated successfully!');
        return res.redirect('/admin/products');

    } catch (error) {
        console.error('Error updating product:', error);
        req.flash('error', 'Failed to update product');
        return next(error);
    }
};






const loadDelProductPage = async (req, res)=>{
    try {
        const deletedProducts = await Products.find({ isDeleted: true });
        res.render("productDelete", { deletedProducts });
    } catch (error) {
        console.error("Error fetching deleted products:", error);
        next(err); 
    }
}


const  deleteProduct = async (req, res)=>{
    try {
        const { productId } = req.body;

        const product = await Products.findByIdAndUpdate(productId, { isDeleted: true }, { new: true });

        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }

        res.status(200).json({ success: true, message: 'Product successfully soft-deleted' });
    } catch (error) {
        console.error(error);
        next(err); 
    }
}


module.exports={
    loadProductManagement,
    loadAddProductsPage,
    loadUpdateProduct,
    updateProduct,
    loadDelProductPage,
    deleteProduct,
  addProduct,
}



