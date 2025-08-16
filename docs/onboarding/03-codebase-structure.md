# 🏗️ 03. Codebase Structure

Esta guía te ayudará a navegar y entender la estructura del código de **Agente Virtual IA**.

## 📁 Estructura General del Proyecto

```
RP9/
├── 📂 src/                          # Código fuente principal
│   ├── 📂 app/                      # Next.js App Router
│   ├── 📂 components/               # Componentes React reutilizables
│   ├── 📂 hooks/                    # Custom React Hooks
│   ├── 📂 i18n/                     # Internacionalización
│   └── 📂 lib/                      # Librerías y utilidades
├── 📂 docs/                         # Documentación técnica
├── 📂 netlify/                      # Netlify Functions (backend)
├── 📂 public/                       # Assets estáticos
├── 📂 scripts/                      # Scripts de automatización
├── 📂 tests/                        # Tests end-to-end
└── 📂 supabase/                     # Database migrations
```

## 🎯 Arquitectura Next.js App Router

### 📂 `src/app/` - Application Routes

La aplicación usa **Next.js 15 App Router** con arquitectura de rutas basada en archivos:

```
src/app/
├── [locale]/                        # Rutas internacionalizadas
│   ├── page.tsx                     # Página principal
│   ├── layout.tsx                   # Layout compartido
│   ├── workflows/                   # Gestión de workflows
│   │   ├── page.tsx                 # Lista de workflows
│   │   └── [id]/                    # Workflow específico
│   ├── analytics/                   # Dashboard de analytics
│   ├── billing/                     # Gestión de facturación
│   ├── settings/                    # Configuración de usuario
│   └── admin/                       # Panel administrativo
├── api/                             # API Routes (backend)
│   ├── auth/                        # Endpoints de autenticación
│   ├── workflows/                   # API de workflows
│   ├── billing/                     # API de billing
│   └── analytics/                   # API de métricas
├── globals.css                      # Estilos globales
└── layout.tsx                       # Root layout
```

### 🎨 Patrones de Routing

#### 1. **Páginas Dinámicas**
```typescript
// src/app/[locale]/workflows/[id]/page.tsx
interface WorkflowPageProps {
  params: { id: string; locale: string }
  searchParams: { [key: string]: string | string[] | undefined }
}

export default async function WorkflowPage({ params, searchParams }: WorkflowPageProps) {
  const workflow = await getWorkflow(params.id)
  return <WorkflowEditor workflow={workflow} />
}
```

#### 2. **Layouts Anidados**
```typescript
// src/app/[locale]/workflows/layout.tsx
export default function WorkflowsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="workflow-container">
      <WorkflowsSidebar />
      <main className="workflow-main">
        {children}
      </main>
    </div>
  )
}
```

#### 3. **Server Components vs Client Components**
```typescript
// Server Component (por defecto)
async function WorkflowsList() {
  const workflows = await getWorkflows() // Fetch en servidor
  return <WorkflowGrid workflows={workflows} />
}

// Client Component (con interactividad)
'use client'
function WorkflowEditor({ workflow }: { workflow: Workflow }) {
  const [isEditing, setIsEditing] = useState(false)
  return <WorkflowCanvas workflow={workflow} />
}
```

## 🧩 Componentes React

### 📂 `src/components/` - Component Organization

```
src/components/
├── ui/                              # Componentes base (shadcn/ui)
│   ├── button.tsx                   # Botón reutilizable
│   ├── input.tsx                    # Input forms
│   ├── dialog.tsx                   # Modales
│   └── card.tsx                     # Cards de contenido
├── workflows/                       # Componentes específicos de workflows
│   ├── WorkflowCard.tsx             # Card individual de workflow
│   ├── WorkflowEditor.tsx           # Editor visual
│   └── WorkflowsList.tsx            # Lista de workflows
├── billing/                         # Componentes de facturación
├── analytics/                       # Componentes de analytics
├── layout/                          # Componentes de layout
│   ├── Header.tsx                   # Header principal
│   ├── Sidebar.tsx                  # Navegación lateral
│   └── Footer.tsx                   # Footer
└── shared/                          # Componentes compartidos
    ├── LoadingSpinner.tsx           # Loading states
    ├── ErrorBoundary.tsx            # Error handling
    └── SearchBar.tsx                # Búsqueda global
```

### 🎨 Patrones de Componentes

#### 1. **Atomic Design Pattern**
```typescript
// Atom: Componente básico
export function Button({ children, variant, ...props }: ButtonProps) {
  return (
    <button 
      className={cn(buttonVariants({ variant }))} 
      {...props}
    >
      {children}
    </button>
  )
}

// Molecule: Combinación de atoms
export function SearchInput({ onSearch }: SearchInputProps) {
  return (
    <div className="flex gap-2">
      <Input placeholder="Buscar workflows..." />
      <Button variant="ghost">
        <Search className="h-4 w-4" />
      </Button>
    </div>
  )
}

// Organism: Componente complejo
export function WorkflowCard({ workflow }: WorkflowCardProps) {
  return (
    <Card>
      <CardHeader>
        <WorkflowTitle workflow={workflow} />
        <WorkflowStatus status={workflow.status} />
      </CardHeader>
      <CardContent>
        <WorkflowMetrics workflow={workflow} />
      </CardContent>
      <CardActions>
        <WorkflowActions workflow={workflow} />
      </CardActions>
    </Card>
  )
}
```

#### 2. **Composition Pattern**
```typescript
// Compound component pattern
export function WorkflowEditor({ children }: WorkflowEditorProps) {
  return (
    <div className="workflow-editor">
      {children}
    </div>
  )
}

WorkflowEditor.Canvas = WorkflowCanvas
WorkflowEditor.Sidebar = WorkflowSidebar
WorkflowEditor.Toolbar = WorkflowToolbar

// Usage
<WorkflowEditor>
  <WorkflowEditor.Toolbar />
  <WorkflowEditor.Canvas />
  <WorkflowEditor.Sidebar />
</WorkflowEditor>
```

## 🎣 Custom Hooks

### 📂 `src/hooks/` - React Hooks

```typescript
// useWorkflows.ts - Hook para gestión de workflows
export function useWorkflows(filters?: WorkflowFilters) {
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const {
    data,
    error: queryError,
    isLoading,
    mutate
  } = useSWR(
    `/api/workflows?${new URLSearchParams(filters)}`,
    fetcher
  )

  const createWorkflow = useCallback(async (workflowData: CreateWorkflowData) => {
    const response = await fetch('/api/workflows', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(workflowData)
    })
    
    if (!response.ok) throw new Error('Failed to create workflow')
    
    const newWorkflow = await response.json()
    mutate() // Revalidate cache
    return newWorkflow
  }, [mutate])

  return {
    workflows: data?.workflows || [],
    loading: isLoading,
    error: queryError,
    createWorkflow,
    refresh: mutate
  }
}

// useAuth.ts - Hook para autenticación
export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkAuth()
  }, [])

  const login = async (email: string, password: string) => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    })
    
    if (!response.ok) throw new Error('Login failed')
    
    const { user, token } = await response.json()
    localStorage.setItem('auth-token', token)
    setUser(user)
    return user
  }

  return { user, loading, login, logout }
}
```

## 🌍 Internacionalización (i18n)

### 📂 `src/i18n/` - Multi-language Support

```
src/i18n/
├── config.ts                       # Configuración de i18n
├── request.ts                      # Server-side i18n setup
└── messages/                       # Archivos de traducción
    ├── es.json                     # Español (idioma principal)
    ├── es-MX.json                  # Español México
    ├── es-CO.json                  # Español Colombia
    ├── es-CL.json                  # Español Chile
    └── en.json                     # English (secundario)
```

#### Estructura de Mensajes
```json
// src/i18n/messages/es.json
{
  "common": {
    "save": "Guardar",
    "cancel": "Cancelar",
    "delete": "Eliminar",
    "edit": "Editar"
  },
  "workflows": {
    "title": "Workflows",
    "create": "Crear Workflow",
    "empty": "No tienes workflows aún",
    "status": {
      "active": "Activo",
      "inactive": "Inactivo",
      "running": "Ejecutándose"
    }
  },
  "navigation": {
    "dashboard": "Dashboard",
    "workflows": "Workflows",
    "analytics": "Analytics",
    "billing": "Facturación"
  }
}
```

#### Uso en Componentes
```typescript
import { useTranslations } from 'next-intl'

export function WorkflowsList() {
  const t = useTranslations('workflows')
  
  return (
    <div>
      <h1>{t('title')}</h1>
      <Button>{t('create')}</Button>
    </div>
  )
}
```

## 📚 Libraries y Utilities

### 📂 `src/lib/` - Core Libraries

```
src/lib/
├── auth/                           # Sistema de autenticación
│   ├── jwt.ts                      # JWT token handling
│   ├── supabase-auth.ts            # Supabase integration
│   └── middleware.ts               # Auth middleware
├── database/                       # Database clients
│   ├── supabase.ts                 # Supabase client setup
│   └── types.ts                    # Database type definitions
├── api/                           # API utilities
│   ├── client.ts                   # API client configuration
│   ├── types.ts                    # API type definitions
│   └── validation.ts               # Request validation
├── utils/                         # Utility functions
│   ├── cn.ts                       # Class name utility
│   ├── format.ts                   # Formatting functions
│   └── constants.ts                # App constants
└── services/                      # Business logic services
    ├── workflows.ts                # Workflow service
    ├── billing.ts                  # Billing service
    └── analytics.ts                # Analytics service
```

#### Service Layer Pattern
```typescript
// src/lib/services/workflows.ts
export class WorkflowService {
  constructor(
    private db: SupabaseClient,
    private n8nClient: N8nClient
  ) {}

  async createWorkflow(data: CreateWorkflowData): Promise<Workflow> {
    // 1. Validate input
    const validation = CreateWorkflowSchema.safeParse(data)
    if (!validation.success) {
      throw new ValidationError(validation.error)
    }

    // 2. Create in database
    const { data: workflow, error } = await this.db
      .from('workflows')
      .insert(data)
      .select()
      .single()

    if (error) throw new DatabaseError(error.message)

    // 3. Create in n8n
    try {
      const n8nWorkflow = await this.n8nClient.createWorkflow({
        name: workflow.name,
        nodes: workflow.nodes,
        connections: workflow.connections
      })

      // 4. Update with n8n ID
      await this.db
        .from('workflows')
        .update({ n8n_id: n8nWorkflow.id })
        .eq('id', workflow.id)

    } catch (error) {
      // Rollback on failure
      await this.db.from('workflows').delete().eq('id', workflow.id)
      throw new ExternalServiceError('Failed to create workflow in n8n')
    }

    return workflow
  }
}
```

## 🔌 Backend - Netlify Functions

### 📂 `netlify/functions/` - Serverless Backend

```
netlify/functions/
├── auth/                           # Authentication endpoints
│   ├── login.ts                    # User login
│   ├── logout.ts                   # User logout
│   └── me.ts                       # Get current user
├── workflows/                      # Workflow management
│   ├── create.ts                   # Create workflow
│   ├── list.ts                     # List workflows
│   ├── execute.ts                  # Execute workflow
│   └── status.ts                   # Get execution status
├── billing/                        # Billing endpoints
│   ├── subscription.ts             # Manage subscriptions
│   ├── usage.ts                    # Track usage
│   └── webhook.ts                  # Stripe webhooks
├── analytics/                      # Analytics endpoints
│   ├── metrics.ts                  # Get metrics
│   └── export.ts                   # Export data
└── shared/                         # Shared utilities
    ├── middleware.ts               # Common middleware
    ├── validation.ts               # Request validation
    └── response.ts                 # Response helpers
```

#### Function Structure Pattern
```typescript
// netlify/functions/workflows/create.ts
import { Handler } from '@netlify/functions'
import { withAuth } from '../shared/middleware'
import { validateRequest } from '../shared/validation'
import { WorkflowService } from '../../src/lib/services/workflows'

export const handler: Handler = withAuth(async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    }
  }

  try {
    // Validate request
    const body = JSON.parse(event.body || '{}')
    const validation = await validateRequest(body, CreateWorkflowSchema)
    
    if (!validation.success) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Validation failed', details: validation.errors })
      }
    }

    // Execute business logic
    const workflowService = new WorkflowService()
    const workflow = await workflowService.createWorkflow({
      ...validation.data,
      tenantId: context.user.tenantId,
      createdBy: context.user.id
    })

    return {
      statusCode: 201,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(workflow)
    }

  } catch (error) {
    console.error('Error creating workflow:', error)
    
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Internal server error',
        message: error.message 
      })
    }
  }
})
```

## 🗄️ Database Layer

### 📂 `supabase/` - Database Configuration

```
supabase/
├── config.toml                    # Supabase configuration
└── migrations/                    # Database migrations
    ├── 001_initial_schema.sql      # Initial schema
    ├── 002_workflows.sql           # Workflows tables
    ├── 003_billing.sql             # Billing tables
    └── 004_analytics.sql           # Analytics tables
```

#### Migration Example
```sql
-- supabase/migrations/002_workflows.sql
-- Create workflows table
CREATE TABLE workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  created_by UUID NOT NULL REFERENCES users(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  n8n_id VARCHAR(100),
  definition JSONB NOT NULL,
  active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;

CREATE POLICY workflows_tenant_isolation ON workflows
  FOR ALL USING (tenant_id = (auth.jwt() ->> 'tenant_id')::UUID);

-- Indexes for performance
CREATE INDEX idx_workflows_tenant_id ON workflows(tenant_id);
CREATE INDEX idx_workflows_active ON workflows(active);
CREATE INDEX idx_workflows_created_at ON workflows(created_at);
```

## 🎯 Convenciones de Código

### 📝 Naming Conventions

```typescript
// Files and Folders: kebab-case
// workflow-card.tsx, user-settings/

// Components: PascalCase
export function WorkflowCard() {}
export function UserSettingsModal() {}

// Variables and Functions: camelCase
const workflowData = await getWorkflowData()
const isWorkflowActive = checkWorkflowStatus()

// Constants: SCREAMING_SNAKE_CASE
const API_BASE_URL = 'https://api.example.com'
const MAX_RETRY_ATTEMPTS = 3

// Types and Interfaces: PascalCase
interface WorkflowData {
  id: string
  name: string
}

type WorkflowStatus = 'active' | 'inactive' | 'running'
```

### 🏗️ Import Organization

```typescript
// 1. External libraries (React, Next.js, etc.)
import React, { useState, useEffect } from 'react'
import { NextPage } from 'next'
import { useRouter } from 'next/navigation'

// 2. Internal components
import { Button } from '@/components/ui/button'
import { WorkflowCard } from '@/components/workflows/WorkflowCard'

// 3. Hooks and utilities
import { useWorkflows } from '@/hooks/useWorkflows'
import { cn } from '@/lib/utils'

// 4. Types and interfaces
import type { Workflow, WorkflowFilters } from '@/lib/types'

// 5. Constants and configs
import { WORKFLOW_STATUSES } from '@/lib/constants'
```

### 📁 File Organization Rules

1. **Una cosa por archivo**: Un componente por archivo, una función utilitaria por archivo
2. **Colocación**: Mantén relacionados los archivos juntos
3. **Barrel exports**: Usa `index.ts` para exports limpios
4. **Separación de concerns**: UI, lógica de negocio, y datos separados

## 🔍 Navigation Tips

### 🎯 Finding Code

```bash
# Buscar componentes
find src/components -name "*Workflow*" -type f

# Buscar hooks
find src/hooks -name "use*" -type f

# Buscar API endpoints
find netlify/functions -name "*.ts" -type f

# Buscar por contenido
grep -r "WorkflowService" src/
```

### 📖 VS Code Navigation

- **Ctrl/Cmd + P**: Quick file search
- **Ctrl/Cmd + Shift + F**: Search in all files  
- **F12**: Go to definition
- **Shift + F12**: Find all references
- **Ctrl/Cmd + Click**: Navigate to definition

---

**Próximo paso**: [🔄 Development Workflow](./04-development-workflow.md)