/** Lightweight keyword inference for New Room's "Money involved?" gate --
 *  extracted and independently testable, same pattern as
 *  inferWorkspaceType.ts. Returns `null` (not a guess) whenever the text
 *  carries no real signal either way, so the review screen's toggle stays
 *  genuinely unset and the user answers it themselves exactly like today --
 *  this only pre-fills the answer the user already gave Kreto in their own
 *  words, it never invents one. Money-adjacent facts stay user-confirmed:
 *  the pre-filled value is still shown as an editable, visible toggle on
 *  the review screen before "Create" -- nothing is hidden or auto-submitted. */
export function inferPaymentsInvolved(text: string): boolean | null {
  const t = (text || "").toLowerCase();

  const paidSignals =
    /\b(client|paid|payment|invoice|quote|day rate|deposit|contract|sponsor(ed)?|brand deal|hired me|hiring me|my rate|charging|they're paying|being paid)\b/;
  const unpaidSignals =
    /\b(personal project|passion project|for fun|just for me|my own project|practice run|unpaid|no budget|free work|favor for a friend)\b/;

  // Unpaid signals checked first: "no budget" and similar negated phrases
  // would otherwise never be reached if a bare, ambiguous word they contain
  // (e.g. "budget") were also a paid-signal keyword. Deliberately excluded
  // "budget" as a standalone paid signal for this reason -- "what's the
  // budget?" alone doesn't say paid or unpaid either way.
  if (unpaidSignals.test(t)) return false;
  if (paidSignals.test(t)) return true;
  return null;
}

export default inferPaymentsInvolved;
