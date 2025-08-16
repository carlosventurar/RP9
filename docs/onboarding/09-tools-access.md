# 🔧 09. Tools & Access

Guía completa para obtener acceso a todas las herramientas necesarias para desarrollar en **Agente Virtual IA**.

## 📋 Access Request Checklist

### 🎯 Day 1 - Critical Access
```yaml
Immediate Requirements:
  - [ ] GitHub repository access
  - [ ] Slack workspace invitation
  - [ ] Company email account
  - [ ] Supabase project access
  - [ ] Netlify dashboard access
  - [ ] 1Password team vault

Delivery Method: "IT onboarding email"
Timeline: "Within 2 hours of start date"
Contact: "IT Support - it@company.com"
```

### 🛠️ Week 1 - Development Tools
```yaml
Development Access:
  - [ ] n8n instance access (QA environment)
  - [ ] Figma design system access
  - [ ] Linear/GitHub Projects access
  - [ ] Vercel/Railway dashboards
  - [ ] Stripe test environment
  - [ ] Claude/OpenAI API keys (development)

Approval Required: "Tech Lead approval"
Timeline: "Within first week"
Contact: "Tech Lead - tech@company.com"
```

### 📊 Week 2-4 - Full Access
```yaml
Advanced Access:
  - [ ] Production monitoring dashboards
  - [ ] Analytics platforms access
  - [ ] Customer support tools
  - [ ] Production n8n (read-only)
  - [ ] Advanced debugging tools

Approval Required: "Manager + Security team"
Timeline: "After security training completion"
Contact: "Manager - manager@company.com"
```

## 💻 Development Tools

### 🔄 Version Control
```yaml
GitHub:
  url: "https://github.com/carlosventurar/RP9"
  access_level: "Write access to repository"
  team: "@agentevirtualia/developers"
  
  setup_steps:
    1. "Generate SSH key and add to GitHub"
    2. "Clone repository locally"
    3. "Configure git user.name and user.email"
    4. "Test push access with small commit"
    
  additional_repos:
    - "Documentation repository"
    - "Infrastructure scripts"
    - "Private packages"
```

### 💬 Communication
```yaml
Slack:
  workspace: "agentevirtualia.slack.com"
  auto_channels:
    - "#general" # Company announcements
    - "#development" # Technical discussions
    - "#qa-testing" # QA coordination
    - "#random" # Social interactions
    
  manual_channels:
    - "#architecture" # Architecture decisions
    - "#security" # Security discussions
    - "#product" # Product feedback
    - "#customers" # Customer feedback
    
  integrations:
    - "GitHub notifications"
    - "Netlify deployment alerts"
    - "Error monitoring alerts"
    - "Calendar reminders"
```

### 🎨 Design & UI
```yaml
Figma:
  access_type: "Viewer (developers), Editor (designers)"
  projects:
    - "Agente Virtual IA Design System"
    - "Component Library"
    - "Wireframes and Mockups"
    - "User Journey Maps"
    
  plugins_recommended:
    - "Figma to Code" # Generate React components
    - "Design Tokens" # Export design tokens
    - "Accessibility" # A11y checking
    
  handoff_process:
    1. "Designer shares Figma link in ticket"
    2. "Developer reviews design and asks questions"
    3. "Implementation follows design specs"
    4. "Designer reviews implementation"
```

## 📅 Project Management

### 🎯 GitHub Projects
```yaml
Project_Boards:
  "Sprint Planning":
    columns: ["Backlog", "Sprint", "In Progress", "Review", "Done"]
    access: "All team members"
    
  "Bug Tracking":
    columns: ["New", "Triaged", "In Progress", "Testing", "Resolved"]
    priority_labels: ["P0-Critical", "P1-High", "P2-Medium", "P3-Low"]
    
  "Feature Development":
    columns: ["Discovery", "Design", "Development", "Testing", "Released"]
    epic_tracking: "Linked to GitHub milestones"

Workflow:
  1. "Create issue with proper template"
  2. "Add labels and assign to project"
  3. "Move through columns as work progresses"
  4. "Link PRs to close issues automatically"
```

### 📈 Time Tracking
```yaml
Toggl_Track:
  purpose: "Project time tracking for billing/analytics"
  projects:
    - "Development - Core Features"
    - "Development - Bug Fixes"
    - "Testing - QA Activities"
    - "Meetings - Team Collaboration"
    - "Learning - Training and Research"
    
  expectations:
    - "Track time daily"
    - "Use descriptive task names"
    - "Submit weekly timesheets"
    - "Tag tasks with appropriate project"
```

## 📊 Monitoring & Analytics

### 👁️ Application Monitoring
```yaml
Netlify_Analytics:
  access: "Read-only for developers"
  metrics:
    - "Page views and traffic"
    - "Build performance"
    - "Function execution times"
    - "Error rates"
    
Supabase_Dashboard:
  access: "Project member"
  monitoring:
    - "Database performance"
    - "API usage metrics"
    - "Real-time connections"
    - "Storage usage"
```

### 📊 Error Tracking
```yaml
Sentry: # To be implemented
  purpose: "Error tracking and performance monitoring"
  access: "Developer role"
  alerts:
    - "New error types"
    - "Error rate spikes"
    - "Performance degradation"
    
Integrations:
  - "Slack notifications for critical errors"
  - "GitHub issue creation for bugs"
  - "Email alerts for downtime"
```

## 🔐 Security Tools

### 🔑 Password Management
```yaml
1Password:
  vault: "Agente Virtual IA Team"
  categories:
    - "Development" # API keys, test accounts
    - "Production" # Production credentials (limited access)
    - "Services" # Third-party service logins
    - "Shared" # Team shared accounts
    
  best_practices:
    - "Never share passwords outside 1Password"
    - "Use unique passwords for all accounts"
    - "Enable 2FA where available"
    - "Regularly audit access and remove unused accounts"
```

### 🔒 VPN & Network
```yaml
VPN_Access:
  provider: "Company VPN solution"
  requirement: "Required for production system access"
  setup:
    1. "Download VPN client"
    2. "Import configuration profile"
    3. "Test connection"
    4. "Verify access to internal systems"
    
  usage:
    - "Always connect before accessing production"
    - "Required for database direct access"
    - "Needed for internal admin panels"
```

## 📎 Environment Access

### 🧪 Development Environment
```yaml
Local_Development:
  requirements:
    - "Node.js 20+ installed"
    - "Git configured with SSH"
    - "Environment variables configured"
    - "Local database connection"
    
  access_needed:
    - "Supabase local project setup"
    - "Stripe test environment keys"
    - "n8n development instance"
    - "AI API keys (development quota)"
```

### 🧪 QA Environment
```yaml
QA_Environment:
  url: "https://qa-agentevirtualia.netlify.app"
  access:
    - "Automatic deployment from qa branch"
    - "All team members have access"
    - "Test data reset weekly"
    
  credentials:
    - "QA test accounts in 1Password"
    - "Stripe test mode enabled"
    - "n8n QA instance access"
    - "Debug tools enabled"
```

### 🔒 Production Environment (Limited)
```yaml
Production_Access:
  principle: "Least privilege access"
  levels:
    
    developer:
      - "Read-only dashboard access"
      - "Log viewing permissions"
      - "No direct database access"
      
    senior_developer:
      - "Limited production debugging"
      - "Deploy access for hotfixes"
      - "Read-only database queries"
      
    tech_lead:
      - "Full production access"
      - "Database admin capabilities"
      - "Infrastructure management"
      
  approval_process:
    1. "Request access via IT ticket"
    2. "Manager approval required"
    3. "Security team review"
    4. "Time-limited access granted"
```

## 💳 API Keys & Credentials

### 🔑 Development APIs
```yaml
API_Key_Management:
  supabase:
    - "Project URL (public)"
    - "Anon key (public)"
    - "Service role key (private)"
    
  stripe:
    - "Publishable key (test mode)"
    - "Secret key (test mode)"
    - "Webhook signing secret"
    
  ai_services:
    - "OpenAI API key (development quota)"
    - "Anthropic API key (development quota)"
    
  third_party:
    - "n8n API key"
    - "GitHub personal access token"
    - "Netlify build hooks"
```

### 🔐 Key Rotation Policy
```yaml
Rotation_Schedule:
  development_keys: "Every 6 months"
  production_keys: "Every 3 months"
  personal_tokens: "Every 12 months"
  
Process:
  1. "Generate new keys"
  2. "Update environment variables"
  3. "Test all integrations"
  4. "Revoke old keys"
  5. "Update documentation"
  
Emergency_Rotation:
  trigger: "Suspected compromise"
  timeline: "Within 2 hours"
  notification: "All team members notified"
```

## 🔧 Development Tools Setup

### ✨ VS Code Extensions
```yaml
Required_Extensions:
  - "ms-vscode.vscode-typescript-next" # TypeScript support
  - "bradlc.vscode-tailwindcss" # Tailwind CSS IntelliSense
  - "ms-vscode.vscode-eslint" # ESLint integration
  - "esbenp.prettier-vscode" # Code formatting
  - "ms-playwright.playwright" # E2E testing
  
Recommended_Extensions:
  - "ms-vscode-remote.remote-ssh" # Remote development
  - "ms-vsliveshare.vsliveshare" # Live collaboration
  - "gruntfuggly.todo-tree" # TODO tracking
  - "christian-kohler.path-intellisense" # Path autocomplete
  - "mhutchie.git-graph" # Git visualization
```

### 📱 Browser Extensions
```yaml
Chrome_Extensions:
  development:
    - "React Developer Tools"
    - "Redux DevTools"
    - "JSON Formatter"
    - "Lighthouse"
    
  design:
    - "Figma"
    - "ColorZilla"
    - "Dimensions"
    
  productivity:
    - "1Password"
    - "Grammarly"
    - "Notion Web Clipper"
```

## 🎆 Access Troubleshooting

### 🔧 Common Issues
```yaml
GitHub_SSH_Issues:
  problem: "Permission denied (publickey)"
  solution:
    1. "Check SSH key is added to GitHub"
    2. "Verify SSH agent is running"
    3. "Test with ssh -T git@github.com"
    4. "Regenerate SSH key if needed"
    
Supabase_Connection:
  problem: "Database connection failed"
  solution:
    1. "Verify environment variables"
    2. "Check VPN connection"
    3. "Confirm project access in dashboard"
    4. "Test with Supabase CLI"
    
Netlify_Deploy_Issues:
  problem: "Build failing on Netlify"
  solution:
    1. "Check build logs for errors"
    2. "Verify environment variables set"
    3. "Test build locally first"
    4. "Check Node.js version compatibility"
```

### 🆘 Support Contacts
```yaml
IT_Support:
  email: "it@company.com"
  slack: "#it-support"
  hours: "9 AM - 6 PM CET"
  emergency: "After hours on-call available"
  
Security_Team:
  email: "security@company.com"
  slack: "#security"
  response: "24 hours for non-urgent, 2 hours for urgent"
  
Tech_Lead:
  slack: "@tech-lead"
  email: "tech-lead@company.com"
  availability: "9 AM - 7 PM CET"
  
Manager:
  slack: "@manager"
  email: "manager@company.com"
  1on1: "Weekly scheduled meetings"
```

---

**Próximo paso**: [📊 Feedback & Improvement](./10-feedback-improvement.md)