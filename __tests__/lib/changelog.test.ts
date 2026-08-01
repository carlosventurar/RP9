import { parsearChangelog } from '@/lib/changelog'

// Muestra que replica el formato real del CHANGELOG.md: titular de negocio en negrita
// seguido de la linea tecnica en comentario HTML, que NUNCA debe llegar al navegador.
const CHANGELOG_MUESTRA = `# Changelog — Proyecto

Todo cambio que llega a produccion se anota aqui.

## [Unreleased]

### Nuevo
- **Algo que todavia no se libera.** No debe salir en la web.
  <!-- tec: src/pendiente.ts · no liberado -->

## [1.1.0] — 2026-05-15

### Nuevo
- **El reporte llega solo cada manana.** Sale a las 6:00 AM y no hay que pedirlo.
  <!-- tec: src/handler.py, src/sftp_client.py · EventBridge cron(0 10 * * ? *) · env SFTP_HOST -->

### Corregido
- **Las tildes ya no salen partidas en el CSV.** Los nombres con enie se leen bien en Excel.
  <!-- tec: src/csv_writer.py · encoding utf-8-sig -->

### Interno
- Reorganizacion del cliente SFTP para poder probarlo sin servidor real.
  <!-- tec: inyeccion de dependencias en sftp_client · 56 tests pytest -->

## [1.0.0] — 2026-04-01

### Seguridad
- **Las credenciales salieron del codigo.** Ahora viven en un gestor de secretos.
  <!-- tec: src/config.py · secret PROJ/SFTP · IAM role minimo -->

## Antes de este changelog

El trabajo anterior al 2026-04-01 no esta desglosado aqui. Ver \`git log v1.0.0\`.
`

describe('parsearChangelog', () => {
  it('agrupa las entradas por version, con su fecha, de la mas reciente a la mas vieja', () => {
    const versiones = parsearChangelog(CHANGELOG_MUESTRA)

    expect(versiones.map((v) => v.version)).toEqual(['1.1.0', '1.0.0'])
    expect(versiones[0].fecha).toBe('2026-05-15')
    expect(versiones[1].fecha).toBe('2026-04-01')
  })

  it('agrupa cada version en sus secciones, conservando el orden del archivo', () => {
    const [v110] = parsearChangelog(CHANGELOG_MUESTRA)

    expect(v110.secciones.map((s) => s.nombre)).toEqual(['Nuevo', 'Corregido'])
    expect(v110.secciones[0].entradas).toHaveLength(1)
    expect(v110.secciones[0].entradas[0].html).toContain('<strong>')
    expect(v110.secciones[0].entradas[0].html).toContain('El reporte llega solo cada manana.')
  })

  it('descarta la seccion Interno: es trabajo sin cara de usuario', () => {
    const [v110] = parsearChangelog(CHANGELOG_MUESTRA)

    expect(v110.secciones).not.toHaveLength(0)
    expect(v110.secciones.map((s) => s.nombre)).not.toContain('Interno')

    const todoElHtml = JSON.stringify(parsearChangelog(CHANGELOG_MUESTRA))
    expect(todoElHtml).not.toContain('Reorganizacion del cliente SFTP')
    expect(todoElHtml).not.toContain('pytest')
  })

  // El filtro va contra el encabezado `### Interno`, no contra la palabra suelta. Un cliente
  // puede llamarle "Portal Interno" a su producto, y esa entrada tiene que salir publicada.
  it('no confunde la seccion Interno con la palabra Interno dentro de una entrada', () => {
    const conNombreDeProducto = `## [1.0.0] — 2026-04-01

### Nuevo
- **El Portal Interno de RRHH abre desde el mismo menu.** No hay que volver a entrar.
  <!-- tec: src/app/portal · SSO compartido -->

### Interno
- Limpieza de imports en el modulo de RRHH.
  <!-- tec: sin efecto visible -->
`

    const [version] = parsearChangelog(conNombreDeProducto)

    expect(version.secciones.map((s) => s.nombre)).toEqual(['Nuevo'])
    expect(version.secciones[0].entradas[0].html).toContain('Portal Interno')
    expect(JSON.stringify(version)).not.toContain('Limpieza de imports')
  })

  it('descarta [Unreleased]: la web solo muestra lo que ya esta en produccion', () => {
    const versiones = parsearChangelog(CHANGELOG_MUESTRA)

    expect(versiones).not.toHaveLength(0)
    expect(versiones.map((v) => v.version)).not.toContain('Unreleased')
    expect(JSON.stringify(versiones)).not.toContain('todavia no se libera')
  })

  it('ignora el bloque "Antes de este changelog", que no es una version', () => {
    const versiones = parsearChangelog(CHANGELOG_MUESTRA)

    expect(versiones).toHaveLength(2)
    expect(JSON.stringify(versiones)).not.toContain('Antes de este changelog')
  })

  // Esta es la que protege datos del cliente: la linea tecnica nombra archivos, variables
  // de entorno e infraestructura. marked deja pasar los comentarios HTML al output, asi que
  // sin este stripping quedarian visibles en "ver codigo fuente" de la pagina publicada.
  it('el HTML resultante no contiene ni un rastro de la linea tecnica', () => {
    const htmlCompleto = parsearChangelog(CHANGELOG_MUESTRA)
      .flatMap((v) => v.secciones)
      .flatMap((s) => s.entradas)
      .map((e) => e.html)
      .join('\n')

    // Sin esto el test pasaria con un parser que no devuelve nada, y no protegeria nada.
    expect(htmlCompleto).toContain('El reporte llega solo cada manana.')
    expect(htmlCompleto).toContain('Las credenciales salieron del codigo.')

    expect(htmlCompleto).not.toContain('tec:')
    expect(htmlCompleto).not.toContain('<!--')
    expect(htmlCompleto).not.toContain('-->')
    expect(htmlCompleto).not.toContain('SFTP_HOST')
    expect(htmlCompleto).not.toContain('src/handler.py')
    expect(htmlCompleto).not.toContain('EventBridge')
    expect(htmlCompleto).not.toContain('IAM')
  })

  it('descarta una version que se quede sin nada que mostrarle al cliente', () => {
    const soloInterno = `## [2.0.0] — 2026-06-01

### Interno
- Limpieza de imports.
  <!-- tec: todo el src -->
`

    expect(parsearChangelog(soloInterno)).toEqual([])
  })

  it('une el detalle que continua en la linea siguiente', () => {
    const multilinea = `## [1.0.0] — 2026-04-01

### Mejorado
- **El panel carga mas rapido.** Abre en poco mas de un segundo
  en vez de los tres y medio que tardaba antes.
  <!-- tec: src/panel.tsx · lazy loading -->
`

    const [entrada] = parsearChangelog(multilinea)[0].secciones[0].entradas
    expect(entrada.html).toContain('en vez de los tres y medio')
    expect(entrada.html).not.toContain('lazy loading')
  })

  // La fecha se formatea con Intl, que revienta con una fecha imposible. Un dedazo en el
  // CHANGELOG no puede tumbar la pagina: si la fecha no existe en el calendario, no hay fecha.
  it('descarta una fecha que cumple el formato pero no existe', () => {
    const [version] = parsearChangelog(
      '## [1.0.0] — 2026-13-45\n\n### Nuevo\n- **Algo.** Detalle.\n'
    )

    expect(version.version).toBe('1.0.0')
    expect(version.fecha).toBeNull()
    expect(version.secciones[0].entradas).toHaveLength(1)
  })

  it('acepta una fecha real, incluido el 29 de febrero de un bisiesto', () => {
    expect(parsearChangelog('## [1.0.0] — 2028-02-29\n\n### Nuevo\n- **Algo.**\n')[0].fecha).toBe(
      '2028-02-29'
    )
  })

  it('no se cae con un changelog vacio o sin versiones liberadas', () => {
    expect(parsearChangelog('')).toEqual([])
    expect(parsearChangelog('# Changelog\n\n## [Unreleased]\n')).toEqual([])
  })

  // El HTML se inyecta con dangerouslySetInnerHTML, asi que el parser es el unico filtro.
  // El CHANGELOG.md es contenido del repo, pero una entrada pegada de cualquier sitio no
  // deberia poder ejecutar nada.
  describe('HTML seguro', () => {
    const parsearEntrada = (bullet: string) =>
      parsearChangelog(`## [1.0.0] — 2026-04-01\n\n### Nuevo\n- ${bullet}\n`)[0].secciones[0]
        .entradas[0].html

    it('escapa el HTML crudo en vez de dejarlo pasar', () => {
      const html = parsearEntrada('Ojo <script>alert(1)</script> con esto')

      expect(html).not.toContain('<script>')
      expect(html).toContain('&lt;script&gt;')
    })

    it('escapa etiquetas con manejadores de eventos', () => {
      const html = parsearEntrada('Mira <img src=x onerror="alert(1)"> aqui')

      expect(html).not.toContain('<img')
      expect(html).not.toContain('onerror="alert(1)"')
    })

    it('descarta enlaces con esquemas que no son de navegacion', () => {
      const html = parsearEntrada('Lee la [guia](javascript:alert(1)) completa')

      expect(html).not.toContain('javascript:')
      expect(html).toContain('guia')
    })

    it('deja pasar los enlaces normales, que si tienen sentido en una nota de version', () => {
      const html = parsearEntrada('Lee la [guia](https://agentevirtualia.com/docs) completa')

      expect(html).toContain('href="https://agentevirtualia.com/docs"')
      expect(html).toContain('guia')
    })

    // Al limpiar el href hay que quitar espacios y caracteres de control, pero ni un guion:
    // media web tiene guiones en la ruta.
    it('no estropea las URLs que llevan guiones', () => {
      const html = parsearEntrada('Ver el [detalle](https://agentevirtualia.com/centro-de-ayuda)')

      expect(html).toContain('href="https://agentevirtualia.com/centro-de-ayuda"')
    })

    it('tampoco cuela un esquema partido con caracteres de control', () => {
      const html = parsearEntrada('Lee la [guia](java\tscript:alert(1)) completa')

      expect(html).not.toContain('javascript:')
      expect(html).not.toContain('href=')
    })

    it('conserva el formato inline util: negrita, cursiva y codigo', () => {
      const html = parsearEntrada('**Titular.** Detalle en *cursiva* con `codigo`')

      expect(html).toContain('<strong>Titular.</strong>')
      expect(html).toContain('<em>cursiva</em>')
      expect(html).toContain('<code>codigo</code>')
    })
  })
})
