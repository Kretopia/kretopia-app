import { Suspense, lazy } from "react";

// Same lazy split UnifiedHome already uses for guests -- logged-in users
// landing here (via the Navbar logo) shouldn't pay for this chunk on
// every other route either.
const KretopiaLanding = lazy(
  () => import("@/components/landing/KretopiaLanding").then((m) => ({ default: m.KretopiaLanding })),
);

/**
 * The real marketing landing page, reachable at /landing regardless of
 * auth state -- unlike "/", which renders TodayDashboard once signed in.
 * Exists so the Navbar's Kretopia logo can always return here, even from
 * an authenticated profile: Navbar shows the normal signed-out CTAs to a
 * guest here and a small connected-avatar trigger instead of them to a
 * signed-in user (see Navbar.tsx's own isLandingPage handling) -- this
 * page itself doesn't need to know or care which.
 */
const Welcome = () => (
  <Suspense fallback={<div className="min-h-screen" style={{ backgroundColor: "#05070D" }} aria-busy="true" />}>
    {/* onSearchSubmit is a required prop KretopiaLanding forwards to
        KretopiaHero, which no longer calls it (see that component's own
        header comment) -- kept required there for other callers, so this
        is a no-op, not dead functionality this page is skipping. */}
    <KretopiaLanding onSearchSubmit={() => {}} />
  </Suspense>
);

export default Welcome;
