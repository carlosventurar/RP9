
# RP9 — Fase 4 Security/SRE Pack

Este paquete añade seguridad, observabilidad, backups y compliance según tus decisiones de Fase 4.

## Contenido
- `infra/supabase/40_security.sql`
- `netlify.toml` (headers + redirects)
- `.github/workflows/` (CodeQL, Trivy, SBOM)
- `apps/functions/` (`healthcheck.ts`, `alerts-dispatch.ts`, `backup-run.ts`, `restore-sandbox.ts`)
- `docs/runbooks/` (incidentes, backups, accesos, retención)
- `.env.example` (nuevas variables)

## Uso
1. Aplica `infra/supabase/40_security.sql` en Supabase.
2. Configura variables del `.env.example` en Netlify y Railway.
3. Despliega Functions.
4. Configura Cloudflare WAF/rate‑limit y Status Page.
