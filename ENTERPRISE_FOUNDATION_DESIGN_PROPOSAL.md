# Enterprise Foundation — Design Proposal (Phase 3.A)

CODE-INSPECTED, 2026-09-15. This is a design proposal, not an implementation — per its own scope, this phase stops at schema/RLS design and explicitly-flagged product decisions wherever a choice would change who can access what. Nothing in this document has been applied to any database.

## 1. What already exists (confirmed, live in git)

`20260912130000_minimal_org_workspace_layer.sql` already built the minimal, reversible foundation the Bible calls for:

- `public.organizations` (id, name, owner_id, timestamps), RLS enabled.
- `public.organization_members` (org_id, user_id, role ∈ {owner, admin, member}), RLS enabled.
- `is_org_member(org_id, user_id)` / `is_org_admin(org_id, user_id)` — `SECURITY DEFINER` helpers, same pattern as every other role-check function in this schema (avoids RLS self-recursion).
- `create_organization(name)` RPC — the only way to create an org; seats the creator as `owner` in the same transaction.
- Nullable `org_id` added to `profiles` and `projects` — zero existing rows affected, zero existing policy touched, and (confirmed by re-reading the migration and the grant-history around it) `org_id` isn't even client-writable via a raw PATCH today, only through a future RPC — so the column exists but is currently inert everywhere.

This matches the Bible's own diagnosis exactly: **"owner/admin/member exist but grant zero access to anything today."** That's not a bug — it's exactly what a reversible foundation should look like before the access-granting decisions get made. The gap is everything layered on top, which is what this document proposes.

## 2. Gap analysis against the Bible's enterprise requirements

| Requirement | Current state | What's missing |
|---|---|---|
| Identity & SSO | Kretopia is an OAuth *identity provider* for third parties (backwards) | Not addressed here — this is a distinct, large integration (SAML/OIDC as a *consumer*), not a schema question. Out of scope for this document; needs its own design pass once there's a real enterprise buyer requiring it. |
| Seats & billing | 100% per-user subscription (`profiles.subscription_tier`); no seat concept anywhere | §4 below |
| Membership & roles | Real, RLS-enabled, grants nothing | §5 below |
| Org-scoped projects/studios | `projects.org_id` exists, nullable, unused by any policy | §5 below |
| Private rosters | Real, but hard-locked to one owner (no org-shared bench) | §5 below |
| Approvals | Every flow is bespoke; the AI agent's own gate is self-approval, not delegated | §6 below (also being addressed in parallel by the Kreto AI reliability pass — see that PR for the agent-path half of this) |
| Audit history | No product-wide log; a few narrow feature logs only | §7 below |
| Cross-tenant isolation | Nothing leaks between orgs — but nothing is scoped by org either (vacuously true, not actually enforced) | §5 below |

## 3. Design principle carried forward from the existing migration

Every proposal below follows the same rule the existing foundation already set: **additive, nullable, zero change to current single-user behavior until a specific opt-in flow exists.** A project with `org_id = NULL` must keep working exactly as it does today, forever, for users who never create or join an organization. Org-scoping is something a user/project graduates into, not a default that changes existing behavior.

## 4. Seats & billing — proposed schema (design only)

```sql
-- Proposed, NOT applied. Mirrors the existing organizations table style.
ALTER TABLE public.organizations
  ADD COLUMN seat_count INTEGER,           -- NULL = unmetered/not yet on a seat plan
  ADD COLUMN plan_tier TEXT,               -- mirrors profiles.subscription_tier's vocabulary once defined
  ADD COLUMN billing_owner_id UUID REFERENCES auth.users(id);
```

**Product decisions required before this can be implemented:**
- Is org billing a separate Stripe Customer/subscription from the owner's personal one, or does it extend the existing per-user Stripe integration? (KrePay's current wallet-family fragmentation, documented separately in the payments audit, makes this non-trivial — a fourth wallet family here would make that worse, not better, without a consolidation decision first.)
- What counts as a "seat" — every `organization_members` row, or only `role != 'guest'`-equivalent rows? The schema above doesn't answer this; it just makes the question askable.
- Pricing itself (out of scope for any implementation, per this task's own instruction).

## 5. Membership → actual access — proposed RLS extension pattern (design only)

The existing `is_org_member`/`is_org_admin` helpers are already the right shape to extend existing policies with an `OR`, not replace them:

```sql
-- Example pattern for ONE table (projects), not applied. Illustrates the
-- shape every org-scoping policy would follow -- additive OR, existing
-- owner/collaborator clause untouched.
-- Current (unchanged): USING (user_has_project_access(id, auth.uid()))
-- Proposed extension:
--   USING (
--     user_has_project_access(id, auth.uid())
--     OR (org_id IS NOT NULL AND public.is_org_member(org_id, auth.uid()))
--   )
```

This is a **real authorization-semantics change** — the task's own instruction says to stop at proposal here, not implement it. Flagging explicitly: the moment this ships, an org member gets read access to every org-scoped project, not just ones they're individually invited to. That's presumably the intent of "org-shared bench" (the Bible's own phrase), but it's a genuine access-model decision, not a schema question, and needs explicit sign-off before implementation — particularly because `projects` currently carries the financially-sensitive `client_price`/`creative_payout`/`margin_type`/`margin_value` columns (permanently locked down from `SELECT` for `authenticated`, see the New Room grants history this session). Org-scoping the row doesn't change that lockdown, but it's worth stating plainly: broadening *row* visibility to org members says nothing about those four *columns*, which stay locked regardless. Same pattern would extend to studios/rosters once "studio" and "roster" tables are identified precisely (this document doesn't have their exact table names confirmed — a follow-up read is needed before writing real migrations).

**Product decisions required:**
- Does joining an org grant *read* access to org-scoped projects, *write* access, or is it role-dependent (`admin` gets more than `member`)?
- Should this be opt-in per-project (a project owner chooses to share it with their org) or automatic for every project created while a user is an org member? The nullable `org_id` column supports either — this is a UI/product flow decision, not a schema one.

## 6. Delegated approvals — proposed schema (design only)

```sql
-- Proposed, NOT applied.
CREATE TABLE public.approval_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES auth.users(id),
  action_type TEXT NOT NULL,          -- e.g. 'invoice_send', 'agent_high_risk_action'
  action_payload JSONB NOT NULL,      -- what would happen if approved -- never executed speculatively
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','expired')),
  decided_by UUID REFERENCES auth.users(id),
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

This is deliberately the SAME shape the Kreto AI reliability work (parallel PR this session) needs for unifying the agent-path risk model with human-UI actions — that work is the natural first real consumer of this table, since it already has a 3-tier risk model that currently has nowhere shared to write its "needs approval" state for actions taken outside the agent path. Recommend landing that PR's read of the actual `orch_runs`/`orch_actions` schema before finalizing this table's shape, since it may be able to reuse rather than duplicate.

## 7. Product-wide audit log — proposed schema (design only)

```sql
-- Proposed, NOT applied. Append-only by design (no UPDATE/DELETE policy).
CREATE TABLE public.audit_log (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  org_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  actor_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,               -- 'project.created', 'milestone.paid', etc. -- namespaced, not free text
  entity_type TEXT NOT NULL,
  entity_id UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Append-only: no UPDATE or DELETE RLS policy at all. SELECT restricted to
-- org admins for their own org's rows, or the actor for their own actions.
```

**Product decision required:** this is a genuinely large scope question, not a schema one — does "product-wide" mean every mutating action platform-wide (enormous write volume, needs a real event-bus/trigger strategy, not ad-hoc inserts scattered across ~290 edge functions), or specifically the enterprise-relevant subset (org membership changes, billing changes, approval decisions, milestone payouts)? Recommend starting with the narrow, enterprise-relevant subset — it's the part actually gap-flagged by the Bible, and it composes cleanly with §6's approval table (every approval decision is naturally an audit-log row).

## 8. What this document deliberately does NOT propose

- SSO/SAML/OIDC as a consumer — distinct integration, own design pass, no schema overlap with the above.
- Any actual RLS policy change, migration, or code change — everything above is proposal text, not a diff.
- Seat pricing, plan tiers, or any dollar figure.
- A decision on whether org-scoping is even the right near-term priority relative to the G0/P0/P1 work already landed this session — that's Ethan/Jeff's call, not something this document should imply.

## 9. Recommended next step, if greenlit

Smallest reversible next slice, in order: (1) `audit_log` table + wiring it into the 4-5 highest-value enterprise-relevant actions (org membership changes, approval decisions) — pure addition, no existing policy touched, immediately useful even with zero orgs actively using shared access yet; (2) `approval_requests` table, coordinated with the Kreto AI reliability work's read of `orch_runs`; (3) only then, the `projects`/studios RLS extension from §5, since that's the one genuine access-model change in this whole document and benefits from having §6/§7 already in place to audit its effects from day one.
