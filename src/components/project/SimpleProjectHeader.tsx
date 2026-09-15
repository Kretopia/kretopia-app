import { useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, ArrowLeft, UserPlus, X, Crown, Video, Loader2, ChevronDown, Link as LinkIcon } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { InviteCollaboratorDialog } from "./InviteCollaboratorDialog";
import { VideoCallSheet } from "./VideoCallSheet";
import { StartCallSheet, type StartCallPerson } from "./StartCallSheet";
import { StartMeetingDialog } from "@/components/calls/StartMeetingDialog";
import { CallStartChooser } from "@/components/calls/CallStartChooser";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { sendPushNotification } from "@/lib/pushNotifications";
import { ringUsers } from "@/hooks/useIncomingCall";
import { APP_URL } from "@/lib/constants";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface SimpleProjectHeaderProps {
  project: {
    id: string;
    title: string;
    description: string | null;
    status: string | null;
    created_by: string;
  };
  collaborators: Array<{
    id: string;
    full_name: string;
    avatar_url: string | null;
    role: string;
  }>;
  onCollaboratorsChanged?: () => void;
  compact?: boolean;
}

export const SimpleProjectHeader = ({ project, collaborators, onCollaboratorsChanged, compact }: SimpleProjectHeaderProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [collaboratorToRemove, setCollaboratorToRemove] = useState<{ id: string; name: string } | null>(null);
  const [removing, setRemoving] = useState(false);
  const [callOpen, setCallOpen] = useState(false);
  const [startSheetOpen, setStartSheetOpen] = useState(false);
  const [meetingDialogOpen, setMeetingDialogOpen] = useState(false);
  const [chooserOpen, setChooserOpen] = useState(false);
  const [startingCall, setStartingCall] = useState(false);
  const [callRoomUrl, setCallRoomUrl] = useState<string | null>(null);
  const [callToken, setCallToken] = useState<string | null>(null);
  const [callId, setCallId] = useState<string | null>(null);

  const isOwner = user?.id === project.created_by;

  const myName =
    collaborators.find((c) => c.id === user?.id)?.full_name ||
    user?.user_metadata?.full_name ||
    user?.email?.split("@")[0] ||
    "Someone";

  // Project members shaped for the StartCallSheet (excluding self)
  const projectMembersForPicker: StartCallPerson[] = collaborators
    .filter((c) => c.id !== user?.id)
    .map((c) => ({
      user_id: c.id,
      full_name: c.full_name,
      avatar_url: c.avatar_url,
      role: c.role ?? null,
      source: "project" as const,
    }));

  // Step 1: Camera tap → open the Meet-style chooser (link to share vs. ring members).
  const openStartSheet = () => {
    if (startingCall || callOpen) return;
    setChooserOpen(true);
  };

  // Step 2: Sheet "Start call" → mint room, ring selected, drop into lobby.
  const handleStartCall = async (opts: {
    inviteUserIds: string[];
    sharedGuestLink: boolean;
  }) => {
    if (startingCall) return;
    setStartingCall(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-video-room", {
        body: { project_id: project.id, user_name: myName },
      });
      if (error) throw error;
      if (!data?.room_url) throw new Error("No room URL returned");

      setCallRoomUrl(data.room_url);
      setCallToken(data.token ?? null);
      setCallId(data.call_id ?? null);
      setStartSheetOpen(false);
      setCallOpen(true);

      const myAvatar =
        collaborators.find((c) => c.id === user?.id)?.avatar_url ?? null;
      const roomName = data.room_url.split("/").pop();

      // Ring selected people via Realtime (instant) + push (offline fallback)
      if (opts.inviteUserIds.length > 0) {
        void ringUsers(opts.inviteUserIds, {
          kind: "project",
          projectId: project.id,
          projectName: project.title,
          callerId: user!.id,
          callerName: myName,
          callerAvatar: myAvatar,
          roomUrl: data.room_url,
          roomName,
          callId: data.call_id ?? null,
        });

        opts.inviteUserIds.forEach((uid) => {
          sendPushNotification({
            userId: uid,
            title: "Live call started",
            body: `${myName} started a call on ${project.title}. Join now →`,
            type: "general",
            link: `/desk/${project.id}?joinCall=1`,
            data: { project_id: project.id, kind: "video_call" },
          }).catch((e) => console.error("[startCall] notify failed", e));
        });
      }

      // Generate + share a guest link (WhatsApp etc.) if requested
      if (opts.sharedGuestLink) {
        try {
          const { data: linkData, error: linkErr } = await supabase.functions.invoke(
            "create-video-guest-link",
            {
              body: {
                project_id: project.id,
                direct_call_id: null,
                room_name: roomName,
                room_url: data.room_url,
                guest_label: project.title,
              },
            },
          );
          if (linkErr) throw linkErr;
          const guestUrl = `${APP_URL}/call/${linkData.token}`;
          const shareText = `${myName} is inviting you to a live video call on ${project.title}. Join here:`;
          if (navigator.share) {
            try {
              await navigator.share({
                title: `Join "${project.title}" on Kretopia`,
                text: shareText,
                url: guestUrl,
              });
            } catch {
              await navigator.clipboard.writeText(`${shareText} ${guestUrl}`);
              toast({ title: "Guest link copied", description: "Paste it in WhatsApp or anywhere." });
            }
          } else {
            await navigator.clipboard.writeText(`${shareText} ${guestUrl}`);
            toast({ title: "Guest link copied", description: "Paste it in WhatsApp or anywhere." });
          }
        } catch (le: any) {
          console.error("[startCall] guest link", le);
          toast({
            title: "Couldn't create guest link",
            description: le?.message,
            variant: "destructive",
          });
        }
      }
    } catch (e: any) {
      console.error("[startCall]", e);
      toast({
        title: "Couldn't start the call",
        description: e?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setStartingCall(false);
    }
  };

  // Listen for global "start video call" event (e.g. from voice command)
  useEffect(() => {
    const onStart = () => {
      if (!startingCall && !callOpen) openStartSheet();
    };
    window.addEventListener("thrivedesk:start-video-call", onStart);
    return () => window.removeEventListener("thrivedesk:start-video-call", onStart);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startingCall, callOpen]);

  // Auto-join via ?joinCall=1 (from accept-call deep link). Members mint
  // their own meeting token using mint-video-token.
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    if (searchParams.get("joinCall") !== "1" || !user?.id) return;
    let cancelled = false;
    (async () => {
      try {
        // Refetch room url from the project to ensure it's still live.
        const { data: prj } = await supabase
          .from("projects")
          .select("video_room_url")
          .eq("id", project.id)
          .maybeSingle();
        if (!prj?.video_room_url) return;
        const roomName = prj.video_room_url.split("/").pop();
        const { data, error } = await supabase.functions.invoke("mint-video-token", {
          body: { room_name: roomName, user_name: myName },
        });
        if (error) throw error;
        if (cancelled) return;
        setCallRoomUrl(prj.video_room_url);
        setCallToken(data?.token ?? null);
        setCallId(null);
        setCallOpen(true);
      } catch (e) {
        console.error("[auto-join]", e);
      } finally {
        // Strip the param so refresh doesn't re-trigger
        const next = new URLSearchParams(searchParams);
        next.delete("joinCall");
        setSearchParams(next, { replace: true });
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, user?.id, project.id]);

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case 'active': return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'completed': return 'bg-primary/10 text-primary border-primary/20';
      case 'planning': return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const handleRemoveCollaborator = async () => {
    if (!collaboratorToRemove) return;

    setRemoving(true);
    try {
      // Routed through copilot-collaborator-tools (instead of deleting the
      // row directly from the client) so this goes through the same
      // ownership check + audit trail as the AI-agent paths that perform
      // the same action -- see supabase/functions/_shared/agentAuthority.ts.
      const { data, error: invokeError } = await supabase.functions.invoke(
        "copilot-collaborator-tools",
        {
          body: {
            _tool: "remove_collaborator",
            _source: "human_ui",
            project_id: project.id,
            user_id_to_remove: collaboratorToRemove.id,
          },
        },
      );
      const error = invokeError || (data as any)?.error
        ? new Error((data as any)?.error || invokeError?.message || "Failed to remove collaborator")
        : null;

      if (error) throw error;

      toast({
        title: "Collaborator removed",
        description: `${collaboratorToRemove.name} has been removed from the project`,
      });
      
      onCollaboratorsChanged?.();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setRemoving(false);
      setRemoveDialogOpen(false);
      setCollaboratorToRemove(null);
    }
  };

  const confirmRemove = (collab: { id: string; full_name: string }) => {
    setCollaboratorToRemove({ id: collab.id, name: collab.full_name });
    setRemoveDialogOpen(true);
  };

  if (compact) {
    return (
      <>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="flex-1 min-w-0">
            {/* Persistent topbar chrome, not the page's content heading —
                StudioRoom's VibeHeader renders the real <h1> for this
                project inside the "today" tab, so this compact repeat
                sits one level below it instead of duplicating it. */}
            <h2 className="text-sm sm:text-base font-semibold leading-tight line-clamp-2 break-words">
              {project.title}
            </h2>
            {/* Status dot only on mobile (saves room for the title) */}
            <div className="flex items-center gap-1.5 mt-0.5">
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full shrink-0",
                  project.status === "completed" && "bg-primary",
                  project.status === "planning" && "bg-yellow-500",
                  (!project.status || project.status === "active") && "bg-green-500",
                )}
              />
              <span className="text-[10px] text-muted-foreground capitalize truncate">
                {project.status || "active"}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex -space-x-1.5">
            {collaborators.slice(0, 3).map((collab) => (
              <Avatar key={collab.id} className="h-6 w-6 border-2 border-background">
                <AvatarImage src={collab.avatar_url || undefined} />
                <AvatarFallback className="text-[9px]">{collab.full_name.charAt(0)}</AvatarFallback>
              </Avatar>
            ))}
            {collaborators.length > 3 && (
              <div className="h-6 w-6 rounded-full bg-muted border-2 border-background flex items-center justify-center text-[9px] font-medium">
                +{collaborators.length - 3}
              </div>
            )}
          </div>
          <div className="flex items-center">
            <Button
              type="button"
              size="icon"
              variant="default"
              className="h-8 w-8 rounded-l-full rounded-r-none"
              onClick={openStartSheet}
              disabled={startingCall}
              aria-label="Start video call"
              title="Start video call"
            >
              {startingCall ? <Loader2 className="h-4 w-4 animate-spin" /> : <Video className="h-4 w-4" />}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  size="icon"
                  variant="default"
                  className="h-8 w-5 rounded-l-none rounded-r-full border-l border-primary-foreground/20 px-0"
                  aria-label="More call options"
                >
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuItem onSelect={openStartSheet}>
                  <Video className="h-4 w-4 mr-2" />
                  Quick call (ring members)
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => setMeetingDialogOpen(true)}>
                  <LinkIcon className="h-4 w-4 mr-2" />
                  Group meeting (with link)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          {isOwner && (
            <div className="hidden sm:block">
              <InviteCollaboratorDialog projectId={project.id} onInvite={() => onCollaboratorsChanged?.()} />
            </div>
          )}
        </div>

        {/* Remove Confirmation Dialog */}
        <AlertDialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove collaborator?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to remove {collaboratorToRemove?.name} from this project?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleRemoveCollaborator} disabled={removing} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                {removing ? "Removing..." : "Remove"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <StartCallSheet
          open={startSheetOpen}
          onOpenChange={setStartSheetOpen}
          projectId={project.id}
          projectName={project.title}
          projectMembers={projectMembersForPicker}
          onStart={handleStartCall}
          starting={startingCall}
        />

        <VideoCallSheet
          open={callOpen}
          onOpenChange={setCallOpen}
          projectName={project.title}
          roomUrl={callRoomUrl}
          token={callToken}
          callId={callId}
          userName={myName}
          projectId={project.id}
          roomName={callRoomUrl?.split("/").pop() ?? null}
        />

        <StartMeetingDialog
          open={meetingDialogOpen}
          onOpenChange={setMeetingDialogOpen}
          source="studio"
          title={project.title}
          projectId={project.id}
          people={projectMembersForPicker.map((p) => ({
            id: p.user_id,
            name: p.full_name,
            avatar: p.avatar_url,
            preselected: true,
          }))}
        />

        <CallStartChooser
          open={chooserOpen}
          onOpenChange={setChooserOpen}
          instantLabel="Ring project members now"
          instantHint="Calls everyone on this project with a ringtone."
          linkLabel="Get a meeting link to share"
          linkHint="Open a room with a link — perfect for clients or guests."
          onPickInstant={() => {
            setChooserOpen(false);
            setStartSheetOpen(true);
          }}
          onPickLink={() => {
            setChooserOpen(false);
            setMeetingDialogOpen(true);
          }}
          starting={startingCall}
        />
      </>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(-1)}
          className="shrink-0"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl md:text-3xl font-bold truncate">{project.title}</h1>
          {project.description && (
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
              {project.description}
            </p>
          )}
        </div>
        <Badge variant="outline" className={getStatusColor(project.status)}>
          {project.status || 'Planning'}
        </Badge>
      </div>

      {/* Collaborators with Invite Button */}
      <div className="flex items-center gap-3 p-4 bg-muted/30 rounded-lg">
        <Users className="h-5 w-5 text-muted-foreground shrink-0" />
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                <div className="flex -space-x-2">
                  {collaborators.slice(0, 3).map((collab, index) => (
                    <Avatar key={collab.id} className="h-8 w-8 border-2 border-background">
                      <AvatarImage src={collab.avatar_url || undefined} />
                      <AvatarFallback className="text-xs">
                        {collab.full_name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                  ))}
                  {collaborators.length > 3 && (
                    <div className="h-8 w-8 rounded-full bg-muted border-2 border-background flex items-center justify-center text-xs font-medium">
                      +{collaborators.length - 3}
                    </div>
                  )}
                </div>
                <span className="text-sm text-muted-foreground truncate">
                  {collaborators.length === 1
                    ? collaborators[0].full_name
                    : `${collaborators.length} collaborators`}
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
              {collaborators.map((collab) => (
                <DropdownMenuItem 
                  key={collab.id} 
                  className="flex items-center gap-3 p-2"
                  onSelect={(e) => e.preventDefault()}
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={collab.avatar_url || undefined} />
                    <AvatarFallback className="text-xs">
                      {collab.full_name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate flex items-center gap-1">
                      {collab.full_name}
                      {collab.id === project.created_by && (
                        <Crown className="h-3 w-3 text-yellow-500" />
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{collab.role}</p>
                  </div>
                  {isOwner && collab.id !== project.created_by && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive hover:text-destructive"
                      onClick={() => confirmRemove(collab)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </DropdownMenuItem>
              ))}
              {isOwner && (
                <>
                  <DropdownMenuSeparator />
                  <div className="p-2">
                    <InviteCollaboratorDialog 
                      projectId={project.id} 
                      onInvite={() => onCollaboratorsChanged?.()} 
                    />
                  </div>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        
        {/* Start Call Button */}
        <Button
          type="button"
          size="sm"
          variant="default"
          className="gap-2 shrink-0"
          onClick={openStartSheet}
          disabled={startingCall}
        >
          {startingCall ? <Loader2 className="h-4 w-4 animate-spin" /> : <Video className="h-4 w-4" />}
          Start call
        </Button>

        {/* Quick Invite Button */}
        {isOwner && (
          <InviteCollaboratorDialog 
            projectId={project.id} 
            onInvite={() => onCollaboratorsChanged?.()} 
          />
        )}
      </div>

      {/* Remove Confirmation Dialog */}
      <AlertDialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove collaborator?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {collaboratorToRemove?.name} from this project? 
              They will no longer have access to project files, tasks, or messages.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveCollaborator}
              disabled={removing}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {removing ? "Removing..." : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <StartCallSheet
        open={startSheetOpen}
        onOpenChange={setStartSheetOpen}
        projectId={project.id}
        projectName={project.title}
        projectMembers={projectMembersForPicker}
        onStart={handleStartCall}
        starting={startingCall}
      />

      <VideoCallSheet
        open={callOpen}
        onOpenChange={setCallOpen}
        projectName={project.title}
        roomUrl={callRoomUrl}
        token={callToken}
        callId={callId}
        userName={myName}
        projectId={project.id}
        roomName={callRoomUrl?.split("/").pop() ?? null}
      />
    </div>
  );
};