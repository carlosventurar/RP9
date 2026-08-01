import { Marked, type Tokens } from 'marked'

/**
 * Lector del CHANGELOG.md del repo para la pagina publica de novedades.
 *
 * El archivo es la unica fuente: no hay copia en base de datos ni en JSON. Lo que este
 * fichero hace es traducirlo a algo renderizable, quitando por el camino todo lo que
 * no le corresponde ver a un cliente.
 */

/** Las cinco secciones que si tienen algo que contarle a quien paga. `Interno` queda fuera. */
export const SECCIONES_PUBLICAS = [
  'Nuevo',
  'Mejorado',
  'Corregido',
  'Eliminado',
  'Seguridad',
] as const

export type SeccionPublica = (typeof SECCIONES_PUBLICAS)[number]

export interface EntradaChangelog {
  /** HTML del titular de negocio, ya sin la linea tecnica. */
  html: string
}

export interface SeccionChangelog {
  nombre: SeccionPublica
  entradas: EntradaChangelog[]
}

export interface VersionChangelog {
  /** Numero de version tal cual aparece entre corchetes, por ejemplo `1.2.0`. */
  version: string
  /** Fecha ISO del release, o null si el encabezado no la trae. */
  fecha: string | null
  secciones: SeccionChangelog[]
}

// `## [1.2.0] — 2026-05-15`, con la fecha opcional y aceptando guion normal o raya.
const ENCABEZADO_VERSION = /^##\s+\[([^\]]+)\]\s*(?:[—–-]\s*(\d{4}-\d{2}-\d{2}))?/
// `## Antes de este changelog` y cualquier otro `##` que no sea una version.
const ENCABEZADO_NIVEL_2 = /^##\s+/
const ENCABEZADO_SECCION = /^###\s+(.+?)\s*$/
const INICIO_BULLET = /^[-*]\s+(.*)$/

/**
 * Borra las lineas `<!-- tec: ... -->` y cualquier otro comentario HTML.
 *
 * No es cosmetica: esas lineas nombran archivos, variables de entorno e infraestructura
 * del proyecto. `marked` copia los comentarios HTML tal cual al output, asi que si no se
 * quitan del markdown quedan en el codigo fuente de la pagina publicada — invisibles en
 * pantalla, pero a un "ver codigo fuente" de distancia.
 */
function eliminarComentarios(texto: string): string {
  return (
    texto
      // Comentarios bien formados, incluidos los que ocupan varias lineas.
      .replace(/<!--[\s\S]*?-->/g, '')
      // Un comentario sin cerrar se lleva por delante todo lo que quede: preferimos
      // perder texto antes que publicar detalle tecnico por un `-->` que falta.
      .replace(/<!--[\s\S]*$/, '')
  )
}

function esSeccionPublica(nombre: string): nombre is SeccionPublica {
  return (SECCIONES_PUBLICAS as readonly string[]).includes(nombre)
}

/**
 * El regex del encabezado comprueba la forma `AAAA-MM-DD`, no que la fecha exista de verdad.
 * Un `2026-13-45` haria reventar al formateador de la pagina, asi que un dedazo en el
 * changelog deja esa version sin fecha en lugar de tumbar la ruta entera.
 */
function fechaValida(fecha: string | undefined): string | null {
  if (!fecha) return null
  const dia = new Date(`${fecha}T00:00:00Z`)
  if (Number.isNaN(dia.getTime())) return null
  // `new Date` normaliza de mas (un 2026-02-31 pasa a marzo): se compara la ida y la vuelta.
  return dia.toISOString().slice(0, 10) === fecha ? fecha : null
}

function escaparHtml(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// Solo esquemas de navegacion. Un `javascript:` o un `data:` no pintan nada en una nota de version.
const ESQUEMAS_DE_ENLACE_PERMITIDOS = /^(?:https?:\/\/|mailto:|\/|#)/i

/**
 * `marked` con las manos atadas: el resultado se inyecta con `dangerouslySetInnerHTML`,
 * asi que este parser es el unico filtro que hay. El HTML crudo del markdown se escapa en
 * vez de dejarlo pasar, y los enlaces solo sobreviven si apuntan a algo navegable.
 */
const renderizador = new Marked({
  renderer: {
    // Cualquier etiqueta escrita a mano en el markdown sale como texto, no como HTML.
    html(token: Tokens.HTML | Tokens.Tag) {
      return escaparHtml(token.text)
    },

    link(token: Tokens.Link) {
      const contenido = this.parser.parseInline(token.tokens)
      // Se quitan espacios y caracteres de control antes de mirar el esquema: `java\tscript:`
      // es el truco clasico para colarse por un chequeo ingenuo.
      const destino = token.href.replace(/[\s\x00-\x1f\x7f]/g, '')

      if (!ESQUEMAS_DE_ENLACE_PERMITIDOS.test(destino)) {
        return contenido
      }

      const titulo = token.title ? ` title="${escaparHtml(token.title)}"` : ''
      return `<a href="${escaparHtml(destino)}"${titulo}>${contenido}</a>`
    },
  },
})

/** Convierte el texto de un bullet en HTML inline (negritas, cursivas, codigo, enlaces). */
function renderizarEntrada(markdown: string): string {
  const html = renderizador.parseInline(markdown, { async: false })
  // Segunda pasada por si el markdown traia un comentario que sobrevivio al parseo.
  return eliminarComentarios(html).trim()
}

/**
 * Convierte el markdown del CHANGELOG en versiones listas para pintar.
 *
 * Quedan fuera, a proposito:
 * - `[Unreleased]`, porque la web solo anuncia lo que ya esta en produccion.
 * - La seccion `Interno`, que es trabajo sin cara de usuario.
 * - Las versiones que, tras filtrar, se quedan sin nada que mostrar.
 *
 * Las versiones salen en el orden del archivo (lo mas reciente arriba).
 */
export function parsearChangelog(markdown: string): VersionChangelog[] {
  const versiones: VersionChangelog[] = []

  let versionActual: VersionChangelog | null = null
  let seccionActual: SeccionChangelog | null = null
  // Lineas del bullet que se esta leyendo; el detalle puede continuar en la linea siguiente.
  let bulletAbierto: string[] | null = null

  const cerrarBullet = () => {
    if (!bulletAbierto || !seccionActual) {
      bulletAbierto = null
      return
    }
    const texto = eliminarComentarios(bulletAbierto.join(' ')).trim()
    if (texto) {
      seccionActual.entradas.push({ html: renderizarEntrada(texto) })
    }
    bulletAbierto = null
  }

  for (const linea of markdown.split('\n')) {
    const encabezadoVersion = linea.match(ENCABEZADO_VERSION)
    if (encabezadoVersion) {
      cerrarBullet()
      seccionActual = null
      const [, etiqueta, fecha] = encabezadoVersion
      // `[Unreleased]` se ignora entero: todavia no esta en manos de nadie.
      if (etiqueta.toLowerCase() === 'unreleased') {
        versionActual = null
        continue
      }
      versionActual = { version: etiqueta, fecha: fechaValida(fecha), secciones: [] }
      versiones.push(versionActual)
      continue
    }

    // Cualquier otro `##` (por ejemplo `## Antes de este changelog`) cierra la version.
    if (ENCABEZADO_NIVEL_2.test(linea)) {
      cerrarBullet()
      versionActual = null
      seccionActual = null
      continue
    }

    const encabezadoSeccion = linea.match(ENCABEZADO_SECCION)
    if (encabezadoSeccion) {
      cerrarBullet()
      const nombre = encabezadoSeccion[1]
      seccionActual =
        versionActual && esSeccionPublica(nombre)
          ? { nombre, entradas: [] }
          : null
      if (versionActual && seccionActual) {
        versionActual.secciones.push(seccionActual)
      }
      continue
    }

    if (!seccionActual) continue

    const inicioBullet = linea.match(INICIO_BULLET)
    if (inicioBullet) {
      cerrarBullet()
      bulletAbierto = [inicioBullet[1]]
      continue
    }

    // Linea en blanco: se acabo el bullet.
    if (!linea.trim()) {
      cerrarBullet()
      continue
    }

    // Linea indentada que continua el bullet anterior.
    if (bulletAbierto) {
      bulletAbierto.push(linea.trim())
    }
  }

  cerrarBullet()

  // Una version cuyo unico contenido era `Interno` no tiene nada que decirle al cliente.
  return versiones
    .map((version) => ({
      ...version,
      secciones: version.secciones.filter((seccion) => seccion.entradas.length > 0),
    }))
    .filter((version) => version.secciones.length > 0)
}
