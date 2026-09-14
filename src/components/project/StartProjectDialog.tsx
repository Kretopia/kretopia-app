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
import { Loader2, Sparkles, Rocket, Calendar, DollarSign } from "lucide-react";
import { trackEvent, EventCategory } from "@/lib/analytics";
import { z } from "zod";

const projectSchema = z.object({
  title: z.string().trim().min(1, "Project name is required").max(100),
  description: z.string().trim().max(500).optional(),
});

interface ProjectTemplate {
  id: string;
  title: string;
  description: string;
  icon: string;
  suggestedBudget?: string;
  suggestedDuration?: string;
}

interface StartProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collaborator: {
    id: string;
    name: string;
    role: string;
    avatar?: string | null;
  };
  currentUserRole?: string;
}

export function StartProjectDialog({
  open,
  onOpenChange,
  collaborator,
  currentUserRole
}: StartProjectDialogProps) {
  const { toast } = useToast();
  const navigate = useNavigate();
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
    const collabRoleLower = collaborator.role?.toLowerCase() || "";

    // Music production templates
    if (
      (userRoleLower.includes("producer") || userRoleLower.includes("music")) &&
      (collabRoleLower.includes("vocal") || collabRoleLower.includes("singer") || collabRoleLower.includes("artist"))
    ) {
      templates.push({
        id: "single-collab",
        title: "Single Collaboration",
        description: `${currentUserRole} + ${collaborator.role} collaboration`,
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
      (collabRoleLower.includes("editor") || collabRoleLower.includes("cinemat"))
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
      (collabRoleLower.includes("develop") || collabRoleLower.includes("engineer"))
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
      (collabRoleLower.includes("photo") || collabRoleLower.includes("video"))
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

      // Track project start
      trackEvent({
        eventName: 'project_started_from_profile',
        eventCategory: EventCategory.COLLABORATION,
        properties: {
          collaborator_id: collaborator.id,
          template_used: selectedTemplate?.id
        }
      });

      // Create project
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .insert({
          title: validationResult.data.title,
          description: validationResult.data.description || null,
          created_by: user.id,
          status: 'active' as const,
        })
        .select()
        .single();

      if (projectError) throw projectError;

      const { error: engagementError } = await supabase.from('engagements').insert({
        project_id: project.id,
        mode: 'direct',
        created_by: user.id,
      });
      if (engagementError) console.error('[StartProjectDialog] engagement insert failed', engagementError);

      // Get user profile for inviter name
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', user.id)
        .single();

      // Add collaborator to project then auto-accept (since they're matched/connected)
      const { data: collabData, error: collabError } = await supabase
        .from('project_collaborators')
        .insert({
          project_id: project.id,
          user_id: collaborator.id,
          email: `user-${collaborator.id}@platform.internal`,
          invited_by: user.id,
          role: 'member',
        })
        .select('id')
        .single();

      if (collabError) {
        console.error('Error adding collaborator:', collabError);
      } else {
        // Update status to accepted (default is 'pending', explicit update ensures it sticks)
        const { error: acceptError } = await supabase
          .from('project_collaborators')
          .update({ status: 'accepted' })
          .eq('id', collabData.id);

        if (acceptError) {
          console.error('Error auto-accepting collaborator:', acceptError);
        }
      }

      // Create in-app notification for the collaborator
      await notifyUser({
        userId: collaborator.id,
        title: "New Project Created",
        message: `${userProfile?.full_name || 'Someone'} started a project with you: ${validationResult.data.title}`,
        type: 'project_invite',
        category: 'collaboration',
        priority: 'high',
        link: `/desk/${project.id}`,
        actionUrl: `/desk/${project.id}`,
        actionText: 'Open Project',
      });

      // Try to send email notification
      try {
        await supabase.functions.invoke('send-project-invitation', {
          body: {
            projectTitle: validationResult.data.title,
            projectId: project.id,
            inviterName: userProfile?.full_name || 'A Kretopia creator',
            inviteeUserId: collaborator.id,
          }
        });
      } catch (emailError) {
        console.error('Email notification failed:', emailError);
        // Continue anyway - in-app notification is sent
      }

      toast({
        title: "Project created!",
        description: `${collaborator.name} has been added as a collaborator`,
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
            Create a workspace to collaborate with {collaborator.name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Collaborator Info */}
          <div className="flex items-center gap-4 p-4 bg-gradient-to-br from-primary/5 to-secondary/5 rounded-xl border-2 border-primary/20">
            <Avatar className="h-14 w-14 ring-2 ring-primary/30">
              <AvatarImage src={collaborator.avatar || undefined} />
              <AvatarFallback className="bg-gradient-to-br from-primary to-secondary text-primary-foreground text-lg font-bold">
                {collaborator.name?.[0] || 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <p className="font-semibold text-lg">{collaborator.name}</p>
              <Badge variant="secondary" className="mt-1">
                {collaborator.role}
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
                  <strong>Tip:</strong> You can add tasks, files, and chat with your collaborator once inside the project.
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