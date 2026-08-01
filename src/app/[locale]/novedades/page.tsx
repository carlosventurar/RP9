import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { ArrowUpCircle, Link2, ShieldCheck, Sparkles, Trash2, Wrench } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { leerVersionesPublicadas } from '@/lib/changelog-server'
import type { SeccionPublica, VersionChangelog } from '@/lib/changelog'

interface PropsPagina {
  params: Promise<{ locale: string }>
}

/** Icono y color de cada sección, para que se distingan de un vistazo sin tener que leerlas. */
const ESTILO_SECCION: Record<SeccionPublica, { icono: LucideIcon; clases: string }> = {
  Nuevo: {
    icono: Sparkles,
    clases:
      'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-900',
  },
  Mejorado: {
    icono: ArrowUpCircle,
    clases:
      'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950 dark:text-blue-200 dark:border-blue-900',
  },
  Corregido: {
    icono: Wrench,
    clases:
      'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-900',
  },
  Eliminado: {
    icono: Trash2,
    clases:
      'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700',
  },
  Seguridad: {
    icono: ShieldCheck,
    clases:
      'bg-violet-50 text-violet-800 border-violet-200 dark:bg-violet-950 dark:text-violet-200 dark:border-violet-900',
  },
}

/** `1.2.0` -> `v1-2-0`, para poder enlazar una versión concreta. */
function anclaDeVersion(version: string): string {
  return `v${version.replace(/\./g, '-')}`
}

function formatearFecha(fecha: string, locale: string): string {
  // Se fija UTC a proposito: sin esto una fecha ISO se corre un dia en husos negativos.
  const formateador = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
  return formateador.format(new Date(`${fecha}T00:00:00Z`))
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('changelog')

  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
    robots: 'index, follow',
    openGraph: {
      title: t('metaTitle'),
      description: t('metaDescription'),
      type: 'website',
    },
  }
}

export default async function NovedadesPage({ params }: PropsPagina) {
  const { locale } = await params
  const t = await getTranslations('changelog')
  const versiones = leerVersionesPublicadas()

  const etiquetaSeccion: Record<SeccionPublica, string> = {
    Nuevo: t('sections.Nuevo'),
    Mejorado: t('sections.Mejorado'),
    Corregido: t('sections.Corregido'),
    Eliminado: t('sections.Eliminado'),
    Seguridad: t('sections.Seguridad'),
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-12 sm:py-16">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{t('title')}</h1>
            <p className="mt-3 text-base text-muted-foreground sm:text-lg">{t('subtitle')}</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-10 sm:py-14">
        <div className="mx-auto max-w-3xl">
          {versiones.length === 0 ? (
            <p className="rounded-lg border border-dashed px-6 py-12 text-center text-muted-foreground">
              {t('empty')}
            </p>
          ) : (
            <ol className="space-y-8">
              {versiones.map((version, indice) => (
                <li key={version.version}>
                  <TarjetaVersion
                    version={version}
                    esVersionActual={indice === 0}
                    locale={locale}
                    etiquetaSeccion={etiquetaSeccion}
                    etiquetaVersionActual={t('currentVersion')}
                    etiquetaEnlace={t('versionLink', { version: version.version })}
                  />
                </li>
              ))}
            </ol>
          )}

          <p className="mt-12 text-center text-sm text-muted-foreground">{t('historyNote')}</p>
        </div>
      </main>
    </div>
  )
}

interface PropsTarjetaVersion {
  version: VersionChangelog
  esVersionActual: boolean
  locale: string
  etiquetaSeccion: Record<SeccionPublica, string>
  etiquetaVersionActual: string
  etiquetaEnlace: string
}

function TarjetaVersion({
  version,
  esVersionActual,
  locale,
  etiquetaSeccion,
  etiquetaVersionActual,
  etiquetaEnlace,
}: PropsTarjetaVersion) {
  const ancla = anclaDeVersion(version.version)

  return (
    <Card id={ancla} className="scroll-mt-24 overflow-hidden">
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h2 className="text-2xl font-semibold tracking-tight">
            <a
              href={`#${ancla}`}
              aria-label={etiquetaEnlace}
              className="group inline-flex min-h-11 items-center gap-2 rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
            >
              {version.version}
              <Link2
                aria-hidden="true"
                className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
              />
            </a>
          </h2>

          {esVersionActual && <Badge>{etiquetaVersionActual}</Badge>}

          {version.fecha && (
            <time
              dateTime={version.fecha}
              className="ml-auto text-sm text-muted-foreground"
            >
              {formatearFecha(version.fecha, locale)}
            </time>
          )}
        </div>
      </CardHeader>

      <Separator />

      <CardContent className="space-y-7 pt-6">
        {version.secciones.map((seccion) => {
          const { icono: Icono, clases } = ESTILO_SECCION[seccion.nombre]

          return (
            <section key={seccion.nombre}>
              <h3 className="mb-3">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-sm font-semibold ${clases}`}
                >
                  <Icono aria-hidden="true" className="size-4" />
                  {etiquetaSeccion[seccion.nombre]}
                </span>
              </h3>

              <ul className="space-y-3">
                {seccion.entradas.map((entrada, indice) => (
                  <li key={indice} className="flex gap-3">
                    <span
                      aria-hidden="true"
                      className="mt-2 size-1.5 shrink-0 rounded-full bg-muted-foreground/60"
                    />
                    {/*
                      El HTML sale del CHANGELOG.md del propio repo, ya pasado por el parser:
                      las lineas tecnicas y cualquier comentario se eliminan antes de renderizar.
                    */}
                    <p
                      className="text-[0.95rem] leading-relaxed text-foreground/90 [&>strong]:font-semibold [&>strong]:text-foreground"
                      dangerouslySetInnerHTML={{ __html: entrada.html }}
                    />
                  </li>
                ))}
              </ul>
            </section>
          )
        })}
      </CardContent>
    </Card>
  )
}
