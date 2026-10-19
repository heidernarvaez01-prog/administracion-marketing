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
    PostgrestVersion: "14.17"
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
      ad_accounts: {
        Row: {
          account_id: string
          account_name: string | null
          active: boolean
          agency_name: string | null
          created_at: string
          currency: string | null
          last_data_date: string | null
          last_probe_at: string | null
          last_synced_at: string | null
          managed_by: string
          platform: string
          sync_mode: string
        }
        Insert: {
          account_id: string
          account_name?: string | null
          active?: boolean
          agency_name?: string | null
          created_at?: string
          currency?: string | null
          last_data_date?: string | null
          last_probe_at?: string | null
          last_synced_at?: string | null
          managed_by?: string
          platform?: string
          sync_mode?: string
        }
        Update: {
          account_id?: string
          account_name?: string | null
          active?: boolean
          agency_name?: string | null
          created_at?: string
          currency?: string | null
          last_data_date?: string | null
          last_probe_at?: string | null
          last_synced_at?: string | null
          managed_by?: string
          platform?: string
          sync_mode?: string
        }
        Relationships: []
      }
      agencies: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      agency_members: {
        Row: {
          agency_id: string
          created_at: string
          role: string
          user_id: string
        }
        Insert: {
          agency_id: string
          created_at?: string
          role?: string
          user_id: string
        }
        Update: {
          agency_id?: string
          created_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agency_members_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
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
          notify_frequency: string
          only_critical: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email_recipients?: string[]
          enabled?: boolean
          id?: string
          notify_frequency?: string
          only_critical?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email_recipients?: string[]
          enabled?: boolean
          id?: string
          notify_frequency?: string
          only_critical?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      audit_clients: {
        Row: {
          agency_id: string | null
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
          agency_id?: string | null
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
          agency_id?: string | null
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
        Relationships: [
          {
            foreignKeyName: "audit_clients_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_records: {
        Row: {
          account_id: string | null
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
          account_id?: string | null
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
          account_id?: string | null
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
          presupuesto_campana: string | null
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
          presupuesto_campana?: string | null
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
          presupuesto_campana?: string | null
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
      client_accounts: {
        Row: {
          account_id: string
          client_id: string
          created_at: string
        }
        Insert: {
          account_id: string
          client_id: string
          created_at?: string
        }
        Update: {
          account_id?: string
          client_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_accounts_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: true
            referencedRelation: "ad_accounts"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "client_accounts_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: true
            referencedRelation: "v_client_accounts"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "client_accounts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "audit_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_members: {
        Row: {
          client_id: string
          created_at: string
          role: string
          user_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          role?: string
          user_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_members_client_id_fkey"
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
      meta_ad_creatives: {
        Row: {
          account_id: string
          ad_id: string
          body: string | null
          image_url: string | null
          link_url: string | null
          thumbnail_url: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          account_id: string
          ad_id: string
          body?: string | null
          image_url?: string | null
          link_url?: string | null
          thumbnail_url?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string
          ad_id?: string
          body?: string | null
          image_url?: string | null
          link_url?: string | null
          thumbnail_url?: string | null
          title?: string | null
          updated_at?: string
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
          leads: number | null
          link_clicks: number | null
          messaging_conversations: number | null
          objective: string | null
          optimization_goal: string | null
          plataforma: string
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
          video_p100: number | null
          video_p25: number | null
          video_p50: number | null
          video_p75: number | null
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
          leads?: number | null
          link_clicks?: number | null
          messaging_conversations?: number | null
          objective?: string | null
          optimization_goal?: string | null
          plataforma?: string
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
          video_p100?: number | null
          video_p25?: number | null
          video_p50?: number | null
          video_p75?: number | null
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
          leads?: number | null
          link_clicks?: number | null
          messaging_conversations?: number | null
          objective?: string | null
          optimization_goal?: string | null
          plataforma?: string
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
          video_p100?: number | null
          video_p25?: number | null
          video_p50?: number | null
          video_p75?: number | null
          website_purchase_roas?: number | null
        }
        Relationships: []
      }
      meta_demographics_daily: {
        Row: {
          account_id: string
          age: string
          campaign_id: string
          clicks: number
          fecha: string
          gender: string
          impressions: number
          leads: number
          messaging_conversations: number
          reach: number
          spend: number
          synced_at: string
        }
        Insert: {
          account_id: string
          age?: string
          campaign_id?: string
          clicks?: number
          fecha: string
          gender?: string
          impressions?: number
          leads?: number
          messaging_conversations?: number
          reach?: number
          spend?: number
          synced_at?: string
        }
        Update: {
          account_id?: string
          age?: string
          campaign_id?: string
          clicks?: number
          fecha?: string
          gender?: string
          impressions?: number
          leads?: number
          messaging_conversations?: number
          reach?: number
          spend?: number
          synced_at?: string
        }
        Relationships: []
      }
      meta_geo_daily: {
        Row: {
          account_id: string
          campaign_id: string
          clicks: number
          country: string
          fecha: string
          impressions: number
          leads: number
          messaging_conversations: number
          reach: number
          region: string
          spend: number
          synced_at: string
        }
        Insert: {
          account_id: string
          campaign_id?: string
          clicks?: number
          country?: string
          fecha: string
          impressions?: number
          leads?: number
          messaging_conversations?: number
          reach?: number
          region?: string
          spend?: number
          synced_at?: string
        }
        Update: {
          account_id?: string
          campaign_id?: string
          clicks?: number
          country?: string
          fecha?: string
          impressions?: number
          leads?: number
          messaging_conversations?: number
          reach?: number
          region?: string
          spend?: number
          synced_at?: string
        }
        Relationships: []
      }
      meta_platform_daily: {
        Row: {
          account_id: string
          campaign_id: string
          clicks: number
          fecha: string
          impressions: number
          leads: number
          messaging_conversations: number
          platform_position: string
          publisher_platform: string
          reach: number
          spend: number
          synced_at: string
        }
        Insert: {
          account_id: string
          campaign_id?: string
          clicks?: number
          fecha: string
          impressions?: number
          leads?: number
          messaging_conversations?: number
          platform_position?: string
          publisher_platform?: string
          reach?: number
          spend?: number
          synced_at?: string
        }
        Update: {
          account_id?: string
          campaign_id?: string
          clicks?: number
          fecha?: string
          impressions?: number
          leads?: number
          messaging_conversations?: number
          platform_position?: string
          publisher_platform?: string
          reach?: number
          spend?: number
          synced_at?: string
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
      share_links: {
        Row: {
          active: boolean
          client_id: string
          created_at: string
          created_by: string | null
          token: string
        }
        Insert: {
          active?: boolean
          client_id: string
          created_at?: string
          created_by?: string | null
          token?: string
        }
        Update: {
          active?: boolean
          client_id?: string
          created_at?: string
          created_by?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "share_links_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "audit_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_locks: {
        Row: {
          acquired_at: string
          holder: string
          locked_until: string
          name: string
        }
        Insert: {
          acquired_at?: string
          holder: string
          locked_until: string
          name: string
        }
        Update: {
          acquired_at?: string
          holder?: string
          locked_until?: string
          name?: string
        }
        Relationships: []
      }
      sync_runs: {
        Row: {
          account_id: string
          error: string | null
          finished_at: string | null
          id: string
          mode: string
          rows: number | null
          run_id: string
          started_at: string
          status: string
          window_days: number | null
        }
        Insert: {
          account_id: string
          error?: string | null
          finished_at?: string | null
          id?: string
          mode: string
          rows?: number | null
          run_id: string
          started_at?: string
          status: string
          window_days?: number | null
        }
        Update: {
          account_id?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          mode?: string
          rows?: number | null
          run_id?: string
          started_at?: string
          status?: string
          window_days?: number | null
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
    }
    Views: {
      v_client_accounts: {
        Row: {
          account_id: string | null
          account_name: string | null
          active: boolean | null
          agency_name: string | null
          client_id: string | null
          client_name: string | null
          currency: string | null
          managed_by: string | null
          platform: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_accounts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "audit_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      v_meta_daily_campaign: {
        Row: {
          account_id: string | null
          campaign_id: string | null
          campaign_name: string | null
          clicks: number | null
          client_id: string | null
          currency: string | null
          fecha: string | null
          impressions: number | null
          leads: number | null
          messaging_conversations: number | null
          spend: number | null
        }
        Relationships: [
          {
            foreignKeyName: "client_accounts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "audit_clients"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      can_view_account: { Args: { _account_id: string }; Returns: boolean }
      client_period_totals: {
        Args: { _days?: number }
        Returns: {
          clicks: number
          client_id: string
          currency: string
          impressions: number
          last_fecha: string
          leads: number
          messaging_conversations: number
          spend: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_agency_manager: { Args: { _agency_id: string }; Returns: boolean }
      is_client_agency_manager: {
        Args: { _client_id: string }
        Returns: boolean
      }
      is_client_member: { Args: { _client_id: string }; Returns: boolean }
      is_client_owner: { Args: { _client_id: string }; Returns: boolean }
      meta_ad_totals: {
        Args: { _client_id?: string; _days?: number }
        Returns: {
          account_id: string
          ad_id: string
          ad_name: string
          campaign_name: string
          clicks: number
          client_id: string
          currency: string
          impressions: number
          last_fecha: string
          leads: number
          messaging_conversations: number
          spend: number
          spend_prior: number
          spend_recent: number
        }[]
      }
      meta_breakdown_totals: {
        Args: { _client_id?: string; _days?: number; _kind: string }
        Returns: {
          clicks: number
          currency: string
          dim1: string
          dim2: string
          impressions: number
          leads: number
          messaging_conversations: number
          reach: number
          spend: number
        }[]
      }
      meta_campaign_totals: {
        Args: { _client_id?: string; _days?: number }
        Returns: {
          account_id: string
          campaign_id: string
          campaign_name: string
          clicks: number
          client_id: string
          currency: string
          first_fecha: string
          impressions: number
          last_fecha: string
          leads: number
          messaging_conversations: number
          spend: number
        }[]
      }
      meta_daily_totals: {
        Args: { _client_id?: string; _days?: number }
        Returns: {
          clicks: number
          currency: string
          fecha: string
          impressions: number
          leads: number
          messaging_conversations: number
          spend: number
        }[]
      }
      meta_objective_totals: {
        Args: { _client_id?: string; _days?: number }
        Returns: {
          clicks: number
          currency: string
          impressions: number
          objective: string
          spend: number
        }[]
      }
      release_sync_lock: {
        Args: { _holder: string; _name: string }
        Returns: undefined
      }
      try_acquire_sync_lock: {
        Args: { _holder: string; _name: string; _ttl_seconds: number }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
