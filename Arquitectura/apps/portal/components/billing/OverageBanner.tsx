'use client'
export function OverageBanner({ pct=0, limit=0 }:{ pct?: number, limit?: number }){
  if (!pct) return null
  const warn = pct>=80 && pct<100
  const over = pct>=100
  return (
    <div className={`p-3 rounded-2xl border ${warn?'border-amber-300 bg-amber-50': over?'border-red-300 bg-red-50':'border-slate-200'}`}>
      {warn && <span>⚠️ Vas en {pct}% de tu límite ({limit}). Te recomendamos comprar un paquete o considerar upgrade.</span>}
      {over && <span>⛔ Superaste tu límite ({limit}). Se aplicará overage o bloqueo según plan.</span>}
      {!warn && !over && <span>Consumo {pct}% del límite. Todo en orden.</span>}
    </div>
  )
}
