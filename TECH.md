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
  Google Places    Supabase DB    Supabase Edge Functions
  (New) API        leads table    /functions/v1/send-email
  Direct browser   RLS + Auth     /functions/v1/deploy-site
  call, key        email/pass     /functions/v1/stripe-webhook
  restricted to    login                    │
  app domain                               ▼
                                    GitHub API
                                    PUT contents/{slug}
                                          │
                                          ▼
                                   CF Pages auto-deploy
                                   hashtagwebpage.com/{slug}
```

---

## Data Flow: Lead → Published Site

```
1. Search (browser → places.googleapis.com)
   → Filter businesses without websites
   → Save lead to Supabase DB

2. Generate (browser only, no network call)
   → generateSiteHTML() produces full HTML string

3. Deploy (browser → Supabase Edge Fn → GitHub API → CF Pages)
   → POST /functions/v1/deploy-site
   → Edge Fn: GET existing SHA → PUT /repos/{owner}/{repo}/contents/{path}
   → CF Pages detects commit → builds in ~45s
   → Site live at hashtagwebpage.com/{slug}

4. Send Preview (browser → Supabase Edge Fn → Resend)
   → POST /functions/v1/send-email
   → Edge Fn has RESEND_API_KEY secret
   → HTML email sent to business owner

5. Payment (Stripe Payment Link → webhook)
   → Business pays via Stripe hosted page
   → Stripe fires webhook to /functions/v1/stripe-webhook
   → Edge Fn updates lead stage to "customer" in Supabase
   → CRM Published Sites view reflects status in real time
```

---

## Key Design Decisions

### Why Supabase Edge Function for deploy (not direct GitHub API)?
Originally deployed directly from browser to GitHub API. In production from
`app.hashtagwebpage.com`, the CORS preflight for PUT requests was failing
("Failed to fetch"). Moved to Edge Function proxy which:
- Eliminates CORS concerns (server-side call)
- Keeps GitHub token configuration server-passthrough
- Uses the same Edge Function infrastructure already in place

**Deploy time:** ~45–90 seconds (GitHub push + CF Pages build trigger)

### Why Supabase Edge Functions for email (not CF Workers)?
CF Workers: invoked on EVERY request → hits 100K/day free limit fast.
Supabase Edge Functions: invoked ONLY on explicit calls (~50/day = 1,500/month).
Free tier: 500K/month. No rate limit risk.

### Why keep assets on CF Pages git (not Supabase Storage or R2)?
- Hero images and logos rarely change
- CF Pages serves git files FREE with zero egress
- No CORS issues — same domain as client sites
- R2 only needed for user-uploaded files (future feature)

### Why single index.html (no build step)?
- Deploy by committing one file — no npm, no webpack, no CI
- React via Babel standalone CDN
- Works on any machine without local setup
- Migrate to Vite+React when app grows large enough to need it

### Why Supabase Auth (not custom auth)?
- Email+password login, JWT-based
- RLS policies enforce data isolation
- Anon key is safe to expose (security via RLS, not key secrecy)
- `sb_publishable_` key format is Supabase's current anon key standard

---

## File Structure

```
hashtagwebpage/
├── webapp/
│   ├── index.html              ← CRM app (React, ~2300+ lines)
│   ├── server.js               ← Local dev reference (not used in prod)
│   └── sites/                  ← CF Pages root for hashtagwebpage.com
│       ├── index.html          ← Public landing page ("pay if you like it")
│       ├── _sites/             ← Admin: published sites directory (requires RLS fix)
│       │   └── index.html
│       ├── _firstdraft/        ← Original homepage (archived)
│       │   └── index.html
│       ├── assets/
│       │   ├── categories/     ← Hero images ({category-slug}.jpg)
│       │   └── logos/          ← Category logos + yourlogo.png default
│       └── {slug}/
│           └── index.html      ← Generated client sites
├── supabase/
│   └── functions/
│       ├── send-email/
│       │   └── index.ts        ← Resend email proxy
│       ├── stripe-webhook/
│       │   └── index.ts        ← Stripe payment event handler
│       └── deploy-site/
│           └── index.ts        ← GitHub Contents API proxy (fixes CORS)
├── PLAN.md                     ← Project plan & status
├── TECH.md                     ← This file
├── DEPLOYMENT.md               ← Step-by-step deploy guide
├── EDGE_FUNCTIONS.md           ← Edge function docs & deploy commands
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

alter table leads enable row level security;

-- CRM admin (logged in with email/password) gets full access
create policy "authenticated full access" on leads
  for all to authenticated using (true) with check (true);

-- /_sites page (anon key, no login) can read published sites only
create policy "anon read published sites" on leads
  for select to anon using (preview_url is not null);
```

---

## Hardcoded Constants (safe to commit)

In `webapp/index.html` and `webapp/sites/_sites/index.html`:
```javascript
const SUPABASE_URL      = "https://scrtgfjleifxldpceyrg.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_gRPK_XsqaoA7YDiIITk9Vg_WmpxW5DT";
```

The anon key is safe to commit — Supabase's design intent. Security comes from
RLS policies, not key secrecy. The service role key is NEVER committed — it lives
only in Supabase Edge Function secrets.

---

## Environment Variables

No CF Pages environment variables needed. All secrets live in:
- **Supabase Edge Functions secrets** (`supabase secrets set`)
- **User's browser localStorage** (Settings panel in CRM)

This keeps the CRM deployable as a pure static file with zero server config.
