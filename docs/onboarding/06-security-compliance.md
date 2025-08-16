# 🛡️ 06. Security & Compliance

Esta guía cubre las políticas de seguridad, mejores prácticas y requisitos de compliance para **Agente Virtual IA**.

## 🔐 Security Fundamentals

### 🎯 Security Principles

```yaml
Zero Trust Architecture:
  principle: "Never trust, always verify"
  implementation: "Every request requires authentication"
  validation: "All inputs validated and sanitized"

Defense in Depth:
  layers: ["Network", "Application", "Data", "Identity"]
  redundancy: "Multiple security controls"
  monitoring: "Continuous security monitoring"

Least Privilege:
  access: "Minimum required permissions"
  duration: "Time-limited access where possible"
  review: "Regular access reviews"
```

### 🔑 Authentication & Authorization

#### Multi-Factor Authentication (MFA)
```typescript
// MFA Requirements
interface MFAPolicy {
  required_for: [
    "All production system access",
    "Admin panel access", 
    "Database direct access",
    "CI/CD system access"
  ]
  
  methods: [
    "TOTP (Google Authenticator, Authy)",
    "SMS (backup only)",
    "Hardware keys (YubiKey)"
  ]
  
  enforcement: "Cannot be disabled by users"
  backup_codes: "Generated and stored securely"
}
```

#### Role-Based Access Control (RBAC)
```typescript
// Access Control Matrix
const ACCESS_MATRIX = {
  'developer': {
    repositories: ['read', 'write'],
    qa_environment: ['read', 'write'],
    production: ['read'],
    database: ['read'] // QA database only
  },
  
  'senior_developer': {
    repositories: ['read', 'write', 'admin'],
    qa_environment: ['read', 'write', 'deploy'],
    production: ['read'],
    database: ['read', 'write'] // QA database
  },
  
  'tech_lead': {
    repositories: ['read', 'write', 'admin'],
    qa_environment: ['read', 'write', 'deploy'],
    production: ['read', 'write', 'deploy'],
    database: ['read', 'write'] // Production read, QA write
  },
  
  'admin': {
    repositories: ['read', 'write', 'admin'],
    qa_environment: ['read', 'write', 'deploy', 'admin'],
    production: ['read', 'write', 'deploy', 'admin'],
    database: ['read', 'write', 'admin']
  }
}
```

## 🔒 Code Security

### 🛡️ Secure Coding Practices

#### Input Validation
```typescript
// Always validate and sanitize inputs
import { z } from 'zod'

const CreateWorkflowSchema = z.object({
  name: z.string()
    .min(1, 'Name is required')
    .max(255, 'Name too long')
    .regex(/^[a-zA-Z0-9\s-_]+$/, 'Invalid characters'),
  
  description: z.string()
    .max(1000, 'Description too long')
    .optional(),
    
  nodes: z.array(z.object({
    id: z.string().uuid('Invalid node ID'),
    type: z.string().regex(/^[a-zA-Z0-9-]+$/, 'Invalid node type')
  }))
})

// ✅ Good: Validate all inputs
export async function createWorkflow(req: Request) {
  const validation = CreateWorkflowSchema.safeParse(req.body)
  if (!validation.success) {
    return Response.json(
      { error: 'Invalid input', details: validation.error },
      { status: 400 }
    )
  }
  // Process validated data...
}

// ❌ Bad: Direct use of user input
export async function createWorkflow(req: Request) {
  const { name } = req.body // Unvalidated input
  // Dangerous - could lead to injection attacks
}
```

#### SQL Injection Prevention
```typescript
// ✅ Good: Use parameterized queries
const { data, error } = await supabase
  .from('workflows')
  .select('*')
  .eq('tenant_id', tenantId) // Parameterized
  .ilike('name', `%${searchTerm}%`) // Safe with Supabase

// ✅ Good: Use query builders
const workflows = await supabase
  .from('workflows')
  .select(`
    id,
    name,
    description,
    users!inner(email)
  `)
  .eq('tenant_id', tenantId)

// ❌ Bad: String concatenation (if using raw SQL)
const query = `SELECT * FROM workflows WHERE name = '${userInput}'`
// Never do this - vulnerable to SQL injection
```

#### XSS Prevention
```typescript
// ✅ Good: Sanitize HTML content
import DOMPurify from 'dompurify'

function WorkflowDescription({ description }: { description: string }) {
  const sanitizedHTML = DOMPurify.sanitize(description)
  
  return (
    <div 
      dangerouslySetInnerHTML={{ __html: sanitizedHTML }}
    />
  )
}

// ✅ Good: Use React's built-in XSS protection
function WorkflowName({ name }: { name: string }) {
  // React automatically escapes this
  return <h1>{name}</h1>
}

// ❌ Bad: Direct HTML injection
function UnsafeComponent({ userContent }: { userContent: string }) {
  return (
    <div dangerouslySetInnerHTML={{ __html: userContent }} />
    // Vulnerable to XSS attacks
  )
}
```

### 🔐 Secrets Management

#### Environment Variables
```bash
# ✅ Good: Use proper environment variable naming
SUPABASE_SERVICE_ROLE_KEY=your_secret_key
STRIPE_SECRET_KEY=sk_test_...
JWT_SECRET=your-super-secret-jwt-key

# ❌ Bad: Exposed or weak secrets
SUPABASE_URL=https://project.supabase.co # This can be public
API_KEY=123456 # Weak secret
PASSWORD=admin # Never use default passwords
```

#### Git Security
```bash
# .gitignore - Always exclude sensitive files
.env.local
.env.production
*.pem
*.key
.secrets/
config/production.json

# git-secrets setup (recommended)
git secrets --register-aws
git secrets --install
git secrets --scan

# Pre-commit hook to prevent secrets
npm install --save-dev @commitlint/cli husky
echo 'npx git-secrets --scan' > .husky/pre-commit
```

#### API Key Rotation
```typescript
// API Key management best practices
interface APIKeyPolicy {
  rotation_schedule: "Every 90 days"
  storage: "Environment variables only"
  access_logging: "All API key usage logged"
  revocation: "Immediate revocation capability"
  
  implementation: {
    current_key: "STRIPE_SECRET_KEY"
    backup_key: "STRIPE_SECRET_KEY_BACKUP" 
    rotation_process: "Blue-green deployment pattern"
  }
}
```

## 🌐 Network Security

### 🔒 HTTPS & TLS

```yaml
TLS Configuration:
  minimum_version: "TLS 1.2"
  preferred_version: "TLS 1.3"
  certificate_authority: "Let's Encrypt"
  renewal: "Automatic via Netlify"
  
Security Headers:
  HSTS: "max-age=63072000; includeSubDomains; preload"
  CSP: "default-src 'self'; script-src 'self' 'unsafe-inline'"
  X-Frame-Options: "DENY"
  X-Content-Type-Options: "nosniff"
```

### 🛡️ Content Security Policy (CSP)

```typescript
// Next.js CSP configuration
const cspHeader = `
  default-src 'self';
  script-src 'self' 'unsafe-eval' 'unsafe-inline' https://js.stripe.com;
  style-src 'self' 'unsafe-inline';
  img-src 'self' blob: data: https:;
  font-src 'self';
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
  connect-src 'self' 
    https://*.supabase.co 
    wss://*.supabase.co 
    https://api.stripe.com;
  upgrade-insecure-requests;
`

// Apply in Next.js
export default function RootLayout({ children }) {
  return (
    <html>
      <head>
        <meta httpEquiv="Content-Security-Policy" content={cspHeader} />
      </head>
      <body>{children}</body>
    </html>
  )
}
```

## 💾 Data Security

### 🔐 Data Classification

```yaml
Public Data:
  examples: ["Marketing content", "Public documentation", "Open source code"]
  protection: "Basic integrity protection"
  
Internal Data:
  examples: ["Internal docs", "Code repositories", "Non-PII analytics"]
  protection: "Access controls, encryption in transit"
  
Confidential Data:
  examples: ["Customer data", "Financial records", "API keys"]
  protection: "Encryption at rest and in transit, strict access controls"
  
Restricted Data:
  examples: ["Payment information", "Personal identification", "Security credentials"]
  protection: "Maximum security, audit logging, need-to-know basis"
```

### 🔒 Encryption Standards

```typescript
// Data encryption implementation
interface EncryptionStandards {
  at_rest: {
    algorithm: "AES-256-GCM"
    key_management: "Supabase managed keys"
    database: "Transparent Data Encryption (TDE)"
  }
  
  in_transit: {
    protocol: "TLS 1.3"
    certificate: "Extended Validation SSL"
    endpoints: "All API communications encrypted"
  }
  
  application_level: {
    pii_fields: "Field-level encryption for PII"
    passwords: "bcrypt with salt rounds 12+"
    tokens: "JWT with RSA256 signing"
  }
}

// Example: Field-level encryption
import crypto from 'crypto'

export class DataEncryption {
  private algorithm = 'aes-256-gcm'
  private key: Buffer
  
  constructor() {
    this.key = crypto.scryptSync(process.env.ENCRYPTION_KEY!, 'salt', 32)
  }
  
  encrypt(text: string): string {
    const iv = crypto.randomBytes(16)
    const cipher = crypto.createCipher(this.algorithm, this.key)
    
    let encrypted = cipher.update(text, 'utf8', 'hex')
    encrypted += cipher.final('hex')
    
    const authTag = cipher.getAuthTag()
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`
  }
  
  decrypt(encryptedData: string): string {
    const [ivHex, authTagHex, encrypted] = encryptedData.split(':')
    
    const iv = Buffer.from(ivHex, 'hex')
    const authTag = Buffer.from(authTagHex, 'hex')
    
    const decipher = crypto.createDecipher(this.algorithm, this.key)
    decipher.setAuthTag(authTag)
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    
    return decrypted
  }
}
```

## 🔍 Security Monitoring

### 📊 Audit Logging

```typescript
// Comprehensive audit logging
interface AuditEvent {
  timestamp: Date
  user_id: string
  tenant_id: string
  action: string
  resource: string
  resource_id?: string
  ip_address: string
  user_agent: string
  success: boolean
  details?: Record<string, any>
}

export class AuditLogger {
  async log(event: AuditEvent): Promise<void> {
    // Log to database
    await supabase.from('audit_logs').insert({
      timestamp: event.timestamp.toISOString(),
      user_id: event.user_id,
      tenant_id: event.tenant_id,
      action: event.action,
      resource: event.resource,
      resource_id: event.resource_id,
      ip_address: event.ip_address,
      user_agent: event.user_agent,
      success: event.success,
      details: event.details
    })
    
    // Critical events also go to external SIEM
    if (this.isCriticalEvent(event)) {
      await this.sendToSIEM(event)
    }
  }
  
  private isCriticalEvent(event: AuditEvent): boolean {
    const criticalActions = [
      'login_failed',
      'permission_escalation',
      'data_export',
      'admin_action',
      'security_setting_change'
    ]
    
    return criticalActions.includes(event.action)
  }
}
```

### 🚨 Threat Detection

```typescript
// Automated threat detection
export class ThreatDetector {
  async detectAnomalies(userId: string): Promise<SecurityAlert[]> {
    const alerts: SecurityAlert[] = []
    
    // Check for brute force attacks
    const recentFailedLogins = await this.getFailedLogins(userId, 15) // 15 minutes
    if (recentFailedLogins > 5) {
      alerts.push({
        type: 'brute_force_detected',
        severity: 'high',
        user_id: userId,
        description: `${recentFailedLogins} failed login attempts in 15 minutes`
      })
    }
    
    // Check for unusual access patterns
    const accessPattern = await this.analyzeAccessPattern(userId)
    if (accessPattern.anomaly_score > 0.8) {
      alerts.push({
        type: 'unusual_access_pattern',
        severity: 'medium',
        user_id: userId,
        description: 'Access pattern differs significantly from baseline'
      })
    }
    
    // Check for privilege escalation
    const roleChanges = await this.getRecentRoleChanges(userId, 24) // 24 hours
    if (roleChanges.length > 0) {
      alerts.push({
        type: 'privilege_escalation',
        severity: 'critical',
        user_id: userId,
        description: 'User role permissions changed recently'
      })
    }
    
    return alerts
  }
}
```

## 📋 Compliance Requirements

### 🌍 GDPR Compliance

```yaml
Data Subject Rights:
  right_to_access: "Users can export their data"
  right_to_rectification: "Users can update their information"
  right_to_erasure: "Users can request account deletion"
  right_to_portability: "Data export in machine-readable format"
  
Data Processing:
  lawful_basis: "Consent and legitimate interest"
  purpose_limitation: "Data used only for stated purposes"
  data_minimization: "Collect only necessary data"
  retention_periods: "Defined for each data type"
  
Technical Measures:
  encryption: "Data encrypted at rest and in transit"
  pseudonymization: "PII pseudonymized where possible"
  access_controls: "Role-based access to personal data"
  audit_trails: "All data access logged"
```

### 🏢 SOC 2 Type II

```yaml
Security Commitments:
  access_controls: "Logical and physical access restrictions"
  change_management: "Formal change control process"
  risk_assessment: "Annual risk assessment performed"
  
Availability Commitments:
  uptime_target: "99.9% system availability"
  monitoring: "24/7 system monitoring"
  incident_response: "Defined incident response procedures"
  
Processing Integrity:
  data_validation: "Input validation on all user data"
  error_handling: "Comprehensive error handling and logging"
  transaction_processing: "ACID compliance for critical operations"
```

## 🚨 Incident Response

### 📞 Security Incident Procedure

```yaml
Detection Phase:
  automated_alerts: "Security monitoring systems"
  user_reports: "Users can report security concerns"
  external_notifications: "Security researchers, vendors"
  
Response Phase:
  assessment: "Determine scope and impact within 1 hour"
  containment: "Immediate action to prevent spread"
  eradication: "Remove threat from environment"
  recovery: "Restore normal operations"
  
Communication:
  internal: "Notify security team immediately"
  management: "Escalate to leadership within 2 hours"
  customers: "Notify affected customers if required"
  authorities: "Report to authorities if legally required"
  
Documentation:
  incident_log: "Detailed timeline of events"
  actions_taken: "All response actions documented"
  lessons_learned: "Post-incident review and improvements"
```

### 🔧 Emergency Procedures

```bash
# Emergency Response Playbook

# 1. Immediate Containment
# Block suspicious IP addresses
curl -X POST https://api.cloudflare.com/client/v4/zones/ZONE_ID/firewall/rules \
  -H "Authorization: Bearer $CF_API_TOKEN" \
  -d '{"mode":"block","configuration":{"target":"ip","value":"SUSPICIOUS_IP"}}'

# 2. Revoke Compromised Credentials
# Rotate API keys immediately
npm run security:rotate-keys

# 3. Enable Emergency Mode
# Restrict system access to admins only
npm run security:emergency-mode

# 4. Backup Critical Data
# Create immediate backup before investigation
npm run backup:emergency

# 5. Notify Team
# Send alert to security team
npm run alert:security-incident
```

## 🎓 Security Training

### 📚 Required Training

```yaml
New Hire Training:
  security_awareness: "General security principles (2 hours)"
  secure_coding: "OWASP Top 10 and secure coding practices (4 hours)"
  data_protection: "GDPR and data handling procedures (2 hours)"
  incident_response: "How to report and respond to incidents (1 hour)"
  
Annual Refresher:
  phishing_simulation: "Monthly phishing tests"
  security_updates: "Quarterly security updates briefing"
  compliance_training: "Annual compliance training"
  
Ongoing Education:
  tech_talks: "Security-focused tech talks"
  conferences: "Security conference attendance (budget provided)"
  certifications: "Security certification support"
```

### 🎯 Security Champions Program

```yaml
Program Structure:
  champions: "1 security champion per 5 developers"
  training: "Advanced security training provided"
  responsibilities:
    - "Promote security best practices"
    - "Review security-sensitive code changes"
    - "Conduct security training sessions"
    - "Stay updated on security trends"
  
Recognition:
  monthly_award: "Security champion of the month"
  conference_budget: "Additional conference budget"
  certification_support: "Company-sponsored security certifications"
```

## ✅ Security Checklist

### 🔍 Developer Checklist

Before every PR:
- [ ] No hardcoded secrets or credentials
- [ ] All user inputs validated and sanitized
- [ ] Authentication and authorization implemented correctly
- [ ] Sensitive data encrypted appropriately
- [ ] Error messages don't leak sensitive information
- [ ] Dependencies are up-to-date and secure
- [ ] SQL injection prevention implemented
- [ ] XSS protection in place
- [ ] CSRF protection for state-changing operations

### 🚀 Deployment Checklist

Before every production deployment:
- [ ] Security scan completed and passed
- [ ] Penetration testing completed (for major releases)
- [ ] Security configurations reviewed
- [ ] Access controls verified
- [ ] Monitoring and alerting configured
- [ ] Incident response procedures updated
- [ ] Security documentation updated
- [ ] Team notified of security-relevant changes

---

**Próximo paso**: [📖 Learning Resources](./07-learning-resources.md)