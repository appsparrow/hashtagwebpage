# HashtagWebpage — Migration Plan: Local → Fully Web

## Status: IN PROGRESS
**Goal:** Remove all local server dependency. Run the entire CRM from any browser, anywhere.

---

## What Changed (v0 → v1)

| Component | v0 (local) | v1 (web) |
|-----------|-----------|---------|
| CRM App | `localhost:3000` via server.js | Hosted on CF Pages |
| Google Places | server.js proxy | Direct browser call to Places API (New) |
| Site Deploy | server.js → CF Direct Upload API | Browser → GitHub API → CF Pages auto-deploys |
| Send Email | server.js → Resend API | Supabase Edge Function → Resend API |
| Stripe Webhooks | not implemented | Supabase Edge Function receiver |
| Supabase | Local Docker on :54321 | Supabase Cloud (free tier) |
| Assets (logos/heroes) | server.js /assets/ route | CF Pages git-based (no change) |

---

## Phase 1 — Infrastructure Setup (manual, ~30 min)
These require terminal/browser actions the user must do:

### 1a. Create Supabase Cloud Project
- Go to supabase.com → New Project
- Copy Project URL and anon key into CRM Settings
- Run schema: see `DEPLOYMENT.md`

### 1b. Create second CF Pages project for CRM
- CF Dashboard → Pages → Create → Connect GitHub → select `hashtagwebpage` repo
- Root directory: `webapp` (not `webapp/sites`)
- Build command: (none — static)
- Output: `webapp`
- Domain: `app.hashtagwebpage.pages.dev` or custom `app.hashtagwebpage.com`

### 1c. Generate GitHub Personal Access Token
- github.com → Settings → Developer Settings → Personal Access Tokens → Fine-grained
- Repository: `hashtagwebpage`
- Permissions: **Contents: Read & Write**
- Copy token → CRM Settings → GitHub Token

### 1d. Restrict Google Places API key
- Google Cloud Console → Credentials → edit your API key
- HTTP referrers: `https://app.hashtagwebpage.pages.dev/*` and `https://app.hashtagwebpage.com/*`
- This lets the browser call Places API directly without a proxy

---

## Phase 2 — Deploy Edge Functions (terminal, ~10 min)
See `EDGE_FUNCTIONS.md` for full instructions.

```bash
# Install Supabase CLI (once)
npm install -g supabase

# Login
supabase login

# Link to your cloud project
supabase link --project-ref YOUR_PROJECT_REF

# Set secrets (keys stay off client)
supabase secrets set RESEND_API_KEY=re_xxxx
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_xxxx

# Deploy both functions
supabase functions deploy send-email
supabase functions deploy stripe-webhook
```

---

## Phase 3 — CRM Settings Update
Once deployed, update these in the CRM Settings panel:

| Setting | Value |
|---------|-------|
| Supabase URL | `https://YOUR_REF.supabase.co` |
| Supabase Anon Key | from Supabase dashboard |
| GitHub Owner | your GitHub username |
| GitHub Repo | `hashtagwebpage` |
| GitHub Token | fine-grained token with Contents:Write |
| CF Pages Domain | `hashtagwebpage.pages.dev` |
| CF Project Name | `hashtagwebpage` |
| Google API Key | restricted to app domain |

---

## Phase 4 — Stripe Integration (next sprint)
See `STRIPE.md` for full plan.
- Stripe Payment Links (no code) for $49/mo and $297 buyout
- Stripe webhook → `supabase/functions/stripe-webhook` → updates lead to `customer`
- CRM shows real-time payment status

---

## Cost at Scale (all free tier)

| Service | Free limit | Our usage |
|---------|-----------|-----------|
| CF Pages | Unlimited requests | ✅ |
| Supabase DB | 500MB, 50K MAU | ✅ |
| Supabase Edge Functions | 500K calls/month | ~50/day max |
| GitHub API | 5K calls/hour (authenticated) | ~10/day |
| Resend | 3K emails/month | ~20/day max |
| Google Places | $200 credit/month | ~50 searches/day |
| **Total cost** | | **$0** until real scale |
