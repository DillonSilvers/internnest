'use strict';
const json = (statusCode, obj) => ({ statusCode, headers: { 'content-type': 'application/json' }, body: JSON.stringify(obj) });

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'POST only' });
  let body;
  try { body = JSON.parse(event.body || '{}'); } catch (e) { return json(400, { error: 'bad JSON' }); }
  const name = (body.name || '').toString().slice(0, 200).trim();
  const email = (body.email || '').toString().slice(0, 200).trim();
  const message = (body.message || '').toString().slice(0, 5000).trim();
  if (!name || !email || !message) return json(400, { error: 'missing fields' });

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
    } catch (e) { /* ignore send hiccup */ }
  } else {
    console.log('[contact] no RESEND_API_KEY set —', name, email, message.slice(0, 80));
  }
  return json(200, { ok: true });
};
