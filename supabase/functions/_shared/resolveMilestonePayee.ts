// Resolves who should actually be PAID for a milestone -- deliberately
// distinct from `milestones.created_by`, which only ever means "who
// inserted this row" (an audit-trail column, still correct for that
// purpose everywhere it's read outside the payout path).
//
// THE BUG THIS FIXES: every payout consumer used to read
// `milestone.created_by` directly as "the Creator to pay." That's correct
// on the paths where the Creator inserts their own milestone (e.g.
// RequestPaymentCard.tsx, where a collaborator requests payment for
// themselves -- created_by really is them). But on the PRIMARY "get paid"
// path -- a Brand creating a milestone from MilestoneBoard.tsx's
// userRole==='client' branch, gated to projects.created_by -- the row is
// inserted with created_by set to the BRAND's own id (RLS correctly
// allows this: the Brand owns the project and is allowed to create
// milestones on it). Nothing about that insert is wrong; the payout
// code's *assumption* about what the column means was simply wrong for
// that path, and money ended up flagged as paid to the Brand's own
// account instead of the Creator who did the work.
//
// `projects.creative_user_ids` looked like the obvious source of truth
// for "who's actually doing the work," but a repo-wide grep confirms no
// INSERT or UPDATE anywhere in this codebase ever populates it -- it's a
// dead column (added by migration 20260423202831, only ever read, never
// written) -- so it cannot be trusted here.
//
// Resolution used instead:
//   1. If `created_by` is NOT one of the project's owner-tier ids
//      (projects.created_by / projects.client_user_id -- the same
//      "authorized payer" pair escrowAuth.ts and every payout consumer
//      already use), it wasn't the Brand who inserted this row -- the
//      Creator did, inserting their own milestone. created_by is already
//      correct; use it unchanged.
//   2. Otherwise created_by IS the paying party. Resolve the actual
//      Creator from project_collaborators: accepted, non-owner, and not
//      a money-blind role (client/guest -- see
//      20260825100000_studio_role_based_money_rls.sql's
//      get_project_role(), which this mirrors).
//   3. Exactly one such collaborator -> that's the Creator, confidently.
//   4. Zero, or more than one (a genuinely multi-creator project) -> this
//      fix does not attempt to guess which one. Falls back to
//      created_by (today's pre-fix behavior, so a payout already in
//      flight is never hard-blocked by this change) but reports
//      `ambiguous: true` so callers can log it loudly for manual
//      reconciliation instead of silently miscrediting. See the PR
//      description for why multi-creator disambiguation is deliberately
//      out of scope here.
export interface ResolvedMilestonePayee {
  payeeUserId: string;
  /** True when we fell back to created_by because resolution couldn't
   *  confidently identify a single Creator -- callers should log this
   *  for manual review, it is NOT a confirmed-correct payee. */
  ambiguous: boolean;
  /** Non-owner, non-client/guest accepted collaborators found. 0 or 2+
   *  is what makes `ambiguous` true. */
  candidateCount: number;
}

type AdminClient = {
  from: (table: string) => any;
};

export async function resolveMilestonePayee(
  supabaseAdmin: AdminClient,
  milestone: { created_by: string; project_id: string },
): Promise<ResolvedMilestonePayee> {
  const { data: project } = await supabaseAdmin
    .from("projects")
    .select("created_by, client_user_id")
    .eq("id", milestone.project_id)
    .maybeSingle();

  const ownerIds = new Set<string>(
    [project?.created_by, project?.client_user_id].filter(Boolean) as string[],
  );

  if (!ownerIds.has(milestone.created_by)) {
    // The Creator inserted their own row -- created_by already means what
    // the payout code has always assumed it means.
    return { payeeUserId: milestone.created_by, ambiguous: false, candidateCount: 1 };
  }

  const { data: collaborators } = await supabaseAdmin
    .from("project_collaborators")
    .select("user_id, role")
    .eq("project_id", milestone.project_id)
    .eq("status", "accepted");

  const candidates = Array.from(
    new Set(
      (collaborators || [])
        .filter(
          (c: { user_id: string | null; role: string | null }) =>
            !!c.user_id && !ownerIds.has(c.user_id) && !["client", "guest"].includes(c.role || ""),
        )
        .map((c: { user_id: string | null }) => c.user_id as string),
    ),
  );

  if (candidates.length === 1) {
    return { payeeUserId: candidates[0], ambiguous: false, candidateCount: 1 };
  }

  return { payeeUserId: milestone.created_by, ambiguous: true, candidateCount: candidates.length };
}
