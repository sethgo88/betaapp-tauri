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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      burns: {
        Row: {
          climb_id: string
          created_at: string
          date: string
          deleted_at: string | null
          id: string
          notes: string | null
          outcome: string
          updated_at: string
          user_id: string
        }
        Insert: {
          climb_id: string
          created_at?: string
          date: string
          deleted_at?: string | null
          id?: string
          notes?: string | null
          outcome?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          climb_id?: string
          created_at?: string
          date?: string
          deleted_at?: string | null
          id?: string
          notes?: string | null
          outcome?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "burns_climb_id_fkey"
            columns: ["climb_id"]
            isOneToOne: false
            referencedRelation: "climbs"
            referencedColumns: ["id"]
          },
        ]
      }
      climb_image_pins: {
        Row: {
          climb_image_id: string
          created_at: string
          description: string | null
          id: string
          pin_type: string
          sort_order: number
          x_pct: number
          y_pct: number
        }
        Insert: {
          climb_image_id: string
          created_at?: string
          description?: string | null
          id?: string
          pin_type: string
          sort_order?: number
          x_pct: number
          y_pct: number
        }
        Update: {
          climb_image_id?: string
          created_at?: string
          description?: string | null
          id?: string
          pin_type?: string
          sort_order?: number
          x_pct?: number
          y_pct?: number
        }
        Relationships: [
          {
            foreignKeyName: "climb_image_pins_climb_image_id_fkey"
            columns: ["climb_image_id"]
            isOneToOne: false
            referencedRelation: "climb_images"
            referencedColumns: ["id"]
          },
        ]
      }
      climb_images: {
        Row: {
          climb_id: string
          created_at: string
          deleted_at: string | null
          id: string
          image_url: string
          sort_order: number
          user_id: string
        }
        Insert: {
          climb_id: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          image_url: string
          sort_order?: number
          user_id: string
        }
        Update: {
          climb_id?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          image_url?: string
          sort_order?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "climb_images_climb_id_fkey"
            columns: ["climb_id"]
            isOneToOne: false
            referencedRelation: "climbs"
            referencedColumns: ["id"]
          },
        ]
      }
      climbs: {
        Row: {
          area: string | null
          country: string | null
          created_at: string
          deleted_at: string | null
          grade: string
          id: string
          link: string | null
          moves: string
          name: string
          route_id: string | null
          route_location: string | null
          route_type: string
          sent_status: string
          sub_area: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          area?: string | null
          country?: string | null
          created_at: string
          deleted_at?: string | null
          grade: string
          id: string
          link?: string | null
          moves?: string
          name: string
          route_id?: string | null
          route_location?: string | null
          route_type?: string
          sent_status?: string
          sub_area?: string | null
          updated_at: string
          user_id: string
        }
        Update: {
          area?: string | null
          country?: string | null
          created_at?: string
          deleted_at?: string | null
          grade?: string
          id?: string
          link?: string | null
          moves?: string
          name?: string
          route_id?: string | null
          route_location?: string | null
          route_type?: string
          sent_status?: string
          sub_area?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "climbs_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
        ]
      }
      countries: {
        Row: {
          code: string
          created_at: string
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      crags: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          id: string
          lat: number | null
          lng: number | null
          name: string
          sort_order: number
          status: string
          sub_region_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          name: string
          sort_order?: number
          status?: string
          sub_region_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          name?: string
          sort_order?: number
          status?: string
          sub_region_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crags_sub_region_id_fkey"
            columns: ["sub_region_id"]
            isOneToOne: false
            referencedRelation: "sub_regions"
            referencedColumns: ["id"]
          },
        ]
      }
      grades: {
        Row: {
          created_at: string
          discipline: string
          grade: string
          id: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          discipline: string
          grade: string
          id: string
          sort_order: number
        }
        Update: {
          created_at?: string
          discipline?: string
          grade?: string
          id?: string
          sort_order?: number
        }
        Relationships: []
      }
      regions: {
        Row: {
          country_id: string
          created_at: string
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          country_id: string
          created_at?: string
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          country_id?: string
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "regions_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
        ]
      }
      route_images: {
        Row: {
          caption: string | null
          created_at: string
          id: string
          route_id: string
          sort_order: number
          url: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          id?: string
          route_id: string
          sort_order?: number
          url: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          id?: string
          route_id?: string
          sort_order?: number
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "route_images_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
        ]
      }
      route_links: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          link_type: string
          route_id: string
          title: string | null
          url: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          link_type?: string
          route_id: string
          title?: string | null
          url: string
          user_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          link_type?: string
          route_id?: string
          title?: string | null
          url?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "route_links_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
        ]
      }
      routes: {
        Row: {
          created_at: string
          created_by: string
          deleted_at: string | null
          description: string | null
          grade: string
          id: string
          name: string
          route_type: string
          status: string
          wall_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          deleted_at?: string | null
          description?: string | null
          grade: string
          id?: string
          name: string
          route_type?: string
          status?: string
          wall_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          description?: string | null
          grade?: string
          id?: string
          name?: string
          route_type?: string
          status?: string
          wall_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "routes_wall_id_fkey"
            columns: ["wall_id"]
            isOneToOne: false
            referencedRelation: "walls"
            referencedColumns: ["id"]
          },
        ]
      }
      sub_regions: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          id: string
          name: string
          region_id: string
          sort_order: number
          status: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          name: string
          region_id: string
          sort_order?: number
          status?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          name?: string
          region_id?: string
          sort_order?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "sub_regions_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          role: string
          user_id: string
        }
        Insert: {
          role: string
          user_id: string
        }
        Update: {
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          ape_index_cm: number | null
          created_at: string
          default_unit: string
          deleted_at: string | null
          display_name: string | null
          email: string
          height_cm: number | null
          id: string
          max_redpoint_boulder: string | null
          max_redpoint_sport: string | null
          role: string
          updated_at: string
        }
        Insert: {
          ape_index_cm?: number | null
          created_at?: string
          default_unit?: string
          deleted_at?: string | null
          display_name?: string | null
          email: string
          height_cm?: number | null
          id: string
          max_redpoint_boulder?: string | null
          max_redpoint_sport?: string | null
          role?: string
          updated_at?: string
        }
        Update: {
          ape_index_cm?: number | null
          created_at?: string
          default_unit?: string
          deleted_at?: string | null
          display_name?: string | null
          email?: string
          height_cm?: number | null
          id?: string
          max_redpoint_boulder?: string | null
          max_redpoint_sport?: string | null
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      wall_images: {
        Row: {
          caption: string | null
          created_at: string
          id: string
          sort_order: number
          url: string
          wall_id: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          id?: string
          sort_order?: number
          url: string
          wall_id: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          id?: string
          sort_order?: number
          url?: string
          wall_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wall_images_wall_id_fkey"
            columns: ["wall_id"]
            isOneToOne: false
            referencedRelation: "walls"
            referencedColumns: ["id"]
          },
        ]
      }
      walls: {
        Row: {
          crag_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          id: string
          lat: number | null
          lng: number | null
          name: string
          sort_order: number
          status: string
        }
        Insert: {
          crag_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          name: string
          sort_order?: number
          status?: string
        }
        Update: {
          crag_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          name?: string
          sort_order?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "walls_crag_id_fkey"
            columns: ["crag_id"]
            isOneToOne: false
            referencedRelation: "crags"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_admin: { Args: never; Returns: boolean }
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
