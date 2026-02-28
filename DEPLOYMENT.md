# Deployment Guide — HashtagWebpage

## Current Status

| Component | Status | URL |
|-----------|--------|-----|
| Public site | ✅ Live | `hashtagwebpage.com` |
| CRM App | ✅ Live | `app.hashtagwebpage.com` / `hashtagwebpage-app.pages.dev` |
| Supabase DB | ✅ Live | `scrtgfjleifxldpceyrg.supabase.co` |
| send-email Edge Fn | ✅ Deployed | `/functions/v1/send-email` |
| deploy-site Edge Fn | ⚠️ Deploy needed | `/functions/v1/deploy-site` |
| stripe-webhook Edge Fn | ✅ Deployed | `/functions/v1/stripe-webhook` |
| RLS policy fix | ⚠️ SQL needed | see below |

---

## Pending Actions

### 1. Deploy `deploy-site` Edge Function
```bash
supabase link --project-ref scrtgfjleifxldpceyrg
supabase functions deploy deploy-site --no-verify-jwt
```

### 2. Fix Supabase RLS Policy
Run in Supabase Dashboard → SQL Editor:
```sql
drop policy if exists "allow all" on leads;

create policy "authenticated full access" on leads
  for all to authenticated using (true) with check (true);

create policy "anon read published sites" on leads
  for select to anon using (preview_url is not null);
```
This fixes `hashtagwebpage.com/_sites/` showing 0 results.

### 3. Fix `app.hashtagwebpage.com` Custom Domain
- CF Dashboard → Pages → `hashtagwebpage-app` project → Custom Domains
- Add `app.hashtagwebpage.com`
- Check for any Worker route intercepting `app.hashtagwebpage.com/*` and remove it

---

## Project Credentials

| Item | Value |
|------|-------|
| Supabase Project Ref | `scrtgfjleifxldpceyrg` |
| Supabase URL | `https://scrtgfjleifxldpceyrg.supabase.co` |
| Supabase Anon Key | `sb_publishable_gRPK_XsqaoA7YDiIITk9Vg_WmpxW5DT` |
| Resend API Key | `re_SyYHPAjP_KryYbv4Zp4tqWxUTauxVuSZ3` |
| From Email | `contact@hashtagwebpage.com` |
| CF Pages domain (sites) | `hashtagwebpage.com` |
| CF Pages domain (CRM) | `app.hashtagwebpage.com` |
| GitHub Repo | `appsparrow/hashtagwebpage` |

---

## Fresh Setup (if starting from scratch)

### Step 1 — Supabase Cloud (~15 min)

1. supabase.com → New Project → name: `hashtagwebpage`
2. SQL Editor → run schema (see TECH.md)
3. Copy Project URL and anon key

### Step 2 — GitHub Personal Access Token (~5 min)

1. github.com → Settings → Developer Settings → Personal Access Tokens → Fine-grained
2. Repository: `hashtagwebpage`, Permissions: **Contents: Read & Write**
3. Copy token (starts `github_pat_` or `ghp_`)

### Step 3 — Google Places API Key (~5 min)

1. Google Cloud Console → APIs & Services → Credentials → edit your key
2. HTTP referrers: `https://app.hashtagwebpage.com/*`
3. This allows direct browser → Places API calls

### Step 4 — CF Pages: Sites project

Already configured. Serves `webapp/sites/` at `hashtagwebpage.com`.
Do not change root directory — leave as `webapp/sites`.

### Step 5 — CF Pages: CRM App project

1. CF Dashboard → Pages → Create → Connect GitHub → `hashtagwebpage` repo
2. Project name: `hashtagwebpage-app`
3. **Root directory:** `webapp`
4. **Build command:** (leave empty)
5. Deploy → add custom domain `app.hashtagwebpage.com`

### Step 6 — Deploy Supabase Edge Functions (~10 min)

```bash
npm install -g supabase
supabase login
supabase link --project-ref scrtgfjleifxldpceyrg

supabase secrets set RESEND_API_KEY=re_SyYHPAjP_KryYbv4Zp4tqWxUTauxVuSZ3
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<service_role_key_from_dashboard>
supabase secrets set STRIPE_WEBHOOK_SECRET=<from_stripe_when_ready>

supabase functions deploy send-email --no-verify-jwt
supabase functions deploy deploy-site --no-verify-jwt
supabase functions deploy stripe-webhook --no-verify-jwt
```

### Step 7 — CRM Settings

Open `app.hashtagwebpage.com` → Settings → fill in:

| Field | Value |
|-------|-------|
| Google API Key | your restricted key |
| CF Pages Domain | `hashtagwebpage.com` |
| GitHub Owner | `appsparrow` |
| GitHub Repo | `hashtagwebpage` |
| GitHub Token | your `github_pat_xxx` token |
| Resend API Key | `re_SyYHPAjP_KryYbv4Zp4tqWxUTauxVuSZ3` |
| From Email | `contact@hashtagwebpage.com` |

Supabase URL and anon key are hardcoded in `index.html` — no need to enter them.

### Step 8 — Verify

1. ✅ Login to CRM → Dashboard loads
2. ✅ Find Leads → search returns results
3. ✅ Pipeline → Generate Site → check GitHub for new commit, site live in ~60s
4. ✅ Send Preview → email arrives in inbox
5. ✅ `hashtagwebpage.com/_sites/` → shows published sites list

---

## Local Development (still works)

```bash
node webapp/server.js
# CRM at http://localhost:3000
```

Set cloud Supabase URL/key in Settings and it works fully web even from localhost.
