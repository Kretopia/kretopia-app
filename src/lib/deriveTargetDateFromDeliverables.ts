interface DeliverableWithDueDate {
  due_date?: string | null;
}

/** Aggregates a project's suggested "Target date" from its AI-extracted
 *  deliverables' own due dates -- real structured data already returned
 *  by extract-brief, not a text guess. Currently these per-deliverable
 *  due dates are read nowhere else in New Room (silently dropped both
 *  from the review screen's Target date field and from the project_tasks
 *  insert itself), so this is the first place they're actually used.
 *
 *  Picks the LATEST parseable due date across all deliverables -- the
 *  project's overall target reads most naturally as "when everything is
 *  due," not the first task's date. extract-brief's own prompt doesn't
 *  constrain due_date to a specific format (it's LLM output), so this
 *  parses defensively: an unparseable or missing value is skipped rather
 *  than thrown on, and an empty/all-invalid list returns null (not a
 *  guess) exactly like inferPaymentsInvolved's own null case -- the
 *  review screen's Target date field stays genuinely unset, same as
 *  before this existed, when there's nothing real to go on. */
export function deriveTargetDateFromDeliverables(
  deliverables: DeliverableWithDueDate[] | undefined,
): string | null {
  if (!deliverables?.length) return null;

  let latest: Date | null = null;
  for (const d of deliverables) {
    if (!d.due_date) continue;
    const parsed = new Date(d.due_date);
    if (Number.isNaN(parsed.getTime())) continue;
    if (!latest || parsed > latest) latest = parsed;
  }

  return latest ? latest.toISOString().slice(0, 10) : null;
}

export default deriveTargetDateFromDeliverables;
