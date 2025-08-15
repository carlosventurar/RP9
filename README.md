# Agente Virtual IA 🤖

Plataforma de automatización inteligente con IA para empresas modernas. Construida con Next.js 15, TypeScript y Tailwind CSS.

[![Next.js](https://img.shields.io/badge/Next.js-15.4.6-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.x-38B2AC?logo=tailwind-css)](https://tailwindcss.com/)
[![React](https://img.shields.io/badge/React-19.x-61DAFB?logo=react)](https://reactjs.org/)

## ✨ Características

### 🎨 Interfaz Moderna
- Diseño profesional con tema oscuro/claro
- Componentes reutilizables con shadcn/ui
- Gradientes y animaciones fluidas
- Responsive design para todos los dispositivos

### 🔐 Autenticación & Seguridad
- Autenticación JWT con cookies HTTP-only
- Sistema multi-tenant
- Rate limiting por IP
- Proxy seguro hacia n8n API

### 📊 Dashboard & Analytics
- Métricas en tiempo real
- KPIs de rendimiento
- Monitoreo de ejecuciones
- Visualización de datos

### ⚡ Gestión de Workflows
- Lista, crear y gestionar workflows
- Activar/desactivar flujos
- Ejecutar workflows manualmente
- Historial de ejecuciones

### 🏢 Multi-tenancy
- Configuración por tenant
- Límites de uso personalizables
- Facturación por consumo (UI)
- Configuración de APIs y webhooks

## 🚀 Inicio Rápido

### Prerrequisitos

- Node.js 18+ y npm
- Una instancia de n8n funcionando
- API Key de n8n

### 1. Instalación

```bash
# Clonar el repositorio
git clone https://github.com/tu-usuario/agente-virtual-ia.git
cd agente-virtual-ia

# Instalar dependencias
npm install
```

### 2. Configuración

Copia las variables de entorno:

```bash
cp .env.example .env.local
```

Edita `.env.local` con tu configuración:

```env
# n8n Configuration
N8N_BASE_URL=https://tu-n8n-instance.com
N8N_API_KEY=tu_clave_api_n8n

# JWT Secret (generar una clave fuerte)
JWT_SECRET=tu-super-secreto-jwt-cambiar-en-produccion

# App Configuration
NEXT_PUBLIC_APP_NAME=Agente Virtual IA
NEXT_PUBLIC_APP_VERSION=1.0.0
```

### 3. Desarrollo

```bash
# Iniciar servidor de desarrollo
npm run dev

# Compilar para producción
npm run build

# Iniciar en producción
npm start

# Linting
npm run lint
```

Abre [http://localhost:3000](http://localhost:3000) en tu navegador.

## 🔑 Credenciales Demo

Para probar la aplicación usa estas credenciales:

- **Email**: demo@agentevirtualia.com
- **Password**: demo123

## 🏗️ Arquitectura

```
Agente Virtual IA
├── Frontend (Next.js 15)
│   ├── React Server Components
│   ├── shadcn/ui + Tailwind CSS
│   └── Theme Provider (dark/light)
├── Backend (API Routes)
│   ├── JWT Authentication
│   ├── n8n Proxy Client
│   └── Rate Limiting
└── n8n Instance
    └── Workflows & Executions
```

### Estructura de Directorios

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API Routes (Backend)
│   │   ├── auth/          # Autenticación
│   │   ├── workflows/     # Gestión de workflows
│   │   └── executions/    # Historial de ejecuciones
│   ├── dashboard/         # Página principal
│   ├── workflows/         # Gestión de workflows
│   ├── analytics/         # Métricas y analytics
│   ├── settings/          # Configuración
│   └── billing/           # Facturación
├── components/            # Componentes React
│   ├── ui/               # Componentes base (shadcn/ui)
│   ├── app-sidebar.tsx   # Navegación lateral
│   ├── header.tsx        # Cabecera
│   └── theme-provider.tsx # Provider de tema
└── lib/                  # Utilidades
    ├── auth.ts           # JWT y autenticación
    ├── n8n.ts            # Cliente n8n tipado
    └── utils.ts          # Utilidades generales
```

## 🔌 API Endpoints

### Autenticación
- `POST /api/auth/login` - Iniciar sesión
- `POST /api/auth/logout` - Cerrar sesión  
- `GET /api/auth/me` - Obtener usuario actual

### Workflows
- `GET /api/workflows` - Listar workflows
- `POST /api/workflows` - Crear/actualizar workflow
- `GET /api/workflows/[id]` - Obtener workflow específico
- `PATCH /api/workflows/[id]` - Actualizar workflow
- `DELETE /api/workflows/[id]` - Eliminar workflow
- `POST /api/workflows/[id]/activate` - Activar workflow
- `POST /api/workflows/[id]/deactivate` - Desactivar workflow
- `POST /api/workflows/[id]/run` - Ejecutar workflow

### Ejecuciones
- `GET /api/executions` - Listar ejecuciones

## 🎨 Personalización

### Tema y Colores

El tema Agente Virtual IA está configurado en `src/app/globals.css`:

```css
:root {
  --primary: oklch(0.5 0.25 264); /* Azul Agente Virtual IA */
}
```

### Componentes

Los componentes están basados en shadcn/ui y se pueden personalizar editando:

- `components.json` - Configuración de shadcn/ui
- `src/components/ui/` - Componentes base
- `src/app/globals.css` - Estilos globales

## 📦 Deployment

### Vercel (Recomendado)

1. Fork este repositorio
2. Conecta con Vercel
3. Configura las variables de entorno
4. Deploy automático

### Variables de Entorno (Producción)

```env
N8N_BASE_URL=https://tu-n8n-produccion.com
N8N_API_KEY=tu_clave_api_produccion
JWT_SECRET=tu-secreto-jwt-super-seguro
NODE_ENV=production
```

## 📝 Roadmap

### Fase 1 - MVP ✅
- [x] Setup básico Next.js + TypeScript
- [x] Autenticación JWT
- [x] Dashboard con métricas
- [x] Gestión de workflows
- [x] Tema profesional

### Fase 2 - Producción (Próxima)
- [ ] Stripe integration para billing real
- [ ] Templates de workflows
- [ ] Alertas y notificaciones
- [ ] HMAC para webhooks
- [ ] Tests automatizados

### Fase 3 - Enterprise
- [ ] SSO (SAML, OAuth)
- [ ] Auditoría completa
- [ ] Multi-región
- [ ] AI Assistant

## 📄 Licencia

Este proyecto está bajo la Licencia MIT.

## ⚡ Tecnologías

- **Frontend**: Next.js 15, React 19, TypeScript
- **Styling**: Tailwind CSS 4, shadcn/ui  
- **Auth**: JWT, HTTP-only cookies
- **Backend**: Next.js API Routes
- **n8n**: Cliente HTTP con Axios
- **Deployment**: Vercel, Docker

---

Desarrollado con ❤️ para la nueva era de la automatización inteligente con IA.
