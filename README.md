# Data Ninja — Level 1

Frontend puzzle + secure score submission using **Google Apps Script** (Sheets) behind a **Cloudflare Worker** proxy.

- Frontend: static `index.html` (your game)
- Backend A: **Apps Script** writes to a Google Sheet (no CORS, no secrets in code)
- Backend B: **Cloudflare Worker** adds CORS + origin allow-list and (optionally for CLI only) shared key auth

This repo includes source files for both backends so others can reproduce the setup **without** any live secrets.

---

## Repository layout

```
/apps-script/Code.gs     # paste into Apps Script editor and deploy as Web App
/worker/worker.js        # paste into Cloudflare Worker
/index.html              # your game (calls the Worker URL, never Apps Script directly)
README.md                # this file
```

> ✅ It’s good practice to commit `Code.gs` and `worker.js`.  
> ❌ Do **not** commit the Apps Script deployment URL (`/exec`) or Worker env values. Keep those as platform secrets/env vars.

---

## How it works

1. Player enters a **secret code** in the welcome screen.
2. The page calls the **Cloudflare Worker**  
   `POST /?origin=<window.location.origin> { action:"exchange", code }`
3. The Worker checks an **Origin allow-list** and forwards JSON to Apps Script (as `text/plain`).
4. Apps Script checks the **Codes** tab; if valid + unused it returns `{ ok:true, code }`.
5. When the player finishes, the page calls the Worker again with  
   `{ action:"submit", code, level, score, elapsed_ms }`.
6. Apps Script appends a row to **Submissions**:  
   `code, level, score, elapsed_ms, submitted_at` (prevents duplicates).

No PII is stored — only opaque codes & scores. You keep the private cross-walk elsewhere.

---

## Setup

### 1) Google Sheet

- Make a spreadsheet (e.g., **Data Ninja Scores**).
- Add two tabs:
  - `Submissions` (empty; script enforces headers automatically)
  - `Codes` with headers: `code` (A1). Optional `allowed` (B1).
- Put one **raw** code per row (e.g., `aaa111`, `abc123`). Codes are **case-sensitive**.

### 2) Deploy the Apps Script

1. In the Sheet: **Extensions → Apps Script**.
2. Replace content with [`apps-script/Code.gs`](apps-script/Code.gs) (below).
3. **Deploy → New deployment → Web app**  
   - *Execute as:* Me  
   - *Who has access:* Anyone
4. Copy the web app URL (ends in `/exec`). This is your **EXEC_URL** for the Worker.

**POST actions:**
- `exchange` → validates code; blocks already-used (`already_submitted`).
- `submit` → appends row; blocks duplicate `code+level`.

### 3) Deploy the Cloudflare Worker

1. Create a Worker (e.g., `dn-proxy.<your>.workers.dev`).
2. Paste [`worker/worker.js`](worker/worker.js) (below).
3. In **Settings → Variables** add:
   - `EXEC_URL` = your Apps Script `/exec` URL
   - `APP_SHARED_KEY` = random string (only required for CLI/Postman calls from non-allowed origins)
4. Edit `ALLOWED_ORIGINS` to include your sites:
   ```js
   const ALLOWED_ORIGINS = [
     "http://localhost:3000",
     "https://bendupey87.github.io",
     // "https://yourdomain.com"
   ];
   ```
5. Deploy.

### 4) Frontend wiring

In your `index.html`:

```js
const API_URL = 'https://dn-proxy.<your-subdomain>.workers.dev';
const API_WITH_ORIGIN = `${API_URL}?origin=${encodeURIComponent(window.location.origin)}`;

// exchange
await fetch(API_WITH_ORIGIN, {
  method: "POST",
  headers: {"Content-Type":"text/plain;charset=utf-8"},
  body: JSON.stringify({ action:"exchange", code })
}).then(r=>r.json());

// submit
await fetch(API_WITH_ORIGIN, {
  method: "POST",
  headers: {"Content-Type":"text/plain;charset=utf-8"},
  body: JSON.stringify({ action:"submit", code, level:1, score, elapsed_ms })
}).then(r=>r.json());
```

---

## Security model

### Controls in place
- **Origin allow-list (CORS)** in the Worker — only your sites are forwarded.
- **Codes allow-list** in Sheets (`Codes!A:A`) with optional `allowed` flag.
- **Re-use protection** — `exchange` blocks codes that already have a submission; `submit` blocks duplicate `code+level`.
- **No secrets in browser** — the page never sees `EXEC_URL` or the shared key.
- **No PII stored** — only `code, level, score, elapsed_ms, submitted_at`.

### Risks to consider
- Apps Script URL is public. If an attacker knows a valid code, they can call it directly.  
  *Mitigate:* use long random codes; rotate per cohort; keep `ENFORCE_CODES=true`.
- CORS ≠ auth. The Worker protects browsers; curl/Postman can still hit it.  
  *Mitigate:* for **non-allowed** origins the Worker requires `X-App-Key` (keep private), plus add CF rate limits.
- Brute forcing codes.  
  *Mitigate:* unguessable codes (12–16+ chars), CF rate limiting, optional CAPTCHA.

### Optional hardening
- Short-lived signed token: Worker mints a JWT on `exchange`; `submit` must include it.
- Per-code throttling with KV/D1 (block rapid retries per code/IP).
- Rotate EXEC_URL by redeploying Apps Script if it leaks.
- Add Turnstile/CAPTCHA to the welcome modal.

---

## Behaviour reference

### Apps Script
- Ensures `Submissions` has headers on first write.
- `exchange` returns `{ok:true, code}` or `{ok:false, error:...}`  
- `submit` returns `{success:true}` or `{success:false, error|reason:...}`  
- Row: `[code, level, score, elapsed_ms, new Date()]`

### Worker
- Accepts `GET` (health), `OPTIONS` (preflight), `POST` (proxy).
- Origin from `?origin=` (preferred) or `Origin` header.
- Allowed origins don’t need `X-App-Key`. Others do (for CLI testing).

---

## CLI tests (optional)

```powershell
$u = "https://dn-proxy.<your>.workers.dev?origin=http://localhost:3000"
$h = @{
  "Content-Type" = "text/plain;charset=utf-8"
  "X-App-Key"    = "<APP_SHARED_KEY>"
  "Origin"       = "http://localhost:3000"
}
(iwr -Method POST -Uri $u -Headers $h -Body '{ "action":"exchange", "code":"abc123" }').Content
(iwr -Method POST -Uri $u -Headers $h -Body '{ "action":"submit", "code":"abc123", "level":1, "score":7, "elapsed_ms":12345 }').Content
```

---

## Troubleshooting

- **CORS error** → add your site to `ALLOWED_ORIGINS` **and** send `?origin=<window.location.origin>`.
- **`config_missing: EXEC_URL`** → set Worker env var.
- **`unauthorized` from CLI** → include `X-App-Key` that matches Worker’s `APP_SHARED_KEY`.
- **`invalid_code`** → ensure exact raw code exists in `Codes!A:A` and `allowed` isn’t false.
- **Duplicate block** → clear prior row in `Submissions` for test re-use.

---

## License
MIT
