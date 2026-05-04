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

## Point at a different API

- One-off: open `demo.html?api=http://your-host:8000`
- Or in the browser console: `localStorage.setItem('kakapo_api_base', 'http://your-host:8000')` then reload.

Default if unset: the **dev ALB** over **`http://`** (same as working `curl`). Override with **`?api=`** or **`localStorage.kakapo_api_base`** for local uvicorn or an HTTPS API.

**HTTPS static site (e.g. `https://www.trykakapo.com`):** browsers **block** `fetch()` to **`http://`** APIs (mixed content). For that case you must either serve this UI over **HTTP**, put an **HTTPS** URL in `?api=` / `localStorage`, or add a **same-origin HTTPS proxy** to the ALB.

**Auth:** the dashboard calls **`POST {KAKAPO_API_BASE}/auth/login`** with JSON `username` / `password`.

## Deploy

There is no required compile step for production: upload the HTML entrypoints and static assets to any static host (S3, Netlify, GitHub Pages). At minimum include **`index.html`**, **`demo.html`**, **`login.html`**, **`dashboard.html`**, and the **`images/`** directory (referenced from `index.html`). **`login.html`**, **`demo.html`**, and **`dashboard.html`** each embed the API base bootstrap (same logic as **`config.js`** in the repo), so sign-in still works if **`config.js`** is missing from the bucket. Optionally publish **`config.js`** for consistency; override the API base with **`?api=`** or **`localStorage.kakapo_api_base`** when testing.

**CORS:** the backend must allow your static origin (see `CORS_ALLOW_ORIGINS`).

`npm run build` (Vite) emits a **`dist/`** folder with the same pages if you prefer a packaged output; add your host’s rewrite rules if you need clean URLs.

## Repo layout

| File | Role |
|------|------|
| `config.js` | Same defaults as the inline bootstrap in `login.html` / `demo.html` / `dashboard.html` (keep in sync) |
| `index.html` | Landing page |
| `demo.html` | Chat + iframe to `dashboard.html` |
| `login.html` | Dashboard login; `POST /auth/login` on `KAKAPO_API_BASE` |
| `dashboard.html` | Keys / Scopes / Analytics; APIs under `/api/dashboard/…` |
| `DASHBOARD_API.md` | HTTP contract for the dashboard and the static UI |
| `DASHBOARD_DB.md` | Prescriptive DB shape for the proxy implementing those APIs |
| `images/` | Static assets (e.g. thumbnails) |
