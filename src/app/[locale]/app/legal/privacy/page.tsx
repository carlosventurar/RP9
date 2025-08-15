import { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { headers } from 'next/headers'
import LegalViewer from '@/components/legal/LegalViewer'
import { createClient } from '@/lib/supabase/server'

interface PageProps {
  params: {
    locale: string
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const t = await getTranslations('legal')
  
  return {
    title: t('privacy_title'),
    description: t('privacy_description'),
    robots: 'index, follow',
    openGraph: {
      title: t('privacy_title'),
      description: t('privacy_description'),
      type: 'website',
      locale: params.locale,
    }
  }
}

export default async function PrivacyPolicyPage({ params }: PageProps) {
  const t = await getTranslations('legal')
  const supabase = createClient()
  const headersList = headers()
  
  // Get current user if authenticated
  const { data: { user } } = await supabase.auth.getUser()
  
  // Get user's tenant if logged in
  let tenantId: string | undefined
  if (user) {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('tenant_id')
      .eq('user_id', user.id)
      .single()
    
    tenantId = profile?.tenant_id
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-6">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold tracking-tight">{t('privacy_policy')}</h1>
            <p className="text-muted-foreground mt-2">
              {t('privacy_subtitle')}
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        <LegalViewer
          documentType="privacy"
          locale={params.locale}
          userId={user?.id}
          tenantId={tenantId}
          showAcceptanceButton={!!user && !!tenantId}
          className="max-w-4xl mx-auto"
        />
      </div>

      {/* Footer info */}
      <div className="border-t bg-muted/50 mt-12">
        <div className="container mx-auto px-4 py-6">
          <div className="max-w-4xl mx-auto text-center text-sm text-muted-foreground">
            <p>
              {t('privacy_footer_text')} {' '}
              <a 
                href="mailto:privacy@rp9portal.com" 
                className="text-primary hover:underline"
              >
                privacy@rp9portal.com
              </a>
            </p>
            <p className="mt-2">
              {t('privacy_rights_text')} {' '}
              <a 
                href="mailto:dpo@rp9portal.com" 
                className="text-primary hover:underline"
              >
                dpo@rp9portal.com
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}