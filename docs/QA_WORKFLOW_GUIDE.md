# Guía del Workflow QA - Agente Virtual IA

## 🎯 Objetivo

Implementar un ambiente QA estable para validar cambios antes de producción, garantizando estabilidad y calidad en deployments.

## 🏗️ Arquitectura de Ramas

```
main (Producción)
  ↑ PR review requerido
qa (QA Environment) 
  ↑ PR review requerido
feature/* (Development)
```

### Ambientes:

| Ambiente | Rama | URL | Propósito |
|----------|------|-----|-----------|
| **Desarrollo** | `feature/*` | Local | Desarrollo de features |
| **QA** | `qa` | `https://qa-agentevirtualia.netlify.app` | Testing y validación |
| **Producción** | `main` | `https://agentevirtualia.com` | Aplicación en vivo |

## 🔄 Workflow de Desarrollo

### 1. Desarrollo de Nueva Feature

```bash
# Crear branch desde qa (no desde main)
git checkout qa
git pull origin qa
git checkout -b feature/nueva-funcionalidad

# Desarrollar cambios
# ... hacer cambios ...

# Commit y push
git add .
git commit -m "feat: implementar nueva funcionalidad"
git push -u origin feature/nueva-funcionalidad
```

### 2. Pull Request a QA

```bash
# Crear PR a qa branch
gh pr create --base qa --title "feat: Nueva funcionalidad" --body "Descripción detallada"

# O usar GitHub UI:
# Base: qa ← Compare: feature/nueva-funcionalidad
```

### 3. Testing en QA

1. **Auto-deploy**: PR merged → QA environment actualizado automáticamente
2. **Testing**: Validar funcionalidad en `https://qa-agentevirtualia.netlify.app`
3. **Labels**: Agregar `qa-testing` → `qa-ready` cuando esté validado

### 4. Promoción a Producción

```bash
# Solo después de validación QA exitosa
gh pr create --base main --head qa --title "chore: Promote QA to Production" --body "Changes validated in QA environment"
```

## 🚨 Hotfixes Críticos

Para bugs críticos que requieren deploy inmediato:

```bash
# 1. Crear hotfix branch
git checkout qa
git checkout -b hotfix/fix-critico

# 2. Implementar fix
git commit -m "fix: resolver bug crítico"
git push -u origin hotfix/fix-critico

# 3. PR rápido a QA con label hotfix
gh pr create --base qa --head hotfix/fix-critico --label hotfix

# 4. Testing rápido en QA (máximo 15 minutos)

# 5. Fast-track a producción
gh pr create --base main --head qa --label hotfix
```

## 📋 Labels y Estados

| Label | Propósito | Color |
|-------|-----------|-------|
| `qa-ready` | Listo para testing QA | ![#0052cc](https://via.placeholder.com/15/0052cc/000000?text=+) Azul |
| `prod-ready` | Validado, listo para producción | ![#0e8a16](https://via.placeholder.com/15/0e8a16/000000?text=+) Verde |
| `hotfix` | Fix crítico fast-track | ![#d73a49](https://via.placeholder.com/15/d73a49/000000?text=+) Rojo |
| `qa-testing` | En proceso de testing | ![#fbca04](https://via.placeholder.com/15/fbca04/000000?text=+) Amarillo |

## ⚙️ Configuración de Ambientes

### QA Environment

- **Netlify Site**: Segundo site configurado para rama `qa`
- **Database**: Supabase project separado para QA
- **Configuration**: `netlify-qa.toml` con settings específicos
- **Variables**: Keys de testing, debug mode habilitado

### Diferencias QA vs Producción:

| Aspecto | QA | Producción |
|---------|----|-----------:|
| **Cache** | 1 hora | 1 año |
| **Debug** | Habilitado | Deshabilitado |
| **Rate Limits** | Deshabilitado | Habilitado |
| **Logging** | Verbose | Normal |
| **Functions Schedule** | Frecuente (testing) | Normal |
| **Security Headers** | Relajado | Estricto |

## 🔐 Branch Protection

### Rama `main` (Producción):
- ✅ Require PR reviews (1 aprobación)
- ✅ Require status checks
- ✅ Enforce for administrators
- ✅ Prevent force pushes
- ✅ Prevent deletions

### Rama `qa` (QA):
- ✅ Require PR reviews (1 aprobación)
- ✅ Require basic status checks
- ❌ Admin enforcement (flexibilidad para hotfixes)
- ✅ Prevent force pushes
- ✅ Prevent deletions

## 📊 Monitoreo y Alertas

### Métricas QA:
- **Deploy Success Rate**: % deploys exitosos en QA
- **Test Pass Rate**: % tests que pasan en QA
- **QA→Prod Lead Time**: Tiempo promedio QA a producción
- **Hotfix Frequency**: Frecuencia de hotfixes

### Alertas Configuradas:
- ❌ QA build fallido
- ❌ QA functions error
- ⚠️ QA performance degradation
- 📧 Daily QA status report

## 🛠️ Comandos Útiles

### Workflow Completo:
```bash
# Setup inicial
git checkout qa && git pull

# Nueva feature
git checkout -b feature/nombre
# ... desarrollo ...
git commit -m "feat: descripción"
git push -u origin feature/nombre

# PR a QA
gh pr create --base qa --label qa-ready

# Después de testing exitoso en QA
gh pr create --base main --head qa --label prod-ready
```

### Sincronización:
```bash
# Mantener qa actualizado desde main
git checkout qa
git pull origin main
git push origin qa

# Mantener feature actualizada desde qa
git checkout feature/nombre
git pull origin qa
```

### Verificación de Estado:
```bash
# Ver status de PRs
gh pr list --base qa
gh pr list --base main

# Ver último deploy
gh run list --branch qa
gh run list --branch main
```

## 🚀 Checklist de Deploy

### Pre-Deploy QA:
- [ ] Tests pasan localmente
- [ ] Linting sin errores
- [ ] Build exitoso
- [ ] PR review aprobado
- [ ] Branch actualizada desde qa

### Post-Deploy QA:
- [ ] Site QA carga correctamente
- [ ] Functions funcionan
- [ ] Features nuevas operativas
- [ ] No errores en logs
- [ ] Performance aceptable

### Pre-Deploy Producción:
- [ ] QA testing completo
- [ ] Performance validado
- [ ] Security review pasado
- [ ] Monitoring configurado
- [ ] Rollback plan listo

### Post-Deploy Producción:
- [ ] Site producción operativo
- [ ] Métricas normales
- [ ] No errores críticos
- [ ] User acceptance validado
- [ ] Monitoring activo

## 🔧 Troubleshooting

### Problemas Comunes:

**QA Deploy Falla:**
```bash
# Verificar logs
gh run view --log

# Verificar variables de entorno
netlify env:list --context branch-deploy

# Rebuild forzado
netlify deploy --prod --dir=.next
```

**Conflictos qa→main:**
```bash
# Resolver conflictos
git checkout qa
git pull origin main
# Resolver conflictos manualmente
git commit -m "resolve: conflictos main→qa"
git push origin qa
```

**Rollback Rápido:**
```bash
# Revertir último commit en main
git checkout main
git revert HEAD
git push origin main
```

## 📚 Recursos Adicionales

- [Setup QA Environment](../scripts/setup-qa-environment.md)
- [Branch Protection Setup](../scripts/setup-branch-protection.sh)
- [Netlify QA Config](../netlify-qa.toml)
- [GitHub Actions QA](.github/workflows/qa-deploy.yml)

## 🎯 Próximos Pasos

1. **Automatización**: GitHub Actions para testing automático
2. **Monitoring**: Dashboards específicos para QA vs Prod
3. **E2E Testing**: Tests end-to-end en ambiente QA
4. **Performance**: Benchmarks automáticos QA vs Prod
5. **Security**: Scans automáticos en cada deploy QA

---

**Recuerda**: El objetivo es mantener `main` siempre estable. Todo pasa por QA primero. 🛡️