'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { 
  CheckCircle, 
  Calculator,
  Zap,
  Star,
  ArrowRight,
  DollarSign
} from "lucide-react"

const PLAN_CONFIG = {
  starter: {
    name: 'Starter',
    description: 'Perfect for small teams getting started',
    price: { monthly: 0, annual: 0 },
    executions: 1000,
    workflows: 10,
    features: [
      'Basic workflows',
      'Standard support', 
      '30-day history',
      'Email notifications',
      'Basic templates'
    ],
    cta: 'Get Started Free',
    popular: false
  },
  pro: {
    name: 'Pro',
    description: 'For growing businesses with advanced needs',
    price: { monthly: 29, annual: 232 }, // 20% discount: 29 * 12 * 0.8 = 278.4, rounded to 232
    executions: 10000,
    workflows: 100,
    features: [
      'Advanced workflows',
      'Priority support',
      '90-day history', 
      'Custom integrations',
      'Premium templates',
      'Usage analytics',
      'API access'
    ],
    cta: 'Start Pro Trial',
    popular: true
  },
  enterprise: {
    name: 'Enterprise',
    description: 'For large organizations with custom requirements',
    price: { monthly: 99, annual: 950 }, // 20% discount: 99 * 12 * 0.8 = 950.4
    executions: -1, // Unlimited
    workflows: -1, // Unlimited
    features: [
      'Unlimited workflows',
      '24/7 dedicated support',
      '1-year history',
      'SSO authentication',
      'Custom integrations',
      'White-label options',
      'SLA guarantees',
      'Advanced security'
    ],
    cta: 'Contact Sales',
    popular: false
  }
}

const EXECUTION_PACKS = {
  small: { executions: 10000, price: 19 },
  medium: { executions: 50000, price: 79 },
  large: { executions: 100000, price: 149 }
}

export default function PricingPage() {
  const [isAnnual, setIsAnnual] = useState(false)
  const [roiInputs, setRoiInputs] = useState({
    currentManualTasks: 40,
    hoursPerTask: 2,
    hourlyRate: 50,
    automationRate: 80
  })

  const calculateROI = () => {
    const { currentManualTasks, hoursPerTask, hourlyRate, automationRate } = roiInputs
    const monthlyManualCost = currentManualTasks * hoursPerTask * hourlyRate
    const automatedTasks = currentManualTasks * (automationRate / 100)
    const remainingManualTasks = currentManualTasks - automatedTasks
    const newMonthlyCost = remainingManualTasks * hoursPerTask * hourlyRate + 29 // Pro plan
    const monthlySavings = monthlyManualCost - newMonthlyCost
    const annualSavings = monthlySavings * 12
    const roiPercentage = ((monthlySavings * 12) / (29 * 12)) * 100

    return {
      monthlyManualCost,
      newMonthlyCost,
      monthlySavings: Math.max(0, monthlySavings),
      annualSavings: Math.max(0, annualSavings),
      roiPercentage: Math.max(0, roiPercentage)
    }
  }

  const roi = calculateROI()

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20">
      {/* Hero Section */}
      <div className="container mx-auto px-4 pt-16 pb-8">
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold">
            Simple, transparent pricing
          </h1>
          <p className="text-xl text-muted-foreground">
            Choose the perfect plan for your automation needs. Start free, scale as you grow.
          </p>
          
          {/* Billing Toggle */}
          <div className="flex items-center justify-center gap-4 mt-8">
            <Label htmlFor="billing-toggle" className={!isAnnual ? 'font-medium' : ''}>
              Monthly
            </Label>
            <Switch
              id="billing-toggle"
              checked={isAnnual}
              onCheckedChange={setIsAnnual}
            />
            <div className="flex items-center gap-2">
              <Label htmlFor="billing-toggle" className={isAnnual ? 'font-medium' : ''}>
                Annual
              </Label>
              <Badge variant="secondary" className="text-xs">Save 20%</Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Pricing Plans */}
      <div className="container mx-auto px-4 pb-16">
        <div className="grid gap-8 md:grid-cols-3 max-w-6xl mx-auto">
          {Object.entries(PLAN_CONFIG).map(([key, plan]) => (
            <Card 
              key={key}
              className={`relative ${plan.popular ? 'border-primary shadow-lg scale-105' : ''}`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <Badge className="bg-primary text-primary-foreground px-3 py-1">
                    <Star className="h-3 w-3 mr-1" />
                    Most Popular
                  </Badge>
                </div>
              )}
              
              <CardHeader className="text-center pb-8">
                <CardTitle className="text-2xl">{plan.name}</CardTitle>
                <CardDescription className="text-base">{plan.description}</CardDescription>
                
                <div className="space-y-2">
                  <div className="text-4xl font-bold">
                    ${isAnnual ? plan.price.annual : plan.price.monthly}
                    {plan.price.monthly > 0 && (
                      <span className="text-base font-normal text-muted-foreground">
                        /{isAnnual ? 'year' : 'month'}
                      </span>
                    )}
                  </div>
                  
                  {isAnnual && plan.price.monthly > 0 && (
                    <div className="text-sm text-muted-foreground">
                      <span className="line-through">${plan.price.monthly * 12}/year</span>
                      <span className="ml-2 text-green-600 font-medium">
                        Save ${(plan.price.monthly * 12) - plan.price.annual}
                      </span>
                    </div>
                  )}
                </div>
              </CardHeader>
              
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Executions per month</span>
                    <span className="font-medium">
                      {plan.executions === -1 ? 'Unlimited' : plan.executions.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Active workflows</span>
                    <span className="font-medium">
                      {plan.workflows === -1 ? 'Unlimited' : plan.workflows}
                    </span>
                  </div>
                </div>

                <ul className="space-y-3">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button 
                  className="w-full"
                  variant={plan.popular ? 'default' : 'outline'}
                  size="lg"
                >
                  {plan.cta}
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>

                {plan.price.monthly > 0 && (
                  <div className="text-xs text-center text-muted-foreground">
                    7-day free trial • No credit card required
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Add-on Execution Packs */}
        <div className="max-w-4xl mx-auto mt-16">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold mb-2">Need more executions?</h2>
            <p className="text-muted-foreground">
              Add execution packs to any plan. Only pay for what you need.
            </p>
          </div>
          
          <div className="grid gap-4 md:grid-cols-3">
            {Object.entries(EXECUTION_PACKS).map(([size, pack]) => (
              <Card key={size} className="text-center">
                <CardContent className="pt-6">
                  <div className="space-y-2">
                    <div className="text-2xl font-bold">
                      +{pack.executions.toLocaleString()}
                    </div>
                    <div className="text-muted-foreground">executions</div>
                    <div className="text-xl font-semibold text-primary">
                      ${pack.price}/month
                    </div>
                    <div className="text-xs text-muted-foreground">
                      ${(pack.price / pack.executions * 1000).toFixed(3)} per 1K executions
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="mt-4">
                    Add to Plan
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
          
          <div className="text-center mt-4 text-sm text-muted-foreground">
            Overage pricing: $0.002 per execution beyond plan limits
          </div>
        </div>
      </div>

      {/* ROI Calculator */}
      <div className="bg-secondary/30 py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold mb-2">ROI Calculator</h2>
              <p className="text-muted-foreground">
                See how much you could save by automating your workflows
              </p>
            </div>

            <div className="grid gap-8 md:grid-cols-2">
              {/* Calculator Inputs */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calculator className="h-5 w-5" />
                    Your Current Situation
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Manual tasks per month</Label>
                    <Input
                      type="number"
                      value={roiInputs.currentManualTasks}
                      onChange={(e) => setRoiInputs(prev => ({ 
                        ...prev, 
                        currentManualTasks: parseInt(e.target.value) || 0 
                      }))}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Hours per task</Label>
                    <Input
                      type="number"
                      step="0.5"
                      value={roiInputs.hoursPerTask}
                      onChange={(e) => setRoiInputs(prev => ({ 
                        ...prev, 
                        hoursPerTask: parseFloat(e.target.value) || 0 
                      }))}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Hourly rate ($)</Label>
                    <Input
                      type="number"
                      value={roiInputs.hourlyRate}
                      onChange={(e) => setRoiInputs(prev => ({ 
                        ...prev, 
                        hourlyRate: parseInt(e.target.value) || 0 
                      }))}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Tasks you can automate (%)</Label>
                    <Input
                      type="number"
                      max="100"
                      value={roiInputs.automationRate}
                      onChange={(e) => setRoiInputs(prev => ({ 
                        ...prev, 
                        automationRate: Math.min(100, parseInt(e.target.value) || 0)
                      }))}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Results */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    Your Potential Savings
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4">
                    <div className="flex justify-between p-3 bg-secondary/50 rounded-lg">
                      <span>Current monthly cost</span>
                      <span className="font-medium">${roi.monthlyManualCost.toLocaleString()}</span>
                    </div>
                    
                    <div className="flex justify-between p-3 bg-secondary/50 rounded-lg">
                      <span>New monthly cost</span>
                      <span className="font-medium">${roi.newMonthlyCost.toLocaleString()}</span>
                    </div>
                    
                    <div className="flex justify-between p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                      <span>Monthly savings</span>
                      <span className="font-bold text-green-600">${roi.monthlySavings.toLocaleString()}</span>
                    </div>
                    
                    <div className="flex justify-between p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                      <span>Annual savings</span>
                      <span className="font-bold text-green-600 text-lg">${roi.annualSavings.toLocaleString()}</span>
                    </div>
                    
                    <div className="flex justify-between p-3 bg-primary/10 border border-primary/20 rounded-lg">
                      <span>ROI</span>
                      <span className="font-bold text-primary text-lg">{roi.roiPercentage.toFixed(0)}%</span>
                    </div>
                  </div>
                  
                  {roi.monthlySavings > 0 && (
                    <Button className="w-full" size="lg">
                      <Zap className="h-4 w-4 mr-2" />
                      Start Saving Today
                    </Button>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* FAQ Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-8">Frequently Asked Questions</h2>
          <div className="grid gap-6 text-left">
            <Card>
              <CardContent className="pt-6">
                <h3 className="font-semibold mb-2">What happens if I exceed my execution limit?</h3>
                <p className="text-muted-foreground">
                  If you exceed your plan's execution limit, you'll be charged $0.002 per additional execution. 
                  We'll send you alerts at 80% usage so you can upgrade if needed.
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <h3 className="font-semibold mb-2">Can I change plans anytime?</h3>
                <p className="text-muted-foreground">
                  Yes! You can upgrade or downgrade your plan at any time. Changes take effect immediately, 
                  and we'll prorate your billing accordingly.
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <h3 className="font-semibold mb-2">Do you offer refunds?</h3>
                <p className="text-muted-foreground">
                  We offer a 7-day free trial for all paid plans, and a 30-day money-back guarantee 
                  if you're not satisfied with the service.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}