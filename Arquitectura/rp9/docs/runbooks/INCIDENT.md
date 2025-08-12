
# INCIDENT.md — Gestión de Incidentes (Sev1/Sev2/Sev3)

## Severidades
- **Sev1**: caída total / fuga de datos. ETA comunicación 15 min. Bridge + Slack #incidents.
- **Sev2**: región/feature crítica degradada. Comunicación 30 min.
- **Sev3**: bug menor, workaround disponible.

## Flujo
1. Declara severidad y owner on‑call (horario laboral).
2. Notifica en Slack + Status Page (si Sev1/Sev2).
3. Mitiga, documenta timeline y métricas (p95, error rate).
4. Postmortem en 48h con acciones y dueños.
