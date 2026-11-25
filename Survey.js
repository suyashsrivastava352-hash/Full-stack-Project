const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  text: { type: String, required: [true, 'Question text is required'], trim: true },
  type: { type: String, enum: ['rating', 'choice', 'text'], required: true },
  options: { type: [String], default: [] },   // used by "choice" questions
  required: { type: Boolean, default: true },
});

const surveySchema = new mongoose.Schema({
  title: { type: String, required: [true, 'Title is required'], trim: true },
  description: { type: String, default: '', trim: true },
  status: { type: String, enum: ['draft', 'active', 'closed'], default: 'draft' },
  isAnonymous: { type: Boolean, default: false },
  questions: { type: [questionSchema], default: [] },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

module.exports = mongoose.model('Survey', surveySchema);
