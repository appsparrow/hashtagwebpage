// Supabase Edge Function: survey-response
// Receives "Not Interested?" survey responses from preview sites
// Updates lead stage based on reason + stores note
// Deploy: supabase functions deploy survey-response --no-verify-jwt

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  // Handle preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  try {
    const { slug, reason, note } = await req.json();

    if (!slug || !reason) {
      return new Response(
        JSON.stringify({ ok: false, error: "Missing required fields: slug, reason" }),
        { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    // Map reason to stage
    const stageMap = {
      timing:     "not_interested_timing",
      competitor: "not_interested_competitor",
      no_need:    "not_interested_no_need",
      other:      "not_interested_other",
    };

    const newStage = stageMap[reason];
    if (!newStage) {
      return new Response(
        JSON.stringify({ ok: false, error: `Invalid reason: ${reason}` }),
        { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    // Get Supabase credentials from environment
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ ok: false, error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }),
        { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    // Lookup lead by preview_url containing the slug
    const lookupUrl = `${supabaseUrl}/rest/v1/leads?preview_url=ilike.%${slug}%`;
    const lookupRes = await fetch(lookupUrl, {
      headers: {
        "apikey":       supabaseServiceKey,
        "Authorization": `Bearer ${supabaseServiceKey}`,
      },
    });

    if (!lookupRes.ok) {
      return new Response(
        JSON.stringify({ ok: false, error: `Lookup failed: ${lookupRes.status}` }),
        { status: lookupRes.status, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    const leads = await lookupRes.json();
    if (!leads || leads.length === 0) {
      return new Response(
        JSON.stringify({ ok: false, error: `No lead found with slug: ${slug}` }),
        { status: 404, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    const lead = leads[0];
    const leadId = lead.id;

    // Build updated notes (prepend with timestamp)
    const timestamp = new Date().toISOString();
    const noteText = note ? `[${timestamp}] ${note}` : `[${timestamp}] Survey response: ${reason}`;
    const existingNotes = lead.notes || "";
    const updatedNotes = existingNotes ? `${noteText}\n${existingNotes}` : noteText;

    // Update the lead with new stage and notes
    const updateUrl = `${supabaseUrl}/rest/v1/leads?id=eq.${leadId}`;
    const updateRes = await fetch(updateUrl, {
      method: "PATCH",
      headers: {
        "apikey":       supabaseServiceKey,
        "Authorization": `Bearer ${supabaseServiceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        stage: newStage,
        notes: updatedNotes,
      }),
    });

    if (!updateRes.ok) {
      return new Response(
        JSON.stringify({ ok: false, error: `Update failed: ${updateRes.status}` }),
        { status: updateRes.status, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, leadId, stage: newStage }),
      { status: 200, headers: { ...CORS, "Content-Type": "application/json" } }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: (err as Error).message }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }
});
