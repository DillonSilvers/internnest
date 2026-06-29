/* global variables */
let trackerCards = [
  { id: 't1', title: 'Investment Banking Analyst', company: 'Morgan Stanley', stage: 'applied', score: 91 },
  { id: 't2', title: 'Product Manager Intern', company: 'Stripe', stage: 'interviewing', score: 94 },
  { id: 't3', title: 'Strategy Consulting Intern', company: 'Deloitte', stage: 'saved', score: 88 },
  { id: 't4', title: 'Growth Marketing Intern', company: 'BrightLabs', stage: 'rejected', score: 76 },
  { id: 't5', title: 'SWE Intern', company: 'Atlassian', stage: 'applied', score: 82 },
];

const STAGES = ['saved', 'applied', 'interviewing', 'offer', 'rejected'];
let cardCounter = 200;
let lastResults = null;

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
function isUnlocked() { return readUnlock() !== null; }
function hasReport() { return localStorage.getItem('inn_report') === '1'; }

async function startCheckout(product) {
  try {
    const res = await fetch('/.netlify/functions/create-checkout', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ product }),
    });
    const data = await res.json();
    if (data.url) { window.location.href = data.url; return; }
    alert(data.error === 'payments not configured'
      ? 'Payments are not set up yet — check back soon.'
      : 'Could not start checkout. Please try again.');
  } catch (e) { alert('Could not start checkout. Please try again.'); }
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
    const res = await fetch('/.netlify/functions/verify-unlock', {
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
   INTERNSHIP DATA
   ==================================================== */
const DATA = {
  Finance: [
    {
      id: 'fin1',
      title: 'Investment Banking Summer Analyst',
      company: 'Atlas Capital Partners',
      location: 'New York, NY',
      type: 'In-Person',
      score: 94,
      why: 'Strong fit for students interested in M&A, valuation, financial modeling, and client-facing advisory work. Your finance background aligns directly with the analytical rigor this role demands.',
      missing: ['Advanced Excel & DCF modeling', 'Bloomberg Terminal fundamentals', 'Financial statement analysis (3-statement model)'],
      tip: 'Add a personal stock pitch or mini-DCF model to your portfolio. In your cover letter, name a specific deal the bank recently worked on and why it interests you.',
      outreach: (n, s) => `Hi [Recruiter Name],\n\nI'm ${n}, a ${s} student studying Finance. I came across Atlas Capital's Summer Analyst program and was genuinely excited — I've been following M&A activity in the [TMT / Healthcare] sector and would love to contribute to your deal teams this summer.\n\nI'm attaching my resume and would love a quick 10-minute call to learn more about the program.\n\nBest,\n${n}`,
    },
    {
      id: 'fin2',
      title: 'Private Equity Research Intern',
      company: 'NorthBridge Search Fund',
      location: 'Remote / Boston, MA',
      type: 'Hybrid',
      score: 88,
      why: 'Great match for students who want hands-on investing exposure early. Search funds value intellectual curiosity and research skills over pedigree — making it ideal for driven underclassmen.',
      missing: ['Deal sourcing methodology', 'CRM tools (HubSpot or Salesforce)', 'Business valuation basics (EV/EBITDA multiples)'],
      tip: 'Write a brief, personalized email that tells a story about why you want to be in investing. Attach one short research sample — even a one-page industry overview demonstrates initiative.',
      outreach: (n, s) => `Hi [Founder's Name],\n\nI'm ${n} from ${s}. I've been studying the search fund model and NorthBridge's thesis really resonates with me — I love the idea of identifying and acquiring a great business rather than chasing public markets.\n\nI'd love to support your research and sourcing work this summer. I'm detail-oriented, self-motivated, and genuinely excited about this path.\n\nAny chance for a quick call?\n\n${n}`,
    },
    {
      id: 'fin3',
      title: 'Wealth Management Summer Analyst',
      company: 'Harborview Advisors',
      location: 'Boston, MA',
      type: 'In-Person',
      score: 82,
      why: 'Good fit for students who enjoy markets, client relationships, and long-term portfolio strategy. This role values communication skills and financial knowledge in equal measure.',
      missing: ['Series 65 exam awareness', 'Portfolio construction basics', 'Financial planning software (eMoney, MoneyGuidePro)'],
      tip: 'Highlight any investing clubs, stock simulations, or client-facing experience. Mention that you follow market news and have a genuine interest in helping people reach their financial goals.',
      outreach: (n, s) => `Hello,\n\nMy name is ${n} and I'm studying Finance at ${s}. I'm interested in Harborview's Wealth Management internship — I believe wealth management is one of the most meaningful intersections of finance and people.\n\nI'd love to learn about the internship and how I can contribute to your team.\n\nThank you,\n${n}`,
    },
  ],
  Technology: [
    {
      id: 'tech1',
      title: 'Product Manager Intern',
      company: 'CampusFlow',
      location: 'Remote',
      type: 'Remote',
      score: 92,
      why: 'Strong match for students interested in startups, product design, and user research. CampusFlow values cross-functional thinking and user empathy over deep technical skill.',
      missing: ['User story and PRD writing', 'Figma / wireframing basics', 'Product analytics (Mixpanel, Amplitude, Looker)'],
      tip: 'Create a 1-page product teardown of an app you use every day. Walk them through a problem you spotted and how you\'d fix it. Send it with your application — it\'s the best PM signal you can give.',
      outreach: (n, s) => `Hi [PM's Name],\n\nI'm ${n}, a student at ${s}. I use CampusFlow regularly and actually put together a short product teardown of [specific feature] — I\'d love to share it with you.\n\nI'm interested in the PM internship and believe I can add real value on the user research and feature prioritization side.\n\nHappy to send the teardown over — interested in chatting?\n\n${n}`,
    },
    {
      id: 'tech2',
      title: 'Software Engineering Intern',
      company: 'NovaStack',
      location: 'New York, NY',
      type: 'Hybrid',
      score: 85,
      why: 'Great startup SWE role for students with coding projects. NovaStack is pre-Series A, meaning you\'ll work directly with the founding team and ship real features.',
      missing: ['React or a modern JS framework', 'REST API design patterns', 'Git / GitHub version control workflows'],
      tip: 'Link your top GitHub project in the application and polish the README so a recruiter understands it in 30 seconds. A working demo video is worth more than a perfect resume.',
      outreach: (n, s) => `Hey [Name],\n\nI'm ${n} from ${s}. I came across NovaStack on LinkedIn — the problem you're solving is real, and I\'d love to contribute as a SWE intern this summer.\n\nHere's my GitHub: [link]. My strongest project is [X], which [brief description].\n\nWould love to learn more. Can we connect?\n\n${n}`,
    },
    {
      id: 'tech3',
      title: 'Data Science Intern',
      company: 'Luminary Analytics',
      location: 'Remote',
      type: 'Remote',
      score: 78,
      why: 'Moderate match — you show strong analytical instincts, but this role requires deeper Python and ML experience than your current profile shows. Worth targeting once you add one project.',
      missing: ['Python (Pandas, NumPy, scikit-learn)', 'Machine learning fundamentals', 'SQL for data querying and aggregation'],
      tip: 'Complete one Kaggle competition or dataset project and add it to your resume. Even a simple regression model with a clean write-up demonstrates real initiative.',
      outreach: (n, s) => `Hi,\n\nI'm ${n}, a student at ${s} interested in data science and analytics. I saw your Data Science Intern posting and wanted to reach out directly.\n\nI've been building Python and analytics skills through [coursework/project], and I\'m eager to apply them in a real business context.\n\nWould love to connect — are you open to a quick call?\n\n${n}`,
    },
  ],
  Marketing: [
    {
      id: 'mkt1',
      title: 'Growth Marketing Intern',
      company: 'BrightLabs',
      location: 'New York, NY',
      type: 'Hybrid',
      score: 90,
      why: 'Excellent fit for students who understand social media, brand voice, and performance metrics. BrightLabs runs lean, so you\'ll own real campaigns from day one.',
      missing: ['Google Analytics 4 (GA4) certification', 'Paid social ads (Meta Ads, TikTok Ads Manager)', 'Email marketing tools (Klaviyo or Mailchimp)'],
      tip: 'Quantify your impact: follower counts, engagement rates, or campaign results you\'ve driven. Numbers impress growth marketers far more than descriptions of what you "helped with."',
      outreach: (n, s) => `Hi [Name],\n\nI'm ${n} from ${s}. I've been following BrightLabs on Instagram and love the brand direction — it feels authentic and data-driven at the same time.\n\nI'm applying for the Growth Marketing internship and wanted to reach out directly. I've grown [account/project] by [X%] and would love to bring that energy to your team.\n\nWould love to connect!\n\n${n}`,
    },
    {
      id: 'mkt2',
      title: 'Brand & Content Intern',
      company: 'Spark Creative Agency',
      location: 'Remote',
      type: 'Remote',
      score: 84,
      why: 'Solid match for students with creative writing, visual storytelling, or content strategy chops. The remote setup gives you flexibility while working across real client brands.',
      missing: ['Adobe Creative Suite basics (Canva works too)', 'Content calendar planning', 'SEO copywriting principles'],
      tip: 'Put together a mini portfolio — a shared Google Drive or Notion page with 3–5 content samples goes a long way. Show range: a social post, a long-form piece, and a visual.',
      outreach: (n, s) => `Hello,\n\nI'm ${n}, a student at ${s} with a passion for storytelling and brand content. I'd love to join Spark as a Brand & Content Intern.\n\nI've attached a few writing samples and would be thrilled to discuss how I can contribute to your clients' brand voices.\n\nThank you!\n\n${n}`,
    },
  ],
  Consulting: [
    {
      id: 'con1',
      title: 'Strategy & Operations Intern',
      company: 'Beacon Strategy Group',
      location: 'Remote / New York, NY',
      type: 'Hybrid',
      score: 88,
      why: 'Strong fit for students who enjoy structured problem-solving, hypothesis-driven frameworks, and polished client deliverables. Beacon works across healthcare, retail, and tech clients.',
      missing: ['MECE structured problem-solving', 'McKinsey-style slide building in PowerPoint', 'Basic financial modeling (scenario analysis)'],
      tip: 'Mention case competitions, business clubs, or analytical projects prominently. Use consulting language when describing your experience: problem → hypothesis → data → recommendation.',
      outreach: (n, s) => `Hi [Consultant's Name],\n\nI'm ${n} from ${s}, and I came across Beacon Strategy Group through [LinkedIn / mutual connection]. I'm very interested in your summer strategy internship.\n\nI recently competed in [case competition] / worked on [analytical project] and believe I could contribute meaningfully to your project teams.\n\nWould you be open to a brief conversation?\n\nBest,\n${n}`,
    },
    {
      id: 'con2',
      title: 'Business Analyst Intern',
      company: 'Vertex Consulting',
      location: 'Chicago, IL',
      type: 'In-Person',
      score: 81,
      why: 'Good fit for students who want cross-industry exposure and the chance to develop structured analytical skills early in their career.',
      missing: ['Excel advanced functions (pivot tables, INDEX-MATCH)', 'Process mapping and documentation', 'Data visualization (Tableau or Power BI basics)'],
      tip: 'Highlight research, analysis, or presentation work from class or clubs. Demonstrate that you can synthesize messy information into a clear recommendation.',
      outreach: (n, s) => `Hello,\n\nI'm ${n} from ${s}. I'm interested in Vertex's Business Analyst internship and believe my analytical background and eagerness to learn make me a strong candidate.\n\nI'd love to learn more about the types of projects interns work on and whether there are summer openings.\n\nThank you,\n${n}`,
    },
  ],
  Healthcare: [
    {
      id: 'hlth1',
      title: 'Healthcare Business Development Intern',
      company: 'MedNova Partners',
      location: 'Boston, MA',
      type: 'Hybrid',
      score: 88,
      why: 'Strong fit for students who want to combine business skills with healthcare sector impact. MedNova works with hospital systems, health-tech startups, and digital therapeutics companies.',
      missing: ['Healthcare industry landscape (payers, providers, pharma, medtech)', 'Basic financial analysis (revenue models)', 'CRM and pipeline management tools'],
      tip: 'Connect your business background to healthcare outcomes in your application. Tell them WHY healthcare matters to you — that personal story will differentiate you from generic business candidates.',
      outreach: (n, s) => `Hi [Name],\n\nI'm ${n}, studying at ${s} with a focus on business and healthcare. I came across MedNova Partners and was really impressed by the portfolio companies you work with.\n\nI'm applying for the Business Development internship and believe I can contribute on the research and market analysis side. Happy to share my resume.\n\nLooking forward to connecting,\n${n}`,
    },
    {
      id: 'hlth2',
      title: 'Health-Tech Operations Intern',
      company: 'Lumos Health',
      location: 'Remote',
      type: 'Remote',
      score: 82,
      why: 'Good match for organized, process-minded students interested in digital health. Lumos Health is a Series B startup scaling a patient engagement platform.',
      missing: ['Project management basics (Asana, Notion, or Jira)', 'Healthcare compliance awareness (HIPAA basics)', 'Data analysis in Excel or Google Sheets'],
      tip: 'Emphasize any experience with operational processes, project coordination, or working in fast-paced environments. Startup readiness is a key signal.',
      outreach: (n, s) => `Hello,\n\nI'm ${n} from ${s}, interested in the intersection of operations and digital health. I came across Lumos Health and love what you're building for patient engagement.\n\nI'd love to support your operations team as an intern this summer.\n\n${n}`,
    },
  ],
  'Sports Business': [
    {
      id: 'sprt1',
      title: 'Sports Partnerships & Management Intern',
      company: 'Premier Sports Group',
      location: 'New York, NY',
      type: 'In-Person',
      score: 93,
      why: 'Excellent fit for students passionate about the business side of sports. This role covers athlete partnerships, brand sponsorships, and live event activations — high-impact work from day one.',
      missing: ['Sponsorship proposal and deck creation', 'Event logistics and operations basics', 'Sports media landscape knowledge (RSNs, streaming, betting)'],
      tip: 'Lead with your sports passion, but ground it in business. Mention specific deals, brands, or partnerships you admire and explain the business rationale behind them.',
      outreach: (n, s) => `Hi [Name],\n\nI'm ${n} from ${s}, and sports business is exactly where I want to build my career. I came across Premier Sports Group's internship and knew I had to reach out directly.\n\nI have [experience with athletics/sports media/business clubs] and would love to contribute to your partnerships and events work this summer.\n\nCould we connect for 10 minutes?\n\n${n}`,
    },
    {
      id: 'sprt2',
      title: 'Sports Media & Content Intern',
      company: 'AthleteEdge Media',
      location: 'Remote',
      type: 'Remote',
      score: 86,
      why: 'Great match for students who love sports storytelling, social content creation, and building athlete brands online.',
      missing: ['Short-form video editing (CapCut, Premiere Rush)', 'Sports analytics basics (win shares, PER, WAR)', 'Athlete social media strategy and brand building'],
      tip: 'Build a small portfolio of sports content — tweet threads, short-form videos, or player breakdowns. Show your deep knowledge of the game alongside your creative skills.',
      outreach: (n, s) => `Hey [Name],\n\nI'm ${n}, a student at ${s} and a massive sports fan with a content creation background. I came across AthleteEdge Media's internship and immediately knew I had to apply.\n\nHere's a piece I created: [link]. I'd love to bring that same energy to your platform.\n\nInterested in connecting?\n\n${n}`,
    },
  ],
  'Media & Entertainment': [
    {
      id: 'med1',
      title: 'Entertainment Business Intern',
      company: 'Vantage Entertainment Group',
      location: 'Los Angeles, CA',
      type: 'Hybrid',
      score: 86,
      why: 'Good match for students who want to understand the business side of TV, film, music, or digital content. Vantage represents a range of talent and IP across streaming and live.',
      missing: ['Entertainment industry structure (studios, streamers, agencies, management)', 'Basic deal memo and contract awareness', 'Talent management and representation fundamentals'],
      tip: 'This industry runs heavily on relationships. Reach out to every person in your network with entertainment ties. A warm intro is worth more than a cold application.',
      outreach: (n, s) => `Hi [Name],\n\nI'm ${n} from ${s}. I'm passionate about the business side of entertainment and was excited to come across Vantage's internship program.\n\nI'd love to learn more about the role and what projects interns typically contribute to.\n\nBest,\n${n}`,
    },
  ],
  'Real Estate': [
    {
      id: 're1',
      title: 'Real Estate Private Equity Intern',
      company: 'Meridian Capital Partners',
      location: 'New York, NY',
      type: 'In-Person',
      score: 84,
      why: 'Strong match for students interested in real estate transactions, property valuation, and capital markets. Meridian focuses on commercial acquisitions in the industrial and multifamily sectors.',
      missing: ['Real estate financial modeling (Argus or Excel-based)', 'Cap rate, NOI, and IRR concepts', 'Commercial real estate market analysis'],
      tip: 'Study core CRE valuation concepts before your interview. Mention any exposure to real estate — even a personal investment interest or a real estate course signals genuine enthusiasm.',
      outreach: (n, s) => `Hello,\n\nI'm ${n} from ${s}. I'm interested in commercial real estate and came across Meridian Capital's internship opportunity.\n\nI've been studying CRE underwriting and would love to contribute to your deal analysis and acquisitions work this summer.\n\nWould you be open to a quick call?\n\n${n}`,
    },
  ],
};

/* ====================================================
   FORM SUBMISSION → GENERATE MATCHES
   ==================================================== */
document.getElementById('matchForm').addEventListener('submit', async function (e) {
  e.preventDefault();

  const user = {
    name:      document.getElementById('name').value.trim() || 'Student',
    email:     document.getElementById('email').value.trim(),
    school:    document.getElementById('school').value.trim() || 'your university',
    major:     document.getElementById('major').value.trim(),
    year:      document.getElementById('year').value,
    industry:  document.getElementById('industry').value,
    role:      document.getElementById('role').value.trim(),
    location:  document.getElementById('location').value.trim(),
    worktype:  document.getElementById('worktype').value,
    skills:    document.getElementById('skills').value.trim(),
    companies: document.getElementById('companies').value.trim(),
  };

  if (!user.industry) {
    document.getElementById('industry').focus();
    return;
  }

  // Show loading in the existing results section.
  const section = document.getElementById('results');
  document.getElementById('resultsHeading').textContent = 'Finding your matches…';
  document.getElementById('resultsSubheading').textContent = 'Analyzing your profile against real internships.';
  document.getElementById('matchCards').innerHTML =
    '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--gray-500);font-weight:600">🤖 Scoring internships for you…</div>';
  section.classList.remove('hidden');
  section.scrollIntoView({ behavior: 'smooth', block: 'start' });

  let matches = [];
  try {
    const resp = await fetch('/.netlify/functions/match', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ profile: user }),
    });
    const data = await resp.json();
    matches = data.matches || [];
  } catch (err) {
    matches = [];
  }
  if (!matches.length) {
    document.getElementById('matchCards').innerHTML =
      '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--gray-500)">We couldn\'t load matches just now — please try again in a moment.</div>';
    return;
  }
  renderResults(matches, user);
});

function renderResults(matches, user) {
  lastResults = { matches, user };
  const section = document.getElementById('results');
  document.getElementById('resultsHeading').textContent =
    `${user.name}, here are your top ${user.industry} matches`;
  document.getElementById('resultsSubheading').textContent =
    `We found ${matches.length} personalized internship matches based on your profile. Each includes your fit score, skill gaps, and a ready-to-send outreach message.`;

  const isPremium = isUnlocked();
  const shown = isPremium ? matches : matches.slice(0, 3);
  const reportBtn = hasReport()
    ? `<div style="grid-column:1/-1;text-align:center;padding:8px 0 24px"><a class="btn-outline" href="#" onclick="printReport();return false;">🖨️ Print / Save as PDF</a></div>`
    : '';
  document.getElementById('matchCards').innerHTML = shown.map((job, i) => buildCard(job, user, i)).join('')
    + (!isPremium && matches.length > shown.length
      ? `<div style="grid-column:1/-1;text-align:center;padding:24px"><a href="#pricing" class="btn-primary">Unlock all ${matches.length} matches + AI outreach →</a></div>`
      : '')
    + reportBtn;
  section.classList.remove('hidden');
  section.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function buildCard(job, user, index) {
  const scoreColor = job.score >= 90 ? '#16a34a' : job.score >= 80 ? '#2563eb' : '#d97706';
  const scoreBg   = job.score >= 90 ? '#dcfce7' : job.score >= 80 ? '#dbeafe' : '#fef3c7';
  const typeTag   = { Remote: 'tag-blue', Hybrid: 'tag-gray', 'In-Person': 'tag-gray' }[job.type] || 'tag-gray';
  const typeIcon  = { Remote: '🌐', Hybrid: '🏢', 'In-Person': '🏙️' }[job.type] || '📍';

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
          <span class="tag ${typeTag}">${typeIcon} ${job.type}</span>
        </div>
      </div>
    </div>
    <div class="match-score" style="background:${scoreBg};color:${scoreColor}">
      ${job.score}<small>/ 100</small>
    </div>
  </div>

  <div class="match-section">
    <div class="match-label">✓ Why it matches your profile</div>
    <p>${job.why}</p>
  </div>

  <div class="match-section">
    <div class="match-label">📚 Missing skills to improve your odds</div>
    <ul class="missing-skills">${missingHtml}</ul>
  </div>

  <div class="match-section">
    <div class="match-label">💡 Application tip</div>
    <p>${job.tip}</p>
  </div>

  <div class="match-section outreach-section">
    <div class="match-label">💬 AI-generated LinkedIn outreach message</div>
    <button class="btn-outreach" onclick="toggleOutreach('${job.id}')">Show LinkedIn Message</button>
    <div id="outreach-${job.id}" class="outreach-msg hidden">${outreachText.replace(/\n/g, '<br>')}</div>
  </div>

  <div class="match-actions">
    <button class="btn-save" id="save-${job.id}" onclick="saveToTracker('${job.id}','${titleEsc}','${companyEsc}',${job.score})">
      🔖 Save to Tracker
    </button>
    <a class="btn-primary" id="apply-${job.id}" href="${job.application_url || '#'}" target="_blank" rel="noopener" onclick="markApplied('${job.id}','${titleEsc}','${companyEsc}',${job.score})">
      Apply Now →
    </a>
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

  return `
<div class="tracker-card">
  <div class="tracker-card-top">
    <div>
      <div class="tracker-title">${card.title}</div>
      <div class="tracker-company">${card.company}</div>
    </div>
    <div class="tracker-score" style="color:${scoreColor}">${scoreDisplay}</div>
  </div>
  <div class="tracker-actions">
    ${prevBtn}${nextBtn}
    <button class="tracker-btn danger" onclick="removeCard('${card.id}')">✕</button>
  </div>
</div>`;
}

function moveCard(id, stage) {
  const card = trackerCards.find(c => c.id === id);
  if (card) { card.stage = stage; renderTracker(); }
}

function removeCard(id) {
  trackerCards = trackerCards.filter(c => c.id !== id);
  renderTracker();
}

function saveToTracker(jobId, title, company, score) {
  if (trackerCards.find(c => c.id === `m-${jobId}`)) {
    showToast(`${title} is already in your tracker!`);
    return;
  }
  trackerCards.push({ id: `m-${jobId}`, title, company, stage: 'saved', score });
  renderTracker();
  markBtnDone(`save-${jobId}`, '✓ Saved!', '#f0fdf4', '#16a34a');
  document.getElementById('tracker').scrollIntoView({ behavior: 'smooth', block: 'start' });
  showToast(`${title} saved to tracker.`);
}

function markApplied(jobId, title, company, score) {
  const existing = trackerCards.find(c => c.id === `m-${jobId}`);
  if (existing) {
    existing.stage = 'applied';
  } else {
    trackerCards.push({ id: `m-${jobId}`, title, company, stage: 'applied', score });
  }
  renderTracker();
  markBtnDone(`apply-${jobId}`, '✓ Marked Applied', '#dbeafe', '#1d4ed8');
  document.getElementById('tracker').scrollIntoView({ behavior: 'smooth', block: 'start' });
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

function promptAddCard() {
  const title   = prompt('Internship title:');
  if (!title) return;
  const company = prompt('Company name:');
  if (!company) return;
  trackerCards.push({ id: `c-${cardCounter++}`, title, company, stage: 'saved', score: 0 });
  renderTracker();
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
document.getElementById('hamburger').addEventListener('click', () => {
  document.getElementById('mobileMenu').classList.toggle('hidden');
});

function closeMobileMenu() {
  document.getElementById('mobileMenu').classList.add('hidden');
}

/* ====================================================
   FILE UPLOAD
   ==================================================== */
function handleFileUpload(input) {
  if (!input.files || !input.files[0]) return;
  const fname = input.files[0].name;
  document.getElementById('uploadLabel').textContent = `✓ ${fname} uploaded`;
  const zone = document.getElementById('uploadZone');
  zone.style.borderColor = '#16a34a';
  zone.style.background = '#f0fdf4';
}

/* ====================================================
   UTIL
   ==================================================== */
function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

/* ====================================================
   INIT
   ==================================================== */
renderTracker();
