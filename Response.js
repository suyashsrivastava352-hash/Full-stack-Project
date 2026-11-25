const mongoose = require('mongoose');

const answerSchema = new mongoose.Schema({
  question: { type: mongoose.Schema.Types.ObjectId, required: true },
  value: { type: mongoose.Schema.Types.Mixed, required: true }, // number (rating) or string
}, { _id: false });

const responseSchema = new mongoose.Schema({
  survey: { type: mongoose.Schema.Types.ObjectId, ref: 'Survey', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  answers: [answerSchema],
}, { timestamps: true });

// One submission per employee per survey
responseSchema.index({ survey: 1, user: 1 }, { unique: true });

module.exports = mongoose.model('Response', responseSchema);
