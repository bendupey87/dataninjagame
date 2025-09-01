// Environment variables (set in CF dashboard or wrangler.toml):
// - EXEC_URL: your Apps Script EXEC URL (ends with /exec)
// - APP_SHARED_KEY: a secret used only for CLI/Postman; NOT required for allowed browser origins

const ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "https://bendupey87.github.io",
  // add your custom domain later, e.g. "https://data-ninja.yourdomain.com",
];
const ALLOWED = new Set([
  'https://bendupey87.github.io', // ← add this
  'http://localhost:3000',        // keep for local testing
  // add your future custom domain too:
  // 'https://yourdomain.com'
]);

function corsHeaders(allowOrigin) {
  const h = new Headers();
  if (allowOrigin) h.set("Access-Control-Allow-Origin", allowOrigin);
  h.set("Vary", "Origin");
  h.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  h.set("Access-Control-Allow-Headers", "Content-Type, X-App-Key");
  h.set("Access-Control-Max-Age", "86400");
  return h;
}

function jsonResponse(obj, status, baseCors, extra = {}) {
  const h = new Headers(baseCors);
  h.set("Content-Type", "application/json");
  for (const [k, v] of Object.entries(extra)) h.set(k, v);
  return new Response(JSON.stringify(obj), { status, headers: h });
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const method = req.method.toUpperCase();

    // Figure out the claimed origin (prefer ?origin=, else Origin header)
    const originParam = url.searchParams.get("origin") || "";
    const headerOrigin = req.headers.get("Origin") || "";
    const claimedOrigin = originParam || headerOrigin;

    const isAllowed = ALLOWED_ORIGINS.includes(claimedOrigin);
    const baseCors = corsHeaders(isAllowed ? claimedOrigin : "");

    // Health check (GET hits this)
    if (method === "GET") {
      return jsonResponse({ ok: true, service: "dn-proxy" }, 200, baseCors);
    }

    // Preflight
    if (method === "OPTIONS") {
      return new Response("", { status: 204, headers: baseCors });
    }

    // Validate env
    if (!env.EXEC_URL) {
      return jsonResponse({ error: "config_missing", detail: "EXEC_URL not set" }, 500, baseCors);
    }
    // Only enforce APP_SHARED_KEY for non-allowed origins (CLI/Postman/etc.)
    if (!isAllowed) {
      if (!env.APP_SHARED_KEY) {
        return jsonResponse({ error: "config_missing", detail: "APP_SHARED_KEY not set" }, 500, baseCors);
      }
      const key = req.headers.get("X-App-Key") || "";
      if (key !== env.APP_SHARED_KEY) {
        return jsonResponse({ error: "unauthorized" }, 401, baseCors);
      }
    }

    // Forward JSON body to Apps Script (as text/plain)
    let bodyText = "";
    try {
      bodyText = await req.text();
      // If body is empty, at least send an empty JSON object
      if (!bodyText) bodyText = "{}";
    } catch (err) {
      return jsonResponse({ error: "bad_request", detail: String(err) }, 400, baseCors);
    }

    const forwardUrl = `${env.EXEC_URL}?origin=${encodeURIComponent(claimedOrigin)}`;

    try {
      const upstream = await fetch(forwardUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: bodyText,
      });

      const text = await upstream.text();

      // Return whatever the script returned, but enforce JSON content type + CORS
      const headers = new Headers(baseCors);
      headers.set("Content-Type", "application/json");
      return new Response(text, { status: upstream.status, headers });
    } catch (err) {
      // Network/DNS/TLS errors etc.
      return jsonResponse({ error: "upstream_error", detail: String(err) }, 502, baseCors);
    }
  },
};
