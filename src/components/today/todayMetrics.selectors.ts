import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays, startOfDay } from "date-fns";

interface CreditRow {
  id: string;
  verification_status: string | null;
  source: string | null;
}

export interface ViewTrendPoint {
  date: string;
  views: number;
}

export interface TodayMetrics {
  loading: boolean;
  credits: CreditRow[];
  portfolioCount: number;
  awardsCount: number;
  pressCount: number;
  viewTrend: ViewTrendPoint[];
  totalViews14d: number;
}

/**
 * One consolidated read for everything the new Today metrics dashboard
 * needs that isn't already on the PROFILE_SELECT row Today already has
 * (profileFull covers social/verification/trust fields directly).
 *
 * credits/awards/press_links are genuinely separate tables (not array
 * columns on profiles, despite profiles carrying same-named legacy
 * columns) -- see useProfileData.tsx for the pattern this mirrors.
 * portfolioCount is credits rows tagged source='portfolio', matching
 * that same hook's own definition, not a separate guess.
 */
export function useTodayMetrics(userId: string | undefined): TodayMetrics {
  const [loading, setLoading] = useState(true);
  const [credits, setCredits] = useState<CreditRow[]>([]);
  const [awardsCount, setAwardsCount] = useState(0);
  const [pressCount, setPressCount] = useState(0);
  const [viewTrend, setViewTrend] = useState<ViewTrendPoint[]>([]);

  const load = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const fourteenDaysAgo = startOfDay(subDays(new Date(), 13)).toISOString();

      const [creditsRes, awardsRes, pressRes, viewsRes] = await Promise.all([
        supabase.from("credits").select("id, verification_status, source").eq("user_id", userId),
        supabase.from("awards").select("id", { count: "exact", head: true }).eq("user_id", userId),
        supabase.from("press_links").select("id", { count: "exact", head: true }).eq("user_id", userId),
        supabase
          .from("analytics_events")
          .select("created_at")
          .eq("event_name", "profile_viewed")
          .eq("event_properties->>profile_user_id", userId)
          .gte("created_at", fourteenDaysAgo),
      ]);

      setCredits(creditsRes.data || []);
      setAwardsCount(awardsRes.count || 0);
      setPressCount(pressRes.count || 0);

      // Bucket raw view events into one count per calendar day, zero-filled
      // so the chart shows a real flat line for quiet days instead of a
      // gap -- 14 real days, not 14 arbitrary points.
      const dayBuckets = new Map<string, number>();
      for (let i = 13; i >= 0; i--) {
        dayBuckets.set(format(subDays(new Date(), i), "MMM d"), 0);
      }
      for (const row of viewsRes.data || []) {
        const key = format(new Date(row.created_at as string), "MMM d");
        if (dayBuckets.has(key)) dayBuckets.set(key, (dayBuckets.get(key) || 0) + 1);
      }
      setViewTrend(Array.from(dayBuckets, ([date, views]) => ({ date, views })));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const portfolioCount = credits.filter((c) => c.source === "portfolio").length;
  const totalViews14d = viewTrend.reduce((sum, p) => sum + p.views, 0);

  return { loading, credits, portfolioCount, awardsCount, pressCount, viewTrend, totalViews14d };
}
