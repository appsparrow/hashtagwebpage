/**
 * BizProspector — Cloudflare Worker
 * Handles:
 *   POST /search        — Proxies Google Places API (protects your API key)
 *   POST /contact       — Receives contact form submissions + emails the business
 *   POST /generate      — Triggers website generation via n8n webhook
 *
 * Deploy: wrangler deploy
 * Docs:   https://developers.cloudflare.com/workers/
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // ── CORS headers (allow your Pages domain) ──────────────────────────────
    const corsHeaders = {
      "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN || "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // ── Route: POST /search ─────────────────────────────────────────────────
    // Proxies Google Places API so your API key is never exposed in the browser
    if (url.pathname === "/search" && request.method === "POST") {
      try {
        const { city, category } = await request.json();

        // Check KV cache first — don't re-search same city+category for 7 days
        const cacheKey = `search:${category.toLowerCase()}:${city.toLowerCase().replace(/\s/g, "")}`;
        const cached = await env.LEADS_KV.get(cacheKey, "json");
        if (cached) {
          return new Response(JSON.stringify({ results: cached, cached: true }), {
            headers: { "Content-Type": "application/json", ...corsHeaders }
          });
        }

        // Call Google Places API (New)
        const googleRes = await fetch("https://places.googleapis.com/v1/places:searchText", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": env.GOOGLE_API_KEY,
            "X-Goog-FieldMask": [
              "places.id", "places.displayName", "places.formattedAddress",
              "places.nationalPhoneNumber", "places.rating", "places.userRatingCount",
              "places.websiteUri", "places.googleMapsUri", "places.primaryType"
            ].join(",")
          },
          body: JSON.stringify({
            textQuery: `${category} in ${city}`,
            maxResultCount: 20
          })
        });

        const data = await googleRes.json();
        if (!data.places) {
          return new Response(JSON.stringify({ results: [], error: "No results" }), {
            headers: { "Content-Type": "application/json", ...corsHeaders }
          });
        }

        // Filter: only businesses WITHOUT a website
        const results = data.places
          .filter(p => !p.websiteUri)
          .map(p => ({
            id: p.id,
            name: p.displayName?.text || "Unknown",
            category, city,
            phone: p.nationalPhoneNumber || null,
            address: p.formattedAddress || "",
            rating: p.rating || 0,
            reviewCount: p.userRatingCount || 0,
            mapsUrl: p.googleMapsUri || "#",
            hasWebsite: false,
            stage: "new",
            foundAt: Date.now(),
            sentAt: null, followUpAt: null, convertedAt: null,
            previewUrl: null, email: null, notes: ""
          }));

        // Cache for 7 days (604800 seconds)
        await env.LEADS_KV.put(cacheKey, JSON.stringify(results), { expirationTtl: 604800 });

        return new Response(JSON.stringify({ results, cached: false }), {
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });

      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500, headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
    }

    // ── Route: POST /contact ────────────────────────────────────────────────
    // Receives contact form from a generated business website → emails the business
    if (url.pathname === "/contact" && request.method === "POST") {
      try {
        const formData = await request.formData();
        const businessEmail = formData.get("business_email");
        const businessName  = formData.get("business_name");
        const senderName    = formData.get("name");
        const senderPhone   = formData.get("phone");
        const senderEmail   = formData.get("email");
        const message       = formData.get("message");

        if (!businessEmail) {
          return new Response("Missing business email", { status: 400 });
        }

        // Send email via Resend.com
        const emailRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${env.RESEND_API_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            from: env.FROM_EMAIL || "noreply@bizprospector.com",
            to: [businessEmail],
            subject: `New inquiry for ${businessName} via your website`,
            html: `
              <h2>New Contact Form Submission</h2>
              <p><strong>From:</strong> ${senderName}</p>
              <p><strong>Phone:</strong> ${senderPhone}</p>
              <p><strong>Email:</strong> ${senderEmail || "Not provided"}</p>
              <hr/>
              <p><strong>Message:</strong></p>
              <p>${message}</p>
              <hr/>
              <p style="color: #888; font-size: 12px;">Sent via your website hosted by BizProspector</p>
            `
          })
        });

        if (!emailRes.ok) {
          throw new Error("Email delivery failed");
        }

        // Redirect to thank-you (same page with ?sent=1 for now)
        return Response.redirect(request.headers.get("Referer") + "?sent=1", 302);

      } catch (err) {
        return new Response("Failed to send. Please call us directly.", { status: 500 });
      }
    }

    // ── Route: POST /generate ───────────────────────────────────────────────
    // Stores a lead and optionally triggers n8n workflow
    if (url.pathname === "/generate" && request.method === "POST") {
      try {
        const lead = await request.json();
        const key = `lead:${lead.id}`;
        await env.LEADS_KV.put(key, JSON.stringify(lead));

        // Optionally trigger n8n
        if (env.N8N_WEBHOOK_URL) {
          fetch(env.N8N_WEBHOOK_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ event: "lead_generated", lead })
          });
        }

        return new Response(JSON.stringify({ ok: true }), {
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500, headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
    }

    return new Response("Not found", { status: 404 });
  }
};

/**
 * wrangler.toml setup:
 *
 * name = "bizprospector-api"
 * main = "worker.js"
 * compatibility_date = "2024-01-01"
 *
 * [[kv_namespaces]]
 * binding = "LEADS_KV"
 * id = "YOUR_KV_NAMESPACE_ID"
 *
 * [vars]
 * ALLOWED_ORIGIN = "https://bizprospector.pages.dev"
 *
 * # Secrets (set via: wrangler secret put GOOGLE_API_KEY)
 * # GOOGLE_API_KEY
 * # RESEND_API_KEY
 * # FROM_EMAIL
 * # N8N_WEBHOOK_URL (optional)
 */
