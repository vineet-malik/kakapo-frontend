# Kakapo dashboard — database specification

This file is the **database contract** paired with **`DASHBOARD_API.md`**. Backend, data, and infra teams implement **exactly** what is written here. If behavior is not listed here, it is **out of scope** for this MVP (do not invent parallel patterns).

---

## 1. Tenant isolation (hard rules)

1. **`org_id` is a UUID.** It is the primary key `org.id` and the foreign key column on every tenant-owned table in this document.
2. **Every read and write** on `api_key`, `scope`, and `usage_daily` **must** filter or set `org_id` using the value taken **only** from **auth** (validated session established at `POST /api/auth/login`). **Never** take `org_id` from the HTTP request body or query string for authorization.
3. **Auth binding:** Validating the `token` from **`DASHBOARD_API.md`** **must** yield **`org_id` == `org.id`** (same UUID). Database columns `org_id` are typed UUID and store that same value.
4. **Two companies never share rows:** any `SELECT` / `UPDATE` / `DELETE` / `INSERT` for tenant data **must** include `org_id = <value from auth>` in the predicate or column list so rows from another `org_id` cannot be read or modified.

---

## 2. MVP table set (four tables)

This MVP uses **four tables**. There is no fifth table in scope unless you ship the **Extension (§5)** at the end of this document; until then, do not add tables.

---

### 2.1 `org`

**Purpose:** One row per company. Holds the **single** human dashboard login for that company in this MVP.

| Column          | Type        | Nullable | Specification |
|-----------------|-------------|----------|----------------|
| `id`            | UUID        | NO       | Primary key. **This UUID is `org_id` everywhere else.** |
| `name`          | text        | NO       | Company display name. |
| `username`      | text        | NO       | Login name. **Globally unique** across all rows in `org`. |
| `password_hash` | text        | NO       | **Argon2id** encoding of the password (no plaintext storage). |
| `created_at`    | timestamptz | NO       | Row creation time, server default `now()`. |

**Primary key:** `id`

**Required index:** `UNIQUE (username)`

**Login read (no joins):**

```sql
SELECT id, password_hash FROM org WHERE username = $1;
```

On success, auth **must** attach `org_id = org.id` for all subsequent dashboard routes for that session.

---

### 2.2 `api_key`

**Purpose:** Rows backing `GET` / `POST` / `DELETE /api/dashboard/keys` in **`DASHBOARD_API.md`**.

| Column           | Type        | Nullable | Specification |
|------------------|-------------|----------|----------------|
| `id`             | UUID        | NO       | Primary key. Returned as `keys[].id`. |
| `org_id`         | UUID        | NO       | Foreign key → `org.id`. **Must** equal auth `org_id`. |
| `label`          | text        | NO       | Non-empty. |
| `key_prefix`     | text        | NO       | Non-empty public prefix. |
| `secret_hash`    | text        | NO       | **Argon2id** hash of the full API secret. **Never** store the plaintext secret. |
| `default_scope`  | text        | NO       | Use empty string `''` when none. |
| `revoked_at`     | timestamptz | YES      | `NULL` = active key. Non-`NULL` = revoked (`keys[].revoked: true` in the API). |
| `last_used_at`   | timestamptz | YES      | `NULL` until first successful `/v1/query` with this key. |
| `created_at`     | timestamptz | NO       | Server default `now()`. |

**Primary key:** `id`

**Required index:** `(org_id)`

**Required foreign key:** `org_id` REFERENCES `org(id)` ON DELETE CASCADE

**List keys (no joins):**

```sql
SELECT id, label, key_prefix, default_scope, last_used_at, revoked_at
FROM api_key
WHERE org_id = $1
ORDER BY created_at DESC;
```

**Revoke (soft delete only; no physical `DELETE`):**

```sql
UPDATE api_key
SET revoked_at = now()
WHERE id = $1 AND org_id = $2;
```

A row that has ever existed **stays** in the table for audit; `revoked_at` records revocation.

---

### 2.3 `scope`

**Purpose:** Rows backing `GET` / `POST /api/dashboard/scopes` in **`DASHBOARD_API.md`**.

| Column               | Type        | Nullable | Specification |
|----------------------|-------------|----------|----------------|
| `id`                 | UUID        | NO       | Primary key. |
| `org_id`             | UUID        | NO       | Foreign key → `org.id`. **Must** equal auth `org_id`. |
| `name`               | text        | NO       | Scope name; **must** match the `scopename` string clients send on `/v1/query` for that org. |
| `rpm`                | integer     | NO       | `>= 1`. |
| `token_budget_daily` | bigint      | NO       | `>= 0`. |
| `policy`             | text        | NO       | **Exactly** one of: `block`, `queue`, `degrade`. |
| `queue_max_wait_s`   | integer     | NO       | `>= 1`. When `policy <> 'queue'`, the gateway **still** stores this column; the value is **not** read for queue logic. |
| `models`             | text        | NO       | Non-empty label (e.g. `all`, `cheap`, `custom`). |
| `created_at`         | timestamptz | NO       | Server default `now()`. |

**Primary key:** `id`

**Required constraint:** `UNIQUE (org_id, name)`

**Required index:** `(org_id)`

**Required foreign key:** `org_id` REFERENCES `org(id)` ON DELETE CASCADE

**List scopes (no joins):**

```sql
SELECT id, name, rpm, token_budget_daily, policy, queue_max_wait_s, models
FROM scope
WHERE org_id = $1
ORDER BY name;
```

---

### 2.4 `usage_daily`

**Purpose:** Pre-aggregated facts for `GET /api/dashboard/analytics` in **`DASHBOARD_API.md`**.

**Design rule:** `scope_name` is **denormalized text**. It is **not** a foreign key to `scope.id`. Historical rows **do not** change when a scope row is renamed or deleted; analytics for past dates stay tied to the **name recorded at ingest time**.

| Column          | Type        | Nullable | Specification |
|-----------------|-------------|----------|----------------|
| `org_id`        | UUID        | NO       | Part of PK. **Must** equal auth `org_id` on read. Foreign key → `org.id`. |
| `bucket_date`   | date        | NO       | Part of PK. **UTC** calendar date (`DATE` in UTC). |
| `scope_name`    | text        | NO       | Part of PK. String copied from the request `scopename` at ingest time. |
| `requests`      | bigint      | NO       | `>= 0`. |
| `tokens_used`   | bigint      | NO       | `>= 0`. |
| `spend_usd_est` | numeric     | NO       | `>= 0`. |
| `rule_hits`     | bigint      | NO       | `>= 0`. |

**Primary key:** `(org_id, bucket_date, scope_name)`

**Required index:** `(org_id, bucket_date)` — supports “last 30 days” range scans.

**Required foreign key:** `org_id` REFERENCES `org(id)` ON DELETE CASCADE

**Analytics read (no joins):**

```sql
SELECT bucket_date, scope_name, requests, tokens_used, spend_usd_est, rule_hits
FROM usage_daily
WHERE org_id = $1 AND bucket_date >= $2 AND bucket_date <= $3
ORDER BY bucket_date ASC;
```

**Ingest rule:** On each **successful** `/v1/query` completion, the gateway **must** upsert the counters for that org, UTC `bucket_date`, and resolved `scope_name` in **the same database transaction** that records the query outcome (no separate “batch-only” path in this MVP). Use:

```sql
INSERT INTO usage_daily (org_id, bucket_date, scope_name, requests, tokens_used, spend_usd_est, rule_hits)
VALUES ($1, $2, $3, $4, $5, $6, $7)
ON CONFLICT (org_id, bucket_date, scope_name)
DO UPDATE SET
  requests = usage_daily.requests + EXCLUDED.requests,
  tokens_used = usage_daily.tokens_used + EXCLUDED.tokens_used,
  spend_usd_est = usage_daily.spend_usd_est + EXCLUDED.spend_usd_est,
  rule_hits = usage_daily.rule_hits + EXCLUDED.rule_hits;
```

The seven numeric placeholders are the **deltas** for that single completed request.

---

## 3. Join count (dashboard reads)

| Operation              | Tables read | SQL joins |
|------------------------|-------------|-----------|
| Dashboard login        | `org`       | 0         |
| List API keys          | `api_key`   | 0         |
| List scopes            | `scope`     | 0         |
| Last-30-days analytics | `usage_daily` | 0       |

---

## 4. Seven HTTP routes ↔ these tables (mapping)

`$org_id` in every statement **must** be the UUID from auth, **never** from the client.

| # | HTTP | Path | Database action |
|---|------|------|-----------------|
| 1 | `POST` | `/api/auth/login` | `SELECT id, password_hash FROM org WHERE username = $username`. On password match, issue `token` whose validation yields `org_id = org.id`. |
| 2 | `GET` | `/api/dashboard/keys` | `SELECT id, label, key_prefix, default_scope, last_used_at, revoked_at FROM api_key WHERE org_id = $org_id ORDER BY created_at DESC`. Map `revoked_at IS NOT NULL` → `"revoked": true`. |
| 3 | `POST` | `/api/dashboard/keys` | `INSERT INTO api_key (id, org_id, label, key_prefix, secret_hash, default_scope, revoked_at, last_used_at, created_at) VALUES (…)`. Return plaintext `key` once in JSON; store only `secret_hash`. |
| 4 | `DELETE` | `/api/dashboard/keys/:id` | `UPDATE api_key SET revoked_at = now() WHERE id = $id AND org_id = $org_id`. If zero rows updated, return **404** per **`DASHBOARD_API.md`**. |
| 5 | `GET` | `/api/dashboard/scopes` | `SELECT id, name, rpm, token_budget_daily, policy, queue_max_wait_s, models FROM scope WHERE org_id = $org_id ORDER BY name`. |
| 6 | `POST` | `/api/dashboard/scopes` | `INSERT INTO scope (…) VALUES (…)` with `org_id = $org_id`. On `UNIQUE (org_id, name)` violation return **409** with `{"detail":"<string>"}` per **`DASHBOARD_API.md`**. On success return **201** and JSON body built only from the inserted row. |
| 7 | `GET` | `/api/dashboard/analytics` | `SELECT bucket_date, scope_name, requests, tokens_used, spend_usd_est, rule_hits FROM usage_daily WHERE org_id = $org_id AND bucket_date BETWEEN $start AND $end ORDER BY bucket_date`. Build the `days[]` structure in application code from this rectangular result set. |

**Onboarding:** New companies are created by inserting exactly one row into `org` (with `username` / `password_hash` / `name`). No other table is populated at signup except what product requires (often zero keys and zero scopes until the user creates them).

---

## 5. Extension (out of MVP; do not implement until agreed)

**Multiple human users per company:** Add table `dashboard_user` with columns `id` (UUID PK), `org_id` (UUID FK → `org.id` ON DELETE CASCADE), `username` (text, `UNIQUE (org_id, username)`), `password_hash` (text), `created_at` (timestamptz). Move `username` and `password_hash` off `org` into `dashboard_user`. Auth **must** still expose **`org_id` == `org.id`** for all tenant queries; it **may** additionally expose `user_id` for audit fields. Child tables **unchanged**: they continue to use **`org_id` only** for tenant isolation.

Until this extension ships, **`org` retains the only human credentials** for each company.
