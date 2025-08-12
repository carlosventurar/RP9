import { Metadata } from "next"
import { Suspense } from "react"
import { DashboardShell } from "@/components/dashboard/shell"
import { DashboardHeader } from "@/components/dashboard/header"
import { MetricsDashboard } from "@/components/dashboard/MetricsDashboard"
import { Skeleton } from "@/components/ui/skeleton"

export const metadata: Metadata = {
  title: "Métricas | RP9 Portal",
  description: "Dashboard de métricas y observabilidad de n8n workflows",
}

function MetricsLoading() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-80" />
        <Skeleton className="h-80" />
      </div>
    </div>
  )
}

export default function MetricsPage() {
  return (
    <DashboardShell>
      <DashboardHeader
        heading="Métricas & Observabilidad"
        text="Monitor en tiempo real del rendimiento de tus workflows n8n"
      />
      <div className="space-y-6">
        <Suspense fallback={<MetricsLoading />}>
          <MetricsDashboard />
        </Suspense>
      </div>
    </DashboardShell>
  )
}