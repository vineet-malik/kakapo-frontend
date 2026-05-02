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

Default if unset: `http://127.0.0.1:8000` (see `config.js`).

## Deploy

Build has no compile step: upload `demo.html`, `dashboard.html`, and `config.js` to any static host (S3, Netlify, GitHub Pages). Set the API URL via `?api=` or `localStorage` for production backends.

## Repo layout

| File | Role |
|------|------|
| `config.js` | Sets `window.KAKAPO_API_BASE` |
| `demo.html` | Chat + iframe to `dashboard.html` |
| `dashboard.html` | Stats + chart; calls `/api/stats` on the API base |
