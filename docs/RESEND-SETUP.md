# Contact-form email (Resend) — setup for Dillon

The contact form at **internnest.ai/contact** already works and shows a success message.
Right now it just *logs* submissions on the server — it doesn't email them anywhere yet.
This 3-minute setup makes each submission land in the **support@internnest.ai** inbox.

You need access to the **support@internnest.ai** inbox for the quick path below — which you have.

---

## Quick path (recommended — no DNS, ~3 min)

1. Go to **resend.com** → **Sign up**, using **support@internnest.ai** as the account email
   (check that inbox for the confirmation link). Putting the account on the business email
   keeps it in your name.
2. In Resend, go to **API Keys → Create API Key**. Name it `internnest-contact`, permission
   **Sending access**. Copy the key — it starts with `re_…`. (Treat it like a password.)
3. The key goes into **Vercel** (where the site runs) as an environment variable. Either:
   - add it yourself if you have Vercel access, or
   - send it to Jack **securely** (not plain text/SMS) so he can add it.

   In **Vercel → project `internnest` → Settings → Environment Variables**, add (Production):
   | Name | Value |
   |------|-------|
   | `RESEND_API_KEY` | *(the `re_…` key)* |
   | `CONTACT_TO` | `support@internnest.ai` |
4. In **Vercel → Deployments**, click the **⋯** on the latest deploy → **Redeploy**
   (env vars only take effect on a fresh deploy).
5. Test: open **internnest.ai/contact**, send yourself a message. It should arrive in
   **support@internnest.ai** within a few seconds. Replies go straight to the sender.

With the quick path, the "from" address shows as `onboarding@resend.dev`. That's fine for
receiving notifications. If you want it to read **contact@internnest.ai** instead, do the
branded-sender upgrade below.

---

## Branded sender (optional, later — needs ~4 DNS records)

1. Resend → **Domains → Add Domain** → `internnest.ai` (US region). Resend shows a few DNS
   records (SPF + MX on a `send.` subdomain, a DKIM `TXT`, optional DMARC). These use a
   **subdomain**, so they do **not** affect your Google email — `support@` keeps working.
2. Add those records in **Vercel → internnest → Settings → Domains → internnest.ai → DNS records**.
3. Back in Resend, click **Verify** (usually green within minutes).
4. In Vercel env vars, add one more: `CONTACT_FROM` = `InternNest <contact@internnest.ai>`,
   then **Redeploy**.

---

*Code side is already done and deployed (`api/contact.js`): if `RESEND_API_KEY` is set it sends
via Resend, otherwise it just logs — so nothing breaks while this is pending.*
