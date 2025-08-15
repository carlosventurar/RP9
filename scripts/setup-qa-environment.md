# Setup QA Environment - Netlify Configuration

## 1. Crear Segundo Site en Netlify

### Pasos Manuales en Netlify Dashboard:

1. **Crear Nuevo Site**:
   - Ir a [Netlify Dashboard](https://app.netlify.com/)
   - Click "New site from Git"
   - Conectar mismo repository: `carlosventurar/RP9`
   - Branch: `qa`
   - Build command: `npm install --legacy-peer-deps && npm run build`
   - Publish directory: `.next`

2. **Configurar Build Settings**:
   - **Base directory**: (leave empty)
   - **Build command**: `npm install --legacy-peer-deps && npm run build`
   - **Publish directory**: `.next`
   - **Functions directory**: `netlify/functions`

3. **Configurar Variables de Entorno QA**:
   ```bash
   # Environment
   NODE_ENV=staging
   NEXT_PUBLIC_ENVIRONMENT=qa
   NODE_VERSION=20
   
   # Database (QA Supabase Project)
   NEXT_PUBLIC_SUPABASE_URL=https://qa-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=eyJ...qa-service-key
   
   # Stripe Test Keys
   STRIPE_SECRET_KEY=sk_test_...qa_stripe_key
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...qa_stripe_key
   STRIPE_WEBHOOK_SECRET=whsec_...qa_webhook_secret
   
   # AI Services (QA/Test Keys)
   OPENAI_API_KEY=sk-...qa-openai-key
   ANTHROPIC_API_KEY=sk-ant-...qa-anthropic-key
   AI_BACKEND_URL=https://qa-ai.rp9portal.com
   
   # Analytics
   MIXPANEL_PROJECT_TOKEN=qa_mixpanel_token
   SENTRY_DSN=https://qa-sentry-dsn@sentry.io/project
   
   # Feature Flags
   ENABLE_FEATURE_FLAGS=true
   ENABLE_DEBUG_MODE=true
   ENABLE_VERBOSE_LOGGING=true
   DISABLE_RATE_LIMITING=true
   
   # I18n
   NEXT_PUBLIC_DEFAULT_LOCALE=es-419
   NEXT_PUBLIC_SUPPORTED_LOCALES=es-419,es-MX,es-CO,es-CL,es-PE,es-AR,es-DO,en-US
   ENABLE_I18N=true
   ENABLE_MULTI_CURRENCY=true
   ```

4. **Configurar Deploy Settings**:
   - **Production branch**: `qa`
   - **Deploy previews**: From any pull request against `qa`
   - **Branch deploys**: Deploy only the production branch
   - **Auto deploy**: Enabled

5. **Configurar Custom Domain (Opcional)**:
   - Domain: `qa.rp9portal.com` o `qa-rp9portal.netlify.app`
   - HTTPS: Enabled
   - Force HTTPS: Enabled

## 2. Comandos CLI Alternativos

Si prefieres usar Netlify CLI:

```bash
# Login a Netlify
netlify login

# Crear nuevo site
netlify sites:create --name rp9-portal-qa

# Configurar repository
netlify link --id [SITE_ID_QA]

# Deploy inicial
netlify deploy --dir=.next --functions=netlify/functions

# Deploy a producción QA
netlify deploy --prod --dir=.next --functions=netlify/functions
```

## 3. Configuración de Supabase QA

### Crear Proyecto QA en Supabase:

1. **Nuevo Proyecto**:
   - Nombre: `rp9-portal-qa`
   - Password: [secure-password]
   - Region: [same as production]

2. **Copiar Schema desde Producción**:
   ```sql
   -- Ejecutar todas las migraciones en orden:
   -- 001_initial_schema.sql
   -- 002_icp_cc_fin.sql
   -- ... hasta 093_legal_system.sql
   ```

3. **Configurar RLS Policies**:
   - Copiar todas las policies desde producción
   - Ajustar si es necesario para testing

4. **Seed Data para QA**:
   ```sql
   -- Datos de prueba para QA
   INSERT INTO tenants (id, name, plan, status) VALUES 
   ('qa-tenant-1', 'QA Test Company', 'pro', 'active');
   
   INSERT INTO users (email, tenant_id) VALUES 
   ('qa-admin@test.com', 'qa-tenant-1');
   ```

## 4. Configuración GitHub Actions (Opcional)

Crear `.github/workflows/qa-deploy.yml`:

```yaml
name: QA Deploy
on:
  push:
    branches: [qa]
  pull_request:
    branches: [qa]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci --legacy-peer-deps
      - run: npm run lint
      - run: npm run test
      - run: npm run build

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/qa'
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to Netlify QA
        uses: netlify/actions/cli@master
        with:
          args: deploy --dir=.next --functions=netlify/functions --prod
        env:
          NETLIFY_AUTH_TOKEN: ${{ secrets.NETLIFY_AUTH_TOKEN }}
          NETLIFY_SITE_ID: ${{ secrets.NETLIFY_QA_SITE_ID }}
```

## 5. Verificación Post-Setup

### Checklist de Verificación:

- [ ] Site QA deployado exitosamente
- [ ] Environment variables configuradas
- [ ] Base de datos QA accesible
- [ ] Functions QA funcionando
- [ ] Domain QA configurado
- [ ] SSL certificado activo
- [ ] Scheduled functions configuradas
- [ ] Logs accesibles
- [ ] Branch protection configurado

### URLs de Verificación:

- **QA Site**: https://qa-rp9portal.netlify.app
- **Netlify Functions**: https://qa-rp9portal.netlify.app/.netlify/functions/healthcheck
- **Supabase QA**: https://qa-project.supabase.co
- **GitHub Branch**: https://github.com/carlosventurar/RP9/tree/qa

## 6. Workflow de Desarrollo

```
Feature Development:
feature/nueva-funcionalidad → PR → qa → Testing → PR → main → Production

Hotfixes:
hotfix/bug-critico → PR → qa → Quick Test → PR → main → Production
```

## Notas Importantes

- **Costos**: Segundo site en Netlify es gratis dentro de los límites
- **Supabase**: Proyecto QA cuenta dentro del plan gratuito
- **Variables**: Nunca commitear keys reales en repositorio
- **Testing**: Usar datos de prueba, nunca datos reales
- **Monitoring**: Configurar alertas separadas para QA vs Production