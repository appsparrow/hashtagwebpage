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
    <p style="font-size:16px;color:#374151;line-height:1.75;margin:0 0 28px">${(hookMessage || `Hi ${businessName} team! We built you a free website preview — take a look:`).replace(/\n/g, "<br>")}</p>
    <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
      <a href="${previewUrl}" style="display:inline-block;background:linear-gradient(135deg,${themePri},${themeAcc});color:white;padding:16px 40px;border-radius:100px;text-decoration:none;font-weight:800;font-size:17px;letter-spacing:-.01em;box-shadow:0 6px 24px rgba(0,0,0,.18)">
        View Your Free Website →
      </a>
    </td></tr></table>
    <p style="font-size:13px;color:#9ca3af;text-align:center;margin:16px 0 0">
      <a href="${previewUrl}" style="color:${themePri};text-decoration:none;font-size:12px">${previewUrl}</a>
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:32px;border-top:1px solid #f0f0f0;padding-top:24px">
      <tr>
        <td width="32%" style="text-align:center;padding:16px 8px;background:#f8fafc;border-radius:10px">
          <div style="font-size:22px;margin-bottom:6px">💰</div>
          <div style="font-weight:800;font-size:18px;color:#111827">$49<span style="font-size:12px;font-weight:400;color:#6b7280">/mo</span></div>
          <div style="font-size:11px;color:#6b7280;margin-top:4px">Keep it live</div>
        </td>
        <td width="4%"></td>
        <td width="60%" style="text-align:center;padding:16px 8px;background:linear-gradient(135deg,${themePri}15,${themeAcc}15);border-radius:10px;border:1px solid ${themePri}30">
          <div style="font-size:22px;margin-bottom:6px">⭐</div>
          <div style="font-weight:800;font-size:18px;color:#111827">$297 <span style="font-size:12px;font-weight:400;color:#6b7280">one-time</span></div>
          <div style="font-size:11px;color:#6b7280;margin-top:4px">Own it forever + custom domain</div>
        </td>
      </tr>
    </table>
    <p style="font-size:13px;color:#9ca3af;margin:24px 0 0;line-height:1.6">
      Just reply to this email or call us to get started. Your site is live now — we just need your go-ahead to keep it that way.
    </p>
  </td></tr>

  <tr><td style="background:#0f172a;padding:20px 32px;text-align:center">
    <p style="color:#64748b;font-size:12px;margin:0">— The HashtagWebpage Team &nbsp;·&nbsp; <a href="https://hashtagwebpage.com" style="color:#94a3b8;text-decoration:none">hashtagwebpage.com</a></p>
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
        subject: `${businessName} — your free website is ready to go live 🚀`,
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
