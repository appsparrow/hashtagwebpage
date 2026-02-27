# Supabase Edge Functions

Two functions. Both are Deno (TypeScript). Deployed via Supabase CLI.

---

## send-email

**URL:** `{SUPABASE_URL}/functions/v1/send-email`
**Auth:** Bearer `{SUPABASE_ANON_KEY}` (same key used for DB)
**Secret needed:** `RESEND_API_KEY`

Called by the CRM when you click Send Email in the Send Preview modal.
Builds the full HTML email template and sends via Resend.

---

## stripe-webhook

**URL:** `{SUPABASE_URL}/functions/v1/stripe-webhook`
**Auth:** Stripe signature header (no Bearer token)
**Secrets needed:** `STRIPE_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`

Called by Stripe when a payment succeeds. Updates the lead's stage to `customer`
in Supabase and stores the Stripe customer/subscription ID.

---

## Deploy Commands (run once, then re-run when you update)

```bash
# 1. Install Supabase CLI (if not installed)
npm install -g supabase

# 2. Login
supabase login

# 3. Link to your cloud project (get project-ref from supabase.com dashboard URL)
supabase link --project-ref abcdefghijklmnop

# 4. Set secrets (never committed to git)
supabase secrets set RESEND_API_KEY=re_xxxxxxxxxxxx
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxx
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...  # from Supabase dashboard → Settings → API

# 5. Deploy functions
supabase functions deploy send-email --no-verify-jwt
supabase functions deploy stripe-webhook --no-verify-jwt
```

> `--no-verify-jwt` on send-email allows the CRM (with anon key) to call it.
> stripe-webhook verifies its own signature so JWT is not needed there either.

---

## Stripe Webhook Setup

1. Go to stripe.com → Developers → Webhooks → Add endpoint
2. URL: `{SUPABASE_URL}/functions/v1/stripe-webhook`
3. Events to listen for:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
4. Copy the webhook signing secret → `supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_xxx`

---

## Update a function

```bash
# Edit the file, then:
supabase functions deploy send-email
```

Changes go live in ~10 seconds. No CF Pages deployment needed.
