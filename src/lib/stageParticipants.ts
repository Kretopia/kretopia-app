// Canonical "who's waiting / speaking / hand-raised" state model, shared by
// every SoundStages-adjacent surface.
//
// Audit finding: this app has at least three separate, independently-built
// mechanisms that each track a slice of "who's waiting/speaking" for a live
// call, and none of them know about each other:
//
//   1. WAITING ROOM — src/components/calls/AdmitQueue.tsx, driven entirely
//      by Daily's own native "knocking" lobby (`waitingParticipants()`,
//      `waiting-participant-*` events, `updateWaitingParticipant`). No app
//      DB table involved — Daily holds this state for the life of the call.
//      Used on generic calls (CallPage) where `enable_knocking` is on
//      (create-direct-video-call, create-meeting when requested).
//
//   2. PERSISTED SPEAKER QUEUE — Curated Stages (scout/showcase auditions).
//      curated_stage_applications (pending -> accepted) plus
//      curated_stage_turns (started_at/ended_at/outcome), driven from
//      src/components/circle/StageHostConsole.tsx via the start-stage-turn /
//      end-stage-turn edge functions. A second, DB-backed table,
//      curated_stage_raised_hands (pending/promoted/dismissed, written by
//      the raise-hand-stage / promote-raised-hand edge functions), also
//      exists for the same stages — this is the audience's own "ask to
//      speak" path, as opposed to the host pulling up an already-accepted
//      applicant.
//
//   3. EPHEMERAL RAISE-HAND — Open Stages (sound_stages).
//      src/components/circle/SoundStageRoom.tsx tracks `handRaised` (local
//      React state) and a host-local `speakersRef` Set purely via Daily
//      `sendAppMessage` broadcasts ({type: "raise-hand"|"promote"|"demote"}).
//      Nothing is written to the database — the state lives only in the
//      browser tabs that were mounted when a given message was sent.
//
// These three were never going to merge into one table or one edge function
// without changing real product behavior (Open Stages and Curated Stages
// are intentionally different products with different pacing — one is
// free-flowing, one is a timed audition queue), so this module does NOT try
// to collapse them into a single store. What it does is give all three a
// single shared VOCABULARY and TRANSITION graph, so "hand raised" means the
// same thing everywhere, a host reading one surface's code can immediately
// map it onto the others, and a future change to one no longer risks
// silently drifting from what the other two already established.
export type StageParticipantState =
  /** In Daily's native waiting-room lobby; not yet let into the call. */
  | "waiting"
  /** In the room, listening only — no mic/cam. */
  | "audience"
  /** Audience member has asked to come up and speak. */
  | "hand_raised"
  /** Promoted: mic/cam live, audible/visible to the room. */
  | "speaker"
  /** Room owner. Reached only by being the host; never assigned via promotion. */
  | "host";

/** Legal next-states for each StageParticipantState. Enforced by convention
 *  (each of the three mechanisms' own UI/edge-function guards), not by a
 *  single shared runtime — see the module comment for why. */
export const STAGE_PARTICIPANT_TRANSITIONS: Readonly<
  Record<StageParticipantState, readonly StageParticipantState[]>
> = {
  waiting: ["audience"], // host admits the knocker
  audience: ["hand_raised"], // audience member raises their hand
  hand_raised: ["speaker", "audience"], // host promotes, or hand is dismissed/cancelled
  speaker: ["audience"], // host demotes back to listening
  host: [], // terminal — a room's host does not transition through this model
};

export function canTransitionStageParticipant(
  from: StageParticipantState,
  to: StageParticipantState,
): boolean {
  return STAGE_PARTICIPANT_TRANSITIONS[from]?.includes(to) ?? false;
}

/** Curated Stage's `curated_stage_raised_hands.status` maps onto this model. */
export function curatedRaisedHandStatusToState(
  status: "pending" | "promoted" | "dismissed",
): StageParticipantState {
  if (status === "promoted") return "speaker";
  if (status === "dismissed") return "audience";
  return "hand_raised";
}

/** Open Stage's local Member.role + Member.handRaised (SoundStageRoom.tsx)
 *  map onto this model — used anywhere that needs the unified vocabulary
 *  instead of re-deriving it ad hoc. */
export function soundStageMemberToState(member: {
  role: "host" | "speaker" | "audience";
  handRaised: boolean;
}): StageParticipantState {
  if (member.role === "host") return "host";
  if (member.role === "speaker") return "speaker";
  return member.handRaised ? "hand_raised" : "audience";
}
