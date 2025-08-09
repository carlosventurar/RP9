RP9 — Portal White‑Label sobre n8n

Este documento propone la arquitectura, módulos y un starter (backend + frontend) para lanzar un portal marca RP9 encima de n8n, sin exponer la UI nativa. Incluye endpoints base para hablar con el API público de n8n, un editor visual mínimo con React Flow que exporta a JSON de n8n y un esquema de métricas/facturación por uso.

1) Arquitectura propuesta (alto nivel)

┌───────────────┐    JWT/SSO    ┌────────────────────┐   X-N8N-API-KEY   ┌─────────────────────┐
│  Cliente RP9  │ ─────────────▶ │  RP9 Web (Next.js) │ ─────────────────▶ │  RP9 BFF (Express)  │
└───────────────┘                └────────────────────┘                    └─────────┬───────────┘
      ▲                                        ▲                                         │
      │  Webhooks / Forms                      │ Graphs/Stats                             │ Axios
      │                                        │                                           │
      │                                  ┌─────┴─────┐                                     │
      │                                  │  Redis    │◀─ Queue mode (opcional) ────────────┤
      │                                  └───────────┘                                     │
      │                                                                                     │
      │                                                                                     ▼
      │                                                         ┌────────────────────────────────────────────┐
      │                                                         │  n8n (1 por cliente o compartido con       │
      │                                                         │  Projects + RBAC)                          │
      │                                                         │  • API público /api/v1/*                   │
      │                                                         │  • Credenciales y Workflows por tenant     │
      │                                                         └────────────────────────────────────────────┘
      │                                                                                     │
      │                                                                                     ▼
      │                                                         ┌────────────────────────────────────────────┐
      │                                                         │  Postgres (n8n) + RP9 DB (tenants, uso)    │
      │                                                         └────────────────────────────────────────────┘

Modelos de tenant:

A. Dedicado: un n8n por cliente (máxima aislación, recomendado para enterprise).

B. Compartido: un n8n usando Projects + RBAC por cliente (menor costo, menor aislación).

C. Híbrido: empezar compartido y “promocionar” a dedicado cuando sube el consumo.

2) Módulos del portal RP9

Builder visual (React Flow) con export a JSON de n8n.

Catálogo de plantillas por industria (e‑commerce, telemedicina, WhatsApp, Genesys, etc.).

Dashboard: ejecuciones/día, éxito, errores, latencia p95, consumo por flujo/tenant.

Facturación: planes + sobreuso (Stripe). Métrica base: recuento de ejecuciones y/o duración total.

Configuración: variables, secretos, webhooks firmados (HMAC), IP allowlist, claves API por flujo.

Alertas: al Slack/Teams/WhatsApp ante fallos o colas retenidas.

Dev/Stage/Prod (si usas Environments + Git en n8n Enterprise) o flujo de promoción manual.

Auditoría: quién cambió qué (historial + diff de workflow JSON), logs y export CSV/Parquet.

3) Starter — Backend (Express)

Archivo: server/index.js

// RP9 BFF minimal – Express + Axios
// npm i express cors axios morgan
// node server/index.js

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(morgan('tiny'));

// ENV
const PORT = process.env.PORT || 4000;
const DEFAULT_BASE = process.env.N8N_BASE_URL_DEFAULT; // ej: https://primary-production-7f25.up.railway.app
const DEFAULT_KEY = process.env.N8N_API_KEY_DEFAULT;   // API Key del owner

// Opcional: mapa de tenants → { baseUrl, apiKey }
// Define TENANT_MAP como JSON en .env, por ejemplo:
// TENANT_MAP={"acme":{"baseUrl":"https://acme-n8n.example.com","apiKey":"sk_..."}}
let TENANT_MAP = {};
try { TENANT_MAP = JSON.parse(process.env.TENANT_MAP || '{}'); } catch {}

function resolveTenant(req) {
  const t = (req.header('x-tenant') || req.query.tenant || '').toLowerCase();
  const entry = TENANT_MAP[t];
  return {
    baseUrl: entry?.baseUrl || DEFAULT_BASE,
    apiKey: entry?.apiKey || DEFAULT_KEY,
    tenant: t || 'default',
  };
}

function n8nAxios({ baseUrl, apiKey }) {
  return axios.create({
    baseURL: `${baseUrl.replace(/\/$/, '')}/api/v1`,
    headers: { 'X-N8N-API-KEY': apiKey, 'accept': 'application/json' },
    timeout: 15000,
  });
}

// Listar workflows
app.get('/api/workflows', async (req, res) => {
  try {
    const ctx = resolveTenant(req);
    const api = n8nAxios(ctx);
    const { active } = req.query; // opcional
    const { data } = await api.get(`/workflows`, { params: { active } });
    res.json({ tenant: ctx.tenant, data });
  } catch (err) {
    res.status(err.response?.status || 500).json({ error: err.message, details: err.response?.data });
  }
});

// Crear/actualizar workflow (upsert por name)
app.post('/api/workflows', async (req, res) => {
  try {
    const ctx = resolveTenant(req);
    const api = n8nAxios(ctx);
    const wf = req.body?.workflow;
    if (!wf || !wf.name || !Array.isArray(wf.nodes)) {
      return res.status(400).json({ error: 'workflow inválido: requiere name y nodes[]' });
    }
    // Buscar si existe por nombre
    const list = await api.get('/workflows', { params: { limit: 250 } });
    const existing = (list.data?.data || []).find(w => w.name === wf.name);
    let out;
    if (existing) {
      out = await api.patch(`/workflows/${existing.id}`, wf);
    } else {
      out = await api.post(`/workflows`, wf);
    }
    res.json({ tenant: ctx.tenant, data: out.data });
  } catch (err) {
    res.status(err.response?.status || 500).json({ error: err.message, details: err.response?.data });
  }
});

// Ejecutar workflow manualmente (si procede)
app.post('/api/workflows/:id/run', async (req, res) => {
  try {
    const ctx = resolveTenant(req);
    const api = n8nAxios(ctx);
    const { id } = req.params;
    const { data } = await api.post(`/workflows/${id}/run`, req.body || {});
    res.json({ tenant: ctx.tenant, data });
  } catch (err) {
    res.status(err.response?.status || 500).json({ error: err.message, details: err.response?.data });
  }
});

// Ejecutions (para métricas)
app.get('/api/executions', async (req, res) => {
  try {
    const ctx = resolveTenant(req);
    const api = n8nAxios(ctx);
    const params = { ...req.query }; // admite: status, limit, lastId, workflowId, includeData
    const { data } = await api.get(`/executions`, { params });
    res.json({ tenant: ctx.tenant, data });
  } catch (err) {
    res.status(err.response?.status || 500).json({ error: err.message, details: err.response?.data });
  }
});

app.listen(PORT, () => console.log(`RP9 BFF on :${PORT}`));

Archivo: .env.example

# BFF
PORT=4000
# n8n por defecto (si no llega x-tenant)
N8N_BASE_URL_DEFAULT=https://primary-production-7f25.up.railway.app
N8N_API_KEY_DEFAULT=REEMPLAZAR
# Opcional: mapa de tenants (JSON)
TENANT_MAP={"acme":{"baseUrl":"https://acme-n8n.example.com","apiKey":"sk_xxx"}}
# Stripe (para facturación por uso)
STRIPE_SECRET=sk_test_xxx

4) Starter — Frontend (Next.js + React Flow)

Instala: npm i react react-dom next reactflow axios dayjs

Archivo: web/app/flows/new/page.tsx

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
    // Mapea un grafo básico a estructura n8n
    const nodeById: Record<string, any> = {};
    for (const n of nodes) {
      if (n.id === 'manual') {
        nodeById[n.id] = {
          id: '1', name: 'Manual Trigger', type: 'n8n-nodes-base.manualTrigger', typeVersion: 1,
          position: [n.position.x, n.position.y], parameters: {}
        };
      } else if (n.id === 'http') {
        nodeById[n.id] = {
          id: '2', name: 'HTTP Request', type: 'n8n-nodes-base.httpRequest', typeVersion: 4,
          position: [n.position.x, n.position.y], parameters: { url: 'https://httpbin.org/get', method: 'GET' }
        };
      }
    }
    const connections: any = {};
    for (const e of edges) {
      const srcName = nodeById[e.source]?.name; if (!srcName) continue;
      const tgtName = nodeById[e.target]?.name; if (!tgtName) continue;
      connections[srcName] = connections[srcName] || { main: [[]] };
      connections[srcName].main[0].push({ node: tgtName, type: 'main', index: 0 });
    }
    return {
      name,
      active: false,
      nodes: Object.values(nodeById),
      connections,
      settings: { saveDataErrorExecution: 'all' },
    };
  }

  async function save() {
    const workflow = toN8nJSON();
    const { data } = await axios.post('/api/workflows', { workflow }, { headers: { 'x-tenant': 'default' } });
    alert('Creado/actualizado: ' + (data?.data?.id || 'ok'));
  }

  return (
    <div className="p-4">
      <div className="flex gap-2 items-center mb-3">
        <input className="border px-2 py-1 rounded w-80" value={name} onChange={e=>setName(e.target.value)} />
        <button className="px-3 py-2 rounded bg-black text-white" onClick={save}>Guardar en n8n</button>
      </div>
      <div style={{ height: 520, border: '1px solid #eee', borderRadius: 8 }}>
        <ReactFlow nodes={nodes} edges={edges} onNodesChange={setNodes as any} onEdgesChange={setEdges as any} onConnect={onConnect}>
          <MiniMap />
          <Controls />
          <Background />
        </ReactFlow>
      </div>
    </div>
  );
}

Nota: este editor es deliberadamente mínimo para MVP. Si adquieres n8n Embed, puedes incrustar el editor oficial con white‑labelling y ahorrarte mantener un builder propio.

5) Métricas y facturación (Stripe)

Métrica sugerida: ejecuciones_correctas + ejecuciones_error por ciclo, y/o segundos de ejecución = stoppedAt - startedAt (si disponible). Guardar por tenant_id, workflow_id, día.

RP9 BFF puede cronear GET /api/v1/executions?limit=...&workflowId=... por tenant, acumular métricas y reportar a Stripe (subida de usage para productos metered).

Tabla ejemplo (RP9 DB) usage_executions

CREATE TABLE usage_executions (
  id BIGSERIAL PRIMARY KEY,
  tenant TEXT NOT NULL,
  workflow_id TEXT NOT NULL,
  status TEXT NOT NULL,           -- success|error|waiting
  started_at TIMESTAMPTZ,
  stopped_at TIMESTAMPTZ,
  duration_ms BIGINT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX ON usage_executions (tenant, workflow_id, created_at);

6) Docker Compose (dev local)

Archivo: docker-compose.yml

version: '3.9'
services:
  rp9-bff:
    build: ./server
    ports: ["4000:4000"]
    environment:
      - N8N_BASE_URL_DEFAULT=${N8N_BASE_URL_DEFAULT}
      - N8N_API_KEY_DEFAULT=${N8N_API_KEY_DEFAULT}
      - TENANT_MAP=${TENANT_MAP}
  rp9-web:
    build: ./web
    ports: ["3000:3000"]
  redis:
    image: redis:7
  # Ejemplo de n8n local (opcional para pruebas)
  n8n:
    image: n8nio/n8n:latest
    ports: ["5678:5678"]
    environment:
      - N8N_ENCRYPTION_KEY=super_secret_key
      - N8N_QUEUE_BULL_REDIS_HOST=redis
      - N8N_EXECUTIONS_MODE=queue
      - N8N_DIAGNOSTICS_ENABLED=false
      - N8N_PERSONALIZATION_ENABLED=false
    depends_on: [redis]

7) Roadmap sugerido por fases

Fase 1 (MVP): auth, builder mínimo / Embed, plantillas, listar/crear/activar workflows, dashboard simple, métricas de ejecuciones, planes fijos.

Fase 2: facturación por uso, alertas, roles por cliente, webhooks firmados, quote/limit.

Fase 3: entornos Dev/Stage/Prod + Git (si Enterprise), migrador a instancia dedicada, autoscaling en queue mode.

8) Buenas prácticas clave

Usar API Key vía cabecera X-N8N-API-KEY.

Queue mode con Redis para escalar workers si hay alta concurrencia.

Projects + RBAC si optas por instancia compartida.

No persistir payloads sensibles en logs/ejecuciones sin consentimiento; habilitar borrado/pruning.

Firmar webhooks y validar HMAC en el BFF antes de reenviar a n8n.

9) Próximos extras (qué más podemos hacer)

Marketplace de soluciones RP9 (flows pre‑armados por vertical) con 1‑click deploy.

Portal de credenciales por cliente (UX amigable, con pruebas y health‑check de conexiones).

Monitoreo con Prometheus/Grafana, y Log streaming (Datadog/Splunk) si usas Enterprise.

Asistente IA in‑portal para explicar fallos, sugerir nodos y generar flujos desde lenguaje natural.

Multi‑región y disaster recovery con backups de DB y export automático de workflows.

Notas

Reemplaza las URLs/keys. El BFF asume un owner API Key por tenant.

Si adquieres n8n Embed, puedes white‑label completo (colores, logo, dominios) y mostrar el editor oficial dentro del portal.



RP9 Ultimate — Mejoras sobre la propuesta de Claude (UI + Correcciones + Prod Ready)

A continuación se consolidan mejoras técnicas y de UX/UI para convertir el stack en una edición RP9 Ultimate lista para producción, corrigiendo envs de n8n, reforzando seguridad, y añadiendo un UI Kit moderno.

A) Correcciones y decisiones técnicas clave

Subdominios por cliente (recomendado): cliente.rp9.io — menos fricción con WebSockets/CORS y WEBHOOK_URL.

Variables n8n CORRECTAS (importante):

✅ N8N_EXECUTIONS_MODE=queue (no EXECUTIONS_MODE).

✅ N8N_QUEUE_BULL_REDIS_HOST=redis (no QUEUE_BULL_REDIS_HOST).

✅ N8N_EDITOR_BASE_URL=https://cliente.rp9.io/ (si expones editor).

✅ N8N_METRICS=true para Prometheus.

Proxy: Traefik (labels por servicio, TLS automático) → más simple que Nginx/NGPM y mejor para escalar multi-tenant.

Seguridad: HMAC en webhooks, rate‑limit por API Key, 2FA/SSO en portal, pruning de ejecuciones y desactivar telemetría.

Supabase/Netlify útiles para MVP, pero BFF propio (Express/Fastify) controla mejor claves, límites y auditoría.

B) Compose de Producción (Traefik + n8n por subdominio + métricas)

version: "3.9"
services:
  traefik:
    image: traefik:v3.1
    command:
      - --providers.docker=true
      - --providers.docker.exposedbydefault=false
      - --entrypoints.web.address=:80
      - --entrypoints.websecure.address=:443
      - --certificatesresolvers.letsencrypt.acme.httpchallenge=true
      - --certificatesresolvers.letsencrypt.acme.httpchallenge.entrypoint=web
      - --certificatesresolvers.letsencrypt.acme.email=${ACME_EMAIL}
      - --certificatesresolvers.letsencrypt.acme.storage=/letsencrypt/acme.json
      - --metrics.prometheus=true
    ports: ["80:80","443:443"]
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - ./letsencrypt:/letsencrypt

  postgres:
    image: postgres:15-alpine
    environment:
      - POSTGRES_USER=rp9
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    volumes:
      - ./pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes:
      - ./redisdata:/data

  n8n-demo:
    image: n8nio/n8n:latest
    environment:
      - N8N_HOST=demo.${BASE_DOMAIN}
      - N8N_PORT=5678
      - N8N_PROTOCOL=https
      - WEBHOOK_URL=https://demo.${BASE_DOMAIN}/
      - N8N_EDITOR_BASE_URL=https://demo.${BASE_DOMAIN}/
      - N8N_ENCRYPTION_KEY=${DEMO_ENCRYPTION_KEY}
      - DB_TYPE=postgresdb
      - DB_POSTGRESDB_HOST=postgres
      - DB_POSTGRESDB_PORT=5432
      - DB_POSTGRESDB_DATABASE=n8n_demo
      - DB_POSTGRESDB_USER=rp9
      - DB_POSTGRESDB_PASSWORD=${DB_PASSWORD}
      - N8N_EXECUTIONS_MODE=queue
      - N8N_QUEUE_BULL_REDIS_HOST=redis
      - N8N_DIAGNOSTICS_ENABLED=false
      - N8N_PERSONALIZATION_ENABLED=false
      - N8N_METRICS=true
    depends_on: [postgres, redis]
    labels:
      - traefik.enable=true
      - traefik.http.routers.n8n-demo.rule=Host(`demo.${BASE_DOMAIN}`)
      - traefik.http.routers.n8n-demo.entrypoints=websecure
      - traefik.http.routers.n8n-demo.tls.certresolver=letsencrypt
      - traefik.http.services.n8n-demo.loadbalancer.server.port=5678
    volumes:
      - ./n8n-demo:/home/node/.n8n

.env ejemplo

BASE_DOMAIN=rp9.io
ACME_EMAIL=admin@rp9.io
DB_PASSWORD=CAMBIA_ESTA
DEMO_ENCRYPTION_KEY=clave_larga_aleatoria

CMD (1 línea): docker compose up -d --pull always

C) BFF (Express) — Rate‑limit, HMAC y Stripe metered

// server/security.js
import crypto from 'crypto';
export function verifyHmac(req, secret) {
  const sig = req.headers['x-rp9-signature'] || '';
  const mac = crypto.createHmac('sha256', secret).update(req.rawBody).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(mac));
}

// server/index.js (fragmento)
import rateLimit from 'express-rate-limit';
app.use(rateLimit({ windowMs: 60_000, max: 300 })); // 300 req/min/IP
// ... usar verifyHmac en rutas de webhook

Stripe metered: acumular ejecuciones y duration_ms por tenant; subir usage a subscription_item al final de cada batch/cron.

D) UI Kit RP9 — Moderno, simple y actual

Stack: Next.js (App Router) + Tailwind + shadcn/ui + lucide-react + Framer Motion + Recharts.

Paleta RP9 (modo claro/oscuro):

Primario: #2563EB (azul), énfasis gradiente azul→violeta.

Fondo: #0B1220 (oscuro) / #0F172A superficies; claro #F8FAFC.

Bordes: #1F2937 (oscuro) / #E5E7EB (claro).

Radios: rounded-2xl; Sombras suaves.

tailwind.config.js (tokens básicos)

module.exports = {
  darkMode: 'class',
  content: ['app/**/*.{ts,tsx}', 'components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: { brand: { DEFAULT: '#2563EB', 600: '#2563EB', 700: '#1D4ED8' } },
      borderRadius: { '2xl': '1rem' }
    }
  }
}

AppShell (layout con header minimal + sidebar compacta)

// app/(app)/layout.tsx
import { ThemeProvider } from '@/components/theme-provider';
import { Sidebar } from '@/components/sidebar';
import './globals.css';
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className="min-h-screen bg-slate-50 dark:bg-[#0B1220]">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <div className="flex">
            <Sidebar />
            <main className="flex-1 p-6 lg:p-8">{children}</main>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}

Sidebar (shadcn + lucide)

// components/sidebar.tsx
'use client';
import { Home, Workflow, ShoppingBag, CreditCard, Settings } from 'lucide-react';
import Link from 'next/link';
export function Sidebar() {
  const items = [
    { href: '/dashboard', icon: <Home size={18} />, label: 'Dashboard' },
    { href: '/workflows', icon: <Workflow size={18} />, label: 'Flujos' },
    { href: '/templates', icon: <ShoppingBag size={18} />, label: 'Plantillas' },
    { href: '/billing', icon: <CreditCard size={18} />, label: 'Facturación' },
    { href: '/settings', icon: <Settings size={18} />, label: 'Configuración' },
  ];
  return (
    <aside className="hidden md:block w-[240px] border-r border-slate-200/70 dark:border-slate-800/80 p-4">
      <div className="flex items-center gap-2 mb-6">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand to-violet-600 grid place-items-center text-white font-bold">R9</div>
        <span className="font-semibold">RP9</span>
      </div>
      <nav className="space-y-1">
        {items.map((it) => (
          <Link key={it.href} href={it.href} className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/60">
            {it.icon}<span>{it.label}</span>
          </Link>
        ))}
      </nav>
    </aside>
  );
}

KPI Cards + Charts (Recharts)

// app/(app)/dashboard/page.tsx
'use client';
import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
export default function Dashboard() {
  const [metrics, setMetrics] = useState<any>({});
  const [rt, setRt] = useState<any[]>([]);
  useEffect(() => {
    fetch('/api/metrics').then(r=>r.json()).then(setMetrics);
    const ws = new WebSocket(process.env.NEXT_PUBLIC_WS_URL!);
    ws.onmessage = (e)=> setRt((prev)=>[...prev.slice(-50), JSON.parse(e.data)]);
    return ()=> ws.close();
  }, []);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { t:'Ejecuciones Hoy', v: metrics.executions||0 },
          { t:'Tasa de Éxito', v: `${metrics.successRate||0}%` },
          { t:'Tiempo Promedio', v: `${metrics.avgTime||0}s` },
          { t:'Costo Estimado', v: `$${metrics.cost||0}` },
        ].map((k)=> (
          <Card key={k.t} className="p-4 rounded-2xl">
            <div className="text-sm text-slate-500">{k.t}</div>
            <div className="text-2xl font-semibold mt-1">{k.v}</div>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-4 rounded-2xl">
          <div className="font-medium mb-2">Actividad en Tiempo Real</div>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={rt}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" /><YAxis /><Tooltip />
                <Line type="monotone" dataKey="executions" stroke="#2563EB" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="p-4 rounded-2xl">
          <div className="font-medium mb-2">Workflows Más Activos</div>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics.topWorkflows||[]}> 
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" /><YAxis /><Tooltip />
                <Bar dataKey="count" fill="#7C3AED" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
}

Página de Plantillas (estilo marketplace)

// app/(app)/templates/page.tsx (extracto)
'use client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
// ... lista de plantillas y UI similar a la versión previa, con hover y previews

Notas de UX

Layout aireado, tipografía Inter, bordes rounded-2xl, sombras suaves.

Dark mode por defecto según sistema.

Botones primarios con gradiente sutil from-brand to-violet-600.

Micro‑animaciones (Framer Motion) en tarjetas y transiciones entre vistas.

E) Orchestrator — Alta/Baja de tenants (resumen)

Crear DB n8n_{subdomain}, contenedor con envs correctos, labels Traefik, health‑check, registro en tenants.

Límites por plan: memoria/CPU, executions y workflows (enforcement en BFF + avisos + overage Stripe).

Backups diarios: pg_dump + export JSON de workflows; subir a S3 si está configurado.

F) Seguridad y cumplimiento

Desactivar diagnostics/personalization en n8n.

HMAC en webhooks y validación en BFF antes de reenviar.

Logs/auditoría estructurados (quién cambió qué) y export.

IP allowlist opcional por tenant; rotación de secrets.

G) Próximos pasos sugeridos

Levantar Traefik + n8n demo con el compose de arriba.

Conectar el BFF (rate‑limit + HMAC + Stripe metered).

Elegir builder: mini‑builder RP9 (ya incluido) o n8n Embed.

Activar dashboards Prometheus/Grafana y alertas básicas.

Todo el código queda en este documento para copy/paste y está alineado con un look & feel moderno, simple y actual.

