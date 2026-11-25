const router = require('express').Router();
const Survey = require('../models/Survey');
const Response = require('../models/Response');
const User = require('../models/User');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

// Returns an error message, or null if the questions are valid
function checkQuestions(questions) {
  if (!Array.isArray(questions) || questions.length < 1) return 'Add at least one question';
  if (questions.length > 30) return 'A survey can have at most 30 questions';
  for (const [i, q] of questions.entries()) {
    if (!q.text || !String(q.text).trim()) return `Question ${i + 1} needs some text`;
    if (!['rating', 'choice', 'text'].includes(q.type)) return `Question ${i + 1} has an invalid type`;
    if (q.type === 'choice' && (!Array.isArray(q.options) || q.options.filter((o) => String(o).trim()).length < 2))
      return `Question ${i + 1} needs at least two options`;
  }
  return null;
}

const cleanQuestions = (questions) => questions.map((q) => ({
  text: String(q.text).trim(),
  type: q.type,
  options: q.type === 'choice' ? q.options.map((o) => String(o).trim()).filter(Boolean) : [],
  required: q.required !== false,
}));

// List surveys: admin sees all, employees see active ones with a "submitted" flag
router.get('/', async (req, res) => {
  if (req.user.role === 'admin') {
    const surveys = await Survey.find().sort('-createdAt').lean();
    const counts = await Response.aggregate([{ $group: { _id: '$survey', n: { $sum: 1 } } }]);
    const map = Object.fromEntries(counts.map((c) => [String(c._id), c.n]));
    return res.json({
      success: true,
      surveys: surveys.map((s) => ({ ...s, questionCount: s.questions.length, responseCount: map[String(s._id)] || 0 })),
    });
  }
  const surveys = await Survey.find({ status: 'active' }).sort('-createdAt').lean();
  const done = (await Response.distinct('survey', { user: req.user._id, survey: { $in: surveys.map((s) => s._id) } })).map(String);
  res.json({
    success: true,
    surveys: surveys.map((s) => ({
      _id: s._id, title: s.title, description: s.description, isAnonymous: s.isAnonymous,
      questionCount: s.questions.length, createdAt: s.createdAt, submitted: done.includes(String(s._id)),
    })),
  });
});

// One survey with its questions
router.get('/:id', async (req, res) => {
  const survey = await Survey.findById(req.params.id);
  if (!survey || (req.user.role !== 'admin' && survey.status !== 'active'))
    return res.status(404).json({ success: false, message: 'Survey not found' });
  const submitted = req.user.role === 'admin' ? false : !!(await Response.exists({ survey: survey._id, user: req.user._id }));
  res.json({ success: true, survey, submitted });
});

// ---------- ADMIN ONLY ----------
router.post('/', authorize('admin'), async (req, res) => {
  const { title, description, isAnonymous, questions } = req.body;
  if (!title || !title.trim()) return res.status(400).json({ success: false, message: 'Survey title is required' });
  const problem = checkQuestions(questions);
  if (problem) return res.status(400).json({ success: false, message: problem });
  const survey = await Survey.create({
    title, description, isAnonymous: !!isAnonymous, questions: cleanQuestions(questions), createdBy: req.user._id,
  });
  res.status(201).json({ success: true, survey });
});

// Publish (active), close, or move back to draft
router.patch('/:id/status', authorize('admin'), async (req, res) => {
  const { status } = req.body;
  if (!['draft', 'active', 'closed'].includes(status))
    return res.status(400).json({ success: false, message: 'Invalid status' });
  const survey = await Survey.findByIdAndUpdate(req.params.id, { status }, { new: true });
  if (!survey) return res.status(404).json({ success: false, message: 'Survey not found' });
  res.json({ success: true, survey });
});

router.delete('/:id', authorize('admin'), async (req, res) => {
  const survey = await Survey.findByIdAndDelete(req.params.id);
  if (!survey) return res.status(404).json({ success: false, message: 'Survey not found' });
  await Response.deleteMany({ survey: survey._id });
  res.json({ success: true, message: 'Survey and its responses deleted' });
});

// Results: totals, averages, option counts and text comments
router.get('/:id/results', authorize('admin'), async (req, res) => {
  const survey = await Survey.findById(req.params.id);
  if (!survey) return res.status(404).json({ success: false, message: 'Survey not found' });
  const [responses, totalEmployees] = await Promise.all([
    Response.find({ survey: survey._id }).populate('user', 'name department'),
    User.countDocuments({ role: 'employee' }),
  ]);

  const questions = survey.questions.map((q) => {
    const values = [];
    for (const r of responses) {
      const a = r.answers.find((x) => String(x.question) === String(q._id));
      if (a) values.push({ value: a.value, by: survey.isAnonymous ? null : r.user?.name || 'Unknown' });
    }
    const out = { _id: q._id, text: q.text, type: q.type, answered: values.length };
    if (q.type === 'rating') {
      out.distribution = [1, 2, 3, 4, 5].map((n) => ({ label: String(n), count: values.filter((v) => v.value === n).length }));
      out.average = values.length ? +(values.reduce((s, v) => s + v.value, 0) / values.length).toFixed(2) : null;
    } else if (q.type === 'choice') {
      out.distribution = q.options.map((o) => ({ label: o, count: values.filter((v) => v.value === o).length }));
    } else {
      out.comments = values.map((v) => ({ text: v.value, by: v.by }));
    }
    return out;
  });

  res.json({
    success: true,
    survey: { _id: survey._id, title: survey.title, description: survey.description, status: survey.status, isAnonymous: survey.isAnonymous },
    totalResponses: responses.length,
    totalEmployees,
    questions,
  });
});

module.exports = router;
