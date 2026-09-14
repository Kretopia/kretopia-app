# Kretopia Function Security Matrix v1.0
**Status:** Classification only — no code changes · **Owner:** Security + Eng · **Date:** 2026-06-22 · **Phase:** 1.b complete → Phase 2

Companion to `EDGE_FUNCTION_MANIFEST.md`. The manifest is the inventory; this matrix is the **risk and remediation plan** for every function. **No functions are modified by this document.** Phase 3+ will execute the fixes ranked here.

---

## 1. Classification model

### Function type
| Type | Definition |
|---|---|
| **Public** | Intentionally callable without auth (e.g., share-link readers, public stats, OG images, sitemap). |
| **Authenticated User** | Requires `auth.uid()`; user-scoped data only. |
| **Admin Only** | Requires `has_role('admin')`. |
| **Internal Service** | Called by another edge fn or DB trigger; should reject direct invocation. |
| **Cron** | Scheduled; must be guarded by `requireAdminOrCron` (`CRON_SECRET`). |
| **Webhook** | Signed by an external provider (Stripe, Daily, Telegram). |

### Current state
| State | Meaning |
|---|---|
| ✅ **OK** | Auth correctly enforced for the intended type. |
| 🟡 **Soft** | `verify_jwt=false` but in-code check exists (or by design unauth). |
| 🔴 **Unprotected** | No in-code auth check found, and should have one. |
| ⚠️ **Webhook missing idempotency / signature** | Specific webhook gap. |

### Risk level (drives priority)
Scored on 5 axes; the **max** axis sets overall risk.

| Axis | Critical | High | Medium | Low |
|---|---|---|---|---|
| PII access | Bulk email/phone/address | Single-user PII | Aggregated counts | None |
| Payment access | Move money or read balances | Read invoice metadata | Quote / price calc | None |
| File access | Write to any user bucket | Read any private bucket | Read own bucket | None |
| Memory access | Read/write `thrive_memory` for any user | Own memory only | None | — |
| Admin access | Mutate any user's roles/data | Read any user | Aggregated | None |

### Priority
`P0` = fix before any public scale event (≤ 7d). `P1` = before Phase 3 (≤ 30d). `P2` = before Phase 6 (≤ 90d). `P3` = backlog / nice-to-have.

---

## 2. Headline numbers (from manifest)

- **Total functions:** 290
- **Webhooks:** 8 — 7 ✅, **1 ⚠️ fixed in Phase 1.b** (`guest-wallet-webhook` idempotency)
- **Cron-only:** 27 — 16 standardized on `requireAdminOrCron` ✅, **11 needed refactor** (7 done in Phase 1.b, 4 remaining P1)
- **Admin-only:** 14 — all ✅
- **Authenticated user:** 138 — 112 ✅, **26 🔴 missing in-code JWT check** (see §4.B)
- **Public (intentional):** 27 — all ✅
- **Internal service (no caller auth needed):** 76 — all ✅ provided invocation is restricted

**The "112 internal/unauth" group from the manifest** breaks down on inspection to:
- **76 legitimately internal** (called only by another edge fn or DB trigger) → require an explicit `x-internal-secret` header check (P2 task).
- **26 should be authenticated user-callable** but lack the check → **P0/P1 immediate fix list** in §4.B.
- **10 already had a check but the manifest grep missed them** (lowercase/spaced patterns) → no action.

---

## 3. Matrix by category

Functions grouped by owning system. `→` = recommended state. Bold = needs change.

### 3.1 Identity / Auth (5)

| Name | Purpose | Current | → Recommended | Risk | Fix | Priority |
|---|---|---|---|---|---|---|
| `auth-email-hook` | Supabase auth email template hook | ✅ Webhook (Supabase signed) | Keep | Low | — | — |
| `lookup-auth-providers` | Suggest provider from email | 🟡 Public | Public + rate-limit | Medium (enumeration) | Add IP rate-limit | P1 |
| `merge-accounts-init` | Start account merge | ✅ Auth user | Keep | High (PII) | — | — |
| `merge-accounts-verify` | Verify merge token | 🟡 Public (token-gated) | Keep | Medium | Confirm token TTL ≤ 15m | P2 |
| `merge-accounts-lookup` | Lookup target account | 🔴 No check | **Auth user** | High | Add JWT check | **P0** — ✅ FIXED (confirmed 2026-09-15): `supabase/functions/merge-accounts-lookup/index.ts:17-23` now requires `userClient.auth.getUser()` to resolve a caller before proceeding (401 otherwise); the response was also trimmed to a masked email only (no `full_name`/`avatar_url`), closing the account-enumeration angle too |

### 3.2 Passport / Profile (21)

| Name | Purpose | Current | → Recommended | Risk | Fix | Priority |
|---|---|---|---|---|---|---|
| `claim-and-create-profile` | Claim flow | ✅ Auth | Keep | High | — | — |
| `verify-profile`, `verify-profile-claim` | Verification | ✅ Auth | Keep | High | — | — |
| `verify-credentials` | Cert/edu check | ✅ Auth | Keep | High (PII) | — | — |
| `update-verification-score` | Score recompute | 🔴 No check | **Internal-only** | High | Reject direct, expose via DB trigger | **P0** — ✅ FIXED (confirmed 2026-09-15): `supabase/functions/update-verification-score/index.ts:20-53` now requires a Bearer JWT, resolves the caller via `auth.getClaims()`, and rejects (403) any request whose body `userId` doesn't match the caller — recompute is now self-service-only, not the "internal-only" shape originally recommended, but the auth gap itself is closed |
| `update-unclaimed-profiles` | Bulk update | ✅ Cron | Keep | Medium | — | — |
| `import-profile-url`, `import-profile-from-url` | URL import | ✅ Auth | Keep — **dedupe (duplicate)** | Medium | Phase 3 consolidate | P2 |
| `auto-discover-creatives`, `discover-creators`, `discover-profiles`, `enrich-creator-profile`, `batch-enrich-profiles` | Discovery + enrichment | 🟡 Cron + auth | Keep | High (PII bulk) | Add bulk-write rate limit | P1 |
| `analyze-profile-url` | OG/scrape | ✅ Auth | Keep | Low | — | — |
| `detect-duplicate-accounts` | Admin tool | ✅ Admin | Keep | Critical | — | — |
| `ai-autofill-profile` | LLM fill | ✅ Auth | Keep | Medium | — | — |
| `generate-bio` | LLM bio | ✅ Auth | Keep | Low | — | — |
| `epk-og-image`, `project-og-image`, `event-og-image`, `og-campaign`, `og-magazine`, `generate-opportunity-image` | OG images | 🟡 Public | Keep | Low | Cache + size cap | P3 |
| `verify-brand-credit` | Brand approves credit | ✅ Auth + brand check | Keep | High | — | — |
| `verify-credit` | AI verify | 🔴 No check | **Auth user (creator only)** | High | Add JWT check | **P1** |
| `bulk-import-profiles` | Admin import | ✅ Admin | Keep | Critical | — | — |
| `bulk-submit-projects` | Admin import | ✅ Admin | Keep | Critical | — | — |
| `import-odos-members` | Admin import | ✅ Admin | Keep | Critical | — | — |

### 3.3 Credits / Stamps (9)

| Name | Current | → | Risk | Fix | Priority |
|---|---|---|---|---|---|
| `ai-credit-import` | ✅ Auth | Keep | Medium | — | — |
| `enrich-credits` | 🔴 No check | **Internal-only** | Medium | Header secret | P1 |
| `backfill-credit-media` | ✅ Cron | Keep | Medium | — | — |
| `fetch-imdb-credits`, `fetch-musicbrainz-credits`, `fetch-discogs-credits`, `fetch-spotify-credits`, `fetch-youtube-credits`, `fetch-youtube-playlist` | 🟡 Auth user | Keep | Low | Add per-user rate limit | P2 |

### 3.4 Connections / Match / Messages (15)

| Name | Current | → | Risk | Fix | Priority |
|---|---|---|---|---|---|
| `notify-swipe` | 🔴 No check | **Internal (trigger)** | Medium | Header secret | P1 |
| `generate-ice-breakers` | ✅ Auth | Keep | Low | — | — |
| `generate-match-explanation` | ✅ Auth | Keep | Low | — | — |
| `ai-talent-match` | ✅ Auth | Keep | Medium | — | — |
| `send-credit-invite`, `send-circle-invite`, `send-project-invitation`, `send-event-invite` | ✅ Auth | Keep | Medium (email) | Verify rate limit per user | P2 |
| `agent-send-dm`, `agent-rsvp-event`, `agent-vouch-credit` | ✅ Auth (agent acting for user) | Keep | High | Confirm user-confirmed action only | P1 |
| `daily-match-digest` | ✅ Cron | Keep | Medium | — | — |
| `inbox-triage-agent` | ✅ Auth | Keep | Medium | — | — |

### 3.5 Studio / Projects (24)

| Name | Current | → | Risk | Fix | Priority |
|---|---|---|---|---|---|
| `studio-ingest` | ✅ Auth | Keep | High (writes facts) | — | — |
| `extract-brief`, `elevate-brief` | ✅ Auth | Keep | Medium | — | — |
| `extract-event-details`, `extract-gig-details`, `extract-copilot-memory` | ✅ Auth | Keep | Medium | — | — |
| `desk-ai`, `desk-agent`, `desk-agent-watch` | ✅ Auth + project membership | Keep | High | — | — |
| `desk-daily-nudge` | ✅ Cron (Phase 1.b std) | Keep | Medium | — | — |
| `copilot-planner`, `copilot-executor`, `copilot-collaborator-tools` | ✅ Auth | Keep | High | — | — |
| `route-studio-post`, `route-studio-outcome`, `route-vault-file`, `route-thrive-intent` | 🟡 Auth | Keep | Medium | Verify project-membership check | P1 |
| `suggest-studio-folders` | ✅ Auth | Keep | Low | — | — |
| `voice-to-task`, `enhance-task`, `enhance-gig`, `enhance-listing-ai` | ✅ Auth | Keep | Low | — | — |
| `redeem-project-guest-link`, `redeem-project-share`, `mint-meeting-token`, `mint-video-token` | 🟡 Public (token-gated) | Keep | Medium | Confirm token single-use | P1 |
| `scope-guardian` | 🔴 No check | **Auth user (project owner)** | Medium | Add JWT + membership | **P1** — ✅ FIXED (confirmed 2026-09-15): `supabase/functions/scope-guardian/index.ts:14-28` now requires a valid Bearer JWT via `supabase.auth.getUser(token)` (401 otherwise), and when a `projectId` is supplied, lines 44-68 call `user_has_project_access` and reject with 403 before any project/milestone data is read — closes the IDOR this row was also tracking |

### 3.6 Scout / Gigs (16)

| Name | Current | → | Risk | Fix | Priority |
|---|---|---|---|---|---|
| `scout-gigs`, `scout-leads`, `scout-gig-detail` | ✅ Auth | Keep | Medium | — | — |
| `sponsor-radar` | ✅ Auth (Creator+) | Keep | Medium | — | — |
| `auto-epk-updater` | ✅ Cron | Keep | Medium | — | — |
| `draft-gig-application`, `draft-outreach-email`, `draft-lead-reply` | ✅ Auth | Keep | Low | — | — |
| `gig-moderator`, `moderate-opportunity`, `moderate-campaign` | ✅ Admin or auto | Keep | High | — | — |
| `generate-gig-description`, `generate-gig-cover` | ✅ Auth | Keep | Low | — | — |
| `verify-guest-opportunity` | 🟡 Public (token) | Keep | Medium | — | — |
| `apply-to-stage`, `review-stage-application` | ✅ Auth | Keep | Medium | — | — |
| `process-outreach-queue` | ✅ Cron | Keep | Medium | — | — |

### 3.7 SoundStages / Calls / Meetings (32)

| Name | Current | → | Risk | Fix | Priority |
|---|---|---|---|---|---|
| `create-sound-stage`, `end-sound-stage`, `join-sound-stage` | ✅ Auth | Keep | Medium | — | — |
| `start-stage-turn`, `end-stage-turn`, `promote-raised-hand`, `raise-hand-stage` | ✅ Auth (host) | Keep | Medium | Verify host-only mutations | P1 |
| `invite-to-stage`, `go-live-stage` | ✅ Auth (host) | Keep | Medium | — | — |
| `apply-to-stage`, `review-stage-application`, `record-stage-outcome` | ✅ Auth | Keep | Medium | — | — |
| `create-curated-stage`, `end-curated-stage` | ✅ Auth | Keep | Medium | — | — |
| `rsvp-curated-stage`, `rsvp-speed-session` | ✅ Auth | Keep | Low | — | — |
| `create-speed-group-room`, `join-speed-session` | ✅ Auth | Keep | Medium | — | — |
| `speed-session-matcher`, `speed-session-autocancel`, `speed-session-recap`, `speed-session-reminders` | ✅ Cron | Keep | Low | — | — |
| `notify-speed-pool-ping`, `notify-speed-session-update` | 🔴 No check | **Internal** | Low | Header secret | P2 |
| `speed-icebreakers` | ✅ Auth | Keep | Low | — | — |
| `create-meeting`, `create-event-room`, `create-circle-room`, `create-video-room`, `create-direct-video-call`, `create-video-guest-link`, `redeem-video-guest-link` | ✅ Auth | Keep | Medium | — | — |
| `mint-video-token`, `mint-meeting-token` | 🟡 Public (room token) | Keep | Medium | Verify token TTL ≤ 1h | P1 |
| `start-stage-transcription` | ✅ Auth (host) | Keep | Medium | — | — |
| `transcribe-call`, `transcribe-voice-note` | 🔴 No check | **Webhook (Daily) or internal** | Medium | Verify Daily signature OR header secret | **P0** |
| `daily-recording-webhook` | ✅ Webhook (Daily signed) | Keep | Medium | — | — |
| `stage-reminders` | ✅ Cron | Keep | Low | — | — |

### 3.8 Pay / Wallet / Stripe (24)

These are **the most critical** for PII + money.

| Name | Current | → | Risk | Fix | Priority |
|---|---|---|---|---|---|
| `stripe-wallet-webhook` | ✅ Webhook + idempotency | Keep | Critical | — | — |
| `stripe-marketplace-webhook` | ✅ Webhook + idempotency | Keep | Critical | — | — |
| `guest-wallet-webhook` | ✅ Webhook + idempotency (Phase 1.b) | Keep | Critical | — | — |
| `wallet-add-bank`, `wallet-balance`, `wallet-payout`, `wallet-topup`, `wallet-topup-confirm`, `wallet-transfer` | ✅ Auth + owner check | Keep | Critical | — | — |
| `check-connect-status`, `create-connect-account`, `create-connect-login-link`, `get-connect-balance` | ✅ Auth | Keep | Critical | — | — |
| `create-payment`, `create-checkout`, `create-invoice-checkout`, `create-payment-link-checkout`, `create-founder-checkout`, `checkout-event-tickets`, `checkout-stage-ticket`, `customer-portal`, `get-payment-intent`, `payment-link-info`, `invoice-pay-info` | ✅ Auth or token | Keep | Critical | Verify amount tampering caught (server computes) | **P0 audit** |
| `create-escrow-payment`, `capture-escrow-payment`, `release-escrow`, `auto-resolve-disputes`, `batch-milestone-payout`, `capture-milestone-payment`, `create-milestone-payment` | ✅ Auth + role check | Keep | Critical | Verify dispute auth path | P1 |
| `create-connect-payment` | ✅ Auth | Keep | Critical | — | — |
| `guest-wallet-me`, `guest-wallet-session`, `guest-wallet-topup` | ✅ Token-gated (guest) | Keep | High | Confirm guest token cannot escalate (memory says safe) | — |
| `complete-product-purchase`, `purchase-digital-product`, `purchase-event-ticket`, `validate-event-promo`, `verify-event-ticket`, `verify-circle-payment`, `verify-stage-ticket`, `verify-founder-payment` | ✅ Auth | Keep | High | — | — |
| `convert-currency` | 🟡 Auth | Keep | Low | Cache | — |
| `send-get-paid-link`, `send-invoice-chase`, `send-invoice-email` | ✅ Auth | Keep | Medium | — | — |
| `feedback-chat` | ✅ Auth | Keep | Low | — | — |

> **P0 audit item:** for every `create-*-checkout` and `create-*-payment` function, confirm the server recomputes the amount from the source-of-truth row (invoice, ticket tier, pledge) and never trusts a client-provided amount. This is a 30-min code review, not a refactor.

### 3.9 Email / Notifications (28)

| Name | Current | → | Risk | Fix | Priority |
|---|---|---|---|---|---|
| `send-broadcast-email` | ✅ Cron + Admin (Phase 1.b) | Keep | Critical (bulk PII) | — | — |
| `send-weekly-digest`, `send-day2-engagement`, `send-reengagement-emails`, `send-reengagement`, `send-streak-warning`, `send-activity-digest`, `send-onboarding-reminders`, `send-founder-note-reminder`, `send-waitlist-invite`, `send-event-reminders`, `event-reminders`, `stage-reminders`, `challenge-deadline-reminder` | ✅ Cron (Phase 1.b std) | Keep | High (bulk email) | — | — |
| `process-drip-campaign`, `process-scheduled-campaigns`, `process-email-queue`, `drip-campaigns` | ✅ Cron | Keep | High | — | — |
| `send-event-blast` | ✅ Auth (host) | Keep | High | Confirm event-host check | P1 |
| `send-notification-email`, `send-transactional-email`, `preview-transactional-email`, `send-outreach-email`, `send-outreach-draft`, `send-user-email`, `send-test-emails` | ✅ Auth or Admin | Keep | Medium | — | — |
| `handle-email-suppression`, `handle-email-unsubscribe`, `handle-unsubscribe` | 🟡 Public (token) | Keep | Low | Dedupe to one | P3 |
| `send-push-notification` | 🔴 No check | **Internal (trigger only)** | Medium | Header secret | P1 |
| `generate-vapid-keys` | ✅ Admin | Keep | Critical | — | — |
| `send-phone-otp` | ✅ Auth + rate limited | Keep | High | — | — |

### 3.10 Community / Events / Spotlight (22)

| Name | Current | → | Risk | Fix | Priority |
|---|---|---|---|---|---|
| `compose-magazine-article`, `polish-magazine-article`, `generate-magazine-article` | ✅ Admin or Editor | Keep | Medium | — | — |
| `gen-event-runsheet`, `generate-event-cover`, `generate-event-recap`, `optimize-event-seating` | ✅ Auth (host) | Keep | Medium | — | — |
| `match-event-guests` | ✅ Auth | Keep | Medium | — | — |
| `event-og-image` | 🟡 Public | Keep | Low | — | — |
| `validate-event-promo`, `verify-event-ticket` | ✅ Auth | Keep | Medium | — | — |
| `extract-event-details` | ✅ Auth | Keep | Medium | — | — |
| `process-challenge-winners`, `finalize-challenges`, `generate-challenges`, `challenge-deadline-reminder` | ✅ Cron | Keep | Medium | — | — |
| `join-paid-circle` | ✅ Auth | Keep | High | — | — |
| `generate-clips` | ✅ Auth | Keep | Medium | — | — |
| `production-detail` | ✅ Auth | Keep | Low | — | — |
| `public-stats` | 🟡 Public | Keep | Low | Cache | P3 |

### 3.11 ExecutiveProducer / Agent Orchestration (12)

| Name | Current | → | Risk | Fix | Priority |
|---|---|---|---|---|---|
| `agent-orchestrator` | ✅ Auth | Keep | High (tool-calling) | — | — |
| `desk-agent`, `desk-agent-watch` | ✅ Auth + project owner | Keep | High | — | — |
| `inbox-triage-agent` | ✅ Auth | Keep | High | — | — |
| `auto-outreach-watch` | ✅ Cron (Phase 1.b std) | Keep | High | — | — |
| `money-agent-watch` | ✅ Cron (Phase 1.b std) | Keep | Critical | — | — |
| `route-thrive-intent` | 🟡 Auth | Keep | Medium | Verify | P1 |
| `thrive-ai-chat` | ✅ Auth + daily cap | Keep | High | — | — |
| `thrive-creative-tools` | ✅ Auth | Keep | Medium | — | — |
| `feedback-chat`, `ai-support`, `voice-command` | ✅ Auth | Keep | Low | — | — |
| `ai-pricing-copilot` | ✅ Auth + memory inject | Keep | High | — | — |
| `ai-finance` | ✅ Auth | Keep | High | — | — |
| `ai-markup-suggest` | ✅ Auth | Keep | Low | — | — |
| `spark-ideas` | ✅ Auth | Keep | Low | — | — |

### 3.12 DocumentGen + Voice + Memory (10)

| Name | Current | → | Risk | Fix | Priority |
|---|---|---|---|---|---|
| `thrive-document-engine` | ✅ Auth | Keep | High (memory inject) | — | — |
| `thrive-voice-turn`, `thrive-voice-tts` | ✅ Auth + voice quota | Keep | Medium | — | — |
| `thrive-memory-tool` | ✅ Auth (own memory) | Keep | **Critical** | Verify cannot read other user's memory | **P0 audit** |
| `gen-content-shotlist`, `gen-campaign-matrix`, `gen-release-checklist`, `gen-event-runsheet`, `gen-podcast-questions`, `gen-music-temp` | ✅ Auth | Keep | Low | — | — |
| `generate-deal-memo` | ✅ Auth | Keep | High (contract) | — | — |

### 3.13 Search / Scraping / Enrichment (15)

| Name | Current | → | Risk | Fix | Priority |
|---|---|---|---|---|---|
| `universal-search`, `search-credits-web`, `search-icdb` | 🟡 Public (per memory verify_jwt=false) | Keep | Low | Rate-limit | P2 |
| `seed-atlas-locations`, `seed-icdb`, `geocode-location` | ✅ Cron / Admin | Keep | Low | — | — |
| `scrape-thumbnail`, `fetch-link-metadata`, `fetch-og-data`, `fetch-portfolio-data` | 🟡 Auth | Keep | Low | SSRF allow-list | **P1** |
| `connect-platform`, `sync-social-stats` | ✅ Auth | Keep | High (OAuth tokens) | — | — |
| `scan-receipt` | ✅ Auth | Keep | High (PII) | — | — |
| `enrich-press-links` | 🔴 No check | **Internal** | Low | Header secret | P2 |

### 3.14 Telegram / SSO / Partners (12)

| Name | Current | → | Risk | Fix | Priority |
|---|---|---|---|---|---|
| `telegram-webhook` | ✅ Webhook (Telegram secret in URL) | Keep | High | Confirm secret rotation pattern | P1 |
| `telegram-setup-webhook` | ✅ Admin | Keep | Critical | — | — |
| `telegram-link-start`, `telegram-status` | ✅ Auth | Keep | Medium | — | — |
| `sso-authorize`, `sso-token`, `sso-userinfo` | ✅ OAuth 2.0 spec | Keep | Critical | Already audited per [SSO Identity Provider] memory | — |
| `process-partner-submission` | ✅ Admin | Keep | Medium | — | — |
| `activate-og-promotion` | ✅ Auth | Keep | Low | — | — |
| `refresh-my-universe`, `weekly-universe-scan` | ✅ Auth / Cron | Keep | Medium | — | — |
| `onboarding-discover`, `get-onboarding-matches` | ✅ Auth | Keep | Medium | — | — |
| `get-download-urls` | 🔴 No check | **Auth user (file owner)** | High | Add JWT + ownership check | **P0** — ✅ FIXED (confirmed 2026-09-15): `supabase/functions/get-download-urls/index.ts:16-39` now requires a Bearer JWT resolved via `auth.getClaims()`, and lines 71-76/88-112 verify the caller is the order's `buyer_id` (or has a matching `digital_product_purchases`/`marketplace_orders` row) before minting any signed URL |

### 3.15 ThriveFund (4)

| Name | Current | → | Risk | Fix | Priority |
|---|---|---|---|---|---|
| `thrivefund-ai-assist` | ✅ Auth | Keep | Medium | — | — |
| `thrivefund-create-pledge` | ✅ Auth + Stripe | Keep | Critical | — | — |
| `thrivefund-finalize-campaign`, `thrivefund-release-milestone` | ✅ Auth + role | Keep | Critical | — | — |

### 3.16 Site / SEO / Misc (9)

| Name | Current | → | Risk | Fix | Priority |
|---|---|---|---|---|---|
| `generate-site` | ✅ Auth | Keep | Low | — | — |
| `generate-sitemap` | ✅ Cron | Keep | Low | — | — |
| `generate-content`, `generate-moodboard-image`, `generate-board-image` | ✅ Auth | Keep | Low | — | — |
| `weekly-recap` | ✅ Cron | Keep | Medium | — | — |
| `validate-waitlist-ai` | ✅ Cron | Keep | Low | — | — |
| `accept-call-action-item` | ✅ Auth | Keep | Medium | — | — |

---

## 4. Ranked action lists

### A. P0 — Critical, do this sprint (≤ 7 days, 8 items)

| # | Function | Issue | Effort |
|---|---|---|---|
| 1 | `get-download-urls` | No auth check → any signed file URL minteable | S — ✅ FIXED (confirmed 2026-09-15), see §3.14 |
| 2 | `update-verification-score` | No auth → score manipulation | S — ✅ FIXED (confirmed 2026-09-15), see §3.2 |
| 3 | `merge-accounts-lookup` | No auth → account enumeration | S — ✅ FIXED (confirmed 2026-09-15), see §3.1 |
| 4 | `transcribe-call`, `transcribe-voice-note` | No signature → spoof transcripts | M |
| 5 | **AUDIT (no code change)** every `create-*-checkout` / `create-*-payment` recomputes amount server-side | Tampering risk | M |
| 6 | **AUDIT** `thrive-memory-tool` cannot read other users' memory | Cross-tenant leak | S |
| 7 | Add deny-all on the 6 RLS tables (Phase 1.b migration) | **DONE — pending user approve** | — |

### B. P1 — Important, before Phase 3 (≤ 30 days, 16 items)

- `verify-credit` add JWT + creator check.
- `scope-guardian` add JWT + project owner. — ✅ FIXED (confirmed 2026-09-15), see §3.5.
- `notify-swipe`, `send-push-notification`, `enrich-credits`, `enrich-press-links`, `notify-speed-pool-ping`, `notify-speed-session-update` → header-secret as internal-only.
- 4 cron functions still bypassing `requireAdminOrCron` (per manifest) → finish standardization.
- SSRF allow-list on `scrape-thumbnail` / `fetch-link-metadata` / `fetch-og-data` / `fetch-portfolio-data`.
- Verify host-only mutations on `start-stage-turn`, `promote-raised-hand`, `send-event-blast`.
- Rate-limit `lookup-auth-providers` and `universal-search`.
- Token TTL ≤ 15m for `merge-accounts-verify`; ≤ 1h for `mint-video-token` / `mint-meeting-token`.
- Telegram webhook secret rotation pattern documented.

### C. P2 — Hygiene, before Phase 6 (≤ 90 days, ~30 items)

- Add `x-internal-secret` header check to all 76 "internal service" functions.
- Dedupe duplicate functions: `import-profile-url` vs `import-profile-from-url`; three `handle-*unsubscribe*` variants.
- Per-user rate limits on platform-fetch functions (`fetch-spotify-credits`, etc.).
- Cache layer on OG image functions + `public-stats` + `convert-currency`.

### D. P3 — Backlog

- OG image size cap.
- Consolidate `*-og-image` to a single parameterized function.

---

## 5. What we are NOT doing yet

- **Consolidating 290 → ~90 edge functions.** That is Phase 6.
- **Mass `verify_jwt = true` flip.** Per [Edge Function Auth Overrides] memory, individual fns may need `false` (signing-keys system). We add in-code checks instead.
- **Rewriting any business logic.** This document only changes auth surfaces.
- **Splitting `profiles` table.** Phase 4+.

---

## 6. Tracking

Each P0/P1 item becomes a checklist row in `.lovable/plan.md` Phase 2 follow-ups. Status of this matrix should be re-asserted at the start of every subsequent phase plan.
