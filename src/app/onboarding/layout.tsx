import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Onboarding | RP9 Portal',
  description: 'Completa tu configuración inicial y obtén el máximo valor de RP9',
}

interface OnboardingLayoutProps {
  children: React.ReactNode
}

export default function OnboardingLayout({ children }: OnboardingLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Onboarding Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h1 className="text-xl font-semibold text-gray-900">
                RP9 Onboarding
              </h1>
              <div className="flex items-center space-x-2 text-sm text-gray-500">
                <span>Configura tu cuenta en minutos</span>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <div className="text-xs text-gray-500">
                ¿Necesitas ayuda?{' '}
                <a 
                  href="mailto:support@rp9.dev" 
                  className="text-blue-600 hover:text-blue-700"
                >
                  Contáctanos
                </a>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Onboarding Content */}
      <main className="py-8">
        {children}
      </main>

      {/* Onboarding Footer */}
      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between text-sm text-gray-500">
            <div>
              © 2025 RP9 Portal. Automatización empresarial para LATAM.
            </div>
            <div className="flex items-center space-x-4">
              <a href="/privacy" className="hover:text-gray-700">Privacidad</a>
              <a href="/terms" className="hover:text-gray-700">Términos</a>
              <a href="/support" className="hover:text-gray-700">Soporte</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}