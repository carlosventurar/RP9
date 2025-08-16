'use client';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Rocket, Clock, ArrowRight } from "lucide-react";

export default function CheckoutPilotoPage() {
  const handleCheckout = () => {
    const checkoutUrl = process.env.NEXT_PUBLIC_PILOT_CHECKOUT_URL;
    if (checkoutUrl) {
      window.open(checkoutUrl, '_blank');
    } else {
      // Fallback si no está configurada la variable de entorno
      alert('URL de checkout no configurada. Contacta a soporte.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 text-foreground">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <Badge className="mb-4 bg-emerald-400 text-black">
              <Rocket className="w-4 h-4 mr-2" />
              Piloto 30 días
            </Badge>
            <h1 className="text-4xl sm:text-5xl font-bold mb-6">
              Inicia tu Piloto de Agente Virtual IA
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              30 días para probar nuestros planes managed con implementación guiada y soporte completo.
            </p>
          </div>

          {/* Main Card */}
          <Card className="border-border bg-card mb-8">
            <CardHeader>
              <CardTitle className="text-2xl text-center">
                Piloto Managed - US$1,200
              </CardTitle>
              <p className="text-center text-muted-foreground">
                100% descontable al contratar cualquier plan anual
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Qué incluye */}
              <div>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-emerald-400" />
                  Qué incluye tu piloto
                </h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-start gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 mt-2 flex-shrink-0" />
                      <span>Acceso completo a cualquier plan (Core, Pro o Scale)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 mt-2 flex-shrink-0" />
                      <span>Implementación de 2-3 workflows prioritarios</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 mt-2 flex-shrink-0" />
                      <span>8 horas de Automation Expert incluidas</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 mt-2 flex-shrink-0" />
                      <span>Onboarding personalizado y training</span>
                    </li>
                  </ul>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-start gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 mt-2 flex-shrink-0" />
                      <span>Dashboard ROI con métricas reales</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 mt-2 flex-shrink-0" />
                      <span>Soporte Slack directo con el equipo</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 mt-2 flex-shrink-0" />
                      <span>Hasta 50,000 ejecuciones incluidas</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 mt-2 flex-shrink-0" />
                      <span>Reporte final con ROI y recomendaciones</span>
                    </li>
                  </ul>
                </div>
              </div>

              {/* Timeline */}
              <div className="border-t border-slate-800 pt-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-emerald-400" />
                  Timeline del piloto
                </h3>
                <div className="grid md:grid-cols-3 gap-4 text-sm">
                  <div className="text-center">
                    <div className="w-8 h-8 rounded-full bg-emerald-400 text-black font-bold flex items-center justify-center mx-auto mb-2">1</div>
                    <h4 className="font-semibold">Días 1-7</h4>
                    <p className="text-slate-400">Setup, onboarding y primer workflow</p>
                  </div>
                  <div className="text-center">
                    <div className="w-8 h-8 rounded-full bg-emerald-400 text-black font-bold flex items-center justify-center mx-auto mb-2">2</div>
                    <h4 className="font-semibold">Días 8-21</h4>
                    <p className="text-slate-400">Implementación y optimización</p>
                  </div>
                  <div className="text-center">
                    <div className="w-8 h-8 rounded-full bg-emerald-400 text-black font-bold flex items-center justify-center mx-auto mb-2">3</div>
                    <h4 className="font-semibold">Días 22-30</h4>
                    <p className="text-slate-400">Medición ROI y decisión final</p>
                  </div>
                </div>
              </div>

              {/* CTA */}
              <div className="border-t border-slate-800 pt-6 text-center">
                <Button 
                  onClick={handleCheckout}
                  size="lg"
                  className="bg-emerald-400 hover:bg-emerald-300 text-black font-semibold px-8 py-4 text-lg"
                >
                  Iniciar Piloto Ahora - US$1,200
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
                <p className="text-xs text-slate-400 mt-3">
                  Pago seguro procesado por Stripe. Facturación inmediata.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Garantía */}
          <Card className="border-slate-800 bg-slate-900/60">
            <CardContent className="p-6 text-center">
              <h3 className="text-lg font-semibold mb-2">Garantía de satisfacción</h3>
              <p className="text-slate-300 text-sm">
                Si al final del piloto decides no continuar, te devolvemos el 100% del costo. 
                Si contratas un plan anual, el costo del piloto se descuenta completamente.
              </p>
            </CardContent>
          </Card>

          {/* Footer */}
          <div className="text-center mt-8">
            <p className="text-slate-400 text-sm">
              ¿Tienes preguntas? <a href="/contacto" className="text-emerald-400 hover:underline">Habla con nuestro equipo</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
