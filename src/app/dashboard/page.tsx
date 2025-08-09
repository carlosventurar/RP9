import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Activity, Workflow, TrendingUp, Clock } from "lucide-react"

export default function Dashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of your automation workflows and system performance.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Executions Today
            </CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1,234</div>
            <p className="text-xs text-muted-foreground">
              +20.1% from yesterday
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Active Workflows
            </CardTitle>
            <Workflow className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">23</div>
            <p className="text-xs text-muted-foreground">
              +2 from last week
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">98.5%</div>
            <p className="text-xs text-muted-foreground">
              +0.3% from last hour
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Response Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1.2s</div>
            <p className="text-xs text-muted-foreground">
              -0.1s from last hour
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Recent Workflow Executions</CardTitle>
            <CardDescription>
              Latest automation runs and their status
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { name: "Lead Generation Flow", status: "success", time: "2 min ago", duration: "1.3s" },
              { name: "Email Campaign Trigger", status: "success", time: "5 min ago", duration: "2.1s" },
              { name: "Data Sync Process", status: "running", time: "8 min ago", duration: "45s" },
              { name: "Customer Notification", status: "success", time: "12 min ago", duration: "0.8s" },
              { name: "Invoice Processing", status: "failed", time: "15 min ago", duration: "3.2s" },
            ].map((execution, i) => (
              <div key={i} className="flex items-center space-x-4">
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-medium leading-none">
                    {execution.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {execution.time} • Duration: {execution.duration}
                  </p>
                </div>
                <Badge variant={
                  execution.status === "success" ? "default" :
                  execution.status === "running" ? "secondary" : 
                  "destructive"
                }>
                  {execution.status}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>System Status</CardTitle>
            <CardDescription>
              Current status of RP9 platform services
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { service: "n8n API", status: "operational" },
              { service: "Webhook Service", status: "operational" },
              { service: "Database", status: "operational" },
              { service: "Authentication", status: "operational" },
            ].map((service, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="text-sm">{service.service}</span>
                <Badge variant="default" className="bg-green-500">
                  {service.status}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}