import type { Metadata } from "next";
import "../globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { i18nConfig } from '@/lib/i18n/config';

export const metadata: Metadata = {
  title: "Agente Virtual IA - Plataforma de Automatización Inteligente",
  description: "Transforma procesos manuales en workflows automatizados con IA. Ahorra tiempo, reduce errores y escala tu operación con Agente Virtual IA.",
};

interface LocaleLayoutProps {
  children: React.ReactNode;
  params: { locale: string };
}

export default async function LocaleLayout({
  children,
  params
}: LocaleLayoutProps) {
  const { locale } = await params;
  
  // Validate that the incoming locale is valid
  if (!i18nConfig.locales.includes(locale)) {
    notFound();
  }

  // Get messages for the current locale
  const messages = await getMessages();
  
  return (
    <html lang={locale.split('-')[0]} suppressHydrationWarning>
      <body>
        <NextIntlClientProvider messages={messages}>
          <ThemeProvider
            attribute="class"
            defaultTheme="light"
            enableSystem
            disableTransitionOnChange
          >
            <div className="min-h-screen">
              {children}
            </div>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}