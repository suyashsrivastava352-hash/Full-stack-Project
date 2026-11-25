const router = require('express').Router();
const Survey = require('../models/Survey');
const Response = require('../models/Response');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

// Employees submit answers to an active survey (one submission each)
router.post('/:surveyId', authorize('employee'), async (req, res) => {
  const survey = await Survey.findById(req.params.surveyId);
  if (!survey || survey.status !== 'active')
    return res.status(404).json({ success: false, message: 'This survey is not open' });
  if (await Response.exists({ survey: survey._id, user: req.user._id }))
    return res.status(400).json({ success: false, message: 'You have already submitted this survey' });

  const given = new Map((Array.isArray(req.body.answers) ? req.body.answers : []).map((a) => [String(a.question), a.value]));
  const clean = [];
  for (const q of survey.questions) {
    let v = given.get(String(q._id));
    const empty = v === undefined || v === null || String(v).trim() === '';
    if (empty) {
      if (q.required) return res.status(400).json({ success: false, message: `Please answer: ${q.text}` });
      continue;
    }
    if (q.type === 'rating') {
      v = Number(v);
      if (!Number.isInteger(v) || v < 1 || v > 5)
        return res.status(400).json({ success: false, message: `Rating must be 1 to 5: ${q.text}` });
    } else if (q.type === 'choice') {
      if (!q.options.includes(v))
        return res.status(400).json({ success: false, message: `Invalid option for: ${q.text}` });
    } else {
      v = String(v).trim().slice(0, 1000);
    }
    clean.push({ question: q._id, value: v });
  }

  try {
    await Response.create({ survey: survey._id, user: req.user._id, answers: clean });
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ success: false, message: 'You have already submitted this survey' });
    throw err;
  }
  res.status(201).json({ success: true, message: 'Thank you for your feedback' });
});

module.exports = router;
