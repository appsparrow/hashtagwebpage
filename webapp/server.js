/**
 * HashtagWebpage — Local Development Server
 * No npm install needed — uses only Node.js built-in modules.
 *
 * Run: node server.js
 * Then open: http://localhost:3000
 *
 * What this does:
 *   GET  /           → serves index.html
 *   POST /api/search → proxies Google Places API (keeps your key off the browser)
 *   POST /api/contact → receives contact form, prints to console (no email locally)
 */

const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const url = require("url");

// Flexible HTTP/HTTPS request helper — supports string and Buffer bodies
function httpRequest(targetUrl, method, headers, body) {
  return new Promise((resolve, reject) => {
    const parsed = new url.URL(targetUrl);
    const isHttps = parsed.protocol === "https:";
    const lib = isHttps ? https : http;
    const bodyBuf = body instanceof Buffer ? body
      : typeof body === "string" ? Buffer.from(body)
      : Buffer.from(JSON.stringify(body || ""));
    const options = {
      hostname: parsed.hostname,
      port: parsed.port || (isHttps ? 443 : 80),
      path: parsed.pathname + (parsed.search || ""),
      method,
      headers: { ...headers, "Content-Length": bodyBuf.length }
    };
    const req = lib.request(options, res => {
      const chunks = [];
      res.on("data", c => chunks.push(c));
      res.on("end", () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString() }));
    });
    req.on("error", reject);
    req.write(bodyBuf);
    req.end();
  });
}

// Build multipart/form-data body (Buffer) for Cloudflare Pages file upload
function buildMultipart(boundary, fields, files) {
  const CRLF = "\r\n";
  const parts = [];
  for (const [name, value] of Object.entries(fields)) {
    parts.push(Buffer.from(`--${boundary}${CRLF}Content-Disposition: form-data; name="${name}"${CRLF}${CRLF}${value}${CRLF}`));
  }
  for (const [name, { filename, contentType, data }] of Object.entries(files)) {
    parts.push(Buffer.from(`--${boundary}${CRLF}Content-Disposition: form-data; name="${name}"; filename="${filename}"${CRLF}Content-Type: ${contentType}${CRLF}${CRLF}`));
    parts.push(data instanceof Buffer ? data : Buffer.from(data));
    parts.push(Buffer.from(CRLF));
  }
  parts.push(Buffer.from(`--${boundary}--${CRLF}`));
  return Buffer.concat(parts);
}

// ── Config ────────────────────────────────────────────────────────────────────
const PORT = 3000;
// Put your Google API key here OR set the GOOGLE_API_KEY environment variable:
// GOOGLE_API_KEY=AIzaSy... node server.js
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || "AIzaSyC__U7ow7tDJbYn3EzR3aeNA4_VTPQqZuI";

// ── Helpers ───────────────────────────────────────────────────────────────────
function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

// Simple in-memory cache (city+category → results, expires after 7 days)
const searchCache = new Map();
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000;

// ── Server ────────────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // CORS headers for local dev
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204); res.end(); return;
  }

  // ── Serve static files ─────────────────────────────────────────────────────
  if (req.method === "GET" && (pathname === "/" || pathname === "/index.html")) {
    const filePath = path.join(__dirname, "index.html");
    fs.readFile(filePath, (err, data) => {
      if (err) { res.writeHead(404); res.end("Not found"); return; }
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(data);
    });
    return;
  }

  // ── POST /api/search — Google Places proxy ─────────────────────────────────
  if (req.method === "POST" && pathname === "/api/search") {
    try {
      const body = JSON.parse(await readBody(req));
      const { city, category, googleApiKey: bodyApiKey } = body;

      if (!city || !category) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "city and category are required" }));
        return;
      }

      // Key priority: from Settings UI → env var → hardcoded fallback
      const apiKey = (bodyApiKey || "").trim() || GOOGLE_API_KEY;
      if (!apiKey || apiKey === "YOUR_GOOGLE_API_KEY_HERE") {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "No Google API key. Go to Settings → Google Places API and add your key." }));
        return;
      }

      const cacheKey = `${category.toLowerCase()}::${city.toLowerCase().trim()}`;
      const cached = searchCache.get(cacheKey);
      if (cached && Date.now() - cached.ts < CACHE_TTL) {
        console.log(`[CACHE HIT] ${category} in ${city}`);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ results: cached.data, cached: true, count: cached.data.length }));
        return;
      }

      console.log(`[SEARCH] ${category} in ${city} → calling Google Places API...`);

      const fieldMask = [
        "places.id", "places.displayName", "places.formattedAddress",
        "places.nationalPhoneNumber", "places.rating", "places.userRatingCount",
        "places.websiteUri", "places.googleMapsUri", "places.primaryType"
      ].join(",");

      const googleBody = JSON.stringify({
        textQuery: `${category} in ${city}`,
        maxResultCount: 20
      });

      const googleRes = await httpRequest(
        "https://places.googleapis.com/v1/places:searchText",
        "POST",
        {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": fieldMask,
          "Referer": "https://hashtagwebpage.com"   // needed when key has HTTP referrer restrictions
        },
        googleBody
      );

      const data = JSON.parse(googleRes.body);
      console.log(`[SEARCH] Google raw response (status ${googleRes.status}):`, JSON.stringify(data).slice(0, 600));

      if (!data.places) {
        // Return the raw Google error so the UI can show it
        const googleErr = data.error?.message || data.error_message || JSON.stringify(data).slice(0, 200);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ results: [], count: 0, message: "No results from Google", googleError: googleErr }));
        return;
      }

      const results = data.places
        .filter(p => !p.websiteUri)
        .map(p => ({
          id: p.id,
          name: p.displayName?.text || "Unknown Business",
          category, city,
          phone: p.nationalPhoneNumber || null,
          address: p.formattedAddress || "",
          rating: p.rating || 0,
          reviewCount: p.userRatingCount || 0,
          hasWebsite: false,
          stage: "new",
          mapsUrl: p.googleMapsUri || "#",
          foundAt: Date.now(),
          sentAt: null, followUpAt: null, convertedAt: null,
          previewUrl: null, email: null, notes: ""
        }));

      console.log(`[SEARCH] Found ${data.places.length} total, ${results.length} without websites`);

      // Cache the result
      searchCache.set(cacheKey, { data: results, ts: Date.now() });

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ results, count: results.length, cached: false }));

    } catch (err) {
      console.error("[SEARCH ERROR]", err.message);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // ── POST /api/contact — contact form handler ───────────────────────────────
  if (req.method === "POST" && pathname === "/api/contact") {
    try {
      const body = JSON.parse(await readBody(req));
      console.log("\n📧 CONTACT FORM SUBMISSION:");
      console.log("  Business:", body.business_name);
      console.log("  To:", body.business_email);
      console.log("  From:", body.name, "<" + body.email + ">");
      console.log("  Phone:", body.phone);
      console.log("  Message:", body.message);
      console.log("  (In production this would be emailed via Resend)\n");

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, message: "Contact form received (logged to console in dev mode)" }));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // ── POST /api/add-lead — n8n adds a discovered lead ───────────────────────
  if (req.method === "POST" && pathname === "/api/add-lead") {
    try {
      const lead = JSON.parse(await readBody(req));
      // Read existing leads file, append, save back
      const leadsFile = path.join(__dirname, "leads.json");
      let leads = [];
      try { leads = JSON.parse(fs.readFileSync(leadsFile, "utf8")); } catch {}
      if (!leads.find(l => l.id === lead.id)) {
        leads.push(lead);
        fs.writeFileSync(leadsFile, JSON.stringify(leads, null, 2));
        console.log(`[LEAD ADDED] ${lead.name} — ${lead.city}`);
      } else {
        console.log(`[LEAD EXISTS] ${lead.name} — skipping`);
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, total: leads.length }));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // ── GET /api/leads — dashboard polls for n8n-added leads ──────────────────
  if (req.method === "GET" && pathname === "/api/leads") {
    try {
      const leadsFile = path.join(__dirname, "leads.json");
      let leads = [];
      try { leads = JSON.parse(fs.readFileSync(leadsFile, "utf8")); } catch {}
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ leads }));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // ── POST /api/update-lead — n8n updates a lead's stage ────────────────────
  if (req.method === "POST" && pathname === "/api/update-lead") {
    try {
      const update = JSON.parse(await readBody(req));
      const leadsFile = path.join(__dirname, "leads.json");
      let leads = [];
      try { leads = JSON.parse(fs.readFileSync(leadsFile, "utf8")); } catch {}
      leads = leads.map(l => l.id === update.id ? { ...l, ...update } : l);
      fs.writeFileSync(leadsFile, JSON.stringify(leads, null, 2));
      console.log(`[LEAD UPDATED] ${update.id} → stage: ${update.stage || "unchanged"}`);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // ── POST /api/n8n-trigger — trigger n8n webhook ────────────────────────────
  if (req.method === "POST" && pathname === "/api/n8n-trigger") {
    try {
      const body = JSON.parse(await readBody(req));
      const webhookUrl = body.webhookUrl;
      const payload = body.payload;

      if (!webhookUrl) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "webhookUrl required" }));
        return;
      }

      const result = await httpRequest(
        webhookUrl,
        "POST",
        { "Content-Type": "application/json" },
        JSON.stringify(payload)
      );

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, n8nResponse: result.body }));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // ── Shared deploy helper (used by /api/deploy and /api/deploy-home) ──────────
  // V2 Cloudflare Pages Direct Upload:
  //   1. Create/verify project
  //   2. POST manifest-only → get upload JWT + deployment ID
  //   3. Upload new file bytes to upload.workers.cloudflare.com
  //   4. POST /deployments/{id}/finalize → makes deployment go live
  async function cfDeploy({ cfAccountId, cfApiToken, cfProjectName, manifest, filesToUpload }) {
    const crypto = require("crypto");
    const authHeaders = { "Authorization": `Bearer ${cfApiToken}`, "Content-Type": "application/json" };
    const baseUrl = `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/pages/projects`;

    // Step 1: Create project if it doesn't exist
    console.log(`[DEPLOY] Checking/creating project: ${cfProjectName}`);
    const createRes = await httpRequest(`${baseUrl}`, "POST", authHeaders,
      JSON.stringify({ name: cfProjectName, production_branch: "main" }));
    const createData = JSON.parse(createRes.body);
    if (createRes.status !== 200 && createRes.status !== 201 &&
        !createData.errors?.some(e => e.code === 8000026)) {
      console.log("[DEPLOY] Project note:", createData.errors?.[0]?.message || "Unknown");
    } else {
      console.log(`[DEPLOY] Project OK`);
    }

    // Step 2: POST manifest-only to create deployment (V2)
    console.log(`[DEPLOY] Posting manifest (${Object.keys(manifest).length} files)...`);
    const boundary = "HWDeploy" + Date.now();
    const manifestBody = buildMultipart(boundary, { manifest: JSON.stringify(manifest) }, {});
    const deployRes = await httpRequest(
      `${baseUrl}/${cfProjectName}/deployments`, "POST",
      { "Authorization": `Bearer ${cfApiToken}`, "Content-Type": `multipart/form-data; boundary=${boundary}` },
      manifestBody
    );
    const deployData = JSON.parse(deployRes.body);
    console.log(`[DEPLOY] Deploy response ${deployRes.status}:`, JSON.stringify(deployData).slice(0, 400));
    if (!deployData.success) {
      throw new Error(deployData.errors?.map(e => e.message).join(", ") || "Deployment creation failed");
    }

    const deploymentId = deployData.result?.id;

    // Step 3: Upload new/changed file bytes using JWT from CF
    const uploadJwt = deployData.result?.jwt;
    if (uploadJwt && filesToUpload.length > 0) {
      console.log(`[DEPLOY] Uploading ${filesToUpload.length} file(s)...`);
      const payload = filesToUpload.map(({ hash, html }) => ({
        key: hash,
        value: Buffer.from(html).toString("base64"),
        metadata: { contentType: "text/html" },
        base64: true,
      }));
      const uploadRes = await httpRequest(
        "https://upload.workers.cloudflare.com/api/pages/assets/upload", "POST",
        { "Authorization": `Bearer ${uploadJwt}`, "Content-Type": "application/json" },
        JSON.stringify(payload)
      );
      const uploadData = JSON.parse(uploadRes.body);
      console.log(`[DEPLOY] Upload response ${uploadRes.status}:`, JSON.stringify(uploadData).slice(0, 300));
      if (!uploadData.success) {
        throw new Error(uploadData.errors?.map(e => e.message).join(", ") || "File upload failed");
      }
    } else if (!uploadJwt) {
      console.log(`[DEPLOY] No upload needed — files already cached`);
    }

    // Step 4: Finalize deployment — required to make it go live
    if (deploymentId) {
      console.log(`[DEPLOY] Finalizing deployment ${deploymentId}...`);
      const finalizeRes = await httpRequest(
        `${baseUrl}/${cfProjectName}/deployments/${deploymentId}/finalize`, "POST",
        { "Authorization": `Bearer ${cfApiToken}`, "Content-Type": "application/json" },
        "{}"
      );
      const finalizeData = JSON.parse(finalizeRes.body);
      console.log(`[DEPLOY] Finalize response ${finalizeRes.status}:`, JSON.stringify(finalizeData).slice(0, 200));
      if (!finalizeData.success) {
        // Not fatal — log warning but continue (some CF plans don't need it)
        console.warn(`[DEPLOY] Finalize warning:`, finalizeData.errors?.map(e => e.message).join(", "));
      }
    }

    // Build URLs: deployment-specific (instant) + production sub-path (canonical)
    const result = deployData.result || {};
    const baseDeployUrl = result.url || `https://${cfProjectName}.pages.dev`;
    return { baseDeployUrl, cfProjectName };
  }

  // ── Git deploy helper — commit + push one path to GitHub ─────────────────
  // CF Pages (connected to this GitHub repo) auto-deploys on push (~30s).
  async function gitPush(repoRelPath, commitMsg) {
    const { execSync } = require("child_process");
    const repoRoot = execSync(`git -C "${__dirname}" rev-parse --show-toplevel`, {
      encoding: "utf8", timeout: 5000
    }).trim();
    execSync(`git -C "${repoRoot}" add "${repoRelPath}"`, { encoding: "utf8", timeout: 5000 });
    execSync(`git -C "${repoRoot}" commit -m "${commitMsg}"`, {
      encoding: "utf8", timeout: 5000,
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: "HashtagWebpage Bot",
        GIT_AUTHOR_EMAIL: "deploy@hashtagwebpage.co",
        GIT_COMMITTER_NAME: "HashtagWebpage Bot",
        GIT_COMMITTER_EMAIL: "deploy@hashtagwebpage.co"
      }
    });
    execSync(`git -C "${repoRoot}" push`, { encoding: "utf8", timeout: 30000 });
    return repoRoot;
  }

  // ── POST /api/deploy — save site to sites/[slug]/ and push to GitHub ──────
  // CF Pages (GitHub-connected) auto-deploys the webapp/sites/ folder.
  // Configure "CF Pages Domain" in Settings → Cloudflare Pages:
  //   hashtagwebpage.com  or  hashtagwebpage.pages.dev
  if (req.method === "POST" && pathname === "/api/deploy") {
    try {
      const body = JSON.parse(await readBody(req));
      const { slug, html, cfPagesDomain } = body;
      if (!slug || !html) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "slug and html required" }));
        return;
      }

      // Step 1: Save HTML locally to sites/[slug]/index.html
      const siteDir = path.join(__dirname, "sites", slug);
      fs.mkdirSync(siteDir, { recursive: true });
      fs.writeFileSync(path.join(siteDir, "index.html"), html, "utf8");
      console.log(`[DEPLOY] 💾 Saved → sites/${slug}/index.html`);

      // Step 2: Git commit + push → CF Pages auto-deploys on push
      let gitPushed = false;
      try {
        await gitPush(`webapp/sites/${slug}`, `Deploy: ${slug}`);
        console.log(`[DEPLOY] 🚀 Git pushed → webapp/sites/${slug}`);
        gitPushed = true;
      } catch (gitErr) {
        // Site saved locally — push manually or restart server to retry
        console.warn(`[DEPLOY] ⚠️  Git push skipped: ${gitErr.message.split("\n")[0]}`);
      }

      // Step 3: Build production URL from configured domain
      const domain = (cfPagesDomain || "hashtagwebpage.pages.dev")
        .replace(/^https?:\/\//, "").replace(/\/$/, "");
      const productionUrl = `https://${domain}/${slug}`;

      console.log(`[DEPLOY] ✅ ${slug} → ${productionUrl} | git: ${gitPushed ? "✅ pushed" : "⚠️ local only"}`);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        url: productionUrl,
        productionUrl,
        localPath: `sites/${slug}/index.html`,
        gitPushed,
        success: true
      }));

    } catch (err) {
      console.error("[DEPLOY ERROR]", err.message);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // ── POST /api/deploy-home — save homepage to sites/index.html + push ──────
  // Copies hashtagwebpage-home.html → sites/index.html and pushes to GitHub.
  // Run this once after setup so your root domain shows the marketing page.
  if (req.method === "POST" && pathname === "/api/deploy-home") {
    try {
      const body = JSON.parse(await readBody(req));
      const { cfPagesDomain } = body;

      const homeFile = path.join(__dirname, "hashtagwebpage-home.html");
      let homeHtml;
      try { homeHtml = fs.readFileSync(homeFile, "utf8"); }
      catch {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "hashtagwebpage-home.html not found" }));
        return;
      }

      // Save to sites/index.html (root of the CF Pages deployed folder)
      const sitesDir = path.join(__dirname, "sites");
      fs.mkdirSync(sitesDir, { recursive: true });
      fs.writeFileSync(path.join(sitesDir, "index.html"), homeHtml, "utf8");
      console.log(`[DEPLOY-HOME] 💾 Saved → sites/index.html`);

      // Git commit + push
      let gitPushed = false;
      try {
        await gitPush("webapp/sites/index.html", "Deploy: homepage");
        console.log(`[DEPLOY-HOME] 🚀 Git pushed homepage`);
        gitPushed = true;
      } catch (gitErr) {
        console.warn(`[DEPLOY-HOME] ⚠️  Git push skipped: ${gitErr.message.split("\n")[0]}`);
      }

      const domain = (cfPagesDomain || "hashtagwebpage.pages.dev")
        .replace(/^https?:\/\//, "").replace(/\/$/, "");
      const productionUrl = `https://${domain}`;

      console.log(`[DEPLOY-HOME] ✅ Homepage → ${productionUrl} | git: ${gitPushed ? "✅ pushed" : "⚠️ local only"}`);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ url: productionUrl, productionUrl, gitPushed, success: true }));

    } catch (err) {
      console.error("[DEPLOY-HOME ERROR]", err.message);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // ── POST /api/delete-deployment — remove a Cloudflare Pages project ───────
  if (req.method === "POST" && pathname === "/api/delete-deployment") {
    try {
      const body = JSON.parse(await readBody(req));
      const { projectName, cfAccountId, cfApiToken } = body;
      if (!projectName || !cfAccountId || !cfApiToken) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "projectName, cfAccountId, cfApiToken required" }));
        return;
      }
      const cfRes = await httpRequest(
        `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/pages/projects/${projectName}`,
        "DELETE",
        { "Authorization": `Bearer ${cfApiToken}`, "Content-Type": "application/json" },
        "{}"
      );
      const data = JSON.parse(cfRes.body);
      console.log(`[DELETE DEPLOY] ${projectName} → ${cfRes.status}`);
      res.writeHead(cfRes.status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(data));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // ── POST /api/send-email — send preview link via Resend ───────────────────
  if (req.method === "POST" && pathname === "/api/send-email") {
    try {
      const body = JSON.parse(await readBody(req));
      const {
        to, businessName, previewUrl, fromEmail, resendKey,
        hookMessage = "", category = "", city = "", phone = "",
        rating = 0, reviews = 0,
        themePri = "#4f46e5", themeSec = "#3730a3", themeAcc = "#818cf8", themeIcon = "⭐"
      } = body;

      const starsHtml = rating > 0
        ? `<span style="color:#fbbf24;letter-spacing:2px;font-size:1.1rem">${"★".repeat(Math.round(rating))}${"☆".repeat(5-Math.round(rating))}</span>&nbsp;<strong style="color:white">${(+rating).toFixed(1)}</strong>&nbsp;<span style="opacity:.75;color:white">· ${reviews} Google reviews</span>`
        : "";

      const emailHtml = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Helvetica Neue',Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 0">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;border-radius:16px;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,.15)">

  <!-- THUMBNAIL HERO -->
  <tr><td style="background:linear-gradient(135deg,${themePri} 0%,${themeSec} 100%);padding:48px 32px;text-align:center">
    <div style="display:inline-block;background:rgba(255,255,255,.18);border:1px solid rgba(255,255,255,.35);padding:5px 16px;border-radius:100px;font-size:11px;font-weight:700;color:white;letter-spacing:.08em;text-transform:uppercase;margin-bottom:18px">
      ${themeIcon}&nbsp;&nbsp;${category || "Local Business"}
    </div>
    <div style="font-size:32px;font-weight:900;color:white;letter-spacing:-.03em;margin-bottom:8px;line-height:1.1">${businessName}</div>
    <div style="font-size:14px;color:rgba(255,255,255,.82);margin-bottom:${rating > 0 ? "16px" : "0"}">${city || ""}</div>
    ${rating > 0 ? `<div style="display:inline-flex;align-items:center;gap:8px;background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.25);padding:7px 18px;border-radius:100px;font-size:13px;margin-bottom:0">${starsHtml}</div>` : ""}
  </td></tr>

  <!-- TRUST BAR -->
  <tr><td style="background:white;padding:14px 24px;border-bottom:1px solid #f0f0f0">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td align="center" style="font-size:11px;font-weight:600;color:#374151;padding:2px 8px">✅ Licensed & Insured</td>
      <td align="center" style="font-size:11px;font-weight:600;color:#374151;padding:2px 8px">📍 ${city || "Local"}</td>
      <td align="center" style="font-size:11px;font-weight:600;color:#374151;padding:2px 8px">💬 Free Estimates</td>
      <td align="center" style="font-size:11px;font-weight:600;color:#374151;padding:2px 8px">⚡ Fast Response</td>
    </tr></table>
  </td></tr>

  <!-- BODY -->
  <tr><td style="background:white;padding:36px 32px">
    <p style="font-size:16px;color:#374151;line-height:1.75;margin:0 0 28px">${(hookMessage || `Hi ${businessName} team! We built you a free website preview — take a look:`).replace(/\n/g,"<br>")}</p>

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
        <td width="32%" style="text-align:center;padding:16px 8px;background:#f8fafc;border-radius:10px;margin-right:8px">
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

  <!-- FOOTER -->
  <tr><td style="background:#0f172a;padding:20px 32px;text-align:center">
    <p style="color:#64748b;font-size:12px;margin:0">— The HashtagWebpage Team &nbsp;·&nbsp; <a href="https://hashtagwebpage.com" style="color:#94a3b8;text-decoration:none">hashtagwebpage.com</a></p>
  </td></tr>

</table>
</td></tr>
</table>
</body></html>`;

      if (!resendKey) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false, message: "No Resend key — email logged to console only" }));
        console.log(`\n📧 PREVIEW EMAIL (no Resend key — would send in production):`);
        console.log(`  To: ${to}`);
        console.log(`  Business: ${businessName}`);
        console.log(`  Preview URL: ${previewUrl}`);
        console.log(`  Hook: ${(hookMessage||"").slice(0,80)}...\n`);
        return;
      }
      const emailBody = {
        from: fromEmail || "hello@hashtagwebpage.co",
        to: [to],
        subject: `${businessName} — your free website is ready to go live 🚀`,
        html: emailHtml
      };
      const emailRes = await httpRequest(
        "https://api.resend.com/emails",
        "POST",
        { "Authorization": `Bearer ${resendKey}`, "Content-Type": "application/json" },
        JSON.stringify(emailBody)
      );
      const data = JSON.parse(emailRes.body);
      console.log(`[EMAIL] Sent to ${to} → ${emailRes.status}`);
      res.writeHead(emailRes.status === 200 || emailRes.status === 201 ? 200 : emailRes.status, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, ...data }));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // ── GET /api/sites — list all locally saved site slugs ────────────────────
  if (req.method === "GET" && pathname === "/api/sites") {
    try {
      const sitesDir = path.join(__dirname, "sites");
      let slugs = [];
      if (fs.existsSync(sitesDir)) {
        slugs = fs.readdirSync(sitesDir).filter(d =>
          fs.existsSync(path.join(sitesDir, d, "index.html"))
        );
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ sites: slugs, count: slugs.length }));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // ── GET /assets/... — serve static assets from sites/assets/ ──────────────
  // e.g. /assets/categories/plumber.jpg → webapp/sites/assets/categories/plumber.jpg
  if (req.method === "GET" && pathname.startsWith("/assets/")) {
    const assetPath = path.join(__dirname, "sites", pathname);
    const ext = path.extname(assetPath).toLowerCase();
    const mimeTypes = {
      ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
      ".gif": "image/gif", ".webp": "image/webp", ".svg": "image/svg+xml",
      ".css": "text/css", ".js": "application/javascript", ".json": "application/json",
      ".woff": "font/woff", ".woff2": "font/woff2", ".ttf": "font/ttf",
    };
    const mime = mimeTypes[ext] || "application/octet-stream";
    if (fs.existsSync(assetPath)) {
      res.writeHead(200, { "Content-Type": mime, "Cache-Control": "public, max-age=86400" });
      fs.createReadStream(assetPath).pipe(res);
      return;
    }
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end(`Asset not found: ${pathname}`);
    return;
  }

  // ── GET /sites/:slug — serve a locally saved site ─────────────────────────
  if (req.method === "GET" && pathname.startsWith("/sites/")) {
    const parts = pathname.split("/").filter(Boolean);  // ["sites", "slug"]
    const slug = parts[1];
    if (slug) {
      const siteFile = path.join(__dirname, "sites", slug, "index.html");
      if (fs.existsSync(siteFile)) {
        const html = fs.readFileSync(siteFile, "utf8");
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(html);
        return;
      }
    }
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Site not found");
    return;
  }

  // 404
  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
});

server.listen(PORT, () => {
  console.log(`\n🚀 HashtagWebpage running at http://localhost:${PORT}`);
  console.log(`\n   Google API Key: ${GOOGLE_API_KEY === "YOUR_GOOGLE_API_KEY_HERE" ? "⚠️  NOT SET (add to .env or Settings in the app)" : "✅ Set"}`);
  console.log(`\n   Tip: Run with your API key:`);
  console.log(`   GOOGLE_API_KEY=AIzaSy... node server.js\n`);
});
