-- RP9 Portal - Esquema Inicial de Base de Datos
-- Esta migración crea las tablas principales para la aplicación RP9 Portal

-- Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Crear tipos enum
CREATE TYPE plan_key AS ENUM ('inicial', 'profesional', 'empresarial', 'personalizado');
CREATE TYPE subscription_status AS ENUM ('activo', 'inactivo', 'vencido', 'cancelado', 'prueba');
CREATE TYPE execution_status AS ENUM ('exitoso', 'error', 'ejecutando', 'esperando', 'cancelado');

-- Tabla de inquilinos/tenants
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  plan plan_key DEFAULT 'inicial',
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  n8n_base_url TEXT,
  n8n_api_key TEXT,
  settings JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Crear políticas RLS para tenants
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Los usuarios pueden ver su propio tenant" ON tenants
  FOR SELECT USING (owner_user_id = auth.uid());

CREATE POLICY "Los usuarios pueden actualizar su propio tenant" ON tenants
  FOR UPDATE USING (owner_user_id = auth.uid());

CREATE POLICY "Los usuarios pueden insertar su propio tenant" ON tenants
  FOR INSERT WITH CHECK (owner_user_id = auth.uid());

-- Tabla de planes
CREATE TABLE plans (
  key plan_key PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  stripe_price_id TEXT,
  limits JSONB DEFAULT '{}',
  features JSONB DEFAULT '[]',
  price_monthly INTEGER DEFAULT 0, -- en centavos
  price_yearly INTEGER DEFAULT 0, -- en centavos
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insertar planes predeterminados
INSERT INTO plans (key, name, description, limits, features, price_monthly, price_yearly) VALUES
('inicial', 'Plan Inicial', 'Perfecto para equipos pequeños que están comenzando', 
 '{"executions_per_month": 1000, "workflows": 10, "history_days": 30}',
 '["Flujos básicos", "Soporte estándar", "Historial de 30 días"]',
 0, 0),
('profesional', 'Plan Profesional', 'Para empresas en crecimiento con necesidades avanzadas',
 '{"executions_per_month": 10000, "workflows": 100, "history_days": 90}',
 '["Flujos avanzados", "Soporte prioritario", "Historial de 90 días", "Integraciones personalizadas"]',
 2900, 29000),
('empresarial', 'Plan Empresarial', 'Para organizaciones grandes con requisitos personalizados',
 '{"executions_per_month": -1, "workflows": -1, "history_days": 365}',
 '["Flujos ilimitados", "Soporte 24/7", "Historial de 1 año", "SSO", "Soporte dedicado"]',
 9900, 99000);

-- Tabla de suscripciones
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  status subscription_status DEFAULT 'activo',
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  trial_end TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Crear políticas RLS para suscripciones
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Los usuarios pueden ver las suscripciones de su tenant" ON subscriptions
  FOR SELECT USING (
    tenant_id IN (SELECT id FROM tenants WHERE owner_user_id = auth.uid())
  );

-- Tabla de ejecuciones de uso
CREATE TABLE usage_executions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  workflow_id TEXT NOT NULL,
  execution_id TEXT NOT NULL UNIQUE,
  workflow_name TEXT,
  status execution_status NOT NULL,
  started_at TIMESTAMPTZ,
  stopped_at TIMESTAMPTZ,
  duration_ms BIGINT,
  node_count INTEGER DEFAULT 0,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Crear índices para usage_executions
CREATE INDEX idx_usage_executions_tenant_date ON usage_executions(tenant_id, created_at DESC);
CREATE INDEX idx_usage_executions_workflow ON usage_executions(tenant_id, workflow_id, created_at DESC);
CREATE INDEX idx_usage_executions_status ON usage_executions(tenant_id, status, created_at DESC);

-- Crear políticas RLS para usage_executions
ALTER TABLE usage_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Los usuarios pueden ver el uso de su tenant" ON usage_executions
  FOR SELECT USING (
    tenant_id IN (SELECT id FROM tenants WHERE owner_user_id = auth.uid())
  );

-- Tabla de plantillas
CREATE TABLE templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'general',
  subcategory TEXT,
  workflow_json JSONB NOT NULL,
  icon_url TEXT,
  preview_images TEXT[] DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  difficulty TEXT DEFAULT 'principiante', -- principiante, intermedio, avanzado
  estimated_time INTEGER DEFAULT 5, -- en minutos
  price INTEGER DEFAULT 0, -- en centavos, 0 para gratis
  install_count INTEGER DEFAULT 0,
  rating DECIMAL(3,2) DEFAULT 0.0,
  is_featured BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  author_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Crear índices para plantillas
CREATE INDEX idx_templates_category ON templates(category, subcategory);
CREATE INDEX idx_templates_featured ON templates(is_featured, created_at DESC);
CREATE INDEX idx_templates_popular ON templates(install_count DESC, rating DESC);

-- Tabla de instalaciones de plantillas
CREATE TABLE template_installs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  workflow_id TEXT NOT NULL,
  workflow_name TEXT,
  metadata JSONB DEFAULT '{}',
  installed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, template_id, workflow_id)
);

-- Crear políticas RLS para template_installs
ALTER TABLE template_installs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Los usuarios pueden ver las instalaciones de su tenant" ON template_installs
  FOR SELECT USING (
    tenant_id IN (SELECT id FROM tenants WHERE owner_user_id = auth.uid())
  );

-- Tabla de logs de auditoría
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  resource TEXT NOT NULL,
  resource_id TEXT,
  ip_address TEXT,
  user_agent TEXT,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Crear índices para audit_logs
CREATE INDEX idx_audit_logs_tenant_date ON audit_logs(tenant_id, created_at DESC);
CREATE INDEX idx_audit_logs_action ON audit_logs(tenant_id, action, created_at DESC);
CREATE INDEX idx_audit_logs_resource ON audit_logs(tenant_id, resource, created_at DESC);

-- Crear políticas RLS para audit_logs
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Los usuarios pueden ver los logs de auditoría de su tenant" ON audit_logs
  FOR SELECT USING (
    tenant_id IN (SELECT id FROM tenants WHERE owner_user_id = auth.uid())
  );

-- Crear vista de métricas del dashboard
CREATE OR REPLACE VIEW dashboard_metrics_24h AS
SELECT 
  tenant_id,
  COUNT(*) as total_executions,
  COUNT(*) FILTER (WHERE status = 'exitoso') as successful_executions,
  COUNT(*) FILTER (WHERE status = 'error') as failed_executions,
  ROUND(
    (COUNT(*) FILTER (WHERE status = 'exitoso')::DECIMAL / COUNT(*)) * 100, 2
  ) as success_rate,
  ROUND(AVG(duration_ms)::DECIMAL / 1000, 2) as avg_duration_seconds,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms) / 1000 as p95_duration_seconds,
  COUNT(DISTINCT workflow_id) as active_workflows
FROM usage_executions 
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY tenant_id;

-- Insertar plantillas de ejemplo
INSERT INTO templates (name, description, category, workflow_json, tags, difficulty, estimated_time) VALUES
('Notificación por Email', 'Enviar notificaciones por correo cuando ocurran eventos específicos', 'notificaciones', 
 '{"nodes":[{"id":"1","name":"Activador Manual","type":"n8n-nodes-base.manualTrigger","typeVersion":1,"position":[250,300],"parameters":{}},{"id":"2","name":"Correo Electrónico","type":"n8n-nodes-base.emailSend","typeVersion":2,"position":[450,300],"parameters":{"message":"¡Hola desde RP9!"}}],"connections":{"Activador Manual":{"main":[[{"node":"Correo Electrónico","type":"main","index":0}]]}}}',
 ARRAY['email', 'notificación', 'básico'], 'principiante', 5),
 
('API HTTP a Slack', 'Reenviar peticiones HTTP a canales de Slack', 'integraciones',
 '{"nodes":[{"id":"1","name":"Webhook","type":"n8n-nodes-base.webhook","typeVersion":1,"position":[250,300],"parameters":{}},{"id":"2","name":"Slack","type":"n8n-nodes-base.slack","typeVersion":2,"position":[450,300],"parameters":{"channel":"#general","text":"Nueva petición webhook recibida"}}],"connections":{"Webhook":{"main":[[{"node":"Slack","type":"main","index":0}]]}}}',
 ARRAY['webhook', 'slack', 'api'], 'intermedio', 10),
 
('Respaldo de Base de Datos', 'Respaldo automático diario de base de datos a almacenamiento en la nube', 'datos',
 '{"nodes":[{"id":"1","name":"Cron","type":"n8n-nodes-base.cron","typeVersion":1,"position":[250,300],"parameters":{"triggerTimes":{"hour":2,"minute":0}}},{"id":"2","name":"PostgreSQL","type":"n8n-nodes-base.postgres","typeVersion":2,"position":[450,300],"parameters":{"operation":"executeQuery","query":"BACKUP DATABASE"}}],"connections":{"Cron":{"main":[[{"node":"PostgreSQL","type":"main","index":0}]]}}}',
 ARRAY['base de datos', 'respaldo', 'automatización'], 'avanzado', 15),

('Procesamiento de Formularios', 'Procesar formularios web y enviar datos a múltiples destinos', 'formularios',
 '{"nodes":[{"id":"1","name":"Webhook de Formulario","type":"n8n-nodes-base.webhook","typeVersion":1,"position":[250,300],"parameters":{}},{"id":"2","name":"Validar Datos","type":"n8n-nodes-base.function","typeVersion":1,"position":[450,300],"parameters":{"functionCode":"// Validar campos del formulario\nif (!items[0].json.email || !items[0].json.name) {\n  throw new Error(\"Email y nombre son requeridos\");\n}\nreturn items;"}},{"id":"3","name":"Guardar en Base de Datos","type":"n8n-nodes-base.postgres","typeVersion":2,"position":[650,300],"parameters":{}}],"connections":{"Webhook de Formulario":{"main":[[{"node":"Validar Datos","type":"main","index":0}]]}, "Validar Datos":{"main":[[{"node":"Guardar en Base de Datos","type":"main","index":0}]]}}}',
 ARRAY['formulario', 'validación', 'base de datos'], 'intermedio', 12),

('Monitoreo de Sitio Web', 'Monitorear disponibilidad de sitio web y enviar alertas', 'monitoreo',
 '{"nodes":[{"id":"1","name":"Temporizador","type":"n8n-nodes-base.cron","typeVersion":1,"position":[250,300],"parameters":{"triggerTimes":{"minute":5}}},{"id":"2","name":"HTTP Request","type":"n8n-nodes-base.httpRequest","typeVersion":3,"position":[450,300],"parameters":{"url":"https://ejemplo.com","method":"GET"}},{"id":"3","name":"Verificar Estado","type":"n8n-nodes-base.if","typeVersion":1,"position":[650,300],"parameters":{"conditions":{"number":[{"value1":"{{$json.statusCode}}","operation":"notEqual","value2":200}]}}},{"id":"4","name":"Enviar Alerta","type":"n8n-nodes-base.emailSend","typeVersion":2,"position":[850,200],"parameters":{"message":"¡Sitio web no disponible!"}}],"connections":{"Temporizador":{"main":[[{"node":"HTTP Request","type":"main","index":0}]]}, "HTTP Request":{"main":[[{"node":"Verificar Estado","type":"main","index":0}]]}, "Verificar Estado":{"main":[[{"node":"Enviar Alerta","type":"main","index":0}],[]]}}}',
 ARRAY['monitoreo', 'sitio web', 'alerta'], 'intermedio', 8),

('Sincronización CRM', 'Sincronizar contactos entre diferentes sistemas CRM', 'crm',
 '{"nodes":[{"id":"1","name":"Activador Programado","type":"n8n-nodes-base.cron","typeVersion":1,"position":[250,300],"parameters":{"triggerTimes":{"hour":1,"minute":0}}},{"id":"2","name":"Obtener Contactos CRM1","type":"n8n-nodes-base.httpRequest","typeVersion":3,"position":[450,300],"parameters":{"url":"https://crm1.ejemplo.com/api/contacts","method":"GET"}},{"id":"3","name":"Transformar Datos","type":"n8n-nodes-base.function","typeVersion":1,"position":[650,300],"parameters":{"functionCode":"// Transformar formato de datos\nreturn items.map(item => ({\n  json: {\n    nombre: item.json.name,\n    email: item.json.email_address,\n    telefono: item.json.phone\n  }\n}));"}},{"id":"4","name":"Enviar a CRM2","type":"n8n-nodes-base.httpRequest","typeVersion":3,"position":[850,300],"parameters":{"url":"https://crm2.ejemplo.com/api/contacts","method":"POST"}}],"connections":{"Activador Programado":{"main":[[{"node":"Obtener Contactos CRM1","type":"main","index":0}]]}, "Obtener Contactos CRM1":{"main":[[{"node":"Transformar Datos","type":"main","index":0}]]}, "Transformar Datos":{"main":[[{"node":"Enviar a CRM2","type":"main","index":0}]]}}}',
 ARRAY['crm', 'sincronización', 'contactos'], 'avanzado', 20);

-- Función para actualizar contador de instalaciones de plantillas
CREATE OR REPLACE FUNCTION update_template_install_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE templates 
    SET install_count = install_count + 1 
    WHERE id = NEW.template_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE templates 
    SET install_count = GREATEST(0, install_count - 1) 
    WHERE id = OLD.template_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_template_install_count
  AFTER INSERT OR DELETE ON template_installs
  FOR EACH ROW EXECUTE FUNCTION update_template_install_count();

-- Crear función de trigger para updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar triggers de updated_at a las tablas relevantes
CREATE TRIGGER trigger_tenants_updated_at
  BEFORE UPDATE ON tenants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_plans_updated_at
  BEFORE UPDATE ON plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_templates_updated_at
  BEFORE UPDATE ON templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();