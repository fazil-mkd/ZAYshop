const User = require('../models/userSchema');

const isBlockedMiddleware = async (req, res, next) => {


  if (req.path.startsWith('/admin')) {
    return next();
  }

  try {

    if (!req.session.user) {
      return next();
    }

    const user = await User.findById(req.session.user._id);
    
    if (!user) {
      delete req.session.user;
      return res.redirect('/');
    }

    if (user.isAdmin) {
      return next();
    }

    if (user.isBlocked) {
      delete req.session.user; 
      return res.render('banned', { message: 'You have been blocked by the admin.' });
    }

    next();
  } catch (error) {
    
    return res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = isBlockedMiddleware;
