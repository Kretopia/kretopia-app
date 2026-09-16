# Buildathon Repository Freeze Plan

```
Repository: thrivein-app/thrivein-new-beta
Purpose: Buildathon historical submission snapshot
Status: frozen / read-only after external clearance
```

This is a **preparation document only**. Nothing described in "Actions to take after clearance" below has been performed. `thrivein-app/thrivein-new-beta` has not been archived, renamed, relabeled, had its visibility changed, had branches or tags deleted, or had its history altered in producing this plan.

## Why this plan exists

`thrivein-app/thrivein-new-beta` was the Buildathon submission repository. `Kretopia/kretopia-app` (a GitHub fork of `thrivein-app/thrivein-new-beta`) is the active, current Kretopia product and the intended sole source of truth going forward. This plan describes how to freeze the old repository as a read-only historical record, once explicitly cleared to do so.

## Findings from this audit (read-only checks only — nothing was changed)

- **`Kretopia/kretopia-app` is a GitHub fork of `thrivein-app/thrivein-new-beta`.** Confirmed via the GitHub API (`parent` field on the repo). This is the structural reason the two repositories share commit ancestry.
- **Lovable's bot (`lovable-dev[bot]`) is still committing directly to `thrivein-app/thrivein-new-beta`.** Confirmed via the GitHub API commits endpoint (read-only `GET`, no writes) as of this audit: the most recent commit on that repository's `main` branch is `feba9342`, dated **2026-09-14T06:23:51Z**, authored by `lovable-dev[bot]`. If September 7 is the intended freeze date, this is ongoing post-freeze activity from Lovable's own auto-sync, not from any human action. **This is not something this audit changed or can change** — stopping it requires disconnecting Lovable's project-level GitHub sync from that repository (see "Actions to take after clearance" below), which is exactly the kind of repository/integration change this plan intentionally does not perform without clearance.
- **A secondary, unexplained data point**: the repository's own `pushed_at` metadata reads `2026-09-15T02:53:14Z` — about 20 hours *after* the last commit visible on any branch (checked all 8 branches; none has a commit newer than 2026-09-14T06:23:51Z). No tags exist on the repository. The cause of this later `pushed_at` timestamp could not be determined from read-only commit/branch inspection alone (it doesn't correspond to a new commit, a new tag, or a new branch). Flagging this rather than guessing at it — it may be innocuous (e.g. an empty push, a ref update that didn't move a branch tip, or a metadata-only API operation), but it's a fact worth being aware of given the stated concern about post-deadline activity.
- **Repository state otherwise**: not archived, public, default branch `main`, no tags, 8 branches total (`main`, `buildathonoptimize`, `chore/branding-migration-kretopia`, `feature/activation-priority-plan`, `feature/creative-passport-rearchitecture`, `feature/reliability-overhaul`, `thrivinmigration`, `userexperience`).
- **Webhook/GitHub App visibility**: could not be determined from this session — the available GitHub token lacks the `admin:repo_hook` and `admin:org` scopes needed to list webhooks or installed GitHub Apps on that repository/organization (`404`/`401` respectively). This must be checked directly in GitHub's org "Installed GitHub Apps" settings, or in Lovable's own project settings, before or during the actual freeze.

None of the above required, and none of the above performed, any write operation against `thrivein-app/thrivein-new-beta`.

## Actions to take after clearance (NOT performed — listed for the record only)

Once explicit clearance is given (see the exact confirmation phrase below), the intended sequence is:

1. **Disconnect Lovable's sync from `thrivein-app/thrivein-new-beta` first**, in Lovable's own project settings — this is the actual source of ongoing post-freeze commits, and must be stopped before or as part of freezing the repository, not after.
2. Archive the repository, or apply the strictest read-only setting GitHub offers short of archiving if archiving is undesirable for some reason (archiving is normally the safest, simplest way to guarantee no further pushes, PRs, or merges).
3. Confirm (post-archive, GitHub enforces this automatically): all direct pushes blocked, all force pushes blocked, all branch deletions blocked, no new PRs, no new merges.
4. Remove any deploy webhooks pointed at this repository (pending confirmation of what, if anything, is configured — see "Webhook/GitHub App visibility" above).
5. Add a README banner:
   ```
   This repository is a historical Future Caribbean Buildathon submission snapshot.
   It is no longer the active Kretopia development repository.
   Active development continues at:
   https://github.com/Kretopia/kretopia-app
   ```
6. Do not delete, rewrite, rebase, or filter any existing commit, branch, or tag. Every commit that exists today — including any dated after September 7 — remains part of the historical record exactly as it is. If asked "why are there commits after the deadline," the answer is this document: Lovable's own auto-sync kept committing after the stated freeze, which is now documented and about to be stopped, not hidden.

## Non-negotiable constraints (repeated from the governing instructions, binding on this and any future session)

Do NOT, against `thrivein-app/thrivein-new-beta`, at any time, with or without clearance for the freeze itself:
- `git reset --hard`, `git rebase`, `git filter-repo`, `git filter-branch`, `git replace`, `git commit --amend`, `git push --force`, `git push --mirror`, `git gc`.
- Hide, erase, rewrite, backdate, or otherwise obscure any commit, branch, or tag.
- Attempt to make post-deadline (or pre-deadline) commits "not appear."

Freezing means stopping *future* changes. It does not mean editing the past.

## Confirmation gate

The archive/read-only/webhook-removal/README-banner steps above (and only those steps) require this exact sentence from the repository owner before they are performed:

```
BUILDATHON EVALUATION COMPLETE — FREEZE OLD REPOSITORY AND START LOVABLE CUTOVER
```

Until that exact sentence is given, this document remains a plan only.
