// Every public.projects column except client_price/creative_payout/
// margin_type/margin_value -- those four are permanently locked down
// (20260825100000_studio_role_based_money_rls.sql) and never carry a
// column-level SELECT grant for `authenticated`. Unlike an RLS policy, a
// missing column GRANT doesn't "silently omit" that field from a wildcard
// select -- it fails the *entire* query with 42501 ("permission denied for
// table projects"), for every caller, owner or not. get_project_financials()
// is the actual, intentional RPC path to the locked fields for an
// authorized caller -- see its use in useProjectData.ts.
// A single literal (no string concatenation) so TS can keep it as a literal
// type via `as const` -- supabase-js's .select() overload needs the exact
// literal type to infer a real row shape; a plain `string` variable falls
// back to an untyped GenericStringError result.
export const PROJECT_COLUMNS_EXCLUDING_LOCKED_FINANCIALS =
  "agent_mode, agent_user_id, budget, client_id, client_name, client_user_id, cover_url, created_at, created_by, creative_user_ids, currency, deadline, deal_type, description, event_id, id, match_id, mood, pinned_stage, recap_published, recap_summary, recap_token, setup_completed, spark_room_id, status, studio_folder_id, title, track_as_credit, updated_at, video_room_started_at, video_room_started_by, video_room_url, workspace_type" as const;
