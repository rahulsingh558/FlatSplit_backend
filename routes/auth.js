const express = require('express');
const passport = require('passport');
const { googleCallback, getMe, logout, updateProfile } = require('../controllers/authController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// @desc    Auth with Google
// @route   GET /api/auth/google
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

// @desc    Google auth callback
// @route   GET /api/auth/google/callback
router.get(
  '/google/callback',
  (req, res, next) => {
    passport.authenticate('google', { failureRedirect: `${process.env.CLIENT_URL}/login?error=auth_failed`, session: false })(req, res, next);
  },
  googleCallback
);

// @desc    Get current logged in user
// @route   GET /api/auth/me
router.get('/me', protect, getMe);

// @desc    Logout user
// @route   POST /api/auth/logout
router.post('/logout', protect, logout);

// @desc    Update user profile
// @route   PUT /api/auth/profile
router.put('/profile', protect, updateProfile);

module.exports = router;
