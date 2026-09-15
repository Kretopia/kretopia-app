// Cost-gating STRUCTURE for SoundStage room creation/duration.
//
// Audit finding: there is currently NO subscription-tier gate anywhere on
// SoundStage room creation or duration -- any user, on any tier, can create
// rooms and run them up to the shared session ceiling
// (_shared/roomSessionLimits.ts). That's a real cost-control gap (Daily.co
// bills per participant-minute), but deciding the REAL per-tier limits --
// how many concurrent stages, what session length per tier -- is a
// product/business decision, and this file does not make it.
//
// What this DOES provide is the mechanism: a config object mapping
// subscription tier -> allowed room duration / concurrent room count, plus
// a small helper to check it, wired into create-sound-stage (the most
// central SoundStage room creator) as a proof of concept. The other 14
// room-creating edge functions are NOT wired up yet -- extending this to
// them is now a matter of importing getRoomCostLimits()/checkRoomCostGate()
// the same way create-sound-stage does, not designing anything new.
//
// EVERY number below is a PLACEHOLDER, clearly generous enough that no real
// user should ever hit it -- merging this does not restrict anyone today.
// Tier keys mirror the vocabulary _shared/platformFees.ts already
// established (profiles.subscription_tier / profiles_subscription_tier_check).
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { ROOM_SESSION_CEILING_SECONDS } from "./roomSessionLimits.ts";

export interface RoomCostLimits {
  /** Max session length in seconds for a room this tier creates.
   *  NEEDS PRODUCT DECISION -- placeholder. Every tier currently gets the
   *  full shared ceiling; nothing is actually shortened per-tier yet. */
  maxSessionSeconds: number;
  /** Max concurrent LIVE Sound Stages this user may host at once.
   *  NEEDS PRODUCT DECISION -- placeholder, deliberately generous. */
  maxConcurrentRooms: number;
}

// NEEDS PRODUCT DECISION -- placeholder, not a real limit yet. Every tier
// gets an identical, deliberately generous allowance below; there is no
// product input behind these specific numbers beyond "high enough that no
// legitimate user would plausibly hit it while this is still a proof of
// concept." Differentiating free vs. paid tiers here is exactly the
// decision this change intentionally leaves open.
export const SUBSCRIPTION_ROOM_LIMITS: Record<string, RoomCostLimits> = {
  free: { maxSessionSeconds: ROOM_SESSION_CEILING_SECONDS, maxConcurrentRooms: 20 },
  pro: { maxSessionSeconds: ROOM_SESSION_CEILING_SECONDS, maxConcurrentRooms: 20 },
  creator_pro: { maxSessionSeconds: ROOM_SESSION_CEILING_SECONDS, maxConcurrentRooms: 20 },
  studio: { maxSessionSeconds: ROOM_SESSION_CEILING_SECONDS, maxConcurrentRooms: 20 },
  enterprise: { maxSessionSeconds: ROOM_SESSION_CEILING_SECONDS, maxConcurrentRooms: 20 },
  founder: { maxSessionSeconds: ROOM_SESSION_CEILING_SECONDS, maxConcurrentRooms: 20 },
  brand_pro: { maxSessionSeconds: ROOM_SESSION_CEILING_SECONDS, maxConcurrentRooms: 20 },
  brand_enterprise: { maxSessionSeconds: ROOM_SESSION_CEILING_SECONDS, maxConcurrentRooms: 20 },
};

const DEFAULT_LIMITS: RoomCostLimits = SUBSCRIPTION_ROOM_LIMITS.free;

export function getRoomCostLimits(tier: string | null | undefined): RoomCostLimits {
  return SUBSCRIPTION_ROOM_LIMITS[tier ?? "free"] ?? DEFAULT_LIMITS;
}

export interface RoomCostGateResult {
  allowed: boolean;
  limits: RoomCostLimits;
  currentLiveRooms: number;
  reason?: string;
}

/**
 * Proof-of-concept cost gate: checks how many Sound Stages this user
 * currently has live against their tier's (placeholder) concurrent-room
 * limit. Only covers sound_stages -- not project/circle/meeting/event rooms
 * or the other 13 room-creating functions -- since this is meant to prove
 * the wiring pattern on one central function, not enforce a cross-product
 * limit that doesn't exist as a product decision yet.
 */
export async function checkRoomCostGate(
  admin: SupabaseClient,
  userId: string,
  tier: string | null | undefined,
): Promise<RoomCostGateResult> {
  const limits = getRoomCostLimits(tier);
  const { count, error } = await admin
    .from("sound_stages")
    .select("id", { count: "exact", head: true })
    .eq("host_user_id", userId)
    .eq("is_live", true);

  if (error) {
    // Fail OPEN, not closed -- this is a placeholder proof-of-concept gate,
    // not a hardened limiter. A gate outage must never block someone from
    // opening a stage.
    console.warn("[subscriptionRoomLimits] live-room count failed, allowing", error);
    return { allowed: true, limits, currentLiveRooms: 0 };
  }

  const currentLiveRooms = count ?? 0;
  if (currentLiveRooms >= limits.maxConcurrentRooms) {
    return {
      allowed: false,
      limits,
      currentLiveRooms,
      reason: `You already have ${currentLiveRooms} live Sound Stage${currentLiveRooms === 1 ? "" : "s"} open (limit: ${limits.maxConcurrentRooms} on your current plan).`,
    };
  }
  return { allowed: true, limits, currentLiveRooms };
}
