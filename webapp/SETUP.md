# BizProspector — Complete Setup Guide

## What You're Deploying
- **Dashboard app** (`index.html`) → Cloudflare Pages
- **API Worker** (`worker.js`) → Cloudflare Workers
- **Automation** (`n8n-workflow.json`) → n8n (self-hosted or cloud)

---

## Step 1: Google Places API Key (~10 minutes)

1. Go to https://console.cloud.google.com
2. Click "Select a project" → "New Project" → Name it "BizProspector"
3. Go to **APIs & Services → Library**
4. Search "Places API (New)" → Enable it
5. Go to **APIs & Services → Credentials** → "Create Credentials" → API Key
6. **Restrict the key:**
   - Application restrictions → HTTP referrers
   - Add: `https://bizprospector.pages.dev/*` and `http://localhost:*`
   - API restrictions → restrict to "Places API (New)"
7. Go to **Billing → Budgets & alerts** → Set $30/month alert
8. **Cost estimate:** ~$0.30 per search query (60 results). $20/month = ~4,000 searches.

---

## Step 2: Deploy to Cloudflare (~15 minutes)

### 2a. Create Cloudflare account
Sign up free at https://cloudflare.com

### 2b. Deploy the Dashboard (Cloudflare Pages)
```bash
# Install Wrangler CLI
npm install -g wrangler

# Login
wrangler login

# Deploy Pages (from the bizprospector folder)
wrangler pages deploy . --project-name bizprospector
```
Your dashboard will be live at: `https://bizprospector.pages.dev`

### 2c. Create Cloudflare KV Namespace
```bash
wrangler kv:namespace create LEADS_KV
# Copy the ID it gives you — you'll need it in wrangler.toml
```

### 2d. Deploy the Worker
Create `wrangler.toml` in the same folder:
```toml
name = "bizprospector-api"
main = "worker.js"
compatibility_date = "2024-01-01"

[[kv_namespaces]]
binding = "LEADS_KV"
id = "PASTE_YOUR_KV_ID_HERE"

[vars]
ALLOWED_ORIGIN = "https://bizprospector.pages.dev"
FROM_EMAIL = "you@yourdomain.com"
```

Set secrets (never in wrangler.toml):
```bash
wrangler secret put GOOGLE_API_KEY
# Paste your Google API key when prompted

wrangler secret put RESEND_API_KEY
# Paste your Resend API key when prompted
```

Deploy the Worker:
```bash
wrangler deploy worker.js
```
Your API will be at: `https://bizprospector-api.YOUR_SUBDOMAIN.workers.dev`

### 2e. Update index.html
In `index.html`, find `workerUrl` in the Settings view and update the default to your Worker URL.

---

## Step 3: Email Setup with Resend (~5 minutes)

1. Sign up at https://resend.com (free: 100 emails/day)
2. Add your domain in Resend → follow DNS setup
3. Copy your API key
4. In the BizProspector dashboard → Settings → paste the key

---

## Step 4: n8n Automation (~20 minutes)

### Option A: Self-hosted (free forever)
```bash
docker run -it --rm \
  --name n8n \
  -p 5678:5678 \
  -v ~/.n8n:/home/node/.n8n \
  docker.n8n.io/n8nio/n8n
```
Access at: http://localhost:5678

### Option B: n8n Cloud (free tier: 5 workflows)
Sign up at https://n8n.io/cloud

### Import Workflow
1. Go to n8n → Workflows → Import from JSON
2. Upload `n8n-workflow.json`
3. Update the Worker URL and Resend API key in the HTTP Request nodes
4. Activate the workflow

### What n8n Automates
| Step | Timing | Action |
|------|--------|--------|
| Search | Daily | Finds new businesses without websites |
| Cache | 7 days | Same city+category not re-searched |
| Link Sent | Immediate | Emails preview link to business |
| Follow-up | Day 7 | Sends follow-up email if no response |
| Archive | Day 14 | Marks lead as archived (no response) |

---

## Step 5: Generated Client Websites

When you click "Generate Site" on a lead, a preview HTML is shown. In production, to deploy it live:

```bash
# Each client gets their own Cloudflare Pages deployment
wrangler pages deploy client-site/ --project-name "mike-plumbing-chicago"
# Live at: https://mike-plumbing-chicago.pages.dev
```

The contact form on each site posts to your Worker (`/contact` endpoint) which emails the business owner.

---

## Your Pricing Model

| Tier | Price | What They Get |
|------|-------|---------------|
| Free preview | $0 | They can see their site at a preview URL |
| Setup | $100 | Site goes live, 2 months hosting included |
| Hosting | $5/mo | After the 2 free months |
| Buy outright | +$200 | They own the code, you transfer the deployment |

At 20 customers: $100 setup × 20 = $2,000 + $5 × 20 = $100/mo recurring

---

## Cloudflare Costs (Free Tier Limits)
| Service | Free Limit | Notes |
|---------|------------|-------|
| Workers | 100,000 req/day | More than enough |
| KV reads | 100,000/day | More than enough |
| KV writes | 1,000/day | More than enough |
| Pages | 500 sites | Each client = 1 site |
| Pages bandwidth | Unlimited | ✓ |

**Total infrastructure cost: $0/month until you exceed 500 client sites.**

---

## Security Notes
- Never put your Google API key in `index.html` for production — always route through the Worker
- The Worker URL acts as a secure proxy — clients can't see your API key
- Cloudflare Access can password-protect your dashboard (free tier available)
