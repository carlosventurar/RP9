'use client'
import { useEffect, useState } from 'react'
type Task = { key:string; title:string; critical?:boolean; status?:'pending'|'done'|'error' }
const DEFAULT: Task[] = [
  { key:'connect_primary_integration', title:'Conecta tu integración principal', critical:true },
  { key:'install_mock', title:'Instala plantilla mock' },
  { key:'run_mock', title:'Ejecuta plantilla mock' },
  { key:'install_real', title:'Instala plantilla real' },
  { key:'provide_credentials', title:'Completa credenciales faltantes', critical:true },
  { key:'enable_csat', title:'(CC) Activa CSAT por WhatsApp' },
  { key:'first_outcome', title:'Logra tu primer resultado de negocio', critical:true }
]
export default function ChecklistPage(){
  const [tasks,setTasks]=useState<Task[]>(DEFAULT)
  const progress = Math.round((tasks.filter(t=>t.status==='done').length / tasks.length)*100)
  useEffect(()=>{ /* TODO: fetch real statuses */ },[])
  function markDone(k:string){ setTasks(prev => prev.map(t=> t.key===k ? { ...t, status:'done' } : t)) }
  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Checklist de Onboarding</h1>
      <div className="h-2 bg-slate-200 rounded"><div className="h-2 bg-black rounded" style={{width:`${progress}%`}} /></div>
      <ul className="space-y-2">
        {tasks.map(t => (
          <li key={t.key} className="flex items-center justify-between p-3 rounded-xl border">
            <div><div className="font-medium">{t.title}</div>{t.critical && <div className="text-xs text-rose-600">Tarea crítica</div>}</div>
            <button onClick={()=>markDone(t.key)} className="px-3 py-2 rounded-lg border">{t.status==='done'?'Completada':'Marcar listo'}</button>
          </li>
        ))}
      </ul>
      <div className="pt-2 text-sm text-slate-600">{progress>=20 && '🚀 Primeros pasos'} {progress>=60 && '🏅 Casi listo'} {progress===100 && '🌟 Primer Valor'}</div>
    </div>
  )
}
