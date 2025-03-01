
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

        console.log(req.body)

        const existingProduct = await Products.findOne({
            name: productName
        }).collation({
            locale: 'en',
            strength: 2
        });

        if (existingProduct) {
            return res.status(400).json({
                success: false,
                message: 'Product with this name already exists!'
            });
        }


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


        const newProduct = new Products({
            name: productName,
            description: productDescription,
            price: productPrice,
            images: imageUrls,
            tags: productTags,
            category: productCategory,
            brand: productbrand,
        });

        const newVariants = productColors.map((color, index) => ({
            productId: newProduct._id,
            color: color,
            size: productSizes[index] || null,
        }));


        await Variant.insertMany(newVariants);


        const categoryOffer = await Category.findById(productCategory);
        if (categoryOffer && categoryOffer.isOfferCategory) {
            const discountPercentage = categoryOffer.discountPercentage;
            newProduct.offerPrice = Math.round(newProduct.price * (1 - discountPercentage / 100) * 100) / 100;
            newProduct.offerStartDate = categoryOffer.offerStartDate;
            newProduct.offerEndDate = categoryOffer.offerEndDate;
        }


        await newProduct.save();

        console.log('Product added successfully!');
        return res.status(201).json({
            success: true,
            message: 'Product added successfully!'
        });


    } catch (err) {
        console.error("Error in addProduct function:", err);
        if (!res.headersSent) {
            return res.status(500).json({ error: "Internal server error." });
        }
    }
};





const loadProductManagement = async (req, res, next) => {
    try {
        if (!req.session.admin) {
            return res.status(200).render('admin-login', { message: "" });
        }

        const page = parseInt(req.query.page) || 1;
        const productsPerPage = 10;
        const skip = (page - 1) * productsPerPage;

        
        const searchQuery = req.query.search ? req.query.search.trim() : "";

        let filter = { isDeleted: false };
        if (searchQuery) {
            filter.name = { $regex: searchQuery, $options: "i" }; 
        }

      
        const products = await Products.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(productsPerPage)
            .populate('category');

        const totalProducts = await Products.countDocuments(filter);
        const totalPages = Math.ceil(totalProducts / productsPerPage);

        return res.status(200).render('productManagement', {
            products,
            currentPage: page,
            totalPages,
            searchQuery 
        });
    } catch (error) {
        console.log('Error loading product management: ', error);
        next(error);
    }
};




const loadAddProductsPage = async (req, res) => {
    try {
        const categories = await Category.find();
        res.render('productAdd', { categories: categories, });
    } catch (error) {
        console.error('Error loading product adding page:', error);
        res.status(500).json({ message: 'Error loading product adding page' });
    }
}

const loadUpdateProduct = async (req, res) => {
    const productId = req.params.id;


    if (!mongoose.Types.ObjectId.isValid(productId) || productId.length !== 24) {
        console.error('Invalid productId:', productId);
        return res.status(400).render("page-404", { message: "Invalid ID" });
    }
      

    try {

        const product = await Products.findById(productId).populate('category');
        const categories = await Category.find();

        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        const productVariants = await Variant.find({ productId: productId });




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

        console.log(colorSizeStockMap)

        res.render('productUpdate', { product, categories, colorSizeStockMap });
    } catch (err) {
        console.error('Error loading product update page:', err);
        next(err);
    }
};




const updateProduct = async (req, res, next) => {
    console.log('🔄 Updating product...');

    try {
        const { id } = req.params;
        let {
            productName,
            productPrice,
            productDescription,
            productCategory,
            productTags,
            productbrand,
            existingImages,
            removedImages
        } = req.body;

        console.log('📦 Received data:', req.body);

   
        let productColors = req.body.productColors ? req.body.productColors : [];

        let productVariants = productColors.map((color, index) => {
            let sizes = {};

            Object.keys(req.body).forEach(key => {
                if (key.startsWith('sizes[][')) {
                    const sizeName = key.match(/\[([^\]]+)\]/)[1]; 
                    sizes[sizeName] = Number(req.body[key][index]); 
                }
            });

            return {
                color,
                sizes,
            };
        });

        productVariants = productVariants.filter(variant => Object.keys(variant.sizes).length > 0);

        console.log("✅ Processed productColors:", productColors);
        console.log("✅ Processed productVariants:", productVariants);

      
        if (!productName || !productPrice || !productDescription || !productCategory) {
            return res.status(400).json({ success: false, message: 'Required fields are missing' });
        }

      
        const product = await Products.findById(id);
        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }

      
        let finalImages = existingImages ?
            (Array.isArray(existingImages) ? existingImages : [existingImages])
            : [...product.images];

        if (removedImages) {
            const removedIndexes = Array.isArray(removedImages) ? removedImages.map(Number) : [Number(removedImages)];
            finalImages = finalImages.filter((_, index) => !removedIndexes.includes(index));
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
                            if (error) return reject(error);
                            resolve(result.secure_url);
                        }
                    );
                    stream.end(file.buffer);
                });
            };
            const newImageUrls = await Promise.all(req.files.map(file => uploadImageToCloudinary(file)));
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
            product.offerPrice = Math.round((product.price * (1 - discountPercentage / 100)) * 100) / 100;
            product.offerStartDate = categoryOffer.offerStartDate;
            product.offerEndDate = categoryOffer.offerEndDate;
        } else {
            product.offerPrice = null;
            product.offerStartDate = null;
            product.offerEndDate = null;
        }

        await product.save();

  
        if (!Array.isArray(productColors) || productVariants.length === 0) {
            console.error("❌ Error: Product colors or sizes are missing/invalid.");
            return res.status(400).json({ success: false, message: "Invalid product colors or sizes." });
        }

  
        await Variant.deleteMany({ productId: product._id });

   
        let variants = productVariants.map(variant => ({
            productId: product._id,
            color: variant.color,
            size: Object.entries(variant.sizes)
                .map(([size, stock]) => `${size}:${stock}`)
                .join(",") 
        }));

        if (variants.length > 0) {
            await Variant.insertMany(variants);
            console.log("✅ Variants successfully updated:", variants);
        } else {
            console.warn("⚠️ No valid variants to insert.");
        }


        res.redirect("/admin/products");


    } catch (error) {
        console.error('❌ Error updating product:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};






const loadDelProductPage = async (req, res) => {
    try {
        const deletedProducts = await Products.find({ isDeleted: true });
        res.render("productDelete", { deletedProducts });
    } catch (error) {
        console.error("Error fetching deleted products:", error);
        next(err);
    }
}


const deleteProduct = async (req, res) => {
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





const recoverProduct = async (req, res, next) => {
    try {
        const productId = req.params.id;


        const product = await Products.findById(productId);
        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }

        if (!product.isDeleted) {
            return res.status(400).json({ success: false, message: 'Product is already active' });
        }


        product.isDeleted = false;
        await product.save();

        res.status(200).json({ success: true, message: 'Product successfully recovered', product });

    } catch (error) {
        console.error(error);
        next(error);
    }
};










module.exports = {
    loadProductManagement,
    loadAddProductsPage,
    loadUpdateProduct,
    updateProduct,
    loadDelProductPage,
    deleteProduct,
    addProduct,
    recoverProduct,
}



