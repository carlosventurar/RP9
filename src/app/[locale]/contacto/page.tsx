'use client'

import { useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { 
  Mail, 
  Phone, 
  MapPin, 
  Clock,
  Send,
  CheckCircle,
  Building2,
  Users,
  MessageSquare,
  ArrowRight
} from 'lucide-react'
import { getCountryConfig } from '@/lib/i18n/config'
import { toast } from 'sonner'
import Link from 'next/link'

export default function ContactPage() {
  const t = useTranslations('contact')
  const locale = useLocale()
  const countryConfig = getCountryConfig(locale)
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    phone: '',
    employees: '',
    subject: '',
    message: '',
    country: countryConfig.country
  })
  
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          locale,
          timestamp: new Date().toISOString()
        }),
      })

      if (response.ok) {
        setIsSubmitted(true)
        toast.success(t('form.success'))
      } else {
        throw new Error('Failed to submit')
      }
    } catch (error) {
      console.error('Contact form error:', error)
      toast.error(t('form.error'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  if (isSubmitted) {
    return (
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-3xl font-bold">{t('success.title')}</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            {t('success.message')}
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              {t('success.nextSteps')}
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 py-8 px-4">
      {/* Header */}
      <div className="text-center space-y-4">
        <Badge variant="outline" className="px-4 py-2">
          {t('header.badge')} {countryConfig.countryName}
        </Badge>
        <h1 className="text-4xl font-bold tracking-tight">
          {t('header.title')}
        </h1>
        <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
          {t('header.subtitle')}
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Contact Information */}
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                {t('info.office.title')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold">{countryConfig.countryName}</h4>
                <p className="text-sm text-muted-foreground">
                  {t('info.office.address')}
                </p>
              </div>
              
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">{countryConfig.businessHours}</span>
              </div>
              
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">{countryConfig.phoneCode}</span>
              </div>
              
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">contact@rp9portal.com</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('info.compliance.title')}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">
                {t('info.compliance.description')}
              </p>
              <div className="flex flex-wrap gap-2">
                {countryConfig.regulations.map((reg, index) => (
                  <Badge key={index} variant="secondary" className="text-xs">
                    {reg}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Contact Form */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                {t('form.title')}
              </CardTitle>
              <CardDescription>
                {t('form.description')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">{t('form.fields.name.label')}</Label>
                    <Input
                      id="name"
                      type="text"
                      placeholder={t('form.fields.name.placeholder')}
                      value={formData.name}
                      onChange={(e) => handleChange('name', e.target.value)}
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="email">{t('form.fields.email.label')}</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder={t('form.fields.email.placeholder')}
                      value={formData.email}
                      onChange={(e) => handleChange('email', e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="company">{t('form.fields.company.label')}</Label>
                    <Input
                      id="company"
                      type="text"
                      placeholder={t('form.fields.company.placeholder')}
                      value={formData.company}
                      onChange={(e) => handleChange('company', e.target.value)}
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="phone">{t('form.fields.phone.label')}</Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder={t('form.fields.phone.placeholder')}
                      value={formData.phone}
                      onChange={(e) => handleChange('phone', e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="employees">{t('form.fields.employees.label')}</Label>
                    <Select value={formData.employees} onValueChange={(value) => handleChange('employees', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder={t('form.fields.employees.placeholder')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1-10">{t('form.fields.employees.options.small')}</SelectItem>
                        <SelectItem value="11-50">{t('form.fields.employees.options.medium')}</SelectItem>
                        <SelectItem value="51-200">{t('form.fields.employees.options.large')}</SelectItem>
                        <SelectItem value="201+">{t('form.fields.employees.options.enterprise')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="subject">{t('form.fields.subject.label')}</Label>
                    <Select value={formData.subject} onValueChange={(value) => handleChange('subject', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder={t('form.fields.subject.placeholder')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="demo">{t('form.fields.subject.options.demo')}</SelectItem>
                        <SelectItem value="pricing">{t('form.fields.subject.options.pricing')}</SelectItem>
                        <SelectItem value="support">{t('form.fields.subject.options.support')}</SelectItem>
                        <SelectItem value="partnership">{t('form.fields.subject.options.partnership')}</SelectItem>
                        <SelectItem value="other">{t('form.fields.subject.options.other')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message">{t('form.fields.message.label')}</Label>
                  <Textarea
                    id="message"
                    placeholder={t('form.fields.message.placeholder')}
                    rows={4}
                    value={formData.message}
                    onChange={(e) => handleChange('message', e.target.value)}
                    required
                  />
                </div>

                <div className="flex items-center gap-4 pt-4">
                  <Button type="submit" disabled={isSubmitting} className="flex items-center gap-2">
                    {isSubmitting ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                    {isSubmitting ? t('form.sending') : t('form.submit')}
                  </Button>
                  
                  <p className="text-xs text-muted-foreground">
                    {t('form.privacy')}
                  </p>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Why Choose Us */}
      <div className="bg-muted/50 rounded-lg p-8">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold mb-4">{t('whyChoose.title')}</h2>
          <p className="text-xl text-muted-foreground">
            {t('whyChoose.subtitle')}
          </p>
        </div>
        
        <div className="grid md:grid-cols-3 gap-6">
          <div className="text-center space-y-3">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <h3 className="font-semibold">{t('whyChoose.local.title')}</h3>
            <p className="text-sm text-muted-foreground">
              {t('whyChoose.local.description')}
            </p>
          </div>
          
          <div className="text-center space-y-3">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto">
              <Building2 className="w-6 h-6 text-green-600" />
            </div>
            <h3 className="font-semibold">{t('whyChoose.compliance.title')}</h3>
            <p className="text-sm text-muted-foreground">
              {t('whyChoose.compliance.description')}
            </p>
          </div>
          
          <div className="text-center space-y-3">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto">
              <CheckCircle className="w-6 h-6 text-purple-600" />
            </div>
            <h3 className="font-semibold">{t('whyChoose.proven.title')}</h3>
            <p className="text-sm text-muted-foreground">
              {t('whyChoose.proven.description')}
            </p>
          </div>
        </div>
        
        {/* CTA to Login */}
        <div className="text-center mt-8 p-6 bg-primary/5 rounded-lg border border-primary/20">
          <h4 className="text-lg font-semibold mb-2">¿Ya tienes cuenta?</h4>
          <p className="text-sm text-muted-foreground mb-4">
            Accede a tu portal de automatización y comienza a optimizar tus procesos.
          </p>
          <Button asChild className="gap-2">
            <Link href="/login">
              Iniciar Sesión
              <ArrowRight className="w-4 h-4" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}