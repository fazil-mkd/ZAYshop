const express = require('express')
const app = express();
const path = require('path')
const session = require("express-session");
const passport = require("./config/passport")
require('dotenv').config()
const db = require("./config/db")
const PORT = process.env.PORT || 4000;
const userRouter = require("./routes/userRouter")
const adminRouter= require("./routes/adminRouter")
const methodOverride = require('method-override');
const MongoStore = require('connect-mongo');
const flash = require('connect-flash');

const Wishlist = require('./models/wishlistSchema');
const Cart = require('./models/cartSchema')

const NotFoundError = require('./helpers/NotFoundError');

const isBlockedMiddleware = require('./middlewares/UserBlock');

const { errorHandler, notFoundHandler } = require('./middlewares/errorHandling');

db()

app.use(methodOverride('_method')); 


app.use(express.json({ limit: '10mb' })); 
app.use(express.urlencoded({ limit: '10mb', extended: true }));



app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    // store: MongoStore.create({
    //   mongoUrl:process.env.MONGODB_URI,
    //   collectionName: 'sessions',
    // }),
    cookie: {
      secure: false,
      httpOnly: true,
      maxAge: 72 * 60 * 60 * 1000, 
    },
  })
);



app.use(flash());

app.use((req, res, next) => {
  res.locals.successMessage = req.flash('success');
  res.locals.datas = req.flash('data');
  res.locals.errorMessage = req.flash('error');
  next();
});



app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  next();
});

app.use(passport.initialize());
app.use(passport.session());

app.set('view engine', 'ejs');
app.set('views', [path.join(__dirname, 'views/user'), path.join(__dirname, 'views/admin')]);
app.use(express.static('public'));

app.use("/", userRouter);
app.use("/admin",adminRouter);
app.use(express.static(path.join(__dirname, 'public')));

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.set('view engine', 'ejs');


app.use((req, res, next) => {

  req.user = req.session.user 
  req.session.userId=req.session.user._id
  next();
});



app.use(errorHandler);
app.use(notFoundHandler);



app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
