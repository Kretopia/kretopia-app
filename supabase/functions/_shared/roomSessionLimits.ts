// Canonical Daily.co room / meeting-token session-length ceiling.
//
// Before this constant existed, each of the ~15 edge functions that create a
// Daily room or mint a Daily meeting token computed its own `exp` (and, for
// rooms, `properties.exp`) inline. Those values had drifted independently to
// three different ceilings with no shared source of truth:
//   - 2 hours: create-direct-video-call, mint-video-token, join-sound-stage,
//     redeem-video-guest-link
//   - 4 hours: create-sound-stage, create-video-room, create-circle-room,
//     create-meeting, mint-meeting-token, create-speed-group-room (speaker
//     token), go-live-stage (speaker token)
//   - 6 hours: create-event-room (non-test mode), go-live-stage (room
//     creation)
// Which ceiling a given session got depended entirely on which function had
// created the room, not on anything about the session itself.
//
// 4 hours was already the most common value across those call sites and
// reads as the intentional default the others drifted away from, so it's
// the value centralized here. This is NOT a new product/business decision —
// it does not raise or lower the ceiling most sessions already had; it just
// gives every room/token creator a single place to read it from instead of
// re-deriving it, and brings the 2h/6h outliers in line with the rest.
//
// Deliberately OUT of scope for this constant: short, event-scoped
// expirations that are computed relative to an actual scheduled end time —
// e.g. book-meeting's "30 minutes after the meeting's scheduled end",
// join-speed-session's "30-minute slot", speed-session-matcher's
// `slot_seconds`, and create-speed-group-room's initial room `exp` (session
// duration + 30-minute buffer). Those aren't "how long can a session
// possibly run" ceilings, they're "how long after this specific, already-
// bounded event is the token still valid" — unifying them would change real
// scheduling behavior, not just remove accidental drift.
export const ROOM_SESSION_CEILING_SECONDS = 4 * 60 * 60; // 4 hours

/**
 * Returns a Daily `exp` (unix seconds) `ROOM_SESSION_CEILING_SECONDS` after
 * `fromMs` (defaults to now). Use for any Daily room `properties.exp` or
 * meeting-token `exp` that represents "how long this session/room may run",
 * as opposed to an expiry tied to a specific scheduled event end time.
 */
export function roomSessionExpiry(fromMs: number = Date.now()): number {
  return Math.floor(fromMs / 1000) + ROOM_SESSION_CEILING_SECONDS;
}
