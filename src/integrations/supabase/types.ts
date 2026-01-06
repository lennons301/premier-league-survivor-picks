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
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      cup_fixtures: {
        Row: {
          away_goals: number | null
          away_team: string
          created_at: string
          fixture_order: number
          game_id: string
          home_goals: number | null
          home_team: string
          id: string
          tier_difference: number
          updated_at: string
        }
        Insert: {
          away_goals?: number | null
          away_team: string
          created_at?: string
          fixture_order: number
          game_id: string
          home_goals?: number | null
          home_team: string
          id?: string
          tier_difference?: number
          updated_at?: string
        }
        Update: {
          away_goals?: number | null
          away_team?: string
          created_at?: string
          fixture_order?: number
          game_id?: string
          home_goals?: number | null
          home_team?: string
          id?: string
          tier_difference?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cup_fixtures_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      cup_picks: {
        Row: {
          created_at: string
          fixture_id: string
          game_id: string
          goals_counted: number | null
          id: string
          life_gained: number | null
          life_spent: boolean | null
          picked_team: string
          preference_order: number
          result: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          fixture_id: string
          game_id: string
          goals_counted?: number | null
          id?: string
          life_gained?: number | null
          life_spent?: boolean | null
          picked_team: string
          preference_order: number
          result?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          fixture_id?: string
          game_id?: string
          goals_counted?: number | null
          id?: string
          life_gained?: number | null
          life_spent?: boolean | null
          picked_team?: string
          preference_order?: number
          result?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cup_picks_fixture_id_fkey"
            columns: ["fixture_id"]
            isOneToOne: false
            referencedRelation: "cup_fixtures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cup_picks_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      fixtures: {
        Row: {
          away_score: number | null
          away_team_id: string
          code: number | null
          created_at: string
          event: number | null
          finished: boolean | null
          finished_provisional: boolean | null
          fpl_fixture_id: number | null
          gameweek: number
          home_score: number | null
          home_team_id: string
          id: string
          is_completed: boolean | null
          kickoff_time: string | null
          minutes: number | null
          provisional_start_time: boolean | null
          pulse_id: number | null
          started: boolean | null
          stats: Json | null
          team_a: number | null
          team_a_difficulty: number | null
          team_a_score: number | null
          team_h: number | null
          team_h_difficulty: number | null
          team_h_score: number | null
        }
        Insert: {
          away_score?: number | null
          away_team_id: string
          code?: number | null
          created_at?: string
          event?: number | null
          finished?: boolean | null
          finished_provisional?: boolean | null
          fpl_fixture_id?: number | null
          gameweek: number
          home_score?: number | null
          home_team_id: string
          id?: string
          is_completed?: boolean | null
          kickoff_time?: string | null
          minutes?: number | null
          provisional_start_time?: boolean | null
          pulse_id?: number | null
          started?: boolean | null
          stats?: Json | null
          team_a?: number | null
          team_a_difficulty?: number | null
          team_a_score?: number | null
          team_h?: number | null
          team_h_difficulty?: number | null
          team_h_score?: number | null
        }
        Update: {
          away_score?: number | null
          away_team_id?: string
          code?: number | null
          created_at?: string
          event?: number | null
          finished?: boolean | null
          finished_provisional?: boolean | null
          fpl_fixture_id?: number | null
          gameweek?: number
          home_score?: number | null
          home_team_id?: string
          id?: string
          is_completed?: boolean | null
          kickoff_time?: string | null
          minutes?: number | null
          provisional_start_time?: boolean | null
          pulse_id?: number | null
          started?: boolean | null
          stats?: Json | null
          team_a?: number | null
          team_a_difficulty?: number | null
          team_a_score?: number | null
          team_h?: number | null
          team_h_difficulty?: number | null
          team_h_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fixtures_away_team_id_fkey"
            columns: ["away_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixtures_home_team_id_fkey"
            columns: ["home_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      game_gameweeks: {
        Row: {
          created_at: string
          game_id: string
          gameweek_id: string
          gameweek_number: number
          id: string
          picks_visible: boolean
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          game_id: string
          gameweek_id: string
          gameweek_number: number
          id?: string
          picks_visible?: boolean
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          game_id?: string
          gameweek_id?: string
          gameweek_number?: number
          id?: string
          picks_visible?: boolean
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      game_players: {
        Row: {
          eliminated_gameweek: number | null
          game_id: string
          id: string
          is_eliminated: boolean | null
          joined_at: string
          lives: number | null
          user_id: string
        }
        Insert: {
          eliminated_gameweek?: number | null
          game_id: string
          id?: string
          is_eliminated?: boolean | null
          joined_at?: string
          lives?: number | null
          user_id: string
        }
        Update: {
          eliminated_gameweek?: number | null
          game_id?: string
          id?: string
          is_eliminated?: boolean | null
          joined_at?: string
          lives?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_players_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      game_winners: {
        Row: {
          created_at: string | null
          game_id: string
          id: string
          is_split: boolean | null
          payout_amount: number
          user_id: string
        }
        Insert: {
          created_at?: string | null
          game_id: string
          id?: string
          is_split?: boolean | null
          payout_amount: number
          user_id: string
        }
        Update: {
          created_at?: string | null
          game_id?: string
          id?: string
          is_split?: boolean | null
          payout_amount?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_winners_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      games: {
        Row: {
          admin_fee: number | null
          allow_rebuys: boolean
          created_at: string
          created_by: string
          current_deadline: string | null
          current_gameweek: number | null
          entry_fee: number
          game_mode: string
          id: string
          max_players: number | null
          name: string
          starting_gameweek: number | null
          status: string
          updated_at: string
          winner_id: string | null
        }
        Insert: {
          admin_fee?: number | null
          allow_rebuys?: boolean
          created_at?: string
          created_by: string
          current_deadline?: string | null
          current_gameweek?: number | null
          entry_fee?: number
          game_mode?: string
          id?: string
          max_players?: number | null
          name: string
          starting_gameweek?: number | null
          status?: string
          updated_at?: string
          winner_id?: string | null
        }
        Update: {
          admin_fee?: number | null
          allow_rebuys?: boolean
          created_at?: string
          created_by?: string
          current_deadline?: string | null
          current_gameweek?: number | null
          entry_fee?: number
          game_mode?: string
          id?: string
          max_players?: number | null
          name?: string
          starting_gameweek?: number | null
          status?: string
          updated_at?: string
          winner_id?: string | null
        }
        Relationships: []
      }
      gameweek_deadlines: {
        Row: {
          created_at: string
          deadline: string
          game_id: string
          gameweek: number
          id: string
        }
        Insert: {
          created_at?: string
          deadline: string
          game_id: string
          gameweek: number
          id?: string
        }
        Update: {
          created_at?: string
          deadline?: string
          game_id?: string
          gameweek?: number
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gameweek_deadlines_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      gameweeks: {
        Row: {
          average_entry_score: number | null
          created_at: string
          data_checked: boolean | null
          deadline: string
          finished: boolean | null
          fpl_event_id: number | null
          gameweek_number: number
          highest_score: number | null
          highest_scoring_entry: number | null
          id: string
          is_active: boolean | null
          is_current: boolean | null
          is_next: boolean | null
          is_previous: boolean | null
          name: string | null
        }
        Insert: {
          average_entry_score?: number | null
          created_at?: string
          data_checked?: boolean | null
          deadline: string
          finished?: boolean | null
          fpl_event_id?: number | null
          gameweek_number: number
          highest_score?: number | null
          highest_scoring_entry?: number | null
          id?: string
          is_active?: boolean | null
          is_current?: boolean | null
          is_next?: boolean | null
          is_previous?: boolean | null
          name?: string | null
        }
        Update: {
          average_entry_score?: number | null
          created_at?: string
          data_checked?: boolean | null
          deadline?: string
          finished?: boolean | null
          fpl_event_id?: number | null
          gameweek_number?: number
          highest_score?: number | null
          highest_scoring_entry?: number | null
          id?: string
          is_active?: boolean | null
          is_current?: boolean | null
          is_next?: boolean | null
          is_previous?: boolean | null
          name?: string | null
        }
        Relationships: []
      }
      picks: {
        Row: {
          created_at: string
          fixture_id: string | null
          game_id: string
          gameweek: number
          goals_scored: number | null
          id: string
          is_captain: boolean | null
          is_vice_captain: boolean | null
          multiplier: number | null
          picked_side: string | null
          predicted_result: string | null
          preference_order: number | null
          result: string | null
          team_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          fixture_id?: string | null
          game_id: string
          gameweek: number
          goals_scored?: number | null
          id?: string
          is_captain?: boolean | null
          is_vice_captain?: boolean | null
          multiplier?: number | null
          picked_side?: string | null
          predicted_result?: string | null
          preference_order?: number | null
          result?: string | null
          team_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          fixture_id?: string | null
          game_id?: string
          gameweek?: number
          goals_scored?: number | null
          id?: string
          is_captain?: boolean | null
          is_vice_captain?: boolean | null
          multiplier?: number | null
          picked_side?: string | null
          predicted_result?: string | null
          preference_order?: number | null
          result?: string | null
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "picks_fixture_id_fkey"
            columns: ["fixture_id"]
            isOneToOne: false
            referencedRelation: "fixtures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "picks_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "picks_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      teams: {
        Row: {
          code: number | null
          created_at: string
          fpl_team_id: number | null
          id: string
          name: string
          pulse_id: number | null
          short_name: string
          strength_attack_away: number | null
          strength_attack_home: number | null
          strength_defence_away: number | null
          strength_defence_home: number | null
          strength_overall_away: number | null
          strength_overall_home: number | null
        }
        Insert: {
          code?: number | null
          created_at?: string
          fpl_team_id?: number | null
          id?: string
          name: string
          pulse_id?: number | null
          short_name: string
          strength_attack_away?: number | null
          strength_attack_home?: number | null
          strength_defence_away?: number | null
          strength_defence_home?: number | null
          strength_overall_away?: number | null
          strength_overall_home?: number | null
        }
        Update: {
          code?: number | null
          created_at?: string
          fpl_team_id?: number | null
          id?: string
          name?: string
          pulse_id?: number | null
          short_name?: string
          strength_attack_away?: number | null
          strength_attack_home?: number | null
          strength_defence_away?: number | null
          strength_defence_home?: number | null
          strength_overall_away?: number | null
          strength_overall_home?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      activate_gameweeks_past_deadline: { Args: never; Returns: undefined }
      admin_insert_pick: {
        Args: {
          p_fixture_id: string
          p_game_id: string
          p_gameweek: number
          p_picked_side: string
          p_team_id: string
          p_user_id: string
        }
        Returns: string
      }
      calculate_prize_pot: { Args: { p_game_id: string }; Returns: number }
      check_all_picks_made: {
        Args: { p_game_id: string; p_gameweek_number: number }
        Returns: boolean
      }
      check_and_finish_games_after_results: {
        Args: { p_gameweek_number: number }
        Returns: undefined
      }
      check_and_finish_turbo_games: {
        Args: { p_gameweek_number: number }
        Returns: undefined
      }
      eliminate_non_winners_after_first_gameweek: {
        Args: never
        Returns: undefined
      }
      eliminate_players_who_failed_to_rebuy: {
        Args: { p_gameweek_number: number }
        Returns: undefined
      }
      end_game_as_split: {
        Args: { p_admin_fee: number; p_game_id: string }
        Returns: undefined
      }
      get_game_winner: { Args: { p_game_id: string }; Returns: string }
      get_users_without_picks: {
        Args: { p_game_id: string; p_gameweek: number }
        Returns: {
          display_name: string
          user_id: string
        }[]
      }
      is_game_admin: { Args: { game_id: string }; Returns: boolean }
      manually_activate_gameweek: {
        Args: { p_game_id: string; p_gameweek_number: number }
        Returns: undefined
      }
      process_cup_results: { Args: { p_game_id: string }; Returns: undefined }
      sync_fixture_with_fpl: {
        Args: {
          p_code: number
          p_event: number
          p_finished: boolean
          p_finished_provisional: boolean
          p_fpl_fixture_id: number
          p_kickoff_time: string
          p_minutes: number
          p_provisional_start_time: boolean
          p_pulse_id: number
          p_started: boolean
          p_stats?: Json
          p_team_a: number
          p_team_a_difficulty: number
          p_team_a_score: number
          p_team_h: number
          p_team_h_difficulty: number
          p_team_h_score: number
        }
        Returns: string
      }
      sync_gameweek_with_fpl: {
        Args: {
          p_average_entry_score?: number
          p_data_checked?: boolean
          p_deadline_time: string
          p_finished?: boolean
          p_fpl_event_id: number
          p_highest_score?: number
          p_highest_scoring_entry?: number
          p_is_current?: boolean
          p_is_next?: boolean
          p_is_previous?: boolean
          p_name: string
        }
        Returns: string
      }
      sync_team_with_fpl: {
        Args: {
          p_code?: number
          p_fpl_team_id: number
          p_name: string
          p_pulse_id?: number
          p_short_name: string
          p_strength_attack_away?: number
          p_strength_attack_home?: number
          p_strength_defence_away?: number
          p_strength_defence_home?: number
          p_strength_overall_away?: number
          p_strength_overall_home?: number
        }
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
