
# RP9 — Fase 4: Seguridad, SRE & Compliance (Spec basada en decisiones)

**Fecha:** 2025-08-11T00:43:23.578418Z  

Esta especificación consolida tus respuestas para Fase 4 y entrega un **pack ejecutable** (SQL, Functions, CI, headers) listo para integrar en tu monorepo (GitHub + Netlify + Supabase + Stripe + n8n en Railway).

---

## 1) Decisiones confirmadas
- 1) **SLO**: 99.9% (error budget ≈ 43 min/mes).
- 2) **Error budget policy**: cuando quede **<30%** → congelar features grandes (solo fixes/hardening).
- 3) **Observabilidad**: **gestionada** (Grafana Cloud/Better Uptime). Scraping de `/metrics` de n8n.
- 4) **Alertas**: Slack + Email.
- 5) **Severidades**: **Sev1/Sev2/Sev3** con criterios.
- 6) **On‑call**: horario laboral **founder‑led**; migrar a 24/7 con MRR.
- 7) **Status Page**: pública gestionada (Instatus/Better Uptime).
- 8) **Backups**: diarios, retención 7–14 días.
- 9) **Cifrado**: TLS forzado + Storage SSE + secretos cifrados.
- 10) **Restore drills**: **mensuales** (tablas núcleo).
- 11) **Secretos**: variables de Netlify/Railway; **rotación cada 90 días**. (Migrar a Vault/Doppler cuando crezca el equipo).
- 12) **Perímetro**: **Cloudflare WAF + rate‑limit + BOT**.
- 13) **Auth**: Supabase Auth (email/Google) + **2FA**; **SSO/SAML Enterprise**.
- 14) **RBAC**: owner/admin/editor/viewer.
- 15) **Auditoría**: tabla `audit_log` **append‑only con hash‑chain** + export.
- 16) **Retención**: 30–90 días de payloads; **opción de anonimizar** por cliente.
- 17) **Clasificación**: Public/Interno/Confidencial/Regulado.
- 18) **Escaneo**: CodeQL + Dependabot + Trivy + SBOM (CycloneDX).
- 19) **Deploy**: Blue/Green (Netlify previews) + **feature flags**.
- 20) **Pentesting**: ahora bajo contrato Enterprise; **anual** cuando se cumpla meta de MRR.

---

## 2) Entregables del Pack
- **SQL Supabase**: `audit_log`, `data_retention`, `ip_allowlist` + políticas RLS base.
- **Netlify**: `netlify.toml` con **CSP, HSTS, COOP/CORP**, cache seguro y redirects.
- **Functions (TS)**: `healthcheck.ts`, `alerts-dispatch.ts`, `backup-run.ts`, `restore-sandbox.ts`.
- **GitHub Actions**: `security-codeql.yml`, `deps-trivy.yml`, `sbom.yml`.
- **Runbooks**: INCIDENT, BACKUP_RESTORE, ACCESS_REVIEW, DATA_RETENTION.
- **.env.example**: variables nuevas (observabilidad/Cloudflare/Backups).

> Descarga el ZIP y cópialo a la raíz de tu repo. Ejecuta la migración SQL en Supabase y despliega Functions en Netlify.

---

## 3) Backlog por sprints (4 semanas)

### Sprint 4.1 — Perímetro & Fundamentos
- Cloudflare delante de Netlify y Railway (WAF, TLS, rate‑limit).
- `netlify.toml` con **headers fuertes** (CSP/HSTS/COOP/CORP).
- Function `healthcheck.ts` + página `/status` en portal.
- RBAC (owner/admin/editor/viewer) en portal.

### Sprint 4.2 — Observabilidad & Alertas
- Grafana Cloud/Better Uptime: dashboards y alertas Slack/Email.
- Scraping `/metrics` de n8n; alertas error‑rate >2% (5m), p95>3s (10m).

### Sprint 4.3 — Backups & DR
- `backup-run.ts`: export workflows n8n + dump tablas núcleo → Storage.
- `restore-sandbox.ts`: restore mensual a schema sandbox + verificación.
- Runbook DR con **RTO 2h / RPO 24h**.

### Sprint 4.4 — Compliance & CI de seguridad
- `audit_log` con hash‑chain y endpoint de consulta.
- `data_retention` job (borrado/anonimización a 60 días).
- Workflows GH: CodeQL + Trivy + SBOM; Dependabot auto‑PR.
- Access review mensual (script + checklist).

---

## 4) Variables de entorno (añadir al proyecto)
```
# Observabilidad / Alertas
ALERTS_SLACK_WEBHOOK=
STATUSPAGE_API_KEY=
GRAFANA_REMOTE_WRITE_URL=
GRAFANA_REMOTE_WRITE_TOKEN=

# Backups
BACKUPS_BUCKET=supabase://backups
BACKUPS_ENCRYPTION_KEY=

# Seguridad / Perímetro
CLOUDFLARE_ZONE_ID=
CLOUDFLARE_API_TOKEN=
REQUIRE_2FA=true

# N8N (para backups y health)
N8N_BASE_URL=https://primary-production-7f25.up.railway.app
N8N_API_KEY=__SETME__
```

---

## 5) Notas de implementación
- **Status Page**: crea services “Portal”, “API/BFF”, “n8n” y publica `status.rp9.io` (Instatus/Better Uptime).  
- **Cloudflare**: habilita WAF estándar, `Rate Limiting Rules` (p.ej. 300 req/min a `/functions/proxy-n8n`), y **Bot Fight Mode**.  
- **Backups**: cifra artefactos con `BACKUPS_ENCRYPTION_KEY`; conserva 7–14 días; sube a Supabase Storage o S3.  
- **Auditoría**: no almacenar payloads sensibles; registra **quién, qué, cuándo** y **hash** del evento.

---

**Archivos incluidos en el ZIP:** ver lista dentro del paquete.
