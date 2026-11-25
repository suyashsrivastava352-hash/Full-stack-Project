const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

const sign = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' });
const publicUser = (u) => ({ id: u._id, name: u.name, email: u.email, role: u.role, department: u.department });

// Registration always creates an employee. Admins are created with seed.js.
router.post('/register', async (req, res) => {
  const { name, email, password, department } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ success: false, message: 'Name, email and password are required' });
  if (password.length < 6)
    return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
  if (await User.findOne({ email: email.toLowerCase() }))
    return res.status(400).json({ success: false, message: 'Email already registered' });
  const user = await User.create({ name, email, department: department || 'General', password: await bcrypt.hash(password, 10) });
  res.status(201).json({ success: true, token: sign(user._id), user: publicUser(user) });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email: (email || '').toLowerCase() }).select('+password');
  if (!user || !(await bcrypt.compare(password || '', user.password)))
    return res.status(401).json({ success: false, message: 'Invalid email or password' });
  res.json({ success: true, token: sign(user._id), user: publicUser(user) });
});

router.get('/me', protect, (req, res) => res.json({ success: true, user: publicUser(req.user) }));

module.exports = router;
