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
      availabilities: {
        Row: {
          end_minute: number
          id: string
          staff_id: string
          start_minute: number
          weekday: number
        }
        Insert: {
          end_minute: number
          id?: string
          staff_id: string
          start_minute: number
          weekday: number
        }
        Update: {
          end_minute?: number
          id?: string
          staff_id?: string
          start_minute?: number
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "availabilities_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          business_id: string
          created_at: string
          customer_email: string
          customer_name: string
          customer_phone: string | null
          end_at: string
          id: string
          service_id: string
          staff_id: string
          start_at: string
          status: string
        }
        Insert: {
          business_id: string
          created_at?: string
          customer_email: string
          customer_name: string
          customer_phone?: string | null
          end_at: string
          id?: string
          service_id: string
          staff_id: string
          start_at: string
          status?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          customer_email?: string
          customer_name?: string
          customer_phone?: string | null
          end_at?: string
          id?: string
          service_id?: string
          staff_id?: string
          start_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      business_owners: {
        Row: {
          business_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_owners_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      businesses: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          banner_url: string | null
          category: string | null
          city: string | null
          country: string | null
          created_at: string
          description: string | null
          id: string
          logo_url: string | null
          name: string
          phone: string | null
          postal_code: string | null
          region: string | null
          timezone: string
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          banner_url?: string | null
          category?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          description?: string | null
          id?: string
          logo_url?: string | null
          name: string
          phone?: string | null
          postal_code?: string | null
          region?: string | null
          timezone?: string
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          banner_url?: string | null
          category?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          description?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          phone?: string | null
          postal_code?: string | null
          region?: string | null
          timezone?: string
        }
        Relationships: []
      }
      customer_profiles: {
        Row: {
          created_at: string
          first_name: string | null
          full_name: string
          id: string
          last_name: string | null
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          first_name?: string | null
          full_name: string
          id?: string
          last_name?: string | null
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          first_name?: string | null
          full_name?: string
          id?: string
          last_name?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      invoices: {
        Row: {
          amount: number
          appointment_at: string
          booking_id: string
          business_id: string
          created_at: string
          currency: string
          customer_email: string
          customer_name: string
          customer_phone: string | null
          expires_at: string
          id: string
          invoice_number: string
          issued_at: string
          service_id: string | null
          service_name: string
          staff_id: string | null
          staff_name: string | null
          status: string
          tax: number
          total: number
        }
        Insert: {
          amount?: number
          appointment_at: string
          booking_id: string
          business_id: string
          created_at?: string
          currency?: string
          customer_email: string
          customer_name: string
          customer_phone?: string | null
          expires_at?: string
          id?: string
          invoice_number: string
          issued_at?: string
          service_id?: string | null
          service_name: string
          staff_id?: string | null
          staff_name?: string | null
          status?: string
          tax?: number
          total?: number
        }
        Update: {
          amount?: number
          appointment_at?: string
          booking_id?: string
          business_id?: string
          created_at?: string
          currency?: string
          customer_email?: string
          customer_name?: string
          customer_phone?: string | null
          expires_at?: string
          id?: string
          invoice_number?: string
          issued_at?: string
          service_id?: string | null
          service_name?: string
          staff_id?: string | null
          staff_name?: string | null
          status?: string
          tax?: number
          total?: number
        }
        Relationships: []
      }
      service_categories: {
        Row: {
          business_id: string
          created_at: string
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "service_categories_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          active: boolean
          available_from: string | null
          business_id: string
          category_id: string | null
          created_at: string
          description: string | null
          duration_min: number
          id: string
          name: string
          price: number
        }
        Insert: {
          active?: boolean
          available_from?: string | null
          business_id: string
          category_id?: string | null
          created_at?: string
          description?: string | null
          duration_min: number
          id?: string
          name: string
          price?: number
        }
        Update: {
          active?: boolean
          available_from?: string | null
          business_id?: string
          category_id?: string | null
          created_at?: string
          description?: string | null
          duration_min?: number
          id?: string
          name?: string
          price?: number
        }
        Relationships: [
          {
            foreignKeyName: "services_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "services_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "service_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      slot_locks: {
        Row: {
          created_at: string
          end_at: string
          expires_at: string
          holder_session_id: string
          id: string
          service_id: string
          staff_id: string
          start_at: string
        }
        Insert: {
          created_at?: string
          end_at: string
          expires_at: string
          holder_session_id: string
          id?: string
          service_id: string
          staff_id: string
          start_at: string
        }
        Update: {
          created_at?: string
          end_at?: string
          expires_at?: string
          holder_session_id?: string
          id?: string
          service_id?: string
          staff_id?: string
          start_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "slot_locks_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "slot_locks_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      staff: {
        Row: {
          business_id: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_services: {
        Row: {
          service_id: string
          staff_id: string
        }
        Insert: {
          service_id: string
          staff_id: string
        }
        Update: {
          service_id?: string
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_services_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      time_blocks: {
        Row: {
          end_at: string
          id: string
          reason: string | null
          staff_id: string
          start_at: string
        }
        Insert: {
          end_at: string
          id?: string
          reason?: string | null
          staff_id: string
          start_at: string
        }
        Update: {
          end_at?: string
          id?: string
          reason?: string | null
          staff_id?: string
          start_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_blocks_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      acquire_slot_lock: {
        Args: {
          p_end: string
          p_holder: string
          p_service: string
          p_staff: string
          p_start: string
        }
        Returns: {
          created_at: string
          end_at: string
          expires_at: string
          holder_session_id: string
          id: string
          service_id: string
          staff_id: string
          start_at: string
        }
        SetofOptions: {
          from: "*"
          to: "slot_locks"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      assign_my_role: {
        Args: { p_role: Database["public"]["Enums"]["app_role"] }
        Returns: undefined
      }
      cleanup_expired_invoices: { Args: never; Returns: number }
      confirm_booking: {
        Args: {
          p_email: string
          p_holder: string
          p_name: string
          p_phone: string
          p_service: string
          p_staff: string
          p_start: string
        }
        Returns: {
          business_id: string
          created_at: string
          customer_email: string
          customer_name: string
          customer_phone: string | null
          end_at: string
          id: string
          service_id: string
          staff_id: string
          start_at: string
          status: string
        }
        SetofOptions: {
          from: "*"
          to: "bookings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_business_with_owner: {
        Args: {
          p_address_line1?: string
          p_address_line2?: string
          p_banner_url?: string
          p_category?: string
          p_city?: string
          p_country?: string
          p_description?: string
          p_logo_url?: string
          p_name: string
          p_phone?: string
          p_postal_code?: string
          p_region?: string
        }
        Returns: string
      }
      create_invoice_for_booking: {
        Args: { p_booking_id: string }
        Returns: {
          amount: number
          appointment_at: string
          booking_id: string
          business_id: string
          created_at: string
          currency: string
          customer_email: string
          customer_name: string
          customer_phone: string | null
          expires_at: string
          id: string
          invoice_number: string
          issued_at: string
          service_id: string | null
          service_name: string
          staff_id: string | null
          staff_name: string | null
          status: string
          tax: number
          total: number
        }
        SetofOptions: {
          from: "*"
          to: "invoices"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_active_slot_locks: {
        Args: { p_from: string; p_staff_ids: string[]; p_to: string }
        Returns: {
          end_at: string
          expires_at: string
          staff_id: string
          start_at: string
        }[]
      }
      get_booked_slots: {
        Args: { p_from: string; p_staff_ids: string[]; p_to: string }
        Returns: {
          end_at: string
          staff_id: string
          start_at: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      release_slot_lock: {
        Args: { p_holder: string; p_staff: string; p_start: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "customer" | "provider"
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
      app_role: ["customer", "provider"],
    },
  },
} as const
