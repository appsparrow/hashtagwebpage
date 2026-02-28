# Deployment Guide — HashtagWebpage

Complete step-by-step to go from local → fully web-hosted.

---

## Step 1 — Supabase Cloud (15 min)

### 1a. Create project
1. Go to [supabase.com](https://supabase.com) → New Project
2. Name: `hashtagwebpage`
3. Database password: save it somewhere safe
4. Region: US East (or closest to you)

### 1b. Run schema
Go to SQL Editor in Supabase dashboard and run:

```sql
create table if not exists leads (
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
create policy "allow all" on leads for all using (true);
```

### 1c. Copy credentials
- Project URL: `https://xxxx.supabase.co` (from Settings → API)
- Anon Key: `eyJhbGci...` (from Settings → API)
- Service Role Key: (for edge functions only — keep secret)

---

## Step 2 — GitHub Personal Access Token (5 min)

1. Go to github.com → Settings → Developer Settings → Personal Access Tokens → Fine-grained tokens
2. Click "Generate new token"
3. Name: `HashtagWebpage Deploy`
4. Expiration: 1 year (set a reminder to rotate)
5. Repository access: Only select repositories → `hashtagwebpage`
6. Permissions:
   - **Repository → Contents: Read and Write** ← required for deploy
7. Copy the token (starts with `github_pat_` or `ghp_`)

---

## Step 3 — Restrict Google Places API Key (5 min)

1. [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials
2. Click your Places API key → Edit
3. Under "Application restrictions" → HTTP referrers
4. Add:
   - `https://app.hashtagwebpage.com/*`
   - `https://app.hashtagwebpage.com/*`
   - `http://localhost:3000/*` (keep for local dev)
5. Save

This allows the browser CRM to call Places API directly without a server proxy.

---

## Step 4 — Deploy CRM to CF Pages (10 min)

### Create a new CF Pages project for the CRM app:
1. Cloudflare Dashboard → Pages → Create a Project → Connect to Git
2. Select repository: `hashtagwebpage`
3. Project name: `hashtagwebpage-app` (or `app-hashtagwebpage`)
4. Production branch: `main`
5. **Root directory:** `webapp` ← important, set this
6. **Build command:** (leave empty)
7. **Build output directory:** (leave empty or set to `webapp`)
8. Deploy!

The CRM will be at `hashtagwebpage-app.pages.dev` — add a custom domain in CF Pages settings (`app.hashtagwebpage.com`).

> Note: Your existing CF Pages project (`hashtagwebpage`) keeps serving client sites from `webapp/sites/` — don't change it.

---

## Step 5 — Deploy Supabase Edge Functions (10 min)

```bash
# In your terminal, from the repo root:
npm install -g supabase
supabase login
supabase link --project-ref YOUR_PROJECT_REF

supabase secrets set RESEND_API_KEY=re_SyYHPAjP_KryYbv4Zp4tqWxUTauxVuSZ3
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNjcnRnZmpsZWlmeGxkcGNleXJnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyMTg3ODUsImV4cCI6MjA4Nzc5NDc4NX0.8Tc7JhrNrxASsigkXI1aA4NSuP5fc9Rp4PyPQa2lxY4

supabase functions deploy send-email --no-verify-jwt
supabase functions deploy stripe-webhook --no-verify-jwt
```

---

## Step 6 — Configure CRM Settings

Open the CRM at your new URL and go to Settings. Fill in:

| Field | Value |
|-------|-------|
| Supabase URL | `https://xxxx.supabase.co` |
| Supabase Anon Key | `eyJhbGci...` |
| GitHub Owner | your GitHub username |
| GitHub Repo | `hashtagwebpage` |
| GitHub Token | `github_pat_xxxx` |
| CF Pages Domain | `hashtagwebpage.com` |
| CF Project Name | `hashtagwebpage` |
| Google API Key | your restricted key |
| Resend API Key | `re_xxxx` (optional — edge fn uses it server-side) |

---

## Step 7 — Verify Everything Works

1. ✅ **Search** — search for a category + city, should return leads
2. ✅ **Generate Site** — pick a lead → Generate Site → check GitHub for new commit
3. ✅ **Send Email** — add email to lead → Send Preview → check inbox
4. ✅ **Published Sites** — visit `/_sites/` on your CF Pages domain

---

## Migrate Existing Leads (optional)

If you have leads in local Supabase, export them:

```sql
-- Run in local pgAdmin (localhost:5050)
COPY leads TO '/tmp/leads.csv' CSV HEADER;
```

Then import in cloud Supabase SQL Editor:
```sql
-- Paste CSV data or use Supabase dashboard → Table Editor → Import CSV
```

---

## Local Development (still works)

`server.js` is kept for reference. To run locally:
```bash
node webapp/server.js
# CRM at http://localhost:3000
```

Local server still proxies Google Places and handles deploy.
Or set your cloud Supabase URL/key in Settings and it works fully web even from localhost.
