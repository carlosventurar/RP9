-- RP9 Fase 13: Orchestrator Multi-tenancy Schema
-- Esta migración crea las tablas necesarias para el sistema de orquestación multi-tenant

-- =============================================================================
-- CORE ORCHESTRATOR TABLES
-- =============================================================================

-- Tabla principal de tenant instances (shared y dedicated)
CREATE TABLE IF NOT EXISTS tenant_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL, -- Del sistema principal de tenants
  name TEXT NOT NULL,
  subdomain TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  
  -- Configuración de tenancy
  mode TEXT NOT NULL CHECK (mode IN ('shared', 'dedicated')),
  status TEXT NOT NULL DEFAULT 'provisioning' CHECK (status IN ('provisioning', 'active', 'suspended', 'migrating', 'failed')),
  plan TEXT NOT NULL CHECK (plan IN ('starter', 'pro', 'enterprise')),
  region TEXT NOT NULL DEFAULT 'us-east',
  
  -- Configuración de recursos (solo para dedicado)
  cpu_cores INTEGER DEFAULT 1,
  memory_mb INTEGER DEFAULT 1024,
  workers INTEGER DEFAULT 1,
  storage_gb INTEGER DEFAULT 10,
  
  -- URLs y configuración de acceso
  login_url TEXT,
  n8n_url TEXT, -- URL del contenedor n8n (si dedicado)
  db_name TEXT, -- Nombre de la DB dedicada
  
  -- Metadatos operativos
  container_id TEXT, -- Docker container ID (si dedicado)
  container_status TEXT CHECK (container_status IN ('running', 'stopped', 'failed', 'restarting')),
  traefik_router TEXT, -- Nombre del router en Traefik
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_healthcheck_at TIMESTAMPTZ,
  
  -- Metadatos adicionales
  metadata JSONB DEFAULT '{}',
  
  -- Índices y constraints
  UNIQUE(subdomain)
);

-- Tabla de quotas y límites por tenant
CREATE TABLE IF NOT EXISTS tenant_quotas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL REFERENCES tenant_instances(tenant_id) ON DELETE CASCADE,
  
  -- Límites por plan (desde Stripe entitlements)
  executions_monthly INTEGER NOT NULL DEFAULT 1000,
  concurrent_executions INTEGER NOT NULL DEFAULT 5,
  cpu_limit_percent INTEGER NOT NULL DEFAULT 100,
  memory_limit_mb INTEGER NOT NULL DEFAULT 1024,
  storage_limit_gb INTEGER NOT NULL DEFAULT 5,
  
  -- Límites adicionales
  api_calls_hourly INTEGER NOT NULL DEFAULT 1000,
  webhook_endpoints INTEGER NOT NULL DEFAULT 10,
  retention_days INTEGER NOT NULL DEFAULT 30,
  
  -- Estado de enforcement
  enforcement_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  soft_limit_warnings BOOLEAN NOT NULL DEFAULT TRUE,
  
  -- Metadatos de sincronización
  stripe_product_id TEXT,
  stripe_entitlements JSONB DEFAULT '{}',
  last_sync_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(tenant_id)
);

-- Tabla de backups y restore points
CREATE TABLE IF NOT EXISTS tenant_backups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL REFERENCES tenant_instances(tenant_id) ON DELETE CASCADE,
  
  -- Información del backup
  backup_type TEXT NOT NULL CHECK (backup_type IN ('daily', 'weekly', 'manual', 'pre_migration', 'pre_upgrade')),
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'expired')),
  
  -- Ubicación y metadatos
  s3_path TEXT NOT NULL,
  s3_bucket TEXT NOT NULL,
  backup_size_bytes BIGINT,
  
  -- Contenido del backup
  includes_database BOOLEAN NOT NULL DEFAULT TRUE,
  includes_workflows BOOLEAN NOT NULL DEFAULT TRUE,
  includes_credentials BOOLEAN NOT NULL DEFAULT TRUE,
  includes_files BOOLEAN NOT NULL DEFAULT FALSE,
  
  -- Metadatos de restauración
  restore_tested BOOLEAN NOT NULL DEFAULT FALSE,
  restore_tested_at TIMESTAMPTZ,
  retention_until TIMESTAMPTZ NOT NULL,
  
  -- Versionado
  backup_version TEXT NOT NULL DEFAULT '1.0',
  compatibility_version TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  
  -- Metadatos adicionales
  metadata JSONB DEFAULT '{}'
);

-- Tabla de eventos de autoscaling
CREATE TABLE IF NOT EXISTS autoscale_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL REFERENCES tenant_instances(tenant_id) ON DELETE CASCADE,
  
  -- Trigger del evento
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('queue_wait_p95', 'executions_per_min', 'cpu_usage', 'memory_usage', 'manual')),
  trigger_value DECIMAL(10,2),
  trigger_threshold DECIMAL(10,2),
  
  -- Acción tomada
  action TEXT NOT NULL CHECK (action IN ('scale_up', 'scale_down', 'add_worker', 'remove_worker', 'promote_dedicated')),
  action_details JSONB NOT NULL DEFAULT '{}',
  
  -- Estado del evento
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'cancelled')),
  
  -- Recursos antes/después
  resources_before JSONB,
  resources_after JSONB,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- Resultado
  success BOOLEAN,
  error_message TEXT,
  
  -- Metadatos
  metadata JSONB DEFAULT '{}'
);

-- Tabla de eventos de enforcement
CREATE TABLE IF NOT EXISTS enforcement_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL REFERENCES tenant_instances(tenant_id) ON DELETE CASCADE,
  
  -- Límite violado
  limit_type TEXT NOT NULL CHECK (limit_type IN ('executions_monthly', 'concurrent_executions', 'cpu_usage', 'memory_usage', 'storage', 'api_calls')),
  current_usage DECIMAL(10,2) NOT NULL,
  limit_value DECIMAL(10,2) NOT NULL,
  usage_percentage DECIMAL(5,2) NOT NULL,
  
  -- Acción de enforcement
  action TEXT NOT NULL CHECK (action IN ('warning', 'throttle', 'suspend', 'overage_billing')),
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  
  -- Estado del evento
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'acknowledged')),
  
  -- Notificaciones
  notification_sent BOOLEAN NOT NULL DEFAULT FALSE,
  notification_type TEXT CHECK (notification_type IN ('email', 'slack', 'webhook', 'in_app')),
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  acknowledged_at TIMESTAMPTZ,
  
  -- Metadatos
  metadata JSONB DEFAULT '{}'
);

-- =============================================================================
-- MÉTRICAS Y OBSERVABILIDAD
-- =============================================================================

-- Vista para métricas agregadas por tenant
CREATE OR REPLACE VIEW tenant_metrics AS
SELECT 
  ti.tenant_id,
  ti.name,
  ti.mode,
  ti.status,
  ti.plan,
  
  -- Recursos actuales
  ti.cpu_cores,
  ti.memory_mb,
  ti.workers,
  
  -- Contadores de eventos (últimos 30 días)
  COUNT(ae.id) FILTER (WHERE ae.created_at > NOW() - INTERVAL '30 days') AS autoscale_events_30d,
  COUNT(ee.id) FILTER (WHERE ee.created_at > NOW() - INTERVAL '30 days' AND ee.severity = 'critical') AS critical_events_30d,
  
  -- Último backup
  MAX(tb.created_at) AS last_backup_at,
  COUNT(tb.id) FILTER (WHERE tb.status = 'completed' AND tb.created_at > NOW() - INTERVAL '7 days') AS successful_backups_7d,
  
  -- Health indicators
  CASE 
    WHEN ti.last_healthcheck_at > NOW() - INTERVAL '5 minutes' THEN 'healthy'
    WHEN ti.last_healthcheck_at > NOW() - INTERVAL '15 minutes' THEN 'degraded'
    ELSE 'unhealthy'
  END AS health_status,
  
  ti.last_healthcheck_at,
  ti.updated_at
  
FROM tenant_instances ti
LEFT JOIN autoscale_events ae ON ti.tenant_id = ae.tenant_id
LEFT JOIN enforcement_events ee ON ti.tenant_id = ee.tenant_id
LEFT JOIN tenant_backups tb ON ti.tenant_id = tb.tenant_id
GROUP BY ti.tenant_id, ti.name, ti.mode, ti.status, ti.plan, ti.cpu_cores, ti.memory_mb, ti.workers, ti.last_healthcheck_at, ti.updated_at;

-- Vista para dashboard de costos
CREATE OR REPLACE VIEW tenant_costs AS
SELECT 
  ti.tenant_id,
  ti.name,
  ti.mode,
  ti.plan,
  
  -- Costos de recursos (estimados)
  CASE 
    WHEN ti.mode = 'shared' THEN 0 -- Compartido no tiene costo de infraestructura
    ELSE (ti.cpu_cores * 10.0) + (ti.memory_mb * 0.01) + (ti.workers * 5.0) -- USD/mes estimado
  END AS infrastructure_cost_usd_monthly,
  
  -- Backup storage costs
  COALESCE(SUM(tb.backup_size_bytes) / (1024*1024*1024) * 0.023, 0) AS backup_storage_cost_usd_monthly, -- S3 pricing
  
  -- Total cost
  CASE 
    WHEN ti.mode = 'shared' THEN COALESCE(SUM(tb.backup_size_bytes) / (1024*1024*1024) * 0.023, 0)
    ELSE (ti.cpu_cores * 10.0) + (ti.memory_mb * 0.01) + (ti.workers * 5.0) + COALESCE(SUM(tb.backup_size_bytes) / (1024*1024*1024) * 0.023, 0)
  END AS total_cost_usd_monthly,
  
  COUNT(tb.id) AS total_backups,
  ti.created_at,
  ti.updated_at
  
FROM tenant_instances ti
LEFT JOIN tenant_backups tb ON ti.tenant_id = tb.tenant_id AND tb.status = 'completed'
GROUP BY ti.tenant_id, ti.name, ti.mode, ti.plan, ti.cpu_cores, ti.memory_mb, ti.workers, ti.created_at, ti.updated_at;

-- =============================================================================
-- FUNCIONES Y TRIGGERS
-- =============================================================================

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers para updated_at
DROP TRIGGER IF EXISTS update_tenant_instances_updated_at ON tenant_instances;
CREATE TRIGGER update_tenant_instances_updated_at
  BEFORE UPDATE ON tenant_instances
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_tenant_quotas_updated_at ON tenant_quotas;
CREATE TRIGGER update_tenant_quotas_updated_at
  BEFORE UPDATE ON tenant_quotas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Función para cleanup automático de eventos antiguos
CREATE OR REPLACE FUNCTION cleanup_old_events()
RETURNS void AS $$
BEGIN
  -- Limpiar eventos de autoscaling > 90 días
  DELETE FROM autoscale_events 
  WHERE created_at < NOW() - INTERVAL '90 days';
  
  -- Limpiar eventos de enforcement resueltos > 30 días
  DELETE FROM enforcement_events 
  WHERE status = 'resolved' AND resolved_at < NOW() - INTERVAL '30 days';
  
  -- Limpiar backups expirados
  DELETE FROM tenant_backups 
  WHERE retention_until < NOW();
  
  RAISE NOTICE 'Cleanup completed';
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================================================

-- Habilitar RLS en todas las tablas
ALTER TABLE tenant_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_quotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_backups ENABLE ROW LEVEL SECURITY;
ALTER TABLE autoscale_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE enforcement_events ENABLE ROW LEVEL SECURITY;

-- Políticas para usuarios normales (solo ven sus propios tenants)
CREATE POLICY tenant_instances_user_policy ON tenant_instances
  FOR ALL USING (auth.jwt() ->> 'tenant_id' = tenant_id);

CREATE POLICY tenant_quotas_user_policy ON tenant_quotas
  FOR ALL USING (auth.jwt() ->> 'tenant_id' = tenant_id);

CREATE POLICY tenant_backups_user_policy ON tenant_backups
  FOR ALL USING (auth.jwt() ->> 'tenant_id' = tenant_id);

CREATE POLICY autoscale_events_user_policy ON autoscale_events
  FOR ALL USING (auth.jwt() ->> 'tenant_id' = tenant_id);

CREATE POLICY enforcement_events_user_policy ON enforcement_events
  FOR ALL USING (auth.jwt() ->> 'tenant_id' = tenant_id);

-- Políticas para admins (ven todo)
CREATE POLICY tenant_instances_admin_policy ON tenant_instances
  FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY tenant_quotas_admin_policy ON tenant_quotas
  FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY tenant_backups_admin_policy ON tenant_backups
  FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY autoscale_events_admin_policy ON autoscale_events
  FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY enforcement_events_admin_policy ON enforcement_events
  FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

-- Políticas para service role (acceso completo)
CREATE POLICY tenant_instances_service_policy ON tenant_instances
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY tenant_quotas_service_policy ON tenant_quotas
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY tenant_backups_service_policy ON tenant_backups
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY autoscale_events_service_policy ON autoscale_events
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY enforcement_events_service_policy ON enforcement_events
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- =============================================================================
-- ÍNDICES PARA PERFORMANCE
-- =============================================================================

-- Índices para tenant_instances
CREATE INDEX IF NOT EXISTS idx_tenant_instances_tenant_id ON tenant_instances(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_instances_mode ON tenant_instances(mode);
CREATE INDEX IF NOT EXISTS idx_tenant_instances_status ON tenant_instances(status);
CREATE INDEX IF NOT EXISTS idx_tenant_instances_subdomain ON tenant_instances(subdomain);
CREATE INDEX IF NOT EXISTS idx_tenant_instances_updated_at ON tenant_instances(updated_at);

-- Índices para eventos (queries frecuentes por fecha)
CREATE INDEX IF NOT EXISTS idx_autoscale_events_tenant_created ON autoscale_events(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_enforcement_events_tenant_created ON enforcement_events(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_enforcement_events_status ON enforcement_events(status) WHERE status = 'active';

-- Índices para backups
CREATE INDEX IF NOT EXISTS idx_tenant_backups_tenant_id ON tenant_backups(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_backups_created_at ON tenant_backups(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tenant_backups_retention ON tenant_backups(retention_until) WHERE retention_until < NOW();

-- =============================================================================
-- DATOS INICIALES / SEEDS
-- =============================================================================

-- Insertar configuración por defecto para quotas según plan
INSERT INTO tenant_quotas (tenant_id, executions_monthly, concurrent_executions, cpu_limit_percent, memory_limit_mb, storage_limit_gb, stripe_product_id)
VALUES 
  ('default-starter', 1000, 2, 50, 512, 1, 'price_starter'),
  ('default-pro', 10000, 10, 100, 2048, 10, 'price_pro'),
  ('default-enterprise', 100000, 50, 200, 8192, 100, 'price_enterprise')
ON CONFLICT (tenant_id) DO NOTHING;

-- Comentarios para documentación
COMMENT ON TABLE tenant_instances IS 'Instancias de tenants (shared y dedicated) administradas por el orchestrator';
COMMENT ON TABLE tenant_quotas IS 'Límites y quotas por tenant sincronizados con Stripe entitlements';
COMMENT ON TABLE tenant_backups IS 'Registro de backups con ubicaciones S3 y metadatos de restore';
COMMENT ON TABLE autoscale_events IS 'Eventos de auto-scaling basados en métricas de performance';
COMMENT ON TABLE enforcement_events IS 'Eventos de aplicación de límites y violaciones de quota';

COMMENT ON VIEW tenant_metrics IS 'Vista agregada de métricas operativas por tenant';
COMMENT ON VIEW tenant_costs IS 'Vista de costos estimados de infraestructura por tenant';

-- Finalización
SELECT 'Orchestrator schema migration completed successfully' AS status;