import { useState } from "react";
import { notifyUser } from "@/lib/notifyUser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { Loader2, Sparkles, Rocket, Calendar, DollarSign, Crown } from "lucide-react";
import { trackEvent, EventCategory } from "@/lib/analytics";
import { z } from "zod";
import { useProjectLimit } from "@/hooks/useProjectLimit";

const projectSchema = z.object({
  title: z.string().trim().min(1, "Project name is required").max(100),
  description: z.string().trim().max(500).optional(),
  template: z.string().optional(),
});

interface ProjectTemplate {
  id: string;
  title: string;
  description: string;
  icon: string;
  suggestedBudget?: string;
  suggestedDuration?: string;
}

interface StartProjectFromMatchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  matchedUser: {
    id: string;
    name: string;
    role: string;
    avatar?: string | null;
  };
  matchId?: string; // Made optional for connected users without match
  currentUserRole?: string;
}

export function StartProjectFromMatchDialog({
  open,
  onOpenChange,
  matchedUser,
  matchId,
  currentUserRole
}: StartProjectFromMatchDialogProps) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { canCreateProject, limit, isPro } = useProjectLimit();
  const [creating, setCreating] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<ProjectTemplate | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
  });

  // Generate smart templates based on roles
  const generateTemplates = (): ProjectTemplate[] => {
    const templates: ProjectTemplate[] = [];
    const userRoleLower = currentUserRole?.toLowerCase() || "";
    const matchRoleLower = matchedUser.role?.toLowerCase() || "";

    // Music production templates
    if (
      (userRoleLower.includes("producer") || userRoleLower.includes("music")) &&
      (matchRoleLower.includes("vocal") || matchRoleLower.includes("singer") || matchRoleLower.includes("artist"))
    ) {
      templates.push({
        id: "single-collab",
        title: "Single Collaboration",
        description: `${currentUserRole} + ${matchedUser.role} collaboration`,
        icon: "",
        suggestedBudget: "$500-2000",
        suggestedDuration: "2-4 weeks"
      });
      templates.push({
        id: "ep-project",
        title: "EP Project",
        description: "3-5 track EP production",
        icon: "",
        suggestedBudget: "$2000-5000",
        suggestedDuration: "1-2 months"
      });
    }

    // Video production templates
    if (
      (userRoleLower.includes("film") || userRoleLower.includes("video") || userRoleLower.includes("director")) &&
      (matchRoleLower.includes("editor") || matchRoleLower.includes("cinemat"))
    ) {
      templates.push({
        id: "music-video",
        title: "Music Video Production",
        description: "Full music video from concept to final edit",
        icon: "",
        suggestedBudget: "$1000-5000",
        suggestedDuration: "3-6 weeks"
      });
      templates.push({
        id: "short-film",
        title: "Short Film",
        description: "5-15 minute narrative or documentary",
        icon: "",
        suggestedBudget: "$3000-10000",
        suggestedDuration: "2-3 months"
      });
    }

    // Design + Development
    if (
      (userRoleLower.includes("design") || userRoleLower.includes("ui")) &&
      (matchRoleLower.includes("develop") || matchRoleLower.includes("engineer"))
    ) {
      templates.push({
        id: "web-app",
        title: "Web App Development",
        description: "Design + build web application",
        icon: "",
        suggestedBudget: "$5000-15000",
        suggestedDuration: "1-3 months"
      });
      templates.push({
        id: "landing-page",
        title: "Landing Page",
        description: "High-converting marketing page",
        icon: "",
        suggestedBudget: "$1000-3000",
        suggestedDuration: "1-2 weeks"
      });
    }

    // Marketing + Content
    if (
      (userRoleLower.includes("market") || userRoleLower.includes("content")) &&
      (matchRoleLower.includes("photo") || matchRoleLower.includes("video"))
    ) {
      templates.push({
        id: "content-campaign",
        title: "Content Campaign",
        description: "Multi-platform content series",
        icon: "",
        suggestedBudget: "$2000-5000",
        suggestedDuration: "1 month"
      });
    }

    // Generic fallback templates
    if (templates.length === 0) {
      templates.push({
        id: "quick-collab",
        title: "Quick Collaboration",
        description: "Short-term project together",
        icon: "",
        suggestedDuration: "1-2 weeks"
      });
      templates.push({
        id: "ongoing-partnership",
        title: "Ongoing Partnership",
        description: "Long-term collaboration",
        icon: "",
        suggestedDuration: "3+ months"
      });
    }

    // Always add custom option
    templates.push({
      id: "custom",
      title: "Custom Project",
      description: "Define your own collaboration",
      icon: ""
    });

    return templates;
  };

  const templates = generateTemplates();

  const handleTemplateSelect = (template: ProjectTemplate) => {
    setSelectedTemplate(template);
    if (template.id !== "custom") {
      setFormData({
        title: template.title,
        description: template.description
      });
    }
  };

  const handleCreate = async () => {
    try {
      setCreating(true);

      if (!canCreateProject) {
        toast({
          title: "Monthly project limit reached",
          description: `Free accounts can create ${limit} project per month. Upgrade to Pro for unlimited.`,
          variant: "destructive",
        });
        navigate("/subscription");
        return;
      }

      const validationResult = projectSchema.safeParse(formData);
      if (!validationResult.success) {
        toast({
          title: "Invalid input",
          description: validationResult.error.issues[0].message,
          variant: "destructive",
        });
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Not authenticated",
          description: "Please sign in to create a project",
          variant: "destructive",
        });
        navigate('/auth');
        return;
      }

      // Track match-to-project funnel
      trackEvent({
        eventName: 'match_to_project_started',
        eventCategory: EventCategory.COLLABORATION,
        properties: {
          match_id: matchId,
          template_used: selectedTemplate?.id,
          collaborator_id: matchedUser.id
        }
      });

      // Create project linked to the match (if exists)
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .insert({
          title: validationResult.data.title,
          description: validationResult.data.description || null,
          created_by: user.id,
          status: 'active' as const,
          match_id: matchId || null, // Link to match if exists
        })
        .select()
        .single();

      if (projectError) throw projectError;

      const { error: engagementError } = await supabase.from('engagements').insert(
        matchId
          ? { project_id: project.id, mode: 'match', source_match_id: matchId, created_by: user.id }
          : { project_id: project.id, mode: 'direct', created_by: user.id }
      );
      if (engagementError) console.error('[StartProjectFromMatch] engagement insert failed', engagementError);

      // Get user profile for inviter name
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', user.id)
        .single();

      // Auto-invite the matched user as collaborator (linked by user_id, email optional)
      const { data: matchedUserEmail } = await supabase.rpc('get_user_email', { _user_id: matchedUser.id });

      const { error: inviteError } = await supabase
        .from('project_collaborators')
        .insert({
          project_id: project.id,
          user_id: matchedUser.id,
          email: matchedUserEmail || null,
          invited_by: user.id,
          role: 'member',
          status: 'pending',
        });

      if (!inviteError) {
        // Always send in-app notification regardless of email availability
        await notifyUser({
          userId: matchedUser.id,
          title: "New Project Invitation",
          message: `${userProfile?.full_name || 'Someone'} invited you to collaborate on ${validationResult.data.title}`,
          type: 'project_invite',
          category: 'collaboration',
          priority: 'high',
          link: `/desk/${project.id}`,
          actionUrl: `/desk/${project.id}`,
          actionText: 'Open Project',
        });

        // Send email notification if we have their email
        if (matchedUserEmail) {
          supabase.functions.invoke('send-project-invitation', {
            body: {
              email: matchedUserEmail,
              projectTitle: validationResult.data.title,
              projectId: project.id,
              inviterName: userProfile?.full_name || 'A Kretopia user',
              inviteeUserId: matchedUser.id,
            }
          }).catch(err => console.error('[StartProject] Invitation email failed:', err));
        }

        // Send email notification for project invite (fire-and-forget)
        supabase.functions.invoke('send-user-email', {
          body: {
            type: 'project_invite',
            recipientId: matchedUser.id,
            data: { projectTitle: validationResult.data.title, projectId: project.id }
          }
        }).catch(err => console.error('[StartProject] Email failed:', err));
      }

      // Track successful project creation from match
      trackEvent({
        eventName: 'match_to_project_completed',
        eventCategory: EventCategory.COLLABORATION,
        properties: {
          match_id: matchId,
          project_id: project.id,
          template_used: selectedTemplate?.id
        }
      });

      toast({
        title: "Project created!",
        description: `${matchedUser.name} has been invited to collaborate`,
      });

      onOpenChange(false);
      navigate(`/desk/${project.id}`);
    } catch (error: any) {
      console.error('Project creation error:', error);
      toast({
        title: "Failed to create project",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            <Rocket className="h-6 w-6 text-primary" />
            Start Project Together
          </DialogTitle>
          <DialogDescription>
            Create a project with your match and start collaborating
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Collaborator Info */}
          <div className="flex items-center gap-4 p-4 bg-gradient-to-br from-primary/5 to-secondary/5 rounded-xl border-2 border-primary/20">
            <Avatar className="h-14 w-14 ring-2 ring-primary/30">
              <AvatarImage src={matchedUser.avatar || undefined} />
              <AvatarFallback className="bg-gradient-to-br from-primary to-secondary text-primary-foreground text-lg font-bold">
                {matchedUser.name?.[0] || 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <p className="font-semibold text-lg">{matchedUser.name}</p>
              <Badge variant="secondary" className="mt-1">
                {matchedUser.role}
              </Badge>
            </div>
            <Sparkles className="h-8 w-8 text-primary animate-pulse" />
          </div>

          {/* Template Selection */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Choose a template</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {templates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => handleTemplateSelect(template)}
                  className={`p-4 border-2 rounded-xl text-left transition-all hover:shadow-lg ${
                    selectedTemplate?.id === template.id
                      ? 'border-primary bg-primary/5 shadow-glow'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-3xl">{template.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm mb-1">{template.title}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {template.description}
                      </p>
                      {template.suggestedDuration && (
                        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          <span>{template.suggestedDuration}</span>
                        </div>
                      )}
                      {template.suggestedBudget && (
                        <div className="flex items-center gap-2 mt-1 text-xs text-primary font-medium">
                          <DollarSign className="h-3 w-3" />
                          <span>{template.suggestedBudget}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Project Details */}
          {selectedTemplate && (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
              <div className="space-y-2">
                <Label htmlFor="title" className="text-base font-semibold">
                  Project Name *
                </Label>
                <Input
                  id="title"
                  placeholder="e.g., Epic Music Video Collab"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="h-12 text-base"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description" className="text-base font-semibold">
                  Description
                </Label>
                <Textarea
                  id="description"
                  placeholder="What will you create together?"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="text-base resize-none"
                />
              </div>

              <div className="p-4 bg-accent/50 rounded-lg border border-border">
                <p className="text-sm text-muted-foreground">
                  <strong>Tip:</strong> You can add budget, deadlines, milestones, and tasks after creating the project.
                </p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1 h-12"
              disabled={creating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!selectedTemplate || !formData.title.trim() || creating}
              className="flex-1 h-12 font-semibold gap-2"
              variant="gradient"
            >
              {creating ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Rocket className="h-5 w-5" />
                  Create Project
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
