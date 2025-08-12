'use client'
import { useEffect, useState } from 'react'
import { PlanCard } from '@/components/billing/PlanCard'
import { UsageChart } from '@/components/billing/UsageChart'
import { OverageBanner } from '@/components/billing/OverageBanner'

export default function BillingPage(){
  const [metrics, setMetrics] = useState<any>({ daily: [], summary: {} })
  useEffect(()=>{
    setMetrics({ 
      daily: [{ d:'2025-08-01', ok: 120, err: 4 }, { d:'2025-08-02', ok: 180, err: 6 }],
      summary: { plan:'Pro', executions: 3000, limit: 5000, pct: 60 }
    })
  },[])
  return (
    <div className="space-y-6">
      <OverageBanner pct={metrics.summary.pct} limit={metrics.summary.limit} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2"><UsageChart data={metrics.daily} /></div>
        <div><PlanCard plan={metrics.summary.plan} /></div>
      </div>
    </div>
  )
}
