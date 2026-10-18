# Digital Dukan project preferences

Use the existing checkout; do not create another worktree unless the user requests it.

The owner is not a developer. Explain required setup in simple Roman Urdu, one step at a time, and provide working clickable links when available. Distinguish screenshots from live previews. Do not claim deployment, email delivery or domain setup was verified without evidence.

Until the move to a personal domain and production hosting, use free resources. Do not introduce a paid API, paid asset, subscription, infrastructure upgrade or hidden per-request charge. Trial credits are temporary, not an unlimited free plan. Keep CPU, memory, storage, network calls and backup retention appropriate for the limited trial environment. Avoid per-store builds/processes and unnecessary remote calls. If a materially better approach is being excluded only because it costs money, explain its benefit and cost dependency to the user before choosing the free fallback.

Prefer curated local themes, reusable sections and local illustrations over paid generation. Preserve owner customization and existing stores. The user explicitly requested a temporary pause of all email verification. Keep `emailVerificationDefault=false` in server.js until they ask to re-enable it; `EMAIL_VERIFICATION_ENABLED` overrides the default. Keep password reset and manual admin approval active, preserve true verification records, and do not auto-enable verification when changing email settings. To re-enable on one prompt, flip that default to true and restore verification UI through the shared session flag. Resend test delivery still only reaches the Resend account email; verify a sender domain before emailing other recipients.

Before deployment changes, run relevant integration/browser checks. Keep credentials, recovery links and customer data out of source control, screenshots and chat. Authorized ongoing implementation can continue under the user's existing GO; a new confirmation is not required for routine fixes.
