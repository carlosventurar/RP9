# Phase 5: Onboarding & Time-to-Value - Guía de Uso

## Resumen Ejecutivo

Phase 5 implementa un sistema completo de onboarding progresivo diseñado para maximizar el Time-to-Value (TTV) de usuarios nuevos en RP9. Esta fase introduce gamificación, seguimiento de progreso, health scoring, y notificaciones automatizadas para guiar a los usuarios desde el registro hasta la activación completa de su cuenta.

## ¿Qué incluye Phase 5?

### 🎯 Características Principales

1. **Wizard de Onboarding Progresivo** (`/onboarding/wizard`)
   - Selección de vertical (Contact Center vs Finanzas)
   - Instalación automática de templates
   - Conexión de integraciones
   - Setup de primeros workflows

2. **Health Score System**
   - Cálculo automático basado en actividad del usuario
   - 50% Resultados de negocio + 30% Integraciones + 20% Uso
   - Umbral de activación: 70 puntos
   - Monitoreo en tiempo real

3. **Gamificación Avanzada**
   - Sistema de niveles (Explorador → Maestro)
   - Logros desbloqueables
   - Progreso visual con barras y métricas
   - Reconocimientos por hitos importantes

4. **Lista de Tareas Inteligente** (`/onboarding/checklist`)
   - Tareas contextuales por vertical
   - Seguimiento de progreso automático
   - Indicadores de tareas críticas
   - Actions específicas por tipo de tarea

5. **Sistema de Notificaciones**
   - Notificaciones in-app en tiempo real
   - Digest personalizado (días 1, 3, 7, 14)
   - Soporte para email y WhatsApp (configurable)
   - Priorización inteligente de mensajes

## Configuración y Activación

### Variables de Entorno Requeridas

Copia las siguientes variables a tu `.env.local`:

```bash
# === Phase 5: Onboarding & Time-to-Value ===

# Configuración Principal
ONBOARDING_WIZARD_ENABLED=true
HEALTH_SCORE_UPDATE_INTERVAL=300000
ACTIVATION_THRESHOLD_SCORE=70

# Gamificación
ACHIEVEMENTS_ENABLED=true
LEVEL_SYSTEM_ENABLED=true
PROGRESS_NOTIFICATIONS_ENABLED=true

# Sistema de Evidencias
EVIDENCE_UPLOAD_MAX_SIZE=10485760
EVIDENCE_STORAGE_BUCKET=evidence

# Notificaciones
DIGEST_NOTIFICATION_ENABLED=true
DIGEST_SEND_DAYS=1,3,7,14

# Feature Flags
FF_ONBOARDING_WIZARD=true
FF_HEALTH_SCORE=true
FF_GAMIFICATION=true
```

### Migración de Base de Datos

Aplicar la migración de onboarding:

```sql
-- Ejecutar el archivo: supabase/migrations/006_onboarding_ttv.sql
-- Contiene todas las tablas y funciones necesarias
```

### Configuración de Supabase

1. **Row Level Security (RLS)**
   - Las tablas de onboarding tienen RLS habilitado
   - Solo los usuarios del tenant pueden ver su progreso
   - Las funciones SQL manejan cálculos automáticos

2. **Funciones Principales**
   - `calculate_health_score(tenant_id)`: Calcula score de salud
   - `is_tenant_activated(tenant_id)`: Verifica activación
   - `get_tenants_for_digest()`: Encuentra usuarios para digest

## Flujo de Usuario

### 1. Primera Visita - Landing de Onboarding

```
/onboarding → Auto-redirección a /onboarding/wizard después de 3s
```

**Características:**
- Bienvenida visual atractiva
- Resumen de beneficios
- CTAs claros para comenzar

### 2. Wizard de Configuración (4 Pasos)

```
/onboarding/wizard
```

**Paso 1: Selección de Vertical**
- Contact Center vs Finanzas
- Detección automática de país (MX por defecto)
- Personalización de experiencia

**Paso 2: Configuración de Intent**
- Exploración rápida vs Setup completo
- Ajuste de expectativas de tiempo

**Paso 3: Conexión de Integraciones**
- Lista de integraciones disponibles por vertical
- Simulación de conexión (para demo)
- Validación de credenciales

**Paso 4: Instalación de Templates**
- Templates Mock (ejecución inmediata)
- Templates Reales (configuración requerida)
- Instalación automática en n8n

### 3. Lista de Tareas y Seguimiento

```
/onboarding/checklist
```

**Componentes Principales:**
- **Health Score Card**: Score actual + breakdown
- **Progress Overview**: % completado + métricas
- **Task List**: Tareas específicas con acciones
- **Gamification**: Niveles, logros, estadísticas

### 4. Activación Automática

**Criterios de Activación:**
- Health Score ≥ 70 puntos
- Al menos 1 resultado de negocio registrado
- Mínimo 5 ejecuciones de workflow

**Al activarse:**
- Notificación de celebración
- Acceso completo a todas las funcionalidades
- Badge de "Cuenta Activada"

## APIs y Endpoints

### Netlify Functions

**Ubicación**: `/netlify/functions/`

1. **onboarding-save-progress.ts**
   ```javascript
   POST /.netlify/functions/onboarding-save-progress
   {
     "tenantId": "uuid",
     "taskKey": "execute_mock",
     "status": "done",
     "meta": {}
   }
   ```

2. **onboarding-templates-install.ts**
   ```javascript
   POST /.netlify/functions/onboarding-templates-install
   {
     "mockWorkflow": {...},
     "realWorkflow": {...},
     "vertical": "cc",
     "tenantId": "uuid"
   }
   ```

3. **onboarding-geo.ts**
   ```javascript
   GET /.netlify/functions/onboarding-geo
   // Response:
   {
     "country": "MX",
     "countryName": "México",
     "timezone": "America/Mexico_City",
     "popularIntegrations": ["siigo", "hubspot"]
   }
   ```

4. **onboarding-notify-digest.ts**
   ```javascript
   POST /.netlify/functions/onboarding-notify-digest
   {
     "tenant_id": "uuid" // opcional, si no se incluye procesa todos
   }
   ```

5. **evidence/upload.ts**
   ```javascript
   POST /.netlify/functions/evidence/upload
   Content-Type: multipart/form-data
   // Maneja upload de evidencias con validación SHA-256
   ```

## Componentes React Reutilizables

### 1. HealthScore
```typescript
import HealthScore from '@/components/onboarding/HealthScore'

<HealthScore 
  tenantId={tenantId}
  showDetails={true}
  className="w-full"
/>
```

### 2. ProgressGamification
```typescript
import ProgressGamification from '@/components/onboarding/ProgressGamification'

<ProgressGamification
  healthScore={75}
  tasksCompleted={8}
  totalTasks={12}
  isActivated={false}
  daysSinceSignup={3}
/>
```

### 3. OnboardingNavigation
```typescript
import OnboardingNavigation from '@/components/onboarding/OnboardingNavigation'

<OnboardingNavigation 
  currentStep="checklist"
  completedSteps={['wizard']}
  showStepIndicator={true}
/>
```

### 4. useOnboardingProgress Hook
```typescript
import { useOnboardingProgress } from '@/hooks/useOnboardingProgress'

const {
  tasks,
  stats,
  isActivated,
  healthScore,
  loading,
  completeTask,
  markTaskError,
  refresh
} = useOnboardingProgress(tenantId)
```

## Sistema de Health Score

### Cálculo Automático

**Formula:**
```
Health Score = (50% × Outcome Score) + (30% × Integration Score) + (20% × Usage Score)
```

**Breakdown por Componente:**

1. **Outcome Score (50%)**
   - 0: Sin resultados de negocio
   - 50: Tiene al menos 1 resultado registrado

2. **Integration Score (30%)**
   - Basado en número de integraciones conectadas
   - Scale: 0-30 puntos según cantidad

3. **Usage Score (20%)**
   - Basado en ejecuciones de workflows
   - Scale: 0-20 puntos según frecuencia

### Triggers de Actualización

- Cada vez que se completa una tarea
- Al conectar una integración
- Al ejecutar un workflow
- Al registrar un resultado de negocio

## Gamificación

### Niveles del Sistema

1. **Nivel 1: Explorador** (0-19 pts)
   - Icono: Target
   - Color: Gris

2. **Nivel 2: Aprendiz** (20-39 pts)
   - Icono: Star
   - Color: Azul

3. **Nivel 3: Practicante** (40-69 pts)
   - Icono: Zap
   - Color: Verde

4. **Nivel 4: Experto** (70-89 pts)
   - Icono: Award
   - Color: Morado

5. **Nivel 5: Maestro** (90+ pts)
   - Icono: Crown
   - Color: Dorado

### Logros Disponibles

- **Primer Paso**: Completa tu primera tarea
- **Madrugador**: Completa 3 tareas en el primer día
- **Maestro de Tareas**: Completa 50% de las tareas
- **Perfeccionista**: Completa todas las tareas
- **Activado**: Tu cuenta está completamente activada
- **Campeón de Salud**: Alcanza Health Score de 80+
- **Velocista**: Actívate en menos de 3 días

## Notificaciones y Digest

### Tipos de Notificaciones

1. **In-App** (Tiempo real)
   - Progreso de tareas
   - Logros desbloqueados
   - Cambios de nivel
   - Recordatorios de tareas críticas

2. **Digest por Email** (Programado)
   - Días 1, 3, 7, 14 después del registro
   - Resumen personalizado de progreso
   - Next steps específicos
   - Call-to-action contextual

3. **WhatsApp Business** (Opcional)
   - Día 7 si no está activado
   - Tareas críticas pendientes
   - Recordatorios importantes

### Configuración de Digest

```javascript
// Programación automática recomendada
const DIGEST_SCHEDULE = {
  days: [1, 3, 7, 14],
  conditions: {
    not_activated: true,
    has_pending_tasks: true
  }
}
```

## Métricas y Análisis

### KPIs Principales

1. **Time-to-Value (TTV)**
   - Tiempo desde registro hasta activación
   - Meta: < 7 días

2. **Activation Rate**
   - % de usuarios que alcanzan activación completa
   - Meta: > 60%

3. **Task Completion Rate**
   - % de tareas completadas por usuario
   - Meta: > 80%

4. **Health Score Distribution**
   - Distribución de scores por cohorte
   - Identificación de puntos de fricción

### Queries de Análisis

```sql
-- TTV promedio por vertical
SELECT 
  vertical,
  AVG(EXTRACT(days FROM activated_at - created_at)) as avg_ttv_days
FROM tenants 
WHERE activated_at IS NOT NULL
GROUP BY vertical;

-- Tasa de activación por país
SELECT 
  country,
  COUNT(*) as total_users,
  COUNT(activated_at) as activated_users,
  ROUND(COUNT(activated_at) * 100.0 / COUNT(*), 2) as activation_rate
FROM tenants
GROUP BY country;

-- Progreso promedio de tareas
SELECT 
  task_key,
  COUNT(*) as total_attempts,
  COUNT(CASE WHEN status = 'done' THEN 1 END) as completions,
  ROUND(COUNT(CASE WHEN status = 'done' THEN 1 END) * 100.0 / COUNT(*), 2) as completion_rate
FROM onboarding_progress
GROUP BY task_key
ORDER BY completion_rate DESC;
```

## Troubleshooting

### Problemas Comunes

1. **Health Score no se actualiza**
   - Verificar que las funciones SQL tengan permisos correctos
   - Revisar logs de `onboarding-save-progress` function
   - Confirmar que RLS permite el acceso

2. **Templates no se instalan**
   - Verificar configuración N8N_BASE_URL y N8N_API_KEY
   - Confirmar que n8n está accesible desde Netlify Functions
   - Revisar logs de `onboarding-templates-install`

3. **Notificaciones no se envían**
   - Verificar DIGEST_NOTIFICATION_ENABLED=true
   - Confirmar que hay usuarios elegibles en la ventana de tiempo
   - Revisar configuración de canales (email/WhatsApp)

4. **Gamificación no funciona**
   - Verificar FF_GAMIFICATION=true
   - Confirmar carga de datos de progreso
   - Revisar cálculos de achievements en el componente

### Logs de Debug

```javascript
// Habilitar debugging
DEBUG_ENABLED=true
LOG_LEVEL=debug

// Logs importantes a revisar:
- Cálculo de health score
- Instalación de templates
- Envío de notificaciones
- Actualización de progreso
```

## Roadmap y Mejoras Futuras

### Próximas Funcionalidades

1. **A/B Testing de Onboarding**
   - Diferentes flujos para optimizar conversión
   - Métricas comparativas por variante

2. **Integración con CRM**
   - Sincronización de progreso con sales teams
   - Lead scoring basado en actividad de onboarding

3. **Personalización Avanzada**
   - Onboarding específico por industria
   - Workflows adaptativos según comportamiento

4. **Social Features**
   - Comparación con peers
   - Leaderboards por empresa/vertical

### Optimizaciones Técnicas

1. **Performance**
   - Cacheing de health score
   - Lazy loading de componentes
   - Optimización de queries SQL

2. **Escalabilidad**
   - Queue system para notificaciones
   - Batch processing de digest
   - Rate limiting mejorado

## Conclusión

Phase 5 transforma el onboarding de RP9 en una experiencia guiada, personalizada y gamificada que acelera significativamente el Time-to-Value. Con un sistema completo de seguimiento, notificaciones inteligentes y métricas detalladas, los usuarios nuevos pueden alcanzar la activación completa de forma eficiente y satisfactoria.

### Beneficios Clave

- **Reducción de TTV**: Guía sistemática hacia la activación
- **Mayor Engagement**: Gamificación y progreso visual
- **Mejor Retención**: Notificaciones personalizadas y oportunas
- **Insights de Producto**: Métricas detalladas de adopción
- **Escalabilidad**: Sistema automatizado y configurable

¡Phase 5 está listo para transformar la experiencia de nuevos usuarios en RP9! 🚀