// Run once: node seed.js  -> creates the admin, two demo employees and a sample survey
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./src/models/User');
const Survey = require('./src/models/Survey');

(async () => {
  await mongoose.connect(process.env.MONGO_URI);

  const people = [
    { name: 'HR Admin', email: 'admin@company.com', role: 'admin', department: 'HR', password: 'admin123' },
    { name: 'Asha Verma', email: 'asha@company.com', role: 'employee', department: 'Engineering', password: 'employee123' },
    { name: 'Rohan Mehta', email: 'rohan@company.com', role: 'employee', department: 'Sales', password: 'employee123' },
  ];
  let admin;
  for (const p of people) {
    let u = await User.findOne({ email: p.email });
    if (!u) {
      u = await User.create({ ...p, password: await bcrypt.hash(p.password, 10) });
      console.log(`Created ${p.role}: ${p.email} / ${p.password}`);
    }
    if (p.role === 'admin') admin = u;
  }

  if ((await Survey.countDocuments()) === 0) {
    await Survey.create({
      title: 'Employee Satisfaction Survey',
      description: 'Tell us how you feel about working here. It takes about two minutes.',
      status: 'active',
      isAnonymous: true,
      createdBy: admin._id,
      questions: [
        { text: 'How satisfied are you with your job overall?', type: 'rating' },
        { text: 'How would you rate work-life balance?', type: 'rating' },
        { text: 'Do you feel your work is valued by your manager?', type: 'choice', options: ['Yes', 'Sometimes', 'No'] },
        { text: 'How do you usually work?', type: 'choice', options: ['Office', 'Remote', 'Hybrid'] },
        { text: 'What is one thing we could improve?', type: 'text', required: false },
      ],
    });
    console.log('Sample survey created');
  }
  await mongoose.disconnect();
})();
