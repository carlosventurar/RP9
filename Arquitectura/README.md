# RP9 — Fase 9: Seguridad & Compliance (Pack)
Este pack incluye Markdown de requerimientos + prompts y esqueletos de código (Netlify Functions TS, SQL Supabase, libs) para implementar seguridad y compliance.

## Instrucciones rápidas
1. Copia `.env.example` a `.env` (o variables en Netlify).
2. Aplica `infra/supabase/migrations/40_security.sql` en Supabase.
3. Sube `netlify.toml` y `functions/*` a tu repo (Netlify autodespliega).
4. Ejecuta tests locales (`npm test`) y valida HMAC/API Keys.
5. Configura `HMAC_SECRET`, `DATA_KEK_*`, `SUPABASE_*` y `SLACK_WEBHOOK_URL`.