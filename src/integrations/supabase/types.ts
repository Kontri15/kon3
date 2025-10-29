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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      blocks: {
        Row: {
          created_at: string | null
          end_at: string
          id: string
          meal_details: string | null
          notes: string | null
          ritual_id: string | null
          start_at: string
          status: Database["public"]["Enums"]["block_status"] | null
          task_id: string | null
          title: string
          type: Database["public"]["Enums"]["block_type"]
          updated_at: string | null
          user_id: string
          workout_details: Json | null
        }
        Insert: {
          created_at?: string | null
          end_at: string
          id?: string
          meal_details?: string | null
          notes?: string | null
          ritual_id?: string | null
          start_at: string
          status?: Database["public"]["Enums"]["block_status"] | null
          task_id?: string | null
          title: string
          type: Database["public"]["Enums"]["block_type"]
          updated_at?: string | null
          user_id: string
          workout_details?: Json | null
        }
        Update: {
          created_at?: string | null
          end_at?: string
          id?: string
          meal_details?: string | null
          notes?: string | null
          ritual_id?: string | null
          start_at?: string
          status?: Database["public"]["Enums"]["block_status"] | null
          task_id?: string | null
          title?: string
          type?: Database["public"]["Enums"]["block_type"]
          updated_at?: string | null
          user_id?: string
          workout_details?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "blocks_ritual_id_fkey"
            columns: ["ritual_id"]
            isOneToOne: false
            referencedRelation: "rituals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocks_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_history: {
        Row: {
          created_at: string | null
          date: string
          dinner_meal: string | null
          hrv_ms: number | null
          id: string
          lunch_meal: string | null
          notes: string | null
          recovery_pct: number | null
          sleep_hours: number | null
          tasks_completed: number | null
          total_work_minutes: number | null
          updated_at: string | null
          user_id: string
          workout_completed: boolean | null
          workout_exercises: Json | null
          workout_type: string | null
        }
        Insert: {
          created_at?: string | null
          date: string
          dinner_meal?: string | null
          hrv_ms?: number | null
          id?: string
          lunch_meal?: string | null
          notes?: string | null
          recovery_pct?: number | null
          sleep_hours?: number | null
          tasks_completed?: number | null
          total_work_minutes?: number | null
          updated_at?: string | null
          user_id: string
          workout_completed?: boolean | null
          workout_exercises?: Json | null
          workout_type?: string | null
        }
        Update: {
          created_at?: string | null
          date?: string
          dinner_meal?: string | null
          hrv_ms?: number | null
          id?: string
          lunch_meal?: string | null
          notes?: string | null
          recovery_pct?: number | null
          sleep_hours?: number | null
          tasks_completed?: number | null
          total_work_minutes?: number | null
          updated_at?: string | null
          user_id?: string
          workout_completed?: boolean | null
          workout_exercises?: Json | null
          workout_type?: string | null
        }
        Relationships: []
      }
      events: {
        Row: {
          created_at: string | null
          end_at: string
          external_id: string | null
          hard_fixed: boolean | null
          id: string
          source: Database["public"]["Enums"]["event_source"]
          start_at: string
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          end_at: string
          external_id?: string | null
          hard_fixed?: boolean | null
          id?: string
          source: Database["public"]["Enums"]["event_source"]
          start_at: string
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          end_at?: string
          external_id?: string | null
          hard_fixed?: boolean | null
          id?: string
          source?: Database["public"]["Enums"]["event_source"]
          start_at?: string
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      meals: {
        Row: {
          calories: number | null
          carbs_g: number | null
          components: string[] | null
          created_at: string | null
          duration_min: number | null
          fat_g: number | null
          id: string
          kind: Database["public"]["Enums"]["meal_kind"]
          name: string
          protein_g: number | null
          rotation_weight: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          calories?: number | null
          carbs_g?: number | null
          components?: string[] | null
          created_at?: string | null
          duration_min?: number | null
          fat_g?: number | null
          id?: string
          kind: Database["public"]["Enums"]["meal_kind"]
          name: string
          protein_g?: number | null
          rotation_weight?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          calories?: number | null
          carbs_g?: number | null
          components?: string[] | null
          created_at?: string | null
          duration_min?: number | null
          fat_g?: number | null
          id?: string
          kind?: Database["public"]["Enums"]["meal_kind"]
          name?: string
          protein_g?: number | null
          rotation_weight?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      oauth_tokens: {
        Row: {
          access_token: string
          created_at: string
          expires_at: string
          id: string
          provider: string
          refresh_token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          expires_at: string
          id?: string
          provider: string
          refresh_token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          expires_at?: string
          id?: string
          provider?: string
          refresh_token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          bedtime: string | null
          build_mode: boolean | null
          chronotype: string | null
          created_at: string | null
          friday_home_office: boolean | null
          home_city: Database["public"]["Enums"]["location_type"] | null
          id: string
          prebed_start: string | null
          sleep_target_min: number | null
          updated_at: string | null
          work_arrival: string | null
          work_leave: string | null
        }
        Insert: {
          bedtime?: string | null
          build_mode?: boolean | null
          chronotype?: string | null
          created_at?: string | null
          friday_home_office?: boolean | null
          home_city?: Database["public"]["Enums"]["location_type"] | null
          id: string
          prebed_start?: string | null
          sleep_target_min?: number | null
          updated_at?: string | null
          work_arrival?: string | null
          work_leave?: string | null
        }
        Update: {
          bedtime?: string | null
          build_mode?: boolean | null
          chronotype?: string | null
          created_at?: string | null
          friday_home_office?: boolean | null
          home_city?: Database["public"]["Enums"]["location_type"] | null
          id?: string
          prebed_start?: string | null
          sleep_target_min?: number | null
          updated_at?: string | null
          work_arrival?: string | null
          work_leave?: string | null
        }
        Relationships: []
      }
      rituals: {
        Row: {
          consistency_weight: number | null
          created_at: string | null
          days_of_week: string[] | null
          duration_min: number
          flex_min: number | null
          hard_fixed: boolean | null
          id: string
          location: Database["public"]["Enums"]["location_type"] | null
          name: string
          post_buffer_min: number | null
          pre_buffer_min: number | null
          preferred_end: string | null
          preferred_start: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          consistency_weight?: number | null
          created_at?: string | null
          days_of_week?: string[] | null
          duration_min: number
          flex_min?: number | null
          hard_fixed?: boolean | null
          id?: string
          location?: Database["public"]["Enums"]["location_type"] | null
          name: string
          post_buffer_min?: number | null
          pre_buffer_min?: number | null
          preferred_end?: string | null
          preferred_start?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          consistency_weight?: number | null
          created_at?: string | null
          days_of_week?: string[] | null
          duration_min?: number
          flex_min?: number | null
          hard_fixed?: boolean | null
          id?: string
          location?: Database["public"]["Enums"]["location_type"] | null
          name?: string
          post_buffer_min?: number | null
          pre_buffer_min?: number | null
          preferred_end?: string | null
          preferred_start?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      supplements: {
        Row: {
          created_at: string | null
          dose: string | null
          id: string
          name: string
          notes: string | null
          timing_rule: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          dose?: string | null
          id?: string
          name: string
          notes?: string | null
          timing_rule: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          dose?: string | null
          id?: string
          name?: string
          notes?: string | null
          timing_rule?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          actual_min: number | null
          biz_or_personal: Database["public"]["Enums"]["biz_type"] | null
          confidence: number | null
          created_at: string | null
          dependencies: string[] | null
          description: string | null
          due_at: string | null
          earliest_start: string | null
          energy_need: number | null
          est_min: number | null
          hard_window_end: string | null
          hard_window_start: string | null
          id: string
          impact: number | null
          location: Database["public"]["Enums"]["location_type"] | null
          min_block_min: number | null
          priority: number | null
          project: string | null
          recurrence: string | null
          status: Database["public"]["Enums"]["task_status"] | null
          tags: string[] | null
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          actual_min?: number | null
          biz_or_personal?: Database["public"]["Enums"]["biz_type"] | null
          confidence?: number | null
          created_at?: string | null
          dependencies?: string[] | null
          description?: string | null
          due_at?: string | null
          earliest_start?: string | null
          energy_need?: number | null
          est_min?: number | null
          hard_window_end?: string | null
          hard_window_start?: string | null
          id?: string
          impact?: number | null
          location?: Database["public"]["Enums"]["location_type"] | null
          min_block_min?: number | null
          priority?: number | null
          project?: string | null
          recurrence?: string | null
          status?: Database["public"]["Enums"]["task_status"] | null
          tags?: string[] | null
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          actual_min?: number | null
          biz_or_personal?: Database["public"]["Enums"]["biz_type"] | null
          confidence?: number | null
          created_at?: string | null
          dependencies?: string[] | null
          description?: string | null
          due_at?: string | null
          earliest_start?: string | null
          energy_need?: number | null
          est_min?: number | null
          hard_window_end?: string | null
          hard_window_start?: string | null
          id?: string
          impact?: number | null
          location?: Database["public"]["Enums"]["location_type"] | null
          min_block_min?: number | null
          priority?: number | null
          project?: string | null
          recurrence?: string | null
          status?: Database["public"]["Enums"]["task_status"] | null
          tags?: string[] | null
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      velocity_by_tag: {
        Row: {
          avg_min_per_point: number | null
          created_at: string | null
          id: string
          samples: number | null
          tag: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          avg_min_per_point?: number | null
          created_at?: string | null
          id?: string
          samples?: number | null
          tag: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          avg_min_per_point?: number | null
          created_at?: string | null
          id?: string
          samples?: number | null
          tag?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      whoop_daily: {
        Row: {
          created_at: string | null
          date: string
          hrv_ms: number | null
          id: string
          recovery_pct: number | null
          rhr_bpm: number | null
          sleep_end: string | null
          sleep_perf_pct: number | null
          sleep_start: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          date: string
          hrv_ms?: number | null
          id?: string
          recovery_pct?: number | null
          rhr_bpm?: number | null
          sleep_end?: string | null
          sleep_perf_pct?: number | null
          sleep_start?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          date?: string
          hrv_ms?: number | null
          id?: string
          recovery_pct?: number | null
          rhr_bpm?: number | null
          sleep_end?: string | null
          sleep_perf_pct?: number | null
          sleep_start?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      biz_type: "biz" | "personal"
      block_status: "planned" | "active" | "done" | "moved" | "canceled"
      block_type:
        | "task"
        | "ritual"
        | "event"
        | "meal"
        | "sleep"
        | "buffer"
        | "commute"
      event_source: "outlook" | "sports"
      location_type: "BA" | "SNV" | "ANY"
      meal_kind: "breakfast" | "lunch" | "dinner" | "snack"
      task_status: "todo" | "doing" | "done"
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
      biz_type: ["biz", "personal"],
      block_status: ["planned", "active", "done", "moved", "canceled"],
      block_type: [
        "task",
        "ritual",
        "event",
        "meal",
        "sleep",
        "buffer",
        "commute",
      ],
      event_source: ["outlook", "sports"],
      location_type: ["BA", "SNV", "ANY"],
      meal_kind: ["breakfast", "lunch", "dinner", "snack"],
      task_status: ["todo", "doing", "done"],
    },
  },
} as const
