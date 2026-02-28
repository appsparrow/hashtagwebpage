# HashtagWebpage — Project Plan

## Status: LIVE ✅
The CRM is fully web-based and deployed. No local server needed.

---

## Live URLs

| URL | What it is |
|-----|-----------|
| `https://hashtagwebpage.com` | Public homepage (landing page) |
| `https://hashtagwebpage.com/_sites/` | Admin: list of all published sites |
| `https://hashtagwebpage.com/_firstdraft/` | Original homepage (saved for reference) |
| `https://hashtagwebpage.com/{slug}/` | Individual client websites |
| `https://app.hashtagwebpage.com` | CRM admin app (login required) |
| `https://144f4219.hashtagwebpage-app.pages.dev/` | CF Pages preview URL (always works) |

---

## What Was Built

### CRM App (`webapp/index.html`)
- React + Tailwind, single HTML file, no build step
- Supabase Auth login (email + password)
- **Dashboard** — stats, funnel, recent activity
- **Find Leads** — Google Places API (New) direct browser call
- **Pipeline** — Kanban view with Generate Site, Send Preview, Archive actions
- **Published Sites** — sidebar view showing all sites with search + status filter
- **Settings** — API keys, GitHub config, Supabase config

### Site Generator
- `generateSiteHTML()` builds full client website HTML
- Open Graph meta tags for WhatsApp/SMS link previews
- Category hero images + logos with 3-level fallback chain
- Deploy via Supabase Edge Function → GitHub API → CF Pages auto-deploys

### Supabase Edge Functions
- `send-email` — proxies Resend API for HTML emails
- `stripe-webhook` — verifies Stripe sig, promotes lead to customer
- `deploy-site` — proxies GitHub Contents API (fixes browser CORS issue)

### Public Pages
- `hashtagwebpage.com` — "We build your website free, you pay if you love it" landing page
- `hashtagwebpage.com/_sites/` — admin directory of all published sites (needs RLS fix)
- `hashtagwebpage.com/_firstdraft/` — original marketing homepage (archived)

---

## Architecture Summary

```
Browser (CRM at app.hashtagwebpage.com)
    │
    ├── Google Places API (direct CORS call)
    ├── Supabase DB (leads table, RLS)
    ├── Supabase Auth (email/password login)
    └── Supabase Edge Functions:
            ├── /functions/v1/send-email      → Resend API
            ├── /functions/v1/deploy-site     → GitHub API → CF Pages
            └── /functions/v1/stripe-webhook  ← Stripe events

CF Pages (hashtagwebpage.com)
    ├── /                 ← landing page
    ├── /_sites/          ← admin sites directory
    ├── /_firstdraft/     ← archived homepage
    ├── /assets/          ← logos, hero images
    └── /{slug}/          ← client websites
```

---

## Pending Actions

1. **Deploy `deploy-site` Edge Function** — `supabase functions deploy deploy-site --no-verify-jwt`
2. **Fix Supabase RLS** — run SQL in Supabase Dashboard (see DEPLOYMENT.md)
3. **Fix `app.hashtagwebpage.com` custom domain** — add in CF Pages Dashboard → Custom Domains, check for conflicting Worker routes
4. **Stripe payments** — add Payment Links to Send Preview modal (next sprint)

---

## Next Sprint: Stripe Payments

- Add `stripeMonthlyUrl` ($49/mo) and `stripeOneTimeUrl` ($297) to Settings
- Add payment buttons to the Send Preview modal
- Auto-promote lead to `customer` via stripe-webhook (code already built)

---

## Cost (all free tier, $0 until real scale)

| Service | Free limit | Our usage |
|---------|-----------|-----------|
| CF Pages | Unlimited requests | ✅ |
| Supabase DB | 500MB, 50K MAU | ✅ |
| Supabase Edge Functions | 500K calls/month | ~50/day max |
| GitHub API | 5K calls/hour | ~10/day |
| Resend | 3K emails/month | ~20/day max |
| Google Places | $200 credit/month | ~50 searches/day |
| **Total** | | **$0** |
