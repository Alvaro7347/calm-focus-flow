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
      activation_cycles: {
        Row: {
          completed_at: string | null
          confirmed_next_steps_count: number | null
          created_at: string
          created_tasks_count: number | null
          cycle_type: string
          dumped_items_count: number | null
          id: string
          mental_load_after: number | null
          mental_load_before: number | null
          mental_load_delta: number | null
          next_steps_count: number | null
          reviewed_items_count: number | null
          started_at: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          confirmed_next_steps_count?: number | null
          created_at?: string
          created_tasks_count?: number | null
          cycle_type?: string
          dumped_items_count?: number | null
          id?: string
          mental_load_after?: number | null
          mental_load_before?: number | null
          mental_load_delta?: number | null
          next_steps_count?: number | null
          reviewed_items_count?: number | null
          started_at?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          confirmed_next_steps_count?: number | null
          created_at?: string
          created_tasks_count?: number | null
          cycle_type?: string
          dumped_items_count?: number | null
          id?: string
          mental_load_after?: number | null
          mental_load_before?: number | null
          mental_load_delta?: number | null
          next_steps_count?: number | null
          reviewed_items_count?: number | null
          started_at?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      activity_log: {
        Row: {
          action: string
          created_at: string
          id: string
          new_value: Json | null
          old_value: Json | null
          task_id: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          task_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      analytics_events: {
        Row: {
          created_at: string
          event_name: string
          event_properties: Json
          experiment_key: string | null
          experiment_variant: string | null
          id: string
          persona_segment: string | null
          route: string | null
          session_id: string | null
          source: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_name: string
          event_properties?: Json
          experiment_key?: string | null
          experiment_variant?: string | null
          id?: string
          persona_segment?: string | null
          route?: string | null
          session_id?: string | null
          source?: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_name?: string
          event_properties?: Json
          experiment_key?: string | null
          experiment_variant?: string | null
          id?: string
          persona_segment?: string | null
          route?: string | null
          session_id?: string | null
          source?: string
          user_id?: string
        }
        Relationships: []
      }
      areas: {
        Row: {
          archived_at: string | null
          color: string | null
          created_at: string
          display_order: number
          icon: string | null
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          color?: string | null
          created_at?: string
          display_order?: number
          icon?: string | null
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          archived_at?: string | null
          color?: string | null
          created_at?: string
          display_order?: number
          icon?: string | null
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "areas_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      attachments: {
        Row: {
          created_at: string
          filename: string
          id: string
          mime_type: string | null
          size_bytes: number | null
          storage_path: string
          task_id: string
        }
        Insert: {
          created_at?: string
          filename: string
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_path: string
          task_id: string
        }
        Update: {
          created_at?: string
          filename?: string
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_path?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attachments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      capture_sessions: {
        Row: {
          created_at: string
          id: string
          source: Database["public"]["Enums"]["capture_source"]
          transcription: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          source: Database["public"]["Enums"]["capture_source"]
          transcription?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          source?: Database["public"]["Enums"]["capture_source"]
          transcription?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "capture_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      experiment_assignments: {
        Row: {
          assigned_at: string
          experiment_key: string
          id: string
          user_id: string
          variant: string
        }
        Insert: {
          assigned_at?: string
          experiment_key: string
          id?: string
          user_id: string
          variant: string
        }
        Update: {
          assigned_at?: string
          experiment_key?: string
          id?: string
          user_id?: string
          variant?: string
        }
        Relationships: []
      }
      external_research_notes: {
        Row: {
          answer_text: string | null
          created_at: string
          decision: string | null
          evidence_type: string | null
          hypothesis_area: string | null
          id: string
          notes: string | null
          participant_label: string | null
          participant_segment: string | null
          question_key: string | null
          research_method: string
          researcher_user_id: string
          signal_strength: string | null
        }
        Insert: {
          answer_text?: string | null
          created_at?: string
          decision?: string | null
          evidence_type?: string | null
          hypothesis_area?: string | null
          id?: string
          notes?: string | null
          participant_label?: string | null
          participant_segment?: string | null
          question_key?: string | null
          research_method: string
          researcher_user_id?: string
          signal_strength?: string | null
        }
        Update: {
          answer_text?: string | null
          created_at?: string
          decision?: string | null
          evidence_type?: string | null
          hypothesis_area?: string | null
          id?: string
          notes?: string | null
          participant_label?: string | null
          participant_segment?: string | null
          question_key?: string | null
          research_method?: string
          researcher_user_id?: string
          signal_strength?: string | null
        }
        Relationships: []
      }
      in_app_survey_responses: {
        Row: {
          answer_number: number | null
          answer_text: string | null
          answer_value: string | null
          context: Json
          created_at: string
          id: string
          question_key: string
          route: string | null
          survey_key: string
          user_id: string
        }
        Insert: {
          answer_number?: number | null
          answer_text?: string | null
          answer_value?: string | null
          context?: Json
          created_at?: string
          id?: string
          question_key: string
          route?: string | null
          survey_key: string
          user_id: string
        }
        Update: {
          answer_number?: number | null
          answer_text?: string | null
          answer_value?: string | null
          context?: Json
          created_at?: string
          id?: string
          question_key?: string
          route?: string | null
          survey_key?: string
          user_id?: string
        }
        Relationships: []
      }
      internal_config: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      notification_deliveries: {
        Row: {
          activity_id: string | null
          attempt: number
          created_at: string
          dedupe_key: string
          error_summary: string | null
          id: string
          logical_date: string | null
          notification_type: string
          sent_at: string
          status: string
          subscription_id: string | null
          user_id: string
        }
        Insert: {
          activity_id?: string | null
          attempt?: number
          created_at?: string
          dedupe_key: string
          error_summary?: string | null
          id?: string
          logical_date?: string | null
          notification_type: string
          sent_at?: string
          status?: string
          subscription_id?: string | null
          user_id: string
        }
        Update: {
          activity_id?: string | null
          attempt?: number
          created_at?: string
          dedupe_key?: string
          error_summary?: string | null
          id?: string
          logical_date?: string | null
          notification_type?: string
          sent_at?: string
          status?: string
          subscription_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_deliveries_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "push_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          created_at: string
          daily_summary_enabled: boolean
          daily_summary_hour: number
          daily_summary_minute: number
          event_reminders_enabled: boolean
          notifications_enabled: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          daily_summary_enabled?: boolean
          daily_summary_hour?: number
          daily_summary_minute?: number
          event_reminders_enabled?: boolean
          notifications_enabled?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          daily_summary_enabled?: boolean
          daily_summary_hour?: number
          daily_summary_minute?: number
          event_reminders_enabled?: boolean
          notifications_enabled?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          apellidos: string | null
          avatar_url: string | null
          created_at: string
          date_format: string
          email: string | null
          id: string
          locale: string
          nombre: string | null
          timezone: string
          updated_at: string
          week_starts_on: number
        }
        Insert: {
          apellidos?: string | null
          avatar_url?: string | null
          created_at?: string
          date_format?: string
          email?: string | null
          id: string
          locale?: string
          nombre?: string | null
          timezone?: string
          updated_at?: string
          week_starts_on?: number
        }
        Update: {
          apellidos?: string | null
          avatar_url?: string | null
          created_at?: string
          date_format?: string
          email?: string | null
          id?: string
          locale?: string
          nombre?: string | null
          timezone?: string
          updated_at?: string
          week_starts_on?: number
        }
        Relationships: []
      }
      projects: {
        Row: {
          archived_at: string | null
          area_id: string
          color: string | null
          created_at: string
          description: string | null
          display_order: number
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          area_id: string
          color?: string | null
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          area_id?: string
          color?: string | null
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth_key: string
          created_at: string
          deactivated_at: string | null
          device_id: string | null
          endpoint: string
          id: string
          is_active: boolean
          last_seen_at: string
          p256dh: string
          platform: string | null
          timezone: string | null
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth_key: string
          created_at?: string
          deactivated_at?: string | null
          device_id?: string | null
          endpoint: string
          id?: string
          is_active?: boolean
          last_seen_at?: string
          p256dh: string
          platform?: string | null
          timezone?: string | null
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth_key?: string
          created_at?: string
          deactivated_at?: string | null
          device_id?: string | null
          endpoint?: string
          id?: string
          is_active?: boolean
          last_seen_at?: string
          p256dh?: string
          platform?: string | null
          timezone?: string | null
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      subprojects: {
        Row: {
          archived_at: string | null
          created_at: string
          display_order: number
          id: string
          name: string
          project_id: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          display_order?: number
          id?: string
          name: string
          project_id: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          display_order?: number
          id?: string
          name?: string
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subprojects_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      task_reminders: {
        Row: {
          created_at: string
          id: string
          remind_at: string
          sent_at: string | null
          task_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          remind_at: string
          sent_at?: string | null
          task_id: string
        }
        Update: {
          created_at?: string
          id?: string
          remind_at?: string
          sent_at?: string | null
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_reminders_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          activity_type: Database["public"]["Enums"]["activity_type"]
          actual_duration_min: number | null
          archived_at: string | null
          blocked_reason: string | null
          capture_session_id: string | null
          completed_at: string | null
          created_at: string
          description: string | null
          ends_at: string | null
          estimated_duration_min: number | null
          id: string
          priority: Database["public"]["Enums"]["task_priority"]
          source: Database["public"]["Enums"]["task_source"]
          starts_at: string | null
          status: Database["public"]["Enums"]["task_status"]
          subproject_id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          activity_type?: Database["public"]["Enums"]["activity_type"]
          actual_duration_min?: number | null
          archived_at?: string | null
          blocked_reason?: string | null
          capture_session_id?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          ends_at?: string | null
          estimated_duration_min?: number | null
          id?: string
          priority?: Database["public"]["Enums"]["task_priority"]
          source?: Database["public"]["Enums"]["task_source"]
          starts_at?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          subproject_id: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          activity_type?: Database["public"]["Enums"]["activity_type"]
          actual_duration_min?: number | null
          archived_at?: string | null
          blocked_reason?: string | null
          capture_session_id?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          ends_at?: string | null
          estimated_duration_min?: number | null
          id?: string
          priority?: Database["public"]["Enums"]["task_priority"]
          source?: Database["public"]["Enums"]["task_source"]
          starts_at?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          subproject_id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_capture_session_id_fkey"
            columns: ["capture_session_id"]
            isOneToOne: false
            referencedRelation: "capture_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_subproject_id_fkey"
            columns: ["subproject_id"]
            isOneToOne: false
            referencedRelation: "subprojects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_research_profiles: {
        Row: {
          acquisition_source: string | null
          created_at: string
          current_tool: string | null
          main_pain: string | null
          notes: string | null
          persona_segment: string | null
          test_group: string | null
          updated_at: string
          user_id: string
          willingness_to_pay: string | null
        }
        Insert: {
          acquisition_source?: string | null
          created_at?: string
          current_tool?: string | null
          main_pain?: string | null
          notes?: string | null
          persona_segment?: string | null
          test_group?: string | null
          updated_at?: string
          user_id: string
          willingness_to_pay?: string | null
        }
        Update: {
          acquisition_source?: string | null
          created_at?: string
          current_tool?: string | null
          main_pain?: string | null
          notes?: string | null
          persona_segment?: string | null
          test_group?: string | null
          updated_at?: string
          user_id?: string
          willingness_to_pay?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      subproject_belongs_to_user: {
        Args: { _subproject_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      activity_type: "task" | "event"
      capture_source: "text" | "voice"
      task_priority: "high" | "medium" | "low"
      task_source: "text" | "voice" | "manual" | "import" | "api"
      task_status: "pending" | "completed" | "waiting"
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
      activity_type: ["task", "event"],
      capture_source: ["text", "voice"],
      task_priority: ["high", "medium", "low"],
      task_source: ["text", "voice", "manual", "import", "api"],
      task_status: ["pending", "completed", "waiting"],
    },
  },
} as const
