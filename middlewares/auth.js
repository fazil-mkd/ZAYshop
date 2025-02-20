const { status } = require('express/lib/response');
const User = require('../models/userSchema');

const userAuth = (req,res,next)=>{

    if(req.session.user){
        User.findById(req.session.user)
        .then(data=>{
            if(data && !data.isBlocked){
               next();
            }else{
                res.redirect('/login')
            }
        })
      .catch(error=>{
      console.log('Error in user auth middleware',error);
      res.status(500).send('Internal Server error')
      })
        }else{
            res.redirect('/login')
        }
    }





    const adminAuth = (req, res, next) => {
      try {

          if (req.session && req.session.admin) {
              return next();
          }

          return res.status(401).redirect('/admin/adminlogin');
  
      } catch (error) {
          console.error('Error in admin authentication middleware:', error);
          return res.status(500).json({ message: 'Internal Server Error' });
      }
  };
  

  



    module.exports ={
        userAuth,
        adminAuth,
    }
