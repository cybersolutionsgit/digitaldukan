# Digital Dukan

A responsive store-building platform for Pakistan: email/password signup, free subscription, customizable storefront sections, a seller dashboard, products and image uploads, PKR cash-on-delivery orders sent through WhatsApp, and a separate admin approval panel.

## Run locally

Requires Node.js 24.19.0 or newer. No third-party runtime dependencies.

```sh
npm ci --ignore-scripts
npm start
```

The application listens on port 3000 (or `PORT`). Visit the application in your browser. `npm run dev` enables Node's development watcher. `npm test` runs the integration workflow against a temporary database, including accounts, approval, orders and authorization checks.

SQLite database and uploaded images are in `DATA_DIR` (default `./data`), which is ignored by Git. Back up this directory using a SQLite-aware backup process and include the uploads folder. Live processes are not preserved by cloud snapshots.

## Admin account

Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in your hosting environment settings before startup. Choose your own password of at least 12 characters; no default production admin credentials are included. Startup creates the admin account once. Existing admin passwords are not overwritten on restart, so password resets stay valid. Use the password-reset flow to change an existing admin password; editing ADMIN_PASSWORD alone is not a password-change operation. An owner account cannot be promoted by reusing its email. Admins and sellers sign in at `/login`; admins are redirected to `/admin`.

Do not add actual credentials to `.env.example`, source code, GitHub, or chat. Node does not automatically load a `.env` file: set environment variables through hosting settings, your shell, or `node --env-file=.env server.js` when running locally.

## Render: beginner deployment guide

1. Open https://dashboard.render.com/ and create an account using GitHub.
2. Choose **New → Web Service**, connect GitHub, and select `cybersolutionsgit/digitaldukan`.
3. Use branch `main`, runtime **Node**, build command `npm ci --ignore-scripts`, and start command `npm start`.
4. Add environment variables: `NODE_VERSION=24.19.0`, `NODE_ENV=production`, `DATA_DIR=./data`, and your own `ADMIN_EMAIL` and `ADMIN_PASSWORD` (minimum 12 characters). Enter credentials privately in Render.
5. Choose a **Free** instance for a temporary demo. Deploy and wait for **Live**. Render supplies the actual public HTTPS address; do not assume a particular available service name.
6. Open that address to test the homepage. Create a store, add products in the dashboard, sign in with your admin email, approve the store, and then place a test WhatsApp order.
7. For later changes, Render can automatically redeploy updates pushed to GitHub.

Alternatively, `render.yaml` is a Render Blueprint for the same free demo. It prompts for admin credentials. `healthCheckPath` uses `/api/site`.

**Free Render storage is ephemeral. Accounts, orders and uploaded photos can be lost on restart or redeployment. Do not collect real customer data on this configuration.** The free subscription describes what Digital Dukan charges its store owners; hosting costs are separate. For real use, upgrade to a Render service supporting a persistent disk, attach a disk at `/var/data`, and change `DATA_DIR` to `/var/data/digitaldukan`. Keep the application at one instance with SQLite. Confirm current Render pricing in its dashboard before choosing a paid plan. A persistent disk requires payment and is not included in the free Blueprint. Managed database/object storage would be another implementation option, not currently integrated.

## Store addresses and custom domains

Initially each store is available at `https://<your-render-address>/s/<chosen-store-name>`. A Render service address does not provide arbitrary per-user subdomains.

To use `shop.yourdomain.com`, acquire a domain, configure wildcard DNS and HTTPS routing to the application, and set `BASE_DOMAIN=yourdomain.com`. The app resolves the subdomain to its store. Domain/DNS/TLS setup must be completed separately in the hosting provider; setting the variable alone does not configure DNS. Pending previews should be accessed through the main domain's `/s/<slug>` path using the authenticated owner/admin session.

## Included workflows

- Homepage signup entry and English/Roman Urdu switch on public platform pages only. Dashboards and storefronts remain English.
- Four-step signup: account, store details, eight section types with three layout choices, and explicit **Subscribe — Free** activation.
- One store per account, a unique address, pending approval and private authenticated preview.
- Editor: choose and reorder sections, customize heading/text, and update branding, contact/social links, delivery/returns details. Image uploads are supported in the owner dashboard; signup images can be skipped and added later.
- Products: price, optional sale price, stock, up to eight photos, category, description, sizes and colors. Uploads accept PNG/JPEG/WebP under 2 MB.
- Cart and checkout: customer name/phone/address, server-calculated PKR total and fixed seller-configured delivery charge, saved order and WhatsApp link. The customer must press Send in WhatsApp.
- Orders: New / Confirmed / Delivered / Cancelled. Stock is seller-managed and checked per order; stock is not automatically reserved or reduced across orders.
- Admin: private preview, approve/reject with reason, suspend/reactivate. Normal edits remain live after approval. Rejected stores can resubmit.
- Reviews section is editable text for real feedback; no fabricated customer reviews or review collection system.

## Current limitations

No payment gateway, subscription billing, shipping integration, custom-domain provisioning, managed database integration, or automated offsite backup destination. Use your own uploaded photographs; the demo storefront's illustrations and products are examples, not actual inventory. Render account linking and deployment need to be completed by the account owner. The tests validate the local implementation; they do not establish live hosting or DNS readiness.

### Browser regression checks

Run `npm run test:browser` after installing Chromium with `npx playwright install chromium`, or set `CHROMIUM_PATH` to an existing Chromium executable. The browser tests use their own temporary database and verify signed-in owner/admin navigation, login/signup redirects, reloads, a second tab, language switching and logout. The tests never use production accounts or data. Playwright is a development dependency only.


## Email verification and password recovery

In Railway → service → Variables, privately set:

| Variable | Value |
| --- | --- |
| `APP_URL` | `https://digitaldukan-production.up.railway.app` (change when moving domains) |
| `RESEND_API_KEY` | Your Resend API key, entered privately; never commit or share it in chat |
| `MAIL_FROM` | Testing: `Digital Dukan <onboarding@resend.dev>`; production: a sender on your verified domain |

Create your account at https://resend.com/signup and obtain an API key in its dashboard. The testing sender can only email your Resend account address. Other recipients need a verified sender domain; public email onboarding must wait for that configuration. Email delivery is handled through Resend's HTTPS API, not SMTP.

Signup attempts to send a verification email after creating the account. If delivery is unavailable, the account still exists and the dashboard provides a resend button. Owners may build and preview while unverified. Email verification is required for first approval; already-approved stores keep their status. The dashboard's email notice also applies to existing owner accounts. Bootstrap admin configuration is trusted and marks that admin verified.

- `/forgot-password` requests recovery with a generic response for unknown/known accounts.
- `/reset-password#token=…` lets the recipient set a new password; all previous sessions and links are revoked.
- `/verify-email#token=…` confirms the email through an explicit button.
- Reset requests allow one accepted request per minute and ten per email in a 15-minute window. Rejected cooldown attempts do not consume the longer-window allowance; errors include remaining wait time. The separate shared abuse limit remains in place.
- Reset links expire after 30 minutes; verification links after 24 hours. New successfully delivered links replace earlier links of the same type.

The code does not print secret keys or recovery links. `EMAIL_TRANSPORT=test` only works with `NODE_ENV=test` and writes private test fixtures under DATA_DIR/test-outbox. Never use test mode for your public service. Real delivery must be tested with the configured sender and an allowed inbox before launch.

## Backups and restoring

Admin panel → **Backups** provides **Create backup** and **Download backup**. Archives include the database and all uploaded photos. The application takes an automatic startup snapshot after 60 seconds if no backup newer than 24 hours exists, then checks hourly for the next daily snapshot. `AUTO_BACKUPS=false` disables scheduling; default `BACKUP_KEEP=3` retains three archives (maximum 10). Set `BACKUP_DIR` only to a private persistent location; by default it is DATA_DIR/backups. Node.js 24 and the system `tar` executable are required.

These are local copies on the same volume. Download a copy outside Railway after important changes. Keep it private in encrypted/protected storage: it includes customer addresses and password hashes. Trial expiry and provider data-retention limits apply to the entire volume, including local backups. The admin panel shows the last backup error; insufficient free space blocks creation instead of deleting existing data first. Interrupted staging files may need administrator cleanup after a crash.

To restore (an administrator/developer operation):

1. Stop the application and preserve the current DATA_DIR. Do not overwrite the live directory.
2. Copy a trusted downloaded archive to the host. Run:

   ```sh
   npm run restore -- /path/to/dukan-backup.tar.gz /empty/restored-data
   ```

3. The command checks checksums/database integrity and clears restored login sessions/account tokens.
4. Set `DATA_DIR=/empty/restored-data` and restart. Verify accounts, storefronts, orders and photos before removing old data.

Read [the application security review](docs/SECURITY_REVIEW.md) for findings, tested protections and remaining operational requirements. The automatic-backup test deliberately waits about one minute, so `npm test` now takes longer. `npm run test:browser` covers recovery, verification and the admin backup UI in isolated data.

### Admin-assisted owner account recovery

In Admin → Store approvals, open **Owner account** for the correct store. Correct the email, set and confirm a new owner password (or leave password fields blank to retain it), and confirm your own current admin password. Only store-owner accounts can be changed through this endpoint. Duplicate emails are rejected, passwords are never displayed or returned, and the owner's sessions/recovery links are revoked when saving. A changed email loses its verification state and receives a verification message if delivery is configured; otherwise the owner can resend after signing in. Products, orders and store publication status stay intact. Metadata-only audit events record the acting admin, target account, action and time. When supporting real owners, confirm that the recovery request is legitimate before changing their credentials.
