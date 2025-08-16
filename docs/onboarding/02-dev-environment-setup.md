# ⚙️ 02. Development Environment Setup

Esta guía te llevará paso a paso a configurar tu entorno de desarrollo para **Agente Virtual IA**.

## 📋 Prerequisites

### 🖥️ Sistema Operativo
- **Windows 10/11** (recomendado con WSL2)
- **macOS 12+** 
- **Linux** (Ubuntu 20.04+ o equivalente)

### 💾 Requerimientos de Hardware
- **RAM**: 16GB mínimo (32GB recomendado)
- **Almacenamiento**: 50GB libres en SSD
- **CPU**: Intel i5/AMD Ryzen 5 o superior
- **Internet**: Conexión estable (desarrollo requiere muchas descargas)

## 🛠️ Core Tools Installation

### 1. Node.js y npm

**Instalar Node.js 20 LTS:**

```bash
# Opción 1: Usando Node Version Manager (NVM) - Recomendado
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20
nvm alias default 20

# Opción 2: Descarga directa
# Visita https://nodejs.org y descarga la versión 20 LTS

# Verificar instalación
node --version  # Debe mostrar v20.x.x
npm --version   # Debe mostrar 10.x.x
```

**Configurar npm:**
```bash
# Configurar registry (opcional, para packages privados)
npm config set registry https://registry.npmjs.org/

# Configurar usuario Git para npm
npm config set init.author.name "Tu Nombre"
npm config set init.author.email "tu.email@company.com"
```

### 2. Git

**Instalar Git:**
```bash
# Ubuntu/Debian
sudo apt update && sudo apt install git

# macOS (usando Homebrew)
brew install git

# Windows
# Descargar de https://git-scm.com/download/win
```

**Configurar Git:**
```bash
git config --global user.name "Tu Nombre"
git config --global user.email "tu.email@company.com"
git config --global init.defaultBranch main
git config --global pull.rebase true
git config --global core.autocrlf input  # Linux/macOS
git config --global core.autocrlf true   # Windows
```

### 3. Code Editor - VS Code

**Instalar Visual Studio Code:**
- Descargar desde [code.visualstudio.com](https://code.visualstudio.com/)

**Extensiones Requeridas:**
```bash
# Instalar extensiones via CLI
code --install-extension ms-vscode.vscode-typescript-next
code --install-extension bradlc.vscode-tailwindcss
code --install-extension ms-vscode.vscode-eslint
code --install-extension esbenp.prettier-vscode
code --install-extension ms-vscode.vscode-json
code --install-extension ms-playwright.playwright
code --install-extension supabase.supabase
code --install-extension ms-vscode-remote.remote-containers
```

**VS Code Settings (`.vscode/settings.json`):**
```json
{
  "typescript.preferences.importModuleSpecifier": "relative",
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  },
  "tailwindCSS.experimental.classRegex": [
    ["clsx\\(([^)]*)\\)", "(?:'|\"|`)([^']*)(?:'|\"|`)"],
    ["classNames\\(([^)]*)\\)", "(?:'|\"|`)([^']*)(?:'|\"|`)"]
  ],
  "files.exclude": {
    "**/node_modules": true,
    "**/.next": true,
    "**/dist": true
  }
}
```

## 🔑 Account Setup

### 1. GitHub Access

**Setup SSH Key:**
```bash
# Generar SSH key
ssh-keygen -t ed25519 -C "tu.email@company.com"

# Agregar a SSH agent
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/id_ed25519

# Copiar public key
cat ~/.ssh/id_ed25519.pub
# Pegar en GitHub Settings > SSH and GPG keys
```

**Test GitHub Access:**
```bash
ssh -T git@github.com
# Debe responder: "Hi username! You've successfully authenticated..."
```

### 2. Repository Clone

```bash
# Clonar el repositorio principal
git clone git@github.com:carlosventurar/RP9.git
cd RP9

# Configurar upstream remotes
git remote add upstream git@github.com:carlosventurar/RP9.git
git fetch upstream
```

## 📦 Project Dependencies

### 1. Install Project Dependencies

```bash
# Instalar dependencias del proyecto
npm install --legacy-peer-deps

# Verificar que no hay vulnerabilidades críticas
npm audit --audit-level=high
```

### 2. Environment Variables Setup

**Crear archivo `.env.local`:**
```bash
# Copiar template de environment variables
cp .env.example .env.local
```

**Configurar variables requeridas en `.env.local`:**
```env
# Database & Authentication (Supabase)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# n8n Configuration
N8N_BASE_URL=http://localhost:5678
N8N_API_KEY=your_n8n_api_key

# JWT Secret (generar una clave fuerte)
JWT_SECRET=your-super-secret-jwt-key-change-in-production

# Stripe (usar test keys para desarrollo)
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# AI Services (opcional para desarrollo)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# App Configuration
NEXT_PUBLIC_APP_NAME=Agente Virtual IA
NEXT_PUBLIC_APP_VERSION=1.0.0
NEXT_PUBLIC_DEFAULT_LOCALE=es-419
```

## 🗄️ Database Setup

### 1. Supabase Local Development

**Instalar Supabase CLI:**
```bash
npm install -g supabase

# Verificar instalación
supabase --version
```

**Setup Local Supabase:**
```bash
# Inicializar Supabase en el proyecto
supabase init

# Iniciar servicios locales (requiere Docker)
supabase start

# Aplicar migraciones
supabase db push

# Generar types de TypeScript
supabase gen types typescript --local > src/lib/types/database.ts
```

### 2. Database Seed Data

```bash
# Poblar base de datos con datos de prueba
npm run db:seed

# Ejecutar migrations específicas
npm run db:migrate
```

## 🐳 Docker Setup (Opcional)

Para servicios adicionales como n8n local:

**Install Docker:**
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) para Windows/macOS
- Docker Engine para Linux

**Start n8n locally:**
```bash
# Crear docker-compose para n8n
cat > docker-compose.n8n.yml << EOF
version: '3.8'
services:
  n8n:
    image: n8nio/n8n:latest
    container_name: n8n_local
    restart: unless-stopped
    ports:
      - "5678:5678"
    environment:
      - N8N_BASIC_AUTH_ACTIVE=true
      - N8N_BASIC_AUTH_USER=admin
      - N8N_BASIC_AUTH_PASSWORD=admin
      - N8N_HOST=localhost
      - N8N_PORT=5678
      - N8N_PROTOCOL=http
      - WEBHOOK_URL=http://localhost:5678/
    volumes:
      - ~/.n8n:/home/node/.n8n
EOF

# Iniciar n8n
docker-compose -f docker-compose.n8n.yml up -d
```

## 🚀 First Run

### 1. Start Development Server

```bash
# Iniciar servidor de desarrollo
npm run dev

# Verificar que arranca en http://localhost:3000
# Debe mostrar la página de inicio sin errores
```

### 2. Run Tests

```bash
# Ejecutar tests unitarios
npm run test

# Ejecutar tests de integración
npm run test:integration

# Ejecutar linting
npm run lint

# Ejecutar type checking
npm run typecheck
```

### 3. Build Verification

```bash
# Verificar que el build de producción funciona
npm run build

# Iniciar en modo producción
npm run start
```

## 🛠️ Development Tools

### 1. GitHub CLI (Recomendado)

```bash
# Instalar GitHub CLI
# macOS
brew install gh

# Windows (usando Chocolatey)
choco install gh

# Ubuntu/Debian
curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
sudo apt update && sudo apt install gh

# Autenticar con GitHub
gh auth login
```

### 2. Useful VS Code Extensions (Adicionales)

```bash
# Productividad
code --install-extension ms-vscode-remote.remote-ssh
code --install-extension ms-vsliveshare.vsliveshare
code --install-extension gruntfuggly.todo-tree
code --install-extension christian-kohler.path-intellisense

# Next.js específicas
code --install-extension mhutchie.git-graph
code --install-extension formulahendry.auto-rename-tag
code --install-extension bradlc.vscode-tailwindcss
```

### 3. Browser Extensions

**Para Chrome/Edge:**
- [React Developer Tools](https://chrome.google.com/webstore/detail/react-developer-tools/fmkadmapgofadopljbjfkapdkoienihi)
- [Redux DevTools](https://chrome.google.com/webstore/detail/redux-devtools/lmhkpmbekcpmknklioeibfkpmmfibljd)
- [JSON Formatter](https://chrome.google.com/webstore/detail/json-formatter/bcjindcccaagfpapjjmafapmmgkkhgoa)

## 🔧 Troubleshooting

### Common Issues

#### 1. Node/npm Issues
```bash
# Limpiar cache de npm
npm cache clean --force

# Reinstalar node_modules
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps
```

#### 2. Permission Issues (Windows)
```bash
# Ejecutar como administrador y configurar execution policy
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

#### 3. WSL2 Issues (Windows)
```bash
# Verificar versión de WSL
wsl --version

# Actualizar WSL si es necesario
wsl --update
```

#### 4. Port Already in Use
```bash
# Encontrar proceso usando puerto 3000
lsof -ti:3000  # macOS/Linux
netstat -ano | findstr :3000  # Windows

# Matar proceso
kill -9 <PID>  # macOS/Linux
taskkill /PID <PID> /F  # Windows
```

### 🆘 Getting Help

Si encuentras problemas:

1. **Verificar Issues Comunes**: Revisar [troubleshooting guide](../troubleshooting/README.md)
2. **Slack Channel**: `#development-help`
3. **Team Lead**: Escalate si no puedes resolver en 2 horas
4. **Documentation**: Revisa docs específicas en `/docs/`

### ✅ Environment Validation Checklist

Antes de continuar, verifica que todo funciona:

- [ ] Node.js 20 instalado y funcionando
- [ ] Git configurado con SSH
- [ ] VS Code con extensiones requeridas
- [ ] Repositorio clonado y dependencies instaladas
- [ ] Variables de entorno configuradas
- [ ] Supabase local funcionando
- [ ] `npm run dev` arranca sin errores
- [ ] Tests pasan: `npm run test`
- [ ] Build funciona: `npm run build`
- [ ] Linting pasa: `npm run lint`

## 🎯 Next Steps

Una vez que tengas el entorno funcionando:

1. **Explorar Codebase**: [📖 Codebase Structure](./03-codebase-structure.md)
2. **Entender Workflow**: [🔄 Development Workflow](./04-development-workflow.md)
3. **Primera Tarea**: [🎯 First Tasks](./08-first-tasks-milestones.md)

---

**¡Perfecto! Tu entorno está listo para desarrollar.** 🎉

Si todo está funcionando correctamente, continúa con la siguiente sección para entender la estructura del código.