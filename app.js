/* PulseCheck frontend: vanilla JS that talks to the REST API at /api */
const API = '/api';
const $ = (id) => document.getElementById(id);
const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtDate = (d) => new Date(d).toLocaleDateString('en-IN');

let token = localStorage.getItem('token');
let me = JSON.parse(localStorage.getItem('user') || 'null');
let currentSurvey = null;

/* ---------- helpers ---------- */
async function api(path, method = 'GET', body) {
  const res = await fetch(API + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && token) logout();
  if (!res.ok) throw new Error(data.message || 'Something went wrong');
  return data;
}

let toastTimer;
function toast(msg, isError = false) {
  const t = $('toast');
  t.textContent = msg;
  t.className = 'show' + (isError ? ' error' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.className = ''), 3200);
}
const guard = (fn) => async (...a) => { try { await fn(...a); } catch (e) { toast(e.message, true); } };

/* ---------- navigation ---------- */
const loaders = { surveys: loadSurveys, admin: loadAdmin };

function show(view) {
  const isAdmin = me?.role === 'admin';
  if (!token) view = 'auth';
  else if (isAdmin && (view === 'surveys' || view === 'take')) view = 'admin';
  else if (!isAdmin && (view === 'admin' || view === 'results')) view = 'surveys';
  document.querySelectorAll('.view').forEach((v) => (v.hidden = true));
  $('view-' + view).hidden = false;
  document.querySelectorAll('#menu button[data-view]').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
  window.scrollTo(0, 0);
  if (loaders[view]) guard(loaders[view])();
}

function refreshNav() {
  const loggedIn = !!(token && me);
  $('menu').hidden = !loggedIn;
  if (loggedIn) {
    $('whoami').textContent = `${me.name} (${me.role === 'admin' ? 'HR admin' : me.department})`;
    $('adminLink').hidden = me.role !== 'admin';
    $('empLink').hidden = me.role === 'admin';
  }
}

function logout() {
  token = null; me = null;
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  refreshNav();
  show('auth');
}

document.querySelectorAll('[data-view]').forEach((el) => el.addEventListener('click', () => show(el.dataset.view)));
$('logoutBtn').addEventListener('click', logout);

/* ---------- auth ---------- */
let registerMode = false;
$('authToggle').addEventListener('click', (e) => {
  e.preventDefault();
  registerMode = !registerMode;
  $('aName').hidden = !registerMode;
  $('aName').required = registerMode;
  $('aDept').hidden = !registerMode;
  $('authTitle').textContent = registerMode ? 'Create account' : 'Log in';
  $('authSubmit').textContent = registerMode ? 'Sign up' : 'Log in';
  $('authHint').textContent = registerMode ? 'Already registered?' : 'New employee?';
  $('authToggle').textContent = registerMode ? 'Log in' : 'Create an account';
});

$('authForm').addEventListener('submit', guard(async (e) => {
  e.preventDefault();
  const body = { email: $('aEmail').value, password: $('aPass').value };
  if (registerMode) { body.name = $('aName').value; body.department = $('aDept').value; }
  const data = await api(registerMode ? '/auth/register' : '/auth/login', 'POST', body);
  token = data.token; me = data.user;
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(me));
  $('authForm').reset();
  toast('Welcome, ' + me.name);
  refreshNav();
  show(me.role === 'admin' ? 'admin' : 'surveys');
}));

/* ---------- employee: survey list ---------- */
async function loadSurveys() {
  const { surveys } = await api('/surveys');
  $('surveyList').innerHTML = surveys.length ? surveys.map((s) => `
    <article class="card">
      <div class="card-head">
        <h3>${esc(s.title)}</h3>
        <span class="chip ${s.submitted ? 'done' : 'pending'}">${s.submitted ? 'Completed' : 'Pending'}</span>
      </div>
      <p class="muted">${esc(s.description)}</p>
      <div class="meta">${s.questionCount} questions &middot; ${s.isAnonymous ? 'Anonymous' : 'Your name is shown to HR'} &middot; ${fmtDate(s.createdAt)}</div>
      <button data-id="${s._id}" ${s.submitted ? 'disabled' : ''}>${s.submitted ? 'Already submitted' : 'Take survey'}</button>
    </article>`).join('') : '<p class="muted">No open surveys right now. Check back later.</p>';
  $('surveyList').querySelectorAll('button[data-id]:not([disabled])').forEach((b) =>
    b.addEventListener('click', guard(() => openSurvey(b.dataset.id))));
}

/* ---------- employee: take survey ---------- */
async function openSurvey(id) {
  const { survey, submitted } = await api('/surveys/' + id);
  if (submitted) return toast('You have already submitted this survey', true);
  currentSurvey = survey;
  $('takeForm').innerHTML = `
    <h2>${esc(survey.title)}</h2>
    <p class="muted">${esc(survey.description)}</p>
    <p class="muted">${survey.isAnonymous ? 'This survey is anonymous: HR will not see your name.' : 'HR can see your name next to your answers.'}</p>
    ${survey.questions.map((q, i) => `
      <fieldset class="question">
        <legend class="q-title">${i + 1}. ${esc(q.text)} ${q.required ? '<span class="req" aria-label="required">*</span>' : '<span class="muted">(optional)</span>'}</legend>
        ${q.type === 'rating' ? `
          <div class="scale">${[1, 2, 3, 4, 5].map((n) => `<label class="pill"><input type="radio" name="q_${q._id}" value="${n}"><span>${n}</span></label>`).join('')}</div>
          <div class="scale-note"><span>1 = Low</span><span>5 = High</span></div>` : ''}
        ${q.type === 'choice' ? `<div class="options">${q.options.map((o) => `<label class="pill"><input type="radio" name="q_${q._id}" value="${esc(o)}"><span>${esc(o)}</span></label>`).join('')}</div>` : ''}
        ${q.type === 'text' ? `<textarea name="q_${q._id}" rows="3" maxlength="1000" placeholder="Type your answer"></textarea>` : ''}
      </fieldset>`).join('')}
    <button type="submit">Submit survey</button>`;
  show('take');
}

$('takeForm').addEventListener('submit', guard(async (e) => {
  e.preventDefault();
  const answers = currentSurvey.questions.map((q) => {
    let value = '';
    if (q.type === 'text') value = $('takeForm').querySelector(`[name="q_${q._id}"]`).value;
    else {
      const checked = $('takeForm').querySelector(`input[name="q_${q._id}"]:checked`);
      value = checked ? checked.value : '';
    }
    return { question: q._id, value };
  });
  await api('/responses/' + currentSurvey._id, 'POST', { answers });
  toast('Thank you for your feedback');
  show('surveys');
}));

/* ---------- admin: dashboard ---------- */
document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => {
  document.querySelectorAll('.tab').forEach((x) => x.classList.toggle('active', x === t));
  ['surveysTab', 'createTab', 'peopleTab'].forEach((id) => ($('tab-' + id).hidden = id !== t.dataset.tab));
}));

async function loadAdmin() {
  const [{ stats }, { surveys }, { users }] = await Promise.all([api('/admin/stats'), api('/surveys'), api('/admin/users')]);
  $('stats').innerHTML = [['Employees', stats.employees], ['Surveys', stats.surveys], ['Active now', stats.active], ['Responses', stats.responses]]
    .map(([k, v]) => `<div class="stat"><strong>${v}</strong>${k}</div>`).join('');

  $('adminSurveys').innerHTML = surveys.length ? surveys.map((s) => `
    <tr>
      <td><strong>${esc(s.title)}</strong><br><span class="muted">${s.questionCount} questions</span></td>
      <td><span class="chip ${s.status}">${s.status}</span></td>
      <td>${s.responseCount}</td>
      <td>${s.isAnonymous ? 'Anonymous' : 'Named'}</td>
      <td><div class="row">
        <button class="small outline" data-act="results" data-id="${s._id}">Results</button>
        ${s.status === 'active'
          ? `<button class="small outline" data-act="closed" data-id="${s._id}">Close</button>`
          : `<button class="small" data-act="active" data-id="${s._id}">Publish</button>`}
        <button class="small danger" data-act="delete" data-id="${s._id}">Delete</button>
      </div></td>
    </tr>`).join('') : '<tr><td colspan="5" class="muted">No surveys yet. Use "Create survey".</td></tr>';

  $('adminSurveys').querySelectorAll('button[data-act]').forEach((b) => b.addEventListener('click', guard(async () => {
    const { act, id } = b.dataset;
    if (act === 'results') return openResults(id);
    if (act === 'delete') {
      if (!confirm('Delete this survey and all its responses?')) return;
      await api('/surveys/' + id, 'DELETE');
      toast('Survey deleted');
    } else {
      await api(`/surveys/${id}/status`, 'PATCH', { status: act });
      toast(act === 'active' ? 'Survey published' : 'Survey closed');
    }
    loadAdmin();
  })));

  $('adminPeople').innerHTML = users.length ? users.map((u) =>
    `<tr><td>${esc(u.name)}</td><td>${esc(u.email)}</td><td>${esc(u.department)}</td></tr>`).join('')
    : '<tr><td colspan="3" class="muted">No employees registered yet.</td></tr>';
}

/* ---------- admin: survey builder ---------- */
let draftQs = [];
const newQ = () => ({ text: '', type: 'rating', options: '', required: true });

function renderBuilder() {
  $('builder').innerHTML = draftQs.map((q, i) => `
    <div class="qcard" data-i="${i}">
      <label>Question ${i + 1}<input class="q-text" value="${esc(q.text)}" placeholder="Type your question" /></label>
      <div class="row">
        <select class="q-type" aria-label="Question type">
          <option value="rating" ${q.type === 'rating' ? 'selected' : ''}>Rating (1 to 5)</option>
          <option value="choice" ${q.type === 'choice' ? 'selected' : ''}>Multiple choice</option>
          <option value="text" ${q.type === 'text' ? 'selected' : ''}>Written answer</option>
        </select>
        <label class="check" style="margin:0"><input type="checkbox" class="q-req" ${q.required ? 'checked' : ''} /> Required</label>
        ${draftQs.length > 1 ? '<button type="button" class="small danger q-del">Remove</button>' : ''}
      </div>
      ${q.type === 'choice' ? `<label style="margin-top:.8rem">Options (comma separated)<input class="q-opts" value="${esc(q.options)}" placeholder="Yes, No, Maybe" /></label>` : ''}
    </div>`).join('');
}

$('builder').addEventListener('input', (e) => {
  const i = Number(e.target.closest('.qcard')?.dataset.i);
  if (Number.isNaN(i)) return;
  if (e.target.classList.contains('q-text')) draftQs[i].text = e.target.value;
  if (e.target.classList.contains('q-opts')) draftQs[i].options = e.target.value;
});
$('builder').addEventListener('change', (e) => {
  const i = Number(e.target.closest('.qcard')?.dataset.i);
  if (Number.isNaN(i)) return;
  if (e.target.classList.contains('q-type')) { draftQs[i].type = e.target.value; renderBuilder(); }
  if (e.target.classList.contains('q-req')) draftQs[i].required = e.target.checked;
});
$('builder').addEventListener('click', (e) => {
  if (!e.target.classList.contains('q-del')) return;
  draftQs.splice(Number(e.target.closest('.qcard').dataset.i), 1);
  renderBuilder();
});
$('addQ').addEventListener('click', () => { draftQs.push(newQ()); renderBuilder(); });

$('createForm').addEventListener('submit', guard(async (e) => {
  e.preventDefault();
  await api('/surveys', 'POST', {
    title: $('cTitle').value,
    description: $('cDesc').value,
    isAnonymous: $('cAnon').checked,
    questions: draftQs.map((q) => ({
      text: q.text, type: q.type, required: q.required,
      options: q.type === 'choice' ? q.options.split(',').map((o) => o.trim()).filter(Boolean) : [],
    })),
  });
  toast('Survey saved as draft. Publish it from the Surveys tab.');
  $('createForm').reset();
  draftQs = [newQ()];
  renderBuilder();
  document.querySelector('.tab[data-tab="surveysTab"]').click();
  loadAdmin();
}));

/* ---------- admin: results ---------- */
async function openResults(id) {
  const r = await api(`/surveys/${id}/results`);
  const rate = r.totalEmployees ? Math.round((r.totalResponses / r.totalEmployees) * 100) : 0;
  $('resultsBody').innerHTML = `
    <div class="res-head">
      <h2>${esc(r.survey.title)}</h2>
      <p class="muted">${esc(r.survey.description)}</p>
      <p><span class="chip ${r.survey.status}">${r.survey.status}</span>
         &nbsp;<strong>${r.totalResponses}</strong> of ${r.totalEmployees} employees responded (${rate}%)
         &middot; ${r.survey.isAnonymous ? 'Anonymous' : 'Named'}</p>
    </div>
    ${r.questions.map((q, i) => `
      <div class="rq">
        <h3>${i + 1}. ${esc(q.text)}</h3>
        <p class="muted">${q.answered} answers</p>
        ${q.type === 'rating' ? `<div class="avg">${q.average ?? '–'} <span class="muted">average out of 5</span></div>` : ''}
        ${q.distribution ? q.distribution.map((d) => {
          const pct = q.answered ? Math.round((d.count / q.answered) * 100) : 0;
          return `<div class="bar-row"><span>${esc(d.label)}</span><div class="track"><div class="fill" style="width:${pct}%"></div></div><span>${d.count} (${pct}%)</span></div>`;
        }).join('') : ''}
        ${q.comments ? (q.comments.length ? `<ul class="comments">${q.comments.map((c) => `<li>${esc(c.text)}${c.by ? `<small>${esc(c.by)}</small>` : ''}</li>`).join('')}</ul>` : '<p class="muted">No written answers yet.</p>') : ''}
      </div>`).join('')}`;
  show('results');
}

/* ---------- start ---------- */
draftQs = [newQ()];
renderBuilder();
refreshNav();
show(me ? (me.role === 'admin' ? 'admin' : 'surveys') : 'auth');
