'use client'
import { useEffect, useMemo, useState } from 'react'
type Step = 1|2|3|4
type Vertical = 'cc'|'fin'
export default function WizardPage(){
  const [step,setStep]=useState<Step>(1)
  const [vertical,setVertical]=useState<Vertical>('cc')
  const [intent,setIntent]=useState<'low'|'high'>('low')
  const [connected,setConnected]=useState<string[]>([])
  const [installed,setInstalled]=useState<{mock?:boolean, real?:boolean}>({})
  const [country,setCountry]=useState<string>('MX')
  useEffect(()=>{ const u=new URLSearchParams(window.location.search); if(u.get('utm_campaign')?.includes('fin')) setVertical('fin')
    fetch('/.netlify/functions/onboarding/geo').then(r=>r.json()).then(d=>setCountry(d.country||'MX')) },[])
  const canContinue = useMemo(()=> step===1 || (step===2 && connected.length>=1) || (step===3 && installed.mock && installed.real) || step===4,[step,connected,installed])
  function connect(p:string){ setConnected(prev=> Array.from(new Set([...prev,p]))); if(connected.length>=1) setIntent('high') }
  async function installTemplates(){
    const mock={ name:`RP9 Mock – ${vertical.toUpperCase()}`, active:false, nodes:[
      { id:'1', name:'Manual Trigger', type:'n8n-nodes-base.manualTrigger', typeVersion:1, parameters:{}, position:[0,0] },
      { id:'2', name:'Set Data (Mock)', type:'n8n-nodes-base.set', typeVersion:1, parameters:{ keepOnlySet:true, values:{ string:[{ name:'status', value:'ok' }] } }, position:[260,0] }
    ], connections:{ 'Manual Trigger':{ main:[[ { node:'Set Data (Mock)', type:'main', index:0 } ]] } } }
    const real={ name:`RP9 Real – ${vertical.toUpperCase()}`, active:false, nodes:[
      { id:'1', name:'Manual Trigger', type:'n8n-nodes-base.manualTrigger', typeVersion:1, parameters:{}, position:[0,0] },
      { id:'2', name:'HTTP Request', type:'n8n-nodes-base.httpRequest', typeVersion:4, parameters:{ url:'https://httpbin.org/get', method:'GET' }, position:[260,0] }
    ], connections:{ 'Manual Trigger':{ main:[[ { node:'HTTP Request', type:'main', index:0 } ]] } } }
    const r=await fetch('/.netlify/functions/onboarding/templates-install',{ method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ mockWorkflow:mock, realWorkflow:real }) })
    if(r.ok) setInstalled({ mock:true, real:true })
  }
  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Onboarding (Time-to-Value)</h1>
      {step===1 && (<section className="space-y-3">
        <h2 className="font-medium">1) ¿Qué quieres automatizar primero?</h2>
        <div className="grid grid-cols-2 gap-3">
          <button onClick={()=>setVertical('cc')} className={`p-4 rounded-xl border ${vertical==='cc'?'border-black':'border-slate-200'}`}>Contact Center</button>
          <button onClick={()=>setVertical('fin')} className={`p-4 rounded-xl border ${vertical==='fin'?'border-black':'border-slate-200'}`}>Finanzas</button>
        </div>
        <p className="text-sm text-slate-500">Detectado país: <b>{country}</b>.</p>
      </section>)}
      {step===2 && (<section className="space-y-3">
        <h2 className="font-medium">2) Conecta tu primera integración</h2>
        <div className="flex gap-2 flex-wrap">
          {vertical==='cc' ? (<>
            <button onClick={()=>connect('hubspot')} className={`px-3 py-2 rounded-lg border ${connected.includes('hubspot')?'border-black':'border-slate-200'}`}>HubSpot</button>
            <button onClick={()=>connect('freshdesk')} className={`px-3 py-2 rounded-lg border ${connected.includes('freshdesk')?'border-black':'border-slate-200'}`}>Freshdesk</button>
            <button onClick={()=>connect('wa-cloud')} className={`px-3 py-2 rounded-lg border ${connected.includes('wa-cloud')?'border-black':'border-slate-200'}`}>WhatsApp Cloud</button>
          </>) : (<>
            <button onClick={()=>connect('qbo')} className={`px-3 py-2 rounded-lg border ${connected.includes('qbo')?'border-black':'border-slate-200'}`}>QuickBooks</button>
            <button onClick={()=>connect('siigo')} className={`px-3 py-2 rounded-lg border ${connected.includes('siigo')?'border-black':'border-slate-200'}`}>Siigo</button>
            <button onClick={()=>connect('belvo')} className={`px-3 py-2 rounded-lg border ${connected.includes('belvo')?'border-black':'border-slate-200'}`}>Belvo</button>
          </>)}
        </div>
        {intent==='high' && <p className="text-sm text-emerald-600">👍 Alta intención detectada: sugiere una 2ª integración.</p>}
      </section>)}
      {step===3 && (<section className="space-y-3">
        <h2 className="font-medium">3) Instala tus plantillas</h2>
        <p className="text-sm text-slate-600">Instalaremos una **mock** (ejecuta ya) y una **real** (lista para producción).</p>
        <button onClick={installTemplates} className="px-3 py-2 rounded-lg bg-black text-white">Instalar (1-click)</button>
        {installed.mock && installed.real && <p className="text-emerald-600">✅ Plantillas listas.</p>}
      </section>)}
      {step===4 && (<section className="space-y-3">
        <h2 className="font-medium">4) Prueba & Activa</h2>
        <p className="text-sm text-slate-600">Ejecuta la mock y verifica el resultado. Completa credenciales de la real.</p>
        <a href="/onboarding/checklist" className="underline">Ir al checklist</a>
      </section>)}
      <div className="flex justify-between pt-4 border-t">
        <button disabled={step===1} onClick={()=>setStep((s)=> (s-1) as Step)} className="px-3 py-2 rounded-lg border">Atrás</button>
        <button disabled={!canContinue} onClick={()=>setStep((s)=> Math.min(4, (s+1)) as Step)} className={`px-3 py-2 rounded-lg ${canContinue?'bg-black text-white':'bg-slate-200 text-slate-500 cursor-not-allowed'}`}>Continuar</button>
      </div>
    </div>
  )
}
