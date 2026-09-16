/** Lightweight extraction for New Room's optional Budget field -- same
 *  spirit as inferPaymentsInvolved (a real signal from what the user
 *  actually said, or nothing at all, never a fabricated number).
 *
 *  Deliberately scoped to `$`-prefixed amounts only. A bare number
 *  ("3 days", "6 people", "2 revisions") is everywhere in a creative
 *  brief and isn't a reliable budget signal on its own; a `$`-prefixed
 *  one is unambiguous. Matches "$2,000", "$500", "$5k", "$2.5k" -- the
 *  Budget field's own placeholder ("e.g. $2,000") sets the same
 *  expectation, so the extracted substring is returned as-is rather
 *  than normalized to a strict number, matching that field's existing
 *  loose text format. Returns null (not a guess) when no such amount
 *  appears -- the field stays genuinely unset, same as before this
 *  existed. */
export function inferBudgetFromText(text: string): string | null {
  const match = (text || "").match(/\$\s?[\d,]+(?:\.\d+)?\s?[kK]?/);
  return match ? match[0].replace(/\s+/g, "") : null;
}

export default inferBudgetFromText;
