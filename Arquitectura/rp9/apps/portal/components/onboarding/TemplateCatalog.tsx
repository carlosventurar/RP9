'use client'
import { useEffect, useMemo, useState } from 'react'
type T = { code:string; name:string; vertical:'cc'|'fin'; level:'mock'|'real'; countryScore?:number }
const BASE:T[] = [
  { code:'CC-001-MOCK', name:'3CX → Mock CSAT', vertical:'cc', level:'mock' },
  { code:'CC-002-REAL', name:'3CX → HubSpot Ticket', vertical:'cc', level:'real' },
  { code:'FIN-001-MOCK', name:'CFDI Mock → Validación', vertical:'fin', level:'mock' },
  { code:'FIN-002-REAL', name:'CFDI Real → QBO', vertical:'fin', level:'real' }
]
export default function TemplateCatalog({ vertical='cc', country='MX' }:{ vertical?:'cc'|'fin', country?:string }){
  const [list,setList]=useState<T[]>(BASE)
  useEffect(()=>{ /* TODO: fetch catálogo + orden por país */ },[])
  const sorted = useMemo(()=> list.filter(x=>x.vertical===vertical).sort((a,b)=> (b.countryScore||0)-(a.countryScore||0)),[list,vertical])
  return (<div className="grid grid-cols-2 gap-3">{sorted.map(i => (
    <div key={i.code} className="p-3 rounded-xl border"><div className="text-sm text-slate-500">{i.level.toUpperCase()}</div><div className="font-medium">{i.name}</div></div>
  ))}</div>)
}
