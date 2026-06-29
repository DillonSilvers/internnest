# InternNest — Owner's Guide (for Dillon)

A plain-English guide to owning and running **InternNest** (internnest.ai).
No technical knowledge needed. Jack keeps this updated as the site is built.

---

## What you own

Everything below is **yours** and should be in **your name**, with **you** holding the
logins. Jack is building it for you and hands over all the keys at the end.

## Accounts & logins you need

| Service | What it's for | Who pays | Rough cost |
|---------|---------------|----------|-----------|
| **GitHub** | Stores the website's code (the master copy; repo is **public** so Netlify's free plan can build it) | Free | $0 |
| **Netlify** | Hosts the live website + runs the "behind-the-scenes" code | Free tier | $0 until heavy traffic |
| **GoDaddy** | Your domain name, internnest.ai | You | ~$70–100 / year |
| **Stripe** | Takes card payments, deposits money to your bank | Per sale | ~2.9% + 30¢ per sale |
| **AI API** (Claude or Gemini) | Powers the "Find My Matches" engine + chatbot | Per use | Pennies per search; grows with traffic |

*(As we set each one up, this guide will say exactly what it is and how to log in.)*

## How the site works (in plain English)

- The website's files live on **GitHub**.
- When a change is made, it's saved ("pushed") to GitHub, and **Netlify** automatically
  publishes the new version within about 30 seconds.
- Your domain **internnest.ai** points to Netlify, so visitors see your site.
- The AI matching runs through a small piece of code on Netlify that talks to the AI
  provider using your **API key** (a secret password). The key is stored safely on the
  server — never in the public website.

## How to make a change

You don't need to code. Open the project with **Claude** and describe what you want
(e.g., "change the price to $39"). It gets pushed and goes live automatically.
A full walkthrough + lessons come at handoff.

## What it costs to run (ongoing)

- Domain: ~$70–100 / year (GoDaddy)
- AI usage: pay-as-you-go, scales with how many people use the matcher
- Everything else: free tier to start

## Current status

- ✅ Code on GitHub (**public** repo `jackryan225/internnest`), live on Netlify, auto-deploys on every push
- ✅ Domain **internnest.ai** live with SSL
- ✅ Rebranded to InternNest (logo, favicon, wordmark)
- 🔜 Real AI matcher, Stripe payments
