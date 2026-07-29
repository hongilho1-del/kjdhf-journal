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
      admin_login_aliases: {
        Row: {
          created_at: string
          created_by: string
          updated_at: string
          user_id: string
          username: string
        }
        Insert: {
          created_at?: string
          created_by: string
          updated_at?: string
          user_id: string
          username: string
        }
        Update: {
          created_at?: string
          created_by?: string
          updated_at?: string
          user_id?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_login_aliases_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_login_aliases_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      authors: {
        Row: {
          affiliation_en: string | null
          affiliation_ko: string
          created_at: string
          email: string
          id: string
          is_corresponding: boolean
          manuscript_id: string
          name_en: string | null
          name_ko: string
          sort_order: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          affiliation_en?: string | null
          affiliation_ko: string
          created_at?: string
          email: string
          id?: string
          is_corresponding?: boolean
          manuscript_id: string
          name_en?: string | null
          name_ko: string
          sort_order?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          affiliation_en?: string | null
          affiliation_ko?: string
          created_at?: string
          email?: string
          id?: string
          is_corresponding?: boolean
          manuscript_id?: string
          name_en?: string | null
          name_ko?: string
          sort_order?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "authors_manuscript_id_fkey"
            columns: ["manuscript_id"]
            isOneToOne: false
            referencedRelation: "manuscripts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "authors_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      board_posts: {
        Row: {
          author_id: string | null
          category: string
          content: string
          created_at: string
          event_end_at: string | null
          event_start_at: string | null
          id: string
          is_pinned: boolean
          is_published: boolean
          location: string | null
          published_at: string | null
          title: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          category: string
          content: string
          created_at?: string
          event_end_at?: string | null
          event_start_at?: string | null
          id?: string
          is_pinned?: boolean
          is_published?: boolean
          location?: string | null
          published_at?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          category?: string
          content?: string
          created_at?: string
          event_end_at?: string | null
          event_start_at?: string | null
          id?: string
          is_pinned?: boolean
          is_published?: boolean
          location?: string | null
          published_at?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "board_posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      editorial_decisions: {
        Row: {
          author_letter: string
          decided_at: string
          decided_by: string
          decision: Database["public"]["Enums"]["editorial_decision_type"]
          id: string
          internal_note: string | null
          manuscript_id: string
          round_no: number
        }
        Insert: {
          author_letter: string
          decided_at?: string
          decided_by?: string
          decision: Database["public"]["Enums"]["editorial_decision_type"]
          id?: string
          internal_note?: string | null
          manuscript_id: string
          round_no: number
        }
        Update: {
          author_letter?: string
          decided_at?: string
          decided_by?: string
          decision?: Database["public"]["Enums"]["editorial_decision_type"]
          id?: string
          internal_note?: string | null
          manuscript_id?: string
          round_no?: number
        }
        Relationships: [
          {
            foreignKeyName: "editorial_decisions_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "editorial_decisions_manuscript_id_fkey"
            columns: ["manuscript_id"]
            isOneToOne: false
            referencedRelation: "manuscripts"
            referencedColumns: ["id"]
          },
        ]
      }
      issues: {
        Row: {
          created_at: string
          created_by: string
          id: string
          issue_number: number
          publication_date: string | null
          status: Database["public"]["Enums"]["issue_status"]
          title: string | null
          updated_at: string
          volume: number
          year: number
        }
        Insert: {
          created_at?: string
          created_by?: string
          id?: string
          issue_number: number
          publication_date?: string | null
          status?: Database["public"]["Enums"]["issue_status"]
          title?: string | null
          updated_at?: string
          volume: number
          year: number
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          issue_number?: number
          publication_date?: string | null
          status?: Database["public"]["Enums"]["issue_status"]
          title?: string | null
          updated_at?: string
          volume?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "issues_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      manuscript_counters: {
        Row: {
          last_number: number
          year: number
        }
        Insert: {
          last_number?: number
          year: number
        }
        Update: {
          last_number?: number
          year?: number
        }
        Relationships: []
      }
      manuscript_files: {
        Row: {
          bucket_id: string
          checksum_sha256: string | null
          created_at: string
          file_kind: Database["public"]["Enums"]["manuscript_file_kind"]
          id: string
          is_anonymized: boolean
          manuscript_id: string
          mime_type: string
          original_name: string
          size_bytes: number
          storage_path: string
          uploaded_by: string
          version_no: number
        }
        Insert: {
          bucket_id: string
          checksum_sha256?: string | null
          created_at?: string
          file_kind: Database["public"]["Enums"]["manuscript_file_kind"]
          id?: string
          is_anonymized?: boolean
          manuscript_id: string
          mime_type: string
          original_name: string
          size_bytes: number
          storage_path: string
          uploaded_by?: string
          version_no?: number
        }
        Update: {
          bucket_id?: string
          checksum_sha256?: string | null
          created_at?: string
          file_kind?: Database["public"]["Enums"]["manuscript_file_kind"]
          id?: string
          is_anonymized?: boolean
          manuscript_id?: string
          mime_type?: string
          original_name?: string
          size_bytes?: number
          storage_path?: string
          uploaded_by?: string
          version_no?: number
        }
        Relationships: [
          {
            foreignKeyName: "manuscript_files_manuscript_id_fkey"
            columns: ["manuscript_id"]
            isOneToOne: false
            referencedRelation: "manuscripts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manuscript_files_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      manuscript_status_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          from_status: Database["public"]["Enums"]["manuscript_status"] | null
          id: number
          manuscript_id: string
          note: string | null
          to_status: Database["public"]["Enums"]["manuscript_status"]
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          from_status?: Database["public"]["Enums"]["manuscript_status"] | null
          id?: never
          manuscript_id: string
          note?: string | null
          to_status: Database["public"]["Enums"]["manuscript_status"]
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          from_status?: Database["public"]["Enums"]["manuscript_status"] | null
          id?: never
          manuscript_id?: string
          note?: string | null
          to_status?: Database["public"]["Enums"]["manuscript_status"]
        }
        Relationships: [
          {
            foreignKeyName: "manuscript_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manuscript_status_history_manuscript_id_fkey"
            columns: ["manuscript_id"]
            isOneToOne: false
            referencedRelation: "manuscripts"
            referencedColumns: ["id"]
          },
        ]
      }
      manuscripts: {
        Row: {
          abstract_en: string
          abstract_ko: string
          conflict_of_interest_confirmed: boolean
          copyright_agreed: boolean
          created_at: string
          created_by: string
          current_due_at: string | null
          ethics_confirmed: boolean
          id: string
          keywords_en: string[]
          keywords_ko: string[]
          manuscript_code: string | null
          research_field: string
          round_no: number
          status: Database["public"]["Enums"]["manuscript_status"]
          submitted_at: string | null
          title_en: string
          title_ko: string
          updated_at: string
        }
        Insert: {
          abstract_en: string
          abstract_ko: string
          conflict_of_interest_confirmed?: boolean
          copyright_agreed?: boolean
          created_at?: string
          created_by?: string
          current_due_at?: string | null
          ethics_confirmed?: boolean
          id?: string
          keywords_en?: string[]
          keywords_ko?: string[]
          manuscript_code?: string | null
          research_field: string
          round_no?: number
          status?: Database["public"]["Enums"]["manuscript_status"]
          submitted_at?: string | null
          title_en: string
          title_ko: string
          updated_at?: string
        }
        Update: {
          abstract_en?: string
          abstract_ko?: string
          conflict_of_interest_confirmed?: boolean
          copyright_agreed?: boolean
          created_at?: string
          created_by?: string
          current_due_at?: string | null
          ethics_confirmed?: boolean
          id?: string
          keywords_en?: string[]
          keywords_ko?: string[]
          manuscript_code?: string | null
          research_field?: string
          round_no?: number
          status?: Database["public"]["Enums"]["manuscript_status"]
          submitted_at?: string | null
          title_en?: string
          title_ko?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "manuscripts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_roles: {
        Row: {
          granted_at: string
          granted_by: string | null
          profile_id: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          profile_id: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          profile_id?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: [
          {
            foreignKeyName: "profile_roles_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_roles_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_role_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          id: number
          new_role: Database["public"]["Enums"]["app_role"]
          old_role: Database["public"]["Enums"]["app_role"] | null
          profile_id: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          id?: never
          new_role: Database["public"]["Enums"]["app_role"]
          old_role?: Database["public"]["Enums"]["app_role"] | null
          profile_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          id?: never
          new_role?: Database["public"]["Enums"]["app_role"]
          old_role?: Database["public"]["Enums"]["app_role"] | null
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_role_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_role_history_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          affiliation: string | null
          approved_at: string | null
          approved_by: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          is_active: boolean
          phone: string | null
          research_fields: string[]
          reviewer_bio: string | null
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          affiliation?: string | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          email: string
          full_name?: string
          id: string
          is_active?: boolean
          phone?: string | null
          research_fields?: string[]
          reviewer_bio?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          affiliation?: string | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          phone?: string | null
          research_fields?: string[]
          reviewer_bio?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      published_articles: {
        Row: {
          abstract_en: string
          abstract_ko: string
          article_order: number
          created_by: string
          doi: string | null
          id: string
          issue_id: string
          keywords_en: string[]
          keywords_ko: string[]
          manuscript_id: string
          page_end: number | null
          page_start: number | null
          pdf_file_id: string | null
          published_at: string
          title_en: string
          title_ko: string
        }
        Insert: {
          abstract_en: string
          abstract_ko: string
          article_order: number
          created_by?: string
          doi?: string | null
          id?: string
          issue_id: string
          keywords_en?: string[]
          keywords_ko?: string[]
          manuscript_id: string
          page_end?: number | null
          page_start?: number | null
          pdf_file_id?: string | null
          published_at?: string
          title_en: string
          title_ko: string
        }
        Update: {
          abstract_en?: string
          abstract_ko?: string
          article_order?: number
          created_by?: string
          doi?: string | null
          id?: string
          issue_id?: string
          keywords_en?: string[]
          keywords_ko?: string[]
          manuscript_id?: string
          page_end?: number | null
          page_start?: number | null
          pdf_file_id?: string | null
          published_at?: string
          title_en?: string
          title_ko?: string
        }
        Relationships: [
          {
            foreignKeyName: "published_articles_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "published_articles_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "issues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "published_articles_manuscript_id_fkey"
            columns: ["manuscript_id"]
            isOneToOne: true
            referencedRelation: "manuscripts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "published_articles_pdf_file_id_fkey"
            columns: ["pdf_file_id"]
            isOneToOne: false
            referencedRelation: "manuscript_files"
            referencedColumns: ["id"]
          },
        ]
      }
      reviewer_assignments: {
        Row: {
          assigned_by: string
          created_at: string
          decline_reason: string | null
          due_at: string
          id: string
          manuscript_id: string
          responded_at: string | null
          reviewer_id: string
          round_no: number
          status: Database["public"]["Enums"]["assignment_status"]
          updated_at: string
        }
        Insert: {
          assigned_by?: string
          created_at?: string
          decline_reason?: string | null
          due_at: string
          id?: string
          manuscript_id: string
          responded_at?: string | null
          reviewer_id: string
          round_no?: number
          status?: Database["public"]["Enums"]["assignment_status"]
          updated_at?: string
        }
        Update: {
          assigned_by?: string
          created_at?: string
          decline_reason?: string | null
          due_at?: string
          id?: string
          manuscript_id?: string
          responded_at?: string | null
          reviewer_id?: string
          round_no?: number
          status?: Database["public"]["Enums"]["assignment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviewer_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviewer_assignments_manuscript_id_fkey"
            columns: ["manuscript_id"]
            isOneToOne: false
            referencedRelation: "manuscripts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviewer_assignments_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          assignment_id: string
          author_comments: string
          created_at: string
          editor_comments: string
          id: string
          recommendation:
            | Database["public"]["Enums"]["review_recommendation"]
            | null
          status: Database["public"]["Enums"]["review_status"]
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          assignment_id: string
          author_comments?: string
          created_at?: string
          editor_comments?: string
          id?: string
          recommendation?:
            | Database["public"]["Enums"]["review_recommendation"]
            | null
          status?: Database["public"]["Enums"]["review_status"]
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          assignment_id?: string
          author_comments?: string
          created_at?: string
          editor_comments?: string
          id?: string
          recommendation?:
            | Database["public"]["Enums"]["review_recommendation"]
            | null
          status?: Database["public"]["Enums"]["review_status"]
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: true
            referencedRelation: "reviewer_assignments"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      advance_manuscript_status: {
        Args: {
          change_note?: string
          next_status: Database["public"]["Enums"]["manuscript_status"]
          target_manuscript_id: string
        }
        Returns: {
          abstract_en: string
          abstract_ko: string
          conflict_of_interest_confirmed: boolean
          copyright_agreed: boolean
          created_at: string
          created_by: string
          current_due_at: string | null
          ethics_confirmed: boolean
          id: string
          keywords_en: string[]
          keywords_ko: string[]
          manuscript_code: string | null
          research_field: string
          round_no: number
          status: Database["public"]["Enums"]["manuscript_status"]
          submitted_at: string | null
          title_en: string
          title_ko: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "manuscripts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      assign_reviewer: {
        Args: {
          review_due_at: string
          target_manuscript_id: string
          target_reviewer_id: string
        }
        Returns: {
          assigned_by: string
          created_at: string
          decline_reason: string | null
          due_at: string
          id: string
          manuscript_id: string
          responded_at: string | null
          reviewer_id: string
          round_no: number
          status: Database["public"]["Enums"]["assignment_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "reviewer_assignments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      current_app_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      get_author_decisions: {
        Args: { target_manuscript_id: string }
        Returns: {
          author_letter: string
          decided_at: string
          decision: Database["public"]["Enums"]["editorial_decision_type"]
          round_no: number
        }[]
      }
      get_author_review_results: {
        Args: { target_manuscript_id: string }
        Returns: {
          author_comments: string
          recommendation: Database["public"]["Enums"]["review_recommendation"]
          reviewer_no: number
          round_no: number
          submitted_at: string
        }[]
      }
      get_author_status_history: {
        Args: { target_manuscript_id: string }
        Returns: {
          changed_at: string
          from_status: Database["public"]["Enums"]["manuscript_status"]
          note: string
          to_status: Database["public"]["Enums"]["manuscript_status"]
        }[]
      }
      get_reviewer_files: {
        Args: { target_manuscript_id: string }
        Returns: {
          bucket_id: string
          created_at: string
          file_id: string
          file_kind: Database["public"]["Enums"]["manuscript_file_kind"]
          mime_type: string
          size_bytes: number
          storage_path: string
          version_no: number
        }[]
      }
      get_reviewer_manuscripts: {
        Args: never
        Returns: {
          abstract_en: string
          abstract_ko: string
          assignment_id: string
          assignment_status: Database["public"]["Enums"]["assignment_status"]
          due_at: string
          keywords_en: string[]
          keywords_ko: string[]
          manuscript_code: string
          manuscript_id: string
          manuscript_status: Database["public"]["Enums"]["manuscript_status"]
          recommendation: Database["public"]["Enums"]["review_recommendation"]
          research_field: string
          responded_at: string
          review_status: Database["public"]["Enums"]["review_status"]
          review_submitted_at: string
          round_no: number
          title_en: string
          title_ko: string
        }[]
      }
      get_my_roles: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"][]
      }
      has_app_role: {
        Args: { required_role: Database["public"]["Enums"]["app_role"] }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_assigned_reviewer: {
        Args: { target_manuscript_id: string }
        Returns: boolean
      }
      is_editorial: { Args: never; Returns: boolean }
      owns_manuscript: {
        Args: { target_manuscript_id: string }
        Returns: boolean
      }
      record_editorial_decision: {
        Args: {
          new_decision: Database["public"]["Enums"]["editorial_decision_type"]
          private_internal_note?: string
          public_author_letter: string
          target_manuscript_id: string
        }
        Returns: {
          author_letter: string
          decided_at: string
          decided_by: string
          decision: Database["public"]["Enums"]["editorial_decision_type"]
          id: string
          internal_note: string | null
          manuscript_id: string
          round_no: number
        }
        SetofOptions: {
          from: "*"
          to: "editorial_decisions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      respond_to_review_assignment: {
        Args: {
          accept_assignment: boolean
          response_reason?: string
          target_assignment_id: string
        }
        Returns: {
          assigned_by: string
          created_at: string
          decline_reason: string | null
          due_at: string
          id: string
          manuscript_id: string
          responded_at: string | null
          reviewer_id: string
          round_no: number
          status: Database["public"]["Enums"]["assignment_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "reviewer_assignments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      save_review_draft: {
        Args: {
          draft_author_comments?: string
          draft_editor_comments?: string
          draft_recommendation?: Database["public"]["Enums"]["review_recommendation"]
          target_assignment_id: string
        }
        Returns: {
          assignment_id: string
          author_comments: string
          created_at: string
          editor_comments: string
          id: string
          recommendation:
            | Database["public"]["Enums"]["review_recommendation"]
            | null
          status: Database["public"]["Enums"]["review_status"]
          submitted_at: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "reviews"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_user_role: {
        Args: {
          new_role: Database["public"]["Enums"]["app_role"]
          target_user_id: string
        }
        Returns: {
          affiliation: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          is_active: boolean
          phone: string | null
          research_fields: string[]
          reviewer_bio: string | null
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_user_roles: {
        Args: {
          new_roles: Database["public"]["Enums"]["app_role"][]
          target_user_id: string
        }
        Returns: Database["public"]["Enums"]["app_role"][]
      }
      set_user_activation: {
        Args: {
          change_note?: string
          make_active: boolean
          target_user_id: string
        }
        Returns: {
          affiliation: string | null
          approved_at: string | null
          approved_by: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          is_active: boolean
          phone: string | null
          research_fields: string[]
          reviewer_bio: string | null
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_admin_login_alias: {
        Args: {
          login_username: string
          target_user_id: string
        }
        Returns: {
          created_at: string
          created_by: string
          updated_at: string
          user_id: string
          username: string
        }
        SetofOptions: {
          from: "*"
          to: "admin_login_aliases"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      submit_manuscript: {
        Args: { target_manuscript_id: string }
        Returns: {
          abstract_en: string
          abstract_ko: string
          conflict_of_interest_confirmed: boolean
          copyright_agreed: boolean
          created_at: string
          created_by: string
          current_due_at: string | null
          ethics_confirmed: boolean
          id: string
          keywords_en: string[]
          keywords_ko: string[]
          manuscript_code: string | null
          research_field: string
          round_no: number
          status: Database["public"]["Enums"]["manuscript_status"]
          submitted_at: string | null
          title_en: string
          title_ko: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "manuscripts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      submit_review: {
        Args: {
          final_author_comments: string
          final_editor_comments?: string
          final_recommendation: Database["public"]["Enums"]["review_recommendation"]
          target_assignment_id: string
        }
        Returns: {
          assignment_id: string
          author_comments: string
          created_at: string
          editor_comments: string
          id: string
          recommendation:
            | Database["public"]["Enums"]["review_recommendation"]
            | null
          status: Database["public"]["Enums"]["review_status"]
          submitted_at: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "reviews"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      submit_revision: {
        Args: { target_manuscript_id: string }
        Returns: {
          abstract_en: string
          abstract_ko: string
          conflict_of_interest_confirmed: boolean
          copyright_agreed: boolean
          created_at: string
          created_by: string
          current_due_at: string | null
          ethics_confirmed: boolean
          id: string
          keywords_en: string[]
          keywords_ko: string[]
          manuscript_code: string | null
          research_field: string
          round_no: number
          status: Database["public"]["Enums"]["manuscript_status"]
          submitted_at: string | null
          title_en: string
          title_ko: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "manuscripts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_my_profile: {
        Args: {
          new_affiliation?: string
          new_full_name: string
          new_phone?: string
          new_research_fields?: string[]
          new_reviewer_bio?: string
        }
        Returns: {
          affiliation: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          is_active: boolean
          phone: string | null
          research_fields: string[]
          reviewer_bio: string | null
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      app_role: "AUTHOR" | "REVIEWER" | "EDITOR" | "ADMIN"
      assignment_status:
        | "INVITED"
        | "ACCEPTED"
        | "DECLINED"
        | "COMPLETED"
        | "CANCELLED"
      editorial_decision_type:
        | "REVISION_REQUESTED"
        | "ACCEPTED"
        | "ACCEPT_WITH_REVISIONS"
        | "REJECTED"
        | "FINAL_ACCEPTED"
      issue_status: "DRAFT" | "PUBLISHED"
      manuscript_file_kind:
        | "ORIGINAL"
        | "ANONYMIZED"
        | "REVISION"
        | "FINAL"
        | "REVIEW_ATTACHMENT"
        | "PUBLISHED"
      manuscript_status:
        | "DRAFT"
        | "SUBMITTED"
        | "RECEIVED"
        | "FORMAT_REVIEW"
        | "REVIEWER_SELECTION"
        | "UNDER_REVIEW"
        | "REVISION_REQUESTED"
        | "REVISION_SUBMITTED"
        | "RE_REVIEW"
        | "ACCEPTED"
        | "ACCEPT_WITH_REVISIONS"
        | "REJECTED"
        | "FINAL_ACCEPTED"
        | "PUBLISHED"
      review_recommendation:
        | "ACCEPT"
        | "ACCEPT_WITH_REVISIONS"
        | "RE_REVIEW"
        | "REJECT"
      review_status: "DRAFT" | "SUBMITTED"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      app_role: ["AUTHOR", "REVIEWER", "EDITOR", "ADMIN"],
      assignment_status: [
        "INVITED",
        "ACCEPTED",
        "DECLINED",
        "COMPLETED",
        "CANCELLED",
      ],
      editorial_decision_type: [
        "REVISION_REQUESTED",
        "ACCEPTED",
        "ACCEPT_WITH_REVISIONS",
        "REJECTED",
        "FINAL_ACCEPTED",
      ],
      issue_status: ["DRAFT", "PUBLISHED"],
      manuscript_file_kind: [
        "ORIGINAL",
        "ANONYMIZED",
        "REVISION",
        "FINAL",
        "REVIEW_ATTACHMENT",
        "PUBLISHED",
      ],
      manuscript_status: [
        "DRAFT",
        "SUBMITTED",
        "RECEIVED",
        "FORMAT_REVIEW",
        "REVIEWER_SELECTION",
        "UNDER_REVIEW",
        "REVISION_REQUESTED",
        "REVISION_SUBMITTED",
        "RE_REVIEW",
        "ACCEPTED",
        "ACCEPT_WITH_REVISIONS",
        "REJECTED",
        "FINAL_ACCEPTED",
        "PUBLISHED",
      ],
      review_recommendation: [
        "ACCEPT",
        "ACCEPT_WITH_REVISIONS",
        "RE_REVIEW",
        "REJECT",
      ],
      review_status: ["DRAFT", "SUBMITTED"],
    },
  },
} as const
