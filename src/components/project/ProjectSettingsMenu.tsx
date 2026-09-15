import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MoreVertical, Settings, Trash2, StickyNote, FolderLock, Clapperboard, ListChecks, UserCheck, Music2, History, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuGroup,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ReviewPromptDialog } from "./ReviewPromptDialog";
import { ProjectCreditsDialog } from "./ProjectCreditsDialog";

interface ProjectSettingsMenuProps {
  project: {
    id: string;
    title: string;
    description: string | null;
    status: string | null;
    created_by: string;
    workspace_type?: string | null;
    track_as_credit?: boolean | null;
  };
  collaborators?: Array<{ id: string; full_name: string; avatar_url: string | null }>;
  currentUserId: string;
  isPro: boolean;
  onProjectUpdated: () => void;
  onNavigateToTab: (tab: string) => void;
}

export function ProjectSettingsMenu({
  project,
  collaborators = [],
  currentUserId,
  isPro,
  onProjectUpdated,
  onNavigateToTab,
}: ProjectSettingsMenuProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [reviewPromptOpen, setReviewPromptOpen] = useState(false);
  const [creditsDialogOpen, setCreditsDialogOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [title, setTitle] = useState(project.title);
  const [description, setDescription] = useState(project.description || "");
  const [status, setStatus] = useState(project.status || "planning");
  const [trackAsCredit, setTrackAsCredit] = useState<boolean>(!!project.track_as_credit);

  const isOwner = currentUserId === project.created_by;

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("projects")
        .update({ title, description: description || null, status, track_as_credit: trackAsCredit })
        .eq("id", project.id);
      if (error) throw error;
      toast({ title: "Project updated" });
      setSettingsOpen(false);
      onProjectUpdated();

      // Trigger credits + review prompt when project is marked as completed
      // AND the owner has opted-in to tracking this as a credit.
      if (trackAsCredit && status === "completed" && project.status !== "completed") {
        setTimeout(() => setCreditsDialogOpen(true), 500);
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProject = async () => {
    setDeleting(true);
    try {
      // Routed through copilot-collaborator-tools instead of cascading raw
      // client-side deletes across 7 tables. Every one of them FKs to
      // projects(id) ON DELETE CASCADE, so deleting the project row is
      // sufficient -- and doing it through the shared edge function means
      // this now goes through the same ownership check + audit trail
      // (orch_runs/orch_actions) as the AI-agent path that performs the
      // exact same delete_project action. See _shared/agentAuthority.ts.
      const { data, error: invokeError } = await supabase.functions.invoke(
        "copilot-collaborator-tools",
        {
          body: {
            _tool: "delete_project",
            _source: "human_ui",
            project_id: project.id,
          },
        },
      );
      const error = invokeError || (data as any)?.error
        ? new Error((data as any)?.error || invokeError?.message || "Failed to delete project")
        : null;
      if (error) throw error;

      toast({ title: "Project deleted", description: "The project has been permanently deleted" });
      navigate("/desk");
    } catch (error: any) {
      toast({ title: "Error deleting project", description: error.message, variant: "destructive" });
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
  };

  // Always-on Studio essentials
  const coreTools = [
    { id: "vault", label: "The Vault", icon: FolderLock, hint: "Files & approvals", proOnly: false },
    { id: "notes", label: "The Pad", icon: StickyNote, hint: "Notes & scratch", proOnly: false },
  ];

  // Adaptive workflow tools per project type
  const wsType = project.workspace_type || "general";
  const adaptiveTools = (() => {
    if (wsType === "event_production" || wsType === "fashion_show") {
      return [
        { id: "call_sheet", label: "Call Sheet", icon: Clapperboard, hint: "Date, location, contacts", proOnly: false },
        { id: "run_of_show", label: "Run of Show", icon: ListChecks, hint: "Minute-by-minute timeline", proOnly: false },
        { id: "roll_call", label: "Roll Call", icon: UserCheck, hint: "Who's confirmed & arrived", proOnly: false },
      ];
    }
    if (wsType === "photo_shoot" || wsType === "video_shoot") {
      return [
        { id: "call_sheet", label: "Call Sheet", icon: Clapperboard, hint: "Shoot day details", proOnly: false },
        ...(wsType === "video_shoot" ? [{ id: "run_of_show", label: "Run of Show", icon: ListChecks, hint: "Scenes, setups & timing", proOnly: false }] : []),
        { id: "roll_call", label: "Roll Call", icon: UserCheck, hint: "Talent + crew check-in", proOnly: false },
        { id: "revisions", label: "Revisions", icon: History, hint: "Track edit rounds", proOnly: false },
      ];
    }
    if (wsType === "music_project") {
      return [
        { id: "split_sheet", label: "Split Sheet", icon: Music2, hint: "Songwriter splits", proOnly: false },
        { id: "revisions", label: "Revisions", icon: History, hint: "Mix/master rounds", proOnly: false },
      ];
    }
    // general fallback
    return [
      { id: "revisions", label: "Revisions", icon: History, hint: "Track change rounds", proOnly: false },
    ];
  })();

  const adaptiveLabel = wsType === "event_production" || wsType === "fashion_show"
    ? "Production Tools"
    : wsType === "music_project"
    ? "Music Tools"
    : wsType === "photo_shoot" || wsType === "video_shoot"
    ? "Production Tools"
    : "Workflow";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-[0.18em] text-[hsl(var(--energy))]">
            Studio Tools
          </DropdownMenuLabel>
          <DropdownMenuGroup>
            {coreTools.map((tab) => {
              const Icon = tab.icon;
              return (
                <DropdownMenuItem
                  key={tab.id}
                  onClick={() => onNavigateToTab(tab.id)}
                  className="gap-3 py-2"
                >
                  <Icon className="h-4 w-4 text-primary" />
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold">{tab.label}</span>
                    <span className="text-[10px] text-muted-foreground leading-none">{tab.hint}</span>
                  </div>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuGroup>

          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
            {adaptiveLabel}
          </DropdownMenuLabel>
          <DropdownMenuGroup>
            {adaptiveTools.map((tab) => {
              const Icon = tab.icon;
              return (
                <DropdownMenuItem
                  key={tab.id}
                  onClick={() => onNavigateToTab(tab.id)}
                  className="gap-3 py-2"
                >
                  <Icon className="h-4 w-4 text-primary" />
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold">{tab.label}</span>
                    <span className="text-[10px] text-muted-foreground leading-none">{tab.hint}</span>
                  </div>
                  {tab.proOnly && !isPro && (
                    <Crown className="h-3 w-3 text-amber-500 ml-auto" />
                  )}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuGroup>

          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Project</DropdownMenuLabel>

          {isOwner && (
            <DropdownMenuItem
              onClick={() => {
                setTitle(project.title);
                setDescription(project.description || "");
                setStatus(project.status || "planning");
                setSettingsOpen(true);
              }}
              className="gap-2"
            >
              <Settings className="h-4 w-4" />
              Settings
            </DropdownMenuItem>
          )}

          {isOwner && (
            <DropdownMenuItem
              onClick={() => setDeleteOpen(true)}
              className="gap-2 text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
              Delete Project
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Settings Dialog */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Project Settings</DialogTitle>
            <DialogDescription>Update your project details.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="project-title">Title</Label>
              <Input
                id="project-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Project title"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="project-description">Description</Label>
              <Textarea
                id="project-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description..."
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="project-status">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="planning">Planning</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 rounded-md border border-border p-3">
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={trackAsCredit}
                  onChange={(e) => setTrackAsCredit(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-primary"
                />
                <span className="text-sm">
                  <span className="font-medium">Track this as a credit</span>
                  <span className="block text-[11px] text-muted-foreground mt-0.5">
                    Turn on if this is shareable work — collaborators can be
                    tagged and it flows into Stamps. Leave off for private
                    planning.
                  </span>
                </span>
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSettingsOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveSettings} disabled={saving || !title.trim()}>
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete project?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{project.title}</strong> and all its messages, tasks, files, and data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteProject}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting..." : "Delete Permanently"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Project Credits on Completion */}
      <ProjectCreditsDialog
        open={creditsDialogOpen}
        onOpenChange={setCreditsDialogOpen}
        projectId={project.id}
        projectTitle={project.title}
        collaborators={collaborators}
        onCreditsAssigned={() => {
          // After credits assigned, show review prompt if there are collaborators
          if (collaborators.length > 1) {
            setTimeout(() => setReviewPromptOpen(true), 500);
          }
          onProjectUpdated();
        }}
      />

      {/* Review Prompt on Completion */}
      <ReviewPromptDialog
        open={reviewPromptOpen}
        onOpenChange={setReviewPromptOpen}
        projectId={project.id}
        projectTitle={project.title}
        collaborators={collaborators}
      />
    </>
  );
}
