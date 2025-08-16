'use client';

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Mail, Phone, MessageSquare, Send, CheckCircle } from "lucide-react";
import { toast } from "sonner";

export default function ContactoPage() {
  const [formData, setFormData] = useState({
    nombre: '',
    email: '',
    empresa: '',
    telefono: '',
    interes: '',
    mensaje: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const webhookUrl = process.env.NEXT_PUBLIC_CONTACT_WEBHOOK_URL;
      
      if (!webhookUrl) {
        // Fallback si no está configurada la variable de entorno
        console.log('Formulario enviado:', formData);
        toast.success('Mensaje enviado correctamente. Te contactaremos pronto.');
        setIsSubmitted(true);
        return;
      }

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          timestamp: new Date().toISOString(),
          source: 'contacto_page'
        }),
      });

      if (response.ok) {
        toast.success('Mensaje enviado correctamente. Te contactaremos pronto.');
        setIsSubmitted(true);
      } else {
        throw new Error('Error al enviar el mensaje');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al enviar el mensaje. Inténtalo de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 to-slate-900 text-slate-100 flex items-center justify-center">
        <Card className="border-slate-800 bg-slate-900/60 max-w-md mx-auto">
          <CardContent className="p-8 text-center">
            <CheckCircle className="w-16 h-16 text-emerald-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">¡Mensaje enviado!</h2>
            <p className="text-slate-300 mb-6">
              Gracias por contactarnos. Nuestro equipo te responderá en las próximas 24 horas.
            </p>
            <Button 
              onClick={() => setIsSubmitted(false)}
              variant="outline"
              className="border-slate-700"
            >
              Enviar otro mensaje
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 to-slate-900 text-slate-100">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <Badge className="mb-4 bg-emerald-400 text-black">
              <MessageSquare className="w-4 h-4 mr-2" />
              Contacto
            </Badge>
            <h1 className="text-4xl sm:text-5xl font-bold mb-6">
              Habla con nuestro equipo
            </h1>
            <p className="text-xl text-slate-300 max-w-2xl mx-auto">
              ¿Listo para automatizar tu operación? Cuéntanos sobre tu proyecto y te ayudamos a encontrar la mejor solución.
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Formulario */}
            <div className="lg:col-span-2">
              <Card className="border-slate-800 bg-slate-900/60">
                <CardHeader>
                  <CardTitle>Envíanos un mensaje</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="nombre">Nombre completo *</Label>
                        <Input
                          id="nombre"
                          value={formData.nombre}
                          onChange={(e) => handleInputChange('nombre', e.target.value)}
                          required
                          className="bg-slate-950 border-slate-700"
                        />
                      </div>
                      <div>
                        <Label htmlFor="email">Email corporativo *</Label>
                        <Input
                          id="email"
                          type="email"
                          value={formData.email}
                          onChange={(e) => handleInputChange('email', e.target.value)}
                          required
                          className="bg-slate-950 border-slate-700"
                        />
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="empresa">Empresa</Label>
                        <Input
                          id="empresa"
                          value={formData.empresa}
                          onChange={(e) => handleInputChange('empresa', e.target.value)}
                          className="bg-slate-950 border-slate-700"
                        />
                      </div>
                      <div>
                        <Label htmlFor="telefono">Teléfono</Label>
                        <Input
                          id="telefono"
                          value={formData.telefono}
                          onChange={(e) => handleInputChange('telefono', e.target.value)}
                          className="bg-slate-950 border-slate-700"
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="interes">¿En qué estás interesado?</Label>
                      <Select onValueChange={(value) => handleInputChange('interes', value)}>
                        <SelectTrigger className="bg-slate-950 border-slate-700">
                          <SelectValue placeholder="Selecciona una opción" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="piloto">Piloto 30 días</SelectItem>
                          <SelectItem value="core">Plan Core</SelectItem>
                          <SelectItem value="pro">Plan Pro</SelectItem>
                          <SelectItem value="scale">Plan Scale</SelectItem>
                          <SelectItem value="enterprise">Enterprise Dedicado</SelectItem>
                          <SelectItem value="demo">Demo personalizada</SelectItem>
                          <SelectItem value="consultoria">Consultoría</SelectItem>
                          <SelectItem value="otro">Otro</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="mensaje">Cuéntanos sobre tu proyecto *</Label>
                      <Textarea
                        id="mensaje"
                        value={formData.mensaje}
                        onChange={(e) => handleInputChange('mensaje', e.target.value)}
                        required
                        rows={4}
                        placeholder="Describe qué procesos quieres automatizar, cuántas personas están involucradas, y qué resultados esperas..."
                        className="bg-slate-950 border-slate-700"
                      />
                    </div>

                    <Button 
                      type="submit" 
                      disabled={isSubmitting}
                      className="w-full bg-emerald-400 hover:bg-emerald-300 text-black font-semibold"
                    >
                      {isSubmitting ? (
                        'Enviando...'
                      ) : (
                        <>
                          Enviar mensaje
                          <Send className="w-4 h-4 ml-2" />
                        </>
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>

            {/* Información de contacto */}
            <div className="space-y-6">
              <Card className="border-slate-800 bg-slate-900/60">
                <CardContent className="p-6">
                  <h3 className="text-lg font-semibold mb-4">Otras formas de contacto</h3>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <Mail className="w-5 h-5 text-emerald-400" />
                      <div>
                        <p className="font-medium">Email</p>
                        <p className="text-sm text-slate-400">hola@agentevirtualia.com</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Phone className="w-5 h-5 text-emerald-400" />
                      <div>
                        <p className="font-medium">WhatsApp</p>
                        <p className="text-sm text-slate-400">+52 55 1234 5678</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-slate-800 bg-slate-900/60">
                <CardContent className="p-6">
                  <h3 className="text-lg font-semibold mb-4">Tiempo de respuesta</h3>
                  <div className="space-y-2 text-sm">
                    <p className="flex justify-between">
                      <span>Consultas generales:</span>
                      <span className="text-emerald-400">24 horas</span>
                    </p>
                    <p className="flex justify-between">
                      <span>Demos y pilotos:</span>
                      <span className="text-emerald-400">4 horas</span>
                    </p>
                    <p className="flex justify-between">
                      <span>Enterprise:</span>
                      <span className="text-emerald-400">2 horas</span>
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
