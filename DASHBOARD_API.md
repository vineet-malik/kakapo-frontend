# Kakapo dashboard — HTTP API contract

This document is the **only** contract between the **Kakapo static dashboard** (`login.html`, `dashboard.html`) and the **Python proxy**. Each response shape is **fixed**: one status code set, one JSON shape, one field name per concept. Implementations that return a different shape are **non-compliant**; the dashboard is updated to match this file, not the reverse.

Base URL: `KAKAPO_API_BASE` (no trailing slash), e.g. `http://…` (dev ALB) or `http://127.0.0.1:8000` (local). All paths below are relative to that base.

**Request bodies:** `Content-Type: application/json` where a body is defined.

**Auth:** every route except `POST /auth/login` requires:

```http
Authorization: Bearer <access_token>
```

**Session invalidation:** responses with status **`401`** or **`403`** clear the stored token and redirect the user to `login.html`.

---

## Summary

| Method | Path | Success status | Response body |
|--------|------|----------------|---------------|
| `POST` | `/auth/login` | **200** | `{"token":"<string>"}` |
| `GET` | `/api/dashboard/keys` | **200** | `{"keys":[...]}` |
| `POST` | `/api/dashboard/keys` | **200** | `{"key":"<secret>","id":"<string>","prefix":"<string>"}` |
| `DELETE` | `/api/dashboard/keys/:id` | **204** | empty body |
| `GET` | `/api/dashboard/scopes` | **200** | `{"scopes":[...]}` |
| `POST` | `/api/dashboard/scopes` | **201** | `{"scope":{...}}` |
| `GET` | `/api/dashboard/analytics` | **200** | `{"days":[...]}` |

**Error responses (non-success):** status **`4xx`** or **`5xx`** with JSON body **`{"detail":"<human-readable string>"}`**. The `detail` value is shown on the login screen or in inline error text where applicable.

---

## `POST /auth/login`

**Request body (required fields):**

```json
{
  "username": "<string>",
  "password": "<string>"
}
```

**Response `200 OK`** — body **must** be exactly:

```json
{
  "token": "<access_token_string>"
}
```

The field name is **`token`**. No other top-level field is defined for success.

**Error response** — any non-`200` status; body **must** be:

```json
{
  "detail": "<single human-readable error string>"
}
```

---

## `GET /api/dashboard/keys`

**Response `200 OK`** — body **must** be:

```json
{
  "keys": [
    {
      "id": "<string>",
      "label": "<string>",
      "prefix": "<string>",
      "default_scope": "<string>",
      "last_used_at": "<RFC 3339 instant or null>",
      "revoked": <boolean>
    }
  ]
}
```

| Field | Requirement |
|--------|-------------|
| `keys` | Array (empty `[]` if no keys). |
| `keys[].id` | Non-empty string; stable identifier for `DELETE`. |
| `keys[].label` | Non-empty string. |
| `keys[].prefix` | Non-empty string; safe public prefix (not the secret). |
| `keys[].default_scope` | String; use `""` if none. |
| `keys[].last_used_at` | RFC 3339 instant **or** JSON **`null`** if never used. |
| `keys[].revoked` | Boolean; `true` if the key must not be used. |

---

## `POST /api/dashboard/keys`

**Request body** — all keys optional; omit a key or send `null` / `""` for “unset”:

```json
{
  "label": "<string>",
  "default_scope": "<string>"
}
```

**Response `200 OK`** — body **must** be:

```json
{
  "key": "<full_secret_one_time_only>",
  "id": "<string>",
  "prefix": "<string>"
}
```

| Field | Requirement |
|--------|-------------|
| `key` | Full API secret; shown **once** to the user. |
| `id` | Same identifier as will appear in `GET …/keys`. |
| `prefix` | Same prefix as will appear in `GET …/keys`. |

---

## `DELETE /api/dashboard/keys/:id`

**Path parameter:** `id` — same value as `keys[].id`.

**Response `204 No Content`** — **empty** response body on successful revoke.

**Response `404 Not Found`** — body **`{"detail":"…"}`** when `id` is unknown.

**Response `501 Not Implemented`** — body **`{"detail":"…"}`** when revoke is not implemented. The dashboard treats **`501`** the same as “not supported” (key row is not removed client-side).

---

## `GET /api/dashboard/scopes`

**Response `200 OK`** — body **must** be:

```json
{
  "scopes": [
    {
      "id": "<string>",
      "name": "<string>",
      "rpm": <integer>,
      "token_budget_daily": <integer>,
      "policy": "<string>",
      "queue_max_wait_s": <integer>,
      "models": "<string>"
    }
  ]
}
```

| Field | Requirement |
|--------|-------------|
| `scopes` | Array (empty `[]` allowed). |
| `scopes[].id` | Non-empty string. |
| `scopes[].name` | Non-empty string; matches `scopename` sent on `/v1/query`. |
| `scopes[].rpm` | Integer ≥ `1` (requests per minute). |
| `scopes[].token_budget_daily` | Integer ≥ `0`. |
| `scopes[].policy` | Exactly one of: **`block`**, **`queue`**, **`degrade`**. |
| `scopes[].queue_max_wait_s` | Integer ≥ `1` (seconds); ignored when `policy` is not `queue`. |
| `scopes[].models` | Non-empty string label (e.g. `all`, `cheap`, `custom`). |

---

## `POST /api/dashboard/scopes`

**Request body** — **must** match one `scopes[]` element from `GET /api/dashboard/scopes` (same field names and types). The `id` in the body is ignored or regenerated server-side; the client may send a temporary `id` for correlation.

**Response `201 Created`** — body **must** be:

```json
{
  "scope": {
    "id": "<string>",
    "name": "<string>",
    "rpm": <integer>,
    "token_budget_daily": <integer>,
    "policy": "<string>",
    "queue_max_wait_s": <integer>,
    "models": "<string>"
  }
}
```

The `scope` object is the persisted row as it will appear on subsequent **`GET`**.

If a scope with the same **`name`** already exists for the authenticated org, respond **`409 Conflict`** with `{"detail":"<string>"}` (same error envelope as other `4xx`).

---

## `GET /api/dashboard/analytics`

Called when the **Analytics** tab is opened or **Refresh** is clicked. **No query string.** Returns a **rolling window of at most 30 calendar days**, UTC, **inclusive**, one bucket per day, **every scope** that had traffic on that day (scopes with no traffic that day are omitted from that day’s `scopes` object).

**Response `200 OK`** — body **must** be:

```json
{
  "days": [
    {
      "date": "YYYY-MM-DD",
      "scopes": {
        "<scope_name>": {
          "requests": <integer>,
          "tokens_used": <integer>,
          "spend_usd_est": <number>,
          "rule_hits": <integer>
        }
      }
    }
  ]
}
```

| Rule | Specification |
|------|----------------|
| `days` | Array of length **0–30** (inclusive). |
| Sort order | `days` **must** be sorted ascending by `days[].date`. |
| `days[].date` | String **`YYYY-MM-DD`** in **UTC**. |
| `days[].scopes` | Object; keys are scope names; values are metrics for that day only. |
| `requests` | Integer ≥ `0`. |
| `tokens_used` | Integer ≥ `0` (prompt + completion tokens for that scope that day). |
| `spend_usd_est` | Number ≥ `0` (USD). |
| `rule_hits` | Integer ≥ `0` (rule firings that day for that scope). |

Metrics use **`tokens_used`** only. Do not send `tokens_in` or `tokens_out`.

The browser filters **`days`** locally for **Last 24 hours**, **7 days**, **30 days**, and **Month to date**; it does not send `range` to the server.

---

## CORS

The HTTP **Origin** that serves `login.html` and `dashboard.html` must be listed in the proxy **`CORS_ALLOW_ORIGINS`** setting, or browsers block `fetch`.

---

## Local preview (not part of the production contract)

`login.html` under localhost / `127.0.0.1` / `file:` / `?dev=1` accepts fixed credentials and uses in-memory fixtures that follow this document. Production backends **must** implement the routes above; the fixtures are for UI development only.
