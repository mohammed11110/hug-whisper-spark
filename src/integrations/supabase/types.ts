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
      building_members: {
        Row: {
          building_id: string
          created_at: string
          id: string
          invited_by: string | null
          role: Database["public"]["Enums"]["member_role"]
          user_id: string
        }
        Insert: {
          building_id: string
          created_at?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["member_role"]
          user_id: string
        }
        Update: {
          building_id?: string
          created_at?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["member_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "building_members_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
        ]
      }
      buildings: {
        Row: {
          address: string | null
          city: string | null
          created_at: string
          floors: number
          id: string
          name: string
          name_en: string | null
          type: string
          user_id: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string
          floors?: number
          id?: string
          name: string
          name_en?: string | null
          type?: string
          user_id: string
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string
          floors?: number
          id?: string
          name?: string
          name_en?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          building_id: string
          category: string
          created_at: string
          description: string | null
          expense_date: string
          id: string
          unit_id: string | null
          vendor: string | null
        }
        Insert: {
          amount?: number
          building_id: string
          category?: string
          created_at?: string
          description?: string | null
          expense_date?: string
          id?: string
          unit_id?: string | null
          vendor?: string | null
        }
        Update: {
          amount?: number
          building_id?: string
          category?: string
          created_at?: string
          description?: string | null
          expense_date?: string
          id?: string
          unit_id?: string | null
          vendor?: string | null
        }
        Relationships: []
      }
      invitations: {
        Row: {
          accepted_at: string | null
          building_id: string
          created_at: string
          email: string
          id: string
          invited_by: string
          role: Database["public"]["Enums"]["member_role"]
          status: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          building_id: string
          created_at?: string
          email: string
          id?: string
          invited_by: string
          role?: Database["public"]["Enums"]["member_role"]
          status?: string
          token?: string
        }
        Update: {
          accepted_at?: string | null
          building_id?: string
          created_at?: string
          email?: string
          id?: string
          invited_by?: string
          role?: Database["public"]["Enums"]["member_role"]
          status?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          deleted_at: string | null
          expected_amount: number | null
          id: string
          notes: string | null
          payment_date: string
          payment_method: string
          period_end: string | null
          period_start: string | null
          receipt_number: string | null
          unit_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          deleted_at?: string | null
          expected_amount?: number | null
          id?: string
          notes?: string | null
          payment_date?: string
          payment_method?: string
          period_end?: string | null
          period_start?: string | null
          receipt_number?: string | null
          unit_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          deleted_at?: string | null
          expected_amount?: number | null
          id?: string
          notes?: string | null
          payment_date?: string
          payment_method?: string
          period_end?: string | null
          period_start?: string | null
          receipt_number?: string | null
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          canceled_at: string | null
          country_code: string | null
          created_at: string
          email: string | null
          id: string
          name: string | null
          phone: string | null
          subscription_expires_at: string | null
          subscription_plan: string
          subscription_status: string
          updated_at: string
        }
        Insert: {
          canceled_at?: string | null
          country_code?: string | null
          created_at?: string
          email?: string | null
          id: string
          name?: string | null
          phone?: string | null
          subscription_expires_at?: string | null
          subscription_plan?: string
          subscription_status?: string
          updated_at?: string
        }
        Update: {
          canceled_at?: string | null
          country_code?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string | null
          phone?: string | null
          subscription_expires_at?: string | null
          subscription_plan?: string
          subscription_status?: string
          updated_at?: string
        }
        Relationships: []
      }
      promo_codes: {
        Row: {
          code: string
          created_at: string
          duration_days: number
          expires_at: string | null
          id: string
          max_uses: number
          plan: string
          redeemed_at: string | null
          redeemed_by: string | null
          used_count: number
        }
        Insert: {
          code: string
          created_at?: string
          duration_days?: number
          expires_at?: string | null
          id?: string
          max_uses?: number
          plan?: string
          redeemed_at?: string | null
          redeemed_by?: string | null
          used_count?: number
        }
        Update: {
          code?: string
          created_at?: string
          duration_days?: number
          expires_at?: string | null
          id?: string
          max_uses?: number
          plan?: string
          redeemed_at?: string | null
          redeemed_by?: string | null
          used_count?: number
        }
        Relationships: []
      }
      units: {
        Row: {
          building_id: string
          contract_end_date: string | null
          contract_file_url: string | null
          contract_start_date: string | null
          contract_type: string
          created_at: string
          deposit_refunded_at: string | null
          deposit_status: string
          due_day: number
          electric_account: string | null
          floor: number
          gas_account: string | null
          handover_photos: Json
          handover_video_url: string | null
          id: string
          internet_account: string | null
          last_paid_date: string | null
          legal_case: Json
          rent_amount: number
          rent_type: string
          security_deposit: number
          status: string
          tenant_email: string | null
          tenant_id_image_url: string | null
          tenant_id_number: string | null
          tenant_id_type: string | null
          tenant_name: string | null
          tenant_phone: string | null
          type: string
          unit_number: string
          utilities: Json
          water_account: string | null
        }
        Insert: {
          building_id: string
          contract_end_date?: string | null
          contract_file_url?: string | null
          contract_start_date?: string | null
          contract_type?: string
          created_at?: string
          deposit_refunded_at?: string | null
          deposit_status?: string
          due_day?: number
          electric_account?: string | null
          floor?: number
          gas_account?: string | null
          handover_photos?: Json
          handover_video_url?: string | null
          id?: string
          internet_account?: string | null
          last_paid_date?: string | null
          legal_case?: Json
          rent_amount?: number
          rent_type?: string
          security_deposit?: number
          status?: string
          tenant_email?: string | null
          tenant_id_image_url?: string | null
          tenant_id_number?: string | null
          tenant_id_type?: string | null
          tenant_name?: string | null
          tenant_phone?: string | null
          type?: string
          unit_number: string
          utilities?: Json
          water_account?: string | null
        }
        Update: {
          building_id?: string
          contract_end_date?: string | null
          contract_file_url?: string | null
          contract_start_date?: string | null
          contract_type?: string
          created_at?: string
          deposit_refunded_at?: string | null
          deposit_status?: string
          due_day?: number
          electric_account?: string | null
          floor?: number
          gas_account?: string | null
          handover_photos?: Json
          handover_video_url?: string | null
          id?: string
          internet_account?: string | null
          last_paid_date?: string | null
          legal_case?: Json
          rent_amount?: number
          rent_type?: string
          security_deposit?: number
          status?: string
          tenant_email?: string | null
          tenant_id_image_url?: string | null
          tenant_id_number?: string | null
          tenant_id_type?: string | null
          tenant_name?: string | null
          tenant_phone?: string | null
          type?: string
          unit_number?: string
          utilities?: Json
          water_account?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "units_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_building_access: {
        Args: {
          _building_id: string
          _min_role?: Database["public"]["Enums"]["member_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_building_owner: {
        Args: { _building_id: string; _user_id: string }
        Returns: boolean
      }
      redeem_promo_code: { Args: { _code: string }; Returns: Json }
    }
    Enums: {
      member_role: "manager" | "accountant" | "viewer"
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
      member_role: ["manager", "accountant", "viewer"],
    },
  },
} as const
