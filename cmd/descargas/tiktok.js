export const handler = {}
handler.name = 'tiktok'
handler.alias = ['tt', 'tiktokdl']
handler.category = 'descargas'
handler.description = 'Descarga TikTok sin marca de agua con NeoXR'

const API_KEY = process.env.NEOXR_API_KEY || 'russellxz'
const API_URL = 'https://api.neoxr.eu/api/tiktok'

// Acepta enlaces de video en distintos formatos de respuesta de NeoXR.
const obtenerUrl = (valor) => {
  if (typeof valor === 'string') {
    return /^https?:\/\//i.test(valor) ? valor : null
  }
  if (Array.isArray(valor)) {
    for (const elemento of valor) {
      const enlace = obtenerUrl(elemento)
      if (enlace) return enlace
    }
    return null
  }
  if (!valor || typeof valor !== 'object') return null

  for (const campo of [
    'nowm', 'no_watermark', 'noWatermark', 'nowatermark',
    'hdplay', 'play', 'video', 'download', 'url', 'src', 'link', 'wmplay'
  ]) {
    const enlace = obtenerUrl(valor[campo])
    if (enlace) return enlace
  }
  return null
}

handler.exec = async (sock, m) => {
  const from = m.key.remoteJid
  const body = m.message?.conversation || m.message?.extendedTextMessage?.text || ''
  const enlace = body.match(/https?:\/\/[^\s<>]+/i)?.[0]
  let url

  try {
    url = new URL(enlace)
    const dominio = url.hostname.toLowerCase()
    if (dominio !== 'tiktok.com' && !dominio.endsWith('.tiktok.com')) {
      throw new Error('Enlace inválido')
    }
  } catch {
    return sock.sendMessage(from, {
      text: '✧ Pon un link de TikTok\nEj: .tiktok https://vm.tiktok.com/xxx'
    }, { quoted: m })
  }

  await sock.sendMessage(from, { text: '⏳ Descargando TikTok...' }, { quoted: m })

  try {
    const consulta = new URL(API_URL)
    consulta.searchParams.set('url', url.toString())
    consulta.searchParams.set('apikey', API_KEY)

    const res = await fetch(consulta.toString(), {
      signal: AbortSignal.timeout(30000)
    })
    if (!res.ok) throw new Error(`NeoXR respondió HTTP ${res.status}`)

    const json = await res.json()
    if (json.status === false || json.success === false) {
      throw new Error(json.message || json.error || 'NeoXR no pudo obtener el video')
    }

    const resultado = json.result ?? json.data ?? json
    const opciones = [resultado, resultado?.data, json.data, json.result]
    let video = null
    let descripcion = 'TikTok'

    for (const item of opciones) {
      if (!item || typeof item !== 'object') continue
      descripcion = item.title || item.description || item.caption || descripcion
      video ||= obtenerUrl(item.video)
        || obtenerUrl(item.nowm)
        || obtenerUrl(item.no_watermark)
        || obtenerUrl(item.hdplay)
        || obtenerUrl(item.play)
        || obtenerUrl(item.download)
        || obtenerUrl(item.media?.video)
        || obtenerUrl(item.videos)
        || obtenerUrl(item.video_url)
        || obtenerUrl(item.videoUrl)
    }

    if (!video) throw new Error('NeoXR no devolvió un enlace de video compatible')

    await sock.sendMessage(from, {
      video: { url: video },
      caption: `*${String(descripcion).slice(0, 900)}*`
    }, { quoted: m })
  } catch (error) {
    const detalle = error?.name === 'TimeoutError'
      ? 'La API tardó demasiado en responder'
      : error?.message || String(error)
    await sock.sendMessage(from, {
      text: `❌ No se pudo descargar el TikTok.\n${detalle}`
    }, { quoted: m })
  }
}