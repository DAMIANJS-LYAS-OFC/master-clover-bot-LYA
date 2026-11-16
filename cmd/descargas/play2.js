import yts from 'yt-search'
import config from '../../config.js'
import { prepareWAMessageMedia } from 'baileys'

export const handler = {}
handler.name = 'play2'
handler.alias = ['ytmp4','mp4','ytv','video']
handler.category = 'descargas'
handler.description = 'Descarga video de YouTube'

const KEY = 'hk_live_emalahxKe_Y5yamxR2ysovb70Niz_BUBRFrcq0M4YQA'
const YOSOYYO_API = 'https://api-yosoyyo-api-ofc.onrender.com/api/youtube'
const YOSOYYO_KEY = 'yosoyyo_sk_rwbuo0cs'
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36'

function findUrlInJson(obj){
 if(!obj || typeof obj !== 'object') return null
 const keys = ['download', 'url', 'video', 'link', 'dl', 'mp4']
 for(const k of keys){ if(typeof obj[k] === 'string' && obj[k].startsWith('http')) return obj[k] }
 for(const v of Object.values(obj)){ if(v && typeof v === 'object'){ const found = findUrlInJson(v); if(found) return found } }
 return null
}

async function fetchWithRetry(url, options = {}, timeoutMs = 60000, retries = 2){
  let lastErr = null
  for(let i = 0; i <= retries; i++){
    const c = new AbortController()
    const t = setTimeout(() => c.abort(), timeoutMs)
    try{
      const res = await fetch(url, { ...options, signal: c.signal, redirect: 'follow' })
      clearTimeout(t)
      return res
    }catch(e){
      clearTimeout(t)
      lastErr = e
      if(i < retries) await new Promise(r => setTimeout(r, 3000))
    }
  }
  throw lastErr || new Error('fetch failed')
}

async function downloadVideo(url){
  const attempts = [
    { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36', 'Accept': 'video/*,application/octet-stream,*/*', 'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8', 'Referer': 'https://www.youtube.com/', 'Origin': 'https://www.youtube.com' },
    { 'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 Chrome/131.0.0.0 Mobile Safari/537.36', 'Accept': '*/*', 'Referer': 'https://m.youtube.com/' },
    { 'User-Agent': 'Mozilla/5.0', 'Accept': '*/*' }
  ]
  let lastError = null
  for(const headers of attempts){
    try{
      try{ headers['Referer'] = new URL(url).origin + '/' }catch{}
      const res = await fetchWithRetry(url, { headers }, 120000, 1)
      if(res.status === 403){ lastError = new Error('Error descargando video: HTTP 403'); continue }
      if(!res.ok) throw new Error(`Error descargando video: HTTP ${res.status}`)
      const buf = Buffer.from(await res.arrayBuffer())
      if(buf.length < 1000) throw new Error('Archivo de video vacío')
      return buf
    }catch(e){ lastError = e }
  }
  throw lastError || new Error('Error descargando video')
}

async function getVideoFromYosoyyo(query, videoUrl){
  const tries = [query, videoUrl]
  let lastErr = null
  for(const q of tries){
    try{
      const apiUrl = `${YOSOYYO_API}?q=${encodeURIComponent(q)}&apiKey=${YOSOYYO_KEY}`
      console.log('[PLAY2] Yosoyyo:', apiUrl)
      const res = await fetchWithRetry(apiUrl, { headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/json' } }, 60000, 2)
      const ct = (res.headers.get('content-type')||'').toLowerCase()
      if(ct.includes('video') || ct.includes('octet-stream')) return Buffer.from(await res.arrayBuffer())
      const text = await res.text()
      let data
      try{ data = JSON.parse(text) }catch{ throw new Error('Yosoyyo respuesta inválida') }
      console.log('[PLAY2] Yosoyyo respuesta:', JSON.stringify(data).slice(0, 600))
      const dlUrl = findUrlInJson(data)
      if(!dlUrl) throw new Error('Yosoyyo no devolvió link de video')
      return await downloadVideo(dlUrl)
    }catch(e){ lastErr = e; console.log('[PLAY2] Yosoyyo intento falló:', e.message) }
  }
  throw lastErr
}

async function getVideoFromHikari(videoUrl){
  const apiUrl = `https://hikariapi.skyultraweb.com/api/scrapers/youtube/video?url=${encodeURIComponent(videoUrl)}&quality=360p&apikey=${KEY}`
  console.log('[PLAY2] Hikari:', apiUrl)
  const res = await fetchWithRetry(apiUrl, { headers: { 'User-Agent': USER_AGENT } }, 60000, 1)
  const json = await res.json()
  console.log('[PLAY2] Hikari respuesta:', JSON.stringify(json).slice(0, 400))
  if(!json.success) throw new Error('Hikari fallo: ' + JSON.stringify(json).slice(0, 200))
  const dl = json.data?.downloadUrl || json.data?.url
  if(!dl) throw new Error('Hikari no devolvió downloadUrl')
  return await downloadVideo(dl)
}

handler.exec = async (sock, m) => {
 const from = m.key.remoteJid
 const body = m.message?.conversation || m.message?.extendedTextMessage?.text || ''
 const q = body.trim().split(/ +/).slice(1).join(' ').trim()
 if(!q) return sock.sendMessage(from, { text: 'Usa: .play2 bad bunny dtmf' }, { quoted: m })
 const botName = config.botName || config.name || 'Master Clover'
 try{
 let videoUrl = q
 let video = {}
 if(!q.startsWith('http')){
 const search = await yts(q)
 if(!search.videos.length) throw new Error('Sin resultados')
 video = search.videos[0]
 videoUrl = video.url
 } else {
 const search = await yts(q)
 video = search.videos[0] || {}
 }
 const title = video.title || q
 const channel = video.author?.name || 'YouTube'
 const duration = video.timestamp || 'N/A'
 const views = video.views?.toLocaleString() || 'N/A'
 const ago = video.ago || 'N/A'
 const thumb = video.thumbnail || video.image
 const infoText = `┏━━━━━━━━━━━━━━━━━━━━━┓
┃ 𐚁 ${botName}
┗━━━━━━━━━━━━━━━━━━━━━┛

🎵 *Descargando video:*

╭───────────────────
│ 🎤 *Título:* ${title}
│ 👤 *Canal:* ${channel}
│ ⏱️ *Duración:* ${duration}
│ 👀 *Vistas:* ${views}
│ 📅 *Subido:* ${ago}
│ 🔗 *Link:* ${videoUrl}
╰───────────────────

⏳ *Espere un momento, descargando video...*`
 const canalId = config.canalId || config.channelId || config.newsletterJid || ''
 const canalNombre = config.canalNombre || config.channelName || config.newsletterName || config.canal || ''
 let linkPreview = null
 if(thumb){
 try{
 const { imageMessage } = await prepareWAMessageMedia(
 { image: { url: thumb } },
 { upload: sock.waUploadToServer || sock.updateMediaMessage, mediaTypeOverride: 'thumbnail-link' }
 )
 linkPreview = {
 'canonical-url': videoUrl,
 'matched-text': videoUrl,
 title: `🍃 Descargando: ${title}`,
 description: `${channel} • ${duration} • ${views} vistas`,
 jpegThumbnail: imageMessage?.jpegThumbnail ? Buffer.from(imageMessage.jpegThumbnail) : undefined,
 highQualityThumbnail: imageMessage || undefined
 }
 }catch(e){ console.log('[PLAY2 PREVWEB]', e.message) }
 }
 const contextInfo = { isForwarded: true, forwardedNewsletterMessageInfo: { newsletterJid: canalId, serverMessageId: '0', newsletterName: canalNombre } }
 // SOLO TEXTO para que salga la preweb
 await sock.sendMessage(from, { text: infoText, linkPreview: linkPreview || undefined, contextInfo }, { quoted: m })

 let buffer
 try{
   buffer = await getVideoFromYosoyyo(q, videoUrl)
   console.log('[PLAY2] Salió por Yosoyyo')
 }catch(e){
   console.log('[PLAY2] Yosoyyo falló, usando Hikari:', e.message)
   buffer = await getVideoFromHikari(videoUrl)
   console.log('[PLAY2] Salió por Hikari')
 }
 await sock.sendMessage(from, { video: buffer, mimetype: 'video/mp4', fileName: `${title.replace(/[\\/:*?"<>|]/g, '').slice(0, 100)}.mp4`, caption: title, contextInfo }, { quoted: m })
 }catch(e){
 console.log('[PLAY2] ERROR FINAL:', e)
 await sock.sendMessage(from, { text: `❌ Play2 error: ${e.message}` }, { quoted: m })
 }
}
export default handler