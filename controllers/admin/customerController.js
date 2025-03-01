const User = require('../../models/userSchema'); 
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const sharp = require('sharp');


const loadUserManagementPage = async (req, res) => {
    try {
        if (!req.session.admin) {
            return res.status(200).render('admin-login', { message: "" });
        }


        let searchQuery = req.query.search || ''; 
        let searchFilter = {};
        
        if (searchQuery) {
            searchFilter = {
                $or: [
                    { name: { $regex: searchQuery, $options: 'i' } },
                    { email: { $regex: searchQuery, $options: 'i' } }
                ]
            };
        }

        let page = parseInt(req.query.page) || 1;
        let limit = 5;
        let skip = (page - 1) * limit;

        let totalUsers = await User.countDocuments(searchFilter); 
        let totalPages = Math.ceil(totalUsers / limit);

        let users = await User.find(searchFilter)
                              .skip(skip)
                              .limit(limit)
                              .sort({ createdOn: -1 });
                              

        return res.status(200).render('userManagement', {
            users: users,
            msg: users.length === 0 ? 'No users found' : '',
            currentPage: page,
            totalPages,
            searchQuery
        });
    } catch (error) {
        console.error('Error rendering user management page:', error);
        res.status(500).send('Internal Server Error');
    }
};



const getUsersAsJson = async (req, res) => {
    try {
       
        const users = await User.find({});
     
        return res.status(200).json(users); 
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};



const userBan = async (req, res) => {
    console.log('...............')
    try {
        const { email } = req.body;

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (user.isAdmin) {
            return res.status(400).json({ error: 'Cannot ban an admin user' });
        }

        user.isBlocked = !user.isBlocked; 
        await user.save();
        
        res.json({
            message: `User ${user.isBlocked ? 'Blocked' : 'Activated'} successfully!`,
        });
    } catch (error) {
        console.error('Error updating user status:', error);
        res.status(500).json({ error: 'Error updating user status' });
    }
};



const viewUserDetails = async (req, res) => {
    try {
        const email = req.query.email; 

        const user = await User.findOne({ email: email });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const createdOn  = new Date(user.createdOn).toISOString().split('T')[0];
        const role = user.isAdmin ? 'Admin' : 'User';
    
        res.status(200).json({
            username: user.name || 'No Name',
            email: user.email || 'No Email',
            role: role,
            joinDate:createdOn, 
            isBlocked: user.isBlocked || false,
        });
    } catch (error) {
        console.error('Error fetching user details:', error);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
};

module.exports = {
    loadUserManagementPage,
    getUsersAsJson,
    userBan,
    viewUserDetails,
};

