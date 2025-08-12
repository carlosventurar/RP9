-- =============================================
-- PHASE 6: OBSERVABILIDAD & SEGURIDAD
-- Migración SQL para soporte de métricas, RLS y seguridad
-- =============================================

-- Crear tabla para rate limiting
CREATE TABLE IF NOT EXISTS public.rate_limits (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    key TEXT NOT NULL,
    requests INTEGER DEFAULT 1,
    window_start BIGINT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(key, window_start)
);

-- Crear tabla para logs de seguridad
CREATE TABLE IF NOT EXISTS public.security_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_type TEXT NOT NULL,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    ip_address INET,
    user_agent TEXT,
    details JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Crear tabla para health snapshots (métricas históricas)
CREATE TABLE IF NOT EXISTS public.health_snapshots (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    executions_total INTEGER DEFAULT 0,
    executions_success INTEGER DEFAULT 0,
    executions_error INTEGER DEFAULT 0,
    error_rate DECIMAL(5,2) DEFAULT 0,
    avg_execution_time DECIMAL(10,2) DEFAULT 0,
    workflows_active INTEGER DEFAULT 0,
    health_score INTEGER DEFAULT 0,
    timeframe TEXT DEFAULT '24h',
    snapshot_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Crear tabla para rotación de claves API
CREATE TABLE IF NOT EXISTS public.api_key_rotations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    old_key_hash TEXT,
    new_key_hash TEXT NOT NULL,
    rotation_reason TEXT DEFAULT 'scheduled',
    rotated_by UUID REFERENCES auth.users(id),
    rotated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- =============================================
-- CONFIGURAR RLS (ROW LEVEL SECURITY)
-- =============================================

-- Habilitar RLS en todas las tablas principales
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_key_rotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_logs ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para tenants
DROP POLICY IF EXISTS "Users can view their own tenant" ON public.tenants;
CREATE POLICY "Users can view their own tenant" ON public.tenants
    FOR SELECT USING (
        owner_user_id = auth.uid() OR
        id IN (
            SELECT tenant_id FROM public.tenant_members 
            WHERE user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can update their own tenant" ON public.tenants;
CREATE POLICY "Users can update their own tenant" ON public.tenants
    FOR UPDATE USING (owner_user_id = auth.uid());

-- Políticas RLS para subscriptions
DROP POLICY IF EXISTS "Users can view their tenant subscriptions" ON public.subscriptions;
CREATE POLICY "Users can view their tenant subscriptions" ON public.subscriptions
    FOR SELECT USING (
        tenant_id IN (
            SELECT id FROM public.tenants WHERE owner_user_id = auth.uid()
            UNION
            SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()
        )
    );

-- Políticas RLS para usage_executions
DROP POLICY IF EXISTS "Users can view their tenant executions" ON public.usage_executions;
CREATE POLICY "Users can view their tenant executions" ON public.usage_executions
    FOR SELECT USING (
        tenant_id IN (
            SELECT id FROM public.tenants WHERE owner_user_id = auth.uid()
            UNION
            SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Service role can insert executions" ON public.usage_executions;
CREATE POLICY "Service role can insert executions" ON public.usage_executions
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can update executions" ON public.usage_executions;
CREATE POLICY "Service role can update executions" ON public.usage_executions
    FOR UPDATE USING (true);

-- Políticas RLS para audit_logs
DROP POLICY IF EXISTS "Users can view their tenant audit logs" ON public.audit_logs;
CREATE POLICY "Users can view their tenant audit logs" ON public.audit_logs
    FOR SELECT USING (
        tenant_id IN (
            SELECT id FROM public.tenants WHERE owner_user_id = auth.uid()
            UNION
            SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()
        )
    );

-- Políticas RLS para health_snapshots
DROP POLICY IF EXISTS "Users can view their tenant health snapshots" ON public.health_snapshots;
CREATE POLICY "Users can view their tenant health snapshots" ON public.health_snapshots
    FOR SELECT USING (
        tenant_id IN (
            SELECT id FROM public.tenants WHERE owner_user_id = auth.uid()
            UNION
            SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Service role can manage health snapshots" ON public.health_snapshots;
CREATE POLICY "Service role can manage health snapshots" ON public.health_snapshots
    FOR ALL USING (true);

-- Políticas RLS para api_key_rotations
DROP POLICY IF EXISTS "Users can view their tenant API key rotations" ON public.api_key_rotations;
CREATE POLICY "Users can view their tenant API key rotations" ON public.api_key_rotations
    FOR SELECT USING (
        tenant_id IN (
            SELECT id FROM public.tenants WHERE owner_user_id = auth.uid()
            UNION
            SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()
        )
    );

-- Políticas RLS para security_logs
DROP POLICY IF EXISTS "Users can view their tenant security logs" ON public.security_logs;
CREATE POLICY "Users can view their tenant security logs" ON public.security_logs
    FOR SELECT USING (
        tenant_id IN (
            SELECT id FROM public.tenants WHERE owner_user_id = auth.uid()
            UNION
            SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Service role can manage security logs" ON public.security_logs;
CREATE POLICY "Service role can manage security logs" ON public.security_logs
    FOR ALL USING (true);

-- Rate limits no necesita RLS (es sistema global)
-- =============================================
-- ÍNDICES PARA PERFORMANCE
-- =============================================

-- Índices para rate_limits
CREATE INDEX IF NOT EXISTS idx_rate_limits_key_window ON public.rate_limits(key, window_start);
CREATE INDEX IF NOT EXISTS idx_rate_limits_window_start ON public.rate_limits(window_start);

-- Índices para security_logs
CREATE INDEX IF NOT EXISTS idx_security_logs_tenant_id ON public.security_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_security_logs_event_type ON public.security_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_security_logs_created_at ON public.security_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_logs_ip_address ON public.security_logs(ip_address);

-- Índices para health_snapshots
CREATE INDEX IF NOT EXISTS idx_health_snapshots_tenant_id ON public.health_snapshots(tenant_id);
CREATE INDEX IF NOT EXISTS idx_health_snapshots_snapshot_at ON public.health_snapshots(snapshot_at DESC);
CREATE INDEX IF NOT EXISTS idx_health_snapshots_timeframe ON public.health_snapshots(timeframe);

-- Índices para api_key_rotations
CREATE INDEX IF NOT EXISTS idx_api_key_rotations_tenant_id ON public.api_key_rotations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_api_key_rotations_rotated_at ON public.api_key_rotations(rotated_at DESC);

-- Mejorar índices existentes
CREATE INDEX IF NOT EXISTS idx_usage_executions_tenant_created ON public.usage_executions(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_executions_status ON public.usage_executions(status);
CREATE INDEX IF NOT EXISTS idx_usage_executions_workflow_id ON public.usage_executions(workflow_id);

-- =============================================
-- FUNCIONES Y TRIGGERS
-- =============================================

-- Función para limpiar rate limits expirados
CREATE OR REPLACE FUNCTION cleanup_expired_rate_limits()
RETURNS void AS $$
BEGIN
    DELETE FROM public.rate_limits 
    WHERE window_start < EXTRACT(epoch FROM NOW() - INTERVAL '2 hours');
END;
$$ LANGUAGE plpgsql;

-- Función para calcular health snapshots
CREATE OR REPLACE FUNCTION calculate_tenant_health_snapshot(tenant_uuid UUID, timeframe_param TEXT DEFAULT '24h')
RETURNS JSON AS $$
DECLARE
    result JSON;
    hours_back INTEGER;
    cutoff_time TIMESTAMP WITH TIME ZONE;
    total_executions INTEGER;
    success_executions INTEGER;
    error_executions INTEGER;
    avg_time DECIMAL;
    error_rate_calc DECIMAL;
BEGIN
    -- Determinar ventana de tiempo
    hours_back := CASE timeframe_param
        WHEN '1h' THEN 1
        WHEN '6h' THEN 6
        WHEN '12h' THEN 12
        WHEN '24h' THEN 24
        WHEN '7d' THEN 168
        WHEN '30d' THEN 720
        ELSE 24
    END;
    
    cutoff_time := NOW() - (hours_back || ' hours')::INTERVAL;
    
    -- Calcular métricas
    SELECT 
        COUNT(*),
        COUNT(*) FILTER (WHERE status = 'success'),
        COUNT(*) FILTER (WHERE status = 'error'),
        AVG(execution_time_ms)
    INTO total_executions, success_executions, error_executions, avg_time
    FROM public.usage_executions 
    WHERE tenant_id = tenant_uuid 
    AND created_at >= cutoff_time;
    
    -- Calcular error rate
    error_rate_calc := CASE 
        WHEN total_executions > 0 THEN (error_executions::DECIMAL / total_executions::DECIMAL) * 100
        ELSE 0
    END;
    
    -- Crear JSON result
    result := json_build_object(
        'tenant_id', tenant_uuid,
        'timeframe', timeframe_param,
        'total_executions', COALESCE(total_executions, 0),
        'success_executions', COALESCE(success_executions, 0),
        'error_executions', COALESCE(error_executions, 0),
        'error_rate', COALESCE(error_rate_calc, 0),
        'avg_execution_time', COALESCE(avg_time, 0),
        'calculated_at', NOW()
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger a rate_limits
DROP TRIGGER IF EXISTS update_rate_limits_updated_at ON public.rate_limits;
CREATE TRIGGER update_rate_limits_updated_at
    BEFORE UPDATE ON public.rate_limits
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- GRANTS DE PERMISOS
-- =============================================

-- Permisos para service role
GRANT ALL ON public.rate_limits TO service_role;
GRANT ALL ON public.security_logs TO service_role;
GRANT ALL ON public.health_snapshots TO service_role;
GRANT ALL ON public.api_key_rotations TO service_role;

-- Permisos para authenticated users (lectura con RLS)
GRANT SELECT ON public.security_logs TO authenticated;
GRANT SELECT ON public.health_snapshots TO authenticated;
GRANT SELECT ON public.api_key_rotations TO authenticated;

-- Permisos para funciones
GRANT EXECUTE ON FUNCTION cleanup_expired_rate_limits() TO service_role;
GRANT EXECUTE ON FUNCTION calculate_tenant_health_snapshot(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION calculate_tenant_health_snapshot(UUID, TEXT) TO authenticated;

-- =============================================
-- VISTA PARA DASHBOARD DE MÉTRICAS
-- =============================================

CREATE OR REPLACE VIEW public.dashboard_security_overview AS
SELECT 
    t.id as tenant_id,
    t.name as tenant_name,
    (
        SELECT COUNT(*) 
        FROM public.security_logs sl 
        WHERE sl.tenant_id = t.id 
        AND sl.created_at >= NOW() - INTERVAL '24 hours'
    ) as security_events_24h,
    (
        SELECT COUNT(*) 
        FROM public.security_logs sl 
        WHERE sl.tenant_id = t.id 
        AND sl.event_type = 'invalid_webhook_signature'
        AND sl.created_at >= NOW() - INTERVAL '24 hours'
    ) as invalid_signatures_24h,
    (
        SELECT COUNT(*)
        FROM public.usage_executions ue
        WHERE ue.tenant_id = t.id
        AND ue.created_at >= NOW() - INTERVAL '24 hours'
    ) as executions_24h,
    (
        SELECT COUNT(*)
        FROM public.usage_executions ue
        WHERE ue.tenant_id = t.id
        AND ue.status = 'error'
        AND ue.created_at >= NOW() - INTERVAL '24 hours'
    ) as failed_executions_24h,
    COALESCE(
        (
            SELECT AVG(execution_time_ms)
            FROM public.usage_executions ue
            WHERE ue.tenant_id = t.id
            AND ue.created_at >= NOW() - INTERVAL '24 hours'
            AND ue.execution_time_ms > 0
        ), 0
    ) as avg_execution_time_24h
FROM public.tenants t;

-- Grant para la vista
GRANT SELECT ON public.dashboard_security_overview TO authenticated;
GRANT SELECT ON public.dashboard_security_overview TO service_role;

-- =============================================
-- DATOS DE EJEMPLO Y CONFIGURACIÓN INICIAL
-- =============================================

-- Insertar configuración inicial si no existe
DO $$
BEGIN
    -- Esta migración está completa
    INSERT INTO public.migration_log (migration_name, applied_at) 
    VALUES ('007_phase6_observability_security', NOW())
    ON CONFLICT (migration_name) DO NOTHING;
    
    RAISE NOTICE 'Phase 6 Observability & Security migration completed successfully';
EXCEPTION WHEN OTHERS THEN
    -- Crear tabla de log si no existe
    CREATE TABLE IF NOT EXISTS public.migration_log (
        migration_name TEXT PRIMARY KEY,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    INSERT INTO public.migration_log (migration_name, applied_at) 
    VALUES ('007_phase6_observability_security', NOW());
    RAISE NOTICE 'Created migration_log and applied Phase 6 migration';
END $$;