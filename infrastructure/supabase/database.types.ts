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
      cell_ownership: {
        Row: {
          cell_id: string
          owned_since_workout_id: string
          owner_user_id: string
          updated_at: string
        }
        Insert: {
          cell_id: string
          owned_since_workout_id: string
          owner_user_id: string
          updated_at?: string
        }
        Update: {
          cell_id?: string
          owned_since_workout_id?: string
          owner_user_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cell_ownership_owned_since_workout_id_fkey"
            columns: ["owned_since_workout_id"]
            isOneToOne: false
            referencedRelation: "workouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cell_ownership_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          total_distance_m: number
          total_xp: number
          updated_at: string
          username: string
        }
        Insert: {
          created_at?: string
          id: string
          total_distance_m?: number
          total_xp?: number
          updated_at?: string
          username: string
        }
        Update: {
          created_at?: string
          id?: string
          total_distance_m?: number
          total_xp?: number
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      quest_contributions: {
        Row: {
          created_at: string
          user_id: string
          user_quest_id: string
          value_added: number
          workout_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
          user_quest_id: string
          value_added: number
          workout_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
          user_quest_id?: string
          value_added?: number
          workout_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quest_contributions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quest_contributions_user_quest_id_fkey"
            columns: ["user_quest_id"]
            isOneToOne: false
            referencedRelation: "user_quests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quest_contributions_workout_id_fkey"
            columns: ["workout_id"]
            isOneToOne: false
            referencedRelation: "workouts"
            referencedColumns: ["id"]
          },
        ]
      }
      quest_progress: {
        Row: {
          current_value: number
          updated_at: string
          user_id: string
          user_quest_id: string
        }
        Insert: {
          current_value?: number
          updated_at?: string
          user_id: string
          user_quest_id: string
        }
        Update: {
          current_value?: number
          updated_at?: string
          user_id?: string
          user_quest_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quest_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quest_progress_user_quest_id_fkey"
            columns: ["user_quest_id"]
            isOneToOne: true
            referencedRelation: "user_quests"
            referencedColumns: ["id"]
          },
        ]
      }
      quests: {
        Row: {
          created_at: string
          description: string
          duration_type: string
          id: string
          is_active: boolean
          reward_badge_icon: string | null
          reward_badge_label: string | null
          reward_xp: number
          slug: string
          target_value: number
          title: string
          type: string
          window_end_hour: number | null
        }
        Insert: {
          created_at?: string
          description: string
          duration_type: string
          id?: string
          is_active?: boolean
          reward_badge_icon?: string | null
          reward_badge_label?: string | null
          reward_xp?: number
          slug: string
          target_value: number
          title: string
          type: string
          window_end_hour?: number | null
        }
        Update: {
          created_at?: string
          description?: string
          duration_type?: string
          id?: string
          is_active?: boolean
          reward_badge_icon?: string | null
          reward_badge_label?: string | null
          reward_xp?: number
          slug?: string
          target_value?: number
          title?: string
          type?: string
          window_end_hour?: number | null
        }
        Relationships: []
      }
      route_points: {
        Row: {
          accuracy_m: number
          altitude_m: number | null
          batch_seq: number
          heading_deg: number | null
          id: number
          lat: number
          lng: number
          point_seq: number
          received_at: string
          recorded_at: string
          speed_mps: number | null
          workout_id: string
        }
        Insert: {
          accuracy_m: number
          altitude_m?: number | null
          batch_seq: number
          heading_deg?: number | null
          id?: never
          lat: number
          lng: number
          point_seq: number
          received_at?: string
          recorded_at: string
          speed_mps?: number | null
          workout_id: string
        }
        Update: {
          accuracy_m?: number
          altitude_m?: number | null
          batch_seq?: number
          heading_deg?: number | null
          id?: never
          lat?: number
          lng?: number
          point_seq?: number
          received_at?: string
          recorded_at?: string
          speed_mps?: number | null
          workout_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "route_points_workout_id_fkey"
            columns: ["workout_id"]
            isOneToOne: false
            referencedRelation: "workouts"
            referencedColumns: ["id"]
          },
        ]
      }
      territory_captures: {
        Row: {
          action: string
          captured_at: string
          cell_id: string
          id: string
          user_id: string
          workout_id: string
        }
        Insert: {
          action: string
          captured_at?: string
          cell_id: string
          id?: string
          user_id: string
          workout_id: string
        }
        Update: {
          action?: string
          captured_at?: string
          cell_id?: string
          id?: string
          user_id?: string
          workout_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "territory_captures_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "territory_captures_workout_id_fkey"
            columns: ["workout_id"]
            isOneToOne: false
            referencedRelation: "workouts"
            referencedColumns: ["id"]
          },
        ]
      }
      user_quests: {
        Row: {
          assigned_at: string
          completed_at: string | null
          expires_at: string
          id: string
          period_start: string
          quest_id: string
          status: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          completed_at?: string | null
          expires_at: string
          id?: string
          period_start: string
          quest_id: string
          status?: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          completed_at?: string | null
          expires_at?: string
          id?: string
          period_start?: string
          quest_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_quests_quest_id_fkey"
            columns: ["quest_id"]
            isOneToOne: false
            referencedRelation: "quests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_quests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_xp: {
        Row: {
          level: number
          total_xp: number
          updated_at: string
          user_id: string
        }
        Insert: {
          level?: number
          total_xp?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          level?: number
          total_xp?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_xp_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      workouts: {
        Row: {
          avg_pace_s_per_km: number | null
          created_at: string
          distance_m: number | null
          duration_s: number | null
          elevation_gain_m: number | null
          ended_at: string | null
          id: string
          path: unknown
          source: string
          started_at: string
          status: string
          updated_at: string
          user_id: string
          xp_awarded: number | null
        }
        Insert: {
          avg_pace_s_per_km?: number | null
          created_at?: string
          distance_m?: number | null
          duration_s?: number | null
          elevation_gain_m?: number | null
          ended_at?: string | null
          id?: string
          path?: unknown
          source?: string
          started_at?: string
          status?: string
          updated_at?: string
          user_id: string
          xp_awarded?: number | null
        }
        Update: {
          avg_pace_s_per_km?: number | null
          created_at?: string
          distance_m?: number | null
          duration_s?: number | null
          elevation_gain_m?: number | null
          ended_at?: string | null
          id?: string
          path?: unknown
          source?: string
          started_at?: string
          status?: string
          updated_at?: string
          user_id?: string
          xp_awarded?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "workouts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      xp_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          user_id: string
          workout_id: string | null
          xp_awarded: number
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          user_id: string
          workout_id?: string | null
          xp_awarded: number
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          user_id?: string
          workout_id?: string | null
          xp_awarded?: number
        }
        Relationships: [
          {
            foreignKeyName: "xp_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "xp_events_workout_id_fkey"
            columns: ["workout_id"]
            isOneToOne: false
            referencedRelation: "workouts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_quest_progress: {
        Args: { p_updates: Json; p_user_id: string; p_workout_id: string }
        Returns: {
          quest_id: string
          reward_xp: number
          user_quest_id: string
        }[]
      }
      ensure_active_quests: {
        Args: { p_user_id: string }
        Returns: {
          current_value: number
          description: string
          duration_type: string
          expires_at: string
          quest_id: string
          reward_badge_icon: string
          reward_badge_label: string
          reward_xp: number
          slug: string
          status: string
          target_value: number
          title: string
          type: string
          user_quest_id: string
          window_end_hour: number
        }[]
      }
      finalize_workout: {
        Args: { p_cell_ids: string[]; p_user_id: string; p_workout_id: string }
        Returns: Database["public"]["CompositeTypes"]["finalize_workout_result"]
        SetofOptions: {
          from: "*"
          to: "finalize_workout_result"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_leaderboard: {
        Args: { p_category: string; p_limit?: number; p_offset?: number }
        Returns: {
          rank: number
          user_id: string
          username: string
          value: number
        }[]
      }
      get_my_rank: {
        Args: { p_category: string }
        Returns: {
          next_rank_value: number
          percentile: number
          rank: number
          total_users: number
          value: number
        }[]
      }
      get_public_profile: { Args: { p_username: string }; Returns: Json }
      get_workout_route_anchors: {
        Args: never
        Returns: {
          end_lat: number
          end_lng: number
          start_lat: number
          start_lng: number
          workout_id: string
        }[]
      }
      xp_level: { Args: { p_xp: number }; Returns: number }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      finalize_workout_result: {
        workout_id: string | null
        status: string | null
        distance_m: number | null
        duration_s: number | null
        avg_pace_s_per_km: number | null
        xp_awarded: number | null
        cells_claimed: number | null
        cells_stolen: number | null
        cells_defended: number | null
      }
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
    Enums: {},
  },
} as const
