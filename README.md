# Kakapo frontend

Static **demo** (chat + embedded dashboard) and **dashboard** for the [Kakapo](https://github.com/vineet-malik/kakapo) LLM proxy. The Python API stays in the backend repo; this repo is only HTML/CSS/JS.

## Prerequisites

1. Run the **proxy** from `kakapo/src/backend` (default `http://127.0.0.1:8000`).
2. The backend must allow **CORS** from the origin you use to open these files (see backend `CORS_ALLOW_ORIGINS`).

## Run locally

**Option A — Vite (recommended)**

```bash
npm install
npm run dev
```

Open the URL Vite prints (e.g. `http://localhost:5173/demo.html`).

**Option B — any static server**

```bash
python3 -m http.server 5173
```

Open `http://localhost:5173/demo.html`.

## Before CloudFront (EC2 + app — do this first)

Do these in order so CloudFront has a working origin.

1. **Process listens on all interfaces**  
   Start uvicorn (or gunicorn) bound to **`0.0.0.0`**, not only `127.0.0.1`, e.g. `uvicorn main:app --host 0.0.0.0 --port 8000`. Otherwise nothing outside the instance can connect.

2. **Security group (EC2)**  
   In **EC2 → Instances → your instance → Security → Security groups → Inbound rules**, add **Custom TCP** on your app port (e.g. **8000**).  
   - **MVP test:** source **My IP** or **0.0.0.0/0** (tighten later).  
   - **Better:** source **Prefix list** `com.amazonaws.global.cloudfront.origin-facing` once CloudFront is up, so only CloudFront can reach the origin port.

3. **Smoke test from your laptop (not SSH)**  
   Use the instance **public IPv4 DNS** or **public IP** and your port:

   ```bash
   curl -sS -w "\nHTTP:%{http_code}\n" \
     -X POST "http://YOUR_PUBLIC_DNS_OR_IP:8000/auth/login" \
     -H "Content-Type: application/json" \
     -d '{"username":"admin","password":"password"}'
   ```

   Expect **HTTP 200** and a JSON body with `token`. If this fails, fix the app, port, or security group before CloudFront.

4. **CORS on the backend**  
   Allow the origins where the **browser** loads the UI (e.g. **`https://www.trykakapo.com`**, **`https://trykakapo.com`**). After CloudFront exists, the browser still sends **`Origin: https://www.trykakapo.com`** when the page is there; you usually **do not** need to list the `*.cloudfront.net` domain unless you open the HTML from that URL.

5. **Optional: test from the public internet**  
   Use a phone on cellular (not Wi‑Fi) or ask someone outside your network to hit the same `curl` URL to confirm the instance is reachable.

## CloudFront setup (AWS Console)

1. **AWS Console** → **CloudFront** → **Create distribution**.

2. **Origin**  
   - **Origin domain:** your EC2 **public DNS** (e.g. `ec2-…amazonaws.com`) or public IP. Do **not** pick an S3 bucket unless the API is served from S3.  
   - **Origin protocol:** **HTTP only**.  
   - **Additional settings:** set **HTTP port** to your app port (e.g. **8000**).

3. **Default cache behavior**  
   - **Viewer protocol policy:** **Redirect HTTP to HTTPS**.  
   - **Allowed HTTP methods:** include **GET, HEAD, OPTIONS, PUT, POST, PATCH, DELETE**.  
   - **Cache policy:** **CachingDisabled** (good for APIs).  
   - **Origin request policy:** start with **CORS-CustomOrigin** (managed). If OPTIONS or headers misbehave, try **AllViewer** while debugging.

4. **Create distribution** and wait until status is **Deployed** (often 10–20+ minutes). Copy the **distribution domain**, e.g. `d111111abcdef8.cloudfront.net`.

5. **Verify HTTPS to CloudFront**

   ```bash
   curl -sS -w "\nHTTP:%{http_code}\n" \
     -X POST "https://d111111abcdef8.cloudfront.net/auth/login" \
     -H "Content-Type: application/json" \
     -d '{"username":"admin","password":"password"}'
   ```

   Expect **200**. **502/504** usually means CloudFront cannot reach the origin (wrong port, SG, or app not on `0.0.0.0`).

## After CloudFront (frontend)

The default API base in the repo is **`http://127.0.0.1:8000`** (local dev). For **HTTPS** hosting (e.g. Amplify), set the API to your **CloudFront HTTPS URL** (no trailing slash):

- **Quick test in the browser** (on `login.html`): open DevTools → Console, run:

  ```javascript
  localStorage.setItem('kakapo_api_base', 'https://YOUR_DISTRIBUTION.cloudfront.net');
  location.reload();
  ```

- **Permanent:** set the same URL as `defaultBase` in **`config.js`** and in the matching inline `<script>` at the top of **`login.html`**, **`dashboard.html`**, and **`demo.html`** (keep all four identical).

**Auth:** `POST {KAKAPO_API_BASE}/auth/login` with JSON `username` / `password`.

## Point at a different API

- One-off: `demo.html?api=http://your-host:8000` (stored in `localStorage` when present in the URL).  
- Or: `localStorage.setItem('kakapo_api_base', 'https://…')` then reload.

**HTTPS page + HTTP API:** the browser blocks that (**mixed content**). Use an **HTTPS** API URL (CloudFront) or serve the UI over HTTP.

## Deploy

Upload **`index.html`**, **`demo.html`**, **`login.html`**, **`dashboard.html`**, **`images/`**, and optionally **`config.js`**. The three app pages embed the API base bootstrap so **`/config.js` on the CDN is optional**.

`npm run build` (Vite) emits **`dist/`** if you prefer a packaged output.

## Repo layout

| File | Role |
|------|------|
| `config.js` | Same `defaultBase` logic as the inline bootstrap in `login.html` / `demo.html` / `dashboard.html` (keep in sync) |
| `index.html` | Landing page |
| `demo.html` | Chat + iframe to `dashboard.html` |
| `login.html` | Dashboard login; `POST /auth/login` on `KAKAPO_API_BASE` |
| `dashboard.html` | Keys / Scopes / Analytics; APIs under `/api/dashboard/…` |
| `DASHBOARD_API.md` | HTTP contract for the dashboard and the static UI |
| `DASHBOARD_DB.md` | Prescriptive DB shape for the proxy implementing those APIs |
| `images/` | Static assets (e.g. thumbnails) |
