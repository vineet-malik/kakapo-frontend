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

Default if unset: the **dev ALB** URL in `config.js` (HTTPS). For a local uvicorn proxy, open any page with **`?api=http://127.0.0.1:8000`** once (it is stored in `localStorage`) or set `localStorage.setItem('kakapo_api_base', 'http://127.0.0.1:8000')` before signing in.

**Auth:** the dashboard calls **`POST {KAKAPO_API_BASE}/auth/login`** with JSON `username` / `password` (same as your working `curl` against the ALB).

## Deploy

There is no required compile step for production: upload the HTML entrypoints, `config.js`, and static assets to any static host (S3, Netlify, GitHub Pages). At minimum include **`index.html`**, **`demo.html`**, **`login.html`**, **`dashboard.html`**, **`config.js`**, and the **`images/`** directory (referenced from `index.html`). Override the API base with `?api=` or `localStorage` if you need a different backend than the default in `config.js`.

**HTTPS static host (e.g. Amplify):** the default API URL in `config.js` uses **`https://`** on the dev ALB so the browser does not block requests as mixed content. A plain `http://` ALB endpoint works from `curl` on your machine, but the hosted app still needs **TLS on the load balancer** (or HTTPS in front of the ALB) for sign-in from the browser to succeed.

`npm run build` (Vite) emits a **`dist/`** folder with the same pages if you prefer a packaged output; add your host’s rewrite rules if you need clean URLs.

## Repo layout

| File | Role |
|------|------|
| `config.js` | Sets `window.KAKAPO_API_BASE` |
| `index.html` | Landing page |
| `demo.html` | Chat + iframe to `dashboard.html` |
| `login.html` | Dashboard login; `POST /auth/login` on `KAKAPO_API_BASE` |
| `dashboard.html` | Keys / Scopes / Analytics; APIs under `/api/dashboard/…` |
| `DASHBOARD_API.md` | HTTP contract for the dashboard and the static UI |
| `DASHBOARD_DB.md` | Prescriptive DB shape for the proxy implementing those APIs |
| `images/` | Static assets (e.g. thumbnails) |
