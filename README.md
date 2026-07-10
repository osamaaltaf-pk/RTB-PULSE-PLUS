# RTB Route Board

A single-page tool to run one caller ID (and optional zip) against every
configured buyer/RTB route, plus a password-gated `/admin.html` to add,
edit, and delete routes.

## How data works

- Routes and sources are stored **only in the browser** via `localStorage`
  (`js/defaults.js`). Nothing is written to a database. Each browser/device
  keeps its own copy, seeded from `DEFAULT_CONFIG` on first load.
- Use **Export backup** / **Import backup** on the admin page to move config
  between browsers or back it up.
- The only server-side code is two small serverless functions (below) —
  there is no database.

## Serverless functions (`/api`)

- **`api/admin-auth.js`** — checks the admin password against the
  `ADMIN_PASSWORD` environment variable (timing-safe comparison). The
  password never appears in client-side code.
- **`api/proxy.js`** — forwards the RTB check requests server-side so the
  browser doesn't hit CORS issues. It only allows requests to hostnames
  listed in `PROXY_ALLOWED_HOSTS` (defaults to `rtb.moja.cloud`) to prevent
  it being abused as an open proxy.

## Deploying on Vercel

1. Push this repo to GitHub (see below) and import it in Vercel
   ("Add New Project" → select the repo). No framework preset needed —
   Vercel auto-detects the static files + `/api` functions.
2. In **Project Settings → Environment Variables**, add:
   - `ADMIN_PASSWORD` — the password you'll use to unlock `/admin.html`
   - `PROXY_ALLOWED_HOSTS` — optional, only needed if you add routes on a
     domain other than `rtb.moja.cloud` (comma-separated list)
3. Deploy. Your site is at `/`, admin panel at `/admin.html`.

## Adding new buyer routes

Go to `/admin.html`, enter the admin password, then:

1. **Add source** if the buyer/publisher isn't listed yet (name + color).
2. **Add route** — pick the source, name the route (e.g. "Bathrooms"),
   paste the RTB URL with `{{CALLER_ID}}` and/or `{{ZIP}}` placeholders
   exactly where those values belong, and check which fields it needs.

Example (caller ID only, no zip):
```
https://rtb.moja.cloud/inbound_rtb/inbound_rtb_1780612426732_3aaf8557?CALLER_ID={{CALLER_ID}}
```

## Note on the admin password gate

The gate protects the admin **UI**; since all config lives in each
browser's `localStorage` (by design — no server storage), there's no
server-side session/token beyond the initial password check. That's an
intentional tradeoff for a small internal tool. If you ever need stronger
access control (multiple admins, audit log, shared config across devices),
that would require adding a real backend/database, which is a bigger
change from the current "no data stored" setup.
