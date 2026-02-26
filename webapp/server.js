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
      const { city, category } = body;

      if (!city || !category) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "city and category are required" }));
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

      const apiKey = GOOGLE_API_KEY;
      if (apiKey === "YOUR_GOOGLE_API_KEY_HERE") {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "No API key set. Add GOOGLE_API_KEY to .env or update server.js" }));
        return;
      }

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
          "X-Goog-FieldMask": fieldMask
        },
        googleBody
      );

      const data = JSON.parse(googleRes.body);

      if (!data.places) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ results: [], count: 0, message: "No results from Google" }));
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
      const { to, businessName, previewUrl, fromEmail, resendKey } = body;
      if (!resendKey) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false, message: "No Resend key — email logged to console only" }));
        console.log(`\n📧 PREVIEW EMAIL (would send in production):`);
        console.log(`  To: ${to}`);
        console.log(`  Business: ${businessName}`);
        console.log(`  Preview URL: ${previewUrl}\n`);
        return;
      }
      const emailBody = {
        from: fromEmail || "hello@hashtagwebpage.co",
        to: [to],
        subject: `Your free website from HashtagWebpage is ready, ${businessName}!`,
        html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
          <h2 style="color:#6366f1">Your website is ready! 🎉</h2>
          <p>Hi ${businessName} team,</p>
          <p>We built you a <strong>free website preview</strong>. Take a look:</p>
          <a href="${previewUrl}" style="display:inline-block;background:#6366f1;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:700;margin:16px 0">View Your Free Website →</a>
          <p style="color:#666">This preview is live for <strong>7 days</strong>. Reply to this email or call us to claim your site.</p>
          <p style="color:#666">Setup: $100 · Hosting: $5/month · Or buy outright for $200</p>
          <p style="color:#999;font-size:12px">— The HashtagWebpage Team</p>
        </div>`
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
