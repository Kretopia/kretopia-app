import { describe, it, expect } from "vitest";
import {
  canTransitionStageParticipant,
  curatedRaisedHandStatusToState,
  soundStageMemberToState,
  STAGE_PARTICIPANT_TRANSITIONS,
  type StageParticipantState,
} from "../stageParticipants";

describe("STAGE_PARTICIPANT_TRANSITIONS", () => {
  it("allows the documented lifecycle: waiting -> audience -> hand_raised -> speaker", () => {
    expect(canTransitionStageParticipant("waiting", "audience")).toBe(true);
    expect(canTransitionStageParticipant("audience", "hand_raised")).toBe(true);
    expect(canTransitionStageParticipant("hand_raised", "speaker")).toBe(true);
  });

  it("allows a raised hand to be dismissed back to audience, and a speaker to be demoted", () => {
    expect(canTransitionStageParticipant("hand_raised", "audience")).toBe(true);
    expect(canTransitionStageParticipant("speaker", "audience")).toBe(true);
  });

  it("host is terminal and waiting cannot skip straight to speaker", () => {
    expect(STAGE_PARTICIPANT_TRANSITIONS.host).toHaveLength(0);
    expect(canTransitionStageParticipant("waiting", "speaker")).toBe(false);
    expect(canTransitionStageParticipant("waiting", "hand_raised")).toBe(false);
  });

  it("rejects moving backward past the documented graph (e.g. audience -> waiting)", () => {
    expect(canTransitionStageParticipant("audience", "waiting")).toBe(false);
  });

  it("every state is represented in the transition table", () => {
    const states: StageParticipantState[] = ["waiting", "audience", "hand_raised", "speaker", "host"];
    for (const s of states) {
      expect(STAGE_PARTICIPANT_TRANSITIONS[s]).toBeDefined();
    }
  });
});

describe("curatedRaisedHandStatusToState", () => {
  it("maps curated_stage_raised_hands.status onto the shared model", () => {
    expect(curatedRaisedHandStatusToState("pending")).toBe("hand_raised");
    expect(curatedRaisedHandStatusToState("promoted")).toBe("speaker");
    expect(curatedRaisedHandStatusToState("dismissed")).toBe("audience");
  });
});

describe("soundStageMemberToState", () => {
  it("maps SoundStageRoom's local Member shape onto the shared model", () => {
    expect(soundStageMemberToState({ role: "host", handRaised: false })).toBe("host");
    expect(soundStageMemberToState({ role: "speaker", handRaised: false })).toBe("speaker");
    expect(soundStageMemberToState({ role: "audience", handRaised: false })).toBe("audience");
    expect(soundStageMemberToState({ role: "audience", handRaised: true })).toBe("hand_raised");
  });

  it("a promoted speaker's stale handRaised flag doesn't demote them in the model", () => {
    // Mirrors SoundStageRoom's real bug surface: `handRaised` can still be
    // true right after a promote() if the lower-hand broadcast hasn't landed
    // yet. role takes priority so the derived state doesn't flicker.
    expect(soundStageMemberToState({ role: "speaker", handRaised: true })).toBe("speaker");
  });
});
