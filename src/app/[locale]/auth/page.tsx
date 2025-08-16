'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Mail, Lock, AlertCircle } from 'lucide-react'
import { useTranslations, useLocale } from 'next-intl'

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  
  const router = useRouter()
  const searchParams = useSearchParams()
  const locale = useLocale()
  const supabase = createClient()
  const t = useTranslations('auth')
  
  // Get redirect URL from search params, ensure it doesn't have duplicate locale
  const rawRedirectUrl = searchParams.get('redirect') || `/app/dashboard`
  const redirectUrl = rawRedirectUrl.startsWith(`/${locale}`) ? rawRedirectUrl : `/${locale}${rawRedirectUrl}`

  useEffect(() => {
    // Check if user is already logged in
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        router.replace(redirectUrl)
      }
    }
    checkUser()
  }, [router, locale, supabase])

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')

    try {
      if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (error) throw error

        if (data.user) {
          setMessage(t('loginSuccessful'))
          router.replace(redirectUrl)
        }
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        })

        if (error) throw error

        if (data.user) {
          setMessage(t('accountCreated'))
        }
      }
    } catch (error: any) {
      console.error('Auth error:', error)
      setError(error.message || t('authError'))
    } finally {
      setLoading(false)
    }
  }

  const handleMagicLink = async () => {
    if (!email) {
      setError(t('enterEmail'))
      return
    }

    setLoading(true)
    setError('')
    setMessage('')

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}${redirectUrl}`
        }
      })

      if (error) throw error

      setMessage(t('magicLinkSent'))
    } catch (error: any) {
      console.error('Magic link error:', error)
      setError(error.message || t('magicLinkFailed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo */}
        <div className="text-center">
          <div className="inline-flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center">
              <span className="text-xl font-bold text-white">IA</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">{t('title')}</h1>
              <p className="text-sm text-slate-400">{t('subtitle')}</p>
            </div>
          </div>
        </div>

        {/* Auth Card */}
        <Card className="backdrop-blur-sm bg-white/10 border-white/20">
          <CardHeader className="text-center">
            <CardTitle className="text-white">
              {isLogin ? t('welcomeBack') : t('createAccount')}
            </CardTitle>
            <CardDescription className="text-slate-300">
              {isLogin ? t('signInSubtitle') : t('signUpSubtitle')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive" className="bg-red-500/20 border-red-500/50">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {message && (
              <Alert className="bg-green-500/20 border-green-500/50">
                <Mail className="h-4 w-4" />
                <AlertDescription className="text-green-300">{message}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleAuth} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">{t('email')}</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
                  <Input
                    type="email"
                    placeholder={t('emailPlaceholder')}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-slate-400"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">{t('password')}</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
                  <Input
                    type="password"
                    placeholder={t('passwordPlaceholder')}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-slate-400"
                    required
                  />
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700" 
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : null}
                {isLogin ? t('signIn') : t('signUp')}
              </Button>
            </form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-white/20" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-slate-800 px-2 text-slate-400">{t('or')}</span>
              </div>
            </div>

            <Button
              variant="outline"
              className="w-full border-white/20 bg-white/5 hover:bg-white/10 text-white"
              onClick={handleMagicLink}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Mail className="w-4 h-4 mr-2" />
              )}
              {t('sendMagicLink')}
            </Button>

            <div className="text-center">
              <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="text-sm text-slate-400 hover:text-white transition-colors"
              >
                {isLogin ? t('noAccount') : t('hasAccount')}
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Admin Credentials Card */}
        <Card className="backdrop-blur-sm bg-white/5 border-white/10">
          <CardContent className="pt-4">
            <div className="text-center space-y-2">
              <p className="text-xs font-medium text-slate-400">{t('adminCredentials')}</p>
              <div className="text-xs text-slate-300 space-y-1">
                <p>Email: admin@agentevirtualia.com</p>
                <p>Password: AgenteVirtualIA2024!</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
