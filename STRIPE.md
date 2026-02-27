# Stripe Integration Plan

## Pricing
- **$49/month** — hosting subscription (recurring)
- **$297 one-time** — full ownership + custom domain setup

---

## Phase 1 — Stripe Payment Links (zero code, do this now)

No webhook needed to start collecting money.

1. Go to [stripe.com](https://stripe.com) → Payment Links
2. Create two products:
   - "HashtagWebpage Monthly" — $49/month recurring
   - "HashtagWebpage One-Time" — $297 one-time
3. Generate a Payment Link for each
4. Add both URLs to CRM Settings (add two fields: `stripeMonthlyUrl`, `stripeOneTimeUrl`)
5. In Send Preview modal, add payment buttons that open these links

The business owner pays on Stripe's hosted page. You manually flip the lead to `customer`
in the CRM after you see the payment in Stripe dashboard.

This works immediately. No code, no webhook, no server.

---

## Phase 2 — Stripe Webhook (auto-promote to customer)

When ready to automate, the `stripe-webhook` Supabase Edge Function:

1. Receives `checkout.session.completed` event from Stripe
2. Verifies webhook signature with `STRIPE_WEBHOOK_SECRET`
3. Extracts lead ID from `metadata.lead_id` (pass this when creating Stripe session)
4. Updates `leads` table: `stage = 'customer'`, `converted_at = now()`
5. CRM Supabase real-time subscription fires → lead card turns green automatically

### Stripe Checkout Session with lead metadata

When you're ready to create programmatic Stripe sessions (Phase 2+):

```javascript
// Create a Stripe Checkout session from the CRM
const session = await stripe.checkout.sessions.create({
  mode: 'subscription',
  line_items: [{ price: 'price_49_monthly', quantity: 1 }],
  success_url: `${previewUrl}?paid=true`,
  cancel_url: previewUrl,
  customer_email: lead.email,
  metadata: { lead_id: lead.id }  // ← passed back in webhook
});
```

---

## Send Preview Modal — Payment Buttons (add in next sprint)

```
┌─────────────────────────────────────────────────┐
│  💳 Ready to go live?                           │
│                                                  │
│  [$49/month — Keep it live ↗]                   │
│  [$297 one-time — Own it forever ↗]              │
│                                                  │
│  Links open Stripe's secure payment page        │
└─────────────────────────────────────────────────┘
```

Both buttons open `stripeMonthlyUrl` / `stripeOneTimeUrl` from Settings.
Store these in the CRM Settings panel so you can update them without a code push.

---

## CRM Settings Fields to Add

```javascript
stripeMonthlyUrl:  settings.stripeMonthlyUrl  || "",
stripeOneTimeUrl:  settings.stripeOneTimeUrl  || "",
```

UI: two URL input fields in a new "💳 Stripe Payments" section in Settings.
