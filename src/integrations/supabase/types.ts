export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      account_merge_requests: {
        Row: {
          attempts: number
          completed_at: string | null
          created_at: string
          error: string | null
          expires_at: string
          face_match_score: number | null
          id: string
          initiator_user_id: string
          source_email: string
          source_otp_hash: string
          source_user_id: string
          source_verified_at: string | null
          status: string
          target_email: string
          target_otp_hash: string
          target_user_id: string
          target_verified_at: string | null
        }
        Insert: {
          attempts?: number
          completed_at?: string | null
          created_at?: string
          error?: string | null
          expires_at?: string
          face_match_score?: number | null
          id?: string
          initiator_user_id: string
          source_email: string
          source_otp_hash: string
          source_user_id: string
          source_verified_at?: string | null
          status?: string
          target_email: string
          target_otp_hash: string
          target_user_id: string
          target_verified_at?: string | null
        }
        Update: {
          attempts?: number
          completed_at?: string | null
          created_at?: string
          error?: string | null
          expires_at?: string
          face_match_score?: number | null
          id?: string
          initiator_user_id?: string
          source_email?: string
          source_otp_hash?: string
          source_user_id?: string
          source_verified_at?: string | null
          status?: string
          target_email?: string
          target_otp_hash?: string
          target_user_id?: string
          target_verified_at?: string | null
        }
        Relationships: []
      }
      agent_actions: {
        Row: {
          action_type: string
          created_at: string
          description: string | null
          error_message: string | null
          executed_at: string | null
          goal_id: string | null
          id: string
          payload: Json
          result: Json | null
          risk_level: string
          scheduled_for: string | null
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          action_type: string
          created_at?: string
          description?: string | null
          error_message?: string | null
          executed_at?: string | null
          goal_id?: string | null
          id?: string
          payload?: Json
          result?: Json | null
          risk_level?: string
          scheduled_for?: string | null
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          action_type?: string
          created_at?: string
          description?: string | null
          error_message?: string | null
          executed_at?: string | null
          goal_id?: string | null
          id?: string
          payload?: Json
          result?: Json | null
          risk_level?: string
          scheduled_for?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_actions_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "agent_goals"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_goals: {
        Row: {
          completed_at: string | null
          created_at: string
          current_value: number
          deadline: string | null
          description: string | null
          goal_type: string
          id: string
          priority: string
          status: string
          target_value: number
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          current_value?: number
          deadline?: string | null
          description?: string | null
          goal_type: string
          id?: string
          priority?: string
          status?: string
          target_value?: number
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          current_value?: number
          deadline?: string | null
          description?: string | null
          goal_type?: string
          id?: string
          priority?: string
          status?: string
          target_value?: number
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      agent_project_context: {
        Row: {
          content: string
          created_at: string
          id: string
          intent: string | null
          project_id: string
          role: string
          tool_calls: Json | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          intent?: string | null
          project_id: string
          role: string
          tool_calls?: Json | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          intent?: string | null
          project_id?: string
          role?: string
          tool_calls?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_project_context_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_proposals: {
        Row: {
          accepted_at: string | null
          action_intent: Json
          body: string
          created_at: string
          dismissed_reason: string | null
          expires_at: string | null
          id: string
          kind: Database["public"]["Enums"]["agent_proposal_kind"]
          owner_user_id: string
          project_id: string | null
          source_signal: Json | null
          status: Database["public"]["Enums"]["agent_proposal_status"]
          surface: string
          title: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          action_intent?: Json
          body: string
          created_at?: string
          dismissed_reason?: string | null
          expires_at?: string | null
          id?: string
          kind: Database["public"]["Enums"]["agent_proposal_kind"]
          owner_user_id: string
          project_id?: string | null
          source_signal?: Json | null
          status?: Database["public"]["Enums"]["agent_proposal_status"]
          surface?: string
          title: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          action_intent?: Json
          body?: string
          created_at?: string
          dismissed_reason?: string | null
          expires_at?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["agent_proposal_kind"]
          owner_user_id?: string
          project_id?: string | null
          source_signal?: Json | null
          status?: Database["public"]["Enums"]["agent_proposal_status"]
          surface?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_proposals_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_runs: {
        Row: {
          agent_kind: string
          created_at: string
          duration_ms: number | null
          id: string
          input_summary: string | null
          output_summary: string | null
          project_id: string | null
          status: string
          trigger: string
          user_id: string | null
        }
        Insert: {
          agent_kind: string
          created_at?: string
          duration_ms?: number | null
          id?: string
          input_summary?: string | null
          output_summary?: string | null
          project_id?: string | null
          status?: string
          trigger: string
          user_id?: string | null
        }
        Update: {
          agent_kind?: string
          created_at?: string
          duration_ms?: number | null
          id?: string
          input_summary?: string | null
          output_summary?: string | null
          project_id?: string | null
          status?: string
          trigger?: string
          user_id?: string | null
        }
        Relationships: []
      }
      agent_settings: {
        Row: {
          auto_approve_low_risk: boolean
          created_at: string
          daily_action_limit: number
          document_generation: boolean
          email_automation: boolean
          focus_areas: Json
          id: string
          is_active: boolean
          mode: string
          task_automation: boolean
          timezone: string | null
          updated_at: string
          user_id: string
          working_hours_end: number | null
          working_hours_start: number | null
        }
        Insert: {
          auto_approve_low_risk?: boolean
          created_at?: string
          daily_action_limit?: number
          document_generation?: boolean
          email_automation?: boolean
          focus_areas?: Json
          id?: string
          is_active?: boolean
          mode?: string
          task_automation?: boolean
          timezone?: string | null
          updated_at?: string
          user_id: string
          working_hours_end?: number | null
          working_hours_start?: number | null
        }
        Update: {
          auto_approve_low_risk?: boolean
          created_at?: string
          daily_action_limit?: number
          document_generation?: boolean
          email_automation?: boolean
          focus_areas?: Json
          id?: string
          is_active?: boolean
          mode?: string
          task_automation?: boolean
          timezone?: string | null
          updated_at?: string
          user_id?: string
          working_hours_end?: number | null
          working_hours_start?: number | null
        }
        Relationships: []
      }
      ai_conversations: {
        Row: {
          archived_at: string | null
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      ambassador_applications: {
        Row: {
          audience_size: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          niche: string | null
          pitch: string
          primary_platform: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          social_links: Json | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          audience_size?: string | null
          created_at?: string
          email: string
          full_name: string
          id?: string
          niche?: string | null
          pitch: string
          primary_platform?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          social_links?: Json | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          audience_size?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          niche?: string | null
          pitch?: string
          primary_platform?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          social_links?: Json | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      analytics_events: {
        Row: {
          created_at: string | null
          event_category: string
          event_name: string
          event_properties: Json | null
          id: string
          ip_address: string | null
          page_path: string | null
          referrer: string | null
          session_id: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          event_category: string
          event_name: string
          event_properties?: Json | null
          id?: string
          ip_address?: string | null
          page_path?: string | null
          referrer?: string | null
          session_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          event_category?: string
          event_name?: string
          event_properties?: Json | null
          id?: string
          ip_address?: string | null
          page_path?: string | null
          referrer?: string | null
          session_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      applications: {
        Row: {
          applicant_id: string
          application_notes: string | null
          availability: string | null
          comp_card_snapshot: Json | null
          cover_letter: string | null
          created_at: string | null
          expected_rate: string | null
          id: string
          opportunity_id: string
          portfolio_links: string[] | null
          status: string | null
          studio_project_id: string | null
          updated_at: string | null
        }
        Insert: {
          applicant_id: string
          application_notes?: string | null
          availability?: string | null
          comp_card_snapshot?: Json | null
          cover_letter?: string | null
          created_at?: string | null
          expected_rate?: string | null
          id?: string
          opportunity_id: string
          portfolio_links?: string[] | null
          status?: string | null
          studio_project_id?: string | null
          updated_at?: string | null
        }
        Update: {
          applicant_id?: string
          application_notes?: string | null
          availability?: string | null
          comp_card_snapshot?: Json | null
          cover_letter?: string | null
          created_at?: string | null
          expected_rate?: string | null
          id?: string
          opportunity_id?: string
          portfolio_links?: string[] | null
          status?: string | null
          studio_project_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "applications_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_studio_project_id_fkey"
            columns: ["studio_project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_folders: {
        Row: {
          color: string | null
          created_at: string
          created_by: string
          id: string
          name: string
          parent_id: string | null
          project_id: string
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          created_by: string
          id?: string
          name: string
          parent_id?: string | null
          project_id: string
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          parent_id?: string | null
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_folders_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "asset_folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_folders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_versions: {
        Row: {
          asset_id: string
          change_note: string | null
          created_at: string
          file_size: number | null
          file_url: string
          id: string
          uploaded_by: string
          version: number
        }
        Insert: {
          asset_id: string
          change_note?: string | null
          created_at?: string
          file_size?: number | null
          file_url: string
          id?: string
          uploaded_by: string
          version: number
        }
        Update: {
          asset_id?: string
          change_note?: string | null
          created_at?: string
          file_size?: number | null
          file_url?: string
          id?: string
          uploaded_by?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "asset_versions_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "creative_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      award_comments: {
        Row: {
          award_id: string
          content: string
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          award_id: string
          content: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          award_id?: string
          content?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "award_comments_award_id_fkey"
            columns: ["award_id"]
            isOneToOne: false
            referencedRelation: "awards"
            referencedColumns: ["id"]
          },
        ]
      }
      awards: {
        Row: {
          category: string | null
          certificate_url: string | null
          created_at: string
          description: string | null
          display_order: number | null
          id: string
          image_url: string | null
          is_featured: boolean | null
          organization: string
          title: string
          updated_at: string
          user_id: string
          verification_status: string | null
          verification_url: string | null
          year: number | null
        }
        Insert: {
          category?: string | null
          certificate_url?: string | null
          created_at?: string
          description?: string | null
          display_order?: number | null
          id?: string
          image_url?: string | null
          is_featured?: boolean | null
          organization: string
          title: string
          updated_at?: string
          user_id: string
          verification_status?: string | null
          verification_url?: string | null
          year?: number | null
        }
        Update: {
          category?: string | null
          certificate_url?: string | null
          created_at?: string
          description?: string | null
          display_order?: number | null
          id?: string
          image_url?: string | null
          is_featured?: boolean | null
          organization?: string
          title?: string
          updated_at?: string
          user_id?: string
          verification_status?: string | null
          verification_url?: string | null
          year?: number | null
        }
        Relationships: []
      }
      board_items: {
        Row: {
          color: string | null
          content: string | null
          created_at: string
          created_by: string
          height: number | null
          id: string
          image_url: string | null
          position_x: number | null
          position_y: number | null
          project_id: string
          tags: string[] | null
          title: string | null
          type: string
          updated_at: string
          width: number | null
        }
        Insert: {
          color?: string | null
          content?: string | null
          created_at?: string
          created_by: string
          height?: number | null
          id?: string
          image_url?: string | null
          position_x?: number | null
          position_y?: number | null
          project_id: string
          tags?: string[] | null
          title?: string | null
          type?: string
          updated_at?: string
          width?: number | null
        }
        Update: {
          color?: string | null
          content?: string | null
          created_at?: string
          created_by?: string
          height?: number | null
          id?: string
          image_url?: string | null
          position_x?: number | null
          position_y?: number | null
          project_id?: string
          tags?: string[] | null
          title?: string | null
          type?: string
          updated_at?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "board_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_vaults: {
        Row: {
          attrs: Json
          created_at: string
          do_dont: Json
          fonts: Json
          id: string
          is_default: boolean
          links: Json
          logo_dark_url: string | null
          logo_url: string | null
          name: string
          palette: Json
          project_id: string | null
          tagline: string | null
          updated_at: string
          user_id: string
          voice_tone: string | null
        }
        Insert: {
          attrs?: Json
          created_at?: string
          do_dont?: Json
          fonts?: Json
          id?: string
          is_default?: boolean
          links?: Json
          logo_dark_url?: string | null
          logo_url?: string | null
          name: string
          palette?: Json
          project_id?: string | null
          tagline?: string | null
          updated_at?: string
          user_id: string
          voice_tone?: string | null
        }
        Update: {
          attrs?: Json
          created_at?: string
          do_dont?: Json
          fonts?: Json
          id?: string
          is_default?: boolean
          links?: Json
          logo_dark_url?: string | null
          logo_url?: string | null
          name?: string
          palette?: Json
          project_id?: string | null
          tagline?: string | null
          updated_at?: string
          user_id?: string
          voice_tone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brand_vaults_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      bulk_email_usage: {
        Row: {
          id: string
          month: string
          send_count: number
          user_id: string
        }
        Insert: {
          id?: string
          month: string
          send_count?: number
          user_id: string
        }
        Update: {
          id?: string
          month?: string
          send_count?: number
          user_id?: string
        }
        Relationships: []
      }
      call_action_items: {
        Row: {
          assignee_name: string | null
          assignee_user_id: string | null
          created_at: string
          detail: string | null
          due_at: string | null
          id: string
          kind: string
          pushed_to_id: string | null
          pushed_to_kind: string | null
          status: string
          title: string
          transcript_id: string
          updated_at: string
        }
        Insert: {
          assignee_name?: string | null
          assignee_user_id?: string | null
          created_at?: string
          detail?: string | null
          due_at?: string | null
          id?: string
          kind: string
          pushed_to_id?: string | null
          pushed_to_kind?: string | null
          status?: string
          title: string
          transcript_id: string
          updated_at?: string
        }
        Update: {
          assignee_name?: string | null
          assignee_user_id?: string | null
          created_at?: string
          detail?: string | null
          due_at?: string | null
          id?: string
          kind?: string
          pushed_to_id?: string | null
          pushed_to_kind?: string | null
          status?: string
          title?: string
          transcript_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_action_items_transcript_id_fkey"
            columns: ["transcript_id"]
            isOneToOne: false
            referencedRelation: "call_transcripts"
            referencedColumns: ["id"]
          },
        ]
      }
      call_transcripts: {
        Row: {
          call_id: string
          call_kind: string
          chapters: Json
          circle_id: string | null
          co_sign_suggestions: Json
          created_at: string
          created_by: string
          duration_seconds: number | null
          error: string | null
          highlights: Json
          id: string
          language: string | null
          live_captions: Json
          participants: Json
          project_id: string | null
          recording_deleted_at: string | null
          recording_id: string | null
          recording_url: string | null
          status: string
          summary: string | null
          transcript: string | null
          updated_at: string
        }
        Insert: {
          call_id: string
          call_kind: string
          chapters?: Json
          circle_id?: string | null
          co_sign_suggestions?: Json
          created_at?: string
          created_by: string
          duration_seconds?: number | null
          error?: string | null
          highlights?: Json
          id?: string
          language?: string | null
          live_captions?: Json
          participants?: Json
          project_id?: string | null
          recording_deleted_at?: string | null
          recording_id?: string | null
          recording_url?: string | null
          status?: string
          summary?: string | null
          transcript?: string | null
          updated_at?: string
        }
        Update: {
          call_id?: string
          call_kind?: string
          chapters?: Json
          circle_id?: string | null
          co_sign_suggestions?: Json
          created_at?: string
          created_by?: string
          duration_seconds?: number | null
          error?: string | null
          highlights?: Json
          id?: string
          language?: string | null
          live_captions?: Json
          participants?: Json
          project_id?: string | null
          recording_deleted_at?: string | null
          recording_id?: string | null
          recording_url?: string | null
          status?: string
          summary?: string | null
          transcript?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      campaign_approvals: {
        Row: {
          asset_id: string | null
          asset_url: string | null
          created_at: string
          created_by: string
          decided_at: string | null
          feedback: string | null
          id: string
          project_id: string
          reviewer_id: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          asset_id?: string | null
          asset_url?: string | null
          created_at?: string
          created_by: string
          decided_at?: string | null
          feedback?: string | null
          id?: string
          project_id: string
          reviewer_id?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          asset_id?: string | null
          asset_url?: string | null
          created_at?: string
          created_by?: string
          decided_at?: string | null
          feedback?: string | null
          id?: string
          project_id?: string
          reviewer_id?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_approvals_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "campaign_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_approvals_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_assets: {
        Row: {
          asset_url: string | null
          channel: string
          created_at: string
          created_by: string
          deliverable: string
          due_date: string | null
          format: string | null
          id: string
          notes: string | null
          order_index: number
          owner_id: string | null
          platform: string | null
          project_id: string
          status: string
          updated_at: string
        }
        Insert: {
          asset_url?: string | null
          channel?: string
          created_at?: string
          created_by: string
          deliverable: string
          due_date?: string | null
          format?: string | null
          id?: string
          notes?: string | null
          order_index?: number
          owner_id?: string | null
          platform?: string | null
          project_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          asset_url?: string | null
          channel?: string
          created_at?: string
          created_by?: string
          deliverable?: string
          due_date?: string | null
          format?: string | null
          id?: string
          notes?: string | null
          order_index?: number
          owner_id?: string | null
          platform?: string | null
          project_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_assets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_briefs: {
        Row: {
          audience: string | null
          brand_name: string | null
          budget: number | null
          created_at: string
          created_by: string
          currency: string | null
          end_date: string | null
          guidelines: string | null
          id: string
          is_current: boolean
          key_messages: string[]
          kpis: string[]
          objective: string | null
          project_id: string
          start_date: string | null
          tone: string | null
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          audience?: string | null
          brand_name?: string | null
          budget?: number | null
          created_at?: string
          created_by: string
          currency?: string | null
          end_date?: string | null
          guidelines?: string | null
          id?: string
          is_current?: boolean
          key_messages?: string[]
          kpis?: string[]
          objective?: string | null
          project_id: string
          start_date?: string | null
          tone?: string | null
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          audience?: string | null
          brand_name?: string | null
          budget?: number | null
          created_at?: string
          created_by?: string
          currency?: string | null
          end_date?: string | null
          guidelines?: string | null
          id?: string
          is_current?: boolean
          key_messages?: string[]
          kpis?: string[]
          objective?: string | null
          project_id?: string
          start_date?: string | null
          tone?: string | null
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "campaign_briefs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_moderation_queue: {
        Row: {
          ai_reason: string | null
          ai_summary: string | null
          campaign_id: string
          created_at: string
          id: string
          reviewed_at: string | null
          reviewer_id: string | null
          reviewer_notes: string | null
          risk_categories: string[] | null
          risk_score: number
          status: string
          updated_at: string
        }
        Insert: {
          ai_reason?: string | null
          ai_summary?: string | null
          campaign_id: string
          created_at?: string
          id?: string
          reviewed_at?: string | null
          reviewer_id?: string | null
          reviewer_notes?: string | null
          risk_categories?: string[] | null
          risk_score?: number
          status?: string
          updated_at?: string
        }
        Update: {
          ai_reason?: string | null
          ai_summary?: string | null
          campaign_id?: string
          created_at?: string
          id?: string
          reviewed_at?: string | null
          reviewer_id?: string | null
          reviewer_notes?: string | null
          risk_categories?: string[] | null
          risk_score?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_moderation_queue_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_recipients: {
        Row: {
          campaign_id: string
          clicked_at: string | null
          email: string
          error_message: string | null
          id: string
          name: string | null
          opened_at: string | null
          sent_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          campaign_id: string
          clicked_at?: string | null
          email: string
          error_message?: string | null
          id?: string
          name?: string | null
          opened_at?: string | null
          sent_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          campaign_id?: string
          clicked_at?: string | null
          email?: string
          error_message?: string | null
          id?: string
          name?: string | null
          opened_at?: string | null
          sent_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_recipients_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "email_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_updates: {
        Row: {
          author_id: string
          backers_only: boolean
          campaign_id: string
          content: string
          created_at: string
          id: string
          media_urls: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          author_id: string
          backers_only?: boolean
          campaign_id: string
          content: string
          created_at?: string
          id?: string
          media_urls?: string[] | null
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          backers_only?: boolean
          campaign_id?: string
          content?: string
          created_at?: string
          id?: string
          media_urls?: string[] | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_updates_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          backer_count: number
          category: string | null
          cover_image_url: string | null
          created_at: string
          creator_id: string
          currency: string
          deadline: string
          ended_at: string | null
          funding_model: string
          goal_amount: number
          id: string
          launched_at: string | null
          milestone_split: Json
          moderated_by: string | null
          moderation_categories: string[] | null
          moderation_reason: string | null
          moderation_reviewed_at: string | null
          moderation_score: number | null
          moderation_status: string
          platform_fee_pct: number
          project_id: string | null
          slug: string
          status: string
          story: string | null
          stripe_account_id: string | null
          tagline: string | null
          title: string
          total_raised: number
          updated_at: string
          video_url: string | null
        }
        Insert: {
          backer_count?: number
          category?: string | null
          cover_image_url?: string | null
          created_at?: string
          creator_id: string
          currency?: string
          deadline: string
          ended_at?: string | null
          funding_model?: string
          goal_amount: number
          id?: string
          launched_at?: string | null
          milestone_split?: Json
          moderated_by?: string | null
          moderation_categories?: string[] | null
          moderation_reason?: string | null
          moderation_reviewed_at?: string | null
          moderation_score?: number | null
          moderation_status?: string
          platform_fee_pct?: number
          project_id?: string | null
          slug: string
          status?: string
          story?: string | null
          stripe_account_id?: string | null
          tagline?: string | null
          title: string
          total_raised?: number
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          backer_count?: number
          category?: string | null
          cover_image_url?: string | null
          created_at?: string
          creator_id?: string
          currency?: string
          deadline?: string
          ended_at?: string | null
          funding_model?: string
          goal_amount?: number
          id?: string
          launched_at?: string | null
          milestone_split?: Json
          moderated_by?: string | null
          moderation_categories?: string[] | null
          moderation_reason?: string | null
          moderation_reviewed_at?: string | null
          moderation_score?: number | null
          moderation_status?: string
          platform_fee_pct?: number
          project_id?: string | null
          slug?: string
          status?: string
          story?: string | null
          stripe_account_id?: string | null
          tagline?: string | null
          title?: string
          total_raised?: number
          updated_at?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      category_suggestions: {
        Row: {
          created_at: string
          description: string | null
          id: string
          location_type: string
          reviewed_at: string | null
          status: string
          suggested_name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          location_type: string
          reviewed_at?: string | null
          status?: string
          suggested_name: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          location_type?: string
          reviewed_at?: string | null
          status?: string
          suggested_name?: string
          user_id?: string
        }
        Relationships: []
      }
      challenge_entries: {
        Row: {
          challenge_id: string
          created_at: string
          description: string | null
          id: string
          media_type: string | null
          media_url: string | null
          rank: number | null
          title: string | null
          user_id: string
          vote_count: number
        }
        Insert: {
          challenge_id: string
          created_at?: string
          description?: string | null
          id?: string
          media_type?: string | null
          media_url?: string | null
          rank?: number | null
          title?: string | null
          user_id: string
          vote_count?: number
        }
        Update: {
          challenge_id?: string
          created_at?: string
          description?: string | null
          id?: string
          media_type?: string | null
          media_url?: string | null
          rank?: number | null
          title?: string | null
          user_id?: string
          vote_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "challenge_entries_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      challenge_leaderboard: {
        Row: {
          current_streak: number
          id: string
          total_challenge_xp: number
          total_votes_received: number
          total_wins: number
          updated_at: string
          user_id: string
        }
        Insert: {
          current_streak?: number
          id?: string
          total_challenge_xp?: number
          total_votes_received?: number
          total_wins?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          current_streak?: number
          id?: string
          total_challenge_xp?: number
          total_votes_received?: number
          total_wins?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      challenge_votes: {
        Row: {
          created_at: string
          entry_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          entry_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          entry_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenge_votes_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "challenge_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      challenges: {
        Row: {
          cadence: string
          category: string
          cover_image_url: string | null
          created_at: string
          created_by: string
          description: string | null
          ends_at: string
          entry_count: number
          id: string
          starts_at: string
          status: string
          title: string
          updated_at: string
          xp_reward: number
        }
        Insert: {
          cadence?: string
          category?: string
          cover_image_url?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          ends_at: string
          entry_count?: number
          id?: string
          starts_at?: string
          status?: string
          title: string
          updated_at?: string
          xp_reward?: number
        }
        Update: {
          cadence?: string
          category?: string
          cover_image_url?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          ends_at?: string
          entry_count?: number
          id?: string
          starts_at?: string
          status?: string
          title?: string
          updated_at?: string
          xp_reward?: number
        }
        Relationships: []
      }
      circle_channels: {
        Row: {
          channel_type: string
          circle_id: string
          created_at: string | null
          created_by: string
          description: string | null
          icon_emoji: string | null
          id: string
          is_default: boolean | null
          name: string
          position: number | null
          updated_at: string | null
        }
        Insert: {
          channel_type?: string
          circle_id: string
          created_at?: string | null
          created_by: string
          description?: string | null
          icon_emoji?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          position?: number | null
          updated_at?: string | null
        }
        Update: {
          channel_type?: string
          circle_id?: string
          created_at?: string | null
          created_by?: string
          description?: string | null
          icon_emoji?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          position?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "circle_channels_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "spark_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      circle_guest_rsvps: {
        Row: {
          circle_id: string
          confirm_token: string
          confirmed_at: string | null
          created_at: string
          email: string
          event_id: string
          full_name: string | null
          id: string
          status: string
          token_expires_at: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          circle_id: string
          confirm_token?: string
          confirmed_at?: string | null
          created_at?: string
          email: string
          event_id: string
          full_name?: string | null
          id?: string
          status?: string
          token_expires_at?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          circle_id?: string
          confirm_token?: string
          confirmed_at?: string | null
          created_at?: string
          email?: string
          event_id?: string
          full_name?: string | null
          id?: string
          status?: string
          token_expires_at?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "circle_guest_rsvps_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "spark_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "circle_guest_rsvps_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "creative_jams"
            referencedColumns: ["id"]
          },
        ]
      }
      circle_subscriptions: {
        Row: {
          amount: number | null
          circle_id: string
          created_at: string | null
          currency: string | null
          expires_at: string | null
          id: string
          started_at: string | null
          status: string | null
          stripe_subscription_id: string | null
          user_id: string
        }
        Insert: {
          amount?: number | null
          circle_id: string
          created_at?: string | null
          currency?: string | null
          expires_at?: string | null
          id?: string
          started_at?: string | null
          status?: string | null
          stripe_subscription_id?: string | null
          user_id: string
        }
        Update: {
          amount?: number | null
          circle_id?: string
          created_at?: string | null
          currency?: string | null
          expires_at?: string | null
          id?: string
          started_at?: string | null
          status?: string | null
          stripe_subscription_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "circle_subscriptions_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "spark_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      circle_video_calls: {
        Row: {
          circle_id: string
          created_at: string
          duration_seconds: number | null
          ended_at: string | null
          id: string
          participants: Json
          recording_id: string | null
          room_name: string
          room_url: string
          started_at: string
          started_by: string
        }
        Insert: {
          circle_id: string
          created_at?: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          participants?: Json
          recording_id?: string | null
          room_name: string
          room_url: string
          started_at?: string
          started_by: string
        }
        Update: {
          circle_id?: string
          created_at?: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          participants?: Json
          recording_id?: string | null
          room_name?: string
          room_url?: string
          started_at?: string
          started_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "circle_video_calls_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "spark_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      client_contacts: {
        Row: {
          client_id: string
          created_at: string
          email: string | null
          id: string
          is_primary: boolean | null
          name: string
          phone: string | null
          role: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          email?: string | null
          id?: string
          is_primary?: boolean | null
          name: string
          phone?: string | null
          role?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          email?: string | null
          id?: string
          is_primary?: boolean | null
          name?: string
          phone?: string | null
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_contacts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_error_logs: {
        Row: {
          component_name: string | null
          created_at: string
          error_message: string
          error_stack: string | null
          id: string
          metadata: Json | null
          page_url: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          component_name?: string | null
          created_at?: string
          error_message: string
          error_stack?: string | null
          id?: string
          metadata?: Json | null
          page_url?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          component_name?: string | null
          created_at?: string
          error_message?: string
          error_stack?: string | null
          id?: string
          metadata?: Json | null
          page_url?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      clients: {
        Row: {
          archived_at: string | null
          brand_color: string | null
          company_name: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          default_currency: string | null
          default_markup_pct: number | null
          id: string
          logo_url: string | null
          name: string
          notes: string | null
          owner_id: string
          payment_terms: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          archived_at?: string | null
          brand_color?: string | null
          company_name?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          default_currency?: string | null
          default_markup_pct?: number | null
          id?: string
          logo_url?: string | null
          name: string
          notes?: string | null
          owner_id: string
          payment_terms?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          archived_at?: string | null
          brand_color?: string | null
          company_name?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          default_currency?: string | null
          default_markup_pct?: number | null
          id?: string
          logo_url?: string | null
          name?: string
          notes?: string | null
          owner_id?: string
          payment_terms?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      communities: {
        Row: {
          category: string | null
          cover_url: string | null
          created_at: string
          created_by: string
          description: string | null
          id: string
          image_url: string | null
          is_official: boolean | null
          is_private: boolean | null
          location: string | null
          member_count: number | null
          name: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          cover_url?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_official?: boolean | null
          is_private?: boolean | null
          location?: string | null
          member_count?: number | null
          name: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          cover_url?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_official?: boolean | null
          is_private?: boolean | null
          location?: string | null
          member_count?: number | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      community_members: {
        Row: {
          community_id: string
          id: string
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          community_id: string
          id?: string
          joined_at?: string
          role?: string
          user_id: string
        }
        Update: {
          community_id?: string
          id?: string
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_members_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      community_post_reactions: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_post_reactions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      community_posts: {
        Row: {
          community_id: string
          content: string
          created_at: string
          id: string
          media_type: string | null
          media_urls: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          community_id: string
          content: string
          created_at?: string
          id?: string
          media_type?: string | null
          media_urls?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          community_id?: string
          content?: string
          created_at?: string
          id?: string
          media_type?: string | null
          media_urls?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_posts_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      company_reviews: {
        Row: {
          company_id: string
          created_at: string
          helpful_count: number | null
          id: string
          opportunity_id: string | null
          project_id: string | null
          rating: number
          response_date: string | null
          response_text: string | null
          review_text: string | null
          reviewer_id: string
          status: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          helpful_count?: number | null
          id?: string
          opportunity_id?: string | null
          project_id?: string | null
          rating: number
          response_date?: string | null
          response_text?: string | null
          review_text?: string | null
          reviewer_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          helpful_count?: number | null
          id?: string
          opportunity_id?: string | null
          project_id?: string | null
          rating?: number
          response_date?: string | null
          response_text?: string | null
          review_text?: string | null
          reviewer_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_reviews_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "feed_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "company_reviews_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "company_reviews_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "company_reviews_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_profiles_discovery"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "company_reviews_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_profiles_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "company_reviews_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_reviews_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "feed_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "company_reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "company_reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "company_reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "public_profiles_discovery"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "company_reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "public_profiles_view"
            referencedColumns: ["user_id"]
          },
        ]
      }
      connected_platforms: {
        Row: {
          access_token: string | null
          created_at: string | null
          id: string
          last_synced_at: string | null
          platform: string
          platform_data: Json | null
          platform_user_id: string | null
          platform_username: string | null
          refresh_token: string | null
          token_expires_at: string | null
          updated_at: string | null
          user_id: string
          verified_at: string | null
        }
        Insert: {
          access_token?: string | null
          created_at?: string | null
          id?: string
          last_synced_at?: string | null
          platform: string
          platform_data?: Json | null
          platform_user_id?: string | null
          platform_username?: string | null
          refresh_token?: string | null
          token_expires_at?: string | null
          updated_at?: string | null
          user_id: string
          verified_at?: string | null
        }
        Update: {
          access_token?: string | null
          created_at?: string | null
          id?: string
          last_synced_at?: string | null
          platform?: string
          platform_data?: Json | null
          platform_user_id?: string | null
          platform_username?: string | null
          refresh_token?: string | null
          token_expires_at?: string | null
          updated_at?: string | null
          user_id?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "connected_platforms_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "feed_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "connected_platforms_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "connected_platforms_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "connected_platforms_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles_discovery"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "connected_platforms_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles_view"
            referencedColumns: ["user_id"]
          },
        ]
      }
      connections: {
        Row: {
          connected_user_id: string
          context: Json | null
          created_at: string | null
          declined_at: string | null
          id: string
          is_message_request: boolean | null
          status: string | null
          user_id: string
        }
        Insert: {
          connected_user_id: string
          context?: Json | null
          created_at?: string | null
          declined_at?: string | null
          id?: string
          is_message_request?: boolean | null
          status?: string | null
          user_id: string
        }
        Update: {
          connected_user_id?: string
          context?: Json | null
          created_at?: string | null
          declined_at?: string | null
          id?: string
          is_message_request?: boolean | null
          status?: string | null
          user_id?: string
        }
        Relationships: []
      }
      content_approvals: {
        Row: {
          asset_url: string | null
          created_at: string
          created_by: string
          decided_at: string | null
          feedback: string | null
          id: string
          item_id: string | null
          item_type: string
          project_id: string
          reviewer_id: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          asset_url?: string | null
          created_at?: string
          created_by: string
          decided_at?: string | null
          feedback?: string | null
          id?: string
          item_id?: string | null
          item_type?: string
          project_id: string
          reviewer_id?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          asset_url?: string | null
          created_at?: string
          created_by?: string
          decided_at?: string | null
          feedback?: string | null
          id?: string
          item_id?: string | null
          item_type?: string
          project_id?: string
          reviewer_id?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_approvals_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      content_calendar_items: {
        Row: {
          asset_url: string | null
          caption: string | null
          created_at: string
          created_by: string
          hashtags: string[] | null
          id: string
          notes: string | null
          platform: string | null
          project_id: string
          scheduled_at: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          asset_url?: string | null
          caption?: string | null
          created_at?: string
          created_by: string
          hashtags?: string[] | null
          id?: string
          notes?: string | null
          platform?: string | null
          project_id: string
          scheduled_at?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          asset_url?: string | null
          caption?: string | null
          created_at?: string
          created_by?: string
          hashtags?: string[] | null
          id?: string
          notes?: string | null
          platform?: string | null
          project_id?: string
          scheduled_at?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_calendar_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      content_scripts: {
        Row: {
          body: string
          created_at: string
          created_by: string
          id: string
          is_current: boolean
          project_id: string
          title: string
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          body?: string
          created_at?: string
          created_by: string
          id?: string
          is_current?: boolean
          project_id: string
          title?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string
          id?: string
          is_current?: boolean
          project_id?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "content_scripts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      content_shots: {
        Row: {
          created_at: string
          created_by: string
          description: string
          duration_seconds: number | null
          id: string
          location: string | null
          notes: string | null
          order_index: number
          project_id: string
          props: string[] | null
          scene_no: number | null
          shot_no: number | null
          shot_type: string | null
          status: string
          talent: string[] | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description: string
          duration_seconds?: number | null
          id?: string
          location?: string | null
          notes?: string | null
          order_index?: number
          project_id: string
          props?: string[] | null
          scene_no?: number | null
          shot_no?: number | null
          shot_type?: string | null
          status?: string
          talent?: string[] | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string
          duration_seconds?: number | null
          id?: string
          location?: string | null
          notes?: string | null
          order_index?: number
          project_id?: string
          props?: string[] | null
          scene_no?: number | null
          shot_no?: number | null
          shot_type?: string | null
          status?: string
          talent?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_shots_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_templates: {
        Row: {
          contract_type: string
          created_at: string
          created_by: string
          description: string | null
          id: string
          is_public: boolean
          terms_template: Json
          title: string
          updated_at: string
          usage_count: number
        }
        Insert: {
          contract_type?: string
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          is_public?: boolean
          terms_template?: Json
          title: string
          updated_at?: string
          usage_count?: number
        }
        Update: {
          contract_type?: string
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          is_public?: boolean
          terms_template?: Json
          title?: string
          updated_at?: string
          usage_count?: number
        }
        Relationships: []
      }
      copilot_memories: {
        Row: {
          confidence: number
          content: string
          created_at: string
          embedding: string | null
          id: string
          kind: string
          last_used_at: string | null
          source: string | null
          updated_at: string
          use_count: number
          user_id: string
        }
        Insert: {
          confidence?: number
          content: string
          created_at?: string
          embedding?: string | null
          id?: string
          kind?: string
          last_used_at?: string | null
          source?: string | null
          updated_at?: string
          use_count?: number
          user_id: string
        }
        Update: {
          confidence?: number
          content?: string
          created_at?: string
          embedding?: string | null
          id?: string
          kind?: string
          last_used_at?: string | null
          source?: string | null
          updated_at?: string
          use_count?: number
          user_id?: string
        }
        Relationships: []
      }
      copilot_plans: {
        Row: {
          completed_at: string | null
          created_at: string
          current_step: number
          goal: string
          id: string
          project_id: string | null
          status: string
          steps: Json
          summary: string | null
          surface: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          current_step?: number
          goal: string
          id?: string
          project_id?: string | null
          status?: string
          steps?: Json
          summary?: string | null
          surface?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          current_step?: number
          goal?: string
          id?: string
          project_id?: string | null
          status?: string
          steps?: Json
          summary?: string | null
          surface?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      creative_actions: {
        Row: {
          action_type: string
          created_at: string
          id: number
          metadata: Json | null
          ref_id: string | null
          user_id: string | null
        }
        Insert: {
          action_type: string
          created_at?: string
          id?: number
          metadata?: Json | null
          ref_id?: string | null
          user_id?: string | null
        }
        Update: {
          action_type?: string
          created_at?: string
          id?: number
          metadata?: Json | null
          ref_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      creative_assets: {
        Row: {
          created_at: string
          description: string | null
          file_size: number | null
          file_type: string | null
          file_url: string
          folder_id: string | null
          generation_model: string | null
          generation_prompt: string | null
          id: string
          media_type: string | null
          name: string
          project_id: string
          source: string | null
          tags: string[] | null
          thumbnail_url: string | null
          updated_at: string
          uploaded_by: string
          version: number | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url: string
          folder_id?: string | null
          generation_model?: string | null
          generation_prompt?: string | null
          id?: string
          media_type?: string | null
          name: string
          project_id: string
          source?: string | null
          tags?: string[] | null
          thumbnail_url?: string | null
          updated_at?: string
          uploaded_by: string
          version?: number | null
        }
        Update: {
          created_at?: string
          description?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          folder_id?: string | null
          generation_model?: string | null
          generation_prompt?: string | null
          id?: string
          media_type?: string | null
          name?: string
          project_id?: string
          source?: string | null
          tags?: string[] | null
          thumbnail_url?: string | null
          updated_at?: string
          uploaded_by?: string
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "creative_assets_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "asset_folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creative_assets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      creative_jams: {
        Row: {
          approval_required: boolean
          attendee_list_visibility: string
          category: string
          circle_id: string | null
          claim_status: string
          claim_token: string | null
          co_host_revenue_split: Json | null
          country: string | null
          cover_image_url: string | null
          created_at: string
          created_by: string
          description: string | null
          end_time: string | null
          event_mode: string
          event_type: string | null
          external_ticket_url: string | null
          gallery_image_urls: string[]
          group_chat_enabled: boolean
          group_chat_room_id: string | null
          guest_matching_enabled: boolean
          host_response_hours: number | null
          id: string
          is_public: boolean | null
          is_recurring_parent: boolean
          is_ticketed: boolean | null
          latitude: number | null
          longitude: number | null
          max_participants: number | null
          online_format: string | null
          online_max_attendees: number | null
          original_source_text: string | null
          parent_event_id: string | null
          photo_wall_enabled: boolean
          project_id: string | null
          recording_enabled: boolean
          refund_policy: string | null
          require_account_for_rsvp: boolean
          scouted_by: string | null
          source_platform: string | null
          source_url: string | null
          start_time: string
          status: string | null
          status_note: string | null
          tags: string[] | null
          ticket_currency: string | null
          ticket_price: number | null
          timezone: string | null
          title: string
          total_views: number
          updated_at: string
          venue_address: string | null
          venue_name: string | null
          video_room_started_at: string | null
          video_room_started_by: string | null
          video_room_url: string | null
          waitlist_enabled: boolean
          watch_party_video_url: string | null
        }
        Insert: {
          approval_required?: boolean
          attendee_list_visibility?: string
          category?: string
          circle_id?: string | null
          claim_status?: string
          claim_token?: string | null
          co_host_revenue_split?: Json | null
          country?: string | null
          cover_image_url?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          end_time?: string | null
          event_mode?: string
          event_type?: string | null
          external_ticket_url?: string | null
          gallery_image_urls?: string[]
          group_chat_enabled?: boolean
          group_chat_room_id?: string | null
          guest_matching_enabled?: boolean
          host_response_hours?: number | null
          id?: string
          is_public?: boolean | null
          is_recurring_parent?: boolean
          is_ticketed?: boolean | null
          latitude?: number | null
          longitude?: number | null
          max_participants?: number | null
          online_format?: string | null
          online_max_attendees?: number | null
          original_source_text?: string | null
          parent_event_id?: string | null
          photo_wall_enabled?: boolean
          project_id?: string | null
          recording_enabled?: boolean
          refund_policy?: string | null
          require_account_for_rsvp?: boolean
          scouted_by?: string | null
          source_platform?: string | null
          source_url?: string | null
          start_time: string
          status?: string | null
          status_note?: string | null
          tags?: string[] | null
          ticket_currency?: string | null
          ticket_price?: number | null
          timezone?: string | null
          title: string
          total_views?: number
          updated_at?: string
          venue_address?: string | null
          venue_name?: string | null
          video_room_started_at?: string | null
          video_room_started_by?: string | null
          video_room_url?: string | null
          waitlist_enabled?: boolean
          watch_party_video_url?: string | null
        }
        Update: {
          approval_required?: boolean
          attendee_list_visibility?: string
          category?: string
          circle_id?: string | null
          claim_status?: string
          claim_token?: string | null
          co_host_revenue_split?: Json | null
          country?: string | null
          cover_image_url?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          end_time?: string | null
          event_mode?: string
          event_type?: string | null
          external_ticket_url?: string | null
          gallery_image_urls?: string[]
          group_chat_enabled?: boolean
          group_chat_room_id?: string | null
          guest_matching_enabled?: boolean
          host_response_hours?: number | null
          id?: string
          is_public?: boolean | null
          is_recurring_parent?: boolean
          is_ticketed?: boolean | null
          latitude?: number | null
          longitude?: number | null
          max_participants?: number | null
          online_format?: string | null
          online_max_attendees?: number | null
          original_source_text?: string | null
          parent_event_id?: string | null
          photo_wall_enabled?: boolean
          project_id?: string | null
          recording_enabled?: boolean
          refund_policy?: string | null
          require_account_for_rsvp?: boolean
          scouted_by?: string | null
          source_platform?: string | null
          source_url?: string | null
          start_time?: string
          status?: string | null
          status_note?: string | null
          tags?: string[] | null
          ticket_currency?: string | null
          ticket_price?: number | null
          timezone?: string | null
          title?: string
          total_views?: number
          updated_at?: string
          venue_address?: string | null
          venue_name?: string | null
          video_room_started_at?: string | null
          video_room_started_by?: string | null
          video_room_url?: string | null
          waitlist_enabled?: boolean
          watch_party_video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "creative_jams_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "spark_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creative_jams_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "feed_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "creative_jams_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "creative_jams_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "creative_jams_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "public_profiles_discovery"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "creative_jams_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "public_profiles_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "creative_jams_group_chat_room_id_fkey"
            columns: ["group_chat_room_id"]
            isOneToOne: false
            referencedRelation: "spark_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creative_jams_parent_event_id_fkey"
            columns: ["parent_event_id"]
            isOneToOne: false
            referencedRelation: "creative_jams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creative_jams_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      creative_locations: {
        Row: {
          address: string | null
          amenities: string[] | null
          average_rating: number | null
          booking_enabled: boolean | null
          category: string | null
          city: string | null
          claimed_by_user_id: string | null
          contact_info: string | null
          country: string | null
          cover_image_url: string | null
          created_at: string
          description: string | null
          hours_of_operation: Json | null
          id: string
          image_urls: string[] | null
          is_active: boolean | null
          is_rentable: boolean | null
          is_verified: boolean | null
          latitude: number
          location_type: string
          longitude: number
          min_booking_hours: number | null
          name: string
          price_currency: string | null
          price_per_hour: number | null
          review_count: number | null
          tags: string[] | null
          updated_at: string
          user_id: string
          website_url: string | null
        }
        Insert: {
          address?: string | null
          amenities?: string[] | null
          average_rating?: number | null
          booking_enabled?: boolean | null
          category?: string | null
          city?: string | null
          claimed_by_user_id?: string | null
          contact_info?: string | null
          country?: string | null
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          hours_of_operation?: Json | null
          id?: string
          image_urls?: string[] | null
          is_active?: boolean | null
          is_rentable?: boolean | null
          is_verified?: boolean | null
          latitude: number
          location_type?: string
          longitude: number
          min_booking_hours?: number | null
          name: string
          price_currency?: string | null
          price_per_hour?: number | null
          review_count?: number | null
          tags?: string[] | null
          updated_at?: string
          user_id: string
          website_url?: string | null
        }
        Update: {
          address?: string | null
          amenities?: string[] | null
          average_rating?: number | null
          booking_enabled?: boolean | null
          category?: string | null
          city?: string | null
          claimed_by_user_id?: string | null
          contact_info?: string | null
          country?: string | null
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          hours_of_operation?: Json | null
          id?: string
          image_urls?: string[] | null
          is_active?: boolean | null
          is_rentable?: boolean | null
          is_verified?: boolean | null
          latitude?: number
          location_type?: string
          longitude?: number
          min_booking_hours?: number | null
          name?: string
          price_currency?: string | null
          price_per_hour?: number | null
          review_count?: number | null
          tags?: string[] | null
          updated_at?: string
          user_id?: string
          website_url?: string | null
        }
        Relationships: []
      }
      creator_availability_blocks: {
        Row: {
          block_type: string
          created_at: string
          end_date: string
          id: string
          is_public: boolean
          label: string | null
          start_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          block_type?: string
          created_at?: string
          end_date: string
          id?: string
          is_public?: boolean
          label?: string | null
          start_date: string
          updated_at?: string
          user_id: string
        }
        Update: {
          block_type?: string
          created_at?: string
          end_date?: string
          id?: string
          is_public?: boolean
          label?: string | null
          start_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      creator_booking_windows: {
        Row: {
          buffer_minutes: number
          created_at: string
          end_minute: number
          id: string
          is_active: boolean
          slot_minutes: number
          start_minute: number
          timezone: string
          updated_at: string
          user_id: string
          weekday: number
        }
        Insert: {
          buffer_minutes?: number
          created_at?: string
          end_minute: number
          id?: string
          is_active?: boolean
          slot_minutes?: number
          start_minute: number
          timezone?: string
          updated_at?: string
          user_id: string
          weekday: number
        }
        Update: {
          buffer_minutes?: number
          created_at?: string
          end_minute?: number
          id?: string
          is_active?: boolean
          slot_minutes?: number
          start_minute?: number
          timezone?: string
          updated_at?: string
          user_id?: string
          weekday?: number
        }
        Relationships: []
      }
      creator_payout_methods: {
        Row: {
          brand: string | null
          country: string | null
          created_at: string
          currency: string
          id: string
          is_default: boolean
          last4: string | null
          stripe_external_account_id: string
          type: string
          user_id: string
        }
        Insert: {
          brand?: string | null
          country?: string | null
          created_at?: string
          currency: string
          id?: string
          is_default?: boolean
          last4?: string | null
          stripe_external_account_id: string
          type: string
          user_id: string
        }
        Update: {
          brand?: string | null
          country?: string | null
          created_at?: string
          currency?: string
          id?: string
          is_default?: boolean
          last4?: string | null
          stripe_external_account_id?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      creator_payouts: {
        Row: {
          amount_cents: number
          arrival_date: string | null
          created_at: string
          currency: string
          failure_reason: string | null
          id: string
          payout_method_id: string | null
          status: string
          stripe_payout_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_cents: number
          arrival_date?: string | null
          created_at?: string
          currency: string
          failure_reason?: string | null
          id?: string
          payout_method_id?: string | null
          status?: string
          stripe_payout_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_cents?: number
          arrival_date?: string | null
          created_at?: string
          currency?: string
          failure_reason?: string | null
          id?: string
          payout_method_id?: string | null
          status?: string
          stripe_payout_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      creator_rates: {
        Row: {
          amount: number
          amount_max: number | null
          created_at: string
          currency: string
          id: string
          is_active: boolean
          label: string
          notes: string | null
          rate_type: string
          sort_order: number
          unit: string | null
          updated_at: string
          user_id: string
          visibility: string
        }
        Insert: {
          amount: number
          amount_max?: number | null
          created_at?: string
          currency?: string
          id?: string
          is_active?: boolean
          label: string
          notes?: string | null
          rate_type: string
          sort_order?: number
          unit?: string | null
          updated_at?: string
          user_id: string
          visibility?: string
        }
        Update: {
          amount?: number
          amount_max?: number | null
          created_at?: string
          currency?: string
          id?: string
          is_active?: boolean
          label?: string
          notes?: string | null
          rate_type?: string
          sort_order?: number
          unit?: string | null
          updated_at?: string
          user_id?: string
          visibility?: string
        }
        Relationships: []
      }
      creator_services: {
        Row: {
          category: string | null
          cover_image_url: string | null
          created_at: string
          delivery_time: string | null
          description: string | null
          display_order: number | null
          id: string
          is_active: boolean | null
          sample_urls: string[] | null
          service_format: string | null
          tags: string[] | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          cover_image_url?: string | null
          created_at?: string
          delivery_time?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          sample_urls?: string[] | null
          service_format?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          cover_image_url?: string | null
          created_at?: string
          delivery_time?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          sample_urls?: string[] | null
          service_format?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      creator_wallet_balances: {
        Row: {
          available_cents: number
          currency: string
          pending_cents: number
          updated_at: string
          user_id: string
        }
        Insert: {
          available_cents?: number
          currency: string
          pending_cents?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          available_cents?: number
          currency?: string
          pending_cents?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      creator_wallets: {
        Row: {
          charges_enabled: boolean
          country: string | null
          created_at: string
          default_currency: string
          kyc_status: string
          payouts_enabled: boolean
          requirements: Json
          stripe_account_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          charges_enabled?: boolean
          country?: string | null
          created_at?: string
          default_currency?: string
          kyc_status?: string
          payouts_enabled?: boolean
          requirements?: Json
          stripe_account_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          charges_enabled?: boolean
          country?: string | null
          created_at?: string
          default_currency?: string
          kyc_status?: string
          payouts_enabled?: boolean
          requirements?: Json
          stripe_account_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      credit_ai_verifications: {
        Row: {
          ai_summary: string | null
          confidence_score: number | null
          credit_id: string
          evidence_links: Json | null
          id: string
          last_checked_at: string
          search_query: string | null
          status: string
          verified_at: string
        }
        Insert: {
          ai_summary?: string | null
          confidence_score?: number | null
          credit_id: string
          evidence_links?: Json | null
          id?: string
          last_checked_at?: string
          search_query?: string | null
          status?: string
          verified_at?: string
        }
        Update: {
          ai_summary?: string | null
          confidence_score?: number | null
          credit_id?: string
          evidence_links?: Json | null
          id?: string
          last_checked_at?: string
          search_query?: string | null
          status?: string
          verified_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_ai_verifications_credit_id_fkey"
            columns: ["credit_id"]
            isOneToOne: true
            referencedRelation: "credits"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_claim_disputes: {
        Row: {
          auto_resolve_at: string | null
          challenger_evidence: string | null
          challenger_id: string
          challenger_role: string | null
          created_at: string
          credit_id: string
          current_owner_id: string
          evidence_urls: string[] | null
          id: string
          owner_responded_at: string | null
          owner_response: string | null
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          source_url: string | null
          status: string
          updated_at: string
        }
        Insert: {
          auto_resolve_at?: string | null
          challenger_evidence?: string | null
          challenger_id: string
          challenger_role?: string | null
          created_at?: string
          credit_id: string
          current_owner_id: string
          evidence_urls?: string[] | null
          id?: string
          owner_responded_at?: string | null
          owner_response?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          source_url?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          auto_resolve_at?: string | null
          challenger_evidence?: string | null
          challenger_id?: string
          challenger_role?: string | null
          created_at?: string
          credit_id?: string
          current_owner_id?: string
          evidence_urls?: string[] | null
          id?: string
          owner_responded_at?: string | null
          owner_response?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          source_url?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_claim_disputes_credit_id_fkey"
            columns: ["credit_id"]
            isOneToOne: false
            referencedRelation: "credits"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_comments: {
        Row: {
          content: string
          created_at: string
          credit_id: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          credit_id: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          credit_id?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_comments_credit_id_fkey"
            columns: ["credit_id"]
            isOneToOne: false
            referencedRelation: "credits"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_endorsements: {
        Row: {
          credit_id: string
          endorser_email: string | null
          endorser_id: string | null
          endorser_name: string | null
          id: string
          relationship: string | null
          requested_at: string
          requested_by: string
          responded_at: string | null
          status: string
          testimonial: string | null
          token: string | null
        }
        Insert: {
          credit_id: string
          endorser_email?: string | null
          endorser_id?: string | null
          endorser_name?: string | null
          id?: string
          relationship?: string | null
          requested_at?: string
          requested_by: string
          responded_at?: string | null
          status?: string
          testimonial?: string | null
          token?: string | null
        }
        Update: {
          credit_id?: string
          endorser_email?: string | null
          endorser_id?: string | null
          endorser_name?: string | null
          id?: string
          relationship?: string | null
          requested_at?: string
          requested_by?: string
          responded_at?: string | null
          status?: string
          testimonial?: string | null
          token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credit_endorsements_credit_id_fkey"
            columns: ["credit_id"]
            isOneToOne: false
            referencedRelation: "credits"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_reactions: {
        Row: {
          created_at: string
          credit_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          credit_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          credit_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_reactions_credit_id_fkey"
            columns: ["credit_id"]
            isOneToOne: false
            referencedRelation: "credits"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_vouches: {
        Row: {
          action: string
          created_at: string
          credit_id: string
          id: string
          note: string | null
          updated_at: string
          voucher_id: string
        }
        Insert: {
          action: string
          created_at?: string
          credit_id: string
          id?: string
          note?: string | null
          updated_at?: string
          voucher_id: string
        }
        Update: {
          action?: string
          created_at?: string
          credit_id?: string
          id?: string
          note?: string | null
          updated_at?: string
          voucher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_vouches_credit_id_fkey"
            columns: ["credit_id"]
            isOneToOne: false
            referencedRelation: "credits"
            referencedColumns: ["id"]
          },
        ]
      }
      credits: {
        Row: {
          ai_confidence: number | null
          client_brand: string | null
          collaborator_user_ids: string[] | null
          created_at: string
          credit_category: string | null
          description: string | null
          display_order: number | null
          embed_data: Json | null
          end_date: string | null
          endorsement_count: number | null
          external_links: Json | null
          id: string
          is_featured: boolean | null
          location: string | null
          media_type: string | null
          media_urls: string[] | null
          metadata: Json | null
          payment_verified: boolean | null
          platform: string | null
          primary_media_url: string | null
          project_id: string | null
          project_name: string
          project_type: string | null
          role: string
          source: string | null
          source_id: string | null
          source_url: string | null
          start_date: string | null
          tags: string[] | null
          thumbnail_url: string | null
          updated_at: string
          url: string | null
          user_id: string
          verification_status: string | null
          verification_url: string | null
          verified_by_name: string | null
          verified_by_user_id: string | null
          view_count: number | null
          year: number | null
        }
        Insert: {
          ai_confidence?: number | null
          client_brand?: string | null
          collaborator_user_ids?: string[] | null
          created_at?: string
          credit_category?: string | null
          description?: string | null
          display_order?: number | null
          embed_data?: Json | null
          end_date?: string | null
          endorsement_count?: number | null
          external_links?: Json | null
          id?: string
          is_featured?: boolean | null
          location?: string | null
          media_type?: string | null
          media_urls?: string[] | null
          metadata?: Json | null
          payment_verified?: boolean | null
          platform?: string | null
          primary_media_url?: string | null
          project_id?: string | null
          project_name: string
          project_type?: string | null
          role: string
          source?: string | null
          source_id?: string | null
          source_url?: string | null
          start_date?: string | null
          tags?: string[] | null
          thumbnail_url?: string | null
          updated_at?: string
          url?: string | null
          user_id: string
          verification_status?: string | null
          verification_url?: string | null
          verified_by_name?: string | null
          verified_by_user_id?: string | null
          view_count?: number | null
          year?: number | null
        }
        Update: {
          ai_confidence?: number | null
          client_brand?: string | null
          collaborator_user_ids?: string[] | null
          created_at?: string
          credit_category?: string | null
          description?: string | null
          display_order?: number | null
          embed_data?: Json | null
          end_date?: string | null
          endorsement_count?: number | null
          external_links?: Json | null
          id?: string
          is_featured?: boolean | null
          location?: string | null
          media_type?: string | null
          media_urls?: string[] | null
          metadata?: Json | null
          payment_verified?: boolean | null
          platform?: string | null
          primary_media_url?: string | null
          project_id?: string | null
          project_name?: string
          project_type?: string | null
          role?: string
          source?: string | null
          source_id?: string | null
          source_url?: string | null
          start_date?: string | null
          tags?: string[] | null
          thumbnail_url?: string | null
          updated_at?: string
          url?: string | null
          user_id?: string
          verification_status?: string | null
          verification_url?: string | null
          verified_by_name?: string | null
          verified_by_user_id?: string | null
          view_count?: number | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "credits_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_evidence: {
        Row: {
          actor_role: string | null
          actor_user_id: string | null
          created_at: string
          credit_id: string
          detail: Json
          id: string
          kind: string
          source_id: string | null
          source_table: string | null
          status: string
          summary: string | null
        }
        Insert: {
          actor_role?: string | null
          actor_user_id?: string | null
          created_at?: string
          credit_id: string
          detail?: Json
          id?: string
          kind: string
          source_id?: string | null
          source_table?: string | null
          status?: string
          summary?: string | null
        }
        Update: {
          actor_role?: string | null
          actor_user_id?: string | null
          created_at?: string
          credit_id?: string
          detail?: Json
          id?: string
          kind?: string
          source_id?: string | null
          source_table?: string | null
          status?: string
          summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credit_evidence_credit_id_fkey"
            columns: ["credit_id"]
            isOneToOne: false
            referencedRelation: "credits"
            referencedColumns: ["id"]
          },
        ]
      }
      crew_feed_post_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          post_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          post_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          post_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crew_feed_post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "crew_feed_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      crew_feed_post_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crew_feed_post_reactions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "crew_feed_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      crew_feed_posts: {
        Row: {
          circle_id: string
          comment_count: number
          content: string
          created_at: string
          id: string
          is_pinned: boolean
          media_type: string | null
          media_url: string | null
          reaction_count: number
          updated_at: string
          user_id: string
        }
        Insert: {
          circle_id: string
          comment_count?: number
          content: string
          created_at?: string
          id?: string
          is_pinned?: boolean
          media_type?: string | null
          media_url?: string | null
          reaction_count?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          circle_id?: string
          comment_count?: number
          content?: string
          created_at?: string
          id?: string
          is_pinned?: boolean
          media_type?: string | null
          media_url?: string | null
          reaction_count?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crew_feed_posts_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "spark_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      curated_stage_app_usage: {
        Row: {
          application_count: number
          updated_at: string
          usage_month: string
          user_id: string
        }
        Insert: {
          application_count?: number
          updated_at?: string
          usage_month: string
          user_id: string
        }
        Update: {
          application_count?: number
          updated_at?: string
          usage_month?: string
          user_id?: string
        }
        Relationships: []
      }
      curated_stage_applications: {
        Row: {
          created_at: string
          id: string
          match_score: number | null
          pitch: string | null
          reviewed_at: string | null
          stage_id: string
          status: Database["public"]["Enums"]["curated_application_status"]
          user_id: string
          voice_url: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          match_score?: number | null
          pitch?: string | null
          reviewed_at?: string | null
          stage_id: string
          status?: Database["public"]["Enums"]["curated_application_status"]
          user_id: string
          voice_url?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          match_score?: number | null
          pitch?: string | null
          reviewed_at?: string | null
          stage_id?: string
          status?: Database["public"]["Enums"]["curated_application_status"]
          user_id?: string
          voice_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "curated_stage_applications_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "curated_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      curated_stage_invites: {
        Row: {
          accepted_at: string | null
          email: string
          id: string
          invited_at: string
          invited_by: string
          stage_id: string
          status: string
          token: string
          user_id: string | null
        }
        Insert: {
          accepted_at?: string | null
          email: string
          id?: string
          invited_at?: string
          invited_by: string
          stage_id: string
          status?: string
          token?: string
          user_id?: string | null
        }
        Update: {
          accepted_at?: string | null
          email?: string
          id?: string
          invited_at?: string
          invited_by?: string
          stage_id?: string
          status?: string
          token?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "curated_stage_invites_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "curated_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      curated_stage_orders: {
        Row: {
          amount_cents: number
          created_at: string
          currency: string
          id: string
          paid_at: string | null
          stage_id: string
          status: Database["public"]["Enums"]["curated_stage_order_status"]
          stripe_session_id: string | null
          user_id: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          currency?: string
          id?: string
          paid_at?: string | null
          stage_id: string
          status?: Database["public"]["Enums"]["curated_stage_order_status"]
          stripe_session_id?: string | null
          user_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          currency?: string
          id?: string
          paid_at?: string | null
          stage_id?: string
          status?: Database["public"]["Enums"]["curated_stage_order_status"]
          stripe_session_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "curated_stage_orders_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "curated_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      curated_stage_raised_hands: {
        Row: {
          created_at: string
          id: string
          promoted_at: string | null
          stage_id: string
          status: Database["public"]["Enums"]["curated_raised_hand_status"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          promoted_at?: string | null
          stage_id: string
          status?: Database["public"]["Enums"]["curated_raised_hand_status"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          promoted_at?: string | null
          stage_id?: string
          status?: Database["public"]["Enums"]["curated_raised_hand_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "curated_stage_raised_hands_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "curated_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      curated_stage_reminders_sent: {
        Row: {
          id: string
          kind: string
          sent_at: string
          stage_id: string
        }
        Insert: {
          id?: string
          kind: string
          sent_at?: string
          stage_id: string
        }
        Update: {
          id?: string
          kind?: string
          sent_at?: string
          stage_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "curated_stage_reminders_sent_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "curated_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      curated_stage_rsvps: {
        Row: {
          created_at: string
          id: string
          joined_at: string | null
          stage_id: string
          status: Database["public"]["Enums"]["curated_rsvp_status"]
          ticket_order_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          joined_at?: string | null
          stage_id: string
          status?: Database["public"]["Enums"]["curated_rsvp_status"]
          ticket_order_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          joined_at?: string | null
          stage_id?: string
          status?: Database["public"]["Enums"]["curated_rsvp_status"]
          ticket_order_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "curated_stage_rsvps_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "curated_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      curated_stage_turns: {
        Row: {
          applicant_user_id: string
          created_at: string
          ended_at: string | null
          host_note: string | null
          id: string
          outcome: Database["public"]["Enums"]["curated_turn_outcome"] | null
          stage_id: string
          started_at: string
        }
        Insert: {
          applicant_user_id: string
          created_at?: string
          ended_at?: string | null
          host_note?: string | null
          id?: string
          outcome?: Database["public"]["Enums"]["curated_turn_outcome"] | null
          stage_id: string
          started_at?: string
        }
        Update: {
          applicant_user_id?: string
          created_at?: string
          ended_at?: string | null
          host_note?: string | null
          id?: string
          outcome?: Database["public"]["Enums"]["curated_turn_outcome"] | null
          stage_id?: string
          started_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "curated_stage_turns_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "curated_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      curated_stages: {
        Row: {
          application_prompt: string | null
          application_required: boolean
          attended_count: number
          blurb: string | null
          capacity: number
          cover_url: string | null
          created_at: string
          currency: string | null
          description: string | null
          ends_at: string | null
          host_user_id: string
          id: string
          invite_token: string | null
          is_paid: boolean
          mode: string
          price_cents: number | null
          recording_enabled: boolean
          recording_url: string | null
          room_name: string | null
          room_url: string | null
          rsvp_count: number
          starts_at: string
          status: Database["public"]["Enums"]["curated_stage_status"]
          title: string
          turn_seconds: number
          type: Database["public"]["Enums"]["curated_stage_type"]
          updated_at: string
          vibe_tags: string[] | null
          visibility: string
        }
        Insert: {
          application_prompt?: string | null
          application_required?: boolean
          attended_count?: number
          blurb?: string | null
          capacity?: number
          cover_url?: string | null
          created_at?: string
          currency?: string | null
          description?: string | null
          ends_at?: string | null
          host_user_id: string
          id?: string
          invite_token?: string | null
          is_paid?: boolean
          mode?: string
          price_cents?: number | null
          recording_enabled?: boolean
          recording_url?: string | null
          room_name?: string | null
          room_url?: string | null
          rsvp_count?: number
          starts_at: string
          status?: Database["public"]["Enums"]["curated_stage_status"]
          title: string
          turn_seconds?: number
          type: Database["public"]["Enums"]["curated_stage_type"]
          updated_at?: string
          vibe_tags?: string[] | null
          visibility?: string
        }
        Update: {
          application_prompt?: string | null
          application_required?: boolean
          attended_count?: number
          blurb?: string | null
          capacity?: number
          cover_url?: string | null
          created_at?: string
          currency?: string | null
          description?: string | null
          ends_at?: string | null
          host_user_id?: string
          id?: string
          invite_token?: string | null
          is_paid?: boolean
          mode?: string
          price_cents?: number | null
          recording_enabled?: boolean
          recording_url?: string | null
          room_name?: string | null
          room_url?: string | null
          rsvp_count?: number
          starts_at?: string
          status?: Database["public"]["Enums"]["curated_stage_status"]
          title?: string
          turn_seconds?: number
          type?: Database["public"]["Enums"]["curated_stage_type"]
          updated_at?: string
          vibe_tags?: string[] | null
          visibility?: string
        }
        Relationships: []
      }
      custom_project_requests: {
        Row: {
          budget_range: string | null
          created_at: string
          creator_id: string
          description: string
          id: string
          project_type: string | null
          requester_id: string
          status: string
          timeline: string | null
          updated_at: string
        }
        Insert: {
          budget_range?: string | null
          created_at?: string
          creator_id: string
          description: string
          id?: string
          project_type?: string | null
          requester_id: string
          status?: string
          timeline?: string | null
          updated_at?: string
        }
        Update: {
          budget_range?: string | null
          created_at?: string
          creator_id?: string
          description?: string
          id?: string
          project_type?: string | null
          requester_id?: string
          status?: string
          timeline?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      daily_streaks: {
        Row: {
          created_at: string
          current_streak: number
          id: string
          last_action_date: string | null
          longest_streak: number
          streak_type: string
          total_actions: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_streak?: number
          id?: string
          last_action_date?: string | null
          longest_streak?: number
          streak_type: string
          total_actions?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_streak?: number
          id?: string
          last_action_date?: string | null
          longest_streak?: number
          streak_type?: string
          total_actions?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      deal_memos: {
        Row: {
          application_id: string
          created_at: string
          creator_signed_at: string | null
          creator_user_id: string
          deadline: string | null
          deliverables: string | null
          id: string
          notes: string | null
          opportunity_id: string
          pdf_path: string | null
          poster_signed_at: string | null
          poster_user_id: string
          rate_amount: number | null
          rate_currency: string | null
          rate_unit: string | null
          status: string
          title: string
          updated_at: string
          usage_duration: string | null
          usage_exclusive: boolean | null
          usage_territory: string | null
          usage_type: string | null
        }
        Insert: {
          application_id: string
          created_at?: string
          creator_signed_at?: string | null
          creator_user_id: string
          deadline?: string | null
          deliverables?: string | null
          id?: string
          notes?: string | null
          opportunity_id: string
          pdf_path?: string | null
          poster_signed_at?: string | null
          poster_user_id: string
          rate_amount?: number | null
          rate_currency?: string | null
          rate_unit?: string | null
          status?: string
          title: string
          updated_at?: string
          usage_duration?: string | null
          usage_exclusive?: boolean | null
          usage_territory?: string | null
          usage_type?: string | null
        }
        Update: {
          application_id?: string
          created_at?: string
          creator_signed_at?: string | null
          creator_user_id?: string
          deadline?: string | null
          deliverables?: string | null
          id?: string
          notes?: string | null
          opportunity_id?: string
          pdf_path?: string | null
          poster_signed_at?: string | null
          poster_user_id?: string
          rate_amount?: number | null
          rate_currency?: string | null
          rate_unit?: string | null
          status?: string
          title?: string
          updated_at?: string
          usage_duration?: string | null
          usage_exclusive?: boolean | null
          usage_territory?: string | null
          usage_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deal_memos_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: true
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_memos_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: true
            referencedRelation: "user_applications_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_memos_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      deleted_credits: {
        Row: {
          deleted_at: string
          id: string
          project_name_lower: string
          role_lower: string
          user_id: string
        }
        Insert: {
          deleted_at?: string
          id?: string
          project_name_lower: string
          role_lower: string
          user_id: string
        }
        Update: {
          deleted_at?: string
          id?: string
          project_name_lower?: string
          role_lower?: string
          user_id?: string
        }
        Relationships: []
      }
      deliverable_comments: {
        Row: {
          annotation_x: number | null
          annotation_y: number | null
          content: string
          created_at: string
          deliverable_id: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          annotation_x?: number | null
          annotation_y?: number | null
          content: string
          created_at?: string
          deliverable_id: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          annotation_x?: number | null
          annotation_y?: number | null
          content?: string
          created_at?: string
          deliverable_id?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deliverable_comments_deliverable_id_fkey"
            columns: ["deliverable_id"]
            isOneToOne: false
            referencedRelation: "project_deliverables"
            referencedColumns: ["id"]
          },
        ]
      }
      deliverable_versions: {
        Row: {
          change_note: string | null
          created_at: string
          deliverable_id: string
          file_url: string
          id: string
          thumbnail_url: string | null
          uploaded_by: string
          version: number
        }
        Insert: {
          change_note?: string | null
          created_at?: string
          deliverable_id: string
          file_url: string
          id?: string
          thumbnail_url?: string | null
          uploaded_by: string
          version: number
        }
        Update: {
          change_note?: string | null
          created_at?: string
          deliverable_id?: string
          file_url?: string
          id?: string
          thumbnail_url?: string | null
          uploaded_by?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "deliverable_versions_deliverable_id_fkey"
            columns: ["deliverable_id"]
            isOneToOne: false
            referencedRelation: "project_deliverables"
            referencedColumns: ["id"]
          },
        ]
      }
      desk_ai_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          metadata: Json | null
          project_id: string
          role: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          metadata?: Json | null
          project_id: string
          role: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          project_id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      desk_ai_usage: {
        Row: {
          created_at: string
          id: string
          message_count: number
          updated_at: string
          usage_date: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message_count?: number
          updated_at?: string
          usage_date?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message_count?: number
          updated_at?: string
          usage_date?: string
          user_id?: string
        }
        Relationships: []
      }
      digital_product_purchases: {
        Row: {
          amount: number
          buyer_id: string
          currency: string | null
          download_urls: string[] | null
          id: string
          payment_intent_id: string | null
          payment_status: string | null
          product_id: string
          purchased_at: string | null
          seller_id: string
        }
        Insert: {
          amount: number
          buyer_id: string
          currency?: string | null
          download_urls?: string[] | null
          id?: string
          payment_intent_id?: string | null
          payment_status?: string | null
          product_id: string
          purchased_at?: string | null
          seller_id: string
        }
        Update: {
          amount?: number
          buyer_id?: string
          currency?: string | null
          download_urls?: string[] | null
          id?: string
          payment_intent_id?: string | null
          payment_status?: string | null
          product_id?: string
          purchased_at?: string | null
          seller_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "digital_product_purchases_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "digital_products"
            referencedColumns: ["id"]
          },
        ]
      }
      digital_product_reviews: {
        Row: {
          created_at: string | null
          id: string
          product_id: string
          rating: number
          review_text: string | null
          reviewer_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          product_id: string
          rating: number
          review_text?: string | null
          reviewer_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          product_id?: string
          rating?: number
          review_text?: string | null
          reviewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "digital_product_reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "digital_products"
            referencedColumns: ["id"]
          },
        ]
      }
      digital_products: {
        Row: {
          availability_info: string | null
          average_rating: number | null
          category: string | null
          condition: string | null
          created_at: string | null
          currency: string | null
          demo_url: string | null
          description: string | null
          download_count: number | null
          file_urls: string[] | null
          id: string
          is_active: boolean | null
          is_virtual: boolean | null
          item_location: string | null
          license_type: string | null
          listing_type: string
          pickup_location: string | null
          preview_urls: string[] | null
          price: number
          product_type: string
          review_count: number | null
          service_duration: string | null
          service_format: string | null
          shipping_method: string | null
          shipping_price: number | null
          tags: string[] | null
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          availability_info?: string | null
          average_rating?: number | null
          category?: string | null
          condition?: string | null
          created_at?: string | null
          currency?: string | null
          demo_url?: string | null
          description?: string | null
          download_count?: number | null
          file_urls?: string[] | null
          id?: string
          is_active?: boolean | null
          is_virtual?: boolean | null
          item_location?: string | null
          license_type?: string | null
          listing_type?: string
          pickup_location?: string | null
          preview_urls?: string[] | null
          price: number
          product_type: string
          review_count?: number | null
          service_duration?: string | null
          service_format?: string | null
          shipping_method?: string | null
          shipping_price?: number | null
          tags?: string[] | null
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          availability_info?: string | null
          average_rating?: number | null
          category?: string | null
          condition?: string | null
          created_at?: string | null
          currency?: string | null
          demo_url?: string | null
          description?: string | null
          download_count?: number | null
          file_urls?: string[] | null
          id?: string
          is_active?: boolean | null
          is_virtual?: boolean | null
          item_location?: string | null
          license_type?: string | null
          listing_type?: string
          pickup_location?: string | null
          preview_urls?: string[] | null
          price?: number
          product_type?: string
          review_count?: number | null
          service_duration?: string | null
          service_format?: string | null
          shipping_method?: string | null
          shipping_price?: number | null
          tags?: string[] | null
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      direct_video_calls: {
        Row: {
          duration_seconds: number | null
          ended_at: string | null
          id: string
          invited_user_id: string | null
          missed_at: string | null
          participants: Json
          recording_id: string | null
          room_name: string
          room_url: string
          started_at: string
          started_by: string
          was_missed: boolean
        }
        Insert: {
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          invited_user_id?: string | null
          missed_at?: string | null
          participants?: Json
          recording_id?: string | null
          room_name: string
          room_url: string
          started_at?: string
          started_by: string
          was_missed?: boolean
        }
        Update: {
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          invited_user_id?: string | null
          missed_at?: string | null
          participants?: Json
          recording_id?: string | null
          room_name?: string
          room_url?: string
          started_at?: string
          started_by?: string
          was_missed?: boolean
        }
        Relationships: []
      }
      discovered_credits: {
        Row: {
          ai_confidence: number | null
          approved_at: string | null
          approved_credit_id: string | null
          created_at: string
          credit_category: string | null
          description: string | null
          dismissed_at: string | null
          id: string
          platform: string | null
          project_name: string
          role: string | null
          scan_id: string | null
          source: string | null
          source_snippet: string | null
          status: string
          thumbnail_url: string | null
          updated_at: string
          url: string | null
          user_id: string
          year: number | null
        }
        Insert: {
          ai_confidence?: number | null
          approved_at?: string | null
          approved_credit_id?: string | null
          created_at?: string
          credit_category?: string | null
          description?: string | null
          dismissed_at?: string | null
          id?: string
          platform?: string | null
          project_name: string
          role?: string | null
          scan_id?: string | null
          source?: string | null
          source_snippet?: string | null
          status?: string
          thumbnail_url?: string | null
          updated_at?: string
          url?: string | null
          user_id: string
          year?: number | null
        }
        Update: {
          ai_confidence?: number | null
          approved_at?: string | null
          approved_credit_id?: string | null
          created_at?: string
          credit_category?: string | null
          description?: string | null
          dismissed_at?: string | null
          id?: string
          platform?: string | null
          project_name?: string
          role?: string | null
          scan_id?: string | null
          source?: string | null
          source_snippet?: string | null
          status?: string
          thumbnail_url?: string | null
          updated_at?: string
          url?: string | null
          user_id?: string
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "discovered_credits_approved_credit_id_fkey"
            columns: ["approved_credit_id"]
            isOneToOne: false
            referencedRelation: "credits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discovered_credits_scan_id_fkey"
            columns: ["scan_id"]
            isOneToOne: false
            referencedRelation: "discovery_scans"
            referencedColumns: ["id"]
          },
        ]
      }
      discovery_scans: {
        Row: {
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          new_awards: number
          new_credits: number
          new_press: number
          new_uploads: number
          query_used: string | null
          started_at: string
          status: string
          total_candidates: number
          trigger_source: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          new_awards?: number
          new_credits?: number
          new_press?: number
          new_uploads?: number
          query_used?: string | null
          started_at?: string
          status?: string
          total_candidates?: number
          trigger_source?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          new_awards?: number
          new_credits?: number
          new_press?: number
          new_uploads?: number
          query_used?: string | null
          started_at?: string
          status?: string
          total_candidates?: number
          trigger_source?: string
          user_id?: string
        }
        Relationships: []
      }
      drip_campaign_sends: {
        Row: {
          campaign_id: string
          contact_id: string
          error_message: string | null
          id: string
          sent_at: string | null
          status: string
        }
        Insert: {
          campaign_id: string
          contact_id: string
          error_message?: string | null
          id?: string
          sent_at?: string | null
          status?: string
        }
        Update: {
          campaign_id?: string
          contact_id?: string
          error_message?: string | null
          id?: string
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "drip_campaign_sends_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "drip_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drip_campaign_sends_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "email_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      drip_campaigns: {
        Row: {
          body: string
          created_at: string
          cta_text: string
          cta_url: string
          daily_limit: number
          failed_count: number
          id: string
          last_batch_at: string | null
          segment_id: string | null
          sent_count: number
          status: string
          subject: string
          total_contacts: number
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          cta_text?: string
          cta_url?: string
          daily_limit?: number
          failed_count?: number
          id?: string
          last_batch_at?: string | null
          segment_id?: string | null
          sent_count?: number
          status?: string
          subject: string
          total_contacts?: number
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          cta_text?: string
          cta_url?: string
          daily_limit?: number
          failed_count?: number
          id?: string
          last_batch_at?: string | null
          segment_id?: string | null
          sent_count?: number
          status?: string
          subject?: string
          total_contacts?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "drip_campaigns_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "email_segments"
            referencedColumns: ["id"]
          },
        ]
      }
      email_campaigns: {
        Row: {
          body: string
          click_count: number
          created_at: string
          failed_count: number
          id: string
          name: string
          open_count: number
          scheduled_for: string | null
          sent_at: string | null
          sent_count: number
          status: string
          subject: string
          total_recipients: number
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          click_count?: number
          created_at?: string
          failed_count?: number
          id?: string
          name: string
          open_count?: number
          scheduled_for?: string | null
          sent_at?: string | null
          sent_count?: number
          status?: string
          subject: string
          total_recipients?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          click_count?: number
          created_at?: string
          failed_count?: number
          id?: string
          name?: string
          open_count?: number
          scheduled_for?: string | null
          sent_at?: string | null
          sent_count?: number
          status?: string
          subject?: string
          total_recipients?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      email_contacts: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string | null
          segment_id: string
          status: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          name?: string | null
          segment_id: string
          status?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string | null
          segment_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_contacts_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "email_segments"
            referencedColumns: ["id"]
          },
        ]
      }
      email_segments: {
        Row: {
          contact_count: number
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          contact_count?: number
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          contact_count?: number
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_templates: {
        Row: {
          body: string
          category: string | null
          created_at: string
          id: string
          name: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          category?: string | null
          created_at?: string
          id?: string
          name: string
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          category?: string | null
          created_at?: string
          id?: string
          name?: string
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      email_unsubscribes: {
        Row: {
          email: string
          id: string
          reason: string | null
          sender_id: string
          unsubscribed_at: string
        }
        Insert: {
          email: string
          id?: string
          reason?: string | null
          sender_id: string
          unsubscribed_at?: string
        }
        Update: {
          email?: string
          id?: string
          reason?: string | null
          sender_id?: string
          unsubscribed_at?: string
        }
        Relationships: []
      }
      ep_daily_briefings: {
        Row: {
          brief_date: string
          created_at: string
          followup_count: number
          generated_by: string
          id: string
          risk_count: number
          sections: Json
          summary: string | null
          task_count: number
          user_id: string
        }
        Insert: {
          brief_date: string
          created_at?: string
          followup_count?: number
          generated_by?: string
          id?: string
          risk_count?: number
          sections?: Json
          summary?: string | null
          task_count?: number
          user_id: string
        }
        Update: {
          brief_date?: string
          created_at?: string
          followup_count?: number
          generated_by?: string
          id?: string
          risk_count?: number
          sections?: Json
          summary?: string | null
          task_count?: number
          user_id?: string
        }
        Relationships: []
      }
      episode_clips: {
        Row: {
          captions: Json | null
          created_at: string
          created_by: string
          end_seconds: number | null
          episode_id: string
          hashtags: string[] | null
          id: string
          project_id: string
          start_seconds: number | null
          title: string
          transcript_excerpt: string | null
        }
        Insert: {
          captions?: Json | null
          created_at?: string
          created_by: string
          end_seconds?: number | null
          episode_id: string
          hashtags?: string[] | null
          id?: string
          project_id: string
          start_seconds?: number | null
          title: string
          transcript_excerpt?: string | null
        }
        Update: {
          captions?: Json | null
          created_at?: string
          created_by?: string
          end_seconds?: number | null
          episode_id?: string
          hashtags?: string[] | null
          id?: string
          project_id?: string
          start_seconds?: number | null
          title?: string
          transcript_excerpt?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "episode_clips_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "podcast_episodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "episode_clips_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      episode_sponsors: {
        Row: {
          amount: number | null
          contact_email: string | null
          created_at: string
          created_by: string
          currency: string | null
          episode_id: string
          id: string
          notes: string | null
          project_id: string
          sponsor_name: string
          status: string
          updated_at: string
        }
        Insert: {
          amount?: number | null
          contact_email?: string | null
          created_at?: string
          created_by: string
          currency?: string | null
          episode_id: string
          id?: string
          notes?: string | null
          project_id: string
          sponsor_name: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number | null
          contact_email?: string | null
          created_at?: string
          created_by?: string
          currency?: string | null
          episode_id?: string
          id?: string
          notes?: string | null
          project_id?: string
          sponsor_name?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "episode_sponsors_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "podcast_episodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "episode_sponsors_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      epk_refresh_suggestions: {
        Row: {
          applied_at: string | null
          created_at: string
          current_value: string | null
          id: string
          kind: string
          reason: string | null
          status: string
          suggested_value: string | null
          trigger_event: string | null
          user_id: string
        }
        Insert: {
          applied_at?: string | null
          created_at?: string
          current_value?: string | null
          id?: string
          kind: string
          reason?: string | null
          status?: string
          suggested_value?: string | null
          trigger_event?: string | null
          user_id: string
        }
        Update: {
          applied_at?: string | null
          created_at?: string
          current_value?: string | null
          id?: string
          kind?: string
          reason?: string | null
          status?: string
          suggested_value?: string | null
          trigger_event?: string | null
          user_id?: string
        }
        Relationships: []
      }
      event_analytics_events: {
        Row: {
          created_at: string
          event_id: string
          event_type: string
          id: string
          metadata: Json
          source: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_id: string
          event_type: string
          id?: string
          metadata?: Json
          source?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_id?: string
          event_type?: string
          id?: string
          metadata?: Json
          source?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_analytics_events_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "creative_jams"
            referencedColumns: ["id"]
          },
        ]
      }
      event_blast_recipients: {
        Row: {
          blast_id: string
          clicked_at: string | null
          created_at: string
          email: string
          error_message: string | null
          id: string
          opened_at: string | null
          sent_at: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          blast_id: string
          clicked_at?: string | null
          created_at?: string
          email: string
          error_message?: string | null
          id?: string
          opened_at?: string | null
          sent_at?: string | null
          status?: string
          user_id?: string | null
        }
        Update: {
          blast_id?: string
          clicked_at?: string | null
          created_at?: string
          email?: string
          error_message?: string | null
          id?: string
          opened_at?: string | null
          sent_at?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_blast_recipients_blast_id_fkey"
            columns: ["blast_id"]
            isOneToOne: false
            referencedRelation: "event_blasts"
            referencedColumns: ["id"]
          },
        ]
      }
      event_blasts: {
        Row: {
          body_html: string
          body_text: string | null
          clicked_count: number
          created_at: string
          created_by: string
          delivered_count: number
          event_id: string
          failed_count: number
          id: string
          metadata: Json
          opened_count: number
          recipient_count: number
          scheduled_for: string | null
          segment: string
          sent_at: string | null
          status: string
          subject: string
          template: string
          updated_at: string
        }
        Insert: {
          body_html: string
          body_text?: string | null
          clicked_count?: number
          created_at?: string
          created_by: string
          delivered_count?: number
          event_id: string
          failed_count?: number
          id?: string
          metadata?: Json
          opened_count?: number
          recipient_count?: number
          scheduled_for?: string | null
          segment?: string
          sent_at?: string | null
          status?: string
          subject: string
          template?: string
          updated_at?: string
        }
        Update: {
          body_html?: string
          body_text?: string | null
          clicked_count?: number
          created_at?: string
          created_by?: string
          delivered_count?: number
          event_id?: string
          failed_count?: number
          id?: string
          metadata?: Json
          opened_count?: number
          recipient_count?: number
          scheduled_for?: string | null
          segment?: string
          sent_at?: string | null
          status?: string
          subject?: string
          template?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_blasts_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "creative_jams"
            referencedColumns: ["id"]
          },
        ]
      }
      event_co_hosts: {
        Row: {
          accepted_at: string | null
          created_at: string
          event_id: string
          id: string
          invited_by: string
          revenue_share_pct: number | null
          user_id: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          event_id: string
          id?: string
          invited_by: string
          revenue_share_pct?: number | null
          user_id: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          event_id?: string
          id?: string
          invited_by?: string
          revenue_share_pct?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_co_hosts_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "creative_jams"
            referencedColumns: ["id"]
          },
        ]
      }
      event_cohosts: {
        Row: {
          added_by: string
          created_at: string
          event_id: string
          id: string
          user_id: string
        }
        Insert: {
          added_by: string
          created_at?: string
          event_id: string
          id?: string
          user_id: string
        }
        Update: {
          added_by?: string
          created_at?: string
          event_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_cohosts_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "creative_jams"
            referencedColumns: ["id"]
          },
        ]
      }
      event_comments: {
        Row: {
          content: string
          created_at: string
          event_id: string
          id: string
          image_url: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          event_id: string
          id?: string
          image_url?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          event_id?: string
          id?: string
          image_url?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_comments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "creative_jams"
            referencedColumns: ["id"]
          },
        ]
      }
      event_feedback: {
        Row: {
          comment: string | null
          created_at: string
          event_id: string
          id: string
          is_public: boolean
          rating: number
          updated_at: string
          user_id: string
          would_recommend: boolean | null
        }
        Insert: {
          comment?: string | null
          created_at?: string
          event_id: string
          id?: string
          is_public?: boolean
          rating: number
          updated_at?: string
          user_id: string
          would_recommend?: boolean | null
        }
        Update: {
          comment?: string | null
          created_at?: string
          event_id?: string
          id?: string
          is_public?: boolean
          rating?: number
          updated_at?: string
          user_id?: string
          would_recommend?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "event_feedback_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "creative_jams"
            referencedColumns: ["id"]
          },
        ]
      }
      event_guest_matches: {
        Row: {
          created_at: string
          event_id: string
          id: string
          reasons: Json
          score: number
          shared_interests: Json
          updated_at: string
          user_a: string
          user_b: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          reasons?: Json
          score?: number
          shared_interests?: Json
          updated_at?: string
          user_a: string
          user_b: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          reasons?: Json
          score?: number
          shared_interests?: Json
          updated_at?: string
          user_a?: string
          user_b?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_guest_matches_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "creative_jams"
            referencedColumns: ["id"]
          },
        ]
      }
      event_host_stats: {
        Row: {
          avg_attendance_pct: number
          avg_rating: number
          avg_response_hours: number | null
          events_completed: number
          events_hosted: number
          is_verified_host: boolean
          rating_count: number
          total_attendees: number
          updated_at: string
          user_id: string
        }
        Insert: {
          avg_attendance_pct?: number
          avg_rating?: number
          avg_response_hours?: number | null
          events_completed?: number
          events_hosted?: number
          is_verified_host?: boolean
          rating_count?: number
          total_attendees?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          avg_attendance_pct?: number
          avg_rating?: number
          avg_response_hours?: number | null
          events_completed?: number
          events_hosted?: number
          is_verified_host?: boolean
          rating_count?: number
          total_attendees?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      event_orders: {
        Row: {
          buyer_email: string
          buyer_id: string
          buyer_name: string | null
          created_at: string
          currency: string
          discount_amount: number
          event_id: string
          id: string
          metadata: Json
          platform_fee: number
          promo_code_id: string | null
          quantity: number
          refund_amount: number | null
          refunded_at: string | null
          status: string
          stripe_payment_intent_id: string | null
          stripe_session_id: string | null
          subtotal: number
          tier_id: string | null
          total_amount: number
          unit_price: number
          updated_at: string
        }
        Insert: {
          buyer_email: string
          buyer_id: string
          buyer_name?: string | null
          created_at?: string
          currency?: string
          discount_amount?: number
          event_id: string
          id?: string
          metadata?: Json
          platform_fee?: number
          promo_code_id?: string | null
          quantity?: number
          refund_amount?: number | null
          refunded_at?: string | null
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          subtotal: number
          tier_id?: string | null
          total_amount: number
          unit_price: number
          updated_at?: string
        }
        Update: {
          buyer_email?: string
          buyer_id?: string
          buyer_name?: string | null
          created_at?: string
          currency?: string
          discount_amount?: number
          event_id?: string
          id?: string
          metadata?: Json
          platform_fee?: number
          promo_code_id?: string | null
          quantity?: number
          refund_amount?: number | null
          refunded_at?: string | null
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          subtotal?: number
          tier_id?: string | null
          total_amount?: number
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_orders_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "creative_jams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_orders_promo_code_id_fkey"
            columns: ["promo_code_id"]
            isOneToOne: false
            referencedRelation: "event_promo_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_orders_tier_id_fkey"
            columns: ["tier_id"]
            isOneToOne: false
            referencedRelation: "event_ticket_tiers"
            referencedColumns: ["id"]
          },
        ]
      }
      event_photos: {
        Row: {
          caption: string | null
          created_at: string
          event_id: string
          id: string
          image_url: string
          user_id: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          event_id: string
          id?: string
          image_url: string
          user_id: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          event_id?: string
          id?: string
          image_url?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_photos_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "creative_jams"
            referencedColumns: ["id"]
          },
        ]
      }
      event_promo_codes: {
        Row: {
          applies_to_tier_ids: string[] | null
          code: string
          created_at: string
          discount_type: string
          discount_value: number
          event_id: string
          id: string
          is_active: boolean
          max_uses: number | null
          updated_at: string
          uses_count: number
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          applies_to_tier_ids?: string[] | null
          code: string
          created_at?: string
          discount_type?: string
          discount_value: number
          event_id: string
          id?: string
          is_active?: boolean
          max_uses?: number | null
          updated_at?: string
          uses_count?: number
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          applies_to_tier_ids?: string[] | null
          code?: string
          created_at?: string
          discount_type?: string
          discount_value?: number
          event_id?: string
          id?: string
          is_active?: boolean
          max_uses?: number | null
          updated_at?: string
          uses_count?: number
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_promo_codes_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "creative_jams"
            referencedColumns: ["id"]
          },
        ]
      }
      event_promoter_rewards: {
        Row: {
          awarded_at: string | null
          checked_in: boolean
          created_at: string
          credits_awarded: number
          event_id: string
          id: string
          promoter_user_id: string
          referred_user_id: string
        }
        Insert: {
          awarded_at?: string | null
          checked_in?: boolean
          created_at?: string
          credits_awarded?: number
          event_id: string
          id?: string
          promoter_user_id: string
          referred_user_id: string
        }
        Update: {
          awarded_at?: string | null
          checked_in?: boolean
          created_at?: string
          credits_awarded?: number
          event_id?: string
          id?: string
          promoter_user_id?: string
          referred_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_promoter_rewards_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "creative_jams"
            referencedColumns: ["id"]
          },
        ]
      }
      event_recap_drafts: {
        Row: {
          created_at: string
          event_id: string
          generated_at: string
          highlight_suggestions: Json | null
          id: string
          project_id: string | null
          recap_caption: string | null
          sponsor_recap_md: string | null
          status: string
          thank_you_drafts: Json | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          event_id: string
          generated_at?: string
          highlight_suggestions?: Json | null
          id?: string
          project_id?: string | null
          recap_caption?: string | null
          sponsor_recap_md?: string | null
          status?: string
          thank_you_drafts?: Json | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          event_id?: string
          generated_at?: string
          highlight_suggestions?: Json | null
          id?: string
          project_id?: string | null
          recap_caption?: string | null
          sponsor_recap_md?: string | null
          status?: string
          thank_you_drafts?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_recap_drafts_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "creative_jams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_recap_drafts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      event_reminders_sent: {
        Row: {
          channel: string
          event_id: string
          id: string
          reminder_type: string
          sent_at: string
          user_id: string
        }
        Insert: {
          channel: string
          event_id: string
          id?: string
          reminder_type: string
          sent_at?: string
          user_id: string
        }
        Update: {
          channel?: string
          event_id?: string
          id?: string
          reminder_type?: string
          sent_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_reminders_sent_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "creative_jams"
            referencedColumns: ["id"]
          },
        ]
      }
      event_rsvp_answers: {
        Row: {
          answer: Json
          created_at: string
          event_id: string
          guest_email: string | null
          id: string
          question_id: string
          user_id: string | null
        }
        Insert: {
          answer: Json
          created_at?: string
          event_id: string
          guest_email?: string | null
          id?: string
          question_id: string
          user_id?: string | null
        }
        Update: {
          answer?: Json
          created_at?: string
          event_id?: string
          guest_email?: string | null
          id?: string
          question_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_rsvp_answers_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "creative_jams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_rsvp_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "event_rsvp_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      event_rsvp_questions: {
        Row: {
          created_at: string
          created_by: string
          event_id: string
          id: string
          options: Json
          position: number
          question: string
          question_type: string
          required: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          event_id: string
          id?: string
          options?: Json
          position?: number
          question: string
          question_type?: string
          required?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          event_id?: string
          id?: string
          options?: Json
          position?: number
          question?: string
          question_type?: string
          required?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_rsvp_questions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "creative_jams"
            referencedColumns: ["id"]
          },
        ]
      }
      event_runsheet_items: {
        Row: {
          created_at: string
          created_by: string
          end_time: string | null
          id: string
          notes: string | null
          owner_name: string | null
          position: number
          project_id: string
          start_time: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          end_time?: string | null
          id?: string
          notes?: string | null
          owner_name?: string | null
          position?: number
          project_id: string
          start_time?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          end_time?: string | null
          id?: string
          notes?: string | null
          owner_name?: string | null
          position?: number
          project_id?: string
          start_time?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_runsheet_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      event_seating_assignments: {
        Row: {
          created_at: string
          event_id: string
          guest_email: string | null
          guest_name: string | null
          id: string
          layout_id: string
          seat_index: number | null
          table_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_id: string
          guest_email?: string | null
          guest_name?: string | null
          id?: string
          layout_id: string
          seat_index?: number | null
          table_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_id?: string
          guest_email?: string | null
          guest_name?: string | null
          id?: string
          layout_id?: string
          seat_index?: number | null
          table_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_seating_assignments_layout_id_fkey"
            columns: ["layout_id"]
            isOneToOne: false
            referencedRelation: "event_seating_layouts"
            referencedColumns: ["id"]
          },
        ]
      }
      event_seating_layouts: {
        Row: {
          created_at: string
          created_by: string
          event_id: string
          id: string
          name: string
          notes: string | null
          tables: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          event_id: string
          id?: string
          name?: string
          notes?: string | null
          tables?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          event_id?: string
          id?: string
          name?: string
          notes?: string | null
          tables?: Json
          updated_at?: string
        }
        Relationships: []
      }
      event_share_clicks: {
        Row: {
          channel: string
          converted_to_rsvp: boolean
          created_at: string
          event_id: string
          id: string
          referrer_user_id: string | null
          visitor_session: string | null
        }
        Insert: {
          channel?: string
          converted_to_rsvp?: boolean
          created_at?: string
          event_id: string
          id?: string
          referrer_user_id?: string | null
          visitor_session?: string | null
        }
        Update: {
          channel?: string
          converted_to_rsvp?: boolean
          created_at?: string
          event_id?: string
          id?: string
          referrer_user_id?: string | null
          visitor_session?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_share_clicks_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "creative_jams"
            referencedColumns: ["id"]
          },
        ]
      }
      event_sponsors: {
        Row: {
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          created_by: string
          deliverables: string | null
          id: string
          name: string
          notes: string | null
          package_currency: string | null
          package_value: number | null
          position: number
          project_id: string
          status: string
          tier: string | null
          updated_at: string
        }
        Insert: {
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by: string
          deliverables?: string | null
          id?: string
          name: string
          notes?: string | null
          package_currency?: string | null
          package_value?: number | null
          position?: number
          project_id: string
          status?: string
          tier?: string | null
          updated_at?: string
        }
        Update: {
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string
          deliverables?: string | null
          id?: string
          name?: string
          notes?: string | null
          package_currency?: string | null
          package_value?: number | null
          position?: number
          project_id?: string
          status?: string
          tier?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_sponsors_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      event_suppliers: {
        Row: {
          category: string
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          created_by: string
          fee_amount: number | null
          fee_currency: string | null
          id: string
          linked_user_id: string | null
          name: string
          notes: string | null
          project_id: string
          status: string
          updated_at: string
        }
        Insert: {
          category?: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by: string
          fee_amount?: number | null
          fee_currency?: string | null
          id?: string
          linked_user_id?: string | null
          name: string
          notes?: string | null
          project_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          category?: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string
          fee_amount?: number | null
          fee_currency?: string | null
          id?: string
          linked_user_id?: string | null
          name?: string
          notes?: string | null
          project_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_suppliers_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      event_talent: {
        Row: {
          call_time: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          created_by: string
          fee_amount: number | null
          fee_currency: string | null
          id: string
          linked_user_id: string | null
          name: string
          notes: string | null
          project_id: string
          role: string
          status: string
          updated_at: string
        }
        Insert: {
          call_time?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by: string
          fee_amount?: number | null
          fee_currency?: string | null
          id?: string
          linked_user_id?: string | null
          name: string
          notes?: string | null
          project_id: string
          role?: string
          status?: string
          updated_at?: string
        }
        Update: {
          call_time?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string
          fee_amount?: number | null
          fee_currency?: string | null
          id?: string
          linked_user_id?: string | null
          name?: string
          notes?: string | null
          project_id?: string
          role?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_talent_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      event_ticket_tiers: {
        Row: {
          created_at: string
          currency: string
          description: string | null
          display_order: number
          event_id: string
          id: string
          is_hidden: boolean
          max_per_order: number
          min_per_order: number
          name: string
          price: number
          quantity_sold: number
          quantity_total: number | null
          sale_ends_at: string | null
          sale_starts_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          description?: string | null
          display_order?: number
          event_id: string
          id?: string
          is_hidden?: boolean
          max_per_order?: number
          min_per_order?: number
          name: string
          price?: number
          quantity_sold?: number
          quantity_total?: number | null
          sale_ends_at?: string | null
          sale_starts_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          description?: string | null
          display_order?: number
          event_id?: string
          id?: string
          is_hidden?: boolean
          max_per_order?: number
          min_per_order?: number
          name?: string
          price?: number
          quantity_sold?: number
          quantity_total?: number | null
          sale_ends_at?: string | null
          sale_starts_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_ticket_tiers_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "creative_jams"
            referencedColumns: ["id"]
          },
        ]
      }
      event_waitlist: {
        Row: {
          created_at: string
          event_id: string
          expires_at: string | null
          id: string
          offered_at: string | null
          position: number
          status: string
          tier_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          expires_at?: string | null
          id?: string
          offered_at?: string | null
          position: number
          status?: string
          tier_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          expires_at?: string | null
          id?: string
          offered_at?: string | null
          position?: number
          status?: string
          tier_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_waitlist_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "creative_jams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_waitlist_tier_id_fkey"
            columns: ["tier_id"]
            isOneToOne: false
            referencedRelation: "event_ticket_tiers"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          category: string
          created_at: string | null
          currency: string
          date: string
          id: string
          is_recurring: boolean | null
          notes: string | null
          payment_method: string | null
          project_id: string | null
          receipt_url: string | null
          recurring_interval: string | null
          status: string
          subcategory: string | null
          tags: string[] | null
          tax_deductible: boolean | null
          title: string
          updated_at: string | null
          user_id: string
          vendor: string | null
        }
        Insert: {
          amount: number
          category?: string
          created_at?: string | null
          currency?: string
          date?: string
          id?: string
          is_recurring?: boolean | null
          notes?: string | null
          payment_method?: string | null
          project_id?: string | null
          receipt_url?: string | null
          recurring_interval?: string | null
          status?: string
          subcategory?: string | null
          tags?: string[] | null
          tax_deductible?: boolean | null
          title: string
          updated_at?: string | null
          user_id: string
          vendor?: string | null
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string | null
          currency?: string
          date?: string
          id?: string
          is_recurring?: boolean | null
          notes?: string | null
          payment_method?: string | null
          project_id?: string | null
          receipt_url?: string | null
          recurring_interval?: string | null
          status?: string
          subcategory?: string | null
          tags?: string[] | null
          tax_deductible?: boolean | null
          title?: string
          updated_at?: string | null
          user_id?: string
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      face_verification_attempts: {
        Row: {
          confidence: number | null
          consumed_at: string | null
          created_at: string
          token: string
          verified: boolean
        }
        Insert: {
          confidence?: number | null
          consumed_at?: string | null
          created_at?: string
          token?: string
          verified: boolean
        }
        Update: {
          confidence?: number | null
          consumed_at?: string | null
          created_at?: string
          token?: string
          verified?: boolean
        }
        Relationships: []
      }
      feed_clips: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feed_clips_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "feed_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          post_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          post_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          post_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feed_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "feed_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_posts: {
        Row: {
          auto_activity_message: string | null
          category: string | null
          content: string | null
          created_at: string
          id: string
          is_ai_generated: boolean | null
          is_portfolio_item: boolean | null
          link_title: string | null
          link_url: string | null
          media_type: string | null
          media_urls: Json | null
          portfolio_item_id: string | null
          post_type: string
          prompt_id: string | null
          source_id: string | null
          source_type: string | null
          tags: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_activity_message?: string | null
          category?: string | null
          content?: string | null
          created_at?: string
          id?: string
          is_ai_generated?: boolean | null
          is_portfolio_item?: boolean | null
          link_title?: string | null
          link_url?: string | null
          media_type?: string | null
          media_urls?: Json | null
          portfolio_item_id?: string | null
          post_type?: string
          prompt_id?: string | null
          source_id?: string | null
          source_type?: string | null
          tags?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_activity_message?: string | null
          category?: string | null
          content?: string | null
          created_at?: string
          id?: string
          is_ai_generated?: boolean | null
          is_portfolio_item?: boolean | null
          link_title?: string | null
          link_url?: string | null
          media_type?: string | null
          media_urls?: Json | null
          portfolio_item_id?: string | null
          post_type?: string
          prompt_id?: string | null
          source_id?: string | null
          source_type?: string | null
          tags?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      feed_reactions: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feed_reactions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "feed_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback: {
        Row: {
          action_taken: string | null
          admin_notes: string | null
          category: string
          created_at: string
          id: string
          message: string
          page_url: string | null
          priority: string | null
          screenshot_url: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          action_taken?: string | null
          admin_notes?: string | null
          category?: string
          created_at?: string
          id?: string
          message: string
          page_url?: string | null
          priority?: string | null
          screenshot_url?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          action_taken?: string | null
          admin_notes?: string | null
          category?: string
          created_at?: string
          id?: string
          message?: string
          page_url?: string | null
          priority?: string | null
          screenshot_url?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      file_comments: {
        Row: {
          content: string
          created_at: string
          file_id: string
          id: string
          timestamp_seconds: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          file_id: string
          id?: string
          timestamp_seconds?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          file_id?: string
          id?: string
          timestamp_seconds?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "file_comments_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "project_files"
            referencedColumns: ["id"]
          },
        ]
      }
      founder_circle_grants: {
        Row: {
          granted_at: string
          granted_by: string
          id: string
          reason: string | null
          user_id: string
        }
        Insert: {
          granted_at?: string
          granted_by: string
          id?: string
          reason?: string | null
          user_id: string
        }
        Update: {
          granted_at?: string
          granted_by?: string
          id?: string
          reason?: string | null
          user_id?: string
        }
        Relationships: []
      }
      founder_circle_purchases: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          purchased_at: string | null
          status: string
          stripe_payment_intent_id: string | null
          stripe_session_id: string | null
          user_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          purchased_at?: string | null
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          purchased_at?: string | null
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      founding_member_quests: {
        Row: {
          completed: boolean
          completed_at: string | null
          created_at: string
          id: string
          quest_key: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          id?: string
          quest_key: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          id?: string
          quest_key?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      gig_moderation_log: {
        Row: {
          action: string
          confidence: number | null
          created_at: string
          detected_deadline: string | null
          id: string
          metadata: Json | null
          opportunity_id: string
          reason: string
        }
        Insert: {
          action: string
          confidence?: number | null
          created_at?: string
          detected_deadline?: string | null
          id?: string
          metadata?: Json | null
          opportunity_id: string
          reason: string
        }
        Update: {
          action?: string
          confidence?: number | null
          created_at?: string
          detected_deadline?: string | null
          id?: string
          metadata?: Json | null
          opportunity_id?: string
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "gig_moderation_log_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_rsvps: {
        Row: {
          check_in_token: string
          checked_in_at: string | null
          claimed_at: string | null
          claimed_by_user_id: string | null
          created_at: string
          event_id: string
          guest_email: string
          guest_name: string
          id: string
          status: string
          updated_at: string
        }
        Insert: {
          check_in_token?: string
          checked_in_at?: string | null
          claimed_at?: string | null
          claimed_by_user_id?: string | null
          created_at?: string
          event_id: string
          guest_email: string
          guest_name: string
          id?: string
          status?: string
          updated_at?: string
        }
        Update: {
          check_in_token?: string
          checked_in_at?: string | null
          claimed_at?: string | null
          claimed_by_user_id?: string | null
          created_at?: string
          event_id?: string
          guest_email?: string
          guest_name?: string
          id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "guest_rsvps_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "creative_jams"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_studio_tokens: {
        Row: {
          created_at: string
          created_by: string
          expires_at: string | null
          guest_email: string | null
          guest_name: string | null
          id: string
          label: string | null
          last_seen_at: string | null
          project_id: string
          revoked_at: string | null
          token: string
        }
        Insert: {
          created_at?: string
          created_by: string
          expires_at?: string | null
          guest_email?: string | null
          guest_name?: string | null
          id?: string
          label?: string | null
          last_seen_at?: string | null
          project_id: string
          revoked_at?: string | null
          token?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          expires_at?: string | null
          guest_email?: string | null
          guest_name?: string | null
          id?: string
          label?: string | null
          last_seen_at?: string | null
          project_id?: string
          revoked_at?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "guest_studio_tokens_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_wallet_email_codes: {
        Row: {
          attempts: number
          code_hash: string
          consumed_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
        }
        Insert: {
          attempts?: number
          code_hash: string
          consumed_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
        }
        Update: {
          attempts?: number
          code_hash?: string
          consumed_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
        }
        Relationships: []
      }
      guest_wallet_sessions: {
        Row: {
          created_at: string
          expires_at: string
          last_used_at: string
          token: string
          wallet_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          last_used_at?: string
          token?: string
          wallet_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          last_used_at?: string
          token?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "guest_wallet_sessions_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "guest_wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_wallet_topups: {
        Row: {
          amount_cents: number
          created_at: string
          currency: string
          id: string
          status: string
          stripe_session_id: string | null
          updated_at: string
          wallet_id: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          currency?: string
          id?: string
          status?: string
          stripe_session_id?: string | null
          updated_at?: string
          wallet_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          currency?: string
          id?: string
          status?: string
          stripe_session_id?: string | null
          updated_at?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "guest_wallet_topups_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "guest_wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_wallet_transactions: {
        Row: {
          created_at: string
          delta_cents: number
          id: string
          kind: string
          note: string | null
          ref_id: string | null
          wallet_id: string
        }
        Insert: {
          created_at?: string
          delta_cents: number
          id?: string
          kind: string
          note?: string | null
          ref_id?: string | null
          wallet_id: string
        }
        Update: {
          created_at?: string
          delta_cents?: number
          id?: string
          kind?: string
          note?: string | null
          ref_id?: string | null
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "guest_wallet_transactions_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "guest_wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_wallets: {
        Row: {
          balance_cents: number
          created_at: string
          currency: string
          email: string
          id: string
          updated_at: string
        }
        Insert: {
          balance_cents?: number
          created_at?: string
          currency?: string
          email: string
          id?: string
          updated_at?: string
        }
        Update: {
          balance_cents?: number
          created_at?: string
          currency?: string
          email?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      icdb_brand_verifications: {
        Row: {
          brand_email: string
          brand_name: string
          created_at: string
          id: string
          notes: string | null
          project_id: string | null
          role_id: string | null
          status: string
          submitted_by: string
          verification_token: string
          verified_at: string | null
        }
        Insert: {
          brand_email: string
          brand_name: string
          created_at?: string
          id?: string
          notes?: string | null
          project_id?: string | null
          role_id?: string | null
          status?: string
          submitted_by: string
          verification_token?: string
          verified_at?: string | null
        }
        Update: {
          brand_email?: string
          brand_name?: string
          created_at?: string
          id?: string
          notes?: string | null
          project_id?: string | null
          role_id?: string | null
          status?: string
          submitted_by?: string
          verification_token?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "icdb_brand_verifications_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "icdb_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "icdb_brand_verifications_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "icdb_project_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      icdb_bulk_submissions: {
        Row: {
          company_name: string
          contact_email: string
          created_at: string
          id: string
          processed_at: string | null
          processed_count: number | null
          projects_data: Json
          status: string
          submitted_by: string
          total_count: number | null
        }
        Insert: {
          company_name: string
          contact_email: string
          created_at?: string
          id?: string
          processed_at?: string | null
          processed_count?: number | null
          projects_data?: Json
          status?: string
          submitted_by: string
          total_count?: number | null
        }
        Update: {
          company_name?: string
          contact_email?: string
          created_at?: string
          id?: string
          processed_at?: string | null
          processed_count?: number | null
          projects_data?: Json
          status?: string
          submitted_by?: string
          total_count?: number | null
        }
        Relationships: []
      }
      icdb_companies: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          industry: string | null
          location: string | null
          logo_url: string | null
          name: string
          project_count: number | null
          type: string | null
          website_url: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          industry?: string | null
          location?: string | null
          logo_url?: string | null
          name: string
          project_count?: number | null
          type?: string | null
          website_url?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          industry?: string | null
          location?: string | null
          logo_url?: string | null
          name?: string
          project_count?: number | null
          type?: string | null
          website_url?: string | null
        }
        Relationships: []
      }
      icdb_project_roles: {
        Row: {
          claimed_by: string | null
          created_at: string | null
          department: string | null
          id: string
          industry_code: string | null
          is_claimed: boolean | null
          person_name: string | null
          project_id: string
          role_title: string
        }
        Insert: {
          claimed_by?: string | null
          created_at?: string | null
          department?: string | null
          id?: string
          industry_code?: string | null
          is_claimed?: boolean | null
          person_name?: string | null
          project_id: string
          role_title: string
        }
        Update: {
          claimed_by?: string | null
          created_at?: string | null
          department?: string | null
          id?: string
          industry_code?: string | null
          is_claimed?: boolean | null
          person_name?: string | null
          project_id?: string
          role_title?: string
        }
        Relationships: [
          {
            foreignKeyName: "icdb_project_roles_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "icdb_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      icdb_projects: {
        Row: {
          category: string | null
          client_brand: string | null
          contributor_count: number | null
          cover_image_url: string | null
          created_at: string | null
          description: string | null
          external_url: string | null
          id: string
          is_verified: boolean | null
          location: string | null
          metadata: Json | null
          platform: string | null
          title: string
          type: string
          updated_at: string | null
          year: number | null
        }
        Insert: {
          category?: string | null
          client_brand?: string | null
          contributor_count?: number | null
          cover_image_url?: string | null
          created_at?: string | null
          description?: string | null
          external_url?: string | null
          id?: string
          is_verified?: boolean | null
          location?: string | null
          metadata?: Json | null
          platform?: string | null
          title: string
          type: string
          updated_at?: string | null
          year?: number | null
        }
        Update: {
          category?: string | null
          client_brand?: string | null
          contributor_count?: number | null
          cover_image_url?: string | null
          created_at?: string | null
          description?: string | null
          external_url?: string | null
          id?: string
          is_verified?: boolean | null
          location?: string | null
          metadata?: Json | null
          platform?: string | null
          title?: string
          type?: string
          updated_at?: string | null
          year?: number | null
        }
        Relationships: []
      }
      icdb_role_taxonomy: {
        Row: {
          aliases: string[] | null
          code: string
          created_at: string
          department: string
          description: string | null
          id: string
          industry: string
          title: string
        }
        Insert: {
          aliases?: string[] | null
          code: string
          created_at?: string
          department: string
          description?: string | null
          id?: string
          industry: string
          title: string
        }
        Update: {
          aliases?: string[] | null
          code?: string
          created_at?: string
          department?: string
          description?: string | null
          id?: string
          industry?: string
          title?: string
        }
        Relationships: []
      }
      import_audit_log: {
        Row: {
          action: string
          created_at: string
          destination_object_id: string | null
          destination_table: string | null
          detail: Json
          error: string | null
          id: string
          import_job_id: string
          result: string
          source_object_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          destination_object_id?: string | null
          destination_table?: string | null
          detail?: Json
          error?: string | null
          id?: string
          import_job_id: string
          result?: string
          source_object_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          destination_object_id?: string | null
          destination_table?: string | null
          detail?: Json
          error?: string | null
          id?: string
          import_job_id?: string
          result?: string
          source_object_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "import_audit_log_import_job_id_fkey"
            columns: ["import_job_id"]
            isOneToOne: false
            referencedRelation: "import_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      import_jobs: {
        Row: {
          completed_at: string | null
          connection_id: string | null
          created_at: string
          error_summary: string | null
          failed_items: number
          id: string
          preview: Json | null
          processed_items: number
          progress_percentage: number
          project_id: string | null
          provider: string
          scope_selection: Json
          skipped_items: number
          source_name: string | null
          source_type: string | null
          started_at: string | null
          status: string
          successful_items: number
          total_items: number
          updated_at: string
          upload_path: string | null
          user_id: string
          warnings: Json
        }
        Insert: {
          completed_at?: string | null
          connection_id?: string | null
          created_at?: string
          error_summary?: string | null
          failed_items?: number
          id?: string
          preview?: Json | null
          processed_items?: number
          progress_percentage?: number
          project_id?: string | null
          provider: string
          scope_selection?: Json
          skipped_items?: number
          source_name?: string | null
          source_type?: string | null
          started_at?: string | null
          status?: string
          successful_items?: number
          total_items?: number
          updated_at?: string
          upload_path?: string | null
          user_id: string
          warnings?: Json
        }
        Update: {
          completed_at?: string | null
          connection_id?: string | null
          created_at?: string
          error_summary?: string | null
          failed_items?: number
          id?: string
          preview?: Json | null
          processed_items?: number
          progress_percentage?: number
          project_id?: string | null
          provider?: string
          scope_selection?: Json
          skipped_items?: number
          source_name?: string | null
          source_type?: string | null
          started_at?: string | null
          status?: string
          successful_items?: number
          total_items?: number
          updated_at?: string
          upload_path?: string | null
          user_id?: string
          warnings?: Json
        }
        Relationships: [
          {
            foreignKeyName: "import_jobs_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "integration_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_jobs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      import_mappings: {
        Row: {
          created_at: string
          destination_field: string | null
          destination_type: string | null
          enabled: boolean
          id: string
          import_job_id: string
          source_field: string
          source_type: string
          transformation_rule: Json
          updated_at: string
          user_confirmed: boolean
        }
        Insert: {
          created_at?: string
          destination_field?: string | null
          destination_type?: string | null
          enabled?: boolean
          id?: string
          import_job_id: string
          source_field: string
          source_type: string
          transformation_rule?: Json
          updated_at?: string
          user_confirmed?: boolean
        }
        Update: {
          created_at?: string
          destination_field?: string | null
          destination_type?: string | null
          enabled?: boolean
          id?: string
          import_job_id?: string
          source_field?: string
          source_type?: string
          transformation_rule?: Json
          updated_at?: string
          user_confirmed?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "import_mappings_import_job_id_fkey"
            columns: ["import_job_id"]
            isOneToOne: false
            referencedRelation: "import_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      import_source_objects: {
        Row: {
          created_at: string
          destination_id: string | null
          destination_table: string | null
          error: string | null
          external_author_id: string | null
          external_author_name: string | null
          external_object_id: string
          external_object_type: string
          external_parent_id: string | null
          external_url: string | null
          id: string
          import_job_id: string
          import_status: string
          provider: string
          raw_metadata: Json
          source_created_at: string | null
          source_updated_at: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          destination_id?: string | null
          destination_table?: string | null
          error?: string | null
          external_author_id?: string | null
          external_author_name?: string | null
          external_object_id: string
          external_object_type: string
          external_parent_id?: string | null
          external_url?: string | null
          id?: string
          import_job_id: string
          import_status?: string
          provider: string
          raw_metadata?: Json
          source_created_at?: string | null
          source_updated_at?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          destination_id?: string | null
          destination_table?: string | null
          error?: string | null
          external_author_id?: string | null
          external_author_name?: string | null
          external_object_id?: string
          external_object_type?: string
          external_parent_id?: string | null
          external_url?: string | null
          id?: string
          import_job_id?: string
          import_status?: string
          provider?: string
          raw_metadata?: Json
          source_created_at?: string | null
          source_updated_at?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_source_objects_import_job_id_fkey"
            columns: ["import_job_id"]
            isOneToOne: false
            referencedRelation: "import_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      import_suggestions: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          confidence: number | null
          created_at: string
          destination_id: string | null
          destination_table: string | null
          detail: string | null
          id: string
          import_job_id: string
          kind: string
          payload: Json
          project_id: string | null
          source_object_id: string | null
          source_url: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          confidence?: number | null
          created_at?: string
          destination_id?: string | null
          destination_table?: string | null
          detail?: string | null
          id?: string
          import_job_id: string
          kind: string
          payload?: Json
          project_id?: string | null
          source_object_id?: string | null
          source_url?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          confidence?: number | null
          created_at?: string
          destination_id?: string | null
          destination_table?: string | null
          detail?: string | null
          id?: string
          import_job_id?: string
          kind?: string
          payload?: Json
          project_id?: string | null
          source_object_id?: string | null
          source_url?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_suggestions_import_job_id_fkey"
            columns: ["import_job_id"]
            isOneToOne: false
            referencedRelation: "import_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_suggestions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_suggestions_source_object_id_fkey"
            columns: ["source_object_id"]
            isOneToOne: false
            referencedRelation: "import_source_objects"
            referencedColumns: ["id"]
          },
        ]
      }
      inbox_triage_classifications: {
        Row: {
          acted_at: string | null
          confidence: number
          created_at: string
          dismissed_reason: string | null
          draft_reply: string | null
          draft_subject: string | null
          extracted: Json
          id: string
          kind: Database["public"]["Enums"]["inbox_triage_kind"]
          message_id: string
          owner_user_id: string
          sender_user_id: string
          status: Database["public"]["Enums"]["inbox_triage_status"]
          summary: string | null
          updated_at: string
        }
        Insert: {
          acted_at?: string | null
          confidence?: number
          created_at?: string
          dismissed_reason?: string | null
          draft_reply?: string | null
          draft_subject?: string | null
          extracted?: Json
          id?: string
          kind: Database["public"]["Enums"]["inbox_triage_kind"]
          message_id: string
          owner_user_id: string
          sender_user_id: string
          status?: Database["public"]["Enums"]["inbox_triage_status"]
          summary?: string | null
          updated_at?: string
        }
        Update: {
          acted_at?: string | null
          confidence?: number
          created_at?: string
          dismissed_reason?: string | null
          draft_reply?: string | null
          draft_subject?: string | null
          extracted?: Json
          id?: string
          kind?: Database["public"]["Enums"]["inbox_triage_kind"]
          message_id?: string
          owner_user_id?: string
          sender_user_id?: string
          status?: Database["public"]["Enums"]["inbox_triage_status"]
          summary?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inbox_triage_classifications_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: true
            referencedRelation: "conversation_list"
            referencedColumns: ["message_id"]
          },
          {
            foreignKeyName: "inbox_triage_classifications_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: true
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      income_goals: {
        Row: {
          created_at: string
          currency: string
          id: string
          period: string
          target_amount: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          currency?: string
          id?: string
          period?: string
          target_amount?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          currency?: string
          id?: string
          period?: string
          target_amount?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      industry_stats: {
        Row: {
          created_at: string
          date_achieved: string | null
          description: string | null
          display_order: number | null
          icon: string | null
          id: string
          is_featured: boolean | null
          issuer: string | null
          stat_type: string
          title: string
          updated_at: string
          user_id: string
          value: string | null
          verification_url: string | null
        }
        Insert: {
          created_at?: string
          date_achieved?: string | null
          description?: string | null
          display_order?: number | null
          icon?: string | null
          id?: string
          is_featured?: boolean | null
          issuer?: string | null
          stat_type: string
          title: string
          updated_at?: string
          user_id: string
          value?: string | null
          verification_url?: string | null
        }
        Update: {
          created_at?: string
          date_achieved?: string | null
          description?: string | null
          display_order?: number | null
          icon?: string | null
          id?: string
          is_featured?: boolean | null
          issuer?: string | null
          stat_type?: string
          title?: string
          updated_at?: string
          user_id?: string
          value?: string | null
          verification_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "industry_stats_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "feed_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "industry_stats_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "industry_stats_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "industry_stats_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles_discovery"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "industry_stats_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles_view"
            referencedColumns: ["user_id"]
          },
        ]
      }
      integration_connections: {
        Row: {
          connection_status: string
          created_at: string
          encrypted_access_token: string | null
          encrypted_refresh_token: string | null
          granted_scopes: string[]
          id: string
          metadata: Json
          provider: string
          provider_account_id: string | null
          provider_account_name: string | null
          revoked_at: string | null
          token_expiry: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          connection_status?: string
          created_at?: string
          encrypted_access_token?: string | null
          encrypted_refresh_token?: string | null
          granted_scopes?: string[]
          id?: string
          metadata?: Json
          provider: string
          provider_account_id?: string | null
          provider_account_name?: string | null
          revoked_at?: string | null
          token_expiry?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          connection_status?: string
          created_at?: string
          encrypted_access_token?: string | null
          encrypted_refresh_token?: string | null
          granted_scopes?: string[]
          id?: string
          metadata?: Json
          provider?: string
          provider_account_id?: string | null
          provider_account_name?: string | null
          revoked_at?: string | null
          token_expiry?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      invites: {
        Row: {
          accepted_at: string | null
          created_at: string | null
          current_uses: number | null
          id: string
          invite_code: string | null
          invitee_email: string
          invitee_user_id: string | null
          inviter_id: string
          max_uses: number | null
          status: string | null
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string | null
          current_uses?: number | null
          id?: string
          invite_code?: string | null
          invitee_email: string
          invitee_user_id?: string | null
          inviter_id: string
          max_uses?: number | null
          status?: string | null
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          accepted_at?: string | null
          created_at?: string | null
          current_uses?: number | null
          id?: string
          invite_code?: string | null
          invitee_email?: string
          invitee_user_id?: string | null
          inviter_id?: string
          max_uses?: number | null
          status?: string | null
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: []
      }
      invoice_sepa_beneficiaries: {
        Row: {
          beneficiary_name: string
          bic: string | null
          created_at: string
          iban: string
          updated_at: string
          user_id: string
        }
        Insert: {
          beneficiary_name: string
          bic?: string | null
          created_at?: string
          iban: string
          updated_at?: string
          user_id: string
        }
        Update: {
          beneficiary_name?: string
          bic?: string | null
          created_at?: string
          iban?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_sepa_beneficiaries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "feed_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "invoice_sepa_beneficiaries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "invoice_sepa_beneficiaries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "public_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "invoice_sepa_beneficiaries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "public_profiles_discovery"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "invoice_sepa_beneficiaries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "public_profiles_view"
            referencedColumns: ["user_id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount: number
          bank_transfer_reported_at: string | null
          brand_address: string | null
          brand_color: string | null
          brand_email: string | null
          brand_logo_url: string | null
          brand_name: string | null
          brand_website: string | null
          converted_from_quote_id: string | null
          cost_breakdown: Json | null
          created_at: string | null
          currency: string
          discount_amount: number | null
          discount_type: string | null
          discount_value: number | null
          document_type: string
          due_date: string | null
          id: string
          invoice_number: string
          issued_by: string
          issued_to: string | null
          line_items: Json | null
          markup_percentage: number | null
          milestone_id: string | null
          notes: string | null
          paid_at: string | null
          payment_details: Json | null
          payment_link_url: string | null
          payment_method: string | null
          project_id: string | null
          recipient_address: string | null
          recipient_email: string | null
          recipient_name: string | null
          reminder_count: number | null
          reminder_sent_at: string | null
          sent_at: string | null
          status: string
          tax_amount: number | null
          tax_rate: number | null
          terms_conditions: string | null
          total_amount: number | null
          updated_at: string | null
          valid_until: string | null
          viewed_at: string | null
        }
        Insert: {
          amount: number
          bank_transfer_reported_at?: string | null
          brand_address?: string | null
          brand_color?: string | null
          brand_email?: string | null
          brand_logo_url?: string | null
          brand_name?: string | null
          brand_website?: string | null
          converted_from_quote_id?: string | null
          cost_breakdown?: Json | null
          created_at?: string | null
          currency?: string
          discount_amount?: number | null
          discount_type?: string | null
          discount_value?: number | null
          document_type?: string
          due_date?: string | null
          id?: string
          invoice_number: string
          issued_by: string
          issued_to?: string | null
          line_items?: Json | null
          markup_percentage?: number | null
          milestone_id?: string | null
          notes?: string | null
          paid_at?: string | null
          payment_details?: Json | null
          payment_link_url?: string | null
          payment_method?: string | null
          project_id?: string | null
          recipient_address?: string | null
          recipient_email?: string | null
          recipient_name?: string | null
          reminder_count?: number | null
          reminder_sent_at?: string | null
          sent_at?: string | null
          status?: string
          tax_amount?: number | null
          tax_rate?: number | null
          terms_conditions?: string | null
          total_amount?: number | null
          updated_at?: string | null
          valid_until?: string | null
          viewed_at?: string | null
        }
        Update: {
          amount?: number
          bank_transfer_reported_at?: string | null
          brand_address?: string | null
          brand_color?: string | null
          brand_email?: string | null
          brand_logo_url?: string | null
          brand_name?: string | null
          brand_website?: string | null
          converted_from_quote_id?: string | null
          cost_breakdown?: Json | null
          created_at?: string | null
          currency?: string
          discount_amount?: number | null
          discount_type?: string | null
          discount_value?: number | null
          document_type?: string
          due_date?: string | null
          id?: string
          invoice_number?: string
          issued_by?: string
          issued_to?: string | null
          line_items?: Json | null
          markup_percentage?: number | null
          milestone_id?: string | null
          notes?: string | null
          paid_at?: string | null
          payment_details?: Json | null
          payment_link_url?: string | null
          payment_method?: string | null
          project_id?: string | null
          recipient_address?: string | null
          recipient_email?: string | null
          recipient_name?: string | null
          reminder_count?: number | null
          reminder_sent_at?: string | null
          sent_at?: string | null
          status?: string
          tax_amount?: number | null
          tax_rate?: number | null
          terms_conditions?: string | null
          total_amount?: number | null
          updated_at?: string | null
          valid_until?: string | null
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_converted_from_quote_id_fkey"
            columns: ["converted_from_quote_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "milestones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      jam_participants: {
        Row: {
          check_in_token: string
          checked_in_at: string | null
          checked_in_by: string | null
          guest_email: string | null
          guest_name: string | null
          id: string
          is_visible: boolean
          jam_id: string
          joined_at: string
          referral_channel: string | null
          referred_by: string | null
          status: string | null
          user_id: string | null
        }
        Insert: {
          check_in_token?: string
          checked_in_at?: string | null
          checked_in_by?: string | null
          guest_email?: string | null
          guest_name?: string | null
          id?: string
          is_visible?: boolean
          jam_id: string
          joined_at?: string
          referral_channel?: string | null
          referred_by?: string | null
          status?: string | null
          user_id?: string | null
        }
        Update: {
          check_in_token?: string
          checked_in_at?: string | null
          checked_in_by?: string | null
          guest_email?: string | null
          guest_name?: string | null
          id?: string
          is_visible?: boolean
          jam_id?: string
          joined_at?: string
          referral_channel?: string | null
          referred_by?: string | null
          status?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "jam_participants_jam_id_fkey"
            columns: ["jam_id"]
            isOneToOne: false
            referencedRelation: "creative_jams"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          avatar_url: string | null
          company: string | null
          created_at: string
          email: string | null
          id: string
          last_contacted_at: string | null
          name: string
          next_follow_up_at: string | null
          notes: string | null
          priority: string | null
          profile_url: string | null
          role: string | null
          source: string | null
          stage: string
          tags: string[] | null
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          company?: string | null
          created_at?: string
          email?: string | null
          id?: string
          last_contacted_at?: string | null
          name: string
          next_follow_up_at?: string | null
          notes?: string | null
          priority?: string | null
          profile_url?: string | null
          role?: string | null
          source?: string | null
          stage?: string
          tags?: string[] | null
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          company?: string | null
          created_at?: string
          email?: string | null
          id?: string
          last_contacted_at?: string | null
          name?: string
          next_follow_up_at?: string | null
          notes?: string | null
          priority?: string | null
          profile_url?: string | null
          role?: string | null
          source?: string | null
          stage?: string
          tags?: string[] | null
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      location_bookings: {
        Row: {
          booking_date: string
          created_at: string
          currency: string | null
          end_time: string
          id: string
          location_id: string
          message: string | null
          start_time: string
          status: string
          total_price: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          booking_date: string
          created_at?: string
          currency?: string | null
          end_time: string
          id?: string
          location_id: string
          message?: string | null
          start_time: string
          status?: string
          total_price?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          booking_date?: string
          created_at?: string
          currency?: string | null
          end_time?: string
          id?: string
          location_id?: string
          message?: string | null
          start_time?: string
          status?: string
          total_price?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "location_bookings_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "creative_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      location_bookmarks: {
        Row: {
          created_at: string
          id: string
          location_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          location_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          location_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "location_bookmarks_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "creative_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      location_categories: {
        Row: {
          created_at: string | null
          description: string | null
          display_order: number | null
          emoji: string | null
          id: string
          is_active: boolean | null
          location_type: string
          name: string
          parent_slug: string | null
          slug: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          emoji?: string | null
          id?: string
          is_active?: boolean | null
          location_type: string
          name: string
          parent_slug?: string | null
          slug: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          emoji?: string | null
          id?: string
          is_active?: boolean | null
          location_type?: string
          name?: string
          parent_slug?: string | null
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "location_categories_parent_slug_fkey"
            columns: ["parent_slug"]
            isOneToOne: false
            referencedRelation: "location_categories"
            referencedColumns: ["slug"]
          },
        ]
      }
      location_claims: {
        Row: {
          business_name: string
          created_at: string
          id: string
          location_id: string
          proof_description: string | null
          proof_url: string | null
          reviewed_at: string | null
          reviewer_notes: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          business_name: string
          created_at?: string
          id?: string
          location_id: string
          proof_description?: string | null
          proof_url?: string | null
          reviewed_at?: string | null
          reviewer_notes?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          business_name?: string
          created_at?: string
          id?: string
          location_id?: string
          proof_description?: string | null
          proof_url?: string | null
          reviewed_at?: string | null
          reviewer_notes?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "location_claims_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "creative_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      location_review_helpful: {
        Row: {
          created_at: string
          id: string
          review_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          review_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          review_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "location_review_helpful_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "location_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      location_reviews: {
        Row: {
          created_at: string
          id: string
          image_urls: string[] | null
          location_id: string
          rating: number
          review_text: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_urls?: string[] | null
          location_id: string
          rating: number
          review_text?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          image_urls?: string[] | null
          location_id?: string
          rating?: number
          review_text?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "location_reviews_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "creative_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      magazine_article_comments: {
        Row: {
          article_id: string
          content: string
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          article_id: string
          content: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          article_id?: string
          content?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "magazine_article_comments_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "magazine_articles"
            referencedColumns: ["id"]
          },
        ]
      }
      magazine_article_likes: {
        Row: {
          article_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          article_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          article_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "magazine_article_likes_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "magazine_articles"
            referencedColumns: ["id"]
          },
        ]
      }
      magazine_articles: {
        Row: {
          author_avatar_url: string | null
          author_name: string
          author_user_id: string | null
          category: string
          comment_count: number
          content: string
          cover_image_url: string | null
          cover_position_x: number
          cover_position_y: number
          cover_zoom: number
          created_at: string
          id: string
          is_featured: boolean | null
          is_published: boolean | null
          like_count: number
          read_time_minutes: number | null
          slug: string | null
          subtitle: string | null
          tags: string[] | null
          title: string
          updated_at: string
          view_count: number | null
        }
        Insert: {
          author_avatar_url?: string | null
          author_name?: string
          author_user_id?: string | null
          category?: string
          comment_count?: number
          content: string
          cover_image_url?: string | null
          cover_position_x?: number
          cover_position_y?: number
          cover_zoom?: number
          created_at?: string
          id?: string
          is_featured?: boolean | null
          is_published?: boolean | null
          like_count?: number
          read_time_minutes?: number | null
          slug?: string | null
          subtitle?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string
          view_count?: number | null
        }
        Update: {
          author_avatar_url?: string | null
          author_name?: string
          author_user_id?: string | null
          category?: string
          comment_count?: number
          content?: string
          cover_image_url?: string | null
          cover_position_x?: number
          cover_position_y?: number
          cover_zoom?: number
          created_at?: string
          id?: string
          is_featured?: boolean | null
          is_published?: boolean | null
          like_count?: number
          read_time_minutes?: number | null
          slug?: string | null
          subtitle?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string
          view_count?: number | null
        }
        Relationships: []
      }
      manual_bank_transfers: {
        Row: {
          admin_notes: string | null
          amount: number
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          currency: string
          id: string
          invoice_id: string | null
          payment_type: string
          proof_url: string
          recipient_bank_account_id: string | null
          recipient_bank_snapshot: Json | null
          recipient_id: string | null
          reference_code: string
          rejected_reason: string | null
          sender_account_last4: string | null
          sender_bank_name: string | null
          sender_id: string
          sender_notes: string | null
          status: string
          topup_id: string | null
          transfer_date: string | null
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          amount: number
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          currency?: string
          id?: string
          invoice_id?: string | null
          payment_type: string
          proof_url: string
          recipient_bank_account_id?: string | null
          recipient_bank_snapshot?: Json | null
          recipient_id?: string | null
          reference_code: string
          rejected_reason?: string | null
          sender_account_last4?: string | null
          sender_bank_name?: string | null
          sender_id: string
          sender_notes?: string | null
          status?: string
          topup_id?: string | null
          transfer_date?: string | null
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          amount?: number
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          currency?: string
          id?: string
          invoice_id?: string | null
          payment_type?: string
          proof_url?: string
          recipient_bank_account_id?: string | null
          recipient_bank_snapshot?: Json | null
          recipient_id?: string | null
          reference_code?: string
          rejected_reason?: string | null
          sender_account_last4?: string | null
          sender_bank_name?: string | null
          sender_id?: string
          sender_notes?: string | null
          status?: string
          topup_id?: string | null
          transfer_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "manual_bank_transfers_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "feed_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "manual_bank_transfers_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "manual_bank_transfers_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "manual_bank_transfers_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "public_profiles_discovery"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "manual_bank_transfers_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "public_profiles_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "manual_bank_transfers_recipient_bank_account_id_fkey"
            columns: ["recipient_bank_account_id"]
            isOneToOne: false
            referencedRelation: "recipient_bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manual_bank_transfers_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "feed_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "manual_bank_transfers_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "manual_bank_transfers_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "manual_bank_transfers_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "public_profiles_discovery"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "manual_bank_transfers_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "public_profiles_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "manual_bank_transfers_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "feed_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "manual_bank_transfers_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "manual_bank_transfers_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "manual_bank_transfers_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "public_profiles_discovery"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "manual_bank_transfers_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "public_profiles_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "manual_bank_transfers_topup_id_fkey"
            columns: ["topup_id"]
            isOneToOne: false
            referencedRelation: "wallet_topups"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_orders: {
        Row: {
          amount: number
          auto_release_at: string | null
          buyer_confirmed_at: string | null
          buyer_id: string
          checkout_session_id: string | null
          created_at: string
          currency: string | null
          delivered_at: string | null
          delivery_notes: string | null
          delivery_status: string | null
          dispute_reason: string | null
          download_urls: string[] | null
          escrow_released_at: string | null
          id: string
          listing_id: string
          listing_type: string
          payment_intent_id: string | null
          platform_fee: number | null
          seller_id: string
          shipped_at: string | null
          status: string
          tracking_number: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          auto_release_at?: string | null
          buyer_confirmed_at?: string | null
          buyer_id: string
          checkout_session_id?: string | null
          created_at?: string
          currency?: string | null
          delivered_at?: string | null
          delivery_notes?: string | null
          delivery_status?: string | null
          dispute_reason?: string | null
          download_urls?: string[] | null
          escrow_released_at?: string | null
          id?: string
          listing_id: string
          listing_type?: string
          payment_intent_id?: string | null
          platform_fee?: number | null
          seller_id: string
          shipped_at?: string | null
          status?: string
          tracking_number?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          auto_release_at?: string | null
          buyer_confirmed_at?: string | null
          buyer_id?: string
          checkout_session_id?: string | null
          created_at?: string
          currency?: string | null
          delivered_at?: string | null
          delivery_notes?: string | null
          delivery_status?: string | null
          dispute_reason?: string | null
          download_urls?: string[] | null
          escrow_released_at?: string | null
          id?: string
          listing_id?: string
          listing_type?: string
          payment_intent_id?: string | null
          platform_fee?: number | null
          seller_id?: string
          shipped_at?: string | null
          status?: string
          tracking_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_orders_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "digital_products"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          created_at: string | null
          id: string
          match_type: string
          status: string | null
          target_id: string | null
          user1_id: string
          user2_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          match_type: string
          status?: string | null
          target_id?: string | null
          user1_id: string
          user2_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          match_type?: string
          status?: string | null
          target_id?: string | null
          user1_id?: string
          user2_id?: string
        }
        Relationships: []
      }
      meeting_participants: {
        Row: {
          created_at: string
          guest_name: string | null
          guest_token: string | null
          id: string
          joined_at: string | null
          left_at: string | null
          meeting_id: string
          role: string
          status: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          guest_name?: string | null
          guest_token?: string | null
          id?: string
          joined_at?: string | null
          left_at?: string | null
          meeting_id: string
          role?: string
          status?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          guest_name?: string | null
          guest_token?: string | null
          id?: string
          joined_at?: string | null
          left_at?: string | null
          meeting_id?: string
          role?: string
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meeting_participants_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_recordings: {
        Row: {
          created_at: string
          daily_recording_id: string | null
          duration_seconds: number | null
          id: string
          meeting_id: string
          size_bytes: number | null
          status: string
          storage_path: string | null
        }
        Insert: {
          created_at?: string
          daily_recording_id?: string | null
          duration_seconds?: number | null
          id?: string
          meeting_id: string
          size_bytes?: number | null
          status?: string
          storage_path?: string | null
        }
        Update: {
          created_at?: string
          daily_recording_id?: string | null
          duration_seconds?: number | null
          id?: string
          meeting_id?: string
          size_bytes?: number | null
          status?: string
          storage_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meeting_recordings_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_transcripts: {
        Row: {
          created_at: string
          daily_transcript_id: string | null
          full_text: string | null
          id: string
          meeting_id: string
          segments: Json | null
          status: string
        }
        Insert: {
          created_at?: string
          daily_transcript_id?: string | null
          full_text?: string | null
          id?: string
          meeting_id: string
          segments?: Json | null
          status?: string
        }
        Update: {
          created_at?: string
          daily_transcript_id?: string | null
          full_text?: string | null
          id?: string
          meeting_id?: string
          segments?: Json | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_transcripts_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meetings: {
        Row: {
          circle_id: string | null
          conversation_id: string | null
          created_at: string
          ended_at: string | null
          event_id: string | null
          host_id: string
          id: string
          knocking_enabled: boolean
          max_participants: number
          profile_booking_id: string | null
          project_id: string | null
          recording_enabled: boolean
          room_name: string
          room_url: string
          scheduled_for: string | null
          settings: Json
          share_token: string
          source: string
          started_at: string | null
          title: string | null
          transcript_enabled: boolean
          updated_at: string
        }
        Insert: {
          circle_id?: string | null
          conversation_id?: string | null
          created_at?: string
          ended_at?: string | null
          event_id?: string | null
          host_id: string
          id?: string
          knocking_enabled?: boolean
          max_participants?: number
          profile_booking_id?: string | null
          project_id?: string | null
          recording_enabled?: boolean
          room_name: string
          room_url: string
          scheduled_for?: string | null
          settings?: Json
          share_token?: string
          source: string
          started_at?: string | null
          title?: string | null
          transcript_enabled?: boolean
          updated_at?: string
        }
        Update: {
          circle_id?: string | null
          conversation_id?: string | null
          created_at?: string
          ended_at?: string | null
          event_id?: string | null
          host_id?: string
          id?: string
          knocking_enabled?: boolean
          max_participants?: number
          profile_booking_id?: string | null
          project_id?: string | null
          recording_enabled?: boolean
          room_name?: string
          room_url?: string
          scheduled_for?: string | null
          settings?: Json
          share_token?: string
          source?: string
          started_at?: string | null
          title?: string | null
          transcript_enabled?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      message_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "project_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          attachment_duration: number | null
          attachment_name: string | null
          attachment_size: number | null
          attachment_type: string | null
          attachment_url: string | null
          content: string
          created_at: string | null
          id: string
          is_message_request: boolean | null
          match_id: string | null
          read: boolean | null
          receiver_id: string
          reply_to_content: string | null
          reply_to_id: string | null
          reply_to_sender_name: string | null
          sender_id: string
          shared_content_id: string | null
          shared_content_meta: Json | null
          shared_content_type: string | null
          typing_at: string | null
          updated_at: string | null
          voice_note_transcript: string | null
        }
        Insert: {
          attachment_duration?: number | null
          attachment_name?: string | null
          attachment_size?: number | null
          attachment_type?: string | null
          attachment_url?: string | null
          content: string
          created_at?: string | null
          id?: string
          is_message_request?: boolean | null
          match_id?: string | null
          read?: boolean | null
          receiver_id: string
          reply_to_content?: string | null
          reply_to_id?: string | null
          reply_to_sender_name?: string | null
          sender_id: string
          shared_content_id?: string | null
          shared_content_meta?: Json | null
          shared_content_type?: string | null
          typing_at?: string | null
          updated_at?: string | null
          voice_note_transcript?: string | null
        }
        Update: {
          attachment_duration?: number | null
          attachment_name?: string | null
          attachment_size?: number | null
          attachment_type?: string | null
          attachment_url?: string | null
          content?: string
          created_at?: string | null
          id?: string
          is_message_request?: boolean | null
          match_id?: string | null
          read?: boolean | null
          receiver_id?: string
          reply_to_content?: string | null
          reply_to_id?: string | null
          reply_to_sender_name?: string | null
          sender_id?: string
          shared_content_id?: string | null
          shared_content_meta?: Json | null
          shared_content_type?: string | null
          typing_at?: string | null
          updated_at?: string | null
          voice_note_transcript?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "conversation_list"
            referencedColumns: ["message_id"]
          },
          {
            foreignKeyName: "messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      messaging_channels: {
        Row: {
          channel: string
          external_chat_id: string
          external_display_name: string | null
          external_username: string | null
          id: string
          is_active: boolean
          last_seen_at: string | null
          linked_at: string
          user_id: string
        }
        Insert: {
          channel: string
          external_chat_id: string
          external_display_name?: string | null
          external_username?: string | null
          id?: string
          is_active?: boolean
          last_seen_at?: string | null
          linked_at?: string
          user_id: string
        }
        Update: {
          channel?: string
          external_chat_id?: string
          external_display_name?: string | null
          external_username?: string | null
          id?: string
          is_active?: boolean
          last_seen_at?: string | null
          linked_at?: string
          user_id?: string
        }
        Relationships: []
      }
      milestones: {
        Row: {
          amount: number
          created_at: string | null
          created_by: string
          description: string | null
          due_date: string | null
          escrow_status: string | null
          external_id: string | null
          external_url: string | null
          id: string
          import_job_id: string | null
          imported_at: string | null
          paid_at: string | null
          paid_to: string | null
          payment_intent_id: string | null
          project_id: string
          requested_by: string | null
          source_provider: string | null
          status: string
          title: string
          updated_at: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          created_by: string
          description?: string | null
          due_date?: string | null
          escrow_status?: string | null
          external_id?: string | null
          external_url?: string | null
          id?: string
          import_job_id?: string | null
          imported_at?: string | null
          paid_at?: string | null
          paid_to?: string | null
          payment_intent_id?: string | null
          project_id: string
          requested_by?: string | null
          source_provider?: string | null
          status?: string
          title: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          created_by?: string
          description?: string | null
          due_date?: string | null
          escrow_status?: string | null
          external_id?: string | null
          external_url?: string | null
          id?: string
          import_job_id?: string | null
          imported_at?: string | null
          paid_at?: string | null
          paid_to?: string | null
          payment_intent_id?: string | null
          project_id?: string
          requested_by?: string | null
          source_provider?: string | null
          status?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "milestones_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "feed_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "milestones_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "milestones_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "milestones_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "public_profiles_discovery"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "milestones_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "public_profiles_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "milestones_paid_to_fkey"
            columns: ["paid_to"]
            isOneToOne: false
            referencedRelation: "feed_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "milestones_paid_to_fkey"
            columns: ["paid_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "milestones_paid_to_fkey"
            columns: ["paid_to"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "milestones_paid_to_fkey"
            columns: ["paid_to"]
            isOneToOne: false
            referencedRelation: "public_profiles_discovery"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "milestones_paid_to_fkey"
            columns: ["paid_to"]
            isOneToOne: false
            referencedRelation: "public_profiles_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "milestones_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "milestones_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "feed_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "milestones_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "milestones_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "milestones_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "public_profiles_discovery"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "milestones_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "public_profiles_view"
            referencedColumns: ["user_id"]
          },
        ]
      }
      modeling_call_sheets: {
        Row: {
          call_time: string | null
          contacts: Json | null
          created_at: string
          created_by: string | null
          id: string
          location: Json | null
          notes: string | null
          project_id: string
          shoot_date: string | null
          updated_at: string
          weather_cache: Json | null
          wrap_time: string | null
        }
        Insert: {
          call_time?: string | null
          contacts?: Json | null
          created_at?: string
          created_by?: string | null
          id?: string
          location?: Json | null
          notes?: string | null
          project_id: string
          shoot_date?: string | null
          updated_at?: string
          weather_cache?: Json | null
          wrap_time?: string | null
        }
        Update: {
          call_time?: string | null
          contacts?: Json | null
          created_at?: string
          created_by?: string | null
          id?: string
          location?: Json | null
          notes?: string | null
          project_id?: string
          shoot_date?: string | null
          updated_at?: string
          weather_cache?: Json | null
          wrap_time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "modeling_call_sheets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      modeling_looks: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          notes: string | null
          order_idx: number
          project_id: string
          reference_urls: string[] | null
          updated_at: string
          wardrobe: Json | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          notes?: string | null
          order_idx?: number
          project_id: string
          reference_urls?: string[] | null
          updated_at?: string
          wardrobe?: Json | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          notes?: string | null
          order_idx?: number
          project_id?: string
          reference_urls?: string[] | null
          updated_at?: string
          wardrobe?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "modeling_looks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      modeling_usage_rights: {
        Row: {
          created_at: string
          created_by: string | null
          duration_months: number | null
          exclusivity: boolean | null
          id: string
          notes: string | null
          project_id: string
          rate_usd: number | null
          scope: string
          territory: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          duration_months?: number | null
          exclusivity?: boolean | null
          id?: string
          notes?: string | null
          project_id: string
          rate_usd?: number | null
          scope: string
          territory?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          duration_months?: number | null
          exclusivity?: boolean | null
          id?: string
          notes?: string | null
          project_id?: string
          rate_usd?: number | null
          scope?: string
          territory?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "modeling_usage_rights_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      money_streaks: {
        Row: {
          created_at: string
          current_streak: number
          last_action_date: string | null
          last_action_type: string | null
          longest_streak: number
          total_actions: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_streak?: number
          last_action_date?: string | null
          last_action_type?: string | null
          longest_streak?: number
          total_actions?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_streak?: number
          last_action_date?: string | null
          last_action_type?: string | null
          longest_streak?: number
          total_actions?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      music_release_checklist: {
        Row: {
          created_at: string
          created_by: string
          done: boolean
          due_date: string | null
          id: string
          order_index: number
          project_id: string
          release_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          done?: boolean
          due_date?: string | null
          id?: string
          order_index?: number
          project_id: string
          release_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          done?: boolean
          due_date?: string | null
          id?: string
          order_index?: number
          project_id?: string
          release_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "music_release_checklist_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "music_release_checklist_release_id_fkey"
            columns: ["release_id"]
            isOneToOne: false
            referencedRelation: "music_releases"
            referencedColumns: ["id"]
          },
        ]
      }
      music_releases: {
        Row: {
          artist: string | null
          cover_url: string | null
          created_at: string
          created_by: string
          distributor: string | null
          id: string
          isrc: string | null
          notes: string | null
          project_id: string
          release_date: string | null
          release_type: string
          status: string
          title: string
          upc: string | null
          updated_at: string
        }
        Insert: {
          artist?: string | null
          cover_url?: string | null
          created_at?: string
          created_by: string
          distributor?: string | null
          id?: string
          isrc?: string | null
          notes?: string | null
          project_id: string
          release_date?: string | null
          release_type?: string
          status?: string
          title: string
          upc?: string | null
          updated_at?: string
        }
        Update: {
          artist?: string | null
          cover_url?: string | null
          created_at?: string
          created_by?: string
          distributor?: string | null
          id?: string
          isrc?: string | null
          notes?: string | null
          project_id?: string
          release_date?: string | null
          release_type?: string
          status?: string
          title?: string
          upc?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "music_releases_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      music_splits: {
        Row: {
          collaborator_user_id: string | null
          created_at: string
          created_by: string
          id: string
          name: string
          notes: string | null
          payout_email: string | null
          percentage: number
          project_id: string
          release_id: string | null
          role: string | null
          status: string
          track_id: string | null
          updated_at: string
        }
        Insert: {
          collaborator_user_id?: string | null
          created_at?: string
          created_by: string
          id?: string
          name: string
          notes?: string | null
          payout_email?: string | null
          percentage?: number
          project_id: string
          release_id?: string | null
          role?: string | null
          status?: string
          track_id?: string | null
          updated_at?: string
        }
        Update: {
          collaborator_user_id?: string | null
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          notes?: string | null
          payout_email?: string | null
          percentage?: number
          project_id?: string
          release_id?: string | null
          role?: string | null
          status?: string
          track_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "music_splits_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "music_splits_release_id_fkey"
            columns: ["release_id"]
            isOneToOne: false
            referencedRelation: "music_releases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "music_splits_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "music_tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      music_tracks: {
        Row: {
          created_at: string
          created_by: string
          duration_seconds: number | null
          id: string
          isrc: string | null
          lyrics: string | null
          master_url: string | null
          notes: string | null
          order_index: number
          project_id: string
          release_id: string | null
          status: string
          title: string
          track_no: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          duration_seconds?: number | null
          id?: string
          isrc?: string | null
          lyrics?: string | null
          master_url?: string | null
          notes?: string | null
          order_index?: number
          project_id: string
          release_id?: string | null
          status?: string
          title: string
          track_no?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          duration_seconds?: number | null
          id?: string
          isrc?: string | null
          lyrics?: string | null
          master_url?: string | null
          notes?: string | null
          order_index?: number
          project_id?: string
          release_id?: string | null
          status?: string
          title?: string
          track_no?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "music_tracks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "music_tracks_release_id_fkey"
            columns: ["release_id"]
            isOneToOne: false
            referencedRelation: "music_releases"
            referencedColumns: ["id"]
          },
        ]
      }
      newsletter_subscribers: {
        Row: {
          email: string
          id: string
          is_active: boolean
          metadata: Json | null
          segments: string[] | null
          source: string | null
          subscribed_at: string
          unsubscribed_at: string | null
        }
        Insert: {
          email: string
          id?: string
          is_active?: boolean
          metadata?: Json | null
          segments?: string[] | null
          source?: string | null
          subscribed_at?: string
          unsubscribed_at?: string | null
        }
        Update: {
          email?: string
          id?: string
          is_active?: boolean
          metadata?: Json | null
          segments?: string[] | null
          source?: string | null
          subscribed_at?: string
          unsubscribed_at?: string | null
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          created_at: string
          email_matches: boolean | null
          email_messages: boolean | null
          email_opportunities: boolean | null
          email_projects: boolean | null
          id: string
          in_app_all: boolean | null
          push_matches: boolean | null
          push_messages: boolean | null
          push_opportunities: boolean | null
          push_projects: boolean | null
          unsubscribe_token: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email_matches?: boolean | null
          email_messages?: boolean | null
          email_opportunities?: boolean | null
          email_projects?: boolean | null
          id?: string
          in_app_all?: boolean | null
          push_matches?: boolean | null
          push_messages?: boolean | null
          push_opportunities?: boolean | null
          push_projects?: boolean | null
          unsubscribe_token?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email_matches?: boolean | null
          email_messages?: boolean | null
          email_opportunities?: boolean | null
          email_projects?: boolean | null
          id?: string
          in_app_all?: boolean | null
          push_matches?: boolean | null
          push_messages?: boolean | null
          push_opportunities?: boolean | null
          push_projects?: boolean | null
          unsubscribe_token?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          action_text: string | null
          action_url: string | null
          category: string | null
          created_at: string | null
          dedupe_key: string | null
          id: string
          image_url: string | null
          link: string | null
          message: string
          priority: string | null
          read: boolean | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          action_text?: string | null
          action_url?: string | null
          category?: string | null
          created_at?: string | null
          dedupe_key?: string | null
          id?: string
          image_url?: string | null
          link?: string | null
          message: string
          priority?: string | null
          read?: boolean | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          action_text?: string | null
          action_url?: string | null
          category?: string | null
          created_at?: string | null
          dedupe_key?: string | null
          id?: string
          image_url?: string | null
          link?: string | null
          message?: string
          priority?: string | null
          read?: boolean | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      oauth_apps: {
        Row: {
          client_id: string
          client_secret: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          logo_url: string | null
          name: string
          owner_id: string | null
          redirect_uris: string[]
          updated_at: string
        }
        Insert: {
          client_id?: string
          client_secret?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name: string
          owner_id?: string | null
          redirect_uris?: string[]
          updated_at?: string
        }
        Update: {
          client_id?: string
          client_secret?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name?: string
          owner_id?: string | null
          redirect_uris?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      oauth_codes: {
        Row: {
          app_id: string
          code: string
          created_at: string
          expires_at: string
          id: string
          redirect_uri: string
          scopes: string[]
          used: boolean
          user_id: string
        }
        Insert: {
          app_id: string
          code?: string
          created_at?: string
          expires_at?: string
          id?: string
          redirect_uri: string
          scopes?: string[]
          used?: boolean
          user_id: string
        }
        Update: {
          app_id?: string
          code?: string
          created_at?: string
          expires_at?: string
          id?: string
          redirect_uri?: string
          scopes?: string[]
          used?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "oauth_codes_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "oauth_apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oauth_codes_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "oauth_apps_public"
            referencedColumns: ["id"]
          },
        ]
      }
      oauth_tokens: {
        Row: {
          access_token: string
          app_id: string
          created_at: string
          expires_at: string
          id: string
          revoked: boolean
          scopes: string[]
          user_id: string
        }
        Insert: {
          access_token?: string
          app_id: string
          created_at?: string
          expires_at?: string
          id?: string
          revoked?: boolean
          scopes?: string[]
          user_id: string
        }
        Update: {
          access_token?: string
          app_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          revoked?: boolean
          scopes?: string[]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "oauth_tokens_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "oauth_apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oauth_tokens_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "oauth_apps_public"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunities: {
        Row: {
          application_deadline: string | null
          barter_gifted_value_usd: number | null
          barter_offering: string | null
          barter_posting_deadline: string | null
          barter_requesting: string | null
          casting_age_max: number | null
          casting_age_min: number | null
          casting_categories: string[] | null
          casting_fitting_date: string | null
          casting_gender: string | null
          casting_max_height_cm: number | null
          casting_min_height_cm: number | null
          casting_shoot_date: string | null
          casting_usage_summary: string | null
          claim_status: string | null
          claim_token: string | null
          compensation: string | null
          content_deliverables: Json | null
          created_at: string | null
          created_by: string | null
          deliverables: string | null
          description: string
          duration: string | null
          guest_company_name: string | null
          guest_email: string | null
          guest_logo_url: string | null
          guest_profile_id: string | null
          id: string
          image_url: string | null
          is_guest_post: boolean | null
          is_priority: boolean | null
          latitude: number | null
          location: string | null
          location_city: string | null
          location_country: string | null
          longitude: number | null
          min_followers: number | null
          original_source_text: string | null
          platform_requirements: string[] | null
          posted_by_manager_id: string | null
          priority_expires_at: string | null
          requirements: string | null
          scouted_by: string | null
          skills: string[] | null
          source_platform: string | null
          status: string | null
          tags: string[] | null
          title: string
          type: string
          updated_at: string | null
          usage_duration: string | null
          usage_exclusive: boolean | null
          usage_territory: string | null
          usage_type: string | null
          verification_token: string | null
          verified_at: string | null
          view_count: number
          whitelisting_allowed: boolean | null
        }
        Insert: {
          application_deadline?: string | null
          barter_gifted_value_usd?: number | null
          barter_offering?: string | null
          barter_posting_deadline?: string | null
          barter_requesting?: string | null
          casting_age_max?: number | null
          casting_age_min?: number | null
          casting_categories?: string[] | null
          casting_fitting_date?: string | null
          casting_gender?: string | null
          casting_max_height_cm?: number | null
          casting_min_height_cm?: number | null
          casting_shoot_date?: string | null
          casting_usage_summary?: string | null
          claim_status?: string | null
          claim_token?: string | null
          compensation?: string | null
          content_deliverables?: Json | null
          created_at?: string | null
          created_by?: string | null
          deliverables?: string | null
          description: string
          duration?: string | null
          guest_company_name?: string | null
          guest_email?: string | null
          guest_logo_url?: string | null
          guest_profile_id?: string | null
          id?: string
          image_url?: string | null
          is_guest_post?: boolean | null
          is_priority?: boolean | null
          latitude?: number | null
          location?: string | null
          location_city?: string | null
          location_country?: string | null
          longitude?: number | null
          min_followers?: number | null
          original_source_text?: string | null
          platform_requirements?: string[] | null
          posted_by_manager_id?: string | null
          priority_expires_at?: string | null
          requirements?: string | null
          scouted_by?: string | null
          skills?: string[] | null
          source_platform?: string | null
          status?: string | null
          tags?: string[] | null
          title: string
          type: string
          updated_at?: string | null
          usage_duration?: string | null
          usage_exclusive?: boolean | null
          usage_territory?: string | null
          usage_type?: string | null
          verification_token?: string | null
          verified_at?: string | null
          view_count?: number
          whitelisting_allowed?: boolean | null
        }
        Update: {
          application_deadline?: string | null
          barter_gifted_value_usd?: number | null
          barter_offering?: string | null
          barter_posting_deadline?: string | null
          barter_requesting?: string | null
          casting_age_max?: number | null
          casting_age_min?: number | null
          casting_categories?: string[] | null
          casting_fitting_date?: string | null
          casting_gender?: string | null
          casting_max_height_cm?: number | null
          casting_min_height_cm?: number | null
          casting_shoot_date?: string | null
          casting_usage_summary?: string | null
          claim_status?: string | null
          claim_token?: string | null
          compensation?: string | null
          content_deliverables?: Json | null
          created_at?: string | null
          created_by?: string | null
          deliverables?: string | null
          description?: string
          duration?: string | null
          guest_company_name?: string | null
          guest_email?: string | null
          guest_logo_url?: string | null
          guest_profile_id?: string | null
          id?: string
          image_url?: string | null
          is_guest_post?: boolean | null
          is_priority?: boolean | null
          latitude?: number | null
          location?: string | null
          location_city?: string | null
          location_country?: string | null
          longitude?: number | null
          min_followers?: number | null
          original_source_text?: string | null
          platform_requirements?: string[] | null
          posted_by_manager_id?: string | null
          priority_expires_at?: string | null
          requirements?: string | null
          scouted_by?: string | null
          skills?: string[] | null
          source_platform?: string | null
          status?: string | null
          tags?: string[] | null
          title?: string
          type?: string
          updated_at?: string | null
          usage_duration?: string | null
          usage_exclusive?: boolean | null
          usage_territory?: string | null
          usage_type?: string | null
          verification_token?: string | null
          verified_at?: string | null
          view_count?: number
          whitelisting_allowed?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "opportunities_posted_by_manager_id_fkey"
            columns: ["posted_by_manager_id"]
            isOneToOne: false
            referencedRelation: "talent_managers"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunity_intel_digests: {
        Row: {
          created_at: string
          dismissed_at: string | null
          generated_at: string
          id: string
          kind: string
          payload: Json
          seen_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          dismissed_at?: string | null
          generated_at?: string
          id?: string
          kind: string
          payload?: Json
          seen_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          dismissed_at?: string | null
          generated_at?: string
          id?: string
          kind?: string
          payload?: Json
          seen_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      opportunity_views: {
        Row: {
          id: string
          opportunity_id: string
          referrer: string | null
          viewed_at: string
          viewer_id: string | null
        }
        Insert: {
          id?: string
          opportunity_id: string
          referrer?: string | null
          viewed_at?: string
          viewer_id?: string | null
        }
        Update: {
          id?: string
          opportunity_id?: string
          referrer?: string | null
          viewed_at?: string
          viewer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_views_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      orch_actions: {
        Row: {
          created_record_ids: Json | null
          decided_at: string | null
          error: string | null
          executed_at: string | null
          id: string
          persona: Database["public"]["Enums"]["agent_persona"]
          preview_body: string | null
          preview_title: string | null
          proposed_at: string
          result: Json | null
          risk_level: Database["public"]["Enums"]["orch_risk_level"]
          run_id: string
          status: Database["public"]["Enums"]["orch_action_status"]
          tool_args: Json
          tool_name: string
          user_id: string
        }
        Insert: {
          created_record_ids?: Json | null
          decided_at?: string | null
          error?: string | null
          executed_at?: string | null
          id?: string
          persona?: Database["public"]["Enums"]["agent_persona"]
          preview_body?: string | null
          preview_title?: string | null
          proposed_at?: string
          result?: Json | null
          risk_level?: Database["public"]["Enums"]["orch_risk_level"]
          run_id: string
          status?: Database["public"]["Enums"]["orch_action_status"]
          tool_args?: Json
          tool_name: string
          user_id: string
        }
        Update: {
          created_record_ids?: Json | null
          decided_at?: string | null
          error?: string | null
          executed_at?: string | null
          id?: string
          persona?: Database["public"]["Enums"]["agent_persona"]
          preview_body?: string | null
          preview_title?: string | null
          proposed_at?: string
          result?: Json | null
          risk_level?: Database["public"]["Enums"]["orch_risk_level"]
          run_id?: string
          status?: Database["public"]["Enums"]["orch_action_status"]
          tool_args?: Json
          tool_name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orch_actions_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "orch_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      orch_approvals: {
        Row: {
          action_id: string
          decided_at: string
          decision: Database["public"]["Enums"]["orch_approval_decision"]
          edited_args: Json | null
          id: string
          note: string | null
          user_id: string
        }
        Insert: {
          action_id: string
          decided_at?: string
          decision: Database["public"]["Enums"]["orch_approval_decision"]
          edited_args?: Json | null
          id?: string
          note?: string | null
          user_id: string
        }
        Update: {
          action_id?: string
          decided_at?: string
          decision?: Database["public"]["Enums"]["orch_approval_decision"]
          edited_args?: Json | null
          id?: string
          note?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orch_approvals_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: false
            referencedRelation: "orch_actions"
            referencedColumns: ["id"]
          },
        ]
      }
      orch_runs: {
        Row: {
          agent_kind: Database["public"]["Enums"]["orch_agent_kind"]
          context: Json | null
          created_at: string
          error: string | null
          id: string
          intent_classified: string | null
          intent_text: string | null
          latency_ms: number | null
          parent_run_id: string | null
          status: Database["public"]["Enums"]["orch_run_status"]
          summary: string | null
          tokens_used: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          agent_kind?: Database["public"]["Enums"]["orch_agent_kind"]
          context?: Json | null
          created_at?: string
          error?: string | null
          id?: string
          intent_classified?: string | null
          intent_text?: string | null
          latency_ms?: number | null
          parent_run_id?: string | null
          status?: Database["public"]["Enums"]["orch_run_status"]
          summary?: string | null
          tokens_used?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          agent_kind?: Database["public"]["Enums"]["orch_agent_kind"]
          context?: Json | null
          created_at?: string
          error?: string | null
          id?: string
          intent_classified?: string | null
          intent_text?: string | null
          latency_ms?: number | null
          parent_run_id?: string | null
          status?: Database["public"]["Enums"]["orch_run_status"]
          summary?: string | null
          tokens_used?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orch_runs_parent_run_id_fkey"
            columns: ["parent_run_id"]
            isOneToOne: false
            referencedRelation: "orch_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      orch_settings: {
        Row: {
          agent_mode_credits: boolean
          agent_mode_payments: boolean
          agent_mode_projects: boolean
          agent_mode_talent: boolean
          agents_enabled: boolean
          auto_run_safe: boolean
          created_at: string
          daily_action_limit: number
          updated_at: string
          user_id: string
        }
        Insert: {
          agent_mode_credits?: boolean
          agent_mode_payments?: boolean
          agent_mode_projects?: boolean
          agent_mode_talent?: boolean
          agents_enabled?: boolean
          auto_run_safe?: boolean
          created_at?: string
          daily_action_limit?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          agent_mode_credits?: boolean
          agent_mode_payments?: boolean
          agent_mode_projects?: boolean
          agent_mode_talent?: boolean
          agents_enabled?: boolean
          auto_run_safe?: boolean
          created_at?: string
          daily_action_limit?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      orch_tool_registry: {
        Row: {
          agent_kind: Database["public"]["Enums"]["orch_agent_kind"]
          args_schema: Json
          created_at: string
          description: string
          enabled: boolean
          handler: string
          id: string
          risk_level: Database["public"]["Enums"]["orch_risk_level"]
          tool_name: string
          updated_at: string
        }
        Insert: {
          agent_kind: Database["public"]["Enums"]["orch_agent_kind"]
          args_schema?: Json
          created_at?: string
          description: string
          enabled?: boolean
          handler: string
          id?: string
          risk_level: Database["public"]["Enums"]["orch_risk_level"]
          tool_name: string
          updated_at?: string
        }
        Update: {
          agent_kind?: Database["public"]["Enums"]["orch_agent_kind"]
          args_schema?: Json
          created_at?: string
          description?: string
          enabled?: boolean
          handler?: string
          id?: string
          risk_level?: Database["public"]["Enums"]["orch_risk_level"]
          tool_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      outreach_drafts: {
        Row: {
          body: string
          brand_name: string | null
          created_at: string
          id: string
          lead_id: string | null
          meta: Json
          recipient_email: string | null
          recipient_name: string | null
          scheduled_for: string | null
          send_error: string | null
          sent_at: string | null
          source: string
          status: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          brand_name?: string | null
          created_at?: string
          id?: string
          lead_id?: string | null
          meta?: Json
          recipient_email?: string | null
          recipient_name?: string | null
          scheduled_for?: string | null
          send_error?: string | null
          sent_at?: string | null
          source?: string
          status?: string
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          brand_name?: string | null
          created_at?: string
          id?: string
          lead_id?: string | null
          meta?: Json
          recipient_email?: string | null
          recipient_name?: string | null
          scheduled_for?: string | null
          send_error?: string | null
          sent_at?: string | null
          source?: string
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "outreach_drafts_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "sponsor_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      outreach_sequences: {
        Row: {
          completed_steps: number | null
          created_at: string
          description: string | null
          id: string
          lead_id: string | null
          name: string
          recipient_email: string | null
          status: string
          total_steps: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_steps?: number | null
          created_at?: string
          description?: string | null
          id?: string
          lead_id?: string | null
          name: string
          recipient_email?: string | null
          status?: string
          total_steps?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_steps?: number | null
          created_at?: string
          description?: string | null
          id?: string
          lead_id?: string | null
          name?: string
          recipient_email?: string | null
          status?: string
          total_steps?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "outreach_sequences_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_discounts: {
        Row: {
          category: string
          created_at: string | null
          description: string
          discount_type: string
          discount_value: string
          expires_at: string | null
          id: string
          is_active: boolean | null
          partner_logo_url: string | null
          partner_name: string
          redemption_code: string | null
          redemption_url: string | null
          terms: string | null
          tier_required: string
          updated_at: string | null
        }
        Insert: {
          category: string
          created_at?: string | null
          description: string
          discount_type: string
          discount_value: string
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          partner_logo_url?: string | null
          partner_name: string
          redemption_code?: string | null
          redemption_url?: string | null
          terms?: string | null
          tier_required?: string
          updated_at?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          description?: string
          discount_type?: string
          discount_value?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          partner_logo_url?: string | null
          partner_name?: string
          redemption_code?: string | null
          redemption_url?: string | null
          terms?: string | null
          tier_required?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      partner_invite_links: {
        Row: {
          contact_email: string | null
          contact_name: string | null
          created_at: string | null
          current_uses: number | null
          description: string | null
          id: string
          is_active: boolean | null
          max_uses: number | null
          partner_code: string
          partner_name: string
          updated_at: string | null
        }
        Insert: {
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string | null
          current_uses?: number | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
          partner_code: string
          partner_name: string
          updated_at?: string | null
        }
        Update: {
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string | null
          current_uses?: number | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
          partner_code?: string
          partner_name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      partner_locations: {
        Row: {
          address: string
          amenities: Json | null
          check_in_radius_meters: number | null
          city: string
          country: string
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          latitude: number
          logo_url: string | null
          longitude: number
          name: string
          offerings: string[] | null
          points_per_visit: number
          qr_code: string
          tier_required: string
          type: string
          updated_at: string
        }
        Insert: {
          address: string
          amenities?: Json | null
          check_in_radius_meters?: number | null
          city: string
          country: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          latitude: number
          logo_url?: string | null
          longitude: number
          name: string
          offerings?: string[] | null
          points_per_visit?: number
          qr_code?: string
          tier_required?: string
          type: string
          updated_at?: string
        }
        Update: {
          address?: string
          amenities?: Json | null
          check_in_radius_meters?: number | null
          city?: string
          country?: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          latitude?: number
          logo_url?: string | null
          longitude?: number
          name?: string
          offerings?: string[] | null
          points_per_visit?: number
          qr_code?: string
          tier_required?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      partner_signups: {
        Row: {
          id: string
          partner_link_id: string
          signed_up_at: string | null
          user_id: string
        }
        Insert: {
          id?: string
          partner_link_id: string
          signed_up_at?: string | null
          user_id: string
        }
        Update: {
          id?: string
          partner_link_id?: string
          signed_up_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_signups_partner_link_id_fkey"
            columns: ["partner_link_id"]
            isOneToOne: false
            referencedRelation: "partner_invite_links"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_submissions: {
        Row: {
          category: string
          company_name: string
          contact_email: string
          contact_name: string
          contact_phone: string | null
          description: string
          discount_type: string
          discount_value: string
          id: string
          logo_url: string
          redemption_code: string | null
          redemption_url: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string | null
          submitted_at: string | null
          terms: string | null
          tier_required: string
          website_url: string | null
        }
        Insert: {
          category: string
          company_name: string
          contact_email: string
          contact_name: string
          contact_phone?: string | null
          description: string
          discount_type: string
          discount_value: string
          id?: string
          logo_url: string
          redemption_code?: string | null
          redemption_url?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          submitted_at?: string | null
          terms?: string | null
          tier_required?: string
          website_url?: string | null
        }
        Update: {
          category?: string
          company_name?: string
          contact_email?: string
          contact_name?: string
          contact_phone?: string | null
          description?: string
          discount_type?: string
          discount_value?: string
          id?: string
          logo_url?: string
          redemption_code?: string | null
          redemption_url?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          submitted_at?: string | null
          terms?: string | null
          tier_required?: string
          website_url?: string | null
        }
        Relationships: []
      }
      payment_disputes: {
        Row: {
          created_at: string
          details: string
          disputed_by: string
          evidence: string | null
          id: string
          milestone_id: string | null
          payment_intent_id: string | null
          reason: string
          resolution_notes: string | null
          resolved_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          details: string
          disputed_by: string
          evidence?: string | null
          id?: string
          milestone_id?: string | null
          payment_intent_id?: string | null
          reason: string
          resolution_notes?: string | null
          resolved_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          details?: string
          disputed_by?: string
          evidence?: string | null
          id?: string
          milestone_id?: string | null
          payment_intent_id?: string | null
          reason?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_disputes_disputed_by_fkey"
            columns: ["disputed_by"]
            isOneToOne: false
            referencedRelation: "feed_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "payment_disputes_disputed_by_fkey"
            columns: ["disputed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "payment_disputes_disputed_by_fkey"
            columns: ["disputed_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "payment_disputes_disputed_by_fkey"
            columns: ["disputed_by"]
            isOneToOne: false
            referencedRelation: "public_profiles_discovery"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "payment_disputes_disputed_by_fkey"
            columns: ["disputed_by"]
            isOneToOne: false
            referencedRelation: "public_profiles_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "payment_disputes_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "milestones"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_history: {
        Row: {
          amount: number
          created_at: string | null
          currency: string
          description: string | null
          id: string
          invoice_id: string | null
          metadata: Json | null
          milestone_id: string | null
          payment_intent_id: string | null
          project_id: string | null
          status: string
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          currency?: string
          description?: string | null
          id?: string
          invoice_id?: string | null
          metadata?: Json | null
          milestone_id?: string | null
          payment_intent_id?: string | null
          project_id?: string | null
          status?: string
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          currency?: string
          description?: string | null
          id?: string
          invoice_id?: string | null
          metadata?: Json | null
          milestone_id?: string | null
          payment_intent_id?: string | null
          project_id?: string | null
          status?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_history_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_history_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "milestones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_history_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_link_payments: {
        Row: {
          amount_cents: number
          created_at: string
          currency: string
          id: string
          paid_at: string | null
          payer_email: string | null
          payer_name: string | null
          payer_note: string | null
          payment_link_id: string
          status: string
          stripe_payment_intent_id: string | null
          stripe_session_id: string | null
          user_id: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          currency?: string
          id?: string
          paid_at?: string | null
          payer_email?: string | null
          payer_name?: string | null
          payer_note?: string | null
          payment_link_id: string
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          user_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          currency?: string
          id?: string
          paid_at?: string | null
          payer_email?: string | null
          payer_name?: string | null
          payer_note?: string | null
          payment_link_id?: string
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_link_payments_payment_link_id_fkey"
            columns: ["payment_link_id"]
            isOneToOne: false
            referencedRelation: "payment_links"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_links: {
        Row: {
          active: boolean
          amount_cents: number | null
          cover_image_url: string | null
          created_at: string
          currency: string
          description: string | null
          id: string
          last_paid_at: string | null
          max_amount_cents: number | null
          max_uses: number | null
          min_amount_cents: number | null
          mode: string
          single_use: boolean
          slug: string
          success_message: string | null
          title: string
          updated_at: string
          use_count: number
          user_id: string
        }
        Insert: {
          active?: boolean
          amount_cents?: number | null
          cover_image_url?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          last_paid_at?: string | null
          max_amount_cents?: number | null
          max_uses?: number | null
          min_amount_cents?: number | null
          mode?: string
          single_use?: boolean
          slug: string
          success_message?: string | null
          title: string
          updated_at?: string
          use_count?: number
          user_id: string
        }
        Update: {
          active?: boolean
          amount_cents?: number | null
          cover_image_url?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          last_paid_at?: string | null
          max_amount_cents?: number | null
          max_uses?: number | null
          min_amount_cents?: number | null
          mode?: string
          single_use?: boolean
          slug?: string
          success_message?: string | null
          title?: string
          updated_at?: string
          use_count?: number
          user_id?: string
        }
        Relationships: []
      }
      pending_discoveries: {
        Row: {
          created_at: string
          dedupe_key: string
          excerpt: string | null
          id: string
          kind: string
          payload: Json
          reviewed_at: string | null
          scan_id: string | null
          source_domain: string | null
          source_url: string
          status: string
          thumbnail_url: string | null
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          dedupe_key: string
          excerpt?: string | null
          id?: string
          kind: string
          payload?: Json
          reviewed_at?: string | null
          scan_id?: string | null
          source_domain?: string | null
          source_url: string
          status?: string
          thumbnail_url?: string | null
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          dedupe_key?: string
          excerpt?: string | null
          id?: string
          kind?: string
          payload?: Json
          reviewed_at?: string | null
          scan_id?: string | null
          source_domain?: string | null
          source_url?: string
          status?: string
          thumbnail_url?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pending_discoveries_scan_id_fkey"
            columns: ["scan_id"]
            isOneToOne: false
            referencedRelation: "discovery_scans"
            referencedColumns: ["id"]
          },
        ]
      }
      pledge_tiers: {
        Row: {
          amount: number
          campaign_id: string
          claimed_count: number
          created_at: string
          description: string | null
          display_order: number
          estimated_delivery: string | null
          id: string
          is_active: boolean
          max_backers: number | null
          reward_type: string | null
          title: string
        }
        Insert: {
          amount: number
          campaign_id: string
          claimed_count?: number
          created_at?: string
          description?: string | null
          display_order?: number
          estimated_delivery?: string | null
          id?: string
          is_active?: boolean
          max_backers?: number | null
          reward_type?: string | null
          title: string
        }
        Update: {
          amount?: number
          campaign_id?: string
          claimed_count?: number
          created_at?: string
          description?: string | null
          display_order?: number
          estimated_delivery?: string | null
          id?: string
          is_active?: boolean
          max_backers?: number | null
          reward_type?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "pledge_tiers_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      pledges: {
        Row: {
          amount: number
          backer_id: string
          backer_message: string | null
          campaign_id: string
          capture_status: string
          captured_at: string | null
          created_at: string
          currency: string
          id: string
          is_anonymous: boolean
          pledged_at: string
          refunded_at: string | null
          shipping_address: Json | null
          stripe_checkout_session_id: string | null
          stripe_payment_intent_id: string | null
          tier_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          backer_id: string
          backer_message?: string | null
          campaign_id: string
          capture_status?: string
          captured_at?: string | null
          created_at?: string
          currency?: string
          id?: string
          is_anonymous?: boolean
          pledged_at?: string
          refunded_at?: string | null
          shipping_address?: Json | null
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          tier_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          backer_id?: string
          backer_message?: string | null
          campaign_id?: string
          capture_status?: string
          captured_at?: string | null
          created_at?: string
          currency?: string
          id?: string
          is_anonymous?: boolean
          pledged_at?: string
          refunded_at?: string | null
          shipping_address?: Json | null
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          tier_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pledges_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pledges_tier_id_fkey"
            columns: ["tier_id"]
            isOneToOne: false
            referencedRelation: "pledge_tiers"
            referencedColumns: ["id"]
          },
        ]
      }
      podcast_episodes: {
        Row: {
          audio_url: string | null
          cover_image_url: string | null
          created_at: string
          description: string | null
          duration_seconds: number | null
          embed_url: string | null
          episode_number: number | null
          guest_name: string | null
          guest_role: string | null
          id: string
          is_published: boolean | null
          published_at: string | null
          season_number: number | null
          show_notes: string | null
          title: string
          transcript: string | null
        }
        Insert: {
          audio_url?: string | null
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          duration_seconds?: number | null
          embed_url?: string | null
          episode_number?: number | null
          guest_name?: string | null
          guest_role?: string | null
          id?: string
          is_published?: boolean | null
          published_at?: string | null
          season_number?: number | null
          show_notes?: string | null
          title: string
          transcript?: string | null
        }
        Update: {
          audio_url?: string | null
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          duration_seconds?: number | null
          embed_url?: string | null
          episode_number?: number | null
          guest_name?: string | null
          guest_role?: string | null
          id?: string
          is_published?: boolean | null
          published_at?: string | null
          season_number?: number | null
          show_notes?: string | null
          title?: string
          transcript?: string | null
        }
        Relationships: []
      }
      portfolio_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          portfolio_item_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          portfolio_item_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          portfolio_item_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      press_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          press_link_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          press_link_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          press_link_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "press_comments_press_link_id_fkey"
            columns: ["press_link_id"]
            isOneToOne: false
            referencedRelation: "press_links"
            referencedColumns: ["id"]
          },
        ]
      }
      press_links: {
        Row: {
          created_at: string
          display_order: number | null
          excerpt: string | null
          id: string
          image_url: string | null
          is_featured: boolean | null
          og_data: Json | null
          publication: string | null
          published_date: string | null
          thumbnail_url: string | null
          title: string
          updated_at: string
          url: string
          user_id: string
          verification_status: string | null
        }
        Insert: {
          created_at?: string
          display_order?: number | null
          excerpt?: string | null
          id?: string
          image_url?: string | null
          is_featured?: boolean | null
          og_data?: Json | null
          publication?: string | null
          published_date?: string | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string
          url: string
          user_id: string
          verification_status?: string | null
        }
        Update: {
          created_at?: string
          display_order?: number | null
          excerpt?: string | null
          id?: string
          image_url?: string | null
          is_featured?: boolean | null
          og_data?: Json | null
          publication?: string | null
          published_date?: string | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          url?: string
          user_id?: string
          verification_status?: string | null
        }
        Relationships: []
      }
      product_purchases: {
        Row: {
          amount: number
          buyer_id: string
          completed_at: string | null
          created_at: string
          currency: string | null
          download_count: number | null
          download_url: string | null
          id: string
          platform_fee: number | null
          product_id: string
          seller_amount: number
          seller_id: string
          status: string | null
          stripe_payment_intent_id: string | null
          stripe_session_id: string | null
        }
        Insert: {
          amount: number
          buyer_id: string
          completed_at?: string | null
          created_at?: string
          currency?: string | null
          download_count?: number | null
          download_url?: string | null
          id?: string
          platform_fee?: number | null
          product_id: string
          seller_amount: number
          seller_id: string
          status?: string | null
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
        }
        Update: {
          amount?: number
          buyer_id?: string
          completed_at?: string | null
          created_at?: string
          currency?: string | null
          download_count?: number | null
          download_url?: string | null
          id?: string
          platform_fee?: number | null
          product_id?: string
          seller_amount?: number
          seller_id?: string
          status?: string | null
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_purchases_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "digital_products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_reviews: {
        Row: {
          created_at: string
          helpful_count: number | null
          id: string
          is_verified_purchase: boolean | null
          product_id: string
          purchase_id: string | null
          rating: number
          review_text: string | null
          reviewer_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          helpful_count?: number | null
          id?: string
          is_verified_purchase?: boolean | null
          product_id: string
          purchase_id?: string | null
          rating: number
          review_text?: string | null
          reviewer_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          helpful_count?: number | null
          id?: string
          is_verified_purchase?: boolean | null
          product_id?: string
          purchase_id?: string | null
          rating?: number
          review_text?: string | null
          reviewer_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "digital_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_reviews_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "product_purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_claim_requests: {
        Row: {
          admin_notes: string | null
          claimant_email: string
          claimant_user_id: string | null
          created_at: string
          id: string
          profile_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          verification_method: string
          verification_proof: string | null
        }
        Insert: {
          admin_notes?: string | null
          claimant_email: string
          claimant_user_id?: string | null
          created_at?: string
          id?: string
          profile_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          verification_method: string
          verification_proof?: string | null
        }
        Update: {
          admin_notes?: string | null
          claimant_email?: string
          claimant_user_id?: string | null
          created_at?: string
          id?: string
          profile_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          verification_method?: string
          verification_proof?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profile_claim_requests_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "feed_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "profile_claim_requests_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "profile_claim_requests_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "profile_claim_requests_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "public_profiles_discovery"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "profile_claim_requests_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "public_profiles_view"
            referencedColumns: ["user_id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_type: Database["public"]["Enums"]["account_type"]
          achievement_badges: string[] | null
          age_verified: boolean
          agency_representation: Json | null
          ambassador_code: string | null
          availability_note: string | null
          availability_status: string | null
          available_from: string | null
          available_invites: number | null
          avatar_url: string | null
          average_rating: number | null
          avg_response_hours: number | null
          avg_views: number | null
          awards: Json | null
          badge: Database["public"]["Enums"]["user_badge"] | null
          behance_url: string | null
          bio: string | null
          bookings_enabled: boolean
          boost_expires_at: string | null
          calendly_url: string | null
          claim_token: string | null
          claimed_at: string | null
          claimed_by: string | null
          collab_intent: string | null
          comp_card_layout: Json | null
          company_about: string | null
          company_address: string | null
          company_images: Json | null
          company_industry: string | null
          company_location_lat: number | null
          company_location_lng: number | null
          company_logo_url: string | null
          company_name: string | null
          company_size: string | null
          company_tagline: string | null
          cover_image_url: string | null
          created_at: string | null
          credit_score: number | null
          current_streak: number | null
          daily_swipes: number | null
          date_of_birth: string | null
          day2_engagement_sent_at: string | null
          day5_engagement_sent_at: string | null
          discogs_verified: boolean | null
          double_xp_expires_at: string | null
          email_verified: boolean
          full_name: string
          google_maps_place_id: string | null
          hourly_rate: number | null
          icdb_creator_id: string | null
          id: string
          id_verification_requested_at: string | null
          id_verified: boolean
          id_verified_at: string | null
          is_discoverable: boolean
          identity_face_verified: boolean
          identity_face_verified_at: string | null
          imdb_url: string | null
          imdb_verified: boolean | null
          imported_data: Json | null
          imported_from_url: string | null
          industry: string | null
          instagram_followers: number | null
          instagram_url: string | null
          instagram_verified: boolean | null
          intent_set_at: string | null
          intent_week_start: string | null
          invite_code_used: string | null
          invited_by: string | null
          is_claimed: boolean | null
          is_hidden_backer: boolean
          is_manager_mode: boolean | null
          job_title: string | null
          last_active_date: string | null
          last_checkin_date: string | null
          last_swipe_reset: string | null
          last_universe_scan_at: string | null
          latitude: number | null
          level: number | null
          linkedin_connections: number | null
          linkedin_url: string | null
          location: string | null
          location_precision:
            | Database["public"]["Enums"]["location_precision"]
            | null
          location_updated_at: string | null
          location_visible: boolean | null
          longest_streak: number | null
          longitude: number | null
          membership_number: string | null
          model_categories: string[] | null
          model_stats: Json | null
          model_unions: string[] | null
          mother_agency: string | null
          mother_agency_verified: boolean | null
          og_promotion_expires_at: string | null
          og_promotion_used: boolean | null
          onboarding_completed: boolean
          onboarding_reminder_sent: boolean | null
          onboarding_started_at: string | null
          onboarding_step: number | null
          partner_code_used: string | null
          partner_location_id: string | null
          passion_skills: Json | null
          passport_profession: string | null
          payment_verified: boolean
          phone_number: string | null
          phone_otp: string | null
          phone_otp_expires_at: string | null
          phone_verified: boolean
          polaroids: Json | null
          portfolio_verified: boolean | null
          preferred_currency: string
          press_links: Json | null
          primary_intent: string | null
          primary_intents: string[] | null
          professional_skills: Json | null
          profile_frame: string | null
          profile_source: string | null
          project_credits: number | null
          project_rate: number | null
          rate_currency: string | null
          rate_range: string | null
          referred_by_ambassador: string | null
          review_share_token: string | null
          role: string
          section_order: Json | null
          site_bio: string | null
          site_custom_blocks: Json | null
          site_enabled: boolean | null
          site_headline: string | null
          site_sections: Json | null
          site_template: string | null
          social_links: Json
          social_verified: boolean | null
          soundcloud_url: string | null
          spotify_listeners: number | null
          spotify_url: string | null
          spotify_verified: boolean | null
          storage_limit_bytes: number | null
          storage_used_bytes: number | null
          streak_count: number | null
          streak_freeze_count: number | null
          stripe_account_id: string | null
          stripe_account_status: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          sub_roles: string[] | null
          subscription_end_date: string | null
          subscription_product_id: string | null
          subscription_status: string | null
          subscription_tier: string | null
          team_member_ids: string[] | null
          tiktok_followers: number | null
          tiktok_url: string | null
          total_engagement_rate: number | null
          total_reviews: number | null
          total_xp: number | null
          tour_completed: boolean | null
          twitter_followers: number | null
          twitter_url: string | null
          ui_vibe: string
          updated_at: string | null
          user_id: string
          username: string | null
          verification_breakdown: Json | null
          verification_notes: string | null
          verification_score: number | null
          verification_status: string | null
          verification_tier: string | null
          verified_at: string | null
          verified_credentials: Json | null
          verified_metrics: boolean | null
          video_intro_url: string | null
          vimeo_url: string | null
          website: string | null
          xp: number | null
          youtube_subscribers: number | null
          youtube_url: string | null
          youtube_verified: boolean | null
        }
        Insert: {
          account_type?: Database["public"]["Enums"]["account_type"]
          achievement_badges?: string[] | null
          age_verified?: boolean
          agency_representation?: Json | null
          ambassador_code?: string | null
          availability_note?: string | null
          availability_status?: string | null
          available_from?: string | null
          available_invites?: number | null
          avatar_url?: string | null
          average_rating?: number | null
          avg_response_hours?: number | null
          avg_views?: number | null
          awards?: Json | null
          badge?: Database["public"]["Enums"]["user_badge"] | null
          behance_url?: string | null
          bio?: string | null
          bookings_enabled?: boolean
          boost_expires_at?: string | null
          calendly_url?: string | null
          claim_token?: string | null
          claimed_at?: string | null
          claimed_by?: string | null
          collab_intent?: string | null
          comp_card_layout?: Json | null
          company_about?: string | null
          company_address?: string | null
          company_images?: Json | null
          company_industry?: string | null
          company_location_lat?: number | null
          company_location_lng?: number | null
          company_logo_url?: string | null
          company_name?: string | null
          company_size?: string | null
          company_tagline?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          credit_score?: number | null
          current_streak?: number | null
          daily_swipes?: number | null
          date_of_birth?: string | null
          day2_engagement_sent_at?: string | null
          day5_engagement_sent_at?: string | null
          discogs_verified?: boolean | null
          double_xp_expires_at?: string | null
          email_verified?: boolean
          full_name: string
          google_maps_place_id?: string | null
          hourly_rate?: number | null
          icdb_creator_id?: string | null
          id?: string
          id_verification_requested_at?: string | null
          id_verified?: boolean
          id_verified_at?: string | null
          is_discoverable?: boolean
          identity_face_verified?: boolean
          identity_face_verified_at?: string | null
          imdb_url?: string | null
          imdb_verified?: boolean | null
          imported_data?: Json | null
          imported_from_url?: string | null
          industry?: string | null
          instagram_followers?: number | null
          instagram_url?: string | null
          instagram_verified?: boolean | null
          intent_set_at?: string | null
          intent_week_start?: string | null
          invite_code_used?: string | null
          invited_by?: string | null
          is_claimed?: boolean | null
          is_hidden_backer?: boolean
          is_manager_mode?: boolean | null
          job_title?: string | null
          last_active_date?: string | null
          last_checkin_date?: string | null
          last_swipe_reset?: string | null
          last_universe_scan_at?: string | null
          latitude?: number | null
          level?: number | null
          linkedin_connections?: number | null
          linkedin_url?: string | null
          location?: string | null
          location_precision?:
            | Database["public"]["Enums"]["location_precision"]
            | null
          location_updated_at?: string | null
          location_visible?: boolean | null
          longest_streak?: number | null
          longitude?: number | null
          membership_number?: string | null
          model_categories?: string[] | null
          model_stats?: Json | null
          model_unions?: string[] | null
          mother_agency?: string | null
          mother_agency_verified?: boolean | null
          og_promotion_expires_at?: string | null
          og_promotion_used?: boolean | null
          onboarding_completed?: boolean
          onboarding_reminder_sent?: boolean | null
          onboarding_started_at?: string | null
          onboarding_step?: number | null
          partner_code_used?: string | null
          partner_location_id?: string | null
          passion_skills?: Json | null
          passport_profession?: string | null
          payment_verified?: boolean
          phone_number?: string | null
          phone_otp?: string | null
          phone_otp_expires_at?: string | null
          phone_verified?: boolean
          polaroids?: Json | null
          portfolio_verified?: boolean | null
          preferred_currency?: string
          press_links?: Json | null
          primary_intent?: string | null
          primary_intents?: string[] | null
          professional_skills?: Json | null
          profile_frame?: string | null
          profile_source?: string | null
          project_credits?: number | null
          project_rate?: number | null
          rate_currency?: string | null
          rate_range?: string | null
          referred_by_ambassador?: string | null
          review_share_token?: string | null
          role: string
          section_order?: Json | null
          site_bio?: string | null
          site_custom_blocks?: Json | null
          site_enabled?: boolean | null
          site_headline?: string | null
          site_sections?: Json | null
          site_template?: string | null
          social_links?: Json
          social_verified?: boolean | null
          soundcloud_url?: string | null
          spotify_listeners?: number | null
          spotify_url?: string | null
          spotify_verified?: boolean | null
          storage_limit_bytes?: number | null
          storage_used_bytes?: number | null
          streak_count?: number | null
          streak_freeze_count?: number | null
          stripe_account_id?: string | null
          stripe_account_status?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          sub_roles?: string[] | null
          subscription_end_date?: string | null
          subscription_product_id?: string | null
          subscription_status?: string | null
          subscription_tier?: string | null
          team_member_ids?: string[] | null
          tiktok_followers?: number | null
          tiktok_url?: string | null
          total_engagement_rate?: number | null
          total_reviews?: number | null
          total_xp?: number | null
          tour_completed?: boolean | null
          twitter_followers?: number | null
          twitter_url?: string | null
          ui_vibe?: string
          updated_at?: string | null
          user_id: string
          username?: string | null
          verification_breakdown?: Json | null
          verification_notes?: string | null
          verification_score?: number | null
          verification_status?: string | null
          verification_tier?: string | null
          verified_at?: string | null
          verified_credentials?: Json | null
          verified_metrics?: boolean | null
          video_intro_url?: string | null
          vimeo_url?: string | null
          website?: string | null
          xp?: number | null
          youtube_subscribers?: number | null
          youtube_url?: string | null
          youtube_verified?: boolean | null
        }
        Update: {
          account_type?: Database["public"]["Enums"]["account_type"]
          achievement_badges?: string[] | null
          age_verified?: boolean
          agency_representation?: Json | null
          ambassador_code?: string | null
          availability_note?: string | null
          availability_status?: string | null
          available_from?: string | null
          available_invites?: number | null
          avatar_url?: string | null
          average_rating?: number | null
          avg_response_hours?: number | null
          avg_views?: number | null
          awards?: Json | null
          badge?: Database["public"]["Enums"]["user_badge"] | null
          behance_url?: string | null
          bio?: string | null
          bookings_enabled?: boolean
          boost_expires_at?: string | null
          calendly_url?: string | null
          claim_token?: string | null
          claimed_at?: string | null
          claimed_by?: string | null
          collab_intent?: string | null
          comp_card_layout?: Json | null
          company_about?: string | null
          company_address?: string | null
          company_images?: Json | null
          company_industry?: string | null
          company_location_lat?: number | null
          company_location_lng?: number | null
          company_logo_url?: string | null
          company_name?: string | null
          company_size?: string | null
          company_tagline?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          credit_score?: number | null
          current_streak?: number | null
          daily_swipes?: number | null
          date_of_birth?: string | null
          day2_engagement_sent_at?: string | null
          day5_engagement_sent_at?: string | null
          discogs_verified?: boolean | null
          double_xp_expires_at?: string | null
          email_verified?: boolean
          full_name?: string
          google_maps_place_id?: string | null
          hourly_rate?: number | null
          icdb_creator_id?: string | null
          id?: string
          id_verification_requested_at?: string | null
          id_verified?: boolean
          id_verified_at?: string | null
          is_discoverable?: boolean
          identity_face_verified?: boolean
          identity_face_verified_at?: string | null
          imdb_url?: string | null
          imdb_verified?: boolean | null
          imported_data?: Json | null
          imported_from_url?: string | null
          industry?: string | null
          instagram_followers?: number | null
          instagram_url?: string | null
          instagram_verified?: boolean | null
          intent_set_at?: string | null
          intent_week_start?: string | null
          invite_code_used?: string | null
          invited_by?: string | null
          is_claimed?: boolean | null
          is_hidden_backer?: boolean
          is_manager_mode?: boolean | null
          job_title?: string | null
          last_active_date?: string | null
          last_checkin_date?: string | null
          last_swipe_reset?: string | null
          last_universe_scan_at?: string | null
          latitude?: number | null
          level?: number | null
          linkedin_connections?: number | null
          linkedin_url?: string | null
          location?: string | null
          location_precision?:
            | Database["public"]["Enums"]["location_precision"]
            | null
          location_updated_at?: string | null
          location_visible?: boolean | null
          longest_streak?: number | null
          longitude?: number | null
          membership_number?: string | null
          model_categories?: string[] | null
          model_stats?: Json | null
          model_unions?: string[] | null
          mother_agency?: string | null
          mother_agency_verified?: boolean | null
          og_promotion_expires_at?: string | null
          og_promotion_used?: boolean | null
          onboarding_completed?: boolean
          onboarding_reminder_sent?: boolean | null
          onboarding_started_at?: string | null
          onboarding_step?: number | null
          partner_code_used?: string | null
          partner_location_id?: string | null
          passion_skills?: Json | null
          passport_profession?: string | null
          payment_verified?: boolean
          phone_number?: string | null
          phone_otp?: string | null
          phone_otp_expires_at?: string | null
          phone_verified?: boolean
          polaroids?: Json | null
          portfolio_verified?: boolean | null
          preferred_currency?: string
          press_links?: Json | null
          primary_intent?: string | null
          primary_intents?: string[] | null
          professional_skills?: Json | null
          profile_frame?: string | null
          profile_source?: string | null
          project_credits?: number | null
          project_rate?: number | null
          rate_currency?: string | null
          rate_range?: string | null
          referred_by_ambassador?: string | null
          review_share_token?: string | null
          role?: string
          section_order?: Json | null
          site_bio?: string | null
          site_custom_blocks?: Json | null
          site_enabled?: boolean | null
          site_headline?: string | null
          site_sections?: Json | null
          site_template?: string | null
          social_links?: Json
          social_verified?: boolean | null
          soundcloud_url?: string | null
          spotify_listeners?: number | null
          spotify_url?: string | null
          spotify_verified?: boolean | null
          storage_limit_bytes?: number | null
          storage_used_bytes?: number | null
          streak_count?: number | null
          streak_freeze_count?: number | null
          stripe_account_id?: string | null
          stripe_account_status?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          sub_roles?: string[] | null
          subscription_end_date?: string | null
          subscription_product_id?: string | null
          subscription_status?: string | null
          subscription_tier?: string | null
          team_member_ids?: string[] | null
          tiktok_followers?: number | null
          tiktok_url?: string | null
          total_engagement_rate?: number | null
          total_reviews?: number | null
          total_xp?: number | null
          tour_completed?: boolean | null
          twitter_followers?: number | null
          twitter_url?: string | null
          ui_vibe?: string
          updated_at?: string | null
          user_id?: string
          username?: string | null
          verification_breakdown?: Json | null
          verification_notes?: string | null
          verification_score?: number | null
          verification_status?: string | null
          verification_tier?: string | null
          verified_at?: string | null
          verified_credentials?: Json | null
          verified_metrics?: boolean | null
          video_intro_url?: string | null
          vimeo_url?: string | null
          website?: string | null
          xp?: number | null
          youtube_subscribers?: number | null
          youtube_url?: string | null
          youtube_verified?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_partner_location_id_fkey"
            columns: ["partner_location_id"]
            isOneToOne: false
            referencedRelation: "partner_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      project_call_sheets: {
        Row: {
          call_time: string | null
          contact_list: Json
          created_at: string
          created_by: string
          id: string
          location_address: string | null
          location_name: string | null
          notes: string | null
          parking_note: string | null
          project_id: string
          shoot_date: string | null
          updated_at: string
          weather_note: string | null
          wrap_time: string | null
        }
        Insert: {
          call_time?: string | null
          contact_list?: Json
          created_at?: string
          created_by: string
          id?: string
          location_address?: string | null
          location_name?: string | null
          notes?: string | null
          parking_note?: string | null
          project_id: string
          shoot_date?: string | null
          updated_at?: string
          weather_note?: string | null
          wrap_time?: string | null
        }
        Update: {
          call_time?: string | null
          contact_list?: Json
          created_at?: string
          created_by?: string
          id?: string
          location_address?: string | null
          location_name?: string | null
          notes?: string | null
          parking_note?: string | null
          project_id?: string
          shoot_date?: string | null
          updated_at?: string
          weather_note?: string | null
          wrap_time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_call_sheets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      engagements: {
        Row: {
          created_at: string
          created_by: string
          id: string
          mode: string
          org_id: string | null
          project_id: string
          source_application_id: string | null
          source_match_id: string | null
          source_opportunity_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          mode: string
          org_id?: string | null
          project_id: string
          source_application_id?: string | null
          source_match_id?: string | null
          source_opportunity_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          mode?: string
          org_id?: string | null
          project_id?: string
          source_application_id?: string | null
          source_match_id?: string | null
          source_opportunity_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "engagements_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagements_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagements_source_opportunity_id_fkey"
            columns: ["source_opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagements_source_application_id_fkey"
            columns: ["source_application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagements_source_match_id_fkey"
            columns: ["source_match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      project_collaborators: {
        Row: {
          accepted_at: string | null
          agent_role: string | null
          created_at: string
          email: string | null
          id: string
          invited_at: string
          invited_by: string
          project_id: string
          role: string
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          accepted_at?: string | null
          agent_role?: string | null
          created_at?: string
          email?: string | null
          id?: string
          invited_at?: string
          invited_by: string
          project_id: string
          role?: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          accepted_at?: string | null
          agent_role?: string | null
          created_at?: string
          email?: string | null
          id?: string
          invited_at?: string
          invited_by?: string
          project_id?: string
          role?: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_collaborators_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "feed_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "project_collaborators_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "project_collaborators_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "project_collaborators_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "public_profiles_discovery"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "project_collaborators_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "public_profiles_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "project_collaborators_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_contracts: {
        Row: {
          blockchain_network: string | null
          blockchain_tx_hash: string | null
          blockchain_verified_at: string | null
          contract_hash: string | null
          contract_type: string
          created_at: string
          created_by: string
          currency: string
          description: string | null
          expires_at: string | null
          id: string
          party_a_ip: string | null
          party_a_signed_at: string | null
          party_a_user_id: string
          party_b_ip: string | null
          party_b_signed_at: string | null
          party_b_user_id: string | null
          project_id: string
          signed_pdf_url: string | null
          status: string
          template_id: string | null
          terms: Json
          title: string
          total_amount: number | null
          updated_at: string
        }
        Insert: {
          blockchain_network?: string | null
          blockchain_tx_hash?: string | null
          blockchain_verified_at?: string | null
          contract_hash?: string | null
          contract_type?: string
          created_at?: string
          created_by: string
          currency?: string
          description?: string | null
          expires_at?: string | null
          id?: string
          party_a_ip?: string | null
          party_a_signed_at?: string | null
          party_a_user_id: string
          party_b_ip?: string | null
          party_b_signed_at?: string | null
          party_b_user_id?: string | null
          project_id: string
          signed_pdf_url?: string | null
          status?: string
          template_id?: string | null
          terms?: Json
          title: string
          total_amount?: number | null
          updated_at?: string
        }
        Update: {
          blockchain_network?: string | null
          blockchain_tx_hash?: string | null
          blockchain_verified_at?: string | null
          contract_hash?: string | null
          contract_type?: string
          created_at?: string
          created_by?: string
          currency?: string
          description?: string | null
          expires_at?: string | null
          id?: string
          party_a_ip?: string | null
          party_a_signed_at?: string | null
          party_a_user_id?: string
          party_b_ip?: string | null
          party_b_signed_at?: string | null
          party_b_user_id?: string | null
          project_id?: string
          signed_pdf_url?: string | null
          status?: string
          template_id?: string | null
          terms?: Json
          title?: string
          total_amount?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_contracts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_contracts_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "contract_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      project_credits: {
        Row: {
          assigned_by: string
          confirmed_at: string | null
          created_at: string
          credit_id: string | null
          id: string
          project_id: string
          role: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_by: string
          confirmed_at?: string | null
          created_at?: string
          credit_id?: string | null
          id?: string
          project_id: string
          role: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_by?: string
          confirmed_at?: string | null
          created_at?: string
          credit_id?: string | null
          id?: string
          project_id?: string
          role?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_credits_credit_id_fkey"
            columns: ["credit_id"]
            isOneToOne: false
            referencedRelation: "credits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_credits_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_deliverables: {
        Row: {
          assignee_id: string | null
          created_at: string
          description: string | null
          due_date: string | null
          external_id: string | null
          external_url: string | null
          file_id: string | null
          file_url: string | null
          id: string
          import_job_id: string | null
          imported_at: string | null
          kind: string | null
          media_type: string | null
          milestone_id: string | null
          moodboard: Json
          project_id: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          sort_order: number
          source: string
          source_provider: string | null
          status: string
          submission_files: Json | null
          submitted_by: string | null
          thumbnail_url: string | null
          title: string
          updated_at: string
          version: number
        }
        Insert: {
          assignee_id?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          external_id?: string | null
          external_url?: string | null
          file_id?: string | null
          file_url?: string | null
          id?: string
          import_job_id?: string | null
          imported_at?: string | null
          kind?: string | null
          media_type?: string | null
          milestone_id?: string | null
          moodboard?: Json
          project_id: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          sort_order?: number
          source?: string
          source_provider?: string | null
          status?: string
          submission_files?: Json | null
          submitted_by?: string | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string
          version?: number
        }
        Update: {
          assignee_id?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          external_id?: string | null
          external_url?: string | null
          file_id?: string | null
          file_url?: string | null
          id?: string
          import_job_id?: string | null
          imported_at?: string | null
          kind?: string | null
          media_type?: string | null
          milestone_id?: string | null
          moodboard?: Json
          project_id?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          sort_order?: number
          source?: string
          source_provider?: string | null
          status?: string
          submission_files?: Json | null
          submitted_by?: string | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "project_deliverables_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "project_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_deliverables_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_exchange_terms: {
        Row: {
          created_at: string
          created_by: string
          currency: string | null
          delivered: boolean
          estimated_value: number | null
          id: string
          notes: string | null
          project_id: string
          proof_required: Json
          received: boolean
          updated_at: string
          what_i_get: string | null
          what_i_give: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          currency?: string | null
          delivered?: boolean
          estimated_value?: number | null
          id?: string
          notes?: string | null
          project_id: string
          proof_required?: Json
          received?: boolean
          updated_at?: string
          what_i_get?: string | null
          what_i_give?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          currency?: string | null
          delivered?: boolean
          estimated_value?: number | null
          id?: string
          notes?: string | null
          project_id?: string
          proof_required?: Json
          received?: boolean
          updated_at?: string
          what_i_get?: string | null
          what_i_give?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_exchange_terms_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_file_folders: {
        Row: {
          created_at: string
          created_by: string
          id: string
          name: string
          parent_id: string | null
          project_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          name: string
          parent_id?: string | null
          project_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          parent_id?: string | null
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_file_folders_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "project_file_folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_file_folders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_files: {
        Row: {
          created_at: string | null
          external_id: string | null
          external_url: string | null
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          folder_id: string | null
          id: string
          import_job_id: string | null
          imported_at: string | null
          is_link: boolean
          link_provider: string | null
          link_thumbnail_url: string | null
          project_id: string
          source_provider: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          external_id?: string | null
          external_url?: string | null
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          folder_id?: string | null
          id?: string
          import_job_id?: string | null
          imported_at?: string | null
          is_link?: boolean
          link_provider?: string | null
          link_thumbnail_url?: string | null
          project_id: string
          source_provider?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          external_id?: string | null
          external_url?: string | null
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          folder_id?: string | null
          id?: string
          import_job_id?: string | null
          imported_at?: string | null
          is_link?: boolean
          link_provider?: string | null
          link_thumbnail_url?: string | null
          project_id?: string
          source_provider?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_files_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "project_file_folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_files_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_files_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "feed_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "project_files_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "project_files_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "project_files_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles_discovery"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "project_files_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles_view"
            referencedColumns: ["user_id"]
          },
        ]
      }
      project_guest_links: {
        Row: {
          created_at: string
          created_by: string
          expires_at: string | null
          guest_role: string
          id: string
          label: string | null
          max_uses: number | null
          permissions: Json
          project_id: string
          revoked_at: string | null
          token: string
          updated_at: string
          uses: number
        }
        Insert: {
          created_at?: string
          created_by: string
          expires_at?: string | null
          guest_role?: string
          id?: string
          label?: string | null
          max_uses?: number | null
          permissions?: Json
          project_id: string
          revoked_at?: string | null
          token: string
          updated_at?: string
          uses?: number
        }
        Update: {
          created_at?: string
          created_by?: string
          expires_at?: string | null
          guest_role?: string
          id?: string
          label?: string | null
          max_uses?: number | null
          permissions?: Json
          project_id?: string
          revoked_at?: string | null
          token?: string
          updated_at?: string
          uses?: number
        }
        Relationships: [
          {
            foreignKeyName: "project_guest_links_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_messages: {
        Row: {
          attachments: Json
          created_at: string | null
          external_author_name: string | null
          external_channel: string | null
          external_id: string | null
          external_url: string | null
          file_name: string | null
          file_size: number | null
          file_type: string | null
          file_url: string | null
          id: string
          import_job_id: string | null
          imported_at: string | null
          is_imported: boolean
          is_pinned: boolean | null
          message: string
          project_id: string
          reply_to: string | null
          source_created_at: string | null
          source_provider: string | null
          user_id: string | null
          voice_duration: number | null
          voice_transcript: string | null
          voice_url: string | null
        }
        Insert: {
          attachments?: Json
          created_at?: string | null
          external_author_name?: string | null
          external_channel?: string | null
          external_id?: string | null
          external_url?: string | null
          file_name?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          import_job_id?: string | null
          imported_at?: string | null
          is_imported?: boolean
          is_pinned?: boolean | null
          message: string
          project_id: string
          reply_to?: string | null
          source_created_at?: string | null
          source_provider?: string | null
          user_id?: string | null
          voice_duration?: number | null
          voice_transcript?: string | null
          voice_url?: string | null
        }
        Update: {
          attachments?: Json
          created_at?: string | null
          external_author_name?: string | null
          external_channel?: string | null
          external_id?: string | null
          external_url?: string | null
          file_name?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          import_job_id?: string | null
          imported_at?: string | null
          is_imported?: boolean
          is_pinned?: boolean | null
          message?: string
          project_id?: string
          reply_to?: string | null
          source_created_at?: string | null
          source_provider?: string | null
          user_id?: string | null
          voice_duration?: number | null
          voice_transcript?: string | null
          voice_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_messages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_messages_reply_to_fkey"
            columns: ["reply_to"]
            isOneToOne: false
            referencedRelation: "project_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "feed_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "project_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "project_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "project_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles_discovery"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "project_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles_view"
            referencedColumns: ["user_id"]
          },
        ]
      }
      project_notes: {
        Row: {
          content: string | null
          created_at: string
          created_by: string
          external_id: string | null
          external_url: string | null
          id: string
          import_job_id: string | null
          imported_at: string | null
          is_read_only: boolean
          project_id: string
          source_provider: string | null
          title: string
          updated_at: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          created_by?: string
          external_id?: string | null
          external_url?: string | null
          id?: string
          import_job_id?: string | null
          imported_at?: string | null
          is_read_only?: boolean
          project_id: string
          source_provider?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          content?: string | null
          created_at?: string
          created_by?: string
          external_id?: string | null
          external_url?: string | null
          id?: string
          import_job_id?: string | null
          imported_at?: string | null
          is_read_only?: boolean
          project_id?: string
          source_provider?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_notes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_pins: {
        Row: {
          color: string
          content: string | null
          created_at: string
          created_by: string
          generated_by_ai: boolean
          id: string
          image_url: string | null
          kind: string
          pos_x: number
          pos_y: number
          project_id: string
          rotation: number
          updated_at: string
          z_index: number
        }
        Insert: {
          color?: string
          content?: string | null
          created_at?: string
          created_by: string
          generated_by_ai?: boolean
          id?: string
          image_url?: string | null
          kind?: string
          pos_x?: number
          pos_y?: number
          project_id: string
          rotation?: number
          updated_at?: string
          z_index?: number
        }
        Update: {
          color?: string
          content?: string | null
          created_at?: string
          created_by?: string
          generated_by_ai?: boolean
          id?: string
          image_url?: string | null
          kind?: string
          pos_x?: number
          pos_y?: number
          project_id?: string
          rotation?: number
          updated_at?: string
          z_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "project_pins_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_revisions: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          project_id: string
          requested_by: string
          resolved_at: string | null
          round_number: number
          status: string
          title: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          project_id: string
          requested_by: string
          resolved_at?: string | null
          round_number?: number
          status?: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          project_id?: string
          requested_by?: string
          resolved_at?: string | null
          round_number?: number
          status?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_revisions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_roll_call: {
        Row: {
          arrived_at: string | null
          created_at: string
          created_by: string
          id: string
          notes: string | null
          person_contact: string | null
          person_name: string
          person_role: string | null
          person_user_id: string | null
          project_id: string
          status: string
          updated_at: string
        }
        Insert: {
          arrived_at?: string | null
          created_at?: string
          created_by: string
          id?: string
          notes?: string | null
          person_contact?: string | null
          person_name: string
          person_role?: string | null
          person_user_id?: string | null
          project_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          arrived_at?: string | null
          created_at?: string
          created_by?: string
          id?: string
          notes?: string | null
          person_contact?: string | null
          person_name?: string
          person_role?: string | null
          person_user_id?: string | null
          project_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_roll_call_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_run_of_show: {
        Row: {
          created_at: string
          created_by: string
          duration_min: number | null
          id: string
          notes: string | null
          owner_id: string | null
          position: number
          project_id: string
          segment_title: string
          time_slot: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          duration_min?: number | null
          id?: string
          notes?: string | null
          owner_id?: string | null
          position?: number
          project_id: string
          segment_title: string
          time_slot?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          duration_min?: number | null
          id?: string
          notes?: string | null
          owner_id?: string | null
          position?: number
          project_id?: string
          segment_title?: string
          time_slot?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_run_of_show_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_setup_state: {
        Row: {
          answers: Json
          created_at: string
          current_step: number
          id: string
          project_id: string
          updated_at: string
        }
        Insert: {
          answers?: Json
          created_at?: string
          current_step?: number
          id?: string
          project_id: string
          updated_at?: string
        }
        Update: {
          answers?: Json
          created_at?: string
          current_step?: number
          id?: string
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_setup_state_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_share_links: {
        Row: {
          can_approve: boolean
          can_comment: boolean
          can_download: boolean
          created_at: string
          created_by: string
          expires_at: string | null
          id: string
          label: string | null
          last_viewed_at: string | null
          password_hash: string | null
          project_id: string
          revoked_at: string | null
          scope: string
          scope_ref_id: string | null
          token: string
          updated_at: string
          view_count: number
        }
        Insert: {
          can_approve?: boolean
          can_comment?: boolean
          can_download?: boolean
          created_at?: string
          created_by: string
          expires_at?: string | null
          id?: string
          label?: string | null
          last_viewed_at?: string | null
          password_hash?: string | null
          project_id: string
          revoked_at?: string | null
          scope?: string
          scope_ref_id?: string | null
          token?: string
          updated_at?: string
          view_count?: number
        }
        Update: {
          can_approve?: boolean
          can_comment?: boolean
          can_download?: boolean
          created_at?: string
          created_by?: string
          expires_at?: string | null
          id?: string
          label?: string | null
          last_viewed_at?: string | null
          password_hash?: string | null
          project_id?: string
          revoked_at?: string | null
          scope?: string
          scope_ref_id?: string | null
          token?: string
          updated_at?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "project_share_links_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_split_sheets: {
        Row: {
          contributor_name: string
          contributor_role: string | null
          contributor_user_id: string | null
          created_at: string
          created_by: string
          id: string
          notes: string | null
          percentage: number
          pro_affiliation: string | null
          project_id: string
          publisher: string | null
          signed: boolean
          signed_at: string | null
          updated_at: string
        }
        Insert: {
          contributor_name: string
          contributor_role?: string | null
          contributor_user_id?: string | null
          created_at?: string
          created_by: string
          id?: string
          notes?: string | null
          percentage?: number
          pro_affiliation?: string | null
          project_id: string
          publisher?: string | null
          signed?: boolean
          signed_at?: string | null
          updated_at?: string
        }
        Update: {
          contributor_name?: string
          contributor_role?: string | null
          contributor_user_id?: string | null
          created_at?: string
          created_by?: string
          id?: string
          notes?: string | null
          percentage?: number
          pro_affiliation?: string | null
          project_id?: string
          publisher?: string | null
          signed?: boolean
          signed_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_split_sheets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_tasks: {
        Row: {
          assigned_to: string | null
          created_at: string | null
          created_by: string
          description: string | null
          due_date: string | null
          external_id: string | null
          external_url: string | null
          id: string
          import_job_id: string | null
          imported_at: string | null
          labels: string[]
          priority: string
          project_id: string
          source_provider: string | null
          status: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string | null
          created_by: string
          description?: string | null
          due_date?: string | null
          external_id?: string | null
          external_url?: string | null
          id?: string
          import_job_id?: string | null
          imported_at?: string | null
          labels?: string[]
          priority?: string
          project_id: string
          source_provider?: string | null
          status?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          created_at?: string | null
          created_by?: string
          description?: string | null
          due_date?: string | null
          external_id?: string | null
          external_url?: string | null
          id?: string
          import_job_id?: string | null
          imported_at?: string | null
          labels?: string[]
          priority?: string
          project_id?: string
          source_provider?: string | null
          status?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_templates: {
        Row: {
          category: string
          color: string | null
          complexity: string | null
          created_at: string | null
          created_by: string
          description: string | null
          estimated_duration: string | null
          icon: string | null
          id: string
          is_public: boolean | null
          milestones: Json | null
          name: string
          structure: Json
          tasks: Json | null
          thumbnail_url: string | null
          updated_at: string | null
          usage_count: number | null
        }
        Insert: {
          category: string
          color?: string | null
          complexity?: string | null
          created_at?: string | null
          created_by: string
          description?: string | null
          estimated_duration?: string | null
          icon?: string | null
          id?: string
          is_public?: boolean | null
          milestones?: Json | null
          name: string
          structure: Json
          tasks?: Json | null
          thumbnail_url?: string | null
          updated_at?: string | null
          usage_count?: number | null
        }
        Update: {
          category?: string
          color?: string | null
          complexity?: string | null
          created_at?: string | null
          created_by?: string
          description?: string | null
          estimated_duration?: string | null
          icon?: string | null
          id?: string
          is_public?: boolean | null
          milestones?: Json | null
          name?: string
          structure?: Json
          tasks?: Json | null
          thumbnail_url?: string | null
          updated_at?: string | null
          usage_count?: number | null
        }
        Relationships: []
      }
      project_time_entries: {
        Row: {
          billed_invoice_id: string | null
          created_at: string
          currency: string | null
          duration_seconds: number | null
          ended_at: string | null
          hourly_rate: number | null
          id: string
          note: string | null
          project_id: string
          started_at: string
          user_id: string
        }
        Insert: {
          billed_invoice_id?: string | null
          created_at?: string
          currency?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          hourly_rate?: number | null
          id?: string
          note?: string | null
          project_id: string
          started_at?: string
          user_id: string
        }
        Update: {
          billed_invoice_id?: string | null
          created_at?: string
          currency?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          hourly_rate?: number | null
          id?: string
          note?: string | null
          project_id?: string
          started_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_time_entries_billed_invoice_id_fkey"
            columns: ["billed_invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_time_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_video_calls: {
        Row: {
          created_at: string
          duration_seconds: number | null
          ended_at: string | null
          id: string
          participants: Json
          project_id: string
          recording_id: string | null
          room_url: string
          started_at: string
          started_by: string
        }
        Insert: {
          created_at?: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          participants?: Json
          project_id: string
          recording_id?: string | null
          room_url: string
          started_at?: string
          started_by: string
        }
        Update: {
          created_at?: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          participants?: Json
          project_id?: string
          recording_id?: string | null
          room_url?: string
          started_at?: string
          started_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_video_calls_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          agent_mode: boolean
          agent_user_id: string | null
          budget: string | null
          client_id: string | null
          client_name: string | null
          client_price: number | null
          client_user_id: string | null
          cover_url: string | null
          created_at: string | null
          created_by: string
          creative_payout: number | null
          creative_user_ids: string[] | null
          currency: string
          deadline: string | null
          deal_type: string
          description: string | null
          event_id: string | null
          id: string
          margin_type: string | null
          margin_value: number | null
          match_id: string | null
          mood: string | null
          pinned_stage: string | null
          recap_published: boolean
          recap_summary: string | null
          recap_token: string | null
          setup_completed: boolean
          spark_room_id: string | null
          status: string | null
          studio_folder_id: string | null
          title: string
          track_as_credit: boolean
          updated_at: string | null
          video_room_started_at: string | null
          video_room_started_by: string | null
          video_room_url: string | null
          workspace_type: string
        }
        Insert: {
          agent_mode?: boolean
          agent_user_id?: string | null
          budget?: string | null
          client_id?: string | null
          client_name?: string | null
          client_price?: number | null
          client_user_id?: string | null
          cover_url?: string | null
          created_at?: string | null
          created_by: string
          creative_payout?: number | null
          creative_user_ids?: string[] | null
          currency?: string
          deadline?: string | null
          deal_type?: string
          description?: string | null
          event_id?: string | null
          id?: string
          margin_type?: string | null
          margin_value?: number | null
          match_id?: string | null
          mood?: string | null
          pinned_stage?: string | null
          recap_published?: boolean
          recap_summary?: string | null
          recap_token?: string | null
          setup_completed?: boolean
          spark_room_id?: string | null
          status?: string | null
          studio_folder_id?: string | null
          title: string
          track_as_credit?: boolean
          updated_at?: string | null
          video_room_started_at?: string | null
          video_room_started_by?: string | null
          video_room_url?: string | null
          workspace_type?: string
        }
        Update: {
          agent_mode?: boolean
          agent_user_id?: string | null
          budget?: string | null
          client_id?: string | null
          client_name?: string | null
          client_price?: number | null
          client_user_id?: string | null
          cover_url?: string | null
          created_at?: string | null
          created_by?: string
          creative_payout?: number | null
          creative_user_ids?: string[] | null
          currency?: string
          deadline?: string | null
          deal_type?: string
          description?: string | null
          event_id?: string | null
          id?: string
          margin_type?: string | null
          margin_value?: number | null
          match_id?: string | null
          mood?: string | null
          pinned_stage?: string | null
          recap_published?: boolean
          recap_summary?: string | null
          recap_token?: string | null
          setup_completed?: boolean
          spark_room_id?: string | null
          status?: string | null
          studio_folder_id?: string | null
          title?: string
          track_as_credit?: boolean
          updated_at?: string | null
          video_room_started_at?: string | null
          video_room_started_by?: string | null
          video_room_url?: string | null
          workspace_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "creative_jams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_spark_room_id_fkey"
            columns: ["spark_room_id"]
            isOneToOne: false
            referencedRelation: "spark_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_studio_folder_id_fkey"
            columns: ["studio_folder_id"]
            isOneToOne: false
            referencedRelation: "studio_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string | null
          endpoint: string
          id: string
          p256dh: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string | null
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string | null
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      recipient_bank_accounts: {
        Row: {
          account_holder_name: string
          account_number: string
          bank_name: string
          branch: string | null
          country: string
          created_at: string
          currency: string
          id: string
          instructions: string | null
          is_active: boolean
          is_default: boolean
          label: string
          routing_number: string | null
          swift_code: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_holder_name: string
          account_number: string
          bank_name: string
          branch?: string | null
          country?: string
          created_at?: string
          currency?: string
          id?: string
          instructions?: string | null
          is_active?: boolean
          is_default?: boolean
          label: string
          routing_number?: string | null
          swift_code?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_holder_name?: string
          account_number?: string
          bank_name?: string
          branch?: string | null
          country?: string
          created_at?: string
          currency?: string
          id?: string
          instructions?: string | null
          is_active?: boolean
          is_default?: boolean
          label?: string
          routing_number?: string | null
          swift_code?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipient_bank_accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "feed_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "recipient_bank_accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "recipient_bank_accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "recipient_bank_accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles_discovery"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "recipient_bank_accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles_view"
            referencedColumns: ["user_id"]
          },
        ]
      }
      referral_chain: {
        Row: {
          chain_root_id: string | null
          depth: number
          has_completed_onboarding: boolean
          has_pro_subscription: boolean
          id: string
          is_active: boolean
          referred_at: string
          referred_id: string
          referrer_id: string
        }
        Insert: {
          chain_root_id?: string | null
          depth?: number
          has_completed_onboarding?: boolean
          has_pro_subscription?: boolean
          id?: string
          is_active?: boolean
          referred_at?: string
          referred_id: string
          referrer_id: string
        }
        Update: {
          chain_root_id?: string | null
          depth?: number
          has_completed_onboarding?: boolean
          has_pro_subscription?: boolean
          id?: string
          is_active?: boolean
          referred_at?: string
          referred_id?: string
          referrer_id?: string
        }
        Relationships: []
      }
      referral_commissions: {
        Row: {
          commission_amount: number
          commission_rate: number
          created_at: string
          currency: string
          gross_amount: number
          id: string
          manager_id: string
          paid_at: string | null
          source_id: string | null
          source_type: string
          status: string
          talent_user_id: string
        }
        Insert: {
          commission_amount: number
          commission_rate: number
          created_at?: string
          currency?: string
          gross_amount: number
          id?: string
          manager_id: string
          paid_at?: string | null
          source_id?: string | null
          source_type?: string
          status?: string
          talent_user_id: string
        }
        Update: {
          commission_amount?: number
          commission_rate?: number
          created_at?: string
          currency?: string
          gross_amount?: number
          id?: string
          manager_id?: string
          paid_at?: string | null
          source_id?: string | null
          source_type?: string
          status?: string
          talent_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_commissions_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "talent_managers"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_network: {
        Row: {
          active_referral_count: number
          commission_earned: number
          commission_paid: number
          commission_rate: number
          created_at: string
          fee_discount_percent: number
          free_pro_months_earned: number
          free_pro_months_used: number
          id: string
          longest_chain: number
          network_tier: Database["public"]["Enums"]["network_tier"]
          referral_count: number
          status_bonus_points: number
          total_network_size: number
          updated_at: string
          user_id: string
        }
        Insert: {
          active_referral_count?: number
          commission_earned?: number
          commission_paid?: number
          commission_rate?: number
          created_at?: string
          fee_discount_percent?: number
          free_pro_months_earned?: number
          free_pro_months_used?: number
          id?: string
          longest_chain?: number
          network_tier?: Database["public"]["Enums"]["network_tier"]
          referral_count?: number
          status_bonus_points?: number
          total_network_size?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          active_referral_count?: number
          commission_earned?: number
          commission_paid?: number
          commission_rate?: number
          created_at?: string
          fee_discount_percent?: number
          free_pro_months_earned?: number
          free_pro_months_used?: number
          id?: string
          longest_chain?: number
          network_tier?: Database["public"]["Enums"]["network_tier"]
          referral_count?: number
          status_bonus_points?: number
          total_network_size?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      review_requests: {
        Row: {
          completed_at: string | null
          created_at: string | null
          expires_at: string | null
          id: string
          personal_message: string | null
          profile_id: string
          project_name: string | null
          reviewer_email: string | null
          reviewer_name: string | null
          share_token: string
          status: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          personal_message?: string | null
          profile_id: string
          project_name?: string | null
          reviewer_email?: string | null
          reviewer_name?: string | null
          share_token?: string
          status?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          personal_message?: string | null
          profile_id?: string
          project_name?: string | null
          reviewer_email?: string | null
          reviewer_name?: string | null
          share_token?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "review_requests_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "feed_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "review_requests_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "review_requests_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "review_requests_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "public_profiles_discovery"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "review_requests_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "public_profiles_view"
            referencedColumns: ["user_id"]
          },
        ]
      }
      reviews: {
        Row: {
          collaboration_type: string | null
          created_at: string
          id: string
          is_endorsed: boolean | null
          is_verified: boolean | null
          profile_id: string
          project_name: string | null
          rating: number | null
          review_text: string
          reviewer_avatar_url: string | null
          reviewer_company: string | null
          reviewer_email: string | null
          reviewer_id: string | null
          reviewer_name: string
          reviewer_role: string | null
          status: string | null
          submission_token: string | null
          updated_at: string
        }
        Insert: {
          collaboration_type?: string | null
          created_at?: string
          id?: string
          is_endorsed?: boolean | null
          is_verified?: boolean | null
          profile_id: string
          project_name?: string | null
          rating?: number | null
          review_text: string
          reviewer_avatar_url?: string | null
          reviewer_company?: string | null
          reviewer_email?: string | null
          reviewer_id?: string | null
          reviewer_name: string
          reviewer_role?: string | null
          status?: string | null
          submission_token?: string | null
          updated_at?: string
        }
        Update: {
          collaboration_type?: string | null
          created_at?: string
          id?: string
          is_endorsed?: boolean | null
          is_verified?: boolean | null
          profile_id?: string
          project_name?: string | null
          rating?: number | null
          review_text?: string
          reviewer_avatar_url?: string | null
          reviewer_company?: string | null
          reviewer_email?: string | null
          reviewer_id?: string | null
          reviewer_name?: string
          reviewer_role?: string | null
          status?: string | null
          submission_token?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "feed_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "reviews_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "reviews_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "reviews_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "public_profiles_discovery"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "reviews_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "public_profiles_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "feed_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "public_profiles_discovery"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "public_profiles_view"
            referencedColumns: ["user_id"]
          },
        ]
      }
      room_knocks: {
        Row: {
          created_at: string
          expires_at: string
          guest_email: string | null
          guest_name: string
          guest_token: string
          guest_user_id: string | null
          id: string
          meeting_id: string | null
          message: string | null
          owner_id: string
          share_url: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          guest_email?: string | null
          guest_name: string
          guest_token?: string
          guest_user_id?: string | null
          id?: string
          meeting_id?: string | null
          message?: string | null
          owner_id: string
          share_url?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          guest_email?: string | null
          guest_name?: string
          guest_token?: string
          guest_user_id?: string | null
          id?: string
          meeting_id?: string | null
          message?: string | null
          owner_id?: string
          share_url?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      saved_bank_accounts: {
        Row: {
          account_name: string
          account_number: string
          bank_name: string
          created_at: string
          id: string
          is_default: boolean
          label: string | null
          routing_number: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_name: string
          account_number: string
          bank_name: string
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string | null
          routing_number?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_name?: string
          account_number?: string
          bank_name?: string
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string | null
          routing_number?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      saved_creator_searches: {
        Row: {
          alerts_enabled: boolean
          created_at: string
          filters: Json
          id: string
          last_alert_at: string | null
          name: string
          query: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          alerts_enabled?: boolean
          created_at?: string
          filters?: Json
          id?: string
          last_alert_at?: string | null
          name: string
          query?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          alerts_enabled?: boolean
          created_at?: string
          filters?: Json
          id?: string
          last_alert_at?: string | null
          name?: string
          query?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      saved_opportunities: {
        Row: {
          created_at: string | null
          id: string
          notes: string | null
          opportunity_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          notes?: string | null
          opportunity_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          notes?: string | null
          opportunity_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_opportunities_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_sparks: {
        Row: {
          created_at: string
          id: string
          item_id: string
          item_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          item_type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          item_type?: string
          user_id?: string
        }
        Relationships: []
      }
      scout_preferences: {
        Row: {
          created_at: string
          employment_types: string[] | null
          enabled: boolean
          exclude_keywords: string[] | null
          extra_keywords: string[] | null
          instructions: string | null
          job_types: string[] | null
          last_run_at: string | null
          locations: string[] | null
          min_fit_score: number | null
          remote_only: boolean | null
          sources: string[]
          travel_ok: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          employment_types?: string[] | null
          enabled?: boolean
          exclude_keywords?: string[] | null
          extra_keywords?: string[] | null
          instructions?: string | null
          job_types?: string[] | null
          last_run_at?: string | null
          locations?: string[] | null
          min_fit_score?: number | null
          remote_only?: boolean | null
          sources?: string[]
          travel_ok?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          employment_types?: string[] | null
          enabled?: boolean
          exclude_keywords?: string[] | null
          extra_keywords?: string[] | null
          instructions?: string | null
          job_types?: string[] | null
          last_run_at?: string | null
          locations?: string[] | null
          min_fit_score?: number | null
          remote_only?: boolean | null
          sources?: string[]
          travel_ok?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      scout_runs: {
        Row: {
          duration_ms: number | null
          error: string | null
          finished_at: string | null
          found_count: number | null
          id: string
          inserted_count: number | null
          sources: string[] | null
          started_at: string
          trigger: string
          user_id: string | null
        }
        Insert: {
          duration_ms?: number | null
          error?: string | null
          finished_at?: string | null
          found_count?: number | null
          id?: string
          inserted_count?: number | null
          sources?: string[] | null
          started_at?: string
          trigger: string
          user_id?: string | null
        }
        Update: {
          duration_ms?: number | null
          error?: string | null
          finished_at?: string | null
          found_count?: number | null
          id?: string
          inserted_count?: number | null
          sources?: string[] | null
          started_at?: string
          trigger?: string
          user_id?: string | null
        }
        Relationships: []
      }
      scouted_gig_actions: {
        Row: {
          action: string
          cover_letter: string | null
          created_at: string
          id: string
          outcome: string | null
          scouted_gig_id: string
          user_id: string
        }
        Insert: {
          action: string
          cover_letter?: string | null
          created_at?: string
          id?: string
          outcome?: string | null
          scouted_gig_id: string
          user_id: string
        }
        Update: {
          action?: string
          cover_letter?: string | null
          created_at?: string
          id?: string
          outcome?: string | null
          scouted_gig_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scouted_gig_actions_scouted_gig_id_fkey"
            columns: ["scouted_gig_id"]
            isOneToOne: false
            referencedRelation: "scouted_gigs"
            referencedColumns: ["id"]
          },
        ]
      }
      scouted_gigs: {
        Row: {
          apply_url: string | null
          company: string | null
          compensation: string | null
          contact_email: string | null
          deadline: string | null
          dedupe_key: string
          description: string | null
          details_fetched_at: string | null
          expires_at: string
          fit_reason: string | null
          fit_score: number
          full_description: string | null
          id: string
          image_url: string | null
          location: string | null
          posted_at: string | null
          raw: Json | null
          remote: boolean | null
          scouted_at: string
          skills: string[] | null
          source: string
          source_name: string | null
          source_url: string
          tags: string[] | null
          target_user_id: string
          title: string
        }
        Insert: {
          apply_url?: string | null
          company?: string | null
          compensation?: string | null
          contact_email?: string | null
          deadline?: string | null
          dedupe_key: string
          description?: string | null
          details_fetched_at?: string | null
          expires_at?: string
          fit_reason?: string | null
          fit_score?: number
          full_description?: string | null
          id?: string
          image_url?: string | null
          location?: string | null
          posted_at?: string | null
          raw?: Json | null
          remote?: boolean | null
          scouted_at?: string
          skills?: string[] | null
          source: string
          source_name?: string | null
          source_url: string
          tags?: string[] | null
          target_user_id: string
          title: string
        }
        Update: {
          apply_url?: string | null
          company?: string | null
          compensation?: string | null
          contact_email?: string | null
          deadline?: string | null
          dedupe_key?: string
          description?: string | null
          details_fetched_at?: string | null
          expires_at?: string
          fit_reason?: string | null
          fit_score?: number
          full_description?: string | null
          id?: string
          image_url?: string | null
          location?: string | null
          posted_at?: string | null
          raw?: Json | null
          remote?: boolean | null
          scouted_at?: string
          skills?: string[] | null
          source?: string
          source_name?: string | null
          source_url?: string
          tags?: string[] | null
          target_user_id?: string
          title?: string
        }
        Relationships: []
      }
      sequence_emails: {
        Row: {
          body: string
          created_at: string
          delay_days: number | null
          id: string
          opened_at: string | null
          replied_at: string | null
          scheduled_for: string | null
          sent_at: string | null
          sequence_id: string
          status: string
          step_number: number
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          delay_days?: number | null
          id?: string
          opened_at?: string | null
          replied_at?: string | null
          scheduled_for?: string | null
          sent_at?: string | null
          sequence_id: string
          status?: string
          step_number?: number
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          delay_days?: number | null
          id?: string
          opened_at?: string | null
          replied_at?: string | null
          scheduled_for?: string | null
          sent_at?: string | null
          sequence_id?: string
          status?: string
          step_number?: number
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sequence_emails_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "outreach_sequences"
            referencedColumns: ["id"]
          },
        ]
      }
      service_packages: {
        Row: {
          created_at: string | null
          currency: string
          delivery_days: number | null
          description: string | null
          display_order: number | null
          features: string[] | null
          id: string
          is_active: boolean | null
          price: number
          revisions: number | null
          tier: string
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          currency?: string
          delivery_days?: number | null
          description?: string | null
          display_order?: number | null
          features?: string[] | null
          id?: string
          is_active?: boolean | null
          price?: number
          revisions?: number | null
          tier?: string
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          currency?: string
          delivery_days?: number | null
          description?: string | null
          display_order?: number | null
          features?: string[] | null
          id?: string
          is_active?: boolean | null
          price?: number
          revisions?: number | null
          tier?: string
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_packages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "feed_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "service_packages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "service_packages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "service_packages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles_discovery"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "service_packages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles_view"
            referencedColumns: ["user_id"]
          },
        ]
      }
      service_tiers: {
        Row: {
          created_at: string
          currency: string
          deliverables: string[] | null
          delivery_days: number | null
          id: string
          price: number
          price_max: number | null
          service_id: string
          tier_name: string
          tier_order: number | null
        }
        Insert: {
          created_at?: string
          currency?: string
          deliverables?: string[] | null
          delivery_days?: number | null
          id?: string
          price?: number
          price_max?: number | null
          service_id: string
          tier_name?: string
          tier_order?: number | null
        }
        Update: {
          created_at?: string
          currency?: string
          deliverables?: string[] | null
          delivery_days?: number | null
          id?: string
          price?: number
          price_max?: number | null
          service_id?: string
          tier_name?: string
          tier_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "service_tiers_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "creator_services"
            referencedColumns: ["id"]
          },
        ]
      }
      session_messages: {
        Row: {
          content: string
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          id: string
          is_announcement: boolean
          is_deleted: boolean | null
          session_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          is_announcement?: boolean
          is_deleted?: boolean | null
          session_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          is_announcement?: boolean
          is_deleted?: boolean | null
          session_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "creative_jams"
            referencedColumns: ["id"]
          },
        ]
      }
      share_link_approvals: {
        Row: {
          created_at: string
          decision: string
          deliverable_id: string | null
          file_id: string | null
          id: string
          note: string | null
          share_link_id: string
          signer_email: string | null
          signer_name: string
        }
        Insert: {
          created_at?: string
          decision: string
          deliverable_id?: string | null
          file_id?: string | null
          id?: string
          note?: string | null
          share_link_id: string
          signer_email?: string | null
          signer_name: string
        }
        Update: {
          created_at?: string
          decision?: string
          deliverable_id?: string | null
          file_id?: string | null
          id?: string
          note?: string | null
          share_link_id?: string
          signer_email?: string | null
          signer_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "share_link_approvals_deliverable_id_fkey"
            columns: ["deliverable_id"]
            isOneToOne: false
            referencedRelation: "project_deliverables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "share_link_approvals_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "project_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "share_link_approvals_share_link_id_fkey"
            columns: ["share_link_id"]
            isOneToOne: false
            referencedRelation: "project_share_links"
            referencedColumns: ["id"]
          },
        ]
      }
      share_link_views: {
        Row: {
          id: string
          ip_hash: string | null
          share_link_id: string
          user_agent: string | null
          viewed_at: string
          viewer_email: string | null
          viewer_name: string | null
        }
        Insert: {
          id?: string
          ip_hash?: string | null
          share_link_id: string
          user_agent?: string | null
          viewed_at?: string
          viewer_email?: string | null
          viewer_name?: string | null
        }
        Update: {
          id?: string
          ip_hash?: string | null
          share_link_id?: string
          user_agent?: string | null
          viewed_at?: string
          viewer_email?: string | null
          viewer_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "share_link_views_share_link_id_fkey"
            columns: ["share_link_id"]
            isOneToOne: false
            referencedRelation: "project_share_links"
            referencedColumns: ["id"]
          },
        ]
      }
      site_analytics: {
        Row: {
          country: string | null
          created_at: string
          device_type: string | null
          duration_ms: number | null
          event_target: string | null
          event_type: string
          id: string
          page_path: string | null
          referrer: string | null
          scope: string
          session_id: string | null
          user_id: string | null
          visitor_id: string | null
        }
        Insert: {
          country?: string | null
          created_at?: string
          device_type?: string | null
          duration_ms?: number | null
          event_target?: string | null
          event_type?: string
          id?: string
          page_path?: string | null
          referrer?: string | null
          scope?: string
          session_id?: string | null
          user_id?: string | null
          visitor_id?: string | null
        }
        Update: {
          country?: string | null
          created_at?: string
          device_type?: string | null
          duration_ms?: number | null
          event_target?: string | null
          event_type?: string
          id?: string
          page_path?: string | null
          referrer?: string | null
          scope?: string
          session_id?: string | null
          user_id?: string | null
          visitor_id?: string | null
        }
        Relationships: []
      }
      skill_endorsement_requests: {
        Row: {
          completed_at: string | null
          created_at: string
          endorser_email: string | null
          endorser_name: string | null
          expires_at: string
          id: string
          personal_message: string | null
          profile_id: string
          project_name: string | null
          share_token: string
          skill_name: string
          status: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          endorser_email?: string | null
          endorser_name?: string | null
          expires_at?: string
          id?: string
          personal_message?: string | null
          profile_id: string
          project_name?: string | null
          share_token?: string
          skill_name: string
          status?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          endorser_email?: string | null
          endorser_name?: string | null
          expires_at?: string
          id?: string
          personal_message?: string | null
          profile_id?: string
          project_name?: string | null
          share_token?: string
          skill_name?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "skill_endorsement_requests_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "feed_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "skill_endorsement_requests_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "skill_endorsement_requests_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "skill_endorsement_requests_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "public_profiles_discovery"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "skill_endorsement_requests_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "public_profiles_view"
            referencedColumns: ["user_id"]
          },
        ]
      }
      skill_endorsements: {
        Row: {
          created_at: string
          endorser_company: string | null
          endorser_email: string
          endorser_name: string
          id: string
          proficiency_level: string
          profile_id: string
          project_name: string | null
          relationship: string | null
          request_id: string | null
          skill_name: string
          testimonial: string | null
          verified: boolean | null
        }
        Insert: {
          created_at?: string
          endorser_company?: string | null
          endorser_email: string
          endorser_name: string
          id?: string
          proficiency_level: string
          profile_id: string
          project_name?: string | null
          relationship?: string | null
          request_id?: string | null
          skill_name: string
          testimonial?: string | null
          verified?: boolean | null
        }
        Update: {
          created_at?: string
          endorser_company?: string | null
          endorser_email?: string
          endorser_name?: string
          id?: string
          proficiency_level?: string
          profile_id?: string
          project_name?: string | null
          relationship?: string | null
          request_id?: string | null
          skill_name?: string
          testimonial?: string | null
          verified?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "skill_endorsements_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "feed_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "skill_endorsements_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "skill_endorsements_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "skill_endorsements_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "public_profiles_discovery"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "skill_endorsements_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "public_profiles_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "skill_endorsements_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "skill_endorsement_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      sound_stages: {
        Row: {
          circle_id: string | null
          created_at: string
          ended_at: string | null
          format: string
          host_user_id: string
          id: string
          is_live: boolean
          mode: string
          participant_count: number
          room_name: string
          room_url: string
          started_at: string
          title: string
          vibe_tag: string | null
        }
        Insert: {
          circle_id?: string | null
          created_at?: string
          ended_at?: string | null
          format?: string
          host_user_id: string
          id?: string
          is_live?: boolean
          mode?: string
          participant_count?: number
          room_name: string
          room_url: string
          started_at?: string
          title: string
          vibe_tag?: string | null
        }
        Update: {
          circle_id?: string | null
          created_at?: string
          ended_at?: string | null
          format?: string
          host_user_id?: string
          id?: string
          is_live?: boolean
          mode?: string
          participant_count?: number
          room_name?: string
          room_url?: string
          started_at?: string
          title?: string
          vibe_tag?: string | null
        }
        Relationships: []
      }
      spark_message_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji?: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "spark_message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "spark_room_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      spark_room_members: {
        Row: {
          id: string
          joined_at: string
          role: string | null
          room_id: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          role?: string | null
          room_id: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          role?: string | null
          room_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "spark_room_members_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "spark_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      spark_room_messages: {
        Row: {
          channel_id: string | null
          content: string
          created_at: string
          id: string
          is_pinned: boolean | null
          media_type: string | null
          media_url: string | null
          message_type: string
          pinned_by: string | null
          poll_data: Json | null
          reactions: Json | null
          reply_to_id: string | null
          room_id: string
          user_id: string
        }
        Insert: {
          channel_id?: string | null
          content: string
          created_at?: string
          id?: string
          is_pinned?: boolean | null
          media_type?: string | null
          media_url?: string | null
          message_type?: string
          pinned_by?: string | null
          poll_data?: Json | null
          reactions?: Json | null
          reply_to_id?: string | null
          room_id: string
          user_id: string
        }
        Update: {
          channel_id?: string | null
          content?: string
          created_at?: string
          id?: string
          is_pinned?: boolean | null
          media_type?: string | null
          media_url?: string | null
          message_type?: string
          pinned_by?: string | null
          poll_data?: Json | null
          reactions?: Json | null
          reply_to_id?: string | null
          room_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "spark_room_messages_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "circle_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spark_room_messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "spark_room_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spark_room_messages_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "spark_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      spark_rooms: {
        Row: {
          category: string
          circle_type: string | null
          cover_image_url: string | null
          cover_url: string | null
          created_at: string
          created_by: string
          currency: string | null
          description: string | null
          icon_emoji: string | null
          id: string
          invite_code: string | null
          is_active: boolean
          is_paid: boolean | null
          is_private: boolean
          is_verified: boolean
          member_count: number
          message_count: number
          price_monthly: number | null
          rules: string | null
          site_about: string | null
          site_accent_color: string | null
          site_bio: string | null
          site_cover_url: string | null
          site_custom_blocks: Json
          site_enabled: boolean
          site_guest_rsvp_enabled: boolean
          site_headline: string | null
          site_logo_url: string | null
          site_show_members: boolean
          site_show_past_events: boolean
          site_slug: string | null
          site_template: string | null
          site_view_count: number
          tagline: string | null
          title: string
          updated_at: string
          welcome_message: string | null
        }
        Insert: {
          category?: string
          circle_type?: string | null
          cover_image_url?: string | null
          cover_url?: string | null
          created_at?: string
          created_by: string
          currency?: string | null
          description?: string | null
          icon_emoji?: string | null
          id?: string
          invite_code?: string | null
          is_active?: boolean
          is_paid?: boolean | null
          is_private?: boolean
          is_verified?: boolean
          member_count?: number
          message_count?: number
          price_monthly?: number | null
          rules?: string | null
          site_about?: string | null
          site_accent_color?: string | null
          site_bio?: string | null
          site_cover_url?: string | null
          site_custom_blocks?: Json
          site_enabled?: boolean
          site_guest_rsvp_enabled?: boolean
          site_headline?: string | null
          site_logo_url?: string | null
          site_show_members?: boolean
          site_show_past_events?: boolean
          site_slug?: string | null
          site_template?: string | null
          site_view_count?: number
          tagline?: string | null
          title: string
          updated_at?: string
          welcome_message?: string | null
        }
        Update: {
          category?: string
          circle_type?: string | null
          cover_image_url?: string | null
          cover_url?: string | null
          created_at?: string
          created_by?: string
          currency?: string | null
          description?: string | null
          icon_emoji?: string | null
          id?: string
          invite_code?: string | null
          is_active?: boolean
          is_paid?: boolean | null
          is_private?: boolean
          is_verified?: boolean
          member_count?: number
          message_count?: number
          price_monthly?: number | null
          rules?: string | null
          site_about?: string | null
          site_accent_color?: string | null
          site_bio?: string | null
          site_cover_url?: string | null
          site_custom_blocks?: Json
          site_enabled?: boolean
          site_guest_rsvp_enabled?: boolean
          site_headline?: string | null
          site_logo_url?: string | null
          site_show_members?: boolean
          site_show_past_events?: boolean
          site_slug?: string | null
          site_template?: string | null
          site_view_count?: number
          tagline?: string | null
          title?: string
          updated_at?: string
          welcome_message?: string | null
        }
        Relationships: []
      }
      speed_lobby_games: {
        Row: {
          created_at: string
          id: string
          kind: string
          payload: Json
          session_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind?: string
          payload?: Json
          session_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          payload?: Json
          session_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "speed_lobby_games_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "speed_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      speed_session_pairings: {
        Row: {
          a_cosigned: boolean
          b_cosigned: boolean
          created_at: string
          ended_at: string | null
          ended_reason: string | null
          id: string
          room_name: string
          room_url: string
          round: number
          session_id: string
          started_at: string
          user_a: string
          user_b: string
        }
        Insert: {
          a_cosigned?: boolean
          b_cosigned?: boolean
          created_at?: string
          ended_at?: string | null
          ended_reason?: string | null
          id?: string
          room_name: string
          room_url: string
          round: number
          session_id: string
          started_at?: string
          user_a: string
          user_b: string
        }
        Update: {
          a_cosigned?: boolean
          b_cosigned?: boolean
          created_at?: string
          ended_at?: string | null
          ended_reason?: string | null
          id?: string
          room_name?: string
          room_url?: string
          round?: number
          session_id?: string
          started_at?: string
          user_a?: string
          user_b?: string
        }
        Relationships: [
          {
            foreignKeyName: "speed_session_pairings_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "speed_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      speed_session_rsvps: {
        Row: {
          created_at: string
          id: string
          joined_at: string | null
          left_at: string | null
          session_id: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          joined_at?: string | null
          left_at?: string | null
          session_id: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          joined_at?: string | null
          left_at?: string | null
          session_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "speed_session_rsvps_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "speed_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      speed_sessions: {
        Row: {
          canceled_reason: string | null
          cover_image_url: string | null
          created_at: string
          description: string | null
          duration_min: number
          fallback_mode: string
          group_room_url: string | null
          host_user_id: string
          id: string
          match_filters: Json
          max_participants: number | null
          mode: string
          pool_cutoff_minutes: number
          recap_sent_at: string | null
          reminder_sent_at: string | null
          reminders_sent: Json
          slot_seconds: number
          starts_at: string
          status: string
          theme: string | null
          title: string
          updated_at: string
          vertical: string
        }
        Insert: {
          canceled_reason?: string | null
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          duration_min?: number
          fallback_mode?: string
          group_room_url?: string | null
          host_user_id: string
          id?: string
          match_filters?: Json
          max_participants?: number | null
          mode?: string
          pool_cutoff_minutes?: number
          recap_sent_at?: string | null
          reminder_sent_at?: string | null
          reminders_sent?: Json
          slot_seconds?: number
          starts_at: string
          status?: string
          theme?: string | null
          title: string
          updated_at?: string
          vertical?: string
        }
        Update: {
          canceled_reason?: string | null
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          duration_min?: number
          fallback_mode?: string
          group_room_url?: string | null
          host_user_id?: string
          id?: string
          match_filters?: Json
          max_participants?: number | null
          mode?: string
          pool_cutoff_minutes?: number
          recap_sent_at?: string | null
          reminder_sent_at?: string | null
          reminders_sent?: Json
          slot_seconds?: number
          starts_at?: string
          status?: string
          theme?: string | null
          title?: string
          updated_at?: string
          vertical?: string
        }
        Relationships: []
      }
      sponsor_leads: {
        Row: {
          address: string | null
          brand_logo_url: string | null
          brand_name: string
          brand_url: string | null
          contact_email: string | null
          contact_info: Json | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          fit_score: number
          id: string
          match_evidence: Json | null
          niche: string | null
          pitch_draft: string | null
          project_id: string | null
          reason: string | null
          source: string | null
          source_url: string | null
          status: string
          updated_at: string
          user_id: string
          website: string | null
        }
        Insert: {
          address?: string | null
          brand_logo_url?: string | null
          brand_name: string
          brand_url?: string | null
          contact_email?: string | null
          contact_info?: Json | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          fit_score?: number
          id?: string
          match_evidence?: Json | null
          niche?: string | null
          pitch_draft?: string | null
          project_id?: string | null
          reason?: string | null
          source?: string | null
          source_url?: string | null
          status?: string
          updated_at?: string
          user_id: string
          website?: string | null
        }
        Update: {
          address?: string | null
          brand_logo_url?: string | null
          brand_name?: string
          brand_url?: string | null
          contact_email?: string | null
          contact_info?: Json | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          fit_score?: number
          id?: string
          match_evidence?: Json | null
          niche?: string | null
          pitch_draft?: string | null
          project_id?: string | null
          reason?: string | null
          source?: string | null
          source_url?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sponsor_leads_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_webhook_events: {
        Row: {
          event_id: string
          payload: Json | null
          processed_at: string
          type: string
        }
        Insert: {
          event_id: string
          payload?: Json | null
          processed_at?: string
          type: string
        }
        Update: {
          event_id?: string
          payload?: Json | null
          processed_at?: string
          type?: string
        }
        Relationships: []
      }
      studio_ai_usage: {
        Row: {
          created_at: string
          generation_count: number
          id: string
          updated_at: string
          usage_date: string
          user_id: string
        }
        Insert: {
          created_at?: string
          generation_count?: number
          id?: string
          updated_at?: string
          usage_date?: string
          user_id: string
        }
        Update: {
          created_at?: string
          generation_count?: number
          id?: string
          updated_at?: string
          usage_date?: string
          user_id?: string
        }
        Relationships: []
      }
      studio_entities: {
        Row: {
          aliases: string[]
          attrs: Json
          created_at: string
          created_by: string | null
          id: string
          importance: number
          kind: string
          name: string
          project_id: string
          slug: string
          source_file_id: string | null
          source_kind: string
          source_url: string | null
          updated_at: string
        }
        Insert: {
          aliases?: string[]
          attrs?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          importance?: number
          kind: string
          name: string
          project_id: string
          slug: string
          source_file_id?: string | null
          source_kind?: string
          source_url?: string | null
          updated_at?: string
        }
        Update: {
          aliases?: string[]
          attrs?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          importance?: number
          kind?: string
          name?: string
          project_id?: string
          slug?: string
          source_file_id?: string | null
          source_kind?: string
          source_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "studio_entities_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      studio_facts: {
        Row: {
          confidence: number
          context: Json
          created_at: string
          created_by: string | null
          id: string
          importance: number
          kind: string
          label: string | null
          project_id: string
          source_excerpt: string | null
          source_file_id: string | null
          source_kind: string
          source_url: string | null
          updated_at: string
          value: string | null
          value_date: string | null
          value_numeric: number | null
        }
        Insert: {
          confidence?: number
          context?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          importance?: number
          kind: string
          label?: string | null
          project_id: string
          source_excerpt?: string | null
          source_file_id?: string | null
          source_kind?: string
          source_url?: string | null
          updated_at?: string
          value?: string | null
          value_date?: string | null
          value_numeric?: number | null
        }
        Update: {
          confidence?: number
          context?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          importance?: number
          kind?: string
          label?: string | null
          project_id?: string
          source_excerpt?: string | null
          source_file_id?: string | null
          source_kind?: string
          source_url?: string | null
          updated_at?: string
          value?: string | null
          value_date?: string | null
          value_numeric?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "studio_facts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      studio_folders: {
        Row: {
          color: string | null
          created_at: string
          id: string
          name: string
          sort_order: number
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      studio_pulse_comments: {
        Row: {
          author_id: string
          content: string
          created_at: string
          id: string
          post_id: string
          project_id: string
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string
          id?: string
          post_id: string
          project_id: string
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          id?: string
          post_id?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "studio_pulse_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "studio_pulse_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      studio_pulse_posts: {
        Row: {
          approval_status: string | null
          author_id: string | null
          content: string | null
          created_at: string
          guest_email: string | null
          guest_name: string | null
          id: string
          image_urls: string[]
          kind: string
          metadata: Json
          project_id: string
          routed_id: string | null
          routed_to: string | null
          updated_at: string
        }
        Insert: {
          approval_status?: string | null
          author_id?: string | null
          content?: string | null
          created_at?: string
          guest_email?: string | null
          guest_name?: string | null
          id?: string
          image_urls?: string[]
          kind?: string
          metadata?: Json
          project_id: string
          routed_id?: string | null
          routed_to?: string | null
          updated_at?: string
        }
        Update: {
          approval_status?: string | null
          author_id?: string | null
          content?: string | null
          created_at?: string
          guest_email?: string | null
          guest_name?: string | null
          id?: string
          image_urls?: string[]
          kind?: string
          metadata?: Json
          project_id?: string
          routed_id?: string | null
          routed_to?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "studio_pulse_posts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      support_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          metadata: Json | null
          sender_id: string | null
          sender_type: string
          ticket_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          metadata?: Json | null
          sender_id?: string | null
          sender_type: string
          ticket_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          sender_id?: string | null
          sender_type?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          category: string | null
          created_at: string
          id: string
          priority: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          id?: string
          priority?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          id?: string
          priority?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      swipes: {
        Row: {
          created_at: string | null
          direction: string
          id: string
          is_super_like: boolean | null
          is_undo: boolean | null
          target_id: string
          target_type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          direction: string
          id?: string
          is_super_like?: boolean | null
          is_undo?: boolean | null
          target_id: string
          target_type: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          direction?: string
          id?: string
          is_super_like?: boolean | null
          is_undo?: boolean | null
          target_id?: string
          target_type?: string
          user_id?: string
        }
        Relationships: []
      }
      talent_managers: {
        Row: {
          commission_rate: number
          created_at: string
          display_name: string | null
          id: string
          is_active: boolean
          manager_user_id: string
          organization: string | null
          referral_code: string
          total_earned: number
          total_referred: number
          updated_at: string
        }
        Insert: {
          commission_rate?: number
          created_at?: string
          display_name?: string | null
          id?: string
          is_active?: boolean
          manager_user_id: string
          organization?: string | null
          referral_code: string
          total_earned?: number
          total_referred?: number
          updated_at?: string
        }
        Update: {
          commission_rate?: number
          created_at?: string
          display_name?: string | null
          id?: string
          is_active?: boolean
          manager_user_id?: string
          organization?: string | null
          referral_code?: string
          total_earned?: number
          total_referred?: number
          updated_at?: string
        }
        Relationships: []
      }
      talent_referrals: {
        Row: {
          id: string
          manager_id: string
          referred_at: string
          status: string
          talent_user_id: string
        }
        Insert: {
          id?: string
          manager_id: string
          referred_at?: string
          status?: string
          talent_user_id: string
        }
        Update: {
          id?: string
          manager_id?: string
          referred_at?: string
          status?: string
          talent_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "talent_referrals_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "talent_managers"
            referencedColumns: ["id"]
          },
        ]
      }
      talent_shortlist: {
        Row: {
          company_user_id: string
          created_at: string
          id: string
          match_reasons: Json | null
          match_score: number | null
          notes: string | null
          opportunity_id: string | null
          status: string
          talent_user_id: string
          updated_at: string
        }
        Insert: {
          company_user_id: string
          created_at?: string
          id?: string
          match_reasons?: Json | null
          match_score?: number | null
          notes?: string | null
          opportunity_id?: string | null
          status?: string
          talent_user_id: string
          updated_at?: string
        }
        Update: {
          company_user_id?: string
          created_at?: string
          id?: string
          match_reasons?: Json | null
          match_score?: number | null
          notes?: string | null
          opportunity_id?: string | null
          status?: string
          talent_user_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "talent_shortlist_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      talent_shortlist_items: {
        Row: {
          added_at: string
          creator_user_id: string
          id: string
          note: string | null
          shortlist_id: string
        }
        Insert: {
          added_at?: string
          creator_user_id: string
          id?: string
          note?: string | null
          shortlist_id: string
        }
        Update: {
          added_at?: string
          creator_user_id?: string
          id?: string
          note?: string | null
          shortlist_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "talent_shortlist_items_shortlist_id_fkey"
            columns: ["shortlist_id"]
            isOneToOne: false
            referencedRelation: "talent_shortlists"
            referencedColumns: ["id"]
          },
        ]
      }
      talent_shortlists: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      telegram_link_tokens: {
        Row: {
          consumed_at: string | null
          created_at: string
          expires_at: string
          token: string
          user_id: string
        }
        Insert: {
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          token: string
          user_id: string
        }
        Update: {
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          token?: string
          user_id?: string
        }
        Relationships: []
      }
      telegram_messages: {
        Row: {
          chat_id: number
          created_at: string
          raw_update: Json
          telegram_user_id: number | null
          text: string | null
          update_id: number
          user_id: string | null
        }
        Insert: {
          chat_id: number
          created_at?: string
          raw_update: Json
          telegram_user_id?: number | null
          text?: string | null
          update_id: number
          user_id?: string | null
        }
        Update: {
          chat_id?: number
          created_at?: string
          raw_update?: Json
          telegram_user_id?: number | null
          text?: string | null
          update_id?: number
          user_id?: string | null
        }
        Relationships: []
      }
      thrive_document_versions: {
        Row: {
          change_note: string | null
          content: Json
          created_at: string
          document_id: string
          id: string
          user_id: string
        }
        Insert: {
          change_note?: string | null
          content: Json
          created_at?: string
          document_id: string
          id?: string
          user_id: string
        }
        Update: {
          change_note?: string | null
          content?: Json
          created_at?: string
          document_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "thrive_document_versions_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "thrive_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      thrive_documents: {
        Row: {
          brief: string | null
          content: Json
          cover_image_url: string | null
          created_at: string
          credits_spent: number
          id: string
          intent: string
          model_used: string | null
          project_id: string | null
          share_token: string | null
          status: string
          theme: string
          title: string
          updated_at: string
          user_id: string
          view_count: number
        }
        Insert: {
          brief?: string | null
          content?: Json
          cover_image_url?: string | null
          created_at?: string
          credits_spent?: number
          id?: string
          intent: string
          model_used?: string | null
          project_id?: string | null
          share_token?: string | null
          status?: string
          theme?: string
          title: string
          updated_at?: string
          user_id: string
          view_count?: number
        }
        Update: {
          brief?: string | null
          content?: Json
          cover_image_url?: string | null
          created_at?: string
          credits_spent?: number
          id?: string
          intent?: string
          model_used?: string | null
          project_id?: string | null
          share_token?: string | null
          status?: string
          theme?: string
          title?: string
          updated_at?: string
          user_id?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "thrive_documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      thrive_intent_logs: {
        Row: {
          created_at: string
          id: string
          intent: string
          prompt: string
          routed_to: string | null
          user_id: string
          workspace_type: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          intent: string
          prompt: string
          routed_to?: string | null
          user_id: string
          workspace_type?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          intent?: string
          prompt?: string
          routed_to?: string | null
          user_id?: string
          workspace_type?: string | null
        }
        Relationships: []
      }
      thrive_memory: {
        Row: {
          body: string | null
          context: Json | null
          created_at: string
          id: string
          importance: number
          kind: string
          label: string
          last_used_at: string | null
          mem_key: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body?: string | null
          context?: Json | null
          created_at?: string
          id?: string
          importance?: number
          kind: string
          label: string
          last_used_at?: string | null
          mem_key: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string | null
          context?: Json | null
          created_at?: string
          id?: string
          importance?: number
          kind?: string
          label?: string
          last_used_at?: string | null
          mem_key?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      thrivefund_milestone_releases: {
        Row: {
          amount_cents: number | null
          campaign_id: string
          completed_at: string | null
          created_at: string
          currency: string | null
          milestone_index: number
          released_by: string
          status: string
          stripe_transfer_id: string | null
        }
        Insert: {
          amount_cents?: number | null
          campaign_id: string
          completed_at?: string | null
          created_at?: string
          currency?: string | null
          milestone_index: number
          released_by: string
          status?: string
          stripe_transfer_id?: string | null
        }
        Update: {
          amount_cents?: number | null
          campaign_id?: string
          completed_at?: string | null
          created_at?: string
          currency?: string | null
          milestone_index?: number
          released_by?: string
          status?: string
          stripe_transfer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "thrivefund_milestone_releases_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      time_entries: {
        Row: {
          created_at: string | null
          description: string | null
          duration_minutes: number | null
          end_time: string | null
          hourly_rate: number | null
          id: string
          is_billable: boolean | null
          project_id: string
          start_time: string
          task_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          duration_minutes?: number | null
          end_time?: string | null
          hourly_rate?: number | null
          id?: string
          is_billable?: boolean | null
          project_id: string
          start_time: string
          task_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          duration_minutes?: number | null
          end_time?: string | null
          hourly_rate?: number | null
          id?: string
          is_billable?: boolean | null
          project_id?: string
          start_time?: string
          task_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "project_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tracked_storage_buckets: {
        Row: {
          bucket_id: string
          created_at: string | null
          description: string | null
        }
        Insert: {
          bucket_id: string
          created_at?: string | null
          description?: string | null
        }
        Update: {
          bucket_id?: string
          created_at?: string | null
          description?: string | null
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          created_at: string | null
          description: string | null
          id: string
          related_project_id: string | null
          status: string | null
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          description?: string | null
          id?: string
          related_project_id?: string | null
          status?: string | null
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          description?: string | null
          id?: string
          related_project_id?: string | null
          status?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_related_project_id_fkey"
            columns: ["related_project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      user_blocks: {
        Row: {
          blocked_user_id: string
          blocker_id: string
          created_at: string
          id: string
        }
        Insert: {
          blocked_user_id: string
          blocker_id: string
          created_at?: string
          id?: string
        }
        Update: {
          blocked_user_id?: string
          blocker_id?: string
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      user_check_ins: {
        Row: {
          check_in_date: string
          check_in_latitude: number | null
          check_in_longitude: number | null
          created_at: string
          id: string
          location_id: string
          points_awarded: number
          user_id: string
          verified_location: boolean | null
        }
        Insert: {
          check_in_date?: string
          check_in_latitude?: number | null
          check_in_longitude?: number | null
          created_at?: string
          id?: string
          location_id: string
          points_awarded: number
          user_id: string
          verified_location?: boolean | null
        }
        Update: {
          check_in_date?: string
          check_in_latitude?: number | null
          check_in_longitude?: number | null
          created_at?: string
          id?: string
          location_id?: string
          points_awarded?: number
          user_id?: string
          verified_location?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "user_check_ins_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "partner_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_email_settings: {
        Row: {
          created_at: string
          gmail_app_password: string | null
          gmail_email: string | null
          id: string
          is_configured: boolean
          last_tested_at: string | null
          provider: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          gmail_app_password?: string | null
          gmail_email?: string | null
          id?: string
          is_configured?: boolean
          last_tested_at?: string | null
          provider?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          gmail_app_password?: string | null
          gmail_email?: string | null
          id?: string
          is_configured?: boolean
          last_tested_at?: string | null
          provider?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_reports: {
        Row: {
          created_at: string
          description: string | null
          id: string
          reason: string
          reported_user_id: string
          reporter_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          reason: string
          reported_user_id: string
          reporter_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          reason?: string
          reported_user_id?: string
          reporter_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_session_pings: {
        Row: {
          first_ping_at: string
          last_ping_at: string
          ping_count: number
          ping_date: string
          user_id: string
        }
        Insert: {
          first_ping_at?: string
          last_ping_at?: string
          ping_count?: number
          ping_date?: string
          user_id: string
        }
        Update: {
          first_ping_at?: string
          last_ping_at?: string
          ping_count?: number
          ping_date?: string
          user_id?: string
        }
        Relationships: []
      }
      verification_requests: {
        Row: {
          ai_decision: string | null
          ai_reasoning: string | null
          ai_score: number | null
          appeal_decision: string | null
          appeal_reason: string | null
          appeal_reviewed_at: string | null
          appeal_reviewed_by: string | null
          appeal_submitted_at: string | null
          authenticity_score: number | null
          awards_count: number | null
          created_at: string | null
          credits_count: number | null
          decision: string | null
          id: string
          industry_fit_score: number | null
          portfolio_count: number | null
          press_count: number | null
          profile_data: Json
          quality_score: number | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          social_proof_score: number | null
          social_verified: boolean | null
          status: string | null
          user_id: string
        }
        Insert: {
          ai_decision?: string | null
          ai_reasoning?: string | null
          ai_score?: number | null
          appeal_decision?: string | null
          appeal_reason?: string | null
          appeal_reviewed_at?: string | null
          appeal_reviewed_by?: string | null
          appeal_submitted_at?: string | null
          authenticity_score?: number | null
          awards_count?: number | null
          created_at?: string | null
          credits_count?: number | null
          decision?: string | null
          id?: string
          industry_fit_score?: number | null
          portfolio_count?: number | null
          press_count?: number | null
          profile_data: Json
          quality_score?: number | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          social_proof_score?: number | null
          social_verified?: boolean | null
          status?: string | null
          user_id: string
        }
        Update: {
          ai_decision?: string | null
          ai_reasoning?: string | null
          ai_score?: number | null
          appeal_decision?: string | null
          appeal_reason?: string | null
          appeal_reviewed_at?: string | null
          appeal_reviewed_by?: string | null
          appeal_submitted_at?: string | null
          authenticity_score?: number | null
          awards_count?: number | null
          created_at?: string | null
          credits_count?: number | null
          decision?: string | null
          id?: string
          industry_fit_score?: number | null
          portfolio_count?: number | null
          press_count?: number | null
          profile_data?: Json
          quality_score?: number | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          social_proof_score?: number | null
          social_verified?: boolean | null
          status?: string | null
          user_id?: string
        }
        Relationships: []
      }
      video_call_guest_tokens: {
        Row: {
          created_at: string
          created_by: string
          direct_call_id: string | null
          expires_at: string
          guest_label: string | null
          id: string
          project_id: string | null
          room_name: string
          room_url: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          direct_call_id?: string | null
          expires_at: string
          guest_label?: string | null
          id?: string
          project_id?: string | null
          room_name: string
          room_url: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          direct_call_id?: string | null
          expires_at?: string
          guest_label?: string | null
          id?: string
          project_id?: string | null
          room_name?: string
          room_url?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      voice_usage_daily: {
        Row: {
          created_at: string
          day: string
          id: string
          seconds_used: number
          turns_used: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          day?: string
          id?: string
          seconds_used?: number
          turns_used?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          day?: string
          id?: string
          seconds_used?: number
          turns_used?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      waitlist: {
        Row: {
          ai_decision: string | null
          ai_reasoning: string | null
          ai_score: number | null
          bio: string | null
          created_at: string | null
          email: string
          full_name: string
          id: string
          instagram_url: string | null
          invite_code: string | null
          invite_sent_at: string | null
          linkedin_url: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          role: string
          spotify_url: string | null
          status: string | null
          twitter_url: string | null
          updated_at: string | null
          website: string | null
          why_join: string | null
        }
        Insert: {
          ai_decision?: string | null
          ai_reasoning?: string | null
          ai_score?: number | null
          bio?: string | null
          created_at?: string | null
          email: string
          full_name: string
          id?: string
          instagram_url?: string | null
          invite_code?: string | null
          invite_sent_at?: string | null
          linkedin_url?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          role: string
          spotify_url?: string | null
          status?: string | null
          twitter_url?: string | null
          updated_at?: string | null
          website?: string | null
          why_join?: string | null
        }
        Update: {
          ai_decision?: string | null
          ai_reasoning?: string | null
          ai_score?: number | null
          bio?: string | null
          created_at?: string | null
          email?: string
          full_name?: string
          id?: string
          instagram_url?: string | null
          invite_code?: string | null
          invite_sent_at?: string | null
          linkedin_url?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          role?: string
          spotify_url?: string | null
          status?: string | null
          twitter_url?: string | null
          updated_at?: string | null
          website?: string | null
          why_join?: string | null
        }
        Relationships: []
      }
      wallet_connections: {
        Row: {
          chain_id: number
          connected_at: string
          created_at: string
          id: string
          is_primary: boolean
          label: string | null
          last_used_at: string | null
          updated_at: string
          user_id: string
          wallet_address: string
          wallet_type: string
        }
        Insert: {
          chain_id?: number
          connected_at?: string
          created_at?: string
          id?: string
          is_primary?: boolean
          label?: string | null
          last_used_at?: string | null
          updated_at?: string
          user_id: string
          wallet_address: string
          wallet_type?: string
        }
        Update: {
          chain_id?: number
          connected_at?: string
          created_at?: string
          id?: string
          is_primary?: boolean
          label?: string | null
          last_used_at?: string | null
          updated_at?: string
          user_id?: string
          wallet_address?: string
          wallet_type?: string
        }
        Relationships: []
      }
      wallet_topups: {
        Row: {
          amount: number
          completed_at: string | null
          created_at: string
          currency: string
          gateway_payment_id: string | null
          gateway_session_id: string | null
          id: string
          payment_gateway: string
          status: string
          user_id: string
        }
        Insert: {
          amount: number
          completed_at?: string | null
          created_at?: string
          currency?: string
          gateway_payment_id?: string | null
          gateway_session_id?: string | null
          id?: string
          payment_gateway?: string
          status?: string
          user_id: string
        }
        Update: {
          amount?: number
          completed_at?: string | null
          created_at?: string
          currency?: string
          gateway_payment_id?: string | null
          gateway_session_id?: string | null
          id?: string
          payment_gateway?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_topups_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "feed_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "wallet_topups_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "wallet_topups_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "wallet_topups_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles_discovery"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "wallet_topups_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles_view"
            referencedColumns: ["user_id"]
          },
        ]
      }
      wallet_transfer_limits: {
        Row: {
          daily_limit_ttd: number
          daily_limit_usd: number
          id: string
          monthly_limit_ttd: number
          monthly_limit_usd: number
          per_transaction_limit_ttd: number
          per_transaction_limit_usd: number
          tier: string
        }
        Insert: {
          daily_limit_ttd?: number
          daily_limit_usd?: number
          id?: string
          monthly_limit_ttd?: number
          monthly_limit_usd?: number
          per_transaction_limit_ttd?: number
          per_transaction_limit_usd?: number
          tier: string
        }
        Update: {
          daily_limit_ttd?: number
          daily_limit_usd?: number
          id?: string
          monthly_limit_ttd?: number
          monthly_limit_usd?: number
          per_transaction_limit_ttd?: number
          per_transaction_limit_usd?: number
          tier?: string
        }
        Relationships: []
      }
      wallet_transfers: {
        Row: {
          amount: number
          created_at: string
          currency: string
          description: string | null
          id: string
          idempotency_key: string | null
          recipient_id: string
          sender_id: string
          status: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          idempotency_key?: string | null
          recipient_id: string
          sender_id: string
          status?: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          idempotency_key?: string | null
          recipient_id?: string
          sender_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transfers_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "feed_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "wallet_transfers_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "wallet_transfers_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "wallet_transfers_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "public_profiles_discovery"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "wallet_transfers_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "public_profiles_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "wallet_transfers_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "feed_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "wallet_transfers_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "wallet_transfers_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "wallet_transfers_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "public_profiles_discovery"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "wallet_transfers_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "public_profiles_view"
            referencedColumns: ["user_id"]
          },
        ]
      }
      wallets: {
        Row: {
          balance: number | null
          created_at: string | null
          credits: number | null
          currency: string
          id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          balance?: number | null
          created_at?: string | null
          credits?: number | null
          currency?: string
          id?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          balance?: number | null
          created_at?: string | null
          credits?: number | null
          currency?: string
          id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      weekly_founder_notes: {
        Row: {
          author_user_id: string
          body: string
          created_at: string
          id: string
          is_published: boolean
          title: string | null
          updated_at: string
          week_start_date: string
        }
        Insert: {
          author_user_id: string
          body: string
          created_at?: string
          id?: string
          is_published?: boolean
          title?: string | null
          updated_at?: string
          week_start_date: string
        }
        Update: {
          author_user_id?: string
          body?: string
          created_at?: string
          id?: string
          is_published?: boolean
          title?: string | null
          updated_at?: string
          week_start_date?: string
        }
        Relationships: []
      }
      wishlists: {
        Row: {
          created_at: string
          id: string
          product_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wishlists_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "digital_products"
            referencedColumns: ["id"]
          },
        ]
      }
      xp_activities: {
        Row: {
          activity_type: string
          created_at: string | null
          description: string | null
          id: string
          user_id: string
          xp_earned: number
        }
        Insert: {
          activity_type: string
          created_at?: string | null
          description?: string | null
          id?: string
          user_id: string
          xp_earned: number
        }
        Update: {
          activity_type?: string
          created_at?: string | null
          description?: string | null
          id?: string
          user_id?: string
          xp_earned?: number
        }
        Relationships: []
      }
    }
    Views: {
      analytics_funnel: {
        Row: {
          event_category: string | null
          event_date: string | null
          event_name: string | null
          total_events: number | null
          unique_sessions: number | null
          unique_users: number | null
        }
        Relationships: []
      }
      connected_platforms_public: {
        Row: {
          created_at: string | null
          id: string | null
          last_synced_at: string | null
          platform: string | null
          platform_data: Json | null
          platform_user_id: string | null
          platform_username: string | null
          updated_at: string | null
          user_id: string | null
          verified_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string | null
          last_synced_at?: string | null
          platform?: string | null
          platform_data?: Json | null
          platform_user_id?: string | null
          platform_username?: string | null
          updated_at?: string | null
          user_id?: string | null
          verified_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string | null
          last_synced_at?: string | null
          platform?: string | null
          platform_data?: Json | null
          platform_user_id?: string | null
          platform_username?: string | null
          updated_at?: string | null
          user_id?: string | null
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "connected_platforms_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "feed_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "connected_platforms_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "connected_platforms_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "connected_platforms_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles_discovery"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "connected_platforms_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles_view"
            referencedColumns: ["user_id"]
          },
        ]
      }
      conversation_list: {
        Row: {
          content: string | null
          conversation_id: string | null
          created_at: string | null
          match_id: string | null
          message_id: string | null
          read: boolean | null
          receiver_avatar: string | null
          receiver_id: string | null
          receiver_name: string | null
          sender_avatar: string | null
          sender_id: string | null
          sender_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_profiles: {
        Row: {
          avatar_url: string | null
          full_name: string | null
          role: string | null
          user_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          full_name?: string | null
          role?: string | null
          user_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          full_name?: string | null
          role?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      oauth_apps_public: {
        Row: {
          client_id: string | null
          created_at: string | null
          description: string | null
          id: string | null
          is_active: boolean | null
          logo_url: string | null
          name: string | null
          owner_id: string | null
          redirect_uris: string[] | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string | null
          is_active?: boolean | null
          logo_url?: string | null
          name?: string | null
          owner_id?: string | null
          redirect_uris?: string[] | null
        }
        Update: {
          client_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string | null
          is_active?: boolean | null
          logo_url?: string | null
          name?: string | null
          owner_id?: string | null
          redirect_uris?: string[] | null
        }
        Relationships: []
      }
      public_profiles: {
        Row: {
          account_type: Database["public"]["Enums"]["account_type"] | null
          avatar_url: string | null
          average_rating: number | null
          badge: Database["public"]["Enums"]["user_badge"] | null
          behance_url: string | null
          bio: string | null
          company_about: string | null
          company_address: string | null
          company_images: Json | null
          company_industry: string | null
          company_location_lat: number | null
          company_location_lng: number | null
          company_logo_url: string | null
          company_name: string | null
          company_size: string | null
          created_at: string | null
          full_name: string | null
          imdb_url: string | null
          industry: string | null
          instagram_url: string | null
          job_title: string | null
          level: number | null
          linkedin_url: string | null
          location: string | null
          passion_skills: Json | null
          portfolio_verified: boolean | null
          professional_skills: Json | null
          role: string | null
          social_verified: boolean | null
          soundcloud_url: string | null
          spotify_url: string | null
          tiktok_url: string | null
          total_reviews: number | null
          twitter_url: string | null
          user_id: string | null
          verification_status: string | null
          verified_at: string | null
          website: string | null
          xp: number | null
          youtube_url: string | null
        }
        Insert: {
          account_type?: Database["public"]["Enums"]["account_type"] | null
          avatar_url?: string | null
          average_rating?: number | null
          badge?: Database["public"]["Enums"]["user_badge"] | null
          behance_url?: string | null
          bio?: string | null
          company_about?: string | null
          company_address?: string | null
          company_images?: Json | null
          company_industry?: string | null
          company_location_lat?: number | null
          company_location_lng?: number | null
          company_logo_url?: string | null
          company_name?: string | null
          company_size?: string | null
          created_at?: string | null
          full_name?: string | null
          imdb_url?: string | null
          industry?: string | null
          instagram_url?: string | null
          job_title?: string | null
          level?: number | null
          linkedin_url?: string | null
          location?: string | null
          passion_skills?: Json | null
          portfolio_verified?: boolean | null
          professional_skills?: Json | null
          role?: string | null
          social_verified?: boolean | null
          soundcloud_url?: string | null
          spotify_url?: string | null
          tiktok_url?: string | null
          total_reviews?: number | null
          twitter_url?: string | null
          user_id?: string | null
          verification_status?: string | null
          verified_at?: string | null
          website?: string | null
          xp?: number | null
          youtube_url?: string | null
        }
        Update: {
          account_type?: Database["public"]["Enums"]["account_type"] | null
          avatar_url?: string | null
          average_rating?: number | null
          badge?: Database["public"]["Enums"]["user_badge"] | null
          behance_url?: string | null
          bio?: string | null
          company_about?: string | null
          company_address?: string | null
          company_images?: Json | null
          company_industry?: string | null
          company_location_lat?: number | null
          company_location_lng?: number | null
          company_logo_url?: string | null
          company_name?: string | null
          company_size?: string | null
          created_at?: string | null
          full_name?: string | null
          imdb_url?: string | null
          industry?: string | null
          instagram_url?: string | null
          job_title?: string | null
          level?: number | null
          linkedin_url?: string | null
          location?: string | null
          passion_skills?: Json | null
          portfolio_verified?: boolean | null
          professional_skills?: Json | null
          role?: string | null
          social_verified?: boolean | null
          soundcloud_url?: string | null
          spotify_url?: string | null
          tiktok_url?: string | null
          total_reviews?: number | null
          twitter_url?: string | null
          user_id?: string | null
          verification_status?: string | null
          verified_at?: string | null
          website?: string | null
          xp?: number | null
          youtube_url?: string | null
        }
        Relationships: []
      }
      public_profiles_discovery: {
        Row: {
          avatar_url: string | null
          badge: Database["public"]["Enums"]["user_badge"] | null
          bio: string | null
          collab_intent: string | null
          created_at: string | null
          full_name: string | null
          level: number | null
          location: string | null
          professional_skills: Json | null
          role: string | null
          user_id: string | null
          verification_score: number | null
        }
        Insert: {
          avatar_url?: string | null
          badge?: Database["public"]["Enums"]["user_badge"] | null
          bio?: string | null
          collab_intent?: string | null
          created_at?: string | null
          full_name?: string | null
          level?: number | null
          location?: string | null
          professional_skills?: Json | null
          role?: string | null
          user_id?: string | null
          verification_score?: number | null
        }
        Update: {
          avatar_url?: string | null
          badge?: Database["public"]["Enums"]["user_badge"] | null
          bio?: string | null
          collab_intent?: string | null
          created_at?: string | null
          full_name?: string | null
          level?: number | null
          location?: string | null
          professional_skills?: Json | null
          role?: string | null
          user_id?: string | null
          verification_score?: number | null
        }
        Relationships: []
      }
      public_profiles_safe: {
        Row: {
          account_type: Database["public"]["Enums"]["account_type"] | null
          avatar_url: string | null
          badge: Database["public"]["Enums"]["user_badge"] | null
          behance_url: string | null
          bio: string | null
          calendly_url: string | null
          comp_card_layout: Json | null
          cover_image_url: string | null
          created_at: string | null
          full_name: string | null
          id_verified: boolean | null
          imdb_url: string | null
          instagram_url: string | null
          level: number | null
          linkedin_url: string | null
          location: string | null
          membership_number: string | null
          model_categories: string[] | null
          model_stats: Json | null
          model_unions: string[] | null
          mother_agency: string | null
          onboarding_completed: boolean | null
          professional_skills: Json | null
          rate_range: string | null
          role: string | null
          site_bio: string | null
          site_custom_blocks: Json | null
          site_enabled: boolean | null
          site_headline: string | null
          site_sections: Json | null
          site_template: string | null
          soundcloud_url: string | null
          spotify_url: string | null
          sub_roles: string[] | null
          subscription_tier: string | null
          tiktok_url: string | null
          twitter_url: string | null
          updated_at: string | null
          user_id: string | null
          username: string | null
          verification_status: string | null
          verification_tier: string | null
          website: string | null
          xp: number | null
          youtube_url: string | null
        }
        Relationships: []
      }
      public_profiles_view: {
        Row: {
          avatar_url: string | null
          badge: Database["public"]["Enums"]["user_badge"] | null
          behance_url: string | null
          bio: string | null
          created_at: string | null
          full_name: string | null
          imdb_url: string | null
          industry: string | null
          instagram_url: string | null
          job_title: string | null
          linkedin_url: string | null
          location: string | null
          passion_skills: Json | null
          professional_skills: Json | null
          role: string | null
          soundcloud_url: string | null
          spotify_url: string | null
          twitter_url: string | null
          user_id: string | null
          website: string | null
        }
        Insert: {
          avatar_url?: string | null
          badge?: Database["public"]["Enums"]["user_badge"] | null
          behance_url?: string | null
          bio?: string | null
          created_at?: string | null
          full_name?: string | null
          imdb_url?: string | null
          industry?: string | null
          instagram_url?: string | null
          job_title?: string | null
          linkedin_url?: string | null
          location?: string | null
          passion_skills?: Json | null
          professional_skills?: Json | null
          role?: string | null
          soundcloud_url?: string | null
          spotify_url?: string | null
          twitter_url?: string | null
          user_id?: string | null
          website?: string | null
        }
        Update: {
          avatar_url?: string | null
          badge?: Database["public"]["Enums"]["user_badge"] | null
          behance_url?: string | null
          bio?: string | null
          created_at?: string | null
          full_name?: string | null
          imdb_url?: string | null
          industry?: string | null
          instagram_url?: string | null
          job_title?: string | null
          linkedin_url?: string | null
          location?: string | null
          passion_skills?: Json | null
          professional_skills?: Json | null
          role?: string | null
          soundcloud_url?: string | null
          spotify_url?: string | null
          twitter_url?: string | null
          user_id?: string | null
          website?: string | null
        }
        Relationships: []
      }
      public_reviews: {
        Row: {
          collaboration_type: string | null
          created_at: string | null
          id: string | null
          is_endorsed: boolean | null
          is_verified: boolean | null
          profile_id: string | null
          project_name: string | null
          rating: number | null
          review_text: string | null
          reviewer_avatar_url: string | null
          reviewer_company: string | null
          reviewer_id: string | null
          reviewer_name: string | null
          reviewer_role: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          collaboration_type?: string | null
          created_at?: string | null
          id?: string | null
          is_endorsed?: boolean | null
          is_verified?: boolean | null
          profile_id?: string | null
          project_name?: string | null
          rating?: number | null
          review_text?: string | null
          reviewer_avatar_url?: string | null
          reviewer_company?: string | null
          reviewer_id?: string | null
          reviewer_name?: string | null
          reviewer_role?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          collaboration_type?: string | null
          created_at?: string | null
          id?: string | null
          is_endorsed?: boolean | null
          is_verified?: boolean | null
          profile_id?: string | null
          project_name?: string | null
          rating?: number | null
          review_text?: string | null
          reviewer_avatar_url?: string | null
          reviewer_company?: string | null
          reviewer_id?: string | null
          reviewer_name?: string | null
          reviewer_role?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "feed_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "reviews_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "reviews_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "reviews_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "public_profiles_discovery"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "reviews_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "public_profiles_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "feed_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "public_profiles_discovery"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "public_profiles_view"
            referencedColumns: ["user_id"]
          },
        ]
      }
      public_skill_endorsements: {
        Row: {
          created_at: string | null
          endorser_company: string | null
          endorser_name: string | null
          id: string | null
          proficiency_level: string | null
          profile_id: string | null
          project_name: string | null
          relationship: string | null
          request_id: string | null
          skill_name: string | null
          testimonial: string | null
          verified: boolean | null
        }
        Insert: {
          created_at?: string | null
          endorser_company?: string | null
          endorser_name?: string | null
          id?: string | null
          proficiency_level?: string | null
          profile_id?: string | null
          project_name?: string | null
          relationship?: string | null
          request_id?: string | null
          skill_name?: string | null
          testimonial?: string | null
          verified?: boolean | null
        }
        Update: {
          created_at?: string | null
          endorser_company?: string | null
          endorser_name?: string | null
          id?: string | null
          proficiency_level?: string | null
          profile_id?: string | null
          project_name?: string | null
          relationship?: string | null
          request_id?: string | null
          skill_name?: string | null
          testimonial?: string | null
          verified?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "skill_endorsements_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "feed_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "skill_endorsements_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "skill_endorsements_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "skill_endorsements_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "public_profiles_discovery"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "skill_endorsements_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "public_profiles_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "skill_endorsements_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "skill_endorsement_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews_public: {
        Row: {
          collaboration_type: string | null
          created_at: string | null
          id: string | null
          is_endorsed: boolean | null
          is_verified: boolean | null
          profile_id: string | null
          project_name: string | null
          rating: number | null
          review_text: string | null
          reviewer_avatar_url: string | null
          reviewer_company: string | null
          reviewer_id: string | null
          reviewer_name: string | null
          reviewer_role: string | null
          status: string | null
        }
        Insert: {
          collaboration_type?: string | null
          created_at?: string | null
          id?: string | null
          is_endorsed?: boolean | null
          is_verified?: boolean | null
          profile_id?: string | null
          project_name?: string | null
          rating?: number | null
          review_text?: string | null
          reviewer_avatar_url?: string | null
          reviewer_company?: string | null
          reviewer_id?: string | null
          reviewer_name?: string | null
          reviewer_role?: string | null
          status?: string | null
        }
        Update: {
          collaboration_type?: string | null
          created_at?: string | null
          id?: string | null
          is_endorsed?: boolean | null
          is_verified?: boolean | null
          profile_id?: string | null
          project_name?: string | null
          rating?: number | null
          review_text?: string | null
          reviewer_avatar_url?: string | null
          reviewer_company?: string | null
          reviewer_id?: string | null
          reviewer_name?: string | null
          reviewer_role?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "feed_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "reviews_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "reviews_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "reviews_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "public_profiles_discovery"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "reviews_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "public_profiles_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "feed_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "public_profiles_discovery"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "public_profiles_view"
            referencedColumns: ["user_id"]
          },
        ]
      }
      skill_endorsement_counts: {
        Row: {
          average_level: number | null
          endorsement_count: number | null
          profile_id: string | null
          skill_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "skill_endorsements_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "feed_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "skill_endorsements_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "skill_endorsements_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "skill_endorsements_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "public_profiles_discovery"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "skill_endorsements_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "public_profiles_view"
            referencedColumns: ["user_id"]
          },
        ]
      }
      skill_endorsements_public: {
        Row: {
          created_at: string | null
          endorser_company: string | null
          endorser_name: string | null
          id: string | null
          proficiency_level: string | null
          profile_id: string | null
          project_name: string | null
          relationship: string | null
          skill_name: string | null
          testimonial: string | null
          verified: boolean | null
        }
        Insert: {
          created_at?: string | null
          endorser_company?: string | null
          endorser_name?: string | null
          id?: string | null
          proficiency_level?: string | null
          profile_id?: string | null
          project_name?: string | null
          relationship?: string | null
          skill_name?: string | null
          testimonial?: string | null
          verified?: boolean | null
        }
        Update: {
          created_at?: string | null
          endorser_company?: string | null
          endorser_name?: string | null
          id?: string | null
          proficiency_level?: string | null
          profile_id?: string | null
          project_name?: string | null
          relationship?: string | null
          skill_name?: string | null
          testimonial?: string | null
          verified?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "skill_endorsements_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "feed_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "skill_endorsements_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "skill_endorsements_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "skill_endorsements_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "public_profiles_discovery"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "skill_endorsements_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "public_profiles_view"
            referencedColumns: ["user_id"]
          },
        ]
      }
      user_applications_view: {
        Row: {
          applicant_avatar: string | null
          applicant_id: string | null
          applicant_name: string | null
          application_notes: string | null
          availability: string | null
          compensation: string | null
          cover_letter: string | null
          created_at: string | null
          expected_rate: string | null
          id: string | null
          location: string | null
          opportunity_id: string | null
          opportunity_status: string | null
          opportunity_title: string | null
          opportunity_type: string | null
          portfolio_links: string[] | null
          status: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "applications_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_application_and_create_studio: {
        Args: { _application_id: string }
        Returns: Json
      }
      admin_confirm_bank_transfer: {
        Args: { p_admin_notes?: string; p_transfer_id: string }
        Returns: Json
      }
      admin_grant_founder_circle: {
        Args: { grant_reason?: string; target_user_id: string }
        Returns: Json
      }
      admin_reject_bank_transfer: {
        Args: { p_reason: string; p_transfer_id: string }
        Returns: Json
      }
      admin_set_profile_coords: { Args: { coords: Json }; Returns: number }
      admin_verify_profile_identity: {
        Args: { p_approved: boolean; p_notes?: string; p_user_id: string }
        Returns: Json
      }
      approve_discovered_credit: {
        Args: { _discovery_id: string }
        Returns: Json
      }
      auto_join_circles_for_role: {
        Args: { p_role: string; p_user_id: string }
        Returns: undefined
      }
      award_founding_member_badge: {
        Args: { _user_id: string }
        Returns: boolean
      }
      award_xp: {
        Args: { p_amount: number; p_reason?: string; p_user_id: string }
        Returns: number
      }
      backfill_vouch_requests: { Args: never; Returns: Json }
      bump_streak: {
        Args: { _streak_type: string }
        Returns: {
          current_streak: number
          last_action_date: string
          longest_streak: number
        }[]
      }
      calculate_distance: {
        Args: { lat1: number; lat2: number; lon1: number; lon2: number }
        Returns: number
      }
      calculate_level: { Args: { xp: number }; Returns: number }
      calculate_network_tier: {
        Args: { ref_count: number }
        Returns: Database["public"]["Enums"]["network_tier"]
      }
      can_access_import_job: { Args: { _job_id: string }; Returns: boolean }
      can_access_project: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      can_join_event_online: {
        Args: { _event_id: string; _user_id: string }
        Returns: boolean
      }
      can_see_milestone_money: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      can_view_curated_stage: {
        Args: { _email?: string; _stage_id: string; _user_id: string }
        Returns: boolean
      }
      check_in_guest_by_token: {
        Args: { p_event_id: string; p_token: string }
        Returns: {
          checked_in_at: string
          guest_email: string
          guest_name: string
          id: string
          was_already_checked_in: boolean
        }[]
      }
      check_storage_available: {
        Args: { file_size_param: number; user_id_param: string }
        Returns: boolean
      }
      check_transfer_limit: {
        Args: { p_amount: number; p_currency?: string; p_user_id: string }
        Returns: Json
      }
      claim_guest_rsvps: {
        Args: { _email: string; _user_id: string }
        Returns: {
          claimed_count: number
          participant_count: number
        }[]
      }
      claim_icdb_role: {
        Args: { p_role_id: string; p_thumbnail_url?: string }
        Returns: Json
      }
      claim_profile: {
        Args: { p_claim_token: string; p_user_id: string }
        Returns: boolean
      }
      complete_review_request: { Args: { p_token: string }; Returns: boolean }
      confirm_credit_as_client: {
        Args: { _credit_id: string; _note?: string }
        Returns: Json
      }
      confirm_invoice_paid_manually: {
        Args: { p_invoice_id: string; p_payment_method: string }
        Returns: Json
      }
      confirm_milestone_paid_offline: {
        Args: { p_milestone_id: string }
        Returns: Json
      }
      consume_copilot_message: {
        Args: { _daily_cap: number; _user_id: string }
        Returns: {
          allowed: boolean
          cap: number
          used: number
        }[]
      }
      consume_stage_application: {
        Args: { _monthly_cap: number; _user_id: string }
        Returns: {
          allowed: boolean
          cap: number
          used: number
        }[]
      }
      consume_studio_ai_generation: {
        Args: { _daily_cap: number; _user_id: string }
        Returns: {
          allowed: boolean
          cap: number
          used: number
        }[]
      }
      consume_voice_seconds: { Args: { _seconds: number }; Returns: Json }
      create_bidirectional_connection: {
        Args: {
          connection_status?: string
          user1_uuid: string
          user2_uuid: string
        }
        Returns: undefined
      }
      create_circle_from_event: {
        Args: {
          _category?: string
          _cover_image_url?: string
          _description?: string
          _event_id: string
          _title: string
        }
        Returns: string
      }
      create_multi_use_code: {
        Args: { num_uses: number; owner_email: string }
        Returns: string
      }
      create_notification: {
        Args: {
          p_action_text?: string
          p_action_url?: string
          p_category?: string
          p_image_url?: string
          p_link?: string
          p_message: string
          p_priority?: string
          p_title: string
          p_type: string
          p_user_id: string
        }
        Returns: string
      }
      create_unclaimed_profile: {
        Args: {
          p_avatar_url?: string
          p_bio?: string
          p_full_name: string
          p_imported_data?: Json
          p_imported_from_url?: string
          p_location?: string
          p_professional_skills?: Json
          p_role: string
          p_source?: string
        }
        Returns: string
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      delete_group_room: { Args: { _room_id: string }; Returns: boolean }
      dismiss_discovered_credit: {
        Args: { _discovery_id: string }
        Returns: Json
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      finalize_unclaimed_profile_claim: {
        Args: { p_unclaimed_user_id: string }
        Returns: boolean
      }
      find_duplicate_account_candidates: {
        Args: { p_user_id: string }
        Returns: {
          avatar_url: string
          candidate_user_id: string
          confidence: number
          full_name: string
          match_email_local: boolean
          match_name: boolean
          match_phone: boolean
          overlap_count: number
        }[]
      }
      find_matching_unclaimed_profiles: {
        Args: { p_full_name: string; p_limit?: number }
        Returns: {
          avatar_url: string
          bio: string
          claim_token: string
          full_name: string
          imported_data: Json
          imported_from_url: string
          location: string
          professional_skills: Json
          role: string
          similarity_score: number
          user_id: string
        }[]
      }
      gen_random_bytes: { Args: { size: number }; Returns: string }
      generate_bank_transfer_reference: { Args: never; Returns: string }
      generate_claim_token: { Args: never; Returns: string }
      generate_icdb_creator_id: { Args: never; Returns: string }
      generate_invite_codes: {
        Args: { num_codes?: number; user_id_param: string }
        Returns: undefined
      }
      generate_invoice_number: { Args: never; Returns: string }
      generate_membership_number: { Args: never; Returns: string }
      generate_secure_token: { Args: never; Returns: string }
      generate_unsubscribe_token: { Args: never; Returns: string }
      get_active_users_rollup: {
        Args: never
        Returns: {
          dau: number
          dau_wau_ratio: number
          mau: number
          wau: number
        }[]
      }
      get_ambassador_by_code: {
        Args: { _code: string }
        Returns: {
          ambassador_code: string
          avatar_url: string
          full_name: string
          user_id: string
        }[]
      }
      get_ambassador_referral_stats: {
        Args: never
        Returns: {
          recent: Json
          total_signups: number
        }[]
      }
      get_brand_verification_by_token: {
        Args: { p_token: string }
        Returns: {
          brand_email: string
          brand_name: string
          created_at: string
          id: string
          project_id: string
          status: string
        }[]
      }
      get_connection_path: {
        Args: { from_user_id: string; to_user_id: string }
        Returns: {
          degree: number
          path_user_ids: string[]
          path_user_names: string[]
        }[]
      }
      get_creative_action_funnels: {
        Args: { _end?: string; _start?: string }
        Returns: Json
      }
      get_creative_actions_daily: {
        Args: { _days?: number }
        Returns: {
          action_count: number
          action_type: string
          day: string
          unique_users: number
        }[]
      }
      get_credit_endorsement_by_token: {
        Args: { _token: string }
        Returns: {
          credit_id: string
          endorser_name: string
          id: string
          project_name: string
          relationship: string
          requested_at: string
          requested_by: string
          requester_avatar_url: string
          requester_name: string
          role: string
          status: string
          year: number
        }[]
      }
      get_curated_stage_by_invite: {
        Args: { p_stage_id: string; p_token: string }
        Returns: {
          application_prompt: string
          application_required: boolean
          attended_count: number
          blurb: string
          capacity: number
          cover_url: string
          currency: string
          description: string
          ends_at: string
          host_user_id: string
          id: string
          is_paid: boolean
          mode: string
          price_cents: number
          recording_enabled: boolean
          rsvp_count: number
          starts_at: string
          status: Database["public"]["Enums"]["curated_stage_status"]
          title: string
          turn_seconds: number
          type: Database["public"]["Enums"]["curated_stage_type"]
          vibe_tags: string[]
          visibility: string
        }[]
      }
      get_endorsement_request_by_token: {
        Args: { token_param: string }
        Returns: {
          created_at: string
          id: string
          personal_message: string
          profile_id: string
          share_token: string
          skill_name: string
        }[]
      }
      get_event_check_in_tokens: {
        Args: { _jam_id: string }
        Returns: {
          check_in_token: string
          status: string
          user_id: string
        }[]
      }
      get_founder_circle_count: { Args: never; Returns: number }
      get_guest_brief: {
        Args: { _token: string }
        Returns: {
          brief_text: string
          project_id: string
        }[]
      }
      get_guest_collaborators: {
        Args: { _token: string }
        Returns: {
          avatar_url: string
          full_name: string
          role: string
          user_id: string
        }[]
      }
      get_guest_files: {
        Args: { _token: string }
        Returns: {
          created_at: string
          file_name: string
          file_size: number
          file_type: string
          file_url: string
          id: string
        }[]
      }
      get_guest_pulse: {
        Args: { _token: string }
        Returns: {
          author_name: string
          content: string
          created_at: string
          id: string
          image_urls: string[]
          is_guest: boolean
          kind: string
        }[]
      }
      get_knock_status: {
        Args: { _guest_token: string; _knock_id: string }
        Returns: {
          expires_at: string
          meeting_id: string
          share_url: string
          status: string
        }[]
      }
      get_landing_funnel: {
        Args: { _end?: string; _start?: string }
        Returns: Json
      }
      get_milestone_financials: {
        Args: { _milestone_id: string }
        Returns: Json
      }
      get_mutual_connection_counts: {
        Args: { p_target_ids: string[] }
        Returns: {
          mutual_count: number
          sample: Json
          target_id: string
        }[]
      }
      get_mutual_connections: {
        Args: { user1_id: string; user2_id: string }
        Returns: {
          avatar_url: string
          connection_id: string
          full_name: string
          role: string
        }[]
      }
      get_my_check_in_token: { Args: { _jam_id: string }; Returns: string }
      get_my_crew_unread: {
        Args: never
        Returns: {
          crew_id: string
          last_activity_at: string
          unread_count: number
        }[]
      }
      get_my_group_rooms: {
        Args: never
        Returns: {
          circle_type: string
          cover_image_url: string
          created_at: string
          created_by: string
          description: string
          icon_emoji: string
          id: string
          invite_code: string
          is_private: boolean
          member_count: number
          message_count: number
          my_role: string
          title: string
          updated_at: string
        }[]
      }
      get_my_storage_quota: {
        Args: never
        Returns: {
          limit_bytes: number
          tier: string
          used_bytes: number
        }[]
      }
      get_nearby_creators: {
        Args: {
          limit_count?: number
          radius_km?: number
          user_lat: number
          user_lon: number
        }
        Returns: {
          avatar_url: string
          bio: string
          distance_km: number
          full_name: string
          latitude: number
          location: string
          longitude: number
          professional_skills: Json
          role: string
          user_id: string
        }[]
      }
      get_nearby_gigs: {
        Args: {
          limit_count?: number
          radius_km?: number
          user_lat: number
          user_lon: number
        }
        Returns: {
          compensation: string
          created_at: string
          created_by: string
          creator_avatar: string
          creator_name: string
          description: string
          distance_km: number
          id: string
          image_url: string
          latitude: number
          location: string
          location_city: string
          longitude: number
          skills: string[]
          tags: string[]
          title: string
          type: string
        }[]
      }
      get_nearby_jams: {
        Args: {
          limit_count?: number
          radius_km?: number
          user_lat: number
          user_lon: number
        }
        Returns: {
          category: string
          cover_image_url: string
          created_at: string
          created_by: string
          creator_avatar: string
          creator_name: string
          description: string
          distance_km: number
          end_time: string
          id: string
          is_public: boolean
          latitude: number
          longitude: number
          max_participants: number
          participant_count: number
          start_time: string
          status: string
          tags: string[]
          title: string
          venue_address: string
          venue_name: string
        }[]
      }
      get_nearby_locations: {
        Args: {
          limit_count?: number
          radius_km?: number
          type_filter?: string
          user_lat: number
          user_lon: number
        }
        Returns: {
          address: string
          amenities: string[]
          average_rating: number
          category: string
          city: string
          cover_image_url: string
          creator_avatar: string
          creator_name: string
          description: string
          distance_km: number
          id: string
          image_urls: string[]
          is_rentable: boolean
          is_verified: boolean
          latitude: number
          location_type: string
          longitude: number
          name: string
          price_currency: string
          price_per_hour: number
          review_count: number
          tags: string[]
          user_id: string
        }[]
      }
      get_network_health: {
        Args: { p_user_id: string }
        Returns: {
          active_connections: number
          connectivity_score: number
          diversity_score: number
          growth_potential: number
          overall_score: number
          pending_requests: number
          unique_roles: number
        }[]
      }
      get_network_industry_breakdown: {
        Args: { p_user_id: string }
        Returns: {
          count: number
          role_category: string
        }[]
      }
      get_network_stats: {
        Args: { p_user_id: string }
        Returns: {
          connection_count: number
          degree: number
        }[]
      }
      get_or_create_guest_token_for_invite: {
        Args: { _email: string; _project_id: string }
        Returns: string
      }
      get_own_payment_identifiers: {
        Args: never
        Returns: {
          stripe_account_id: string
          stripe_account_status: string
          stripe_customer_id: string
          stripe_subscription_id: string
          subscription_tier: string
        }[]
      }
      get_own_profile_sensitive_data: {
        Args: never
        Returns: {
          stripe_customer_id: string
          subscription_status: string
          subscription_tier: string
        }[]
      }
      get_product_kpis: { Args: never; Returns: Json }
      get_profiles_by_degree: {
        Args: {
          p_degree: number
          p_limit?: number
          p_offset?: number
          p_user_id: string
        }
        Returns: {
          avatar_url: string
          badge: Database["public"]["Enums"]["user_badge"]
          bio: string
          full_name: string
          location: string
          professional_skills: Json
          role: string
          user_id: string
        }[]
      }
      get_project_financials: { Args: { _project_id: string }; Returns: Json }
      get_project_for_guest: {
        Args: { _token: string }
        Returns: {
          client_name: string
          cover_url: string
          created_by: string
          description: string
          project_id: string
          status: string
          title: string
          workspace_type: string
        }[]
      }
      get_project_milestone_financials: {
        Args: { _project_id: string }
        Returns: {
          amount: number
          escrow_status: string
          milestone_id: string
          paid_at: string
          paid_to: string
          payment_intent_id: string
        }[]
      }
      get_project_people: {
        Args: { _project_id: string }
        Returns: {
          avatar_url: string
          collaborator_status: string
          full_name: string
          is_owner: boolean
          role: string
          user_id: string
        }[]
      }
      get_project_role: {
        Args: { _project_id: string; _user_id: string }
        Returns: string
      }
      get_public_creator_showcase: {
        Args: { _limit?: number; _viewer_id?: string }
        Returns: {
          avatar_url: string
          created_at: string
          full_name: string
          role: string
          user_id: string
          verification_tier: string
        }[]
      }
      get_public_profiles_safe: {
        Args: never
        Returns: {
          account_type: Database["public"]["Enums"]["account_type"]
          avatar_url: string
          badge: Database["public"]["Enums"]["user_badge"]
          behance_url: string
          bio: string
          calendly_url: string
          comp_card_layout: Json
          cover_image_url: string
          created_at: string
          full_name: string
          id_verified: boolean
          imdb_url: string
          instagram_url: string
          level: number
          linkedin_url: string
          location: string
          membership_number: string
          model_categories: string[]
          model_stats: Json
          model_unions: string[]
          mother_agency: string
          onboarding_completed: boolean
          professional_skills: Json
          rate_range: string
          role: string
          site_bio: string
          site_custom_blocks: Json
          site_enabled: boolean
          site_headline: string
          site_sections: Json
          site_template: string
          soundcloud_url: string
          spotify_url: string
          sub_roles: string[]
          subscription_tier: string
          tiktok_url: string
          twitter_url: string
          updated_at: string
          user_id: string
          username: string
          verification_status: string
          verification_tier: string
          website: string
          xp: number
          youtube_url: string
        }[]
      }
      get_public_studio_recap: { Args: { token: string }; Returns: Json }
      get_retention_cohorts: {
        Args: { _weeks?: number }
        Returns: {
          cohort_size: number
          cohort_week: string
          retained: number
          retention_pct: number
          week_offset: number
        }[]
      }
      get_review_request_by_token: {
        Args: { token_param: string }
        Returns: {
          completed_at: string
          created_at: string
          expires_at: string
          id: string
          personal_message: string
          profile_id: string
          project_name: string
          reviewer_name: string
          share_token: string
          status: string
        }[]
      }
      get_scout_funnel_by_source: {
        Args: { _days?: number }
        Returns: {
          applied: number
          opened: number
          scouted: number
          source: string
          won: number
        }[]
      }
      get_scout_funnel_stats: {
        Args: { _days?: number }
        Returns: {
          applied: number
          apply_clicked: number
          drafted: number
          ghosted: number
          lost: number
          opened: number
          scouted: number
          won: number
        }[]
      }
      get_shared_thrive_document: {
        Args: { _token: string }
        Returns: {
          content: Json
          cover_image_url: string
          created_at: string
          id: string
          intent: string
          theme: string
          title: string
          user_id: string
        }[]
      }
      get_sitemap_profiles: {
        Args: never
        Returns: {
          avatar_url: string
          bio: string
          full_name: string
          location: string
          role: string
          updated_at: string
          user_id: string
          username: string
        }[]
      }
      get_stage_invite_token: { Args: { p_stage_id: string }; Returns: string }
      get_talent_manager_by_referral_code: {
        Args: { p_referral_code: string }
        Returns: {
          display_name: string
          id: string
        }[]
      }
      get_tier_storage_limit: { Args: { tier: string }; Returns: number }
      get_user_email: { Args: { _user_id: string }; Returns: string }
      guest_drop_post: {
        Args: { _content: string; _kind?: string; _token: string }
        Returns: string
      }
      guest_rsvp_upsert: {
        Args: {
          p_event_id: string
          p_guest_email: string
          p_guest_name: string
        }
        Returns: {
          check_in_token: string
          status: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_endorsement_count: {
        Args: { credit_id_param: string }
        Returns: undefined
      }
      increment_manager_earnings: {
        Args: { amount_input: number; manager_id_input: string }
        Returns: undefined
      }
      increment_promo_use: { Args: { _id: string }; Returns: undefined }
      increment_template_usage: {
        Args: { template_id: string }
        Returns: undefined
      }
      increment_thrive_doc_views: {
        Args: { _token: string }
        Returns: undefined
      }
      is_crew_member: {
        Args: { _circle_id: string; _user_id: string }
        Returns: boolean
      }
      is_event_host: {
        Args: { _event_id: string; _user_id: string }
        Returns: boolean
      }
      is_event_project_member: {
        Args: { _event_id: string; _user_id: string }
        Returns: boolean
      }
      is_meeting_host: {
        Args: { _meeting_id: string; _user_id: string }
        Returns: boolean
      }
      is_meeting_member: {
        Args: { _meeting_id: string; _user_id: string }
        Returns: boolean
      }
      is_profile_owner: { Args: { _profile_user_id: string }; Returns: boolean }
      is_project_member: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      is_room_member: {
        Args: { _room_id: string; _user_id: string }
        Returns: boolean
      }
      join_group_by_invite: { Args: { _invite_code: string }; Returns: string }
      list_share_link_files: {
        Args: { _token: string }
        Returns: {
          created_at: string
          deliverable_id: string
          deliverable_status: string
          deliverable_title: string
          file_id: string
          file_name: string
          file_size: number
          file_type: string
          file_url: string
          folder_id: string
        }[]
      }
      log_creative_action: {
        Args: { _action_type: string; _metadata?: Json; _ref_id?: string }
        Returns: number
      }
      log_share_link_view: {
        Args: {
          _ip_hash?: string
          _token: string
          _user_agent?: string
          _viewer_email?: string
          _viewer_name?: string
        }
        Returns: undefined
      }
      mark_direct_call_missed: {
        Args: { _call_id: string }
        Returns: undefined
      }
      match_copilot_memories: {
        Args: {
          p_match_count?: number
          p_min_similarity?: number
          p_query_embedding: string
          p_user_id: string
        }
        Returns: {
          confidence: number
          content: string
          id: string
          kind: string
          similarity: number
        }[]
      }
      merge_user_data: {
        Args: { p_source_user_id: string; p_target_user_id: string }
        Returns: Json
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      my_credits_overview: {
        Args: never
        Returns: {
          endorsements_received: number
          last_credit_at: string
          missing_evidence: number
          pending_credits: number
          total_credits: number
          verified_credits: number
        }[]
      }
      notify_application_status: {
        Args: { _application_id: string; _status: string }
        Returns: Json
      }
      notify_event_comment: { Args: { _comment_id: string }; Returns: Json }
      notify_new_application: {
        Args: { _application_id: string }
        Returns: Json
      }
      notify_scout_event: {
        Args: { _actor_name: string; _event: string; _opportunity_id: string }
        Returns: undefined
      }
      pending_inbox_triage_count: {
        Args: { _user_id: string }
        Returns: number
      }
      persona_for_agent_kind: {
        Args: { _kind: string }
        Returns: Database["public"]["Enums"]["agent_persona"]
      }
      promote_guest_token_to_collaborator: {
        Args: { _token: string }
        Returns: string
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      recompute_all_storage_usage: { Args: never; Returns: undefined }
      recompute_verification_tier: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      record_money_action: {
        Args: { _action_type: string }
        Returns: {
          current_streak: number
          is_new_day: boolean
          longest_streak: number
        }[]
      }
      record_referral: {
        Args: { p_referred_id: string; p_referrer_id: string }
        Returns: undefined
      }
      record_session_ping: { Args: never; Returns: undefined }
      refund_studio_ai_generation: {
        Args: { _usage_date: string; _user_id: string }
        Returns: undefined
      }
      register_guest_session: {
        Args: { _email?: string; _name?: string; _token: string }
        Returns: string
      }
      reject_discovered_credit: {
        Args: { credit_id_param: string }
        Returns: undefined
      }
      request_id_verification: { Args: never; Returns: undefined }
      resolve_project_share_link: {
        Args: { _password?: string; _token: string }
        Returns: {
          can_approve: boolean
          can_comment: boolean
          can_download: boolean
          expired: boolean
          label: string
          password_ok: boolean
          project_id: string
          project_title: string
          requires_password: boolean
          revoked: boolean
          scope: string
          scope_ref_id: string
          share_link_id: string
        }[]
      }
      resolve_storage_owner:
        | { Args: { _name: string; _owner: string }; Returns: string }
        | {
            Args: { _bucket?: string; _name: string; _owner: string }
            Returns: string
          }
      rsvp_to_event: {
        Args: {
          p_event_id: string
          p_referral_channel?: string
          p_referred_by?: string
        }
        Returns: string
      }
      search_my_credits: {
        Args: { p_limit?: number; p_query?: string }
        Returns: {
          client_brand: string
          created_at: string
          credit_category: string
          endorsement_count: number
          id: string
          location: string
          platform: string
          primary_media_url: string
          project_name: string
          project_type: string
          role: string
          thumbnail_url: string
          url: string
          verification_status: string
          year: number
        }[]
      }
      seed_new_user_experience: { Args: { p_user_id: string }; Returns: Json }
      send_opportunity_alerts: {
        Args: { opportunity_id_param: string }
        Returns: undefined
      }
      set_invoice_sepa_beneficiary: {
        Args: { p_beneficiary_name: string; p_bic?: string; p_iban: string }
        Returns: Json
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      spend_xp: {
        Args: { p_amount: number; p_purpose: string }
        Returns: number
      }
      submit_credit_endorsement_by_token: {
        Args: {
          _accepted: boolean
          _endorser_name?: string
          _relationship?: string
          _testimonial?: string
          _token: string
        }
        Returns: Json
      }
      thrivefund_auto_finalize_due: { Args: never; Returns: undefined }
      touch_copilot_memory: {
        Args: { p_memory_id: string }
        Returns: undefined
      }
      update_milestone_workflow_status: {
        Args: { _milestone_id: string; _status: string }
        Returns: Json
      }
      update_my_location: {
        Args: { lat: number; lon: number }
        Returns: boolean
      }
      use_invite_code:
        | { Args: { code: string; user_email: string }; Returns: boolean }
        | {
            Args: { code: string; new_user_id?: string; user_email: string }
            Returns: boolean
          }
      use_partner_code: {
        Args: { p_code: string; p_user_id: string }
        Returns: boolean
      }
      user_can_view_call_transcript: {
        Args: {
          _t: Database["public"]["Tables"]["call_transcripts"]["Row"]
          _user: string
        }
        Returns: boolean
      }
      user_has_project_access: {
        Args: { project_id_param: string; user_id_param: string }
        Returns: boolean
      }
      validate_invite_code: { Args: { code: string }; Returns: boolean }
      vouch_on_credit: {
        Args: { _action: string; _credit_id: string; _note?: string }
        Returns: Json
      }
      wallet_credit: {
        Args: { p_amount: number; p_user_id: string }
        Returns: number
      }
      wallet_debit: {
        Args: { p_amount: number; p_user_id: string }
        Returns: number
      }
    }
    Enums: {
      account_type: "individual" | "company"
      agent_persona:
        | "scout"
        | "producer"
        | "archivist"
        | "deal"
        | "orchestrator"
      agent_proposal_kind:
        | "draft_invoice"
        | "schedule_followup"
        | "next_milestone"
        | "wrap_project"
        | "collab_nudge"
        | "other"
        | "chase_invoice"
        | "gig_match"
        | "rate_optimize"
        | "frequent_collaborator"
        | "passport_polish"
        | "home_focus"
        | "pay_cashflow"
        | "sponsor_followup_due"
        | "contract_unsigned"
        | "client_silence"
        | "deliverable_overdue"
        | "budget_incomplete"
        | "team_role_missing"
        | "daily_briefing_action"
      agent_proposal_status: "pending" | "accepted" | "dismissed" | "expired"
      app_role: "admin" | "moderator" | "user" | "writer"
      curated_application_status:
        | "pending"
        | "accepted"
        | "declined"
        | "waitlist"
      curated_raised_hand_status: "pending" | "promoted" | "dismissed"
      curated_rsvp_status:
        | "rsvp"
        | "waitlist"
        | "attended"
        | "no_show"
        | "cancelled"
      curated_stage_order_status: "pending" | "paid" | "refunded" | "failed"
      curated_stage_status:
        | "draft"
        | "scheduled"
        | "live"
        | "ended"
        | "cancelled"
      curated_stage_type: "showcase" | "scout"
      curated_turn_outcome:
        | "co_sign"
        | "credit"
        | "rolodex"
        | "followup"
        | "pass"
        | "timeout"
      inbox_triage_kind:
        | "lead"
        | "gig_inquiry"
        | "collab"
        | "fan"
        | "spam"
        | "admin"
        | "other"
      inbox_triage_status:
        | "pending"
        | "approved"
        | "sent"
        | "dismissed"
        | "failed"
      location_precision: "exact" | "approximate" | "area_only"
      network_tier:
        | "none"
        | "spark"
        | "connector"
        | "socialite"
        | "networker"
        | "mogul"
        | "icon"
      orch_action_status:
        | "proposed"
        | "approved"
        | "rejected"
        | "executed"
        | "failed"
        | "auto_executed"
      orch_agent_kind:
        | "orchestrator"
        | "profile"
        | "talent"
        | "gig"
        | "project_manager"
        | "client_followup"
        | "payment"
        | "credit"
        | "opportunity"
        | "event"
        | "site_epk"
        | "money_admin"
        | "community"
        | "memory"
      orch_approval_decision: "approved" | "rejected" | "edited"
      orch_risk_level: "safe_auto" | "requires_approval" | "locked"
      orch_run_status:
        | "pending"
        | "running"
        | "awaiting_approval"
        | "completed"
        | "failed"
        | "cancelled"
      user_badge:
        | "og"
        | "beta"
        | "official"
        | "founder"
        | "odos"
        | "founding_member"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      account_type: ["individual", "company"],
      agent_persona: ["scout", "producer", "archivist", "deal", "orchestrator"],
      agent_proposal_kind: [
        "draft_invoice",
        "schedule_followup",
        "next_milestone",
        "wrap_project",
        "collab_nudge",
        "other",
        "chase_invoice",
        "gig_match",
        "rate_optimize",
        "frequent_collaborator",
        "passport_polish",
        "home_focus",
        "pay_cashflow",
        "sponsor_followup_due",
        "contract_unsigned",
        "client_silence",
        "deliverable_overdue",
        "budget_incomplete",
        "team_role_missing",
        "daily_briefing_action",
      ],
      agent_proposal_status: ["pending", "accepted", "dismissed", "expired"],
      app_role: ["admin", "moderator", "user", "writer"],
      curated_application_status: [
        "pending",
        "accepted",
        "declined",
        "waitlist",
      ],
      curated_raised_hand_status: ["pending", "promoted", "dismissed"],
      curated_rsvp_status: [
        "rsvp",
        "waitlist",
        "attended",
        "no_show",
        "cancelled",
      ],
      curated_stage_order_status: ["pending", "paid", "refunded", "failed"],
      curated_stage_status: [
        "draft",
        "scheduled",
        "live",
        "ended",
        "cancelled",
      ],
      curated_stage_type: ["showcase", "scout"],
      curated_turn_outcome: [
        "co_sign",
        "credit",
        "rolodex",
        "followup",
        "pass",
        "timeout",
      ],
      inbox_triage_kind: [
        "lead",
        "gig_inquiry",
        "collab",
        "fan",
        "spam",
        "admin",
        "other",
      ],
      inbox_triage_status: [
        "pending",
        "approved",
        "sent",
        "dismissed",
        "failed",
      ],
      location_precision: ["exact", "approximate", "area_only"],
      network_tier: [
        "none",
        "spark",
        "connector",
        "socialite",
        "networker",
        "mogul",
        "icon",
      ],
      orch_action_status: [
        "proposed",
        "approved",
        "rejected",
        "executed",
        "failed",
        "auto_executed",
      ],
      orch_agent_kind: [
        "orchestrator",
        "profile",
        "talent",
        "gig",
        "project_manager",
        "client_followup",
        "payment",
        "credit",
        "opportunity",
        "event",
        "site_epk",
        "money_admin",
        "community",
        "memory",
      ],
      orch_approval_decision: ["approved", "rejected", "edited"],
      orch_risk_level: ["safe_auto", "requires_approval", "locked"],
      orch_run_status: [
        "pending",
        "running",
        "awaiting_approval",
        "completed",
        "failed",
        "cancelled",
      ],
      user_badge: [
        "og",
        "beta",
        "official",
        "founder",
        "odos",
        "founding_member",
      ],
    },
  },
} as const
