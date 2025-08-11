'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { 
  Calculator,
  TrendingUp,
  Clock,
  DollarSign,
  Zap,
  Users,
  ArrowRight,
  CheckCircle2,
  BarChart3,
  Target
} from "lucide-react"

export default function ROIPage() {
  const [inputs, setInputs] = useState({
    teamSize: 10,
    avgHourlyRate: 50,
    manualTasksPerMonth: 100,
    timePerTask: 1.5,
    automationPercentage: 70,
    currentToolsCost: 200
  })

  const [industry, setIndustry] = useState('general')

  const industries = {
    general: { multiplier: 1.0, name: 'General' },
    ecommerce: { multiplier: 1.3, name: 'E-commerce' },
    finance: { multiplier: 1.5, name: 'Finanzas' },
    marketing: { multiplier: 1.2, name: 'Marketing' },
    it: { multiplier: 1.4, name: 'IT / DevOps' },
    healthcare: { multiplier: 1.6, name: 'Salud' }
  }

  const calculateROI = () => {
    const {
      teamSize,
      avgHourlyRate,
      manualTasksPerMonth,
      timePerTask,
      automationPercentage,
      currentToolsCost
    } = inputs

    // Current situation
    const totalManualHours = manualTasksPerMonth * timePerTask * teamSize
    const currentMonthlyCost = totalManualHours * avgHourlyRate + currentToolsCost

    // With RP9 automation
    const automatedTasks = (manualTasksPerMonth * automationPercentage / 100)
    const remainingManualTasks = manualTasksPerMonth - automatedTasks
    const newManualHours = remainingManualTasks * timePerTask * teamSize
    const rp9Cost = teamSize <= 5 ? 0 : teamSize * 49 // Starter free for <=5 users, Pro $49/user
    const newMonthlyCost = newManualHours * avgHourlyRate + rp9Cost

    // Savings and ROI
    const monthlySavings = currentMonthlyCost - newMonthlyCost
    const hoursFreed = totalManualHours - newManualHours
    const industryMultiplier = industries[industry as keyof typeof industries]?.multiplier || 1
    const adjustedSavings = monthlySavings * industryMultiplier

    return {
      currentMonthlyCost: Math.round(currentMonthlyCost),
      newMonthlyCost: Math.round(newMonthlyCost),
      monthlySavings: Math.round(Math.max(0, adjustedSavings)),
      annualSavings: Math.round(Math.max(0, adjustedSavings * 12)),
      hoursFreed: Math.round(hoursFreed),
      rp9Investment: rp9Cost * 12,
      roi: rp9Cost > 0 ? Math.round((adjustedSavings * 12) / (rp9Cost * 12) * 100) : Infinity,
      paybackMonths: rp9Cost > 0 ? Math.ceil(rp9Cost / Math.max(adjustedSavings, 1)) : 0,
      productivityGain: Math.round((hoursFreed / (totalManualHours || 1)) * 100)
    }
  }

  const results = calculateROI()

  const updateInput = (key: string, value: number) => {
    setInputs(prev => ({ ...prev, [key]: value }))
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      {/* Header */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <Badge variant="outline" className="mb-4">
            <Calculator className="w-4 h-4 mr-2" />
            Calculadora ROI
          </Badge>
          <h1 className="text-4xl font-bold mb-6">
            Descubre tu{' '}
            <span className="text-primary">Potencial de Ahorro</span>
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Calcula cuánto tiempo y dinero podrías ahorrar automatizando tus procesos manuales con RP9.
            Obtén resultados personalizados para tu industria.
          </p>
          
          <div className="flex items-center justify-center gap-8 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              Cálculo personalizado
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              Por industria
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              Resultados instantáneos
            </div>
          </div>
        </div>
      </section>

      {/* Calculator */}
      <section className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-8">
            {/* Inputs */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  Tu Situación Actual
                </CardTitle>
                <CardDescription>
                  Ingresa los datos de tu equipo y procesos actuales
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Team Size */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">
                    Tamaño del equipo: {inputs.teamSize} personas
                  </Label>
                  <Slider
                    value={[inputs.teamSize]}
                    onValueChange={(value) => updateInput('teamSize', value[0])}
                    min={1}
                    max={100}
                    step={1}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>1</span>
                    <span>100+</span>
                  </div>
                </div>

                {/* Hourly Rate */}
                <div className="space-y-2">
                  <Label htmlFor="hourlyRate" className="text-sm font-medium">
                    Costo por hora promedio (USD)
                  </Label>
                  <Input
                    id="hourlyRate"
                    type="number"
                    value={inputs.avgHourlyRate}
                    onChange={(e) => updateInput('avgHourlyRate', parseInt(e.target.value) || 0)}
                    placeholder="50"
                  />
                </div>

                {/* Manual Tasks */}
                <div className="space-y-2">
                  <Label htmlFor="manualTasks" className="text-sm font-medium">
                    Tareas manuales por mes (por persona)
                  </Label>
                  <Input
                    id="manualTasks"
                    type="number"
                    value={inputs.manualTasksPerMonth}
                    onChange={(e) => updateInput('manualTasksPerMonth', parseInt(e.target.value) || 0)}
                    placeholder="100"
                  />
                </div>

                {/* Time per Task */}
                <div className="space-y-2">
                  <Label htmlFor="timePerTask" className="text-sm font-medium">
                    Tiempo promedio por tarea (horas)
                  </Label>
                  <Input
                    id="timePerTask"
                    type="number"
                    step="0.1"
                    value={inputs.timePerTask}
                    onChange={(e) => updateInput('timePerTask', parseFloat(e.target.value) || 0)}
                    placeholder="1.5"
                  />
                </div>

                {/* Automation Percentage */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">
                    Tareas que puedes automatizar: {inputs.automationPercentage}%
                  </Label>
                  <Slider
                    value={[inputs.automationPercentage]}
                    onValueChange={(value) => updateInput('automationPercentage', value[0])}
                    min={0}
                    max={100}
                    step={5}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>0%</span>
                    <span>100%</span>
                  </div>
                </div>

                {/* Industry Selection */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Industria</Label>
                  <select
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    className="w-full p-2 border rounded-md"
                  >
                    {Object.entries(industries).map(([key, info]) => (
                      <option key={key} value={key}>
                        {info.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">
                    Ajustamos los cálculos según las especificidades de tu industria
                  </p>
                </div>

                {/* Current Tools Cost */}
                <div className="space-y-2">
                  <Label htmlFor="currentCost" className="text-sm font-medium">
                    Costo actual en herramientas (USD/mes)
                  </Label>
                  <Input
                    id="currentCost"
                    type="number"
                    value={inputs.currentToolsCost}
                    onChange={(e) => updateInput('currentToolsCost', parseInt(e.target.value) || 0)}
                    placeholder="200"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Results */}
            <div className="space-y-6">
              {/* Main Results Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="w-5 h-5" />
                    Tus Resultados
                  </CardTitle>
                  <CardDescription>
                    Impacto estimado de implementar RP9
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Monthly Savings */}
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-green-700">Ahorro Mensual</p>
                        <p className="text-2xl font-bold text-green-800">
                          ${results.monthlySavings.toLocaleString()}
                        </p>
                      </div>
                      <DollarSign className="w-8 h-8 text-green-600" />
                    </div>
                  </div>

                  {/* Annual Savings */}
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-blue-700">Ahorro Anual</p>
                        <p className="text-2xl font-bold text-blue-800">
                          ${results.annualSavings.toLocaleString()}
                        </p>
                      </div>
                      <TrendingUp className="w-8 h-8 text-blue-600" />
                    </div>
                  </div>

                  {/* Hours Freed */}
                  <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-purple-700">Horas Liberadas/Mes</p>
                        <p className="text-2xl font-bold text-purple-800">
                          {results.hoursFreed.toLocaleString()}h
                        </p>
                      </div>
                      <Clock className="w-8 h-8 text-purple-600" />
                    </div>
                  </div>

                  {/* ROI */}
                  {results.roi !== Infinity && (
                    <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-orange-700">ROI Anual</p>
                          <p className="text-2xl font-bold text-orange-800">
                            {results.roi}%
                          </p>
                        </div>
                        <Zap className="w-8 h-8 text-orange-600" />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Additional Metrics */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Métricas Adicionales</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Costo actual mensual</span>
                    <span className="font-medium">${results.currentMonthlyCost.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Nuevo costo mensual</span>
                    <span className="font-medium">${results.newMonthlyCost.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Ganancia de productividad</span>
                    <span className="font-medium">{results.productivityGain}%</span>
                  </div>
                  {results.paybackMonths > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Tiempo de recuperación</span>
                      <span className="font-medium">{results.paybackMonths} meses</span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* CTA */}
              <Card className="bg-primary text-primary-foreground">
                <CardContent className="pt-6">
                  <div className="text-center space-y-4">
                    <h3 className="text-xl font-bold">¿Listo para Comenzar?</h3>
                    <p className="text-primary-foreground/80">
                      Empieza gratis y ve estos resultados en acción
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <Button variant="secondary" className="flex-1">
                        Comenzar Gratis
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                      <Button variant="outline" className="flex-1 border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/10">
                        Solicitar Demo
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-16 px-4 bg-muted/30">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Beneficios Adicionales</h2>
            <p className="text-muted-foreground">
              Más allá del ahorro económico, RP9 transforma tu operación
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="font-semibold mb-2">Equipos Más Felices</h3>
              <p className="text-sm text-muted-foreground">
                Elimina tareas repetitivas y permite a tu equipo enfocarse en trabajo estratégico
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Zap className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="font-semibold mb-2">Menos Errores</h3>
              <p className="text-sm text-muted-foreground">
                La automatización reduce errores humanos hasta en un 95%
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <TrendingUp className="w-6 h-6 text-purple-600" />
              </div>
              <h3 className="font-semibold mb-2">Escalabilidad</h3>
              <p className="text-sm text-muted-foreground">
                Maneja 10x más volumen sin aumentar el equipo
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Case Studies Preview */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-6">
            Casos de Éxito Reales
          </h2>
          <p className="text-lg text-muted-foreground mb-8">
            Empresas similares a la tuya ya están viendo estos resultados
          </p>
          
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <Card>
              <CardContent className="pt-6 text-left">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-2xl">🛒</span>
                  <div>
                    <div className="font-semibold">E-commerce (50 empleados)</div>
                    <div className="text-sm text-muted-foreground">Automatizó gestión de inventario</div>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm">Ahorro anual:</span>
                    <span className="font-medium">$180,000</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">ROI:</span>
                    <span className="font-medium">450%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6 text-left">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-2xl">💰</span>
                  <div>
                    <div className="font-semibold">Fintech (25 empleados)</div>
                    <div className="text-sm text-muted-foreground">Automatizó procesos de compliance</div>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm">Ahorro anual:</span>
                    <span className="font-medium">$320,000</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">ROI:</span>
                    <span className="font-medium">780%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          
          <Button variant="outline" size="lg">
            Ver Más Casos de Éxito
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </section>
    </div>
  )
}