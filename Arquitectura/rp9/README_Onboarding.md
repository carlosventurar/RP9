# RP9 — Onboarding & TTV Pack
## Pasos
1) Aplica `infra/supabase/30_onboarding.sql` en Supabase.
2) Copia `apps/functions/onboarding/*` y `apps/portal/app/(app)/onboarding/*` al monorepo.
3) Configura vars de `.env.example` en Netlify y portal.
4) Verifica que `templates-install` apunte al BFF → n8n (Railway).
5) Ajusta catálogo (8–12) y orden por país en Supabase.
## Criterios
- Mock ejecuta en <60s y muestra resultado.
- Activación = outcome + 5 ejecuciones.
- Gating mínimo: sin credenciales no se activa la real.
- Digest diario 7–14 días a email/WA.
- Evidencia con hash SHA‑256.
## Siguientes
- Completar RLS por tenant.
- Reemplazar stubs por llamadas reales a Supabase/BFF.
- Agregar micro‑videos y tooltips.
