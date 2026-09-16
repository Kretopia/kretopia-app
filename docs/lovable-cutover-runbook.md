# Lovable Cutover Runbook — thrivein-new-beta → kretopia-app

PHASE A DELIVERABLE. Audit only. No deployment, no Lovable reconnection, and no modification of `thrivein-app/thrivein-new-beta` has been performed to produce this document. Do not execute the steps below until you send the literal message `BUILDATHON CLEARANCE CONFIRMED — PROCEED WITH LOVABLE CUTOVER` (the governing instruction for this repo now uses the phrase `BUILDATHON EVALUATION COMPLETE — FREEZE OLD REPOSITORY AND START LOVABLE CUTOVER` — treat either exact phrase from the repository owner as the same gate; see `docs/BUILDATHON_REPOSITORY_FREEZE_PLAN.md`).

> **Update, later audit pass (this session):** every finding below was independently re-checked, read-only, against live GitHub state. Nothing in §1–§9 needed retraction; the specific items that had changed or needed expansion are corrected inline and marked "(updated)". New facts found this pass: `Kretopia/kretopia-app` is a **GitHub fork** of `thrivein-app/thrivein-new-beta` (explains the shared commit ancestry); PR #54 (Studio home scalability overhaul) is now open against `main`; the full environment-variable surface is larger than originally scoped (Stripe, Daily.co, email, OAuth, AI-provider, and scraping secrets live in Supabase Edge Functions, not Lovable — see the expanded §5 checklist). No write action was taken against `thrivein-app/thrivein-new-beta` to produce this update.

## 1. Current state

- **Buildathon repo, frozen**: `thrivein-app/thrivein-new-beta`. Confirmed hard-blocked at the infrastructure level for any push from this machine (a prior push attempt returned `BLOCKED: this push targets thrivein-app/thrivein-new-beta ... That repository is read-only from this machine.`) — this is not just a convention being followed, it's enforced.
- **`Kretopia/kretopia-app` is a GitHub fork of `thrivein-app/thrivein-new-beta`** (updated — confirmed via the GitHub API `parent` field this pass; not previously documented explicitly). This is the structural reason for the shared commit history between the two repos.
- **Lovable is still actively connected to and committing into `thrivein-app/thrivein-new-beta`** (re-confirmed this pass via the GitHub commits API, read-only): the most recent commit on that repo's `main` is `feba9342`, dated **2026-09-14T06:23:51Z**, by `lovable-dev[bot]` — still a week after the stated 2026-09-07 freeze date, and unchanged from the prior pass's finding. Checked all 8 branches on that repo; none has anything newer. This is a fact worth flagging on its own, separate from this cutover project: if the freeze is meant to be absolute, Lovable's own auto-sync appears to still be writing to that repo. Confirming/stopping that is outside this runbook's scope (would require Lovable's own project settings) and is not something this audit changed.
- **New this pass**: the repository's own `pushed_at` metadata reads `2026-09-15T02:53:14Z` — about 20 hours after the newest commit visible on any branch. No tag or branch-tip change explains it. Cause undetermined from read-only inspection; noted for transparency in `docs/BUILDATHON_REPOSITORY_FREEZE_PLAN.md` rather than guessed at here.
- **Future source of truth**: `Kretopia/kretopia-app` — confirmed NOT receiving any Lovable commits. `.lovable/plan`'s last commit on this repo's lineage is 2026-08-31, before the fork existed as a separate entity; nothing has landed there since, confirming Lovable's sync target has not silently shifted.
- **`www.kretopia.com`** currently serves the `thrivein-new-beta`-deployed build (confirmed in a prior pass by asking the user directly, since HTTP headers alone don't reveal the connected GitHub repo; not independently re-confirmed this pass — re-verify before cutover if time has passed).

## 2. Target architecture

```
Feature branch
  → pull request
  → protected `main` (Kretopia/kretopia-app)
  → Lovable GitHub sync
  → Lovable preview
  → manual production publish
  → www.kretopia.com
```

## 3. Pre-cutover gate — do not proceed until ALL of these are true

- [ ] Written Buildathon clearance received (the exact confirmation phrase from you).
- [ ] No active concern about post-deadline modification of the submission repo (worth resolving the "Lovable still committing after the freeze" finding above with the Buildathon organizers or Lovable support first, independent of this cutover).
- [ ] Backup/rollback plan reviewed (§7).
- [ ] All PRs you want in the first production release are reviewed and merged to `Kretopia/kretopia-app/main`. As of this pass, exactly one PR is open: **#54, "Studio home: unified activity/crew pulse, responsive folders, prioritized projects"** — `MERGEABLE`/`CLEAN`, no CI checks configured to run on it (none are wired up repo-wide yet), locally verified (typecheck/lint/tests/build all clean against its own changes; full details in the PR description). Not merged — merging is a deliberate decision for you to make, not something this or the prior audit pass does automatically.
- [ ] CI green — see §4/§6 for current, real gaps that need closing first (`npm ci` fails without `--legacy-peer-deps`, re-confirmed this pass with a fresh install attempt — same root cause, unchanged; ~3,150+ pre-existing lint errors, mostly `supabase/functions/**` linted under a frontend-oriented ESLint config).
- [ ] Production environment variables configured in the Lovable project (§6 lists variable NAMES only).
- [ ] Manual smoke-test checklist ready (§9 below, reused from Phase B's own required matrix).

## 4. Build validation — results, this pass

| Check | Result |
|---|---|
| `npm ci` | **FAILS** — `date-fns@^4.1.0` (direct dependency) conflicts with `react-day-picker@^8.10.1`'s peer requirement (`^2.28.0 \|\| ^3.0.0`). No `.npmrc` sets `legacy-peer-deps`, so a genuinely clean install (what Lovable's own build pipeline or a real CI runner would do) fails today. **Re-confirmed in a later pass with a fresh install attempt — identical error, unchanged.** Fix this before trusting any automated build — either bump `react-day-picker` to a date-fns-v4-compatible release or pin `date-fns` to a `^3` version compatible with it. |
| `npm install --legacy-peer-deps` | Succeeds (used to unblock the remaining checks this pass). |
| `npm run typecheck` | Clean — one long-standing, unrelated pre-existing failure (`HingeStyleCard.test.tsx`, a fixture missing `cover_image_url`) already present on `main` before any of this session's work. |
| `npx vitest run` | 221/227 passing at time of the original pass. **As of the later pass (with PR #54's 67 new tests merged into the count): 278/284 passing.** Failures both times are the same pre-existing, unrelated baseline (`UnifiedSearchDropdown.hero.test.tsx`, 6 tests; `BrandPassportHero.test.tsx` did not reproduce as failing in the later pass — worth a quick look, but low-priority given it's not a file either audit pass touched). |
| `npm run lint` | **3,448 problems (3,154 errors)** at time of the original pass; **3,456 problems (3,161 errors) in the later pass** — stable within a handful of items, consistent with "long-standing baseline, not actively growing or shrinking." Overwhelmingly concentrated in `supabase/functions/**` (`@typescript-eslint/no-explicit-any` — Deno edge functions being linted under what looks like a frontend-oriented config not scoped to exclude or specially configure them) plus a handful of frontend items (e.g. one `require()`-style import in `tailwind.config.ts`). This means "lint" cannot honestly be called a CI gate today without either fixing this backlog or explicitly scoping ESLint to exclude `supabase/functions/**` if Deno-style code was never meant to satisfy this config. |
| `npm run build` | **Succeeds.** `✓ built in 19.35s`, full `dist/` output including the PWA service worker (353 precached entries). Only advisory warnings (a few chunks over 500kB — `Discover`, `index`, `ThriveDesk` bundles — candidates for code-splitting, not blockers). |
| Secret-leak scan | `.env` is not tracked today (`git ls-files` confirms). It WAS tracked in history (commits back to April 2026, removed by `9324e0c2 security: stop tracking local environment files`). Content of the historical `.env` checked (variable NAMES only, values not printed here): `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`, `VITE_VAPID_PUBLIC_KEY` — all publishable/anon-scoped values that are safe-by-design to expose in a client bundle (matches `.env.example`'s own documented reasoning), not a `service_role` key, Stripe secret, or other true secret. Low severity, but per the task's own instruction: **not rewriting history to remove it** — flagging it here. If you want extra caution, rotating the anon key is cheap and independent of anything else in this runbook. |

**Deployment-ready?** Code and tests: yes. A genuinely clean (`npm ci`, no flags) automated build: no, until the date-fns/react-day-picker conflict is resolved — this should be a small, fast fix, but do it before flipping Lovable's build source, since Lovable's own pipeline will very likely run the equivalent of a clean install.

**Added in a later pass — `README.md` is still the generic, unedited Lovable-scaffold README**: it still points at a Lovable project URL, uses `<YOUR_GIT_URL>`/`<YOUR_PROJECT_NAME>` placeholder text, and documents only `npm run dev` — it does not mention `typecheck`, `lint`, `test`, or `build`, and doesn't identify the repo as Kretopia's own. Not a release blocker, but real onboarding/hygiene debt worth fixing (`docs/RELEASE_PROCESS.md`, added this pass, now covers the actual commands — consider having `README.md` point to it).

## 5. Lovable integration evidence

- Confirmed via `package.json` + `vite.config.ts`: real, active Lovable build-time integration (`lovable-tagger`, `@lovable.dev/vite-plugin-dev-server-bridge`, `@lovable.dev/vite-plugin-hmr-gate`, `@lovable.dev/mcp-js`, `@lovable.dev/cloud-auth-js`) — this is present in `Kretopia/kretopia-app` too (inherited from the fork), so the Vite-level plugin wiring is already fork-compatible; what's NOT connected is the GitHub sync/deploy target (see §1).
- Whether `Kretopia/kretopia-app` already has the Lovable GitHub App installed: **could not determine from this session** — `gh api repos/Kretopia/kretopia-app/installation` returned a 401 (insufficient token scope to read GitHub App installations from here). No repo webhooks were visible via `gh api repos/Kretopia/kretopia-app/hooks` (empty array), though that may also be a permissions gap rather than proof none exist. **You'll need to check this directly in Lovable's own project settings** (or GitHub's org-level "Installed GitHub Apps" page) before the cutover — see §6, item 1.
- No deployment-config files (Netlify/Vercel/etc.) found in the repo — deployment is entirely Lovable-managed, consistent with the target architecture.
- **Environment variable NAMES referenced by the app (values not read or printed) — expanded and split by configuration surface in a later pass**, because these live in two genuinely different places and conflating them causes real confusion during cutover:

  **A. Lovable / frontend build-time (`import.meta.env.VITE_*`, read by the Vite build Lovable runs) — these are what must be set in the Lovable project's environment configuration:**
  ```
  VITE_SUPABASE_URL
  VITE_SUPABASE_PUBLISHABLE_KEY
  VITE_SUPABASE_PROJECT_ID
  VITE_SENTRY_DSN
  VITE_SITE_URL
  VITE_VAPID_PUBLIC_KEY
  VITE_GENERATE_STATIC_SOCIAL_PAGES   (optional build flag, safe to leave unset)
  ```
  Every one of these must already be configured in the Lovable project you intend to publish from — confirm before the first publish attempt, per Phase B's own gate (no `supabaseUrl is required` crash).

  **B. Supabase Edge Function secrets (`Deno.env.get(...)`, configured in the Supabase project dashboard/CLI — NOT in Lovable):**
  ```
  SUPABASE_URL
  SUPABASE_ANON_KEY
  SUPABASE_PUBLISHABLE_KEY
  SUPABASE_SERVICE_ROLE_KEY

  STRIPE_SECRET_KEY
  STRIPE_SECRET_KEY_LIVE
  STRIPE_SECRET_KEY_TEST
  STRIPE_TEST_API_KEY
  STRIPE_MODE
  STRIPE_WEBHOOK_SECRET
  STRIPE_MARKETPLACE_WEBHOOK_SECRET
  STRIPE_WALLET_WEBHOOK_SECRET

  DAILY_API_KEY
  DAILY_WEBHOOK_HMAC_SECRET

  RESEND_API_KEY
  RESEND_FROM_EMAIL

  LOVABLE_API_KEY
  LOVABLE_SEND_URL
  ELEVENLABS_API_KEY
  MINIMAX_API_KEY
  NEBIUS_API_KEY

  FIRECRAWL_API_KEY
  DISCOGS_TOKEN
  TMDB_API_KEY
  YOUTUBE_API_KEY
  TELEGRAM_API_KEY

  SPOTIFY_CLIENT_ID
  SPOTIFY_CLIENT_SECRET
  NOTION_CLIENT_ID
  NOTION_CLIENT_SECRET
  MONDAY_CLIENT_ID
  MONDAY_CLIENT_SECRET

  TWILIO_ACCOUNT_SID
  TWILIO_AUTH_TOKEN
  TWILIO_PHONE_NUMBER

  VAPID_PRIVATE_KEY
  VAPID_PUBLIC_KEY
  VAPID_SUBJECT

  APP_URL
  SITE_URL
  CRON_SECRET
  INTEGRATION_ENC_KEY
  TEST_USER_JWT   (test-only — must NOT be set in production)
  ```

  **Working assumption, not yet independently confirmed**: both `Kretopia/kretopia-app` and `thrivein-app/thrivein-new-beta` reference the same Supabase project ref (`kwmcocsitwssrtzkdojh`, per `.env.example`) — if that holds, the Edge Function secrets above are already live in that shared Supabase project and don't need to be re-entered anywhere as part of the GitHub/Lovable repo cutover; only the **Lovable-side (list A)** variables are cutover-actionable. Confirm this assumption (e.g. via the Supabase dashboard's project settings) before relying on it, since a wrong assumption here could mean silently missing secrets on a genuinely new backend project.

## 6. Exact manual Lovable + GitHub steps (perform only after clearance)

**GitHub App permissions first:**
1. In GitHub → Settings → Applications → Installed GitHub Apps (org or personal, wherever the Lovable app is installed) → find the Lovable/gpt-engineer app → Configure.
2. Set repository access to "Only select repositories" and select `Kretopia/kretopia-app` specifically. Do not grant organization-wide access.
3. Confirm the app's permission scope before saving (should be limited to the repositories you explicitly select; review what it's requesting).

**Inside Lovable:**
4. Open the Kretopia Lovable project.
5. Go to GitHub sync / integration settings.
6. Disconnect only the project-level link to `thrivein-app/thrivein-new-beta`. Do not touch the repository itself — this disconnects Lovable's pointer, not the repo.
7. Connect `Kretopia/kretopia-app`.
8. Choose `main` as the production branch.
9. Verify sync completes WITHOUT publishing (Lovable should offer a preview/sync-only step — do not hit publish yet).
10. Confirm the preview build succeeds and reflects `Kretopia/kretopia-app/main`'s actual content.
11. Only after a successful preview + smoke test (§9), publish manually.
12. Try to keep `www.kretopia.com` attached to the existing Lovable project rather than standing up a second production site, unless Lovable's UI makes that impossible for this kind of repo-switch.

## 7. Rollback plan

- **Never** roll back through `thrivein-app/thrivein-new-beta` — it stays frozen and untouched regardless of what happens during or after cutover.
- First choice: Lovable's own deployment history / previous-deployment rollback feature, if the UI offers one after a bad publish.
- Second choice: revert via a normal GitHub PR against `Kretopia/kretopia-app` (a `git revert` of the offending commit(s), reviewed and merged like any other change), then let Lovable's sync pick up the reverted `main`.
- Never force-push to fix a bad production state — a revert commit is always the safe path.

## 8. Post-cutover controls

- All future work happens only through `Kretopia/kretopia-app`.
- Branch protection stays on `main`. **Re-checked live via the GitHub API in a later pass — corrected from the original entry here**: `required_approving_review_count` is currently **0** (not 1 as first recorded), `enforce_admins: true`, force pushes blocked, branch deletions blocked, no required status checks (none are configured repo-wide). `enforce_admins: true` means there is currently no admin-bypass path at all, including for the repo owner — every change to `main`, including the owner's own, goes through a PR. That's stricter than the "admin bypass: ON only for emergency release use" posture some release processes prefer; leaving it as-is unless a deliberate decision says otherwise, since loosening it is a real policy change, not a hygiene fix.
- Lovable production deploys only from `main`.
- Confirm no Lovable sync remains attached to `thrivein-app/thrivein-new-beta` after cutover (or, if the freeze/Buildathon relationship requires Lovable to stay pointed there for submission-record reasons, get that confirmed explicitly rather than assumed).

## 9. Smoke-test matrix (run after every publish, required before calling a release good)

Homepage · Auth (signup/login) · Passport (own + public/anonymous view) · public EPK/comp-card/creator-site · Today · Scout · Match · Studio / New Room (project creation, the exact flow fixed this session) · Events (RSVP + ticket purchase) · Settings light/dark · desktop + mobile viewport · browser console clean · Supabase client initializes without the `supabaseUrl is required` crash this session diagnosed and fixed the root cause of once already (a different bug, but the exact failure mode to watch for if env vars are ever misconfigured on a new deploy target).

See also `docs/BUILDATHON_REPOSITORY_FREEZE_PLAN.md` for the freeze side of this cutover (what happens to `thrivein-app/thrivein-new-beta` once cleared), and `docs/RELEASE_PROCESS.md` for the steady-state release workflow once `Kretopia/kretopia-app` is the sole source of truth.

---

**STATUS: PREPARED — NO DEPLOYMENT, NO LOVABLE RECONNECTION, AND NO BUILDATHON REPOSITORY MODIFICATION HAS BEEN PERFORMED. Re-verified, read-only, in a later audit pass; every finding above either held or was corrected inline as noted.**
