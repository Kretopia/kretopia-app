import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Calendar, MapPin, Ticket, ArrowRight, Users, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Filter = "all" | "free" | "ticketed";

interface EventRow {
  id: string;
  title: string;
  start_time: string;
  venue_name: string | null;
  venue_address: string | null;
  cover_image_url: string | null;
  is_ticketed: boolean | null;
  ticket_price: number | null;
  ticket_currency: string | null;
  external_ticket_url: string | null;
  event_mode: string | null;
  participant_count?: number;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$", EUR: "€", GBP: "£", IDR: "Rp", TTD: "TT$",
};

const formatWhen = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit",
  });
};

export const EventsNearYouSection = ({ limit = 8 }: { limit?: number }) => {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const nowIso = new Date().toISOString();
      const { data, error } = await supabase
        .from("creative_jams")
        .select("id, title, start_time, venue_name, venue_address, cover_image_url, is_ticketed, ticket_price, ticket_currency, external_ticket_url, event_mode")
        .eq("is_public", true)
        .eq("status", "upcoming")
        .gte("start_time", nowIso)
        .order("start_time", { ascending: true })
        .limit(limit * 2);

      if (cancelled) return;
      if (error) {
        console.error("[EventsNearYouSection] fetch failed", error);
        setEvents([]);
        setLoading(false);
        return;
      }

      // Fetch counts in parallel (best-effort)
      const ids = (data || []).map((e: any) => e.id);
      let counts: Record<string, number> = {};
      if (ids.length) {
        try {
          const { data: parts } = await supabase
            .from("jam_participants")
            .select("jam_id")
            .in("jam_id", ids)
            // 'rsvp' was a dead literal: the ticket-purchase edge functions
            // wrote it, but jam_participants_status_check never allowed it,
            // so it never actually landed in the table (see
            // 20260915100000_close_event_ticket_capacity_race_and_status_drift.sql).
            // Both purchase paths now write 'going', already covered below.
            .in("status", ["going", "checked_in"]);
          (parts || []).forEach((p: any) => {
            counts[p.jam_id] = (counts[p.jam_id] || 0) + 1;
          });
        } catch (err) {
          console.warn("[EventsNearYouSection] participant count failed", err);
        }
      }

      const enriched = (data || []).map((e: any) => ({
        ...e,
        participant_count: counts[e.id] || 0,
      })) as EventRow[];

      setEvents(enriched);
      setLoading(false);
    })().catch((err) => {
      console.error("[EventsNearYouSection] unexpected", err);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [limit]);

  const filtered = useMemo(() => {
    const list = events.filter((e) => {
      const isPaid = !!e.is_ticketed && (e.ticket_price || 0) > 0;
      if (filter === "free") return !isPaid;
      if (filter === "ticketed") return isPaid;
      return true;
    });
    return list.slice(0, limit);
  }, [events, filter, limit]);

  if (!loading && events.length === 0) return null;

  return (
    <section className="mb-8 scroll-mt-14">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
          <Calendar className="h-4 w-4 text-primary" />
          What's on
        </h2>
        <Link to="/events" className="text-xs text-primary font-medium flex items-center gap-1 hover:underline">
          See all <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {/* Filter chips */}
      <div className="flex items-center gap-1.5 mb-3 overflow-x-auto scrollbar-hide -mx-4 px-4">
        {(["all", "free", "ticketed"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "shrink-0 px-3 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wider border transition-colors",
              filter === f
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card text-muted-foreground border-border hover:border-foreground/30"
            )}
          >
            {f === "all" ? "All" : f === "free" ? "Free" : "Ticketed"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex gap-3 overflow-hidden -mx-4 px-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="shrink-0 w-[78%] sm:w-[300px] h-44 rounded-2xl bg-muted/40 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No {filter === "free" ? "free" : filter === "ticketed" ? "ticketed" : ""} events right now. Check back soon.
        </div>
      ) : (
        <div className="flex items-stretch gap-3 overflow-x-auto pb-3 scrollbar-hide -mx-4 px-4 snap-x snap-mandatory">
          {filtered.map((e, i) => (
            <motion.div
              key={e.id}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="shrink-0 w-[78%] sm:w-[300px] snap-start"
            >
              <EventCard event={e} />
            </motion.div>
          ))}
        </div>
      )}
    </section>
  );
};

const EventCard = ({ event }: { event: EventRow }) => {
  const isPaid = !!event.is_ticketed && (event.ticket_price || 0) > 0;
  const symbol = CURRENCY_SYMBOLS[event.ticket_currency || "USD"] || "$";
  const isExternal = !!event.external_ticket_url;
  const ctaLabel = isExternal
    ? "Get ticket"
    : isPaid
      ? `Get ticket · ${symbol}${Number(event.ticket_price).toFixed(0)}`
      : "Save my spot";

  return (
    <Link
      to={`/event/${event.id}`}
      className="group block h-full rounded-2xl border border-border bg-card overflow-hidden hover:border-primary/40 transition-colors"
    >
      <div className="relative aspect-[16/9] bg-muted overflow-hidden">
        {event.cover_image_url ? (
          <img
            src={event.cover_image_url}
            alt={event.title}
            loading="lazy"
            className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-primary/20 via-primary/5 to-card" />
        )}
        <div className="absolute top-2 left-2 flex gap-1.5">
          {isPaid ? (
            <Badge className="bg-energy text-energy-foreground text-[10px] font-bold uppercase tracking-wider">
              <Ticket className="h-3 w-3 mr-1" /> {symbol}{Number(event.ticket_price).toFixed(0)}
            </Badge>
          ) : (
            <Badge variant="outline" className="bg-card/90 text-[10px] font-bold uppercase tracking-wider">
              Free
            </Badge>
          )}
          {isExternal && (
            <Badge variant="outline" className="bg-card/90 text-[10px]">
              <ExternalLink className="h-2.5 w-2.5" />
            </Badge>
          )}
        </div>
      </div>

      <div className="p-3 space-y-2">
        <h3 className="font-semibold text-sm line-clamp-2 leading-snug">{event.title}</h3>
        <div className="space-y-1 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3 w-3 shrink-0" />
            <span className="truncate">{formatWhen(event.start_time)}</span>
          </div>
          {(event.venue_name || event.event_mode === "online") && (
            <div className="flex items-center gap-1.5">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">
                {event.event_mode === "online" ? "Online" : event.venue_name}
              </span>
            </div>
          )}
          {(event.participant_count || 0) > 0 && (
            <div className="flex items-center gap-1.5">
              <Users className="h-3 w-3 shrink-0" />
              <span>{event.participant_count} going</span>
            </div>
          )}
        </div>
        <Button
          size="sm"
          variant={isPaid ? "default" : "outline"}
          className={cn(
            "w-full text-xs font-bold mt-1",
            isPaid && "bg-energy text-energy-foreground hover:bg-energy/90"
          )}
        >
          {ctaLabel}
        </Button>
      </div>
    </Link>
  );
};
