export const handler = {}

handler.name = 'instagram'
handler.alias = ['ig', 'igdl', 'insta']
handler.category = 'descargas'
handler.description = 'Descarga reels, videos y fotos de Instagram'

const API_URL = 'https://api.neoxr.eu/api/ig'
const API_KEY = process.env.NEOXR_API_KEY || 'russellxz'

function extraerMedios(data) {
  const medios = []
  const urls = new Set()

  function agregar(url, tipo = '') {
    if (typeof url !== 'string') return
    if (!/^https?:\/\//i.test(url)) return
    if (/instagram\.com\/(p|reel|reels|tv|stories)\//i.test(url)) return
    if (urls.has(url)) return

    urls.add(url)

    const esVideo =
      /video|mp4|reel/i.test(tipo) ||
      /\.(mp4|mov|webm)(\?|$)/i.test(url)

    medios.push({
      url,
      type: esVideo ? 'video' : 'image'
    })
  }

  function recorrer(obj, tipo = '', nivel = 0) {
    if (!obj || nivel > 7) return

    if (typeof obj === 'string') {
      agregar(obj, tipo)
      return
    }

    if (Array.isArray(obj)) {
      for (const item of obj) {
        recorrer(item, tipo, nivel + 1)
      }
      return
    }

    if (typeof obj !== 'object') return

    const tipoActual = obj.type || obj.media_type || tipo

    const camposVideo = [
      'video',
      'video_url',
      'videoUrl',
      'play',
      'play_url',
      'nowm'
    ]

    const camposImagen = [
      'image',
      'image_url',
      'imageUrl',
      'photo'
    ]

    const camposURL = [
      'url',
      'src',
      'download',
      'download_url',
      'downloadUrl',
      'hd',
      'sd'
    ]

    const camposLista = [
      'data',
      'result',
      'results',
      'media',
      'medias',
      'items',
      'carousel',
      'slides',
      'downloads',
      'files',
      'urls'
    ]

    for (const campo of camposVideo) {
      if (obj[campo]) {
        recorrer(obj[campo], 'video', nivel + 1)
      }
    }

    for (const campo of camposImagen) {
      if (obj[campo]) {
        recorrer(obj[campo], 'image', nivel + 1)
      }
    }

    for (const campo of camposURL) {
      if (obj[campo]) {
        recorrer(obj[campo], tipoActual, nivel + 1)
      }
    }

    for (const campo of camposLista) {
      if (obj[campo]) {
        recorrer(obj[campo], tipoActual, nivel + 1)
      }
    }
  }

  recorrer(data)
  return medios
}

handler.exec = async (sock, m) => {
  const from = m.key.remoteJid

  const body =
    m.message?.conversation ||
    m.message?.extendedTextMessage?.text ||
    ''

  const url = body.trim().split(/\s+/)[1]

  if (!url || !/^https?:\/\/(?:www\.)?instagram\.com\//i.test(url)) {
    return sock.sendMessage(from, {
      text: '✧ Pon un link de Instagram\nEj: .ig https://www.instagram.com/reel/xxx'
    }, { quoted: m })
  }

  await sock.sendMessage(from, {
    text: '⏳ Bajando de IG...'
  }, { quoted: m })

  try {
    const endpoint = new URL(API_URL)
    endpoint.searchParams.set('url', url)
    endpoint.searchParams.set('apikey', API_KEY)

    const res = await fetch(endpoint.toString(), {
      signal: AbortSignal.timeout(30000)
    })

    if (!res.ok) {
      throw new Error(`NeoXR respondió HTTP ${res.status}`)
    }

    const data = await res.json()

    if (data.status === false || data.success === false) {
      throw new Error(
        data.message ||
        data.error ||
        'La API rechazó la descarga'
      )
    }

    const medios = extraerMedios(data)

    if (!medios.length) {
      throw new Error('NeoXR no devolvió archivos descargables')
    }

    let enviados = 0

    for (const media of medios) {
      try {
        if (media.type === 'video') {
          await sock.sendMessage(from, {
            video: { url: media.url },
            caption: '📹 Instagram'
          }, { quoted: m })
        } else {
          await sock.sendMessage(from, {
            image: { url: media.url },
            caption: '📸 Instagram | NeoXR'
          }, { quoted: m })
        }

        enviados++
      } catch (error) {
        console.error('[INSTAGRAM] Error enviando archivo:', error)
      }
    }

    if (enviados === 0) {
      throw new Error('No se pudo enviar ningún archivo')
    }

    if (enviados < medios.length) {
      await sock.sendMessage(from, {
        text: `⚠️ Se enviaron ${enviados} de ${medios.length} archivos.`
      }, { quoted: m })
    }

  } catch (e) {
    console.error('[INSTAGRAM] Error:', e)

    const mensaje = e.name === 'TimeoutError'
      ? 'La API tardó demasiado en responder.'
      : e.message || String(e)

    await sock.sendMessage(from, {
      text: `❌ No se pudo descargar de Instagram.\n\n${mensaje}`
    }, { quoted: m })
  }
}