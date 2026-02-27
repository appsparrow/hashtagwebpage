// Supabase Edge Function: stripe-webhook
// Receives Stripe payment events, updates lead stage to "customer"
// Deploy: supabase functions deploy stripe-webhook --no-verify-jwt
//
// Stripe Dashboard → Webhooks → Add endpoint:
//   URL: {SUPABASE_URL}/functions/v1/stripe-webhook
//   Events: checkout.session.completed, customer.subscription.created,
//           customer.subscription.deleted, invoice.payment_succeeded

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

// Verify Stripe webhook signature using Web Crypto API (Deno-compatible)
async function verifyStripeSignature(payload: string, sigHeader: string, secret: string): Promise<boolean> {
  try {
    const parts = sigHeader.split(",").reduce((acc: Record<string, string>, part) => {
      const [k, v] = part.split("=");
      acc[k] = v;
      return acc;
    }, {});
    const timestamp = parts["t"];
    const sig       = parts["v1"];
    if (!timestamp || !sig) return false;

    const signedPayload = `${timestamp}.${payload}`;
    const key = await crypto.subtle.importKey(
      "raw", new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
    );
    const signatureBytes = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signedPayload));
    const expectedSig = Array.from(new Uint8Array(signatureBytes)).map(b => b.toString(16).padStart(2, "0")).join("");
    return expectedSig === sig;
  } catch {
    return false;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const webhookSecret      = Deno.env.get("STRIPE_WEBHOOK_SECRET") || "";
  const serviceRoleKey     = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const supabaseUrl        = Deno.env.get("SUPABASE_URL") || "";

  const body    = await req.text();
  const sigHeader = req.headers.get("stripe-signature") || "";

  // Verify signature if secret is configured
  if (webhookSecret) {
    const valid = await verifyStripeSignature(body, sigHeader, webhookSecret);
    if (!valid) {
      console.error("[stripe-webhook] Invalid signature");
      return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 400 });
    }
  }

  let event: { type: string; data: { object: Record<string, unknown> } };
  try {
    event = JSON.parse(body);
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
  }

  console.log(`[stripe-webhook] Event: ${event.type}`);

  // Only process payment success events
  const paymentEvents = [
    "checkout.session.completed",
    "invoice.payment_succeeded",
  ];

  if (!paymentEvents.includes(event.type)) {
    return new Response(JSON.stringify({ received: true, action: "ignored" }), {
      headers: { ...CORS, "Content-Type": "application/json" }
    });
  }

  const session = event.data.object;
  const leadId  = (session.metadata as Record<string, string>)?.lead_id;
  const customerId     = session.customer as string;
  const subscriptionId = session.subscription as string;
  const amountTotal    = session.amount_total as number;

  if (!leadId) {
    console.warn("[stripe-webhook] No lead_id in metadata — update lead manually in CRM");
    return new Response(JSON.stringify({ received: true, action: "no_lead_id" }), {
      headers: { ...CORS, "Content-Type": "application/json" }
    });
  }

  // Update lead in Supabase
  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const { error } = await supabase
    .from("leads")
    .update({
      stage:           "customer",
      converted_at:    Date.now(),
      follow_up_at:    null,
      notes: `Payment received via Stripe. Customer ID: ${customerId || "N/A"}. Amount: $${((amountTotal || 0) / 100).toFixed(2)}`,
    })
    .eq("id", leadId);

  if (error) {
    console.error("[stripe-webhook] Supabase update failed:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  console.log(`[stripe-webhook] ✅ Lead ${leadId} promoted to customer`);
  return new Response(
    JSON.stringify({ received: true, action: "lead_converted", leadId }),
    { headers: { ...CORS, "Content-Type": "application/json" } }
  );
});
