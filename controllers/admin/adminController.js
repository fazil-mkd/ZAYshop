const User = require('../../models/userSchema');
const mongoose = require('mongoose');
const bcrypt = require("bcrypt");
const req = require('express/lib/request');


const  pageerror =  async (req,res)=>{
res.render('admin-error')

}

const loadLogin  = (req,res)=>{

    if(req.session.admin){
        return res.redirect('/admin/dashboard')
    }
    res.render('admin-login',{message:null})
}





const login = async (req, res) => {
    try {
      const { email, password } = req.body;
      
      const admin = await User.findOne({ email, isAdmin: true });
      console.log(admin);
  
      if (admin) {
        const passwordMatch = await bcrypt.compare(password, admin.password);
  
        if (passwordMatch) {
          req.session.admin = true;
          return res.redirect('/admin/dashboard');
        } else {
          return res.redirect('/admin/adminlogin');
        }
      } else {
        return res.redirect('/admin/adminlogin');
      }
    } catch (error) {
      console.log('Login error', error);
      return res.redirect('/pageerror');
    }
  };




const loadDashboard= async(req,res)=>{
      if(req.session.admin){
        try {
            res.render('dashboard')
        } catch (error) {
            res.redirect('/pageerror')
        }
      }
}




const logout = async(req,res)=>{

try {
    req.session.destroy(err =>{
    if(err){
console.log('Error destroy session ',err);
return res.redirect('/pageerror')
    }
    res.redirect('/admin/adminlogin')
    })
} catch (error) {
    console.log('unexpected error during logout',error)
    res.redirect('/pageerror')
}
}




module.exports = {
    loadLogin,
    login,
    loadDashboard,
    pageerror,
    logout,
    
}