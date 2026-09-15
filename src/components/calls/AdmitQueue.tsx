// AdmitQueue — host-only overlay listing knockers waiting at the door.
// Mounts on top of an active Daily call frame; uses Daily waiting-participant
// events so we don't poll. Mobile-first slide-up sheet.
//
// This is the "waiting" mechanism in the shared StageParticipantState model
// (src/lib/stageParticipants.ts) -- one of three previously-uncoordinated
// waiting/speaking mechanisms across SoundStages-adjacent surfaces (see that
// module's header comment for the other two: Curated Stage's persisted
// speaker queue, and Open Stage's ephemeral raise-hand). Unlike the other
// two, this one's state lives entirely inside Daily's SDK (waitingParticipants
// / updateWaitingParticipant) rather than our own DB or app-messages --
// admitting a knocker here is the `waiting -> audience` transition.
import { useEffect, useState } from "react";
import type { DailyCall } from "@daily-co/daily-js";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DoorOpen, X, Check, UserCheck, Users } from "lucide-react";

interface Knocker {
  id: string;
  name: string;
}

interface Props {
  call: DailyCall | null;
  /** Only render UI when current viewer can admit. */
  isHost: boolean;
}

export const AdmitQueue = ({ call, isHost }: Props) => {
  const [queue, setQueue] = useState<Knocker[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!call || !isHost) return;

    const sync = () => {
      try {
        const all = (call as any).waitingParticipants?.() ?? {};
        const list: Knocker[] = Object.entries(all).map(([id, p]: any) => ({
          id,
          name: p?.name || "Guest",
        }));
        setQueue(list);
        if (list.length > 0) setOpen(true);
      } catch (e) {
        console.warn("[AdmitQueue] sync failed", e);
      }
    };

    const onAdded = () => sync();
    const onUpdated = () => sync();
    const onRemoved = () => sync();

    call.on("waiting-participant-added", onAdded);
    call.on("waiting-participant-updated", onUpdated);
    call.on("waiting-participant-removed", onRemoved);
    sync();

    return () => {
      call.off("waiting-participant-added", onAdded);
      call.off("waiting-participant-updated", onUpdated);
      call.off("waiting-participant-removed", onRemoved);
    };
  }, [call, isHost]);

  if (!isHost) return null;

  const admit = async (id: string) => {
    try {
      await (call as any)?.updateWaitingParticipant?.(id, { grantedAccess: true });
    } catch (e) {
      console.warn("[AdmitQueue] admit failed", e);
    }
  };
  const deny = async (id: string) => {
    try {
      await (call as any)?.updateWaitingParticipant?.(id, { grantedAccess: false });
    } catch (e) {
      console.warn("[AdmitQueue] deny failed", e);
    }
  };
  const admitAll = async () => {
    try {
      await (call as any)?.updateWaitingParticipants?.({ "*": { grantedAccess: true } });
    } catch (e) {
      console.warn("[AdmitQueue] admit-all failed", e);
    }
  };

  return (
    <>
      {/* Floating pill — always visible to host while anyone is waiting */}
      {queue.length > 0 && !open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="absolute top-3 right-3 z-30 flex items-center gap-2 px-3 py-2 rounded-full bg-primary text-primary-foreground shadow-glow text-sm font-semibold"
        >
          <DoorOpen className="h-4 w-4" />
          {queue.length} waiting
        </button>
      )}

      {/* Slide-up sheet */}
      {open && (
        <div className="absolute inset-0 z-40 pointer-events-none">
          <div
            className="absolute inset-0 bg-black/60 pointer-events-auto"
            onClick={() => setOpen(false)}
          />
          <div
            className="absolute inset-x-0 bottom-0 pointer-events-auto bg-[#111] text-white rounded-t-2xl ring-1 ring-white/10 shadow-2xl"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)" }}
          >
            <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-white/5">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold">
                  Waiting room {queue.length > 0 && `· ${queue.length}`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="h-8 w-8 rounded-full flex items-center justify-center bg-white/5 hover:bg-white/10"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {queue.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-white/60">
                Nobody's waiting right now.
              </div>
            ) : (
              <>
                <ul className="max-h-[50vh] overflow-y-auto divide-y divide-white/5">
                  {queue.map((k) => (
                    <li key={k.id} className="flex items-center gap-3 px-4 py-3">
                      <Avatar className="h-9 w-9">
                        <AvatarFallback className="bg-primary/20 text-primary text-xs font-semibold">
                          {k.name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <p className="flex-1 min-w-0 text-sm font-medium truncate">{k.name}</p>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deny(k.id)}
                        className="h-9 px-3 rounded-full bg-white/5 hover:bg-white/10 text-white/80"
                      >
                        <X className="h-4 w-4" />
                        Deny
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => admit(k.id)}
                        className="h-9 px-3 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground"
                      >
                        <Check className="h-4 w-4" />
                        Admit
                      </Button>
                    </li>
                  ))}
                </ul>
                <div className="px-4 pt-3">
                  <Button
                    onClick={admitAll}
                    className="w-full h-11 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground"
                  >
                    <UserCheck className="h-4 w-4" />
                    Admit everyone
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
};
