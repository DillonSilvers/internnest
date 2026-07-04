/* global variables */
/* Example cards shown only to logged-out visitors with an empty tracker; they are never
   persisted and disappear on login or on the first real save. */
const DEMO_CARDS = [
  { id: 't1', title: 'Investment Banking Analyst', company: 'Morgan Stanley', stage: 'applied', score: 91 },
  { id: 't2', title: 'Product Manager Intern', company: 'Stripe', stage: 'interviewing', score: 94 },
  { id: 't3', title: 'Strategy Consulting Intern', company: 'Deloitte', stage: 'saved', score: 88 },
  { id: 't4', title: 'Growth Marketing Intern', company: 'BrightLabs', stage: 'rejected', score: 76 },
  { id: 't5', title: 'SWE Intern', company: 'Atlassian', stage: 'applied', score: 82 },
];
let trackerCards = DEMO_CARDS.map(c => ({ ...c }));
let demoTracker = true;

function clearDemoCards() {
  if (!demoTracker) return;
  trackerCards = [];
  demoTracker = false;
}

const STAGES = ['saved', 'applied', 'interviewing', 'offer', 'rejected'];
let cardCounter = 200;
let lastResults = null;

/* Auth state (Supabase) — populated by initAuth() */
let sbClient = null, authUser = null, authPremium = false, authProduct = null;

/* Tracker persists across pages (form page saves; tracker page reads). Demo cards never persist. */
function saveTracker() {
  if (demoTracker) return;
  try { localStorage.setItem('inn_tracker', JSON.stringify(trackerCards)); } catch (e) {}
}
try {
  const _t = localStorage.getItem('inn_tracker');
  if (_t) { trackerCards = JSON.parse(_t); demoTracker = false; }
} catch (e) {}

/* Premium unlock — Stripe-verified token stored per browser (Milestone 4) */
function readUnlock() {
  try {
    const raw = localStorage.getItem('inn_unlock');
    if (!raw) return null;
    const body = JSON.parse(atob(raw.split('.')[0].replace(/-/g, '+').replace(/_/g, '/')));
    if (!body || typeof body.exp !== 'number' || body.exp <= Date.now()) return null;
    return body;
  } catch (e) { return null; }
}
/* Unlocked if the signed-in account has premium, OR a valid per-browser token (guest fallback). */
function isUnlocked() { return authPremium || readUnlock() !== null; }
function hasReport() { return authProduct === 'report' || localStorage.getItem('inn_report') === '1'; }

async function startCheckout(product) {
  // Require an account before any purchase, so Premium is always tied to a login.
  if (!authUser) {
    setPendingCheckout(product);
    openLogin({ subtitle: 'Log in or create a free account to continue to checkout.' });
    return;
  }
  try {
    const res = await fetch('/api/create-checkout', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ product, user_id: authUser.id }),
    });
    const data = await res.json();
    if (data.url) { window.location.href = data.url; return; }
    alert(data.error === 'payments not configured'
      ? 'Payments are not set up yet — check back soon.'
      : 'Could not start checkout. Please try again.');
  } catch (e) { alert('Could not start checkout. Please try again.'); }
}

/* Remember a purchase started while logged out, then resume it after login. Single-use,
   expires after 30 min, and survives the login redirect (incl. a magic link in a new tab). */
function setPendingCheckout(product) {
  try { localStorage.setItem('inn_pending_checkout', JSON.stringify({ product, t: Date.now() })); } catch (e) {}
}
function takePendingCheckout() {
  let raw = null;
  try { raw = localStorage.getItem('inn_pending_checkout'); localStorage.removeItem('inn_pending_checkout'); } catch (e) {}
  if (!raw) return null;
  try { const o = JSON.parse(raw); if (o && o.product && Date.now() - o.t < 30 * 60 * 1000) return o.product; } catch (e) {}
  return null;
}
function resumePendingCheckout() {
  if (!authUser) return false;
  const product = takePendingCheckout();
  if (!product) return false;
  startCheckout(product);
  return true;
}

function printReport() {
  if (!lastResults) return;
  const { matches, user } = lastResults;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const rows = matches.map((m, i) => `
    <div class="r">
      <h3>${i + 1}. ${esc(m.title)} — ${esc(m.company)}</h3>
      <p class="meta">${esc(m.location || '')} · Match score ${esc(m.score)}</p>
      <p>${esc(m.why || '')}</p>
      ${(m.missing && m.missing.length) ? `<p><strong>Build these skills:</strong> ${esc(m.missing.join(', '))}</p>` : ''}
      ${m.tip ? `<p><strong>Tip:</strong> ${esc(m.tip)}</p>` : ''}
      ${m.application_url ? `<p><strong>Apply:</strong> ${esc(m.application_url)}</p>` : ''}
    </div>`).join('');
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>InternNest Match Report</title>
    <style>
      body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1a1a2e;max-width:720px;margin:32px auto;padding:0 24px;line-height:1.5}
      h1{font-size:24px}h3{margin:0 0 4px;font-size:16px}.meta{color:#667;margin:0 0 8px;font-size:13px}
      .r{padding:16px 0;border-bottom:1px solid #eee;page-break-inside:avoid}
      .head{margin-bottom:24px}
    </style></head><body>
    <div class="head"><h1>InternNest — Match Report</h1>
      <p>Prepared for ${esc(user && user.name ? user.name : 'you')} · ${matches.length} matches</p></div>
    ${rows}
    <script>window.onload=function(){window.print();}<\/script>
    </body></html>`;
  const w = window.open('', '_blank');
  if (w) { w.document.write(html); w.document.close(); }
}

/* On a successful return from Stripe (?paid=…&session_id=…), confirm + store the unlock. */
async function handlePaymentReturn() {
  const q = new URLSearchParams(window.location.search);
  const sessionId = q.get('session_id');
  if (!sessionId) return;
  try {
    const res = await fetch('/api/verify-unlock', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId }),
    });
    const data = await res.json();
    if (data.token) {
      localStorage.setItem('inn_unlock', data.token);
      if (data.product === 'report') localStorage.setItem('inn_report', '1');
    }
  } catch (e) { /* leave locked; user can retry */ }
  // Clean the URL so a refresh doesn't re-run verification.
  window.history.replaceState({}, '', window.location.pathname + '#results');
}
document.addEventListener('DOMContentLoaded', handlePaymentReturn);


/* ====================================================
   FORM SUBMISSION → GENERATE MATCHES
   ==================================================== */
/* Hero mini-form: stash the answers and continue on /get-matched */
const heroMiniEl = document.getElementById('heroMiniForm');
if (heroMiniEl) heroMiniEl.addEventListener('submit', (e) => {
  e.preventDefault();
  const prefill = {
    major: document.getElementById('hmMajor').value.trim(),
    year:  document.getElementById('hmYear').value,
    role:  document.getElementById('hmRole').value.trim(),
  };
  try { localStorage.setItem('inn_prefill', JSON.stringify(prefill)); } catch (err) { /* storage off — still navigate */ }
  window.location.href = '/get-matched';
});

/* Arriving from the hero mini-form: pre-fill and clear the stash */
(function applyHeroPrefill() {
  if (!document.getElementById('matchForm')) return;
  let raw = null;
  try { raw = localStorage.getItem('inn_prefill'); localStorage.removeItem('inn_prefill'); } catch (err) { return; }
  if (!raw) return;
  try {
    const p = JSON.parse(raw);
    if (p.major) document.getElementById('major').value = p.major;
    if (p.year)  document.getElementById('year').value  = p.year;
    if (p.role)  document.getElementById('role').value  = p.role;
  } catch (err) { /* malformed stash — ignore */ }
})();

const matchFormEl = document.getElementById('matchForm');
if (matchFormEl) matchFormEl.addEventListener('submit', async function (e) {
  e.preventDefault();

  const val = (id) => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };
  const user = {
    name:       document.getElementById('name').value.trim() || 'Student',
    email:      document.getElementById('email').value.trim(),
    school:     document.getElementById('school').value.trim() || 'your university',
    major:      document.getElementById('major').value.trim(),
    year:       document.getElementById('year').value,
    gpa:        val('gpa'),
    industry:   document.getElementById('industry').value,
    role:       document.getElementById('role').value.trim(),
    location:   document.getElementById('location').value.trim(),
    worktype:   document.getElementById('worktype').value,
    skills:     document.getElementById('skills').value.trim(),
    experience: val('experience'),
    companies:  document.getElementById('companies').value.trim(),
  };

  if (!user.industry) {
    document.getElementById('industry').focus();
    return;
  }

  // Show loading in the existing results section.
  const section = document.getElementById('results');
  section.classList.add('scanning');
  document.getElementById('resultsHeading').textContent = 'Finding your matches…';
  document.getElementById('resultsSubheading').textContent = 'Analyzing your profile against real internships.';
  document.getElementById('matchCards').innerHTML =
    `<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--gray-500);font-weight:600">${resumeFile ? 'Reading your resume and scoring internships… this can take up to a minute.' : 'Scoring internships for you…'}</div>`;
  section.classList.remove('hidden');
  section.scrollIntoView({ behavior: 'smooth', block: 'start' });

  let matches = [];
  try {
    const resumeData = await readResumeBase64();
    const resp = await fetch('/api/match', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      // Send the signed unlock token (if any) so Premium accounts get the higher-quality model.
      body: JSON.stringify({
        profile: user,
        token: localStorage.getItem('inn_unlock') || undefined,
        resume: resumeData ? { media_type: 'application/pdf', data: resumeData } : undefined,
      }),
    });
    const data = await resp.json();
    matches = data.matches || [];
  } catch (err) {
    matches = [];
  }
  if (!matches.length) {
    section.classList.remove('scanning');
    document.getElementById('matchCards').innerHTML =
      '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--gray-500)">We couldn\'t load matches just now — please try again in a moment.</div>';
    return;
  }
  renderResults(matches, user);
});

function renderResults(matches, user) {
  lastResults = { matches, user };
  const section = document.getElementById('results');
  section.classList.remove('scanning');
  document.getElementById('resultsHeading').textContent =
    `${user.name}, here are your top ${user.industry} matches`;
  document.getElementById('resultsSubheading').textContent =
    `We found ${matches.length} personalized internship matches based on your profile. Each includes your fit score, skill gaps, and a ready-to-send outreach message.`;

  const isPremium = isUnlocked();
  const shown = isPremium ? matches : matches.slice(0, 3);
  const reportBtn = hasReport()
    ? `<div style="grid-column:1/-1;text-align:center;padding:8px 0 24px"><a class="btn-outline" href="#" onclick="printReport();return false;">Print / Save as PDF</a></div>`
    : '';
  const locked = isPremium ? [] : matches.slice(shown.length);
  document.getElementById('matchCards').innerHTML = shown.map((job, i) => buildCard(job, user, i)).join('')
    + locked.map((job, i) => buildLockedCard(job, shown.length + i)).join('')
    + (locked.length
      ? `<div style="grid-column:1/-1;text-align:center;padding:24px"><a href="#" class="btn-primary btn-xl" onclick="startCheckout('premium');return false;">Unlock ${locked.length} more ${locked.length === 1 ? 'match' : 'matches'} + AI outreach &middot; $9.99 launch price</a></div>`
      : '')
    + reportBtn;
  section.classList.remove('hidden');
  section.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function buildCard(job, user, index) {
  const scoreColor = job.score >= 90 ? '#16a34a' : job.score >= 80 ? '#2563eb' : '#d97706';
  const scoreBg   = job.score >= 90 ? '#dcfce7' : job.score >= 80 ? '#dbeafe' : '#fef3c7';
  const typeTag   = { Remote: 'tag-blue', Hybrid: 'tag-gray', 'In-Person': 'tag-gray' }[job.type] || 'tag-gray';

  const missingHtml = (job.missing || [])
    .map(s => `<li>${s}</li>`)
    .join('');

  const outreachText = (typeof job.outreach === 'string' && job.outreach) ? job.outreach
    : `Hi,\n\nI'm ${user.name} from ${user.school}. I'm interested in the ${job.title} role at ${job.company}.\n\nBest,\n${user.name}`;

  const titleEsc   = job.title.replace(/'/g, "\\'");
  const companyEsc = job.company.replace(/'/g, "\\'");

  return `
<div class="match-card" id="card-${job.id}">
  <div class="match-card-header">
    <div class="match-card-info">
      <div class="match-rank">${index + 1}</div>
      <div>
        <h3>${job.title}</h3>
        <p class="match-company">${job.company} &middot; ${job.location}</p>
        <div class="match-tags">
          <span class="tag ${typeTag}">${job.type}</span>
        </div>
      </div>
    </div>
    <div class="match-score" style="background:${scoreBg};color:${scoreColor}">
      ${job.score}<small>/ 100</small>
    </div>
  </div>

  <div class="match-section">
    <div class="match-label">Why it matches your profile</div>
    <p>${job.why}</p>
  </div>

  <div class="match-section">
    <div class="match-label">Missing skills to improve your odds</div>
    <ul class="missing-skills">${missingHtml}</ul>
  </div>

  <div class="match-section">
    <div class="match-label">Application tip</div>
    <p>${job.tip}</p>
  </div>

  <div class="match-section outreach-section">
    <div class="match-label">AI-generated LinkedIn outreach message</div>
    <button class="btn-outreach" onclick="toggleOutreach('${job.id}')">Show LinkedIn Message</button>
    <div id="outreach-${job.id}" class="outreach-msg hidden">${outreachText.replace(/\n/g, '<br>')}</div>
  </div>

  <div class="match-actions">
    <button class="btn-save" id="save-${job.id}" onclick="saveToTracker('${job.id}','${titleEsc}','${companyEsc}',${job.score})">
      Save to Tracker
    </button>
    <a class="btn-primary" id="apply-${job.id}" href="${job.application_url || '#'}" target="_blank" rel="noopener" onclick="markApplied('${job.id}','${titleEsc}','${companyEsc}',${job.score})">
      Apply Now →
    </a>
  </div>
</div>`;
}

/* Locked teaser: the student's real remaining matches, blurred, one tap from checkout. */
function buildLockedCard(job, index) {
  return `
<div class="match-card match-locked" onclick="startCheckout('premium')" title="Unlock Premium to reveal">
  <div class="locked-blur" aria-hidden="true">
    <div class="match-card-header">
      <div class="match-card-info">
        <div class="match-rank">${index + 1}</div>
        <div>
          <h3>${job.title}</h3>
          <p class="match-company">${job.company} &middot; ${job.location}</p>
        </div>
      </div>
      <div class="match-score" style="background:#dbeafe;color:#2563eb">${job.score}<small>/ 100</small></div>
    </div>
    <div class="match-section">
      <div class="match-label">Why it matches your profile</div>
      <p>${job.why || ''}</p>
    </div>
  </div>
  <div class="locked-overlay">
    <span class="locked-pill"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>Match #${index + 1} &middot; unlock to reveal</span>
  </div>
</div>`;
}

function toggleOutreach(id) {
  const box = document.getElementById(`outreach-${id}`);
  const btn = box.previousElementSibling;
  const isHidden = box.classList.contains('hidden');
  box.classList.toggle('hidden', !isHidden);
  btn.textContent = isHidden ? 'Hide LinkedIn Message' : 'Show LinkedIn Message';
}

/* ====================================================
   APPLICATION TRACKER
   ==================================================== */
function renderTracker() {
  if (!document.getElementById('col-saved')) return; // tracker board not on this page
  STAGES.forEach(stage => {
    const cards = trackerCards.filter(c => c.stage === stage);
    document.getElementById(`count-${stage}`).textContent = cards.length;
    document.getElementById(`col-${stage}`).innerHTML = cards.map(buildTrackerCard).join('');
  });
}

function buildTrackerCard(card) {
  const scoreColor = card.score >= 90 ? '#16a34a' : card.score >= 80 ? '#2563eb' : card.score > 0 ? '#d97706' : '#9ca3af';
  const idx = STAGES.indexOf(card.stage);
  const prev = idx > 0 ? STAGES[idx - 1] : null;
  const next = idx < STAGES.length - 1 ? STAGES[idx + 1] : null;

  const prevLabel = prev ? `← ${capitalize(prev)}` : '';
  const nextLabel = next ? `${capitalize(next)} →` : '';
  const prevBtn = prev ? `<button class="tracker-btn" onclick="moveCard('${card.id}','${prev}')">${prevLabel}</button>` : '';
  const nextBtn = next ? `<button class="tracker-btn primary" onclick="moveCard('${card.id}','${next}')">${nextLabel}</button>` : '';
  const scoreDisplay = card.score > 0 ? `${card.score}%` : '';
  const linkIcon = card.link ? ` <a href="${escHtml(card.link)}" target="_blank" rel="noopener" class="tracker-link" title="Open listing">&#8599;</a>` : '';
  const notesLine = card.notes ? `<div class="tracker-notes">${escHtml(card.notes)}</div>` : '';

  return `
<div class="tracker-card">
  <div class="tracker-card-top">
    <div>
      <div class="tracker-title">${escHtml(card.title)}${demoTracker ? ' <span class="tracker-demo-tag">example</span>' : ''}</div>
      <div class="tracker-company">${escHtml(card.company)}${linkIcon}</div>
    </div>
    <div class="tracker-score" style="color:${scoreColor}">${scoreDisplay}</div>
  </div>
  ${notesLine}
  <div class="tracker-actions">
    ${prevBtn}${nextBtn}
    <button class="tracker-btn danger" onclick="removeCard('${card.id}')" aria-label="Remove">&times;</button>
  </div>
</div>`;
}

function moveCard(id, stage) {
  const card = trackerCards.find(c => c.id === id);
  if (card) { card.stage = stage; saveTracker(); renderTracker(); }
}

function removeCard(id) {
  trackerCards = trackerCards.filter(c => c.id !== id);
  saveTracker();
  renderTracker();
}

function saveToTracker(jobId, title, company, score) {
  if (trackerCards.find(c => c.id === `m-${jobId}`)) {
    showToast(`${title} is already in your tracker!`);
    return;
  }
  clearDemoCards(); // first real save replaces the examples
  trackerCards.push({ id: `m-${jobId}`, title, company, stage: 'saved', score });
  saveTracker();
  renderTracker();
  markBtnDone(`save-${jobId}`, 'Saved', '#f0fdf4', '#16a34a');
  const trk = document.getElementById('tracker'); if (trk) trk.scrollIntoView({ behavior: 'smooth', block: 'start' });
  showToast(`${title} saved — view it in your tracker.`);
}

function markApplied(jobId, title, company, score) {
  const existing = trackerCards.find(c => c.id === `m-${jobId}`);
  if (existing) {
    existing.stage = 'applied';
  } else {
    clearDemoCards();
    trackerCards.push({ id: `m-${jobId}`, title, company, stage: 'applied', score });
  }
  saveTracker();
  renderTracker();
  markBtnDone(`apply-${jobId}`, 'Marked Applied', '#dbeafe', '#1d4ed8');
  const trk2 = document.getElementById('tracker'); if (trk2) trk2.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function markBtnDone(btnId, text, bg, color) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.textContent = text;
  btn.disabled = true;
  btn.style.background = bg;
  btn.style.color = color;
  btn.style.border = `1.5px solid ${color}`;
}

function escHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (ch) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
  ));
}

function openAddCard() {
  let m = document.getElementById('addCardModal');
  if (!m) {
    m = document.createElement('div');
    m.id = 'addCardModal';
    m.className = 'login-overlay';
    m.innerHTML = `
      <div class="login-card add-card-modal" role="dialog" aria-modal="true">
        <button class="login-close" onclick="closeAddCard();return false;" aria-label="Close">&times;</button>
        <h3>Add an internship</h3>
        <form id="addCardForm">
          <div class="form-group"><label for="acTitle">Role title <span class="req">*</span></label><input type="text" id="acTitle" required placeholder="e.g. Software Engineering Intern" /></div>
          <div class="form-group"><label for="acCompany">Company <span class="req">*</span></label><input type="text" id="acCompany" required placeholder="e.g. Stripe" /></div>
          <div class="form-group"><label for="acLink">Listing link <span class="form-opt">(optional)</span></label><input type="url" id="acLink" placeholder="https://" /></div>
          <div class="form-group"><label for="acStage">Stage</label><select id="acStage"><option value="saved">Saved</option><option value="applied">Applied</option><option value="interviewing">Interviewing</option><option value="offer">Offer</option><option value="rejected">Rejected</option></select></div>
          <div class="form-group"><label for="acNotes">Notes <span class="form-opt">(optional)</span></label><textarea id="acNotes" rows="2" placeholder="Deadline, contact, next step"></textarea></div>
          <button type="submit" class="btn-primary">Add to tracker</button>
        </form>
      </div>`;
    document.body.appendChild(m);
    m.addEventListener('click', (e) => { if (e.target === m) closeAddCard(); });
    document.getElementById('addCardForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const title = document.getElementById('acTitle').value.trim();
      const company = document.getElementById('acCompany').value.trim();
      if (!title || !company) return;
      clearDemoCards();
      trackerCards.push({
        id: `c-${cardCounter++}`, title, company,
        stage: document.getElementById('acStage').value, score: 0,
        link: document.getElementById('acLink').value.trim(),
        notes: document.getElementById('acNotes').value.trim(),
      });
      saveTracker();
      renderTracker();
      document.getElementById('addCardForm').reset();
      closeAddCard();
    });
  }
  m.style.display = 'flex';
  document.getElementById('acTitle').focus();
}

function closeAddCard() {
  const m = document.getElementById('addCardModal');
  if (m) m.style.display = 'none';
}

/* Export the tracker to a spreadsheet file that opens in Excel or Google Sheets. */
function csvCell(v) {
  const s = String(v == null ? '' : v);
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function exportTrackerToExcel() {
  if (!trackerCards.length) { showToast('Your tracker is empty — save some internships first.'); return; }
  const header = ['Company', 'Role', 'Stage', 'Match Score', 'Link', 'Notes'];
  const rows = trackerCards.map(c => [
    c.company, c.title, capitalize(c.stage), c.score > 0 ? c.score + '%' : '', c.link || '', c.notes || '',
  ]);
  const csv = [header, ...rows].map(r => r.map(csvCell).join(',')).join('\r\n');
  // Prepend a UTF-8 BOM (U+FEFF) so Excel opens accented characters correctly.
  const blob = new Blob([String.fromCharCode(0xFEFF) + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'internnest-tracker.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast('Downloaded internnest-tracker.csv — open it in Excel or Google Sheets.');
}

/* ====================================================
   TOAST NOTIFICATION
   ==================================================== */
function showToast(msg) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.style.cssText = `
      position:fixed; bottom:24px; left:50%; transform:translateX(-50%) translateY(20px);
      background:#111827; color:#fff; font-weight:700; font-size:14px;
      padding:12px 22px; border-radius:12px; z-index:9999;
      opacity:0; transition: opacity .3s, transform .3s; pointer-events:none;
      white-space:nowrap;
    `;
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.opacity = '1';
  el.style.transform = 'translateX(-50%) translateY(0)';
  clearTimeout(el._t);
  el._t = setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateX(-50%) translateY(20px)';
  }, 3000);
}

/* ====================================================
   NAV / MOBILE MENU
   ==================================================== */
const hamburgerEl = document.getElementById('hamburger');
if (hamburgerEl) hamburgerEl.addEventListener('click', () => {
  document.getElementById('mobileMenu').classList.toggle('hidden');
});

/* ====================================================
   CONTACT FORM (contact page only)
   ==================================================== */
const contactForm = document.getElementById('contactForm');
if (contactForm) contactForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('contactSubmit');
  const status = document.getElementById('contactStatus');
  const payload = {
    name: document.getElementById('cname').value.trim(),
    email: document.getElementById('cemail').value.trim(),
    message: document.getElementById('cmsg').value.trim(),
  };
  if (!payload.name || !payload.email || !payload.message) {
    status.style.color = 'var(--red)'; status.textContent = 'Please fill in all fields.'; return;
  }
  btn.disabled = true; btn.textContent = 'Sending…';
  try {
    const r = await fetch('/api/contact', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload),
    });
    if (!r.ok) throw new Error('bad status');
    contactForm.reset();
    status.style.color = 'var(--green)';
    status.textContent = "Thanks — your message was sent. We'll get back to you soon.";
    btn.textContent = 'Sent';
  } catch (err) {
    status.style.color = 'var(--red)';
    status.textContent = 'Something went wrong. Please email hello@internnest.ai instead.';
    btn.disabled = false; btn.textContent = 'Send message';
  }
});

function closeMobileMenu() {
  document.getElementById('mobileMenu').classList.add('hidden');
}

/* ====================================================
   FILE UPLOAD — the resume really is read by the AI (PDF, <= 3 MB)
   ==================================================== */
let resumeFile = null;

/* With a resume attached, the resume carries the profile: every field except
   Dream Industry (which drives the shortlist) becomes optional. */
function setResumeMode(on) {
  const form = document.getElementById('matchForm');
  if (!form) return;
  form.classList.toggle('resume-mode', on);
  ['name', 'email', 'school', 'major', 'year', 'role', 'location', 'skills'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.required = !on;
  });
}

function handleFileUpload(input) {
  if (!input.files || !input.files[0]) return;
  const f = input.files[0];
  const label = document.getElementById('uploadLabel');
  const zone = document.getElementById('uploadZone');
  if (f.type !== 'application/pdf') {
    resumeFile = null;
    setResumeMode(false);
    label.textContent = 'PDF only, please. Matching will run without a resume.';
    zone.style.borderColor = '#d97706'; zone.style.background = '#fffbeb';
    return;
  }
  if (f.size > 3 * 1024 * 1024) {
    resumeFile = null;
    setResumeMode(false);
    label.textContent = 'That PDF is over 3 MB. Try exporting a smaller one.';
    zone.style.borderColor = '#d97706'; zone.style.background = '#fffbeb';
    return;
  }
  resumeFile = f;
  setResumeMode(true);
  label.textContent = `${f.name} attached. The AI will read it, so only Dream Industry is still required.`;
  zone.style.borderColor = '#16a34a';
  zone.style.background = '#f0fdf4';
  showToast('Resume attached. The other fields are now optional.');
}

function readResumeBase64() {
  return new Promise((resolve) => {
    if (!resumeFile) return resolve(null);
    const r = new FileReader();
    r.onload = () => { const s = String(r.result); resolve(s.slice(s.indexOf(',') + 1)); };
    r.onerror = () => resolve(null);
    r.readAsDataURL(resumeFile);
  });
}

/* ====================================================
   UTIL
   ==================================================== */
function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

/* ====================================================
   INIT
   ==================================================== */
renderTracker();

/* ====================================================
   AUTH / ACCOUNTS (Supabase) — Google + email magic link
   Premium is account-based: profiles.premium drives isUnlocked()
   ==================================================== */
const SUPABASE_URL = 'https://wupynvbrmbpzibwkobui.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_G3jRiHKjPP3GJWz2Wgf8gg_RbjbnskK';

function loadSupabase() {
  return new Promise((resolve, reject) => {
    if (window.supabase && window.supabase.createClient) return resolve();
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js';
    s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });
}

async function refreshPremium() {
  authPremium = false; authProduct = null;
  if (!sbClient || !authUser) return;
  try {
    const { data } = await sbClient.from('profiles').select('premium, premium_product').eq('id', authUser.id).single();
    if (data) { authPremium = !!data.premium; authProduct = data.premium_product || null; }
  } catch (e) { /* ignore */ }
  await syncPremiumToken();
}

/* If the account is Premium but this browser has no unlock token (e.g. a new device), mint one
   from the Supabase session so /api/match can verify Premium and serve the upgraded model anywhere. */
async function syncPremiumToken() {
  if (!authPremium || readUnlock()) return;
  try {
    const { data: { session } } = await sbClient.auth.getSession();
    const accessToken = session && session.access_token;
    if (!accessToken) return;
    const res = await fetch('/api/account-token', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ access_token: accessToken }),
    });
    const data = await res.json();
    if (data && data.token) {
      localStorage.setItem('inn_unlock', data.token);
      localStorage.setItem('inn_unlock_src', 'account'); // so sign-out can clear it
      if (data.product === 'report') localStorage.setItem('inn_report', '1');
    }
  } catch (e) { /* Premium still works client-side; this only upgrades the model */ }
}

function renderAuthNav() {
  const right = document.querySelector('.nav-right');
  if (!right) return;
  let el = document.getElementById('authNav');
  if (!el) {
    el = document.createElement('div');
    el.id = 'authNav';
    right.insertBefore(el, right.firstChild);
  }
  if (authUser) {
    const email = (authUser.email || 'Account');
    el.innerHTML = `<span class="auth-email" title="${email}">${email}</span><a href="#" class="auth-link" onclick="signOut();return false;">Log out</a>`;
  } else {
    el.innerHTML = `<a href="#" class="auth-link" onclick="openLogin();return false;">Log in</a>`;
  }
  // Mirror the account action into the hamburger menu (the bar hides it on phones).
  const mm = document.getElementById('mobileMenu');
  if (mm) {
    let m = document.getElementById('authNavMobile');
    if (!m) {
      m = document.createElement('a');
      m.id = 'authNavMobile';
      m.href = '#';
      const cta = mm.querySelector('.btn-primary');
      mm.insertBefore(m, cta || null);
    }
    if (authUser) {
      m.textContent = 'Log out';
      m.onclick = (e) => { e.preventDefault(); closeMobileMenu(); signOut(); };
    } else {
      m.textContent = 'Log in';
      m.onclick = (e) => { e.preventDefault(); closeMobileMenu(); openLogin(); };
    }
  }
  // Signed-in users never see "Start Free" — the CTA reads Get Matched instead.
  const ctaText = authUser ? 'Get Matched →' : 'Start Free →';
  document.querySelectorAll('.nav-cta').forEach((a) => { a.textContent = ctaText; });
  if (mm) { const mmCta = mm.querySelector('.btn-primary'); if (mmCta) mmCta.textContent = ctaText; }
}

async function initAuth() {
  try {
    await loadSupabase();
    sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: { session } } = await sbClient.auth.getSession();
    authUser = session ? session.user : null;
    await refreshPremium();
    renderAuthNav();
    if (authUser && demoTracker) { clearDemoCards(); renderTracker(); } // signed-in users never see example cards
    if (lastResults) renderResults(lastResults.matches, lastResults.user); // re-gate if matches already on screen
    sbClient.auth.onAuthStateChange(async (_event, sess) => {
      authUser = sess ? sess.user : null;
      await refreshPremium();
      renderAuthNav();
      if (authUser && resumePendingCheckout()) return; // returning from login to finish a purchase
      closeLogin();
      if (authUser && demoTracker) { clearDemoCards(); renderTracker(); }
      if (lastResults) renderResults(lastResults.matches, lastResults.user);
    });
    if (authUser) resumePendingCheckout(); // restored session (e.g. magic link opened in a new tab)
  } catch (e) { /* auth is optional; the rest of the site works without it */ }
}
document.addEventListener('DOMContentLoaded', initAuth);

/* ---- login modal ---- */
function openLogin(opts) {
  const subtitle = (opts && opts.subtitle) || 'Save your matches and keep Premium across devices.';
  let m = document.getElementById('loginModal');
  if (!m) {
    m = document.createElement('div');
    m.id = 'loginModal';
    m.className = 'login-overlay';
    m.innerHTML = `
      <div class="login-card" role="dialog" aria-modal="true">
        <button class="login-close" onclick="closeLogin();return false;" aria-label="Close">&times;</button>
        <h3>Log in or sign up</h3>
        <p class="login-sub" id="loginSub">Save your matches and keep Premium across devices.</p>
        <button class="login-google" onclick="signInGoogle();return false;">
          <span class="g">G</span> Continue with Google
        </button>
        <div class="login-or"><span>or</span></div>
        <form id="loginForm" onsubmit="return sendMagicLink(event)">
          <input type="email" id="loginEmail" placeholder="you@university.edu" required />
          <button type="submit" class="btn-primary btn-xl" id="loginSubmit">Email me a login link</button>
        </form>
        <p class="login-status" id="loginStatus"></p>
      </div>`;
    document.body.appendChild(m);
    m.addEventListener('click', (e) => { if (e.target === m) closeLogin(); });
  }
  const sub = document.getElementById('loginSub');
  if (sub) sub.textContent = subtitle;
  m.style.display = 'flex';
}
function closeLogin() {
  try { localStorage.removeItem('inn_pending_checkout'); } catch (e) {} // dismissing = abandoning the purchase
  const m = document.getElementById('loginModal'); if (m) m.style.display = 'none';
}

async function sendMagicLink(e) {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value.trim();
  const status = document.getElementById('loginStatus');
  if (!email || !sbClient) return false;
  status.style.color = 'var(--gray-500)'; status.textContent = 'Sending…';
  try {
    const { error } = await sbClient.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } });
    status.style.color = error ? 'var(--red)' : 'var(--green)';
    status.textContent = error ? error.message : 'Check your email for a login link.';
  } catch (err) { status.style.color = 'var(--red)'; status.textContent = 'Something went wrong. Please try again.'; }
  return false;
}

async function signInGoogle() {
  if (!sbClient) return;
  try {
    const { error } = await sbClient.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } });
    if (error) { const s = document.getElementById('loginStatus'); if (s) { s.style.color = 'var(--red)'; s.textContent = "Google sign-in isn't enabled yet — use email for now."; } }
  } catch (e) { /* ignore */ }
}

async function signOut() {
  try { if (sbClient) await sbClient.auth.signOut(); } catch (e) {}
  authUser = null; authPremium = false; authProduct = null;
  // Drop an account-minted unlock token so Premium doesn't linger on a shared browser after logout.
  if (localStorage.getItem('inn_unlock_src') === 'account') {
    localStorage.removeItem('inn_unlock');
    localStorage.removeItem('inn_unlock_src');
  }
  renderAuthNav();
  location.reload();
}
