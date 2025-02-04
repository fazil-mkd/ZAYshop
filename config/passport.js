// config/passport.js
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/userSchema');
require('dotenv').config();

// Google Strategy Configuration
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: '/auth/google/callback',
    scope: ['email', 'profile', 'openid']
}, async (accessToken, refreshToken, profile, done) => {
    try {
        console.log('Google profile received:', profile.id);
        
        let user = await User.findOne({ 
            $or: [
                { googleId: profile.id },
                { email: profile.emails[0].value }
            ]
        });

        if (user) {
            console.log('Existing user found:', user._id);

            return done(null, user);
        }

        user = new User({
            name: profile.displayName,
            email: profile.emails[0].value,
            googleId: profile.id,
            password:'2b$10$ds5hw0SqeAI7UUSw07Aq9uA/pDJFQ/wMb/lcGxCHsdYf7zUHVoxaO'
        });

        await user.save();
        return done(null, user);

    } catch (error) {
        return done(error, null);
    }
}));


passport.serializeUser((user, done) => {
    console.log('Serializing user:', user._id);
    done(null, user._id);
});


passport.deserializeUser(async (id, done) => {
    try {
        console.log('Attempting to deserialize user:', id);
        const user = await User.findById(id).lean();  
            
        if (!user) {   
            return done(null, false);
        }


        done(null, user);
    } catch (error) {
        done(error, null);
    }
});

module.exports = passport;