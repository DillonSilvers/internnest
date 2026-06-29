# InternPilot AI

A landing page + interactive demo for an AI internship-matching tool for college
students. It's a plain static website — three files, no build step, no server to run.

**Live site:** https://dynamic-stardust-6be07e.netlify.app/

---

## The files

| File | What it is |
|------|------------|
| `index.html` | The page itself — all the text and sections (nav, hero, form, pricing, footer). |
| `styles.css` | All the colors, fonts, spacing, and layout. |
| `script.js` | The interactive logic — the internship listings, match scoring, and the tracker. |

## Preview it on your computer

Double-click `index.html`. It opens in your browser exactly as it appears live.
No installs, no terminal, no build step.

## How to change common things

- **Edit any text on the page** → find it in `index.html` and change it.
- **Change prices/plans** → the "PRICING" section in `index.html`.
- **Add or edit the internship listings** → the `DATA` object near the top of
  `script.js`. Each internship has a title, company, location, score, "why it
  matches," missing skills, a tip, and an outreach message.
- **Change colors or fonts** → the `:root` block at the top of `styles.css`.

Tip: ask Claude to make the edit for you — describe what you want changed and
which file, and it can do it.

## Publishing changes (making them go live)

Once this repo is connected to Netlify (continuous deploy), the loop is:

1. Edit the file(s) and save.
2. In **GitHub Desktop**: type a short summary → **Commit to main** → **Push origin**.
3. Netlify automatically rebuilds; your live site updates in ~30 seconds.

## How it works right now (worth knowing)

The "AI matching" is a built-in demo: scores and listings come straight from
`script.js` — there's no live AI service behind it yet. Also:

- The intake form doesn't send anywhere (no emails are collected).
- The application tracker resets when you reload the page (nothing is saved).
- The resume upload just shows the filename; it isn't read.

Making any of that real (live AI matching, saving data, accounts, payments) is
future work — it would need a backend, a database, and an AI API. The current
site is a polished front-end demo.

## Hosting

Front-end hosted on **Netlify**. Custom domain: _to be added_.
