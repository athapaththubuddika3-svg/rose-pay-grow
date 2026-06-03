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
      ad_task_completions: {
        Row: {
          completed_at: string
          id: string
          reward: number
          user_id: string
        }
        Insert: {
          completed_at?: string
          id?: string
          reward: number
          user_id: string
        }
        Update: {
          completed_at?: string
          id?: string
          reward?: number
          user_id?: string
        }
        Relationships: []
      }
      ad_watches: {
        Row: {
          block_id: string
          duration_sec: number
          id: string
          kind: string
          reward: number
          user_id: string
          watched_at: string
        }
        Insert: {
          block_id: string
          duration_sec?: number
          id?: string
          kind: string
          reward?: number
          user_id: string
          watched_at?: string
        }
        Update: {
          block_id?: string
          duration_sec?: number
          id?: string
          kind?: string
          reward?: number
          user_id?: string
          watched_at?: string
        }
        Relationships: []
      }
      admin_sessions: {
        Row: {
          admin_id: string
          created_at: string
          expires_at: string
          token: string
        }
        Insert: {
          admin_id: string
          created_at?: string
          expires_at: string
          token: string
        }
        Update: {
          admin_id?: string
          created_at?: string
          expires_at?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_sessions_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "admins"
            referencedColumns: ["id"]
          },
        ]
      }
      admins: {
        Row: {
          created_at: string
          email: string
          id: string
          password_hash: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          password_hash: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          password_hash?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      app_users: {
        Row: {
          balance: number
          created_at: string
          daily_ad_tasks_count: number
          daily_ad_tasks_reset_at: string
          daily_ads_count: number
          daily_ads_reset_at: string
          expected_balance: number
          first_name: string | null
          id: string
          ip_address: string | null
          last_ad_task_claim_at: string | null
          last_daily_bonus_at: string | null
          last_name: string | null
          notif_enabled: boolean
          photo_url: string | null
          ref_by: string | null
          ref_code: string
          session_ads_count: number
          session_ads_started_at: string | null
          suspend_reason: string | null
          suspended: boolean
          telegram_id: number
          total_ads: number
          total_earned: number
          total_ref_commission: number
          total_ref_count: number
          total_tasks: number
          total_withdraw: number
          updated_at: string
          username: string | null
          wallet_address: string | null
          withdraw_ads_done: number
        }
        Insert: {
          balance?: number
          created_at?: string
          daily_ad_tasks_count?: number
          daily_ad_tasks_reset_at?: string
          daily_ads_count?: number
          daily_ads_reset_at?: string
          expected_balance?: number
          first_name?: string | null
          id?: string
          ip_address?: string | null
          last_ad_task_claim_at?: string | null
          last_daily_bonus_at?: string | null
          last_name?: string | null
          notif_enabled?: boolean
          photo_url?: string | null
          ref_by?: string | null
          ref_code: string
          session_ads_count?: number
          session_ads_started_at?: string | null
          suspend_reason?: string | null
          suspended?: boolean
          telegram_id: number
          total_ads?: number
          total_earned?: number
          total_ref_commission?: number
          total_ref_count?: number
          total_tasks?: number
          total_withdraw?: number
          updated_at?: string
          username?: string | null
          wallet_address?: string | null
          withdraw_ads_done?: number
        }
        Update: {
          balance?: number
          created_at?: string
          daily_ad_tasks_count?: number
          daily_ad_tasks_reset_at?: string
          daily_ads_count?: number
          daily_ads_reset_at?: string
          expected_balance?: number
          first_name?: string | null
          id?: string
          ip_address?: string | null
          last_ad_task_claim_at?: string | null
          last_daily_bonus_at?: string | null
          last_name?: string | null
          notif_enabled?: boolean
          photo_url?: string | null
          ref_by?: string | null
          ref_code?: string
          session_ads_count?: number
          session_ads_started_at?: string | null
          suspend_reason?: string | null
          suspended?: boolean
          telegram_id?: number
          total_ads?: number
          total_earned?: number
          total_ref_commission?: number
          total_ref_count?: number
          total_tasks?: number
          total_withdraw?: number
          updated_at?: string
          username?: string | null
          wallet_address?: string | null
          withdraw_ads_done?: number
        }
        Relationships: [
          {
            foreignKeyName: "app_users_ref_by_fkey"
            columns: ["ref_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          created_at: string
          id: string
          meta: Json | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          meta?: Json | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          meta?: Json | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      balance_audits: {
        Row: {
          actual: number
          detected_at: string
          diff: number
          expected: number
          id: string
          user_id: string
        }
        Insert: {
          actual: number
          detected_at?: string
          diff: number
          expected: number
          id?: string
          user_id: string
        }
        Update: {
          actual?: number
          detected_at?: string
          diff?: number
          expected?: number
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      broadcasts: {
        Row: {
          created_at: string
          failed_count: number
          id: string
          message: string
          sent_count: number
          to_channel: boolean
        }
        Insert: {
          created_at?: string
          failed_count?: number
          id?: string
          message: string
          sent_count?: number
          to_channel?: boolean
        }
        Update: {
          created_at?: string
          failed_count?: number
          id?: string
          message?: string
          sent_count?: number
          to_channel?: boolean
        }
        Relationships: []
      }
      commission_bonus_claims: {
        Row: {
          amount: number
          claimed_at: string
          id: string
          pct: number
          user_id: string
        }
        Insert: {
          amount: number
          claimed_at?: string
          id?: string
          pct: number
          user_id: string
        }
        Update: {
          amount?: number
          claimed_at?: string
          id?: string
          pct?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "commission_bonus_claims_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_bonus_claims: {
        Row: {
          amount: number
          claimed_at: string
          id: string
          user_id: string
        }
        Insert: {
          amount: number
          claimed_at?: string
          id?: string
          user_id: string
        }
        Update: {
          amount?: number
          claimed_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      referrals: {
        Row: {
          bonus_amount: number
          claimed_at: string | null
          created_at: string
          id: string
          referred_id: string
          referrer_id: string
          status: string
        }
        Insert: {
          bonus_amount?: number
          claimed_at?: string | null
          created_at?: string
          id?: string
          referred_id: string
          referrer_id: string
          status?: string
        }
        Update: {
          bonus_amount?: number
          claimed_at?: string | null
          created_at?: string
          id?: string
          referred_id?: string
          referrer_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "referrals_referred_id_fkey"
            columns: ["referred_id"]
            isOneToOne: true
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      reward_code_claims: {
        Row: {
          amount: number
          code_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          amount: number
          code_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          amount?: number
          code_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reward_code_claims_code_id_fkey"
            columns: ["code_id"]
            isOneToOne: false
            referencedRelation: "reward_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reward_code_claims_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      reward_codes: {
        Row: {
          active: boolean
          amount: number
          code: string
          created_at: string
          id: string
          max_uses: number
          used_count: number
        }
        Insert: {
          active?: boolean
          amount: number
          code: string
          created_at?: string
          id?: string
          max_uses?: number
          used_count?: number
        }
        Update: {
          active?: boolean
          amount?: number
          code?: string
          created_at?: string
          id?: string
          max_uses?: number
          used_count?: number
        }
        Relationships: []
      }
      task_completions: {
        Row: {
          created_at: string
          id: string
          reject_reason: string | null
          reviewed_at: string | null
          screenshot_url: string | null
          status: string
          task_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          reject_reason?: string | null
          reviewed_at?: string | null
          screenshot_url?: string | null
          status?: string
          task_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          reject_reason?: string | null
          reviewed_at?: string | null
          screenshot_url?: string | null
          status?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_completions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_completions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          active: boolean
          amount: number
          channel_url: string | null
          channel_username: string | null
          created_at: string
          description: string | null
          id: string
          sort_order: number
          title: string
          type: string
        }
        Insert: {
          active?: boolean
          amount?: number
          channel_url?: string | null
          channel_username?: string | null
          created_at?: string
          description?: string | null
          id?: string
          sort_order?: number
          title: string
          type: string
        }
        Update: {
          active?: boolean
          amount?: number
          channel_url?: string | null
          channel_username?: string | null
          created_at?: string
          description?: string | null
          id?: string
          sort_order?: number
          title?: string
          type?: string
        }
        Relationships: []
      }
      withdrawals: {
        Row: {
          amount: number
          created_at: string
          id: string
          reject_reason: string | null
          reviewed_at: string | null
          status: string
          tx_id: string | null
          user_id: string
          wallet_address: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          reject_reason?: string | null
          reviewed_at?: string | null
          status?: string
          tx_id?: string | null
          user_id: string
          wallet_address: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          reject_reason?: string | null
          reviewed_at?: string | null
          status?: string
          tx_id?: string | null
          user_id?: string
          wallet_address?: string
        }
        Relationships: [
          {
            foreignKeyName: "withdrawals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
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
