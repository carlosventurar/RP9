import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { 
  CreditCard, 
  Download, 
  CheckCircle,
  Clock,
  Zap
} from "lucide-react"

export default function BillingPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Billing</h1>
        <p className="text-muted-foreground">
          Manage your subscription and view usage details
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Current Plan */}
        <Card className="col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Current Plan
            </CardTitle>
            <CardDescription>
              Your active subscription details
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">Pro Plan</div>
                <div className="text-muted-foreground">$49/month</div>
              </div>
              <Badge variant="default" className="bg-green-500">
                <CheckCircle className="h-3 w-3 mr-1" />
                Active
              </Badge>
            </div>
            
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span>Billing cycle</span>
                <span>Monthly</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Next billing date</span>
                <span>Feb 23, 2024</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Payment method</span>
                <span>•••• 4242</span>
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <Button variant="outline">Manage Subscription</Button>
              <Button variant="outline">Update Payment</Button>
            </div>
          </CardContent>
        </Card>

        {/* Usage Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Usage This Month</CardTitle>
            <CardDescription>
              Current usage vs limits
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Executions</span>
                <span>1,234 / 10,000</span>
              </div>
              <div className="w-full bg-secondary rounded-full h-2">
                <div className="bg-primary h-2 rounded-full" style={{ width: '12.34%' }}></div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Workflows</span>
                <span>23 / 50</span>
              </div>
              <div className="w-full bg-secondary rounded-full h-2">
                <div className="bg-primary h-2 rounded-full" style={{ width: '46%' }}></div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Storage</span>
                <span>245MB / 1GB</span>
              </div>
              <div className="w-full bg-secondary rounded-full h-2">
                <div className="bg-primary h-2 rounded-full" style={{ width: '24%' }}></div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Available Plans */}
      <Card>
        <CardHeader>
          <CardTitle>Available Plans</CardTitle>
          <CardDescription>
            Upgrade or downgrade your subscription
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="border rounded-lg p-4">
              <div className="text-center space-y-2">
                <h3 className="text-lg font-semibold">Starter</h3>
                <div className="text-2xl font-bold">$19<span className="text-sm font-normal">/mo</span></div>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>1,000 executions/month</li>
                  <li>10 workflows</li>
                  <li>500MB storage</li>
                  <li>Email support</li>
                </ul>
                <Button variant="outline" className="w-full">Downgrade</Button>
              </div>
            </div>

            <div className="border rounded-lg p-4 bg-primary/5 border-primary">
              <div className="text-center space-y-2">
                <h3 className="text-lg font-semibold">Pro</h3>
                <Badge variant="default" className="mb-2">Current</Badge>
                <div className="text-2xl font-bold">$49<span className="text-sm font-normal">/mo</span></div>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>10,000 executions/month</li>
                  <li>50 workflows</li>
                  <li>1GB storage</li>
                  <li>Priority support</li>
                </ul>
                <Button disabled className="w-full">Current Plan</Button>
              </div>
            </div>

            <div className="border rounded-lg p-4">
              <div className="text-center space-y-2">
                <h3 className="text-lg font-semibold">Enterprise</h3>
                <div className="text-2xl font-bold">$199<span className="text-sm font-normal">/mo</span></div>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>Unlimited executions</li>
                  <li>Unlimited workflows</li>
                  <li>10GB storage</li>
                  <li>24/7 phone support</li>
                </ul>
                <Button className="w-full">
                  <Zap className="h-4 w-4 mr-2" />
                  Upgrade
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Billing History */}
      <Card>
        <CardHeader>
          <CardTitle>Billing History</CardTitle>
          <CardDescription>
            Your recent invoices and payments
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[
              { date: 'Jan 23, 2024', amount: '$49.00', status: 'paid', invoice: 'INV-2024-001' },
              { date: 'Dec 23, 2023', amount: '$49.00', status: 'paid', invoice: 'INV-2023-012' },
              { date: 'Nov 23, 2023', amount: '$49.00', status: 'paid', invoice: 'INV-2023-011' },
              { date: 'Oct 23, 2023', amount: '$49.00', status: 'paid', invoice: 'INV-2023-010' },
            ].map((invoice, i) => (
              <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-4">
                  <div className="space-y-1">
                    <div className="font-medium">{invoice.invoice}</div>
                    <div className="text-sm text-muted-foreground">{invoice.date}</div>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="font-medium">{invoice.amount}</div>
                    <Badge variant={invoice.status === 'paid' ? 'default' : 'outline'}>
                      {invoice.status === 'paid' ? <CheckCircle className="h-3 w-3 mr-1" /> : <Clock className="h-3 w-3 mr-1" />}
                      {invoice.status}
                    </Badge>
                  </div>
                  <Button variant="ghost" size="sm">
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}