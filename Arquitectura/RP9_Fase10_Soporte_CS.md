
# RP9 — Fase 10: Soporte, SLAs & Customer Success

**Fecha:** 2025-08-11

## Decisiones (20/20) — Selección = Recomendación
1) Modelo soporte: **B** (escalonado por plan).  
2) FRT: **B** (8h/4h/1h).  
3) SLA por severidad: **B** (P1 2h restore; P2 8h; P3 2d).  
4) Horario: **A** (8x5 + guardias P1 24/5).  
5) Canales: **C** (email+chat+Slack Enterprise).  
6) Herramienta: **B** (HubSpot Service Hub).  
7) KB: **B** (docs MDX + feedback).  
8) Status: **B** (Statuspage/BetterStack).  
9) RCA: **C** (P1 72h; P2/3 5 días).  
10) Mantenimiento: **B** (quincenal 1h, domingo madrugada).  
11) Onboarding CS: **A** (Kickoff + wizard).  
12) QBR/EBR: **A** (Ent Q trimestral; Pro semestral).  
13) Health Score: **A** (uso, éxito, incidentes, NPS).  
14) Playbooks: **A** (D7/D30/D60).  
15) Feature requests: **C** (portal + priorización interna).  
16) Escalamiento: **A** (Soporte→CS→Ingeniería, on-call P1).  
17) SLOs: **A** (99.5% / <1% / p95 <1s).  
18) NPS/CSAT: **A** (NPS trimestral + CSAT por ticket/flujo).  
19) Ready for Prod: **A** (30d sin P1, éxito>97%, ≥3 flujos críticos).  
20) Renovaciones & dunning: **A** (auto‑renov 12m; 60/30/15; 3 intentos).

## Instrucciones rápidas
- Aplica SQL `infra/supabase/migrations/50_support.sql`.
- Configura `.env.example` y despliega **Netlify Functions** en `apps/functions/`.
- Publica KCS (MDX) y enlaza **Status Page** desde el portal.
- Programa `support-sla-watch` cada 5–10 min (Netlify Scheduled Functions).
