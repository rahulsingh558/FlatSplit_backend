const jwt = require('jsonwebtoken');

// Generate JWT token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });
};

// @desc    OAuth Callback & Issue JWT
// @route   GET /api/auth/google/callback
const googleCallback = (req, res) => {
  // Passport provides the user object in req.user
  if (!req.user) {
    return res.redirect(`${process.env.CLIENT_URL}/login?error=auth_failed`);
  }

  // Create token
  const token = generateToken(req.user._id);

  const platform = req.query.state;

  if (platform === 'android') {
    return res.redirect(`flatsplit://login?token=${token}`);
  }

  // Set JWT in HTTP-only cookie
  const options = {
    expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
  };

  res.cookie('token', token, options);
  
  // Redirect to frontend dashboard
  res.redirect(`${process.env.CLIENT_URL}/dashboard`);
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res) => {
  // req.user is populated by auth middleware
  res.status(200).json({
    success: true,
    data: req.user
  });
};

// @desc    Logout user / clear cookie
// @route   POST /api/auth/logout
// @access  Private
const logout = (req, res) => {
  res.cookie('token', 'none', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
  });

  res.status(200).json({
    success: true,
    data: {}
  });
};

// @desc    Update user profile (e.g. UPI ID)
// @route   PUT /api/auth/profile
// @access  Private
const updateProfile = async (req, res) => {
  try {
    const { name, phone, upiId } = req.body;
    
    // We get the user model because req.user is just what the middleware returned
    const User = require('../models/User');
    
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    if (name) user.name = name;
    if (phone) user.phone = phone;
    if (upiId) user.upiId = upiId;

    await user.save();

    res.status(200).json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// @desc    Set HTTP-Only cookie via API
// @route   POST /api/auth/set-cookie
// @access  Public (Requires valid token)
const setCookie = (req, res) => {
  const { token } = req.body;
  if (!token) {
    return res.status(400).json({ success: false, error: 'No token provided' });
  }

  const options = {
    expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
  };

  res.cookie('token', token, options);
  res.status(200).json({ success: true });
};

module.exports = {
  googleCallback,
  getMe,
  logout,
  updateProfile,
  setCookie
};
