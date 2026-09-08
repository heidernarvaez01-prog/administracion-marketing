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
      account_assignments: {
        Row: {
          account_id: string
          account_name: string | null
          created_at: string
          created_by: string | null
          id: string
          platform: string | null
          user_id: string
        }
        Insert: {
          account_id: string
          account_name?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          platform?: string | null
          user_id: string
        }
        Update: {
          account_id?: string
          account_name?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          platform?: string | null
          user_id?: string
        }
        Relationships: []
      }
      alert_events: {
        Row: {
          alert_type: string
          campaign_name: string
          id: string
          last_triggered_at: string
          user_id: string
        }
        Insert: {
          alert_type: string
          campaign_name: string
          id?: string
          last_triggered_at?: string
          user_id: string
        }
        Update: {
          alert_type?: string
          campaign_name?: string
          id?: string
          last_triggered_at?: string
          user_id?: string
        }
        Relationships: []
      }
      alert_rules: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          rule_type: string
          secondary_threshold: number | null
          threshold: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          rule_type: string
          secondary_threshold?: number | null
          threshold?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          rule_type?: string
          secondary_threshold?: number | null
          threshold?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      alert_settings: {
        Row: {
          created_at: string
          email_recipients: string[]
          enabled: boolean
          id: string
          last_sent_at: string | null
          notify_frequency: string
          only_critical: boolean
          pacing_threshold_pct: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email_recipients?: string[]
          enabled?: boolean
          id?: string
          last_sent_at?: string | null
          notify_frequency?: string
          only_critical?: boolean
          pacing_threshold_pct?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email_recipients?: string[]
          enabled?: boolean
          id?: string
          last_sent_at?: string | null
          notify_frequency?: string
          only_critical?: boolean
          pacing_threshold_pct?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      audit_clients: {
        Row: {
          created_at: string
          description: string | null
          id: string
          looker_approved: boolean
          looker_report_url: string | null
          name: string
          report_recipients: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          looker_approved?: boolean
          looker_report_url?: string | null
          name: string
          report_recipients?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          looker_approved?: boolean
          looker_report_url?: string | null
          name?: string
          report_recipients?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      audit_records: {
        Row: {
          account_id: string
          campaign_name: string
          client_id: string | null
          created_at: string
          fecha_fin: string
          fecha_inicio: string
          id: string
          platform: string | null
          presupuesto_total: number
          tipo_calendario: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          campaign_name: string
          client_id?: string | null
          created_at?: string
          fecha_fin: string
          fecha_inicio: string
          id?: string
          platform?: string | null
          presupuesto_total?: number
          tipo_calendario?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          campaign_name?: string
          client_id?: string | null
          created_at?: string
          fecha_fin?: string
          fecha_inicio?: string
          id?: string
          platform?: string | null
          presupuesto_total?: number
          tipo_calendario?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_records_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "audit_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_briefs: {
        Row: {
          account_id: string | null
          account_name: string | null
          benchmark: string | null
          client_id: string | null
          created_at: string
          descripcion_proyecto: string | null
          diferenciador: string | null
          elementos_marca: string | null
          estilo_tono: string | null
          frases_marca: string | null
          fundamentos_marca: string | null
          id: string
          insights: string | null
          marca: string | null
          mercado_objetivo: string | null
          necesidad_principal: string | null
          palabras_marca: string | null
          personalidad_marca: string | null
          presupuesto_campana: number | null
          promesa_marca: string | null
          publico_objetivo: string | null
          reasons_why: string | null
          sitio_web: string | null
          updated_at: string
          user_id: string
          valores_marca: string | null
        }
        Insert: {
          account_id?: string | null
          account_name?: string | null
          benchmark?: string | null
          client_id?: string | null
          created_at?: string
          descripcion_proyecto?: string | null
          diferenciador?: string | null
          elementos_marca?: string | null
          estilo_tono?: string | null
          frases_marca?: string | null
          fundamentos_marca?: string | null
          id?: string
          insights?: string | null
          marca?: string | null
          mercado_objetivo?: string | null
          necesidad_principal?: string | null
          palabras_marca?: string | null
          personalidad_marca?: string | null
          presupuesto_campana?: number | null
          promesa_marca?: string | null
          publico_objetivo?: string | null
          reasons_why?: string | null
          sitio_web?: string | null
          updated_at?: string
          user_id: string
          valores_marca?: string | null
        }
        Update: {
          account_id?: string | null
          account_name?: string | null
          benchmark?: string | null
          client_id?: string | null
          created_at?: string
          descripcion_proyecto?: string | null
          diferenciador?: string | null
          elementos_marca?: string | null
          estilo_tono?: string | null
          frases_marca?: string | null
          fundamentos_marca?: string | null
          id?: string
          insights?: string | null
          marca?: string | null
          mercado_objetivo?: string | null
          necesidad_principal?: string | null
          palabras_marca?: string | null
          personalidad_marca?: string | null
          presupuesto_campana?: number | null
          promesa_marca?: string | null
          publico_objetivo?: string | null
          reasons_why?: string | null
          sitio_web?: string | null
          updated_at?: string
          user_id?: string
          valores_marca?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brand_briefs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "audit_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_ai_insights: {
        Row: {
          campaign_name: string
          client_id: string | null
          created_at: string
          finding: string
          id: string
          metrics_snapshot: Json
          recommendation: string
          severity: string
          user_id: string
        }
        Insert: {
          campaign_name: string
          client_id?: string | null
          created_at?: string
          finding: string
          id?: string
          metrics_snapshot?: Json
          recommendation: string
          severity: string
          user_id: string
        }
        Update: {
          campaign_name?: string
          client_id?: string | null
          created_at?: string
          finding?: string
          id?: string
          metrics_snapshot?: Json
          recommendation?: string
          severity?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_ai_insights_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "audit_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      cluster_runs: {
        Row: {
          client_id: string
          cluster_key: string
          created_at: string
          id: string
          model: string | null
          output_html: string | null
          status: string
          title: string
          user_id: string
        }
        Insert: {
          client_id: string
          cluster_key?: string
          created_at?: string
          id?: string
          model?: string | null
          output_html?: string | null
          status?: string
          title: string
          user_id: string
        }
        Update: {
          client_id?: string
          cluster_key?: string
          created_at?: string
          id?: string
          model?: string | null
          output_html?: string | null
          status?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cluster_runs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "audit_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      meta_datos: {
        Row: {
          account_id: string | null
          account_name: string | null
          ad_id: string | null
          ad_name: string | null
          add_to_cart: number | null
          adset_budget_remaining: number | null
          adset_daily_budget: number | null
          adset_end_date: string | null
          adset_id: string | null
          adset_lifetime_budget: number | null
          adset_name: string | null
          adset_start_date: string | null
          budget_remaining: number | null
          campaign_end_date: string | null
          campaign_id: string | null
          campaign_lifetime_budget: number | null
          campaign_name: string | null
          campaign_start_date: string | null
          clicks: number | null
          conversion_rate_ranking: string | null
          conversions: number | null
          cpc: number | null
          cpm: number | null
          created_at: string
          ctr_all: number | null
          daily_budget: number | null
          engagement_rate_ranking: string | null
          fecha: string | null
          frequency: number | null
          id: number
          impressions: number | null
          initiate_checkout: number | null
          interactions: number | null
          landing_page_views: number | null
          lead_value: number | null
          link_clicks: number | null
          objective: string | null
          optimization_goal: string | null
          plataforma: string | null
          platform_specific: Json
          publisher_platform: string | null
          purchase_roas: number | null
          purchase_value: number | null
          purchases: number | null
          quality_ranking: string | null
          reach: number | null
          thruplay_actions: number | null
          total_cost: number | null
          unique_clicks: number | null
          unique_ctr: number | null
          website_purchase_roas: number | null
        }
        Insert: {
          account_id?: string | null
          account_name?: string | null
          ad_id?: string | null
          ad_name?: string | null
          add_to_cart?: number | null
          adset_budget_remaining?: number | null
          adset_daily_budget?: number | null
          adset_end_date?: string | null
          adset_id?: string | null
          adset_lifetime_budget?: number | null
          adset_name?: string | null
          adset_start_date?: string | null
          budget_remaining?: number | null
          campaign_end_date?: string | null
          campaign_id?: string | null
          campaign_lifetime_budget?: number | null
          campaign_name?: string | null
          campaign_start_date?: string | null
          clicks?: number | null
          conversion_rate_ranking?: string | null
          conversions?: number | null
          cpc?: number | null
          cpm?: number | null
          created_at?: string
          ctr_all?: number | null
          daily_budget?: number | null
          engagement_rate_ranking?: string | null
          fecha?: string | null
          frequency?: number | null
          id?: number
          impressions?: number | null
          initiate_checkout?: number | null
          interactions?: number | null
          landing_page_views?: number | null
          lead_value?: number | null
          link_clicks?: number | null
          objective?: string | null
          optimization_goal?: string | null
          plataforma?: string | null
          platform_specific?: Json
          publisher_platform?: string | null
          purchase_roas?: number | null
          purchase_value?: number | null
          purchases?: number | null
          quality_ranking?: string | null
          reach?: number | null
          thruplay_actions?: number | null
          total_cost?: number | null
          unique_clicks?: number | null
          unique_ctr?: number | null
          website_purchase_roas?: number | null
        }
        Update: {
          account_id?: string | null
          account_name?: string | null
          ad_id?: string | null
          ad_name?: string | null
          add_to_cart?: number | null
          adset_budget_remaining?: number | null
          adset_daily_budget?: number | null
          adset_end_date?: string | null
          adset_id?: string | null
          adset_lifetime_budget?: number | null
          adset_name?: string | null
          adset_start_date?: string | null
          budget_remaining?: number | null
          campaign_end_date?: string | null
          campaign_id?: string | null
          campaign_lifetime_budget?: number | null
          campaign_name?: string | null
          campaign_start_date?: string | null
          clicks?: number | null
          conversion_rate_ranking?: string | null
          conversions?: number | null
          cpc?: number | null
          cpm?: number | null
          created_at?: string
          ctr_all?: number | null
          daily_budget?: number | null
          engagement_rate_ranking?: string | null
          fecha?: string | null
          frequency?: number | null
          id?: number
          impressions?: number | null
          initiate_checkout?: number | null
          interactions?: number | null
          landing_page_views?: number | null
          lead_value?: number | null
          link_clicks?: number | null
          objective?: string | null
          optimization_goal?: string | null
          plataforma?: string | null
          platform_specific?: Json
          publisher_platform?: string | null
          purchase_roas?: number | null
          purchase_value?: number | null
          purchases?: number | null
          quality_ranking?: string | null
          reach?: number | null
          thruplay_actions?: number | null
          total_cost?: number | null
          unique_clicks?: number | null
          unique_ctr?: number | null
          website_purchase_roas?: number | null
        }
        Relationships: []
      }
      notification_channels: {
        Row: {
          channel_type: string
          config: Json
          created_at: string
          enabled: boolean
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          channel_type: string
          config?: Json
          created_at?: string
          enabled?: boolean
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          channel_type?: string
          config?: Json
          created_at?: string
          enabled?: boolean
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          alert_type: string
          campaign_name: string
          created_at: string
          id: string
          message: string
          read_at: string | null
          severity: string
          user_id: string
        }
        Insert: {
          alert_type: string
          campaign_name: string
          created_at?: string
          id?: string
          message: string
          read_at?: string | null
          severity: string
          user_id: string
        }
        Update: {
          alert_type?: string
          campaign_name?: string
          created_at?: string
          id?: string
          message?: string
          read_at?: string | null
          severity?: string
          user_id?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
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
      weekly_reports: {
        Row: {
          client_id: string
          created_at: string
          html: string | null
          id: string
          sent_at: string | null
          sent_to: string[]
          user_id: string
          week_end: string
          week_start: string
        }
        Insert: {
          client_id: string
          created_at?: string
          html?: string | null
          id?: string
          sent_at?: string | null
          sent_to?: string[]
          user_id: string
          week_end: string
          week_start: string
        }
        Update: {
          client_id?: string
          created_at?: string
          html?: string | null
          id?: string
          sent_at?: string | null
          sent_to?: string[]
          user_id?: string
          week_end?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekly_reports_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "audit_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      presenter_notes: {
        Row: {
          content: string
          created_at: string
          id: string
          slide_id: string
          updated_at: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          slide_id: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          slide_id?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
    }
    Enums: {
      ad_platform:
        | "meta"
        | "google"
        | "tiktok"
        | "linkedin"
        | "extra1"
        | "extra2"
      app_role: "admin" | "user"
      lab_days_type: "mon_fri" | "mon_sat" | "all"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      ad_platform: ["meta", "google", "tiktok", "linkedin", "extra1", "extra2"],
      app_role: ["admin", "user"],
      lab_days_type: ["mon_fri", "mon_sat", "all"],
    },
  },
} as const
