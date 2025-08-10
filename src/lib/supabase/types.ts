export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      audit_logs: {
        Row: {
          id: string
          tenant_id: string
          user_id: string | null
          action: string
          resource: string
          resource_id: string | null
          ip_address: string | null
          user_agent: string | null
          details: Json
          created_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          user_id?: string | null
          action: string
          resource: string
          resource_id?: string | null
          ip_address?: string | null
          user_agent?: string | null
          details?: Json
          created_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          user_id?: string | null
          action?: string
          resource?: string
          resource_id?: string | null
          ip_address?: string | null
          user_agent?: string | null
          details?: Json
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      plans: {
        Row: {
          key: 'starter' | 'pro' | 'enterprise' | 'custom'
          name: string
          description: string | null
          stripe_price_id: string | null
          limits: Json
          features: Json
          price_monthly: number
          price_yearly: number
          created_at: string
          updated_at: string
        }
        Insert: {
          key: 'starter' | 'pro' | 'enterprise' | 'custom'
          name: string
          description?: string | null
          stripe_price_id?: string | null
          limits?: Json
          features?: Json
          price_monthly?: number
          price_yearly?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          key?: 'starter' | 'pro' | 'enterprise' | 'custom'
          name?: string
          description?: string | null
          stripe_price_id?: string | null
          limits?: Json
          features?: Json
          price_monthly?: number
          price_yearly?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          id: string
          tenant_id: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          status: 'active' | 'inactive' | 'past_due' | 'canceled' | 'trialing'
          current_period_start: string | null
          current_period_end: string | null
          trial_end: string | null
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          status?: 'active' | 'inactive' | 'past_due' | 'canceled' | 'trialing'
          current_period_start?: string | null
          current_period_end?: string | null
          trial_end?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          status?: 'active' | 'inactive' | 'past_due' | 'canceled' | 'trialing'
          current_period_start?: string | null
          current_period_end?: string | null
          trial_end?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          }
        ]
      }
      template_installs: {
        Row: {
          id: string
          tenant_id: string
          template_id: string
          workflow_id: string
          workflow_name: string | null
          metadata: Json
          installed_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          template_id: string
          workflow_id: string
          workflow_name?: string | null
          metadata?: Json
          installed_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          template_id?: string
          workflow_id?: string
          workflow_name?: string | null
          metadata?: Json
          installed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "template_installs_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_installs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          }
        ]
      }
      templates: {
        Row: {
          id: string
          name: string
          description: string | null
          category: string
          subcategory: string | null
          workflow_json: Json
          icon_url: string | null
          preview_images: string[]
          tags: string[]
          difficulty: string
          estimated_time: number
          price: number
          install_count: number
          rating: number
          is_featured: boolean
          is_active: boolean
          author_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          category?: string
          subcategory?: string | null
          workflow_json: Json
          icon_url?: string | null
          preview_images?: string[]
          tags?: string[]
          difficulty?: string
          estimated_time?: number
          price?: number
          install_count?: number
          rating?: number
          is_featured?: boolean
          is_active?: boolean
          author_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          category?: string
          subcategory?: string | null
          workflow_json?: Json
          icon_url?: string | null
          preview_images?: string[]
          tags?: string[]
          difficulty?: string
          estimated_time?: number
          price?: number
          install_count?: number
          rating?: number
          is_featured?: boolean
          is_active?: boolean
          author_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "templates_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      tenants: {
        Row: {
          id: string
          name: string
          slug: string
          plan: 'starter' | 'pro' | 'enterprise' | 'custom'
          owner_user_id: string
          n8n_base_url: string | null
          n8n_api_key: string | null
          settings: Json
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          plan?: 'starter' | 'pro' | 'enterprise' | 'custom'
          owner_user_id: string
          n8n_base_url?: string | null
          n8n_api_key?: string | null
          settings?: Json
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          plan?: 'starter' | 'pro' | 'enterprise' | 'custom'
          owner_user_id?: string
          n8n_base_url?: string | null
          n8n_api_key?: string | null
          settings?: Json
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenants_owner_user_id_fkey"
            columns: ["owner_user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      usage_executions: {
        Row: {
          id: string
          tenant_id: string
          workflow_id: string
          execution_id: string
          workflow_name: string | null
          status: 'success' | 'error' | 'running' | 'waiting' | 'canceled'
          started_at: string | null
          stopped_at: string | null
          duration_ms: number | null
          node_count: number
          error_message: string | null
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          workflow_id: string
          execution_id: string
          workflow_name?: string | null
          status: 'success' | 'error' | 'running' | 'waiting' | 'canceled'
          started_at?: string | null
          stopped_at?: string | null
          duration_ms?: number | null
          node_count?: number
          error_message?: string | null
          metadata?: Json
          created_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          workflow_id?: string
          execution_id?: string
          workflow_name?: string | null
          status?: 'success' | 'error' | 'running' | 'waiting' | 'canceled'
          started_at?: string | null
          stopped_at?: string | null
          duration_ms?: number | null
          node_count?: number
          error_message?: string | null
          metadata?: Json
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "usage_executions_tenant_id_fkey"
            columns: ["tenant_id"]
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      dashboard_metrics_24h: {
        Row: {
          tenant_id: string | null
          total_executions: number | null
          successful_executions: number | null
          failed_executions: number | null
          success_rate: number | null
          avg_duration_seconds: number | null
          p95_duration_seconds: number | null
          active_workflows: number | null
        }
        Relationships: [
          {
            foreignKeyName: "usage_executions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      execution_status: 'success' | 'error' | 'running' | 'waiting' | 'canceled'
      plan_key: 'starter' | 'pro' | 'enterprise' | 'custom'
      subscription_status: 'active' | 'inactive' | 'past_due' | 'canceled' | 'trialing'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}