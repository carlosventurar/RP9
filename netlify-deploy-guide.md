# 🚀 Guía de Deployment en Netlify - RP9 Portal

## 📋 Pasos para Deploy en Netlify

### 1. **Crear Sitio en Netlify**
- Ve a: https://netlify.com/
- Click en "New site from Git"
- Conecta con GitHub
- Selecciona el repositorio: `carlosventurar/RP9`

### 2. **Configurar Build Settings**
```bash
# Build command:
npm run build

# Publish directory:
.next

# Node version:
18
```

### 3. **Variables de Entorno en Netlify**
Ve a: **Site settings > Environment variables**

Agrega las siguientes variables:

#### **Supabase Configuration**
```
NEXT_PUBLIC_SUPABASE_URL = https://qovenmrjzljmblxobgfs.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFvdmVubXJqemxqbWJseG9iZ2ZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ3ODY4NzgsImV4cCI6MjA3MDM2Mjg3OH0.bYdsIGARRD_A8zmB0lg-P33rjx0ckAMMlP2fe3alWIo
SUPABASE_SERVICE_ROLE_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFvdmVubXJqemxqbWJseG9iZ2ZzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDc4Njg3OCwiZXhwIjoyMDcwMzYyODc4fQ.Pnm7BQhYY9ILBltL8X7uZ1_cUnEW9XKNLfJislOgp-8
```

#### **n8n Configuration**
```
N8N_BASE_URL = https://primary-production-7f25.up.railway.app
N8N_API_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2MDFlNTRhNi1hZTRlLTRlNWYtYTBjOS01NGJhNjJhMzVmNGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzU0NzY0MTY3LCJleHAiOjE3NjI0OTE2MDB9.SbxOUDERJSu3oVIRTLxPa1LZjS09Eey0V9NurCvjHaw
```

#### **App Configuration**
```
NEXT_PUBLIC_APP_NAME = RP9 Portal
NEXT_PUBLIC_APP_VERSION = 1.0.0
NEXT_PUBLIC_APP_ENV = production
NODE_ENV = production
```

#### **Security**
```
JWT_SECRET = 39a57ba1fdd3832c506101cf5d606c4d1ae1c9c25b785141ec804ba3b5f34a486214549c59d0518faf3165210f7a8b20014b31332dd8289e1b8d858c6b1e11a8
```

#### **Feature Flags**
```
NEXT_PUBLIC_ENABLE_ANALYTICS = false
NEXT_PUBLIC_ENABLE_TEMPLATES = true
NEXT_PUBLIC_ENABLE_BILLING = false
```

### 4. **Configurar Dominio (Opcional)**
- Ve a: **Domain management**
- Agrega tu dominio personalizado
- Configura SSL automático

### 5. **Deploy y Verificar**
- Click en "Deploy site"
- Espera a que termine el build
- Verifica que no haya errores

## 🔐 Configuración Post-Deploy

### **1. Actualizar URLs en Supabase**
Después del deploy, actualiza en Supabase:
- **Site URL**: `https://tu-sitio.netlify.app`
- **Redirect URLs**: 
  - `https://tu-sitio.netlify.app/auth/callback`
  - `https://tu-sitio.netlify.app/dashboard`

### **2. Credenciales de Acceso Inicial**
```
Email: admin@rp9portal.com
Password: RP9Admin2024!
```

⚠️ **IMPORTANTE**: Cambia la contraseña después del primer login

### **3. Verificar Funcionalidad**
- ✅ Login/Registro
- ✅ Dashboard con métricas
- ✅ Conexión n8n
- ✅ Templates marketplace
- ✅ Configuración de tenant

## 🎯 URLs Importantes

- **Supabase Dashboard**: https://supabase.com/dashboard/project/qovenmrjzljmblxobgfs
- **GitHub Repo**: https://github.com/carlosventurar/RP9
- **Netlify Dashboard**: https://app.netlify.com/sites/rp9-portal

## 🚨 Troubleshooting

### **Build Fails**
- Verificar que todas las variables de entorno estén configuradas
- Revisar logs de build en Netlify
- Verificar compatibilidad Next.js 15

### **Auth Issues**
- Verificar URLs en Supabase Auth settings
- Confirmar variables de entorno SUPABASE
- Verificar configuración de redirects

### **API Issues**
- Verificar n8n API key validity
- Confirmar n8n base URL accessibility
- Revisar CORS settings

## ✅ Checklist de Deploy

- [ ] Sitio creado en Netlify
- [ ] Variables de entorno configuradas
- [ ] Build successful
- [ ] URLs actualizadas en Supabase
- [ ] Auth funcionando
- [ ] Dashboard cargando
- [ ] n8n connection working
- [ ] Templates loading
- [ ] SSL certificate active