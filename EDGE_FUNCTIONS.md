# Supabase Edge Functions

Three functions. All Deno (TypeScript). Deployed via Supabase CLI.

---

## send-email

**URL:** `{SUPABASE_URL}/functions/v1/send-email`
**Auth:** Bearer `{access_token or SUPABASE_ANON_KEY}`
**Secret needed:** `RESEND_API_KEY`

Called by the CRM when you click Send Preview → Send Email.
Builds a full HTML email and sends via Resend API.

**Payload:**
```json
{
  "to": "owner@business.com",
  "businessName": "Mike's Plumbing",
  "previewUrl": "https://hashtagwebpage.com/mikes-plumbing-chicago-il",
  "hookMessage": "Your site is ready!"
}
```

---

## deploy-site

**URL:** `{SUPABASE_URL}/functions/v1/deploy-site`
**Auth:** Bearer `{access_token or SUPABASE_ANON_KEY}`
**Secrets needed:** none (credentials passed in body)

Called by the CRM when you click Generate Site. Proxies the GitHub Contents API
server-side to avoid browser CORS issues. Returns the live site URL.

**Payload:**
```json
{
  "slug": "mikes-plumbing-chicago-il",
  "html": "<!DOCTYPE html>...",
  "githubOwner": "appsparrow",
  "githubRepo": "hashtagwebpage",
  "githubToken": "github_pat_xxxx",
  "cfPagesDomain": "hashtagwebpage.com"
}
```

**Response:**
```json
{ "url": "https://hashtagwebpage.com/mikes-plumbing-chicago-il" }
```

---

## stripe-webhook

**URL:** `{SUPABASE_URL}/functions/v1/stripe-webhook`
**Auth:** Stripe `Stripe-Signature` header (no Bearer token needed)
**Secrets needed:** `STRIPE_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`

Called by Stripe when a payment succeeds. Verifies the Stripe signature,
then updates the lead's stage to `customer` in Supabase.

---

## Deploy Commands

```bash
# 1. Install Supabase CLI (if not installed)
npm install -g supabase

# 2. Login
supabase login

# 3. Link to your project (project ref is in the Supabase dashboard URL)
supabase link --project-ref scrtgfjleifxldpceyrg

# 4. Set secrets (never committed to git)
supabase secrets set RESEND_API_KEY=re_SyYHPAjP_KryYbv4Zp4tqWxUTauxVuSZ3
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxx
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...  # service role key from Supabase → Settings → API

# 5. Deploy all three functions
supabase functions deploy send-email --no-verify-jwt
supabase functions deploy deploy-site --no-verify-jwt
supabase functions deploy stripe-webhook --no-verify-jwt
```

> `--no-verify-jwt` lets the CRM call these functions with the anon key or access token.
> `stripe-webhook` verifies its own Stripe signature so JWT is not needed there either.

---

## Re-deploy After Changes

```bash
# Edit the .ts file, then:
supabase functions deploy deploy-site --no-verify-jwt
# Changes go live in ~10 seconds. No CF Pages rebuild needed.
```

---

## Stripe Webhook Setup

1. stripe.com → Developers → Webhooks → Add endpoint
2. URL: `https://scrtgfjleifxldpceyrg.supabase.co/functions/v1/stripe-webhook`
3. Events to listen for:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
4. Copy signing secret → `supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_xxx`
