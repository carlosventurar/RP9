
# BACKUP_RESTORE.md — Backups diarios y Restore mensual

## Backups
- n8n: export de workflows + dump de DB si aplica.
- Supabase: tablas núcleo (usage, audit_log).
- Retención: 7–14 días.

## Restore (mensual)
1. Ejecuta `restore-sandbox.ts` para cargar en schema sandbox.
2. Valida integridad (conteos, checksums, sample de registros).
3. Documenta resultados y tiempos (RTO/RPO).
