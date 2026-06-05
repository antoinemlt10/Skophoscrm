# Skophos CRM 🔭

Your daily outreach cockpit — a friction-free, gamified prospecting CRM built to do one job: **get you to actually send the emails, every day, until Skophos has its first beta testers.**

Dark, fast, and motivating. Open it every morning, hit your quota, keep the streak alive.

![stack](https://img.shields.io/badge/React-18-61dafb) ![stack](https://img.shields.io/badge/Vite-5-646cff) ![stack](https://img.shields.io/badge/Tailwind-3-38bdf8) ![stack](https://img.shields.io/badge/Supabase-Postgres-3ecf8e)

---

## What's inside

- **Today dashboard** — a quota ring, streak counter, and the exact list of people to contact today with one-click *copy email* / *open in mail* / *mark as sent*.
- **Targets** — add/edit/delete, search & filter, bulk **CSV paste import**, CSV export.
- **Templates** — two editable templates with `[Name] [Department] [Lab] [Hook]` merge variables, live preview against a real contact, version tracking, and a "this message isn't working" iteration log.
- **Pipeline** — Kanban (drag & drop) + table view, status history with timestamps, the last message sent stored per target, and overdue follow-ups surfaced.
- **Response tracking** — type, sentiment, and an optional quote per reply.
- **Analytics** — response rate, funnel, and cohort breakdowns by **department / channel / template version** (so you can see what converts).
- **Decision framework** — a baseline pivot alert + a reflection prompt every N contacts.
- **Learnings** — a founder's notebook for observations, convictions, and pivots.
- **First-win celebration** — confetti + a moment the first time someone says "Interested".
- **No lock-in** — export everything as CSV anytime.

Ships with **10 sample targets** and **both templates pre-filled** so it works the second you open it.

---

## 1. Run it locally (zero config, 2 minutes)

You don't need Supabase to try it — it falls back to your browser's localStorage automatically.

```bash
npm install
npm run dev
```

Open the URL it prints (usually http://localhost:5173). You'll see the 10 sample targets and a full working app. Data is saved in **this browser only**.

> When you're ready to sync across devices and deploy publicly, set up Supabase (next section).

---

## 2. Set up Supabase (recommended for deploy)

Supabase gives you a real Postgres database, secure auth, and multi-device sync. Free tier is plenty.

### a) Create the project
1. Go to [supabase.com](https://supabase.com) → **New project**. Pick a name and a strong database password.
2. Wait ~2 minutes for it to provision.

### b) Create the tables
1. In the Supabase dashboard → **SQL Editor** → **New query**.
2. Open `supabase/migrations/0001_init.sql` from this repo, copy the **whole file**, paste it in, and click **Run**.
   - It creates all tables, indexes, and Row-Level-Security policies. Safe to re-run.

### c) Create your login (single user)
1. **Authentication → Users → Add user** → enter your email + a password. Tick "Auto Confirm".
2. **Authentication → Providers → Email** → turn **OFF** "Enable sign-ups" so you stay the only account.

> ⚠️ **Step 2 is required, not optional.** Row-Level Security keeps your *data* private, but if sign-ups stay on, a stranger with your URL can still register their own account. Disabling sign-ups is what makes this truly single-user. (The migration also ships a commented-out `auth.users` trigger you can enable to hard-lock it to your email.)

### d) Grab your keys
**Project Settings → API**, copy:
- **Project URL** → `VITE_SUPABASE_URL`
- **anon / public key** → `VITE_SUPABASE_ANON_KEY`

### e) Wire up your local `.env`
```bash
cp .env.example .env
```
Fill in:
```
VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
```
Restart `npm run dev`. Now the login screen uses your Supabase email/password, and your data lives in Postgres. The 10 samples seed automatically into your account on first load.

---

## 3. Deploy to Vercel

### a) Push to GitHub
```bash
git init
git add .
git commit -m "Skophos CRM"
git branch -M main
git remote add origin https://github.com/<you>/skophos-crm.git
git push -u origin main
```

### b) Import on Vercel
1. [vercel.com](https://vercel.com) → **Add New → Project** → import your repo.
2. Vercel auto-detects **Vite** (build: `npm run build`, output: `dist`). Nothing to change.
3. **Environment Variables** → add the same two keys from your `.env`:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - *(Optional, localStorage mode only:)* `VITE_APP_PASSWORD`
4. **Deploy.** Done — you get a live URL.

> After adding/changing env vars, redeploy (Vercel → Deployments → ⋯ → Redeploy) so they take effect.

---

## Environment variables

| Variable | Required? | What it does |
|---|---|---|
| `VITE_SUPABASE_URL` | For cloud mode | Your Supabase project URL. |
| `VITE_SUPABASE_ANON_KEY` | For cloud mode | Supabase public anon key. Safe to expose — your data is protected by Row-Level Security + auth. |
| `VITE_APP_PASSWORD` | Optional | A simple password gate, used **only** when Supabase is *not* configured. See security note below. |

If both Supabase vars are blank → the app runs in **localStorage mode** with the optional password gate.

---

## Security notes (read before going public)

- **With Supabase (recommended):** every row is scoped to `owner = auth.uid()` via RLS. Even though the anon key is public, nobody can read or write your data without logging into your account. This is the safe way to deploy publicly.
- **The `VITE_APP_PASSWORD` gate is not real security.** It only hides the UI and lives in the client bundle. It's fine for a private localStorage build on your own machine, but **do not** rely on it to protect a public deployment. For anything public, use Supabase auth.
- `.env` is gitignored — your keys never get committed. Double-check before pushing.

---

## How the daily flow works

1. **Scheduler** — drag prospects onto days of the week. Whatever lands on *today* shows up on the dashboard.
2. **Today** — work the list top-to-bottom: *Copy email* (template is already merged with the person's name + hook) → paste & send → *Mark as sent*. Follow-ups are auto-scheduled for contact date + N days and reappear when due.
3. **When someone replies** — hit *Got a reply* / *Log reply*, capture type + sentiment + a quote. The first "Interested" triggers a celebration.
4. **Every ~20 contacts** — a pivot check nudges you to look at the data and log what you'll change.

---

## Customizing

- **Daily quota / follow-up window / pivot thresholds** → Settings (or tweak the quota right on the dashboard).
- **Templates** → Templates page. Saving bumps the version so cohort analytics can compare v1 vs v2.
- **Design tokens** (colors, fonts) → `src/index.css` (`:root` variables) and `tailwind.config.js`.

---

## Project structure

```
skophos-crm/
├─ supabase/migrations/0001_init.sql   # full schema + RLS (run this in Supabase)
├─ src/
│  ├─ lib/            # framework-free logic: store (the 2-backend data layer),
│  │                  #   analytics, dates, merge engine, csv, seed data, constants
│  ├─ context/        # DataContext (the app brain) + ToastContext
│  ├─ components/     # ui kit, Modal, Confetti, AuthGate, Celebration, forms, layout
│  └─ pages/          # Dashboard, Targets, Pipeline, Scheduler, Templates,
│                     #   Analytics, Learnings, Settings
├─ .env.example
└─ vercel.json        # SPA rewrite for Vercel
```

The whole app is one `view` switch in `src/App.jsx` — no router, nothing exotic. Start reading there.

---

## Troubleshooting

- **"Something went wrong" on load (Supabase mode)** → check the URL + anon key are exact, and that you ran `0001_init.sql`.
- **Login fails** → create the user under Authentication → Users, with "Auto Confirm" on.
- **Sample data didn't seed** → seeding only runs when the account is empty. Use Settings → *Reset to sample data*.
- **Env vars ignored on Vercel** → they must start with `VITE_`, and you must redeploy after adding them.

---

Built for a solo founder who just needs to hit *send*. Go get your first 5 beta testers. 🔭
