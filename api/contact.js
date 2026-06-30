'use strict';

function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body || '{}'); } catch (e) { return null; }
}

// Sends the contact message via Resend if RESEND_API_KEY is set; otherwise accepts + logs
// (so the form always works). Wire RESEND_API_KEY + CONTACT_TO in Vercel to receive emails.
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const body = readBody(req);
  if (body === null) return res.status(400).json({ error: 'bad JSON' });
  const name = (body.name || '').toString().slice(0, 200).trim();
  const email = (body.email || '').toString().slice(0, 200).trim();
  const message = (body.message || '').toString().slice(0, 5000).trim();
  if (!name || !email || !message) return res.status(400).json({ error: 'missing fields' });

  const key = process.env.RESEND_API_KEY;
  if (key) {
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          from: 'InternNest <onboarding@resend.dev>',
          to: [process.env.CONTACT_TO || 'hello@internnest.ai'],
          reply_to: email,
          subject: `Contact form — ${name}`,
          text: `From: ${name} <${email}>\n\n${message}`,
        }),
      });
    } catch (e) { /* don't fail the user if email send hiccups */ }
  } else {
    console.log('[contact] no RESEND_API_KEY set —', name, email, message.slice(0, 80));
  }
  return res.status(200).json({ ok: true });
};
