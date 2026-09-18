import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { VoiceFirstCreateModal } from "@/components/project/studio/VoiceFirstCreateModal";
import { DeskCommandPalette } from "@/components/desk/DeskCommandPalette";
import { VoiceCommandSheet } from "@/components/desk/VoiceCommandSheet";
import { WrapMyWeekSheet } from "@/components/desk/WrapMyWeekSheet";

interface UseStudioGlobalModalsOptions {
  /** Runs after VoiceFirstCreateModal's onCreated, once the modal itself
   *  has already closed -- e.g. CreatorWorkHome refetches its project
   *  list here; BrandWorkHome has nothing to refetch and omits it. */
  onProjectCreated?: () => void;
}

/**
 * The four global overlays every Studio-home dashboard variant wires up
 * identically (voice-first project creation, the command palette, the
 * voice command sheet, and Wrap My Week) -- previously four separate
 * useState calls and four near-identical JSX blocks duplicated between
 * BrandWorkHome and CreatorWorkHome, so a fifth global overlay or a
 * change to how any of these four open would have meant editing both
 * dashboards in lockstep. One hook now owns the state and renders them
 * together; each dashboard just renders `{modals}` once and calls the
 * open* actions from wherever it needs to (a hero CTA, the command
 * palette's own voice-create entry, etc).
 */
export function useStudioGlobalModals({ onProjectCreated }: UseStudioGlobalModalsOptions = {}) {
  const navigate = useNavigate();
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [voiceCmdOpen, setVoiceCmdOpen] = useState(false);
  const [wrapWeekOpen, setWrapWeekOpen] = useState(false);

  const modals = (
    <>
      <VoiceFirstCreateModal
        open={showCreateProject}
        onOpenChange={setShowCreateProject}
        onExpand={() => { setShowCreateProject(false); navigate("/desk/new-room"); }}
        onCreated={() => {
          setShowCreateProject(false);
          onProjectCreated?.();
        }}
      />
      <DeskCommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        onVoiceCreate={() => setShowCreateProject(true)}
        onVoiceCommand={() => setVoiceCmdOpen(true)}
      />
      <VoiceCommandSheet open={voiceCmdOpen} onOpenChange={setVoiceCmdOpen} />
      <WrapMyWeekSheet open={wrapWeekOpen} onOpenChange={setWrapWeekOpen} />
    </>
  );

  return {
    modals,
    openCreateProject: () => setShowCreateProject(true),
    openPalette: () => setPaletteOpen(true),
    openVoiceCommand: () => setVoiceCmdOpen(true),
    openWrapWeek: () => setWrapWeekOpen(true),
  };
}
