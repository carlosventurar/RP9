-- RP9 Fase 10: Soporte, SLAs & Customer Success
-- Migration: 011_support_cs.sql
-- Date: 2025-08-13

-- ============================================================================
-- SUPPORT PLANS & SLA MATRIX
-- ============================================================================

-- Planes de soporte disponibles
create table if not exists support_plans (
  key text primary key,               -- starter|pro|enterprise
  name_es text not null,              -- Nombre en español
  name_en text not null,              -- Nombre en inglés
  channels jsonb not null,            -- ["email","chat","slack"] 
  frt_minutes int not null,           -- objetivo de 1ª respuesta (plan baseline)
  support_hours text not null,       -- "8x5"|"24x5"|"24x7"
  escalation_enabled boolean default false,
  created_at timestamptz default now()
);

-- Matriz de SLA por plan y severidad
create table if not exists sla_matrix (
  id uuid primary key default gen_random_uuid(),
  plan_key text references support_plans(key) on delete cascade,
  severity text not null,             -- P1|P2|P3
  frt_minutes int not null,           -- tiempo primera respuesta
  restore_minutes int not null,       -- tiempo de resolución objetivo
  description_es text,                -- descripción severidad en español
  description_en text,                -- descripción severidad en inglés
  created_at timestamptz default now(),
  unique(plan_key, severity)
);

-- ============================================================================
-- TICKETS & SUPPORT
-- ============================================================================

-- Tickets de soporte
create table if not exists tickets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  subject text not null,
  description text,
  severity text not null,             -- P1|P2|P3
  channel text not null,              -- email|chat|slack
  status text not null default 'open',-- open|in_progress|waiting|resolved|closed
  priority text default 'medium',     -- low|medium|high|urgent
  assignee text,                      -- email del agente asignado
  hubspot_ticket_id text,             -- id externo de HubSpot
  tags text[] default '{}',           -- tags para categorización
  metadata jsonb default '{}',        -- datos adicionales flexibles
  first_response_at timestamptz,      -- timestamp primera respuesta
  resolved_at timestamptz,            -- timestamp resolución
  created_by uuid,                    -- usuario que creó el ticket
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Índices para performance
create index if not exists idx_tickets_tenant on tickets(tenant_id, created_at desc);
create index if not exists idx_tickets_status on tickets(status, severity);
create index if not exists idx_tickets_assignee on tickets(assignee, status);

-- Eventos/historial de tickets
create table if not exists ticket_events (
  id bigserial primary key,
  ticket_id uuid references tickets(id) on delete cascade,
  at timestamptz default now(),
  type text not null,                 -- status_change|note|assignment|escalation
  by_user text,                       -- quien hizo el cambio
  meta jsonb default '{}',            -- detalles del evento
  old_value text,                     -- valor anterior
  new_value text                      -- valor nuevo
);

create index if not exists idx_ticket_events_ticket on ticket_events(ticket_id, at desc);

-- ============================================================================
-- INCIDENTS & STATUS
-- ============================================================================

-- Incidentes del sistema
create table if not exists incidents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid,                     -- null para incidentes globales
  title text not null,
  description text,
  severity text not null,             -- P1|P2|P3
  status text not null default 'investigating', -- investigating|identified|monitoring|resolved
  impact text,                        -- descripción del impacto
  affected_services text[] default '{}', -- servicios afectados
  eta timestamptz,                    -- tiempo estimado de resolución
  status_provider_id text,            -- ID en Statuspage/BetterStack
  postmortem_required boolean default false,
  postmortem_completed boolean default false,
  created_by uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_incidents_status on incidents(status, severity);
create index if not exists idx_incidents_tenant on incidents(tenant_id, created_at desc);

-- Actualizaciones de incidentes
create table if not exists incident_updates (
  id bigserial primary key,
  incident_id uuid references incidents(id) on delete cascade,
  at timestamptz default now(),
  status text not null,               -- mismo enum que incidents.status
  message text not null,
  by_user text,                       -- quien hizo la actualización
  published_externally boolean default false -- si se publicó en status page
);

create index if not exists idx_incident_updates_incident on incident_updates(incident_id, at desc);

-- ============================================================================
-- RCA & POSTMORTEM
-- ============================================================================

-- Documentos RCA (Root Cause Analysis)
create table if not exists rca_docs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid,
  incident_id uuid references incidents(id) on delete set null,
  title text not null,
  status text default 'draft',        -- draft|in_review|approved|published
  md_path text,                       -- Storage key del markdown
  pdf_path text,                      -- Storage key del PDF generado
  template_used text,                 -- template utilizado
  owner uuid,                         -- responsable del RCA
  reviewers text[] default '{}',      -- lista de revisores
  due_date timestamptz,
  approved_at timestamptz,
  published_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_rca_tenant on rca_docs(tenant_id, created_at desc);
create index if not exists idx_rca_incident on rca_docs(incident_id);

-- ============================================================================
-- KNOWLEDGE BASE
-- ============================================================================

-- Artículos de base de conocimiento
create table if not exists kb_articles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid,                     -- null = público, uuid = específico tenant
  slug text unique not null,
  title text not null,
  excerpt text,                       -- resumen del artículo
  category text,                      -- categoría del artículo
  tags text[] default '{}',
  mdx_path text not null,             -- ruta al archivo MDX
  author text,                        -- autor del artículo
  status text default 'published',    -- draft|published|archived
  language text default 'es',         -- idioma del artículo
  views_count int default 0,          -- contador de visualizaciones
  helpful_count int default 0,        -- votos positivos
  not_helpful_count int default 0,    -- votos negativos
  last_updated_by text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_kb_status_lang on kb_articles(status, language);
create index if not exists idx_kb_category on kb_articles(category, status);
create index if not exists idx_kb_tenant on kb_articles(tenant_id, status);

-- Feedback de artículos KB
create table if not exists kb_feedback (
  id bigserial primary key,
  article_id uuid references kb_articles(id) on delete cascade,
  rating int check (rating between 1 and 5), -- 1-5 estrellas
  is_helpful boolean,                 -- true/false para ¿útil?
  comment text,
  user_email text,                    -- opcional para seguimiento
  user_agent text,                    -- para analytics
  ip_address inet,                    -- para prevenir spam
  created_at timestamptz default now()
);

create index if not exists idx_kb_feedback_article on kb_feedback(article_id, created_at desc);

-- ============================================================================
-- CUSTOMER SUCCESS
-- ============================================================================

-- Health Scores de tenants
create table if not exists cs_health_scores (
  id bigserial primary key,
  tenant_id uuid not null,
  score int not null check (score between 0 and 100), -- score final 0-100
  breakdown jsonb not null,           -- {usage: 80, success: 90, incidents: 70, nps: 85}
  risk_level text not null,           -- green|yellow|red
  factors jsonb default '{}',         -- factores que influyeron en el score
  recommendations text[] default '{}', -- recomendaciones para mejorar
  calculated_by text default 'system', -- system|manual
  notes text,                         -- notas adicionales
  created_at timestamptz default now()
);

create index if not exists idx_health_tenant on cs_health_scores(tenant_id, created_at desc);
create index if not exists idx_health_risk on cs_health_scores(risk_level, score);

-- QBR/EBR (Quarterly/Executive Business Reviews)
create table if not exists qbrs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  type text not null,                 -- qbr|ebr
  scheduled_for timestamptz not null,
  duration_minutes int default 60,
  status text default 'scheduled',    -- scheduled|completed|cancelled|rescheduled
  agenda jsonb default '{}',          -- agenda estructurada
  notes text,                         -- notas de la reunión
  action_items jsonb default '[]',    -- action items con responsables
  attendees jsonb default '[]',       -- lista de asistentes
  meeting_link text,                  -- enlace Zoom/Meet
  recording_url text,                 -- grabación si existe
  summary_sent boolean default false,
  follow_up_due timestamptz,
  created_by text,
  completed_by text,
  completed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_qbrs_tenant on qbrs(tenant_id, scheduled_for desc);
create index if not exists idx_qbrs_status on qbrs(status, scheduled_for);

-- ============================================================================
-- RENEWALS & RETENTION
-- ============================================================================

-- Renovaciones y gestión de contratos
create table if not exists renewals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  current_plan text not null,         -- plan actual
  contract_start date not null,
  contract_end date not null,
  renew_on date not null,
  annual_value numeric(10,2),         -- valor anual del contrato
  status text default 'pending',      -- pending|reminded_60|reminded_30|reminded_15|renewed|churned|cancelled
  renewal_probability int,            -- 0-100 probabilidad de renovación
  churn_risk_factors text[] default '{}', -- factores de riesgo
  notes text,
  assigned_csm text,                  -- Customer Success Manager asignado
  last_contact_date timestamptz,
  next_action text,
  next_action_due timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_renewals_tenant on renewals(tenant_id, renew_on);
create index if not exists idx_renewals_status on renewals(status, renew_on);

-- Historial de dunning (cobranza)
create table if not exists dunning_history (
  id bigserial primary key,
  tenant_id uuid not null,
  renewal_id uuid references renewals(id) on delete cascade,
  attempt_number int not null,        -- 1, 2, 3
  method text not null,               -- email|phone|letter
  status text not null,               -- sent|delivered|bounced|responded
  message_template text,
  sent_at timestamptz default now(),
  response_received boolean default false,
  response_at timestamptz,
  notes text
);

-- ============================================================================
-- FEATURE REQUESTS & FEEDBACK
-- ============================================================================

-- Feature requests del portal público
create table if not exists feature_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid,                     -- null = público, uuid = específico
  title text not null,
  description text not null,
  category text,                      -- ui|api|integration|performance|security
  votes int default 0,
  status text default 'new',          -- new|planned|in_progress|done|rejected
  priority text default 'medium',     -- low|medium|high|critical
  impact text,                        -- descripción del impacto esperado
  effort_estimate text,               -- small|medium|large|xl
  arr_impact numeric(10,2),           -- impacto estimado en ARR
  target_release text,                -- versión objetivo
  assignee text,                      -- quien lo está trabajando
  created_by_email text,              -- email del solicitante
  internal_notes text,                -- notas internas no visibles
  external_notes text,                -- notas visibles para usuarios
  labels text[] default '{}',         -- etiquetas flexibles
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_feature_requests_status on feature_requests(status, priority);
create index if not exists idx_feature_requests_votes on feature_requests(votes desc);
create index if not exists idx_feature_requests_tenant on feature_requests(tenant_id, created_at desc);

-- Votos en feature requests
create table if not exists feature_request_votes (
  id bigserial primary key,
  request_id uuid references feature_requests(id) on delete cascade,
  user_email text not null,
  vote_type text default 'up',        -- up|down
  ip_address inet,
  user_agent text,
  created_at timestamptz default now(),
  unique(request_id, user_email)
);

-- ============================================================================
-- NPS & CSAT SURVEYS
-- ============================================================================

-- Encuestas NPS/CSAT
create table if not exists surveys (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  type text not null,                 -- nps|csat|ces
  trigger_event text,                 -- quarterly|post_ticket|post_workflow|manual
  target_email text not null,
  survey_data jsonb not null,         -- preguntas y configuración
  sent_at timestamptz,
  completed_at timestamptz,
  score int,                          -- 0-10 para NPS, 1-5 para CSAT
  feedback_text text,
  follow_up_required boolean default false,
  follow_up_completed boolean default false,
  created_at timestamptz default now()
);

create index if not exists idx_surveys_tenant on surveys(tenant_id, type, created_at desc);
create index if not exists idx_surveys_score on surveys(score, type) where completed_at is not null;

-- ============================================================================
-- SYSTEM DATA & CONFIGURATION
-- ============================================================================

-- Configuración del sistema de soporte
create table if not exists support_config (
  key text primary key,
  value jsonb not null,
  description text,
  updated_by text,
  updated_at timestamptz default now()
);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Habilitar RLS en tablas principales
alter table tickets enable row level security;
alter table incidents enable row level security;
alter table cs_health_scores enable row level security;
alter table qbrs enable row level security;
alter table renewals enable row level security;
alter table surveys enable row level security;

-- Políticas básicas por tenant
create policy tickets_by_tenant on tickets
  using (
    tenant_id::text = current_setting('request.jwt.claims', true)::jsonb->>'tenant_id'
    or current_setting('request.jwt.claims', true)::jsonb->>'role' = 'internal'
  );

create policy incidents_by_tenant on incidents
  using (
    tenant_id::text = current_setting('request.jwt.claims', true)::jsonb->>'tenant_id'
    or tenant_id is null  -- incidentes globales visibles para todos
    or current_setting('request.jwt.claims', true)::jsonb->>'role' = 'internal'
  );

create policy health_by_tenant on cs_health_scores
  using (
    tenant_id::text = current_setting('request.jwt.claims', true)::jsonb->>'tenant_id'
    or current_setting('request.jwt.claims', true)::jsonb->>'role' = 'internal'
  );

create policy qbrs_by_tenant on qbrs
  using (
    tenant_id::text = current_setting('request.jwt.claims', true)::jsonb->>'tenant_id'
    or current_setting('request.jwt.claims', true)::jsonb->>'role' = 'internal'
  );

create policy renewals_by_tenant on renewals
  using (
    tenant_id::text = current_setting('request.jwt.claims', true)::jsonb->>'tenant_id'
    or current_setting('request.jwt.claims', true)::jsonb->>'role' = 'internal'
  );

create policy surveys_by_tenant on surveys
  using (
    tenant_id::text = current_setting('request.jwt.claims', true)::jsonb->>'tenant_id'
    or current_setting('request.jwt.claims', true)::jsonb->>'role' = 'internal'
  );

-- ============================================================================
-- INITIAL DATA
-- ============================================================================

-- Insertar planes de soporte predefinidos
insert into support_plans (key, name_es, name_en, channels, frt_minutes, support_hours) values
  ('starter', 'Básico', 'Starter', '["email"]', 480, '8x5'),  -- 8 horas
  ('pro', 'Profesional', 'Professional', '["email", "chat"]', 240, '8x5'),  -- 4 horas
  ('enterprise', 'Empresarial', 'Enterprise', '["email", "chat", "slack"]', 60, '24x5')  -- 1 hora
on conflict (key) do nothing;

-- Insertar matriz SLA
insert into sla_matrix (plan_key, severity, frt_minutes, restore_minutes, description_es, description_en) values
  ('starter', 'P1', 480, 120, 'Crítico - Sistema no funcional', 'Critical - System down'),
  ('starter', 'P2', 480, 480, 'Alto - Funcionalidad importante afectada', 'High - Important feature affected'),
  ('starter', 'P3', 480, 2880, 'Medio - Problema menor o consulta', 'Medium - Minor issue or question'),
  
  ('pro', 'P1', 240, 120, 'Crítico - Sistema no funcional', 'Critical - System down'),
  ('pro', 'P2', 240, 480, 'Alto - Funcionalidad importante afectada', 'High - Important feature affected'),
  ('pro', 'P3', 240, 2880, 'Medio - Problema menor o consulta', 'Medium - Minor issue or question'),
  
  ('enterprise', 'P1', 60, 120, 'Crítico - Sistema no funcional', 'Critical - System down'),
  ('enterprise', 'P2', 60, 480, 'Alto - Funcionalidad importante afectada', 'High - Important feature affected'),
  ('enterprise', 'P3', 60, 2880, 'Medio - Problema menor o consulta', 'Medium - Minor issue or question')
on conflict (plan_key, severity) do nothing;

-- Configuración inicial del sistema
insert into support_config (key, value, description) values
  ('business_hours', '{"start": "09:00", "end": "17:00", "timezone": "America/Mexico_City", "days": ["monday", "tuesday", "wednesday", "thursday", "friday"]}', 'Horario de atención de soporte'),
  ('escalation_rules', '{"p1_minutes": 30, "p2_minutes": 120, "p3_minutes": 1440}', 'Reglas de escalamiento automático'),
  ('notification_channels', '{"slack_webhook": "", "email_templates": {}}', 'Canales de notificación'),
  ('sla_thresholds', '{"warning": 80, "breach": 100}', 'Umbrales de alerta SLA (% del tiempo objetivo)')
on conflict (key) do nothing;

-- ============================================================================
-- TRIGGERS & FUNCTIONS
-- ============================================================================

-- Función para actualizar timestamp
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Triggers para updated_at
create trigger update_tickets_updated_at before update on tickets
  for each row execute function update_updated_at_column();

create trigger update_incidents_updated_at before update on incidents
  for each row execute function update_updated_at_column();

create trigger update_renewals_updated_at before update on renewals
  for each row execute function update_updated_at_column();

create trigger update_qbrs_updated_at before update on qbrs
  for each row execute function update_updated_at_column();

-- ============================================================================
-- COMMENTS
-- ============================================================================

comment on table support_plans is 'Planes de soporte disponibles (Starter, Pro, Enterprise)';
comment on table sla_matrix is 'Matriz de SLA por plan y severidad';
comment on table tickets is 'Tickets de soporte con integración HubSpot';
comment on table incidents is 'Incidentes del sistema con status page integration';
comment on table cs_health_scores is 'Health scores de Customer Success por tenant';
comment on table qbrs is 'Quarterly/Executive Business Reviews programados';
comment on table renewals is 'Gestión de renovaciones y retención';
comment on table feature_requests is 'Feature requests del portal público';
comment on table surveys is 'Encuestas NPS/CSAT/CES';
comment on table kb_articles is 'Base de conocimiento con artículos MDX';