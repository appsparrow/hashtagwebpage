// Supabase Edge Function: send-email
// Receives email payload from CRM browser, calls Resend API server-side
// Deploy: supabase functions deploy send-email --no-verify-jwt

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
    const {
      to, businessName, previewUrl,
      hookMessage = "", category = "", city = "", phone = "",
      rating = 0, reviews = 0,
      themePri = "#4f46e5", themeSec = "#3730a3",
      themeAcc = "#818cf8", themeIcon = "⭐"
    } = await req.json();

    if (!to || !businessName || !previewUrl) {
      return new Response(
        JSON.stringify({ ok: false, error: "Missing required fields: to, businessName, previewUrl" }),
        { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) {
      return new Response(
        JSON.stringify({ ok: false, error: "RESEND_API_KEY secret not set. Run: supabase secrets set RESEND_API_KEY=re_xxx" }),
        { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    const starsHtml = rating > 0
      ? `<span style="color:#fbbf24;letter-spacing:2px;font-size:1.1rem">${"★".repeat(Math.round(+rating))}${"☆".repeat(5 - Math.round(+rating))}</span>&nbsp;<strong style="color:white">${(+rating).toFixed(1)}</strong>&nbsp;<span style="opacity:.75;color:white">· ${reviews} Google reviews</span>`
      : "";

    const emailHtml = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Helvetica Neue',Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 0">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;border-radius:16px;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,.15)">

  <tr><td style="background:linear-gradient(135deg,${themePri} 0%,${themeSec} 100%);padding:48px 32px;text-align:center">
    <div style="display:inline-block;background:rgba(255,255,255,.18);border:1px solid rgba(255,255,255,.35);padding:5px 16px;border-radius:100px;font-size:11px;font-weight:700;color:white;letter-spacing:.08em;text-transform:uppercase;margin-bottom:18px">
      ${themeIcon}&nbsp;&nbsp;${category || "Local Business"}
    </div>
    <div style="font-size:32px;font-weight:900;color:white;letter-spacing:-.03em;margin-bottom:8px;line-height:1.1">${businessName}</div>
    <div style="font-size:14px;color:rgba(255,255,255,.82);margin-bottom:${rating > 0 ? "16px" : "0"}">${city || ""}</div>
    ${rating > 0 ? `<div style="display:inline-flex;align-items:center;gap:8px;background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.25);padding:7px 18px;border-radius:100px;font-size:13px">${starsHtml}</div>` : ""}
  </td></tr>

  <tr><td style="background:white;padding:14px 24px;border-bottom:1px solid #f0f0f0">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td align="center" style="font-size:11px;font-weight:600;color:#374151;padding:2px 8px">✅ Licensed & Insured</td>
      <td align="center" style="font-size:11px;font-weight:600;color:#374151;padding:2px 8px">📍 ${city || "Local"}</td>
      <td align="center" style="font-size:11px;font-weight:600;color:#374151;padding:2px 8px">💬 Free Estimates</td>
      <td align="center" style="font-size:11px;font-weight:600;color:#374151;padding:2px 8px">⚡ Fast Response</td>
    </tr></table>
  </td></tr>

  <tr><td style="background:white;padding:36px 32px">
    <p style="font-size:15px;color:#374151;line-height:1.75;margin:0 0 8px;font-weight:600">Hi there,</p>
    <p style="font-size:15px;color:#374151;line-height:1.75;margin:0 0 28px">I noticed ${businessName} could use a stronger web presence, so I took the liberty of building a professional starter preview — completely free.</p>
    <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
      <a href="${previewUrl}" style="display:inline-block;background:linear-gradient(135deg,${themePri},${themeAcc});color:white;padding:16px 40px;border-radius:100px;text-decoration:none;font-weight:800;font-size:17px;letter-spacing:-.01em;box-shadow:0 6px 24px rgba(0,0,0,.18)">
        👀 See Your Free Website →
      </a>
    </td></tr></table>
    <p style="font-size:15px;color:#374151;line-height:1.75;margin:28px 0 0">How this works:</p>
    <ul style="font-size:14px;color:#374151;line-height:1.8;margin:10px 0 28px 20px;padding:0">
      <li style="margin-bottom:8px">✅ Love it? Own it for a one-time fee of <strong>$299</strong> — no monthly charges, ever.</li>
      <li style="margin-bottom:8px">✏️ Want changes? Just reply to this email — tweaks are free.</li>
      <li>❌ Not interested? Click 'Not the right fit?' on the preview page and we'll delete it immediately.</li>
    </ul>
    <p style="font-size:14px;color:#374151;line-height:1.75;margin:0">No credit cards. No invoices. No follow-up spam. Just a free website, on us.</p>
    <p style="font-size:14px;color:#374151;line-height:1.75;margin:20px 0 0">— The HashtagWebpage Team<br/><a href="https://hashtagwebpage.com" style="color:${themePri};text-decoration:none">hashtagwebpage.com</a></p>
  </td></tr>

  <tr><td style="background:#0f172a;padding:20px 32px;text-align:center">
    <p style="color:#64748b;font-size:12px;margin:0;opacity:.7">This is a free preview built for ${businessName}. Not interested? Let us know from the preview page.</p>
  </td></tr>

</table>
</td></tr>
</table>
</body></html>`;

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendKey}`,
        "Content-Type":  "application/json",
      },
      body: JSON.stringify({
        from:    "contact@hashtagwebpage.com",
        to:      [to],
        subject: `I built a starter website for ${businessName} — take a look?`,
        html:    emailHtml,
      }),
    });

    const data = await resendRes.json();
    const ok   = resendRes.status === 200 || resendRes.status === 201;

    return new Response(
      JSON.stringify({ ok, ...data }),
      { status: ok ? 200 : resendRes.status, headers: { ...CORS, "Content-Type": "application/json" } }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: (err as Error).message }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }
});
