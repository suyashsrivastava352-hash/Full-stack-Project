require('dotenv').config();
require('express-async-errors');
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const connectDB = require('./src/config/db');

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());

// REST API
app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/surveys', require('./src/routes/surveys'));
app.use('/api/responses', require('./src/routes/responses'));
app.use('/api/admin', require('./src/routes/admin'));

// Frontend (HTML/CSS/JS in /public)
app.use(express.static(path.join(__dirname, 'public')));

// Centralised error handler
app.use((err, req, res, next) => {
  let status = err.status || 500;
  let message = err.message || 'Server error';
  if (err.name === 'ValidationError') { status = 400; message = Object.values(err.errors).map((e) => e.message).join(', '); }
  if (err.name === 'CastError') { status = 400; message = 'Invalid id'; }
  if (err.code === 11000) { status = 400; message = 'Duplicate value'; }
  if (status === 500) console.error(err);
  res.status(status).json({ success: false, message });
});

connectDB().then(() => {
  const port = process.env.PORT || 5000;
  app.listen(port, () => console.log(`Survey portal running on http://localhost:${port}`));
});
