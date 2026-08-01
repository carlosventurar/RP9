import fs from 'fs'
import path from 'path'

import { parsearChangelog, type VersionChangelog } from './changelog'

/**
 * Lectura del CHANGELOG.md del repo. Solo servidor.
 *
 * El archivo de la raiz es la unica fuente de la pagina de novedades: no hay copia en base
 * de datos ni en un JSON aparte, asi que no puede haber divergencia entre lo que dice el
 * repo y lo que ve el cliente.
 */

// Se lee y se parsea una sola vez por instancia del servidor: el contenido solo cambia con
// un despliegue nuevo, no entre peticiones.
let versionesEnCache: VersionChangelog[] | null = null

export function leerVersionesPublicadas(): VersionChangelog[] {
  if (versionesEnCache) return versionesEnCache

  const rutaChangelog = path.join(process.cwd(), 'CHANGELOG.md')

  try {
    versionesEnCache = parsearChangelog(fs.readFileSync(rutaChangelog, 'utf8'))
  } catch (error) {
    // Si el archivo no llegara al bundle del despliegue, la pagina muestra su estado vacio
    // en vez de tumbar la ruta entera. Queda el rastro en los logs porque una pagina de
    // novedades vacia se parece demasiado a una pagina de novedades correcta.
    console.error(`No se pudo leer ${rutaChangelog}:`, error)
    versionesEnCache = []
  }

  return versionesEnCache
}
