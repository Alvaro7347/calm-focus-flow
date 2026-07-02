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
          actual_duration_min: number | null
          archived_at: string | null
          blocked_reason: string | null
          capture_session_id: string | null
          completed_at: string | null
          created_at: string
          description: string | null
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
          actual_duration_min?: number | null
          archived_at?: string | null
          blocked_reason?: string | null
          capture_session_id?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
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
          actual_duration_min?: number | null
          archived_at?: string | null
          blocked_reason?: string | null
          capture_session_id?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
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
      capture_source: ["text", "voice"],
      task_priority: ["high", "medium", "low"],
      task_source: ["text", "voice", "manual", "import", "api"],
      task_status: ["pending", "completed", "waiting"],
    },
  },
} as const
