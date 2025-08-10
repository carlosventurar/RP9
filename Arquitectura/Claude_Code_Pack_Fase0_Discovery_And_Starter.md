
# Claude Code Pack — Fase 0: Discovery & Starter Baseline (RP9)

**Stack:** GitHub · Netlify · Supabase · Stripe · n8n (Railway)  
**Objetivo:** documentar decisiones de **Discovery (pre‑Fase 1)** y entregar un **starter** funcional (BFF + mini‑builder + métricas).

---

## 0) Decisiones (resumen)
> Compilación de respuestas del Q&A inicial (pre‑Fase 1).

- Segmento/Packaging: **A con C upsell Enterprise**  
- Onboarding: **A**  
- Planes: **B** (fijos con escalones)  
- Checkout: **B**  
- Métrica de valor mostrada: **C**  
- Catálogo de plantillas: **C**  
- GTM Motion: **B (B2B serio) + A self‑serve**  
- Garantía/Compromiso: **C**  
- Asistencia humana: **C**  
- Add‑ons: **A+B+C (3–5 visibles)**  
- Marca pública: **A** (B2B serio)  
- Billing engine: **B ahora**, explorar C luego  
- Cobro mixto: **C** (flex SMB, predecible Enterprise)  
- Descuentos: **A+B**  
- Límites/Enforcement: **A+C**  
- Facturación en UI: **B ahora**, **C después**  
- Anclaje de valor: **C**  
- Precios públicos: **C** (mínimos), **B** guía  
- Dunning: **B**  
- Cláusulas Enterprise: **B** (precio fijo por término)

> JSON con decisiones: `decisions.json`. CSV: `qna.csv`.

---

## 1) Master Prompt (para Claude Code)
Copia/pega:

```
Eres un ingeniero full‑stack senior. En el monorepo `rp9/` crea un **starter** listo para producción mínimo viable:
- **apps/portal** (Next.js App Router + Tailwind + shadcn/ui + Recharts).
- **apps/bff** (Express/Node 18) con rate‑limit y HMAC para webhooks.
- **infra/supabase** (migraciones SQL).

Conecta mi n8n en Railway (`N8N_BASE_URL=https://primary-production-7f25.up.railway.app`) usando `X-N8N-API-KEY`.  
Incluye:
1) **Mini‑builder** (React Flow) que exporta JSON n8n y upsert via BFF.
2) **Dashboard** de ejecuciones (últimos 7 días) con datos de `/api/v1/executions`.
3) **Collector** cron (Netlify Function) que inserta `usage_executions` en Supabase (idempotente).
4) Página **Templates** (grid) con 6 plantillas por vertical (Contact Center y Finanzas).
5) Seguridad base: HMAC en webhooks, rate‑limit 300 req/min/IP, desactivar telemetría en n8n.
6) `.env.example`, **README**, y **tests stubs**.

Entrega código tipado, validación con zod para endpoints y UI moderna (rounded‑2xl, sombras suaves, dark mode).
```

---

## 2) Esquema SQL (Supabase)
```sql
-- usage por ejecución (metered)
create table if not exists usage_executions (
  id bigserial primary key,
  tenant text not null,
  workflow_id text not null,
  execution_id text unique,
  status text not null,           -- success|error|waiting
  started_at timestamptz,
  stopped_at timestamptz,
  duration_ms bigint,
  created_at timestamptz default now()
);
create index if not exists idx_usage_tenant_time on usage_executions (tenant, created_at desc);
```

---

## 3) BFF (Express) — Starter
```js
// server/index.js
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const axios = require('axios');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb', verify:(req, res, buf)=>{ req.rawBody = buf; } }));
app.use(morgan('tiny'));
app.use(rateLimit({ windowMs: 60_000, max: 300 }));

const PORT = process.env.PORT || 4000;
const N8N_BASE_URL = (process.env.N8N_BASE_URL || '').replace(/\/$/, '');
const N8N_API_KEY = process.env.N8N_API_KEY || '';

function api() {
  return axios.create({
    baseURL: `${N8N_BASE_URL}/api/v1`,
    headers: { 'X-N8N-API-KEY': N8N_API_KEY, 'accept': 'application/json' },
    timeout: 15000,
  });
}

function verifyHmac(req, secret) {
  const sig = req.header('x-rp9-signature') || '';
  const mac = crypto.createHmac('sha256', secret).update(req.rawBody || '').digest('hex');
  try { return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(mac)); } catch { return false; }
}

// Listar workflows
app.get('/api/workflows', async (req, res) => {
  try { const { data } = await api().get('/workflows', { params: { limit: 250 } }); res.json(data); }
  catch (e) { res.status(e.response?.status||500).json({ error: e.message, details: e.response?.data }); }
});

// Upsert workflow por name
app.post('/api/workflows', async (req, res) => {
  try {
    const wf = req.body?.workflow;
    if (!wf?.name || !Array.isArray(wf?.nodes)) return res.status(400).json({ error: 'workflow inválido' });
    const list = await api().get('/workflows', { params: { limit: 250 } });
    const existing = (list.data?.data||[]).find(w => w.name === wf.name);
    const out = existing ? await api().patch(`/workflows/${existing.id}`, wf) : await api().post(`/workflows`, wf);
    res.json(out.data);
  } catch (e) {
    res.status(e.response?.status||500).json({ error: e.message, details: e.response?.data });
  }
});

// Ejecutions (para métricas)
app.get('/api/executions', async (req, res) => {
  try { const { data } = await api().get('/executions', { params: req.query }); res.json(data); }
  catch (e) { res.status(e.response?.status||500).json({ error: e.message, details: e.response?.data }); }
});

app.listen(PORT, () => console.log('RP9 BFF on :' + PORT));
```

**.env.example**
```
PORT=4000
N8N_BASE_URL=https://primary-production-7f25.up.railway.app
N8N_API_KEY=REEMPLAZAR
```

---

## 4) Mini‑Builder (Next.js + React Flow)
```tsx
// web/app/flows/new/page.tsx
'use client';
import React, { useState } from 'react';
import ReactFlow, { Background, Controls, addEdge, MiniMap, Connection, Edge, Node } from 'reactflow';
import 'reactflow/dist/style.css';
import axios from 'axios';

const initialNodes: Node[] = [
  { id: 'manual', position: { x: 0, y: 0 }, data: { label: 'Manual Trigger' }, type: 'input' },
  { id: 'http', position: { x: 280, y: 0 }, data: { label: 'HTTP Request' }, type: 'default' },
];
const initialEdges: Edge[] = [];

export default function NewFlowPage() {
  const [nodes, setNodes] = useState<Node[]>(initialNodes);
  const [edges, setEdges] = useState<Edge[]>(initialEdges);
  const [name, setName] = useState('RP9 – Demo Flow');
  const onConnect = (c: Connection) => setEdges((eds) => addEdge(c, eds));

  function toN8nJSON() {
    const nodeById: Record<string, any> = {};
    for (const n of nodes) {
      if (n.id === 'manual') nodeById[n.id] = { id:'1', name:'Manual Trigger', type:'n8n-nodes-base.manualTrigger', typeVersion:1, position:[n.position.x,n.position.y], parameters:{} };
      if (n.id === 'http') nodeById[n.id] = { id:'2', name:'HTTP Request', type:'n8n-nodes-base.httpRequest', typeVersion:4, position:[n.position.x,n.position.y], parameters:{ url:'https://httpbin.org/get', method:'GET' } };
    }
    const connections:any = {};
    for (const e of edges) {
      const src = nodeById[e.source]?.name, tgt = nodeById[e.target]?.name; if (!src||!tgt) continue;
      connections[src] = connections[src] || { main:[[]] };
      connections[src].main[0].push({ node: tgt, type:'main', index:0 });
    }
    return { name, active:false, nodes:Object.values(nodeById), connections, settings:{ saveDataErrorExecution:'all' } };
  }

  async function save() {
    const workflow = toN8nJSON();
    const { data } = await axios.post('/api/workflows', { workflow });
    alert('Creado/actualizado: ' + (data?.id || 'ok'));
  }

  return (
    <div className="p-4">
      <div className="flex gap-2 items-center mb-3">
        <input className="border px-2 py-1 rounded w-80" value={name} onChange={e=>setName(e.target.value)} />
        <button className="px-3 py-2 rounded bg-black text-white" onClick={save}>Guardar en n8n</button>
      </div>
      <div style={{ height: 520, border: '1px solid #eee', borderRadius: 8 }}>
        <ReactFlow nodes={nodes} edges={edges} onNodesChange={setNodes as any} onEdgesChange={setEdges as any} onConnect={onConnect}>
          <MiniMap /><Controls /><Background />
        </ReactFlow>
      </div>
    </div>
  );
}
```

---

## 5) Docker Compose (local dev)
```yaml
version: '3.9'
services:
  rp9-bff:
    build: ./server
    ports: ["4000:4000"]
    environment:
      - N8N_BASE_URL=${N8N_BASE_URL}
      - N8N_API_KEY=${N8N_API_KEY}
  rp9-web:
    build: ./web
    ports: ["3000:3000"]
```

---

## 6) Cómo usar este Pack
1) Carga `decisions.json` y `qna.csv` a tu repo (`/docs/` o `/ops/`).  
2) Pega el **Master Prompt** en Claude Code para que te genere el monorepo inicial.  
3) Copia el **BFF** y el **mini‑builder** si quieres arrancar de inmediato.  
4) Ejecuta la migración SQL de `usage_executions`.  
5) Configura `.env` y despliega en Netlify/VPS.

> Este Pack es el “prequel” de Fase 1/2/3. Te deja el baseline listo y documentado.
