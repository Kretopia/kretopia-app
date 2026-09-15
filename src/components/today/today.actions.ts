import { supabase } from "@/integrations/supabase/client";

/** Every mutation Today's components can trigger inline. Kept here, not
 *  duplicated per-component, so TodayCommandCenter/TodayMomentum/
 *  TodayOpportunities all call the same code for the same action. None of
 *  these are destructive, financial, or shared-state-changing beyond the
 *  caller's own rows -- money/invoice/collaborator-removal actions route
 *  to their existing dedicated approval flows elsewhere in the app rather
 *  than executing from here. */

export async function completeTask(taskId: string): Promise<void> {
  const { error } = await supabase.from("project_tasks").update({ status: "done" }).eq("id", taskId);
  if (error) throw error;
}

export async function snoozeTaskToTomorrow(taskId: string): Promise<void> {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const { error } = await supabase
    .from("project_tasks")
    .update({ due_date: tomorrow.toISOString().slice(0, 10) })
    .eq("id", taskId);
  if (error) throw error;
}

export async function acceptProposal(proposalId: string): Promise<void> {
  const { error } = await supabase
    .from("agent_proposals")
    .update({ status: "accepted", accepted_at: new Date().toISOString() })
    .eq("id", proposalId);
  if (error) throw error;
}

export async function dismissProposal(proposalId: string): Promise<void> {
  const { error } = await supabase.from("agent_proposals").update({ status: "dismissed" }).eq("id", proposalId);
  if (error) throw error;
}

export function openKretoChat() {
  window.dispatchEvent(new CustomEvent("thrive-copilot:open", { detail: {} }));
}

export function fillKretoPrompt(prompt: string, submit = true) {
  window.dispatchEvent(new CustomEvent("thrive-prompt:fill", { detail: { prompt, submit } }));
}
