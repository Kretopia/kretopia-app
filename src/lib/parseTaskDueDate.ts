/** Validates a deliverable's AI-extracted due_date before it reaches the
 *  database. extract-brief's prompt doesn't constrain due_date to a
 *  specific format (it's LLM output), and project_tasks.due_date is a real
 *  `timestamp with time zone` column -- an unparseable string sent there
 *  would fail the whole batched insert of starter tasks, silently losing
 *  every other task in the same request over one bad date. Parsed
 *  defensively, same principle as deriveTargetDateFromDeliverables: an
 *  invalid or missing value becomes null (the column's own default),
 *  never a thrown error. Returns a full ISO timestamp (not date-only) to
 *  match the column's own `timestamp with time zone` type. */
export function parseTaskDueDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export default parseTaskDueDate;
