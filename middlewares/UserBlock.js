

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

      req.session.destroy((err) => {
        if (err) {
          return res.status(500).render('page-404', { message: 'Error logging out' });
        }
        return res.redirect('/');
      });
      return;
    }

    if (user.isBlocked) {
      req.session.destroy((err) => {
        if (err) {

          return res.status(500).render('page-404', { message: 'Error logging out' });
        }
        return res.render('banned', { message: 'You have been blocked by the admin.' });
      });
      return;
    }

    next();
  } catch (error) {
    return res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = isBlockedMiddleware;
