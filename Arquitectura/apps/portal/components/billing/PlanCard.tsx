'use client'
export function PlanCard({ plan='Starter' }:{ plan?: string }){
  return (
    <div className="p-4 border rounded-2xl">
      <div className="text-sm text-slate-500">Tu plan</div>
      <div className="text-2xl font-semibold">{plan}</div>
      <div className="mt-3 space-x-2">
        <button className="px-3 py-2 rounded-xl bg-black text-white">Upgrade</button>
        <button className="px-3 py-2 rounded-xl border">Comprar paquetes</button>
      </div>
    </div>
  )
}
