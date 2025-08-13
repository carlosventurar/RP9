// RP9 Orchestrator - Type Definitions

export interface TenantInstance {
  id: string
  tenant_id: string
  name: string
  subdomain: string
  email: string
  mode: 'shared' | 'dedicated'
  status: 'provisioning' | 'active' | 'suspended' | 'migrating' | 'failed'
  plan: 'starter' | 'pro' | 'enterprise'
  region: string
  cpu_cores: number
  memory_mb: number
  workers: number
  storage_gb: number
  login_url?: string
  n8n_url?: string
  db_name?: string
  container_id?: string
  container_status?: 'running' | 'stopped' | 'failed' | 'restarting'
  traefik_router?: string
  created_at: string
  updated_at: string
  last_healthcheck_at?: string
  metadata: Record<string, any>
}

export interface TenantQuotas {
  id: string
  tenant_id: string
  executions_monthly: number
  concurrent_executions: number
  cpu_limit_percent: number
  memory_limit_mb: number
  storage_limit_gb: number
  api_calls_hourly: number
  webhook_endpoints: number
  retention_days: number
  enforcement_enabled: boolean
  soft_limit_warnings: boolean
  stripe_product_id?: string
  stripe_entitlements: Record<string, any>
  last_sync_at?: string
  created_at: string
  updated_at: string
}

export interface TenantBackup {
  id: string
  tenant_id: string
  backup_type: 'daily' | 'weekly' | 'manual' | 'pre_migration' | 'pre_upgrade'
  status: 'running' | 'completed' | 'failed' | 'expired'
  s3_path: string
  s3_bucket: string
  backup_size_bytes?: number
  includes_database: boolean
  includes_workflows: boolean
  includes_credentials: boolean
  includes_files: boolean
  restore_tested: boolean
  restore_tested_at?: string
  retention_until: string
  backup_version: string
  compatibility_version?: string
  created_at: string
  completed_at?: string
  metadata: Record<string, any>
}

export interface AutoscaleEvent {
  id: string
  tenant_id: string
  trigger_type: 'queue_wait_p95' | 'executions_per_min' | 'cpu_usage' | 'memory_usage' | 'manual'
  trigger_value: number
  trigger_threshold: number
  action: 'scale_up' | 'scale_down' | 'add_worker' | 'remove_worker' | 'promote_dedicated'
  action_details: Record<string, any>
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled'
  resources_before?: Record<string, any>
  resources_after?: Record<string, any>
  created_at: string
  started_at?: string
  completed_at?: string
  success?: boolean
  error_message?: string
  metadata: Record<string, any>
}

export interface EnforcementEvent {
  id: string
  tenant_id: string
  limit_type: 'executions_monthly' | 'concurrent_executions' | 'cpu_usage' | 'memory_usage' | 'storage' | 'api_calls'
  current_usage: number
  limit_value: number
  usage_percentage: number
  action: 'warning' | 'throttle' | 'suspend' | 'overage_billing'
  severity: 'info' | 'warning' | 'critical'
  status: 'active' | 'resolved' | 'acknowledged'
  notification_sent: boolean
  notification_type?: 'email' | 'slack' | 'webhook' | 'in_app'
  created_at: string
  resolved_at?: string
  acknowledged_at?: string
  metadata: Record<string, any>
}

// API Request/Response Types
export interface CreateTenantRequest {
  name: string
  email: string
  subdomain: string
  mode: 'shared' | 'dedicated'
  plan: 'starter' | 'pro' | 'enterprise'
  region?: string
}

export interface CreateTenantResponse {
  tenant_id: string
  login_url: string
  status: string
  message: string
}

export interface ScaleTenantRequest {
  cpu?: number
  memory_mb?: number
  workers?: number
}

export interface PromoteTenantRequest {
  window?: string // ISO datetime
  ttl_minutes?: number
}

export interface BackupTenantRequest {
  backup_type?: 'manual' | 'pre_migration' | 'pre_upgrade'
  includes_database?: boolean
  includes_workflows?: boolean
  includes_credentials?: boolean
  includes_files?: boolean
}

export interface BackupTenantResponse {
  ok: boolean
  backup_id: string
  s3_path: string
  estimated_completion?: string
}

// Docker Container Configuration
export interface ContainerConfig {
  name: string
  image: string
  env: Record<string, string>
  labels: Record<string, string>
  exposedPorts: Record<string, {}>
  hostConfig: {
    portBindings: Record<string, Array<{ hostPort: string }>>
    memory: number
    cpuShares: number
    restartPolicy: { name: string }
  }
  networkingConfig: {
    endpointsConfig: Record<string, any>
  }
}

// Traefik Configuration
export interface TraefikLabels {
  'traefik.enable': string
  'traefik.http.routers.{name}.rule': string
  'traefik.http.routers.{name}.tls': string
  'traefik.http.routers.{name}.tls.certresolver': string
  'traefik.http.services.{name}.loadbalancer.server.port': string
  'traefik.docker.network': string
}

// Prometheus Metrics Types
export interface TenantMetrics {
  tenant_id: string
  queue_wait_p95_seconds: number
  cpu_percent: number
  memory_bytes: number
  executions_per_minute: number
  success_rate_percent: number
  active_workers: number
  last_updated: string
}

// Environment Configuration
export interface OrchestratorConfig {
  port: number
  jwt_secret: string
  hmac_secret: string
  postgres_url: string
  supabase_url: string
  supabase_service_role_key: string
  stripe_secret_key: string
  s3_endpoint: string
  s3_bucket: string
  s3_access_key: string
  s3_secret_key: string
  traefik_domain: string
  acme_email: string
  n8n_image: string
  db_password: string
  shared_n8n_base_url: string
  shared_n8n_api_key: string
  redis_url: string
}

// API Error Response
export interface ApiError {
  error: string
  message: string
  details?: any
  code?: string
  timestamp: string
}

// API Success Response
export interface ApiSuccess<T = any> {
  success: true
  data: T
  message?: string
  timestamp: string
}

// Utility Types
export type ApiResponse<T = any> = ApiSuccess<T> | ApiError

export interface PaginationParams {
  page?: number
  limit?: number
  sort?: string
  order?: 'asc' | 'desc'
}

export interface PaginatedResponse<T> extends ApiSuccess<T[]> {
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}

// JWT Payload
export interface JwtPayload {
  tenant_id?: string
  user_id?: string
  role: 'user' | 'admin' | 'service_role'
  iat: number
  exp: number
}

// HMAC Request Signature
export interface HmacRequest {
  timestamp: string
  signature: string
  body: string
}