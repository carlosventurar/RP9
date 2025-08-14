#!/bin/bash

# Setup Branch Protection for QA Workflow
# Este script configura las protecciones de rama para main y qa

echo "🔒 Configurando Branch Protection para workflow QA..."

# Configurar protección para rama main (Producción)
echo "📋 Configurando protección para rama 'main' (Producción)..."
gh api repos/carlosventurar/RP9/branches/main/protection \
  --method PUT \
  --field required_status_checks='{"strict":true,"contexts":["continuous-integration","build","test"]}' \
  --field enforce_admins=true \
  --field required_pull_request_reviews='{"dismiss_stale_reviews":true,"require_code_owner_reviews":false,"required_approving_review_count":1}' \
  --field restrictions=null \
  --field allow_force_pushes=false \
  --field allow_deletions=false

echo "✅ Protección configurada para 'main'"

# Configurar protección para rama qa (QA Environment)
echo "📋 Configurando protección para rama 'qa' (QA Environment)..."
gh api repos/carlosventurar/RP9/branches/qa/protection \
  --method PUT \
  --field required_status_checks='{"strict":true,"contexts":["continuous-integration","build"]}' \
  --field enforce_admins=false \
  --field required_pull_request_reviews='{"dismiss_stale_reviews":true,"require_code_owner_reviews":false,"required_approving_review_count":1}' \
  --field restrictions=null \
  --field allow_force_pushes=false \
  --field allow_deletions=false

echo "✅ Protección configurada para 'qa'"

# Configurar rama por defecto para PRs
echo "📋 Configurando 'qa' como rama base por defecto para PRs..."
gh api repos/carlosventurar/RP9 \
  --method PATCH \
  --field default_branch=qa

echo "✅ Rama base por defecto configurada"

# Crear etiquetas para PRs
echo "📋 Creando etiquetas para workflow..."
gh label create "qa-ready" --description "Ready for QA testing" --color "0052cc" || echo "Label 'qa-ready' already exists"
gh label create "prod-ready" --description "Ready for production deployment" --color "0e8a16" || echo "Label 'prod-ready' already exists"
gh label create "hotfix" --description "Critical hotfix requiring fast-track" --color "d73a49" || echo "Label 'hotfix' already exists"
gh label create "qa-testing" --description "Currently being tested in QA" --color "fbca04" || echo "Label 'qa-testing' already exists"

echo "✅ Etiquetas creadas"

echo "🎉 Branch Protection configurado exitosamente!"
echo ""
echo "📋 Resumen de configuración:"
echo "  • main: Requiere PR review + status checks + admin enforcement"
echo "  • qa: Requiere PR review + status checks básicos"
echo "  • Default branch: qa (nuevos PRs van a QA por defecto)"
echo "  • Etiquetas: qa-ready, prod-ready, hotfix, qa-testing"
echo ""
echo "🔄 Workflow resultante:"
echo "  1. Feature → PR a 'qa' → Testing en QA"
echo "  2. QA Validation → PR de 'qa' a 'main' → Production"