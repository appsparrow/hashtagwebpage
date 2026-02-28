# HashtagWebpage — Technical Architecture

## Stack

```
┌─────────────────────────────────────────────────────┐
│  Browser (CRM)                                       │
│  React + Tailwind (single index.html, no build step) │
│  Hosted: CF Pages → app.hashtagwebpage.com           │
└────────┬───────────────┬──────────────┬──────────────┘
         │               │              │
         ▼               ▼              ▼
  Google Places     GitHub API    Supabase (DB + Edge Fns)
  (New) API         (deploy)      supabase.co
  Direct browser    CORS ✅        DB: leads table
  call, key         Pushes HTML   EdgeFn: send-email
  restricted to     to repo →     EdgeFn: stripe-webhook
  app domain        CF auto-deploys

                    ▼
             CF Pages (sites)
             hashtagwebpage.com
             Serves client websites
             + /assets/ (heroes, logos)
```

---

## Data Flow: Lead → Published Site

```
1. Search (browser → places.googleapis.com)
   → Filter businesses without websites
   → Save lead to Supabase DB

2. Generate (browser only, no network call)
   → generateSiteHTML() produces full HTML string

3. Deploy (browser → GitHub API → CF Pages)
   → PUT /repos/{owner}/{repo}/contents/webapp/sites/{slug}/index.html
   → CF Pages detects commit → builds in ~45s
   → Site live at hashtagwebpage.com/{slug}

4. Send Preview (browser → Supabase Edge Fn → Resend)
   → POST /functions/v1/send-email
   → Edge Fn has RESEND_API_KEY secret
   → Beautiful HTML email sent to business owner

5. Payment (Stripe Payment Link → webhook)
   → Business pays via Stripe hosted page
   → Stripe fires webhook to /functions/v1/stripe-webhook
   → Edge Fn updates lead stage to "customer" in Supabase
   → CRM reflects status in real time
```

---

## Key Design Decisions

### Why GitHub API for deploy (not CF Direct Upload)?
CF Direct Upload API requires a CF API Token server-side (can't expose in browser).
GitHub API is CORS-enabled and designed for browser use. CF Pages auto-deploys
from git pushes — so browser → GitHub → CF Pages is a complete server-free pipeline.

**Deploy time:** ~45–90 seconds (GitHub push + CF Pages build trigger)
**GitHub API rate limit:** 5,000 requests/hour (authenticated) — we use ~10/day

### Why Supabase Edge Functions for email (not CF Workers)?
CF Workers: invoked on EVERY request (page loads, assets, etc.) → hits 100K/day fast.
Supabase Edge Functions: invoked ONLY when explicitly called (email sends, Stripe webhooks).
At our volume: ~50 email sends/day = 1,500/month. Free tier: 500K/month.

### Why keep assets on CF Pages git (not Supabase Storage or R2)?
- Hero images and logos rarely change (managed by us, not user-uploaded)
- CF Pages serves git files for FREE with zero egress fees
- No CORS issues — same domain as client sites
- No additional storage service to manage
- R2 would be needed only if we add user-uploaded files (future feature)

### Why single index.html (no build step)?
- Deploy instantly by committing one file — no npm, no webpack
- Works on any machine without local setup
- React via Babel standalone CDN — fine for this scale
- When app grows large enough to need optimization, migrate to Vite + React

---

## File Structure

```
hashtagwebpage/
├── webapp/
│   ├── index.html              ← CRM app (React, ~2000 lines)
│   ├── server.js               ← Local dev server (no longer needed for prod)
│   └── sites/                  ← CF Pages root (client sites + assets)
│       ├── index.html          ← hashtagwebpage homepage
│       ├── _sites/             ← Hidden admin: published sites directory
│       ├── assets/
│       │   ├── categories/     ← Hero images (plumber.jpg etc.)
│       │   └── logos/          ← Category logos + yourlogo.png default
│       └── {slug}/
│           └── index.html      ← Generated client sites
├── supabase/
│   └── functions/
│       ├── send-email/
│       │   └── index.ts        ← Resend email proxy
│       └── stripe-webhook/
│           └── index.ts        ← Stripe payment event handler
├── PLAN.md                     ← Migration plan
├── TECH.md                     ← This file
├── DEPLOYMENT.md               ← Step-by-step deploy guide
├── EDGE_FUNCTIONS.md           ← Edge function docs
└── STRIPE.md                   ← Stripe integration plan
```

---

## Supabase Schema

```sql
create table leads (
  id           text primary key,
  name         text,
  category     text,
  city         text,
  phone        text,
  address      text,
  email        text,
  rating       numeric,
  review_count integer,
  stage        text default 'new',
  preview_url  text,
  maps_url     text,
  found_at     bigint,
  sent_at      bigint,
  follow_up_at bigint,
  converted_at bigint,
  notes        text,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- Enable RLS (Row Level Security)
alter table leads enable row level security;

-- Allow anon key full access (CRM is password-protected by obscurity for now)
create policy "allow all" on leads for all using (true);
```

---

## Environment Variables (CF Pages — set in dashboard)

None required for the CRM static page itself. All secrets live in:
- **Supabase Edge Functions secrets** (set via `supabase secrets set`)
- **User's browser localStorage** (API keys entered in Settings panel)

This keeps the CRM deployable as a pure static file with zero server configuration.
