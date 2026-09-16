import type { StudioProject } from "./studioCardHelpers";

export interface StudioFolder {
  id: string;
  name: string;
  color: string | null;
  sort_order: number;
}

export type PayState = "paid" | "invoiced" | "unsent";

/** Real, already-loaded signals a project row can carry. Every field here
 *  is either a genuine `projects` column or derived from data this page
 *  already fetches (invoices) -- nothing invented. See
 *  studioHome.selectors.ts's own doc comment for what's deliberately NOT
 *  included (unread activity, due tasks) and why. */
export interface StudioProjectSignals {
  needsInvoice: boolean;
  awaitingPayment: boolean;
  isActive: boolean;
}

export type { StudioProject };
