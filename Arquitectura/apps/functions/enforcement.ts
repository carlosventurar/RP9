import { Handler } from '@netlify/functions'
export const handler: Handler = async () => {
  // TODO: leer consumo del periodo por tenant vs limits del plan
  // - enviar alerta al 80%/100%
  // - aplicar auto-upgrade si flag activo y 2 meses seguidos superan límite
  return { statusCode: 200, body: JSON.stringify({ ok: true }) }
}
