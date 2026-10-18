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

- Homepage signup entry and English/Roman Urdu switch throughout the platform, signup, owner dashboard and admin panel. Merchant storefronts and owner-entered content retain their own language. Switching language preserves in-progress form edits.
- Four-step signup: account, store details, 30 category themes, five complete homepage styles, and eight section types with five layout choices each, and explicit **Subscribe — Free** activation.
- One store per account, a unique address, pending approval and private authenticated preview.
- Editor: choose and reorder sections, customize heading/text, and update branding, contact/social links, delivery/returns details. Image uploads are supported in the owner dashboard; signup images can be skipped and added later.
- Products: price, optional sale price, stock, up to eight photos, category, description and two optional custom product options (for example Weight/Flavor, with comma-separated values). Existing Size/Color data remains compatible, and checkout snapshots the labels in the saved order and WhatsApp message. Dashboard uploads accept PNG/JPEG/WebP originals up to 15 MB and resize them to a maximum 1600px WebP in the browser; the server still enforces 2 MB per uploaded result and the existing owner/global storage quotas.
- Cart and checkout: customer name/phone/address, server-calculated PKR total and fixed seller-configured delivery charge, saved order and WhatsApp link. The customer must press Send in WhatsApp.
- Orders: New / Confirmed / Delivered / Cancelled. Stock is seller-managed and checked per order; stock is not automatically reserved or reduced across orders.
- Admin: private preview, approve/reject with reason, suspend/reactivate. Design and store-information edits save privately until Publish changes. Product and order changes remain immediate. First approval publishes the reviewed design; reactivation preserves the published version. Rejected stores can resubmit.
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

**Temporarily paused at the owner’s request:** signup/email changes do not send verification mail, verification endpoints and reminders are disabled, and first approval does not require email verification. Manual admin approval and password reset stay active. Existing verification records are preserved. To re-enable in one code change, set `emailVerificationDefault=true` in `server.js` and deploy; the optional `EMAIL_VERIFICATION_ENABLED=true/false` hosting variable overrides that default. Re-enabling restores first-approval checks for pending stores without taking approved stores offline.

When enabled, signup attempts to send a verification email after creating the account. If delivery is unavailable, the account still exists and the dashboard provides a resend button. Owners may build and preview while unverified. Email verification is required for first approval; already-approved stores keep their status. The dashboard's email notice also applies to existing owner accounts. Bootstrap admin configuration is trusted and marks that admin verified.

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

In Admin → Store approvals, open **Owner account** for the correct store. Correct the email, set and confirm a new owner password (or leave password fields blank to retain it), and confirm your own current admin password. Only store-owner accounts can be changed through this endpoint. Duplicate emails are rejected, passwords are never displayed or returned, and the owner's sessions/recovery links are revoked when saving. A changed email loses its verification state and, when verification is enabled, receives a verification message if delivery is configured; otherwise the owner can resend after signing in. Products, orders and store publication status stay intact. Metadata-only audit events record the acting admin, target account, action and time. When supporting real owners, confirm that the recovery request is legitimate before changing their credentials.

## Niche-based themes (free resources)

Signup → Store details requires a category and a specific niche, such as skincare, bakery or women clothing. Local keyword/category matching recommends a curated theme, colors and section layouts. Thirty category presets cover fashion, jewelry, footwear, bags, kids, toys, books, home, furniture, kitchen, plants, beauty, salons, wellness, groceries, bakery, coffee, restaurants, electronics, sports, travel, pets, art, gifts, automotive, tools, office, events, digital/creative services and a neutral fallback. Owners can select a different theme, customize their brand color, choose other sections, and view the actual themed layouts before subscribing. Sample products shown in the picker are examples, not generated inventory or claims.

Existing stores keep their classic theme until the owner chooses a new one. In **Store details**, select a theme or use **Use suggested theme**, then save. In **Store editor**, **Use suggested sections** updates the selection/layouts; save the homepage to apply it. Existing headings/text for retained sections and custom brand colors are preserved. Changing a niche after manually choosing signup sections keeps those choices unless the owner explicitly reapplies recommendations.

All presets, sample data and SVG illustrations are local. All 30 default category photographs are cached locally as optimized WebP files (about 5.3 MiB total). They are shared across stores and need no external image request. Future uncached additions have an Unsplash CDN fallback. No paid AI API, paid assets, per-store process or per-store build is introduced. The MIT QR module is vendored locally and loaded only on demand. Store choices are small JSON fields in the existing database. Unsupported niches get a neutral theme rather than a misleading automatic promise. Additional curated niches can be added without a paid service.

The user's standing cost preference is recorded in AGENTS.md: free resources until the move to a personal domain/production hosting, with trial limits disclosed and materially better paid-only alternatives explained before any decision. Railway trial credits remain finite; this implementation does not turn the trial into permanent free hosting.


## Premium template studio

- `/templates` is the searchable 30-category gallery. Each category has a sample store preview and signup shortcut; `/demo?kit=bakery&layout=4` previews a complete sample design without an account.
- Forty shared section compositions (8 types × 5 layouts) adapt to the selected category's typography, accent, heading, sample collections and photography. This is not 1,200 independently hand-authored templates. All 30 categories expose five choices for every section.
- Signup offers five coordinated homepage recipes with real section thumbnails and larger page previews. Owners can still choose any individual section/layout. Recommendations preserve retained owner text/images.
- The owner Design Studio offers live desktop/mobile preview, inline headline and introductory text editing, image controls for every selected section, free stock-photo selection, uploads, separate desktop/mobile crop focus, brand color, undo for the current editing session, unsaved-change protection and restore-published-design.
- Save homepage / Save store details updates a private draft. Owners/admins see this draft at `/s/<slug>`; visitors receive the published snapshot, and authenticated owners can use `?published=1` to inspect it. `Publish changes` copies the saved design to the public snapshot. Initial admin approval publishes the reviewed saved design. Approval requirements are unchanged. Publishing while pending never makes a store public.
- Publishing requires a product. Products, prices, stock and orders are not versioned: they update immediately. Checkout uses the published WhatsApp number and delivery charges so a private settings draft cannot silently change a visitor's order total.
- The owner setup checklist, launch check, copy/share link and local downloadable QR SVG guide a first store launch. Launch warnings are informational; external links are format-validated, not remotely crawled or guaranteed reachable.
- Google/sharing settings provide server-rendered page title, description, Open Graph metadata, favicon and canonical URL when APP_URL is configured. Unapproved stores are noindex. Search engines and social crawlers control refresh timing.
- The platform has a restrained minimalist UI and short action transitions. Reduced-motion disables animation. Fonts use local system fallbacks rather than external Google Fonts.
- Existing data is migrated with additive SQLite columns. Existing published stores retain their last public details when a first draft is saved. Stock remains manually managed.

Photograph access/review status and the optional bounded `npm run cache:stock` step are documented in [docs/STOCK_PHOTOS.md](docs/STOCK_PHOTOS.md). No photo API key or subscription is required. QR attribution is in [docs/THIRD_PARTY.md](docs/THIRD_PARTY.md).

## Product semantics and consistent cards

Sample inventory is now curated in `public/samples.js` and shared by individual section thumbnails, complete homepage previews and theme demos. Product photos are assigned to specific visible items; lifestyle/room/people photos are reserved for appropriate section or service contexts. Samples never populate or overwrite an owner's inventory. When no matching product photograph is available, an explicit neutral placeholder is shown. New photograph sources are recorded in `docs/PRODUCT_PHOTOS.json`; these optimized WebP assets are bundled and shared across stores.

Featured sections render their own heading/introduction without replacing the first product's title or description. Category tiles filter the visible catalogue, show the selected category/count, and offer Show all. Longer product descriptions are available from the product-title details dialog; thumbnails change the selected product photo.

Product cards stretch equally across every row of a selected layout. Media areas use a consistent size with `object-fit: contain`, title/description slots have a stable height, and actions align at the bottom. The previous first-product oversizing was removed. The fifth layout retains horizontal cards on desktop and uses consistent vertical cards on mobile. Category artwork is contained in its own section and cannot float into the following product grid. Eyebrow text is light only in the actual dark sections.

Store details now include **Selling mode**: Products (cash on delivery) or Services (WhatsApp enquiry). Digital/creative demo themes default to enquiries; an explicit owner choice takes precedence. Service pages use enquiry copy instead of physical-delivery promises. Their saved requests need name/phone and optional requirements, use a server-calculated indicative amount with no delivery fee, and do not confirm a booking or collect a payment. Retail orders retain required delivery addresses, server-calculated delivery charges and COD. Published settings determine the mode; client-provided mode, prices and delivery values cannot override it. Enquiries are identified separately in the owner's order panel and their indicative values are excluded from delivered retail-order totals.

Digital Dukan's new shop/growth/pixel identity is documented in [docs/branding/README.md](docs/branding/README.md). The running site uses compact local SVG assets; the generation concept is only a design reference.

## Delete a store (administrator)

In Admin → Store approvals, choose **Delete store**. Confirm the exact store address and your current admin password. The operation permanently deletes that store, products, orders, the owner login, sessions and recovery tokens in a single database transaction. Unused uploads owned by that account are removed; images still referenced by other stores are retained. The owner email and store address can then be used for a fresh signup. Other stores and admin accounts stay intact. Existing backup archives retain historical data until their normal expiry; this is not an erasure of backups. A metadata-only deletion audit entry is retained. Use Suspend instead if the store may need to return.

## Signup and editor usability

New signups require business name, WhatsApp, category/niche, description, address, delivery information, returns policy and valid delivery charges. Images and social media stay optional. Category/theme dropdowns sort A–Z; passwords have a visibility button. The website URL textbox is removed; existing website values are preserved when saving store details. Legacy accounts remain usable without a destructive data migration; completing required fields is prompted when editing their store details.

Logo/banner uploads show previews before signup and are held only in browser memory until submission (refreshing the page clears this temporary draft). The browser optimizes photos to WebP, at most 1600px and approximately 900 KB per result. Signup validates and creates the account, store and supplied images together; failures roll back the account and remove newly written files. The existing 3 MB request limit, 32 MB owner quota and 64 MB shared photo quota remain. Dashboard, product, SEO and section-image controls use the same upload/preview approach without requiring image URLs.

The selected complete-homepage style is highlighted and follows the actual section layouts. Each signup step starts at the top. Product setup is the second-last setup checklist item. The Design Studio edits section text directly in the live preview and opens an image panel from a photo or Change image button, with upload, alt text, crop focus and theme-image reset. Section values retain undo/draft/publish behavior without a duplicate visible Section content form. The free photo library exposes all 66 cached category/product photos, with search, category filtering and an All categories option; no paid API or new remote photo service is used.

## Page navigation and brand color roles

Long public pages, store pages and dashboards show floating bottom/top controls. The controls follow a long open dialog or an actively used editor preview instead of scrolling the page behind it, hide on short content, respect reduced-motion settings and support keyboard use. Platform labels also support Roman Urdu.

Signup, Store details and the Design Studio offer Primary (`accent`, kept for compatibility), Secondary (`secondaryColor`) and Text (`textColor`) colors with a live palette sample. Primary creates the page tint, accents and buttons; secondary defines hero/promotion surfaces. The shared local color resolver keeps those surfaces distinct and adjusts foreground shades for at least 4.5:1 text contrast on its solid page/card/banner/button surfaces. Full-photo covers use a dark overlay and white text. Chosen hex values remain unchanged in saved data; adjusted display shades are explained next to the controls. Color changes follow the existing draft/undo/publish flow and legacy stores resolve missing fields from their theme. No migration, remote color API or paid resource is required.

## Early signup feedback and simple form hints

The public signup label **Username** still uses the existing `slug` field internally, so current store URLs and stored accounts remain compatible. The same lowercase name is suitable for a future `username.yourdomain.com` address after domain/wildcard DNS/HTTPS setup. Rules are shared by the browser and server: 4–40 lowercase letters/numbers, optional internal hyphens, no spaces or reserved names.

Signup validates formats beside the current field while typing or leaving it, and validates the whole visible step before continuing. Email/username availability is checked before leaving their step through a bounded, rate-limited `/api/signup/check` request; passwords are not sent to this endpoint. Final submission still rechecks uniqueness to handle races. Social links use the same normalization as final signup, including links without `https://`. No email verification is enabled by these availability checks.

Text fields and textareas show short English/Roman Urdu examples with the language switch; changing language preserves typed values. Errors appear beside the field and are associated with it for assistive technology. New products and product edits require at least one valid photo (up to eight) in both the browser and API. Legacy photo-free products remain viewable until edited; existing photos are not removed by this update. Signup logo/banner images and social links remain optional.
