// supabase/functions/deploy-site/index.ts
// Proxies GitHub Contents API from the server side, avoiding any browser CORS issues.
// Called by the CRM when "Generate Site" is clicked.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...CORS, "Content-Type": "application/json" }
    });
  }

  let body: {
    slug: string;
    html: string;
    githubOwner: string;
    githubRepo: string;
    githubToken: string;
    cfPagesDomain?: string;
  };

  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400, headers: { ...CORS, "Content-Type": "application/json" }
    });
  }

  const { slug, html, githubOwner, githubRepo, githubToken, cfPagesDomain } = body;

  // Validate required fields
  if (!slug || !html || !githubOwner || !githubRepo || !githubToken) {
    return new Response(JSON.stringify({ error: "Missing required fields: slug, html, githubOwner, githubRepo, githubToken" }), {
      status: 400, headers: { ...CORS, "Content-Type": "application/json" }
    });
  }

  const filePath = `webapp/sites/${slug}/index.html`;
  const apiUrl   = `https://api.github.com/repos/${githubOwner}/${githubRepo}/contents/${filePath}`;
  const ghHeaders = {
    "Authorization":        `Bearer ${githubToken}`,
    "Accept":               "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type":         "application/json",
    "User-Agent":           "HashtagWebpage-CRM",
  };

  // GET existing file SHA (required when updating an existing file)
  let sha: string | null = null;
  try {
    const getRes = await fetch(apiUrl, { headers: ghHeaders });
    if (getRes.ok) {
      const existing = await getRes.json();
      sha = existing.sha ?? null;
    }
    // 404 = new file, that's fine
  } catch (e) {
    console.error("SHA fetch error:", e);
    // Continue — if the file doesn't exist yet, sha stays null
  }

  // Base64-encode the HTML (chunked to avoid call-stack overflow on large files)
  const encoder   = new TextEncoder();
  const bytes     = encoder.encode(html);
  let   binary    = "";
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  const b64 = btoa(binary);

  // PUT file to GitHub
  const putRes = await fetch(apiUrl, {
    method: "PUT",
    headers: ghHeaders,
    body: JSON.stringify({
      message: `Deploy: ${slug}`,
      content: b64,
      ...(sha ? { sha } : {}),
    }),
  });

  if (!putRes.ok) {
    let errMsg = `GitHub API error ${putRes.status}`;
    try {
      const errBody = await putRes.json();
      errMsg = errBody.message || errMsg;
    } catch { /* ignore */ }
    return new Response(JSON.stringify({ error: errMsg }), {
      status: putRes.status, headers: { ...CORS, "Content-Type": "application/json" }
    });
  }

  const domain = (cfPagesDomain || "hashtagwebpage.com").replace(/^https?:\/\//, "");
  const productionUrl = `https://${domain}/${slug}`;

  return new Response(JSON.stringify({ url: productionUrl }), {
    status: 200, headers: { ...CORS, "Content-Type": "application/json" }
  });
});
