# RP9 — Fase 9: Seguridad & Compliance
**Stack objetivo:** GitHub · Netlify Functions (TS) · Supabase (Postgres/Storage/RLS) · Stripe · n8n (Railway)  
**URL n8n:** `https://primary-production-7f25.up.railway.app/`

## 0) Resumen ejecutivo
Implementamos seguridad “by‑default”: HMAC de webhooks, API keys por *scope*, RLS estricta, auditoría end‑to‑end, evidencia con **SHA‑256**, cifrado por columna, rotación de claves, políticas de retención, controles de acceso a prod (SSO+MFA+JIT), *playbook* de incidentes y *backups* con prueba de restore. Roadmap hacia **SOC 2 Type I → II**.

---

## 1) Preguntas y decisiones (A/B/C) — con ejemplo y **respuesta seleccionada**
> Pediste usar **la recomendación** como respuesta final para cada pregunta.

1. **Autenticación de webhooks entrantes**  
A) HMAC con secreto compartido (cuerpo + timestamp) · B) JWT firmado por RP9 · C) mTLS  
*Ej.* `X-RP9-Timestamp`, `X-RP9-Signature=sha256=...` sobre `timestamp+"\n"+body`  
**Respuesta seleccionada:** A

2. **Formato de firma**  
A) Solo `X-RP9-Signature` · B) `X-RP9-Timestamp` + `sha256=` de `timestamp\nbody` · C) Nonce + cache  
**Respuesta seleccionada:** B

3. **Emisión de API Keys**  
A) 1 por tenant · B) Por *workflow* y *scope* (read/execute/metrics) · C) OAuth2 CC  
**Respuesta seleccionada:** B

4. **Dónde guardamos secretos**  
A) Solo env · B) Env + cifrado con KMS + rotación programada · C) Vault  
**Respuesta seleccionada:** B

5. **Credenciales para nodos n8n**  
A) En n8n Credentials (encriptadas) · B) En RP9 e inyectar · C) Mixto  
**Respuesta seleccionada:** A

6. **Control de IP (ingreso webhooks)**  
A) Sin restricción · B) Allowlist por tenant · C) Global por plan  
**Respuesta seleccionada:** B

7. **Rate‑limit de APIs**  
A) Global por IP · B) Por tenant + por API key (burst/ventana) · C) Dinámico por riesgo  
**Respuesta seleccionada:** B

8. **RLS en Supabase (multi‑tenant)**  
A) Básico (tenant_id) · B) Estricto (owner/miembros/roles por recurso) · C) ABAC por etiqueta  
**Respuesta seleccionada:** B

9. **Auditoría — qué eventos**  
A) Cambios de config · B) Auth, cambios, acceso a evidencias, facturación, acciones admin · C) Todo con payloads  
**Respuesta seleccionada:** B

10. **Retención de evidencias**  
A) 30 días · B) 90 días (legal hold opcional) · C) 180 días  
**Respuesta seleccionada:** B

11. **Prueba de integridad de evidencias**  
A) SHA‑256 · B) SHA‑512 · C) BLAKE3  
**Respuesta seleccionada:** A

12. **Cifrado en reposo**  
A) Nativo DB/Storage · B) + Cifrado por columna sensible (AES‑256‑GCM) · C) Per‑tenant keys desde inicio  
**Respuesta seleccionada:** B

13. **Rotación de claves**  
A) Manual semestral · B) Automática trimestral con versionado/grace · C) On‑demand  
**Respuesta seleccionada:** B

14. **Residencia de datos**  
A) Una región LatAm/US al inicio · B) Dual‑region · C) Por país/tenant desde día 1  
**Respuesta seleccionada:** A

15. **Privacidad/PII**  
A) Minimizar + enmascarar en ingestión · B) Guardar y filtrar en UI · C) Políticas configurables por campo  
**Respuesta seleccionada:** C (baseline A)

16. **Respuesta a incidentes**  
A) Best‑effort · B) Playbook con severidades/tiempos · C) + Notificación ≤72h + RCA ≤5 días  
**Respuesta seleccionada:** C

17. **Backups y restauración**  
A) Diario+semanal · B) PITR · C) Diario + versionado + *restore test* trimestral  
**Respuesta seleccionada:** C

18. **Acceso a producción**  
A) SSO + MFA + Just‑in‑Time con audit trail · B) VPN fija + cuentas compartidas · C) SSH keys por usuario  
**Respuesta seleccionada:** A

19. **Testing de seguridad**  
A) Ninguno · B) Pentest anual · C) SAST/DAST continuo + dep‑scan + pentest periódico  
**Respuesta seleccionada:** C

20. **Roadmap de compliance**  
A) ISO 27001 directo · B) SOC 2 Type I → Type II · C) Solo políticas internas  
**Respuesta seleccionada:** B

---

## 2) Claude Code — **Master Prompt** (copia/pega)
Eres **Security/Platform Engineer**. En el monorepo `rp9/` (Node 18 + TypeScript) implementa la **Fase 9: Seguridad & Compliance** según las 20 decisiones anteriores. Stack: **Netlify Functions** (TS), **Supabase** (Postgres/Storage/RLS), **Stripe**, **n8n (Railway)**. Entregables mínimos:

1) **HMAC Webhooks**: librería `lib/security/hmac.ts` (sha256 con `timestamp+"\n"+rawBody`), *middleware* para Functions (`functions/verify-webhook-hmac.ts`) con ventana ±5 min e idempotencia por `(signature,timestamp,nonce)` (tabla `webhook_idempotency`).  
2) **API Keys por scope**: tabla `api_keys` (hash + prefix + scopes + status + last_used_at), helper `lib/security/apiKeys.ts` para emitir/rotar/revocar y *middleware* que resuelve `tenant_id` y `scopes`.  
3) **Rate‑limit** por tenant y API key (ventana 1 min, burst configurable): tabla `rate_limits` + helper `lib/security/rateLimit.ts`.  
4) **IP Allowlist** por tenant: tabla `ip_allowlist` + *check* en middleware.  
5) **RLS estricto**: migración SQL `infra/supabase/migrations/40_security.sql` para `tenants`, `members`, `audit_logs`, `evidence_files`, `api_keys`, `ip_allowlist`, `rate_limits`, `webhook_idempotency`; políticas RLS por `tenant_id` y rol.  
6) **Auditoría**: función `functions/audit-log.ts` reusable (inserta `who, what, where(ip/ua), when, old→new, result`). Hook en endpoints sensibles.  
7) **Evidencia con SHA‑256**: subida a **Supabase Storage** en bucket `evidence/` + registro en `evidence_files(sha256,size,country,workflow_id)`; `functions/evidence-download.ts` verifica hash antes de firmar URL. Retención **90 días** con *legal hold* opcional.  
8) **Cifrado por columna**: util `lib/security/crypto.ts` (AES‑256‑GCM) para columnas sensibles (p.ej. `tax_id`, `billing_email`) con KEK en KMS simulado (env + versión).  
9) **Rotación de claves**: `functions/schedule-rotate-keys.ts` (cada trimestre) con `key_versions` y ventana de gracia; re‑cifra columnas marcadas.  
10) **Backups & restore test**: `functions/schedule-backup-restore-check.ts` (diario) que exporta dumps + prueba restauración en DB efímera y reporta a Slack.  
11) **Acceso a prod**: placeholder `lib/security/jit.ts` (SSO+MFA+JIT) + `audit_logs` para sesiones elevadas.  
12) **Incidentes**: `functions/incident-intake.ts` + *playbook* en `docs/incident_playbook.md` con severidades (P1–P4), tiempos, avisos ≤72h y RCA ≤5 días.  
13) **SAST/DAST/Deps**: agrega **CodeQL** + **Dependabot** + script ZAP baseline (documentarlo en `docs/security_ci.md`).  
14) **Roadmap SOC 2**: `docs/soc2/readme.md` con controles mínimos Type I y plan a Type II (auditoría continua).

Incluye **tests** (Vitest/Jest) para HMAC, API keys y PII masking; `netlify.toml` con *schedules*; `.env.example` con secretos; y `README.md` con instrucciones y *threat model* breve.

---

## 3) Backlog por sprints (entregables y criterios de aceptación)
**Sprint 9.1 — Perímetro y control de acceso (HMAC, API Keys, Rate‑limit, IP)**  
- Entrega: middlewares listos y tablas `api_keys`, `ip_allowlist`, `rate_limits`, `webhook_idempotency`.  
- CA: webhooks inválidos son rechazados; *burst* y *window* por API key; allowlist funciona.

**Sprint 9.2 — Auditoría & Evidencia**  
- Entrega: `audit_logs`, `evidence_files` + descarga con verificación SHA‑256; retención 90d + *legal hold*.  
- CA: auditoría completa (quién/qué/cuándo/dónde); evidencia íntegra o bloqueada.

**Sprint 9.3 — Cifrado & Rotación**  
- Entrega: util AES‑256‑GCM; marcadores de columnas cifradas; *rotation job* trimestral con ventana de gracia.  
- CA: datos cifrados al persistir; rotación produce nuevas versiones y conserva acceso.

**Sprint 9.4 — Backups, Incidentes & CI de seguridad**  
- Entrega: *backup + restore test*, *incident intake* + playbook, CodeQL + Dependabot + doc ZAP.  
- CA: *restore test* OK; incidentes generan tickets y notificaciones; escaneos en CI corren.

---

## 4) Variables de entorno (.env.example)
```env
# n8n
N8N_BASE_URL=https://primary-production-7f25.up.railway.app
N8N_API_KEY=__SETME__

# Supabase
SUPABASE_URL=__SETME__
SUPABASE_ANON_KEY=__SETME__
SUPABASE_SERVICE_ROLE_KEY=__SETME__

# Seguridad
HMAC_SECRET=__SETME__            # para firma de webhooks
API_KEY_SIGNING_SECRET=__SETME__ # emitir prefijos/firmas
RATE_LIMIT_MAX_PER_MIN=300
RATE_LIMIT_BURST=100
IP_ALLOWLIST_DEFAULT=

# Cifrado columna
DATA_KEK_VERSION=v1
DATA_KEK_v1=base64:__SETME__     # KEK actual
DATA_KEK_v0=base64:__OPTIONAL__  # versiones previas para grace

# Backups & Alerts
SLACK_WEBHOOK_URL=__SETME__
BACKUP_BUCKET=s3://__SETME__     # opcional si usas S3
```

---

## 5) Estructura recomendada del pack
``
rp9_phase9_security_pack/
  RP9_Fase9_Seguridad_Compliance.md
  README.md
  netlify.toml
  .env.example
  infra/supabase/migrations/40_security.sql
  functions/verify-webhook-hmac.ts
  functions/api-rate-limit.ts
  functions/audit-log.ts
  functions/evidence-download.ts
  functions/schedule-rotate-keys.ts
  functions/schedule-backup-restore-check.ts
  functions/incident-intake.ts
  lib/security/hmac.ts
  lib/security/apiKeys.ts
  lib/security/rateLimit.ts
  lib/security/crypto.ts
  lib/security/pii.ts
  tests/hmac.test.ts
  tests/apiKeys.test.ts
  tests/pii.test.ts
``

---

## 6) Notas de implementación
- **Firmas HMAC** deben usarse con *raw body*. En Netlify, lee `event.body` **sin** `JSON.stringify` previo; valida timestamp ±5 min.  
- **API Keys**: genera `rp9_sk_{prefix}` para mostrar, guarda **hash** (no el secreto).  
- **RLS**: activa `enable row level security` y políticas basadas en `tenant_id`.  
- **PII**: enmascara en ingestión (baseline A) y permite reglas por campo (opción C).  
- **Backups**: registra *checksums* y guarda reporte del *restore test*.  
- **Incidentes**: severidades P1–P4, avisos ≤72h, RCA en ≤5 días.