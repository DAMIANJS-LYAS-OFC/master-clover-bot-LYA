import yts from 'yt-search'
import config from '../../config.js'
import { prepareWAMessageMedia } from 'baileys'

export const handler = {}
handler.name = 'play'
handler.alias = ['ytmp3','mp3','ytaudio','audio']
handler.category = 'descargas'
handler.description = 'Descarga audio de YouTube'

const YOSOYYO_API = 'https://api-yosoyyo-api-ofc.onrender.com/api/youtube'
const YOSOYYO_KEY = 'yosoyyo_sk_rwbuo0cs'
const NEOXR_API = 'https://api.neoxr.eu/api/youtube'
const NEOXR_KEY = 'russellxz'
const BASE_URL = 'https://cnv.cx'
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36'
const SERVERS = [
 { name: 'y2meta-uk', origin: 'https://iframe.y2meta-uk.com', referer: 'https://iframe.y2meta-uk.com/' },
 { name: 'mp3yt', origin: 'https://mp3yt.is', referer: 'https://mp3yt.is/' }
]
const MAX_AUDIO_SIZE = 80 * 1024 * 1024

function headersFor(server){
 return { 'Accept': '*/*', 'Origin': server.origin, 'Referer': server.referer, 'User-Agent': USER_AGENT, 'Cache-Control': 'no-cache' }
}
function extractYouTubeId(value){
 try{
 const u = new URL(String(value).trim())
 const host = u.hostname.toLowerCase().replace(/^www\./, '')
 let id = ''
 if(host === 'youtu.be') id = u.pathname.split('/')[1]
 else if(host === 'youtube.com' || host.endsWith('.youtube.com')){
 if(u.pathname === '/watch') id = u.searchParams.get('v')
 else { const p = u.pathname.split('/'); if(['shorts','embed','live','v'].includes(p[1])) id = p[2] }
 }
 return /^[a-zA-Z0-9_-]{11}$/.test(id || '') ? id : null
 }catch{ return null }
}
async function fetchWithTimeout(url, options={}, timeoutMs=20000){
 const c = new AbortController(); const t = setTimeout(()=>c.abort(), timeoutMs)
 try{ return await fetch(url, { ...options, signal: c.signal, redirect: 'follow' }) }finally{ clearTimeout(t) }
}
async function readJson(res, label){
 const text = await res.text()
 let data; try{ data = JSON.parse(text) }catch{ throw new Error(`${label}: respuesta inválida`) }
 if(!res.ok || data?.error === true) throw new Error(`${label}: ${data?.errorMsg || data?.message || `HTTP ${res.status}`}`)
 return data
}
async function freshKey(server, videoUrl){
 const id = extractYouTubeId(videoUrl); if(!id) throw new Error('ID de YouTube inválido')
 const res = await fetchWithTimeout(`${BASE_URL}/v2/sanity/key?id=${id}`, { method:'GET', headers: headersFor(server) }, 10000)
 const data = await readJson(res, `${server.name} key`)
 if(!data.key) throw new Error(`${server.name}: key no disponible`)
 return data.key
}
async function convertWithServer(server, videoUrl){
 const key = await freshKey(server, videoUrl)
 const payload = { link: videoUrl, format:'mp3', audioBitrate:'128', videoQuality:'720', filenameStyle:'pretty', vCodec:'h264' }
 const res = await fetchWithTimeout(`${BASE_URL}/v2/converter`, { method:'POST', headers:{ ...headersFor(server), 'Content-Type':'application/x-www-form-urlencoded', key }, body: new URLSearchParams(payload).toString() }, 32000)
 const data = await readJson(res, `${server.name} converter`)
 if(!data?.url) throw new Error(`${server.name}: no devolvió URL`)
 return { ...data, provider: server.name }
}
async function cnvConvert(videoUrl){
 try{ return await Promise.any(SERVERS.map(s=>convertWithServer(s, videoUrl))) }catch(err){
 throw new Error(err.errors?.map(e=>e.message).join(' | ') || 'Todos los conversores fallaron')
 }
}
async function downloadAudio(url, referer = 'https://www.youtube.com/'){
  const attempts = [
    { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36', 'Accept': 'audio/*,application/octet-stream,*/*', 'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8', 'Referer': referer, 'Origin': 'https://www.youtube.com', 'Sec-Fetch-Dest': 'audio', 'Sec-Fetch-Mode': 'cors', 'Sec-Fetch-Site': 'cross-site' },
    { 'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 Chrome/131.0.0.0 Mobile Safari/537.36', 'Accept': '*/*', 'Referer': 'https://m.youtube.com/', 'Origin': 'https://m.youtube.com' },
    { 'User-Agent': USER_AGENT, 'Accept': '*/*' }
  ]
  let lastError = null
  for(const headers of attempts){
    try{
      const c = new AbortController()
      const t = setTimeout(()=>c.abort(), 120000)
      try{
        const res = await fetch(url, { signal: c.signal, redirect: 'follow', headers })
        if(res.status === 403){ lastError = new Error('Error descargando audio: HTTP 403'); continue }
        if(!res.ok) throw new Error(`Error descargando audio: HTTP ${res.status}`)
        const ct = (res.headers.get('content-type')||'').toLowerCase()
        if(ct.includes('text/html')) throw new Error('El servidor no devolvió audio')
        const len = Number(res.headers.get('content-length')||0)
        if(len > MAX_AUDIO_SIZE) throw new Error('Audio demasiado grande')
        const chunks=[]; let total=0
        for await(const chunk of res.body){ const d=Buffer.from(chunk); total+=d.length; if(total>MAX_AUDIO_SIZE) throw new Error('Audio demasiado grande'); chunks.push(d) }
        const buffer=Buffer.concat(chunks)
        if(buffer.length<1000) throw new Error('Archivo de audio vacío')
        return { buffer, contentType: ct }
      }finally{ clearTimeout(t) }
    }catch(e){ lastError = e }
  }
  throw lastError || new Error('Error descargando audio')
}
function detectAudioFormat(buffer, contentType){
 if(buffer.subarray(0,3).toString()==='ID3' || (buffer[0]===0xff && (buffer[1]&0xe0)===0xe0) || contentType.includes('audio/mpeg')) return { ext:'mp3', mimetype:'audio/mpeg' }
 if(buffer.subarray(4,8).toString()==='ftyp' || contentType.includes('audio/mp4')) return { ext:'m4a', mimetype:'audio/mp4' }
 if(buffer.subarray(0,4).toString()==='OggS') return { ext:'ogg', mimetype:'audio/ogg' }
 if(buffer.subarray(0,4).toString('hex')==='1a45dfa3') return { ext:'webm', mimetype:'audio/webm' }
 return { ext:'mp3', mimetype:'audio/mpeg' }
}
function findUrlInJson(obj){
 if(!obj || typeof obj !== 'object') return null
 const keys = ['download', 'url', 'audio', 'link', 'dl', 'mp3']
 for(const k of keys){ if(typeof obj[k] === 'string' && obj[k].startsWith('http')) return obj[k] }
 for(const v of Object.values(obj)){ if(v && typeof v === 'object'){ const found = findUrlInJson(v); if(found) return found } }
 return null
}
async function getAudioFromYosoyyo(query){
  const apiUrl = `${YOSOYYO_API}?q=${encodeURIComponent(query)}&apiKey=${YOSOYYO_KEY}`
  const res = await fetchWithTimeout(apiUrl, { method: 'GET', headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/json' } }, 30000)
  const ct = (res.headers.get('content-type')||'').toLowerCase()
  if(ct.includes('audio') || ct.includes('octet-stream')){
    const buf = Buffer.from(await res.arrayBuffer())
    return { buffer: buf, ...detectAudioFormat(buf, ct) }
  }
  const data = await readJson(res, 'Yosoyyo')
  const dlUrl = findUrlInJson(data)
  if(!dlUrl) throw new Error('Yosoyyo no devolvió link de descarga')
  let referer = 'https://www.youtube.com/'
  try{ referer = new URL(dlUrl).origin + '/' }catch{}
  const audioData = await downloadAudio(dlUrl, referer)
  const format = detectAudioFormat(audioData.buffer, audioData.contentType)
  return { buffer: audioData.buffer, ...format }
}

async function getAudioFromNeoxr(videoUrl){
  const params = new URLSearchParams({
    url: videoUrl,
    type: 'audio',
    quality: '128kbps',
    apikey: NEOXR_KEY
  })

  const apiUrl = `${NEOXR_API}?${params.toString()}`
  const res = await fetchWithTimeout(apiUrl, {
    method: 'GET',
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'application/json, audio/*, */*'
    }
  }, 45000)

  const ct = (res.headers.get('content-type') || '').toLowerCase()

  if(!res.ok){
    throw new Error(`NeoXR respondió HTTP ${res.status}`)
  }

  if(ct.includes('audio/') || ct.includes('octet-stream')){
    const len = Number(res.headers.get('content-length') || 0)
    if(len > MAX_AUDIO_SIZE) throw new Error('Audio demasiado grande')

    const chunks = []
    let total = 0
    for await(const chunk of res.body){
      const part = Buffer.from(chunk)
      total += part.length
      if(total > MAX_AUDIO_SIZE) throw new Error('Audio demasiado grande')
      chunks.push(part)
    }

    const buffer = Buffer.concat(chunks)
    if(buffer.length < 1000) throw new Error('NeoXR devolvió un archivo vacío')

    const format = detectAudioFormat(buffer, ct)
    return { buffer, ...format }
  }

  const data = await readJson(res, 'NeoXR')

  if(
    data?.status === false ||
    data?.success === false ||
    data?.error === true
  ){
    throw new Error(
      data?.message ||
      data?.errorMsg ||
      'NeoXR no pudo procesar el audio'
    )
  }

  const result = data?.data || data?.result || data
  const dlUrl = findUrlInJson(result)

  if(!dlUrl){
    throw new Error('NeoXR no devolvió un enlace de descarga')
  }

  const parsedUrl = new URL(dlUrl)
  const host = parsedUrl.hostname.toLowerCase()

  if(
    host === 'youtube.com' ||
    host.endsWith('.youtube.com') ||
    host === 'youtu.be'
  ){
    throw new Error('NeoXR no devolvió un enlace directo al audio')
  }

  console.log('[PLAY] NeoXR: descargando audio')

  let referer = 'https://www.youtube.com/'
  try{
    referer = parsedUrl.origin + '/'
  }catch{}

  const audioData = await downloadAudio(dlUrl, referer)
  const format = detectAudioFormat(audioData.buffer, audioData.contentType)

  return {
    buffer: audioData.buffer,
    ...format
  }
}

async function getAudioFromApi(videoUrl, query, sock, from, m){
  try{
    return await getAudioFromYosoyyo(query)
  }catch(e){
    console.log('[PLAY] Yosoyyo falló, usando cnv.cx:', e.message)
  }

  try{
    const result = await cnvConvert(videoUrl)

    if(!result?.url){
      throw new Error('No se encontró el enlace')
    }

    let audioData

    try{
      audioData = await downloadAudio(result.url)
    }catch(err){
      if(!result.url.includes('/tunnel?')) throw err

      audioData = await downloadAudio(
        result.url.replace('/tunnel?', '/tunnel/?')
      )
    }

    const format = detectAudioFormat(
      audioData.buffer,
      audioData.contentType
    )

    return {
      buffer: audioData.buffer,
      ...format
    }

  }catch(e){
    console.log('[PLAY] CNV falló, usando NeoXR:', e.message)
  }

  await sock.sendMessage(from, {
    text: '⚠️ *Las APIs anteriores fallaron.*\n\n🔄 *Usando NeoXR como respaldo para descargar tu audio...*'
  }, { quoted: m })

  try{
    const audio = await getAudioFromNeoxr(videoUrl)
    console.log('[PLAY] NeoXR descargó el audio correctamente')
    return audio
  }catch(e){
    console.log('[PLAY] NeoXR también falló:', e.message)
    throw new Error(`Todas las APIs fallaron. NeoXR: ${e.message}`)
  }
}

handler.exec = async (sock, m) => {
 const from = m.key.remoteJid
 const body = m.message?.conversation || m.message?.extendedTextMessage?.text || ''
 const q = body.trim().split(/ +/).slice(1).join(' ').trim()
 if(!q) return sock.sendMessage(from, { text: 'Usa: .play bad bunny dtmf' }, { quoted: m })
 try{
 let videoUrl = q
 let video = {}
 if(!q.startsWith('http')){
 const s = await yts(q)
 if(!s.videos.length) throw new Error('Sin resultados')
 video = s.videos[0]; videoUrl = video.url
 } else {
 const s = await yts(q)
 video = s.videos[0] || {}
 }
 const title = video.title || q
 const channel = video.author?.name || 'YouTube'
 const duration = video.timestamp || 'N/A'
 const views = video.views?.toLocaleString() || 'N/A'
 const ago = video.ago || 'N/A'
 const thumb = video.thumbnail || video.image
 const infoText = `┏━━━━━━━━━━━━━━━━━━━━━┓\n┃ 𐚁 ${config.botName || config.nombre || config.name || 'Master Clover'}\n┗━━━━━━━━━━━━━━━━━━━━━┛\n\n🎵 *Descargando audio:*\n\n╭───────────────────\n│ 🎤 *Título:* ${title}\n│ 👤 *Canal:* ${channel}\n│ ⏱️ *Duración:* ${duration}\n│ 👀 *Vistas:* ${views}\n│ 📅 *Subido:* ${ago}\n│ 🔗 *Link:* ${videoUrl}\n╰───────────────────\n\n⏳ *Espere un momento, descargando audio...*`
 const canalId = config.canalId || config.channelId || config.newsletterJid || ''
 const canalNombre = config.canalNombre || config.channelName || config.newsletterName || config.canal || ''

 // ============ PREWEB DE YOUTUBE 🍃 ============
 let linkPreview = null

 if(thumb){
  try{
   if(sock.waUploadToServer){
    const { imageMessage } = await prepareWAMessageMedia(
     { image: { url: thumb } },
     {
      upload: sock.waUploadToServer,
      mediaTypeOverride: 'thumbnail-link'
     }
    )

    linkPreview = {
     'canonical-url': videoUrl,
     'matched-text': videoUrl,
     title: `🍃 Descargando: ${title}`,
     description: `${channel} • ${duration} • ${views} vistas`,
     jpegThumbnail: imageMessage?.jpegThumbnail
      ? Buffer.from(imageMessage.jpegThumbnail)
      : undefined,
     highQualityThumbnail: imageMessage || undefined
    }
   }
  }catch(e){
   console.log('[PLAY PREWEB]', e.message)
  }
 }

 const contextInfo = {
  isForwarded: true,
  forwardedNewsletterMessageInfo: {
   newsletterJid: canalId,
   serverMessageId: '0',
   newsletterName: canalNombre
  }
 }

 // Enviar como preweb, no como imagen independiente
 await sock.sendMessage(from, {
  text: infoText,
  linkPreview: linkPreview || undefined,
  contextInfo
 }, { quoted: m })

 const audio = await getAudioFromApi(videoUrl, q, sock, from, m)
 const safeTitle = title.replace(/[\\/:*?"<>|]/g, '').slice(0, 100)

 await sock.sendMessage(from, {
  audio: audio.buffer,
  mimetype: audio.mimetype,
  fileName: `${safeTitle}.${audio.ext}`,
  contextInfo
 }, { quoted: m })

 }catch(e){
 console.log('[PLAY]', e)
 await sock.sendMessage(from, { text: `❌ Error: ${e.message}` }, { quoted: m })
 }
}
export default handler