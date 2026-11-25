const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Verifies the JWT and attaches the user to req.user
exports.protect = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer '))
    return res.status(401).json({ success: false, message: 'Please log in first' });
  try {
    const decoded = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) return res.status(401).json({ success: false, message: 'User no longer exists' });
    req.user = user;
    next();
  } catch {
    res.status(401).json({ success: false, message: 'Session expired, please log in again' });
  }
};

// Role-based access control
exports.authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role))
    return res.status(403).json({ success: false, message: 'You do not have permission to do this' });
  next();
};
