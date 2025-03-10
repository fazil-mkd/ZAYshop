// loadCategoryManagement,
//     loadUpdateCategory,
//     deleteCategory,

//     loadDelCategoryPage,
//     recoverCategory,


const Category = require("../../models/categorySchema");
const Products = require("../../models/productSchema");
const mongoose = require('mongoose');
const path = require('path')
const fs = require('fs')
const cloudinary = require('../../config/cloudinary.js');



async function deleteCategoryById(id, isPermanent = false) {
  try {
      if (isPermanent) {
         
          return await Category.findByIdAndDelete(id);
      } else {
        
          return await Category.findByIdAndUpdate(id, { isDeleted: true }, { new: true });
      }
  } catch (error) {
      console.error("Error deleting category:", error);
      throw error;
  }
}



const loadCategoryManagement = async (req, res) => {
  try {
    if (!req.session.admin) {
      return res.status(200).render("admin-login", { message: "" });
    }

    const page = parseInt(req.query.page) || 1;
    const categoriesPerPage = 8;
    const skip = (page - 1) * categoriesPerPage;
    const searchQuery = req.query.search ? req.query.search.trim() : "";

    let filter = { isListed: true }; 

    if (searchQuery) {
      filter.name = { $regex: searchQuery, $options: "i" }; 
    }

    const categories = await Category.find(filter)
      .sort({ createdAt: -1 }) 
      .skip(skip)
      .limit(categoriesPerPage);

    const totalCategories = await Category.countDocuments(filter);
    const totalPages = Math.ceil(totalCategories / categoriesPerPage);

    if (!categories || categories.length === 0) {
      return res.status(200).render("categoryManagement", {
        categoriesWithCounts: [],
        msg: "No categories found",
        currentPage: page,
        totalPages,
        searchQuery,
      });
    }

    const categoriesWithCounts = await Promise.all(
      categories.map(async (category) => {
        const productCount = await Products.countDocuments({ category: category._id });
        return { ...category.toObject(), productCount };
      })
    );

    return res.status(200).render("categoryManagement", {
      categoriesWithCounts,
      msg: null,
      currentPage: page,
      totalPages,
      searchQuery,
    });
  } catch (error) {
    console.error("Error loading category management page:", error);
    return res.status(500).send("Internal Server Error");
  }
};




const loadUpdateCategory = async (req, res) => {
  try {
    const categoryId = req.params.id;

   
    if (!mongoose.Types.ObjectId.isValid(categoryId)) {
      return res.status(400).render("page-404", { message: "Invalid ID" });
    }

    const category = await Category.findById(categoryId);
    
    
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }
    
    res.render('categoryUpdate', { category });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error fetching category' });
  }
};


const updateCategory = async (req, res) => {
  const { id } = req.params;
  const { categoryName, categoryDescription } = req.body;

  console.log('Updating category with ID:', id);

  try {

    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    console.log('Existing category found:', category);

   
    const uploadImageToCloudinary = (file) => {
      return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            resource_type: 'auto',
            folder: 'categories',
            public_id: `${categoryName}-${Date.now()}`,
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

    if (req.file) {
      console.log('New image file received:', req.file);

      if (category.image) {
        const publicId = category.image.split('/').pop().split('.')[0]; 
        await cloudinary.uploader.destroy(publicId); 
      }

      const newImageUrl = await uploadImageToCloudinary(req.file);
      console.log('New image uploaded to Cloudinary:', newImageUrl);
      category.image = newImageUrl; 
    } else {
      console.log('No new image provided, retaining existing image');
    }


    category.name = categoryName || category.name;
    category.description = categoryDescription || category.description;
    category.updatedAt=new Date()

    const updatedCategory = await category.save();
    console.log('Category updated successfully:', updatedCategory);

    return res.redirect("/admin/category");

  } catch (error) {
    console.error('Error updating category:', error);
    res.status(500).json({ message: 'Failed to update category', error: error.message });
  }
};


  const loadAddCategoryPage =async (req, res)=>{
    try {
        
      return res.status(200).render("categoryAdd");
    } catch (error) {
      console.error("Error loading category adding page:", error);
      return res
        .status(500)
        .json({ message: "Error loading category loading page" });
    }
  }




  const addCategory = async (req, res) => {
    try {
        const { categoryName, categoryDescription } = req.body;
        const categoryImage = req.file;  

        console.log(categoryName, categoryDescription,'imaaaaaaaaageee',categoryImage);

        if (!categoryName || !categoryDescription || !categoryImage) {
            return res.status(400).json({
                success: false,
                message: 'Please fill in all required fields and upload an image.',
            });
        }

    
        const fileTypes = /jpeg|jpg|png/;
        const isValidImage = fileTypes.test(path.extname(categoryImage.originalname).toLowerCase()) && fileTypes.test(categoryImage.mimetype);
        if (!isValidImage) {
            return res.status(400).json({
                success: false,
                message: 'Only JPEG, JPG, or PNG images are allowed.',
            });
        }

        const existingCategory = await Category.findOne({ name: categoryName });
        if (existingCategory) {
            return res.status(400).json({
                success: false,
                message: 'Category with this name already exists.',
            });
        }

        const uploadImageToCloudinary = (file) => {
            return new Promise((resolve, reject) => {
                const stream = cloudinary.uploader.upload_stream(
                    {
                        resource_type: 'auto',
                        folder: 'categories',  
                        public_id: `${Date.now()}-${file.originalname}`,
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

        const imageUrl = await uploadImageToCloudinary(categoryImage);

        const newCategory = new Category({
            name: categoryName,
            description: categoryDescription,
            image: imageUrl,  
        });

        console.log('Category data to save:', {
            name: categoryName,
            description: categoryDescription,
            image: imageUrl,
        });

        try {
            await newCategory.save();
            console.log('Category saved successfully');
        } catch (error) {
            console.error('Error saving category:', error);
            return res.status(500).json({
                success: false,
                message: 'Error saving category to database',
            });
        }

        res.redirect('/admin/category')

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: 'Server error while adding category.',
        });
    }
};





const loadDelCategoryPage = async (req, res) => {
  try {
      const page = parseInt(req.query.page) || 1; 
      const limit = 10; 
      const skip = (page - 1) * limit; 


      const deletedCategories = await Category.find({ isListed: false })
          .skip(skip)
          .limit(limit);

      const totalDeletedCategories = await Category.countDocuments({ isListed: false });
      const totalPages = Math.ceil(totalDeletedCategories / limit);

      return res.render("categoryDelete", {
        deletedProducts:deletedCategories, 
          currentPage: page,
          totalPages
      });
  } catch (error) {
      console.error("Error fetching deleted categories:", error);
      return res.status(500).send("Internal Server Error");
  }
};




const recoverCategory = async (req, res) => {
  try {
      const { id } = req.params; 

      const category = await Category.findById(id);
      if (!category) {
          return res.status(404).json({ message: 'Category not found' });
      }

      if (category.isListed) {
          return res.status(400).json({ message: 'Category is already active' });
      }

      category.isListed = true; 
      await category.save();

      res.status(200).json({ message: 'Category successfully recovered', category });
  } catch (error) {
      console.error('Error recovering category:', error);
      res.status(500).json({ message: 'Failed to recover category', error: error.message });
  }
};



const deleteCategory = async (req, res) => {
  const { id } = req.body;  

  try {

      const category = await Category.findById(id);
      
      if (!category) {
          return res.status(404).json({ message: 'Category not found' });
      }

      category.isListed = false; 

      await category.save();

      res.status(200).json({ message: 'Category unlisted successfully' });
  } catch (error) {
      console.error('Error unlisting category:', error);
      res.status(500).json({ message: 'Failed to unlist category', error: error.message });
  }
};






module.exports ={
    loadCategoryManagement,
    loadUpdateCategory,
    updateCategory,
    loadAddCategoryPage,
    addCategory,
    loadDelCategoryPage,
    recoverCategory,
    deleteCategory,
    
}

