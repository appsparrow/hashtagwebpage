# HashtagWebpage — Deploy Now Checklist
**Stack: Cloudflare Pages + Workers · Supabase Local → Cloud · n8n · Resend**

---

## The System at a Glance

```
You (CEO)
  └─ index.html (localhost:3000)     ← your private admin + command center
       ├─ supabase (localhost:54321)  ← all leads, persistent
       ├─ n8n     (localhost:5678)   ← runs 4 workflows automatically
       └─ Cloudflare Pages           ← deploys client sites + your marketing page

Cloudflare Pages (public)
  ├─ hashtagwebpage.com/        ← your marketing homepage
  └─ hashtagwebpage.com/slug/   ← each client's generated website

n8n (background, always on)
  ├─ Workflow 1: Daily 9am  → scrape leads → save to Supabase
  ├─ Workflow 2: Every 6h   → email preview links to ready leads
  ├─ Workflow 3: Daily 10am → send follow-ups, archive cold leads
  └─ Workflow 4: Webhook    → respond to Quick Actions from dashboard
```

---

## Phase 1 — Start Local (Today, ~45 minutes)

### Step 1: Start Supabase Local (Docker required)
```bash
cd webapp/supabase
docker compose up -d
# DB: localhost:5432  |  API: localhost:54321  |  pgAdmin: localhost:54323
```
**pgAdmin login:** postgres/ admin
The `leads` table is created automatically on first start.

In app Settings → Supabase:
- URL: `http://localhost:54321`
- Key: `localdevkey` (no JWT validation in local mode)
- Click **Test Connection** → should show ✅

### Step 2: Get Your Google API Key
1. console.cloud.google.com → New Project → "HashtagWebpage"
2. APIs & Services → Enable **Places API (New)**
3. Credentials → Create API Key
4. Set budget alert: Billing → $30/month
5. Start server with key: `GOOGLE_API_KEY=AIzaSy... node server.js`

### Step 3: Get Cloudflare Credentials
1. Sign up at cloudflare.com (free)
2. Dashboard → right sidebar → copy **Account ID**
3. Profile → API Tokens → Create Token → **Edit Cloudflare Pages** template
4. Paste both into app Settings → Cloudflare Pages

### Step 4: Deploy Marketing Homepage
In app Settings → Cloudflare Pages → click **🏠 Deploy Homepage**
→ Live at: `https://hashtagwebpage.com`

### Step 5: Run the App
```bash
cd webapp
GOOGLE_API_KEY=YOUR_KEY node server.js
# Open: http://localhost:3000
```

---

## Phase 2 — Add Email + n8n Automation (~30 minutes)

### Step 6: Resend Email Setup
1. Sign up at resend.com (100 free emails/day)
2. Add your domain → follow DNS setup (or use Resend's `onboarding@resend.dev` for testing)
3. Create API Key → paste into app Settings → Email

### Step 7: Start n8n
```bash
docker run -it --rm \
  --name n8n \
  -p 5678:5678 \
  -v ~/.n8n:/home/node/.n8n \
  docker.n8n.io/n8nio/n8n
# Open: http://localhost:5678
```

### Step 8: Set n8n Variables
In n8n → Settings → Variables → create:
| Variable      | Value |
|---------------|-------|
| WORKER_URL    | https://YOUR-WORKER.workers.dev |
| SUPABASE_URL  | http://localhost:54321 |
| SUPABASE_KEY  | localdevkey |
| RESEND_KEY    | re_yourkey |
| FROM_EMAIL    | hello@yourdomain.com |

### Step 9: Import n8n Workflows
1. n8n → Workflows → Import from JSON
2. Import `n8n-workflow.json` (contains all 4 workflows)
3. Activate all 4 workflows
4. Paste Webhook URL (Workflow 4) into app Settings → n8n Webhook URL

---

## Phase 3 — Deploy Worker API to Cloudflare (~15 minutes)

The Worker is needed for production (so the Google API key is never in the browser).

### Step 10: Install Wrangler + Deploy Worker
```bash
npm install -g wrangler
wrangler login

# Create KV namespace
wrangler kv:namespace create LEADS_KV
# Copy the ID it gives you

# Create wrangler.toml in webapp folder:
cat > webapp/wrangler.toml << 'EOF'
name = "hashtagwebpage-api"
main = "worker.js"
compatibility_date = "2024-01-01"

[[kv_namespaces]]
binding = "LEADS_KV"
id = "PASTE_YOUR_KV_ID_HERE"

[vars]
ALLOWED_ORIGIN = "https://hashtagwebpage.com"
FROM_EMAIL = "hello@yourdomain.com"
EOF

# Set secrets
wrangler secret put GOOGLE_API_KEY
wrangler secret put RESEND_API_KEY

# Deploy
wrangler deploy worker.js
```
Worker live at: `https://hashtagwebpage-api.YOUR_SUBDOMAIN.workers.dev`

Update n8n Variable `WORKER_URL` to this URL.

---

## Phase 4 — Move Supabase to Cloud (When ready)

1. Create project at supabase.com (free tier: 500MB, 50K row reads/day)
2. Project → SQL Editor → paste contents of `supabase/schema.sql` → Run
3. Project → Settings → API → copy URL + anon key
4. Update app Settings → Supabase URL + Key
5. Update n8n Variables → SUPABASE_URL + SUPABASE_KEY
6. Click **Sync Supabase** in Command Center to migrate local leads to cloud
7. Stop local Docker Supabase when ready

---

## Your Day-to-Day as CEO

| Time | What happens automatically |
|------|---------------------------|
| 9am  | n8n searches for new leads, saves to Supabase |
| 6am/12pm/6pm/midnight | n8n emails preview links to ready leads |
| 10am | n8n sends follow-ups, archives cold leads |

**Your manual tasks:**
1. Open dashboard → Command Center (30 seconds to review)
2. Find Leads → search new cities/categories when you want more volume
3. Pipeline → click Generate Site on new leads (then it's automated)
4. Pipeline → add email address to leads that call you back → triggers email

**Your revenue triggers:**
- Business replies/calls → you mark them as Customer → charge $100
- Each customer = $5/mo forever on top

---

## Pricing to Start With

| Tier | Price | You say |
|------|-------|---------|
| Preview | Free | "I built you a free website, take a look" |
| Setup | $100 | "I'll make it live, you get 2 months free hosting" |
| Monthly | $5/mo | "After 2 months, just $5/month to keep it up" |
| Buyout | +$200 | "Pay $200 and you own it, I'll move it to your domain" |

**20 customers = $100 setup × 20 = $2,000 + $100/mo MRR**

---

## Files Reference

| File | Purpose |
|------|---------|
| `index.html` | Admin CRM + CEO Command Center (run locally) |
| `server.js` | Local dev server (start with `node server.js`) |
| `worker.js` | Cloudflare Worker — production API proxy |
| `hashtagwebpage-home.html` | Public marketing homepage |
| `n8n-workflow.json` | 4 automation workflows — import into n8n |
| `supabase/schema.sql` | Database schema (auto-applied by Docker) |
| `supabase/docker-compose.yml` | Local Supabase stack |

---
*Generated by HashtagWebpage setup assistant*
