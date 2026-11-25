const router = require('express').Router();
const User = require('../models/User');
const Survey = require('../models/Survey');
const Response = require('../models/Response');
const { protect, authorize } = require('../middleware/auth');

router.use(protect, authorize('admin'));

router.get('/stats', async (req, res) => {
  const [employees, surveys, active, responses] = await Promise.all([
    User.countDocuments({ role: 'employee' }),
    Survey.countDocuments(),
    Survey.countDocuments({ status: 'active' }),
    Response.countDocuments(),
  ]);
  res.json({ success: true, stats: { employees, surveys, active, responses } });
});

router.get('/users', async (req, res) => {
  const users = await User.find({ role: 'employee' }).sort('name');
  res.json({ success: true, users });
});

module.exports = router;
