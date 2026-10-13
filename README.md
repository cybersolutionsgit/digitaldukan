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

Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in your hosting environment settings before startup. Choose your own password of at least 12 characters; no default production admin credentials are included. Startup creates the admin account, or updates its password when the configured password changes. An owner account cannot be promoted by reusing its email. Admins and sellers sign in at `/login`; admins are redirected to `/admin`.

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

No email verification, password reset email, payment gateway, subscription billing, shipping integration, custom-domain provisioning, or managed database integration. Use your own uploaded photographs; the demo storefront's illustrations and products are examples, not actual inventory. Render account linking and deployment need to be completed by the account owner. The tests validate the local implementation; they do not establish live hosting or DNS readiness.
