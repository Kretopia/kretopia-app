# Release Process — Kretopia/kretopia-app

`Kretopia/kretopia-app` is the sole source of truth for Kretopia development. This document describes how a change goes from a feature branch to `www.kretopia.com`.

`thrivein-app/thrivein-new-beta` is a frozen historical Buildathon snapshot. It is not part of this process — see `docs/BUILDATHON_REPOSITORY_FREEZE_PLAN.md`.

## 1. Feature branch

Branch from `main`: `feature/<name>` or `fix/<name>`. One coherent unit of work per branch.

## 2. Pull request

Open a PR against `main` in `Kretopia/kretopia-app`. Describe what changed and why, and what was tested.

## 3. Local verification (required before requesting review)

There is currently no automated CI wired up on this repo (no GitHub Actions checks run automatically on a PR — confirmed empty `statusCheckRollup` on open PRs as of this writing). Until that changes, run these manually and report the results in the PR description:

```bash
npm install --legacy-peer-deps   # see note below — plain `npm ci` currently fails
npm run typecheck
npm run lint
npm run test
npm run build
```

**Known dependency conflict:** `npm ci` (a genuinely clean install, no flags) currently fails with an `ERESOLVE` error — `react-day-picker@8.10.1` requires `date-fns@^2.28.0 || ^3.0.0` as a peer, but the root project pins `date-fns@^4.1.0`. Until this is resolved (bump `react-day-picker` to a date-fns-v4-compatible release, or pin `date-fns` to a `^3` version), use `npm install --legacy-peer-deps` locally. **This matters for the Lovable cutover**: if Lovable's own build pipeline runs a clean install, it will hit this same failure — resolve it before relying on Lovable's automated build for production.

**Known baseline (do not treat as new regressions unless the specific file changed):**
- `npm run typecheck`: one pre-existing failure in `src/components/discover/__tests__/HingeStyleCard.test.tsx` (fixture missing `cover_image_url`).
- `npm run test`: 6 pre-existing failures in `src/components/search/__tests__/UnifiedSearchDropdown.hero.test.tsx`.
- `npm run lint`: on the order of 3,000+ pre-existing problems, overwhelmingly `@typescript-eslint/no-explicit-any` in `supabase/functions/**` (Deno edge functions linted under a frontend-oriented ESLint config). Not a regression signal today; a real CI gate should either fix this backlog or scope ESLint to exclude `supabase/functions/**`.

## 4. Merge to `main`

`main` is branch-protected (verified live via the GitHub API as of this writing):
- Pull requests required.
- Required approving reviews: **0** (single active reviewer today — raise this the moment a second reviewer is added).
- Force pushes: blocked.
- Branch deletion: blocked.
- `enforce_admins`: **on** — the repo owner/admin is not exempt from the above; there is currently no emergency-bypass path. If that's ever needed, it has to be a deliberate, temporary settings change, done consciously, not something available by default.
- No required status checks (because no CI is wired up yet — see §3).

Do not change these settings without a deliberate decision; they're read live from GitHub, not assumed.

## 5. Lovable sync

Once merged, Lovable (connected to `Kretopia/kretopia-app`, production branch `main` — see `docs/lovable-cutover-runbook.md` for the one-time cutover from the old repo) picks up the new `main` and builds a preview. This does not auto-publish.

## 6. Manual smoke test

Before publishing, run the smoke-test matrix in `docs/lovable-cutover-runbook.md` §9 against the Lovable preview. Record the commit SHA the preview was built from.

## 7. Publish

Only after a passing smoke test, use Lovable's Publish action. This is a manual, deliberate step — never automatic.

## 8. Rollback

1. First choice: Lovable's own deployment history — restore the previous successful deployment.
2. If a code-level rollback is needed: open a revert PR in `Kretopia/kretopia-app` (`git revert`, reviewed and merged like any other change). Never force-push. Never touch the Buildathon repository as part of a rollback.
3. Rebuild the Lovable preview from the reverted `main`, retest, then publish.

## 9. Environment variables

See `docs/lovable-cutover-runbook.md` §"Environment variable checklist" for the full list (frontend/Lovable-configured vs. Supabase Edge Function secrets are two different configuration surfaces — don't conflate them). Never commit real values; `.env.example` documents names (with two narrow, intentional exceptions noted there — the Supabase anon/publishable key and VAPID public key, both safe-by-design to expose in a client bundle).
