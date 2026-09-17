import { supabase } from "@/integrations/supabase/client";

// Generate a session ID that persists during the browser session
const getSessionId = (): string => {
  let sessionId = sessionStorage.getItem('analytics_session_id');
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem('analytics_session_id', sessionId);
  }
  return sessionId;
};

// Performance timing helper
const pageLoadTimes = new Map<string, number>();

interface TrackEventParams {
  eventName: string;
  eventCategory: string;
  properties?: Record<string, any>;
  userId?: string;
}

export const trackEvent = async ({
  eventName,
  eventCategory,
  properties = {},
  userId,
}: TrackEventParams) => {
  try {
    const sessionId = getSessionId();
    
    // Get current user if not provided
    let finalUserId = userId;
    if (!finalUserId) {
      const { data: { user } } = await supabase.auth.getUser();
      finalUserId = user?.id;
    }

    await supabase.from('analytics_events').insert({
      user_id: finalUserId,
      session_id: sessionId,
      event_name: eventName,
      event_category: eventCategory,
      event_properties: properties,
      page_path: window.location.pathname,
      referrer: document.referrer,
      user_agent: navigator.userAgent,
    });
  } catch (error) {
    // Silently fail - don't break the app if analytics fails
    console.error('Analytics tracking error:', error);
  }
};

// Start page load timing
export const startPageTiming = (pageName: string) => {
  pageLoadTimes.set(pageName, performance.now());
};

// End page load timing and track
export const endPageTiming = async (pageName: string) => {
  const startTime = pageLoadTimes.get(pageName);
  if (startTime) {
    const loadTime = Math.round(performance.now() - startTime);
    pageLoadTimes.delete(pageName);
    await trackEvent({
      eventName: 'page_load_time',
      eventCategory: 'performance',
      properties: { pageName, loadTimeMs: loadTime }
    });
  }
};

// Predefined event categories
export const EventCategory = {
  AUTH: 'auth',
  NAVIGATION: 'navigation',
  PROFILE: 'profile',
  DISCOVERY: 'discovery',
  MESSAGING: 'messaging',
  OPPORTUNITIES: 'opportunities',
  SUBSCRIPTION: 'subscription',
  ENGAGEMENT: 'engagement',
  ONBOARDING: 'onboarding',
  COLLABORATION: 'collaboration',
  PROJECT: 'project',
  PAYWALL: 'paywall',
  PAYMENT: 'payment',
} as const;

// Common event tracking functions
export const analytics = {
  // Auth events
  signUp: (method: string = 'email') =>
    trackEvent({
      eventName: 'sign_up',
      eventCategory: EventCategory.AUTH,
      properties: { method },
    }),

  signIn: (method: string = 'email') =>
    trackEvent({
      eventName: 'sign_in',
      eventCategory: EventCategory.AUTH,
      properties: { method },
    }),

  signOut: () =>
    trackEvent({
      eventName: 'sign_out',
      eventCategory: EventCategory.AUTH,
    }),

  // Navigation events
  pageView: (pageName: string) =>
    trackEvent({
      eventName: 'page_view',
      eventCategory: EventCategory.NAVIGATION,
      properties: { page: pageName },
    }),

  // Profile events
  profileComplete: (completionPercentage: number) =>
    trackEvent({
      eventName: 'profile_completed',
      eventCategory: EventCategory.PROFILE,
      properties: { completion_percentage: completionPercentage },
    }),

  profileUpdate: (field: string) =>
    trackEvent({
      eventName: 'profile_updated',
      eventCategory: EventCategory.PROFILE,
      properties: { field },
    }),

  // Discovery events
  swipe: (direction: 'left' | 'right', targetUserId?: string) =>
    trackEvent({
      eventName: 'swipe',
      eventCategory: EventCategory.DISCOVERY,
      properties: { direction, target_user_id: targetUserId },
    }),

  undoSwipe: (targetUserId: string) =>
    trackEvent({
      eventName: 'undo_swipe',
      eventCategory: EventCategory.DISCOVERY,
      properties: { target_user_id: targetUserId },
    }),

  swipeLimitHit: (currentTier: string) =>
    trackEvent({
      eventName: 'swipe_limit_hit',
      eventCategory: EventCategory.PAYWALL,
      properties: { current_tier: currentTier, limit: 30 },
    }),

  match: (matchedUserId?: string) =>
    trackEvent({
      eventName: 'match_created',
      eventCategory: EventCategory.DISCOVERY,
      properties: { matched_user_id: matchedUserId },
    }),

  matchExplanationViewed: (targetUserId: string, matchScore: number) =>
    trackEvent({
      eventName: 'match_explanation_viewed',
      eventCategory: EventCategory.DISCOVERY,
      properties: { target_user_id: targetUserId, match_score: matchScore },
    }),

  profilePreview: (targetUserId: string, source: 'match_card' | 'search' | 'message') =>
    trackEvent({
      eventName: 'profile_preview',
      eventCategory: EventCategory.DISCOVERY,
      properties: { target_user_id: targetUserId, source },
    }),

  // Activation funnel events (Search -> Claim -> Confirm -> Passport)
  searchStarted: (query: string) =>
    trackEvent({
      eventName: 'search_started',
      eventCategory: EventCategory.ONBOARDING,
      properties: { query_length: query.length },
    }),

  // Creative Passport migration — additive, flag-gated (FEATURE_SEARCH_V2).
  // New event vocabulary for the Creative Record search step; existing
  // search_started/passport_preview_viewed above are untouched.
  creativeSearchStarted: (query: string) =>
    trackEvent({
      eventName: 'creative_search_started',
      eventCategory: EventCategory.ONBOARDING,
      properties: { query_length: query.length },
    }),

  creativeSearchCompleted: (resultCount: number) =>
    trackEvent({
      eventName: 'creative_search_completed',
      eventCategory: EventCategory.ONBOARDING,
      properties: { result_count: resultCount },
    }),

  passportFound: (kind: 'unclaimed_person' | 'no_record') =>
    trackEvent({
      eventName: 'passport_found',
      eventCategory: EventCategory.ONBOARDING,
      properties: { kind },
    }),

  passportPreviewViewed: (targetUserId: string, claimed: boolean) =>
    trackEvent({
      eventName: 'passport_preview_viewed',
      eventCategory: EventCategory.ONBOARDING,
      properties: { target_user_id: targetUserId, claimed },
    }),

  claimStarted: (source: string) =>
    trackEvent({
      eventName: 'claim_started',
      eventCategory: EventCategory.ONBOARDING,
      properties: { source },
    }),

  creditConfirmed: (count: number) =>
    trackEvent({
      eventName: 'credit_confirmed',
      eventCategory: EventCategory.PROFILE,
      properties: { count },
    }),

  creditRemoved: (reason: 'not_me' | 'user_removed' = 'not_me') =>
    trackEvent({
      eventName: 'credit_removed',
      eventCategory: EventCategory.PROFILE,
      properties: { reason },
    }),

  passportBuildStarted: (creditCount: number) =>
    trackEvent({
      eventName: 'passport_build_started',
      eventCategory: EventCategory.ONBOARDING,
      properties: { credit_count: creditCount },
    }),

  passportBuildCompleted: (bioDrafted: boolean, skillsSuggested: number) =>
    trackEvent({
      eventName: 'passport_build_completed',
      eventCategory: EventCategory.ONBOARDING,
      properties: { bio_drafted: bioDrafted, skills_suggested: skillsSuggested },
    }),

  trustActionStarted: (action: 'cosign' | 'share' | 'verify_identity') =>
    trackEvent({
      eventName: 'trust_action_started',
      eventCategory: EventCategory.ENGAGEMENT,
      properties: { action },
    }),

  passportShared: (channel: string) =>
    trackEvent({
      eventName: 'passport_shared',
      eventCategory: EventCategory.ENGAGEMENT,
      properties: { channel },
    }),

  passportRevealed: (bioDrafted: boolean) =>
    trackEvent({
      eventName: 'passport_revealed',
      eventCategory: EventCategory.ONBOARDING,
      properties: { bio_drafted: bioDrafted },
    }),

  activationCompleted: () =>
    trackEvent({
      eventName: 'activation_completed',
      eventCategory: EventCategory.ONBOARDING,
    }),

  // Opportunity events
  opportunityView: (opportunityId: string) =>
    trackEvent({
      eventName: 'opportunity_viewed',
      eventCategory: EventCategory.OPPORTUNITIES,
      properties: { opportunity_id: opportunityId },
    }),

  opportunityApply: (opportunityId: string) =>
    trackEvent({
      eventName: 'opportunity_applied',
      eventCategory: EventCategory.OPPORTUNITIES,
      properties: { opportunity_id: opportunityId },
    }),

  opportunityCreate: (opportunityId: string) =>
    trackEvent({
      eventName: 'opportunity_created',
      eventCategory: EventCategory.OPPORTUNITIES,
      properties: { opportunity_id: opportunityId },
    }),

  // Subscription events
  subscriptionStart: (tier: string, amount?: number) =>
    trackEvent({
      eventName: 'subscription_started',
      eventCategory: EventCategory.SUBSCRIPTION,
      properties: { tier, amount },
    }),

  subscriptionCancel: (tier: string) =>
    trackEvent({
      eventName: 'subscription_canceled',
      eventCategory: EventCategory.SUBSCRIPTION,
      properties: { tier },
    }),

  subscriptionUpgrade: (fromTier: string, toTier: string) =>
    trackEvent({
      eventName: 'subscription_upgraded',
      eventCategory: EventCategory.SUBSCRIPTION,
      properties: { from_tier: fromTier, to_tier: toTier },
    }),

  paywallViewed: (feature: string, currentTier: string) =>
    trackEvent({
      eventName: 'paywall_viewed',
      eventCategory: EventCategory.PAYWALL,
      properties: { feature, current_tier: currentTier },
    }),

  // Messaging events
  messageSent: (recipientId?: string, source?: 'match' | 'direct' | 'project') =>
    trackEvent({
      eventName: 'message_sent',
      eventCategory: EventCategory.MESSAGING,
      properties: { recipient_id: recipientId, source },
    }),

  conversationStarted: (recipientId: string, source: 'match' | 'profile') =>
    trackEvent({
      eventName: 'conversation_started',
      eventCategory: EventCategory.MESSAGING,
      properties: { recipient_id: recipientId, source },
    }),

  // Onboarding events
  onboardingStart: () =>
    trackEvent({
      eventName: 'onboarding_started',
      eventCategory: EventCategory.ONBOARDING,
    }),

  onboardingComplete: () =>
    trackEvent({
      eventName: 'onboarding_completed',
      eventCategory: EventCategory.ONBOARDING,
    }),

  onboardingStep: (stepNumber: number, stepName: string) =>
    trackEvent({
      eventName: 'onboarding_step',
      eventCategory: EventCategory.ONBOARDING,
      properties: { step_number: stepNumber, step_name: stepName },
    }),

  // Collaboration events
  connectionRequest: (targetUserId?: string) =>
    trackEvent({
      eventName: 'connection_request',
      eventCategory: EventCategory.COLLABORATION,
      properties: { target_user_id: targetUserId },
    }),

  projectCreated: (projectId: string, matchId?: string, collaboratorCount?: number) =>
    trackEvent({
      eventName: 'project_created',
      eventCategory: EventCategory.PROJECT,
      properties: { project_id: projectId, match_id: matchId, collaborator_count: collaboratorCount },
    }),

  // New Room (voice-first project intake). Properties are deliberately safe
  // metadata only -- input mode, workspace type, outcome, error category --
  // never raw transcripts, file contents or brief text. See
  // NEW_ROOM_UX_AUDIT.md for why these specific points were instrumented.
  newRoomOpened: (source: string) =>
    trackEvent({
      eventName: 'new_room_opened',
      eventCategory: EventCategory.PROJECT,
      properties: { source },
    }),

  newRoomInputModeSelected: (mode: 'voice' | 'text' | 'file' | 'link') =>
    trackEvent({
      eventName: 'new_room_input_mode_selected',
      eventCategory: EventCategory.PROJECT,
      properties: { mode },
    }),

  newRoomVoiceStarted: () =>
    trackEvent({ eventName: 'new_room_voice_started', eventCategory: EventCategory.PROJECT }),

  newRoomVoiceCompleted: (durationSeconds: number) =>
    trackEvent({
      eventName: 'new_room_voice_completed',
      eventCategory: EventCategory.PROJECT,
      properties: { duration_bucket: durationSeconds < 10 ? 'short' : durationSeconds < 60 ? 'medium' : 'long' },
    }),

  newRoomVoiceCancelled: (durationSeconds: number) =>
    trackEvent({
      eventName: 'new_room_voice_cancelled',
      eventCategory: EventCategory.PROJECT,
      properties: { duration_bucket: durationSeconds < 10 ? 'short' : durationSeconds < 60 ? 'medium' : 'long' },
    }),

  newRoomTextSubmitted: (workspaceType: string) =>
    trackEvent({
      eventName: 'new_room_text_submitted',
      eventCategory: EventCategory.PROJECT,
      properties: { workspace_type: workspaceType },
    }),

  newRoomFileUploaded: (fileType: string) =>
    trackEvent({
      eventName: 'new_room_file_uploaded',
      eventCategory: EventCategory.PROJECT,
      properties: { file_type: fileType },
    }),

  newRoomLinkSubmitted: () =>
    trackEvent({ eventName: 'new_room_link_submitted', eventCategory: EventCategory.PROJECT }),

  newRoomDraftReady: (workspaceType: string, deliverableCount: number) =>
    trackEvent({
      eventName: 'new_room_draft_ready',
      eventCategory: EventCategory.PROJECT,
      properties: { workspace_type: workspaceType, deliverable_count: deliverableCount },
    }),

  newRoomDraftCancelled: () =>
    trackEvent({ eventName: 'new_room_draft_cancelled', eventCategory: EventCategory.PROJECT }),

  newRoomProjectConfirmed: (workspaceType: string) =>
    trackEvent({
      eventName: 'new_room_project_confirmed',
      eventCategory: EventCategory.PROJECT,
      properties: { workspace_type: workspaceType },
    }),

  newRoomCreationFailed: (errorCategory: string) =>
    trackEvent({
      eventName: 'new_room_creation_failed',
      eventCategory: EventCategory.PROJECT,
      properties: { error_category: errorCategory },
    }),

  projectFileShared: (projectId: string, fileType: string) =>
    trackEvent({
      eventName: 'project_file_shared',
      eventCategory: EventCategory.PROJECT,
      properties: { project_id: projectId, file_type: fileType },
    }),

  projectTaskCompleted: (projectId: string) =>
    trackEvent({
      eventName: 'project_task_completed',
      eventCategory: EventCategory.PROJECT,
      properties: { project_id: projectId },
    }),

  projectChatMessage: (projectId: string) =>
    trackEvent({
      eventName: 'project_chat_message',
      eventCategory: EventCategory.PROJECT,
      properties: { project_id: projectId },
    }),

  portfolioItemAdded: (mediaType: string) =>
    trackEvent({
      eventName: 'portfolio_item_added',
      eventCategory: EventCategory.PROFILE,
      properties: { media_type: mediaType },
    }),

  profileViewed: (profileUserId: string, source: 'match' | 'public' | 'search' | 'message') =>
    trackEvent({
      eventName: 'profile_viewed',
      eventCategory: EventCategory.PROFILE,
      properties: { profile_user_id: profileUserId, source },
    }),

  // CTA button clicks
  ctaClick: (ctaName: string, location: string) =>
    trackEvent({
      eventName: 'cta_click',
      eventCategory: EventCategory.ENGAGEMENT,
      properties: { cta_name: ctaName, location },
    }),

  // Feature usage
  featureUsed: (featureName: string, details?: Record<string, any>) =>
    trackEvent({
      eventName: 'feature_used',
      eventCategory: EventCategory.ENGAGEMENT,
      properties: { feature: featureName, ...details },
    }),

  // Error tracking
  errorOccurred: (errorType: string, errorMessage: string, context?: string) =>
    trackEvent({
      eventName: 'error_occurred',
      eventCategory: EventCategory.ENGAGEMENT,
      properties: { error_type: errorType, error_message: errorMessage, context },
    }),

  // Session tracking
  sessionStart: () =>
    trackEvent({
      eventName: 'session_start',
      eventCategory: EventCategory.ENGAGEMENT,
    }),

  sessionEnd: (duration: number) =>
    trackEvent({
      eventName: 'session_end',
      eventCategory: EventCategory.ENGAGEMENT,
      properties: { duration_seconds: duration },
    }),

  // Payment & Milestone events
  milestoneCreated: (projectId: string, amount: number) =>
    trackEvent({
      eventName: 'milestone_created',
      eventCategory: EventCategory.PAYMENT,
      properties: { project_id: projectId, amount },
    }),

  milestoneEscrowAttempt: (projectId: string, milestoneId: string, amount: number) =>
    trackEvent({
      eventName: 'milestone_escrow_attempt',
      eventCategory: EventCategory.PAYMENT,
      properties: { project_id: projectId, milestone_id: milestoneId, amount },
    }),

  milestonePaymentAttempt: (projectId: string, milestoneId: string, amount: number) =>
    trackEvent({
      eventName: 'milestone_payment_attempt',
      eventCategory: EventCategory.PAYMENT,
      properties: { project_id: projectId, milestone_id: milestoneId, amount },
    }),

  milestoneEscrowRelease: (projectId: string, milestoneId: string, amount: number) =>
    trackEvent({
      eventName: 'milestone_escrow_release',
      eventCategory: EventCategory.PAYMENT,
      properties: { project_id: projectId, milestone_id: milestoneId, amount },
    }),

  milestoneEscrowRefund: (projectId: string, milestoneId: string) =>
    trackEvent({
      eventName: 'milestone_escrow_refund',
      eventCategory: EventCategory.PAYMENT,
      properties: { project_id: projectId, milestone_id: milestoneId },
    }),

  milestoneStatusChange: (projectId: string, milestoneId: string, newStatus: string) =>
    trackEvent({
      eventName: 'milestone_status_change',
      eventCategory: EventCategory.PAYMENT,
      properties: { project_id: projectId, milestone_id: milestoneId, new_status: newStatus },
    }),

  checkoutAttempt: (tier: string, priceId: string) =>
    trackEvent({
      eventName: 'checkout_attempt',
      eventCategory: EventCategory.SUBSCRIPTION,
      properties: { tier, price_id: priceId },
    }),

  customerPortalOpened: () =>
    trackEvent({
      eventName: 'customer_portal_opened',
      eventCategory: EventCategory.SUBSCRIPTION,
    }),
};
