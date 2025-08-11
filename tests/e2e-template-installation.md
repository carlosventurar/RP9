# 🧪 End-to-End Template Installation Testing

## Objetivo
Probar el flujo completo de instalación de templates desde el frontend hasta n8n, verificando todos los componentes del sistema.

## Test Flow
```
Frontend → API Auth → Template Fetch → Sanitization → n8n Installation → Database Recording
```

## ✅ Test Cases

### 1. **API Endpoints Testing**

#### Test 1.1: GET /api/templates
```bash
curl -X GET "http://localhost:8888/.netlify/functions/templates" \
  -H "Content-Type: application/json"
```

**Expected Response:**
```json
{
  "success": true,
  "data": [...templates...],
  "pagination": {...},
  "filters": {...}
}
```

#### Test 1.2: GET /api/templates with filters
```bash
curl -X GET "http://localhost:8888/.netlify/functions/templates?category=E-commerce&difficulty=intermediate" \
  -H "Content-Type: application/json"
```

#### Test 1.3: POST /api/templates/install (without auth)
```bash
curl -X POST "http://localhost:8888/.netlify/functions/template-install" \
  -H "Content-Type: application/json" \
  -d '{"templateId": "test-id"}'
```

**Expected:** 401 Unauthorized

### 2. **Database Testing**

#### Test 2.1: Verify templates table exists
```sql
SELECT COUNT(*) FROM public.templates WHERE is_active = true;
```

#### Test 2.2: Check template data structure
```sql
SELECT id, name, category, difficulty, workflow_json 
FROM public.templates 
LIMIT 1;
```

#### Test 2.3: Verify RLS policies
```sql
-- Should work (public read)
SELECT name FROM public.templates WHERE is_active = true;
```

### 3. **Template Sanitization Testing**

#### Test 3.1: Sanitize workflow with credentials
```javascript
const testWorkflow = {
  nodes: [
    {
      name: "Test Node",
      type: "n8n-nodes-base.httpRequest",
      credentials: {
        httpBasicAuth: {
          id: "real-credential-id",
          name: "My API Key"
        }
      },
      parameters: {
        url: "https://api.example.com",
        authentication: "genericCredentialType",
        apiKey: "sk_live_abc123xyz"
      }
    }
  ]
}

// Run sanitization
const result = sanitizeTemplate(testWorkflow)
console.log('Sanitization Result:', result)
```

**Expected:** Credentials should be replaced with placeholders

### 4. **Authentication Testing**

#### Test 4.1: Login flow
```javascript
// Test Supabase auth
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'test@example.com',
  password: 'testpassword123'
})
```

#### Test 4.2: Token extraction
```javascript
// Test useAuth hook
const { token, isAuthenticated } = useAuth()
console.log('Auth Token:', token)
console.log('Is Authenticated:', isAuthenticated)
```

### 5. **Frontend Integration Testing**

#### Test 5.1: Template fetching
- Navigate to `/templates`
- Verify templates load from real API
- Check fallback to mock data if API fails
- Test search and filter functionality

#### Test 5.2: Installation flow
- Click "Install" button on a template
- Verify authentication check
- Monitor network requests
- Check success/error messages

### 6. **n8n Integration Testing**

#### Test 6.1: n8n API connectivity
```javascript
// Test n8n client creation
const client = await createN8nClient('tenant-id')
const workflows = await client.getWorkflows()
console.log('n8n Workflows:', workflows.length)
```

#### Test 6.2: Workflow creation
```javascript
const workflow = {
  name: 'Test Template Installation',
  nodes: [...sanitizedNodes...],
  connections: {...sanitizedConnections...}
}

const created = await client.createWorkflow(workflow)
console.log('Created Workflow ID:', created.id)
```

### 7. **Error Handling Testing**

#### Test 7.1: Invalid template ID
```bash
curl -X POST "http://localhost:8888/.netlify/functions/template-install" \
  -H "Authorization: Bearer valid-token" \
  -H "Content-Type: application/json" \
  -d '{"templateId": "invalid-id"}'
```

#### Test 7.2: Missing tenant
- Test with user who has no tenant
- Verify proper error response

#### Test 7.3: n8n connection failure
- Test with invalid n8n credentials
- Verify graceful error handling

### 8. **Performance Testing**

#### Test 8.1: Template loading time
- Measure API response time for 50+ templates
- Check database query performance

#### Test 8.2: Installation time
- Measure end-to-end installation time
- Test with complex workflows (10+ nodes)

## 📊 Success Criteria

### API Performance:
- ✅ `/api/templates` responds < 500ms
- ✅ `/api/templates/install` completes < 3s
- ✅ Proper error codes (401, 403, 404, 500)

### Data Integrity:
- ✅ Templates have valid workflow JSON
- ✅ Sanitization removes all credentials
- ✅ Installation records saved correctly

### User Experience:
- ✅ Frontend shows loading states
- ✅ Success/error messages clear
- ✅ Authentication flow seamless

### Security:
- ✅ Authentication required for installation
- ✅ No sensitive data in sanitized workflows
- ✅ Proper tenant isolation

## 🐛 Known Issues & Fixes

### Issue 1: Template table doesn't exist
**Fix:** Run `scripts/create-templates-table.sql` in Supabase

### Issue 2: n8n client connection errors  
**Fix:** Verify N8N_API_KEY and N8N_BASE_URL in environment

### Issue 3: Package.json type module errors
**Fix:** Already fixed with `"type": "module"`

## 🔄 Test Execution Plan

1. **Setup Phase**
   - [ ] Run database migration
   - [ ] Populate templates
   - [ ] Verify environment variables

2. **API Testing Phase**  
   - [ ] Test all endpoints manually
   - [ ] Verify responses and errors

3. **Integration Testing Phase**
   - [ ] Test frontend with real APIs
   - [ ] Test installation flow
   - [ ] Verify n8n integration

4. **Validation Phase**
   - [ ] Check database records
   - [ ] Verify n8n workflows created
   - [ ] Validate sanitization worked

## ⚡ Quick Test Commands

```bash
# Start development server
npm run dev

# Test API endpoints
curl -X GET "http://localhost:3000/api/templates"

# Run database migration (manual in Supabase)
# Copy-paste scripts/create-templates-table.sql

# Populate templates
npm run populate-templates

# Test frontend
# Navigate to http://localhost:3000/templates
```