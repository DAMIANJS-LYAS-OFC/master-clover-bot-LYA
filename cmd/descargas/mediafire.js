import config from '../../config.js'
import { prepareWAMessageMedia } from 'baileys'

export const handler = {}
handler.name = 'mediafire'
handler.alias = ['mf', 'df', 'mediafiredl']
handler.category = 'descargas'
handler.description = 'Descarga archivo de Mediafire'

const MEDIAFIRE_API = 'https://api-yosoyyo-api-ofc.onrender.com/api/mediafire'
const YOSOYYO_KEY = 'yosoyyo_sk_rwbuo0cs'
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36'
const MEDIAFIRE_ICON = 'https://www.mediafire.com/images/mediafire_logo.png'

// Busca TODOS los links en el JSON, no solo por nombre de campo
function findDownloadLink(data, originalUrl){
  const text = JSON.stringify(data)
  console.log('[MEDIAFIRE] JSON completo:', text.slice(0, 2000))
  // Saca todos los http
  const all = [...text.matchAll(/https?:\/\/[^\s"'\\]+/g)].map(m => m[0].replace(/\\u002F/g, '/'))
  console.log('[MEDIAFIRE] Links encontrados:', all)
  if(!all.length) return null

  // 1. Prioridad: links de descarga directa de mediafire
  const direct = all.find(u => u.includes('download') && u.includes('mediafire'))
  if(direct) return direct
  // 2. Links que NO sean tu API ni el link original que mandaste
  const filtered = all.filter(u => !u.includes('api-yosoyyo') && u !== originalUrl && !u.includes('mediafire.com/file/'))
  if(filtered.length) return filtered[0]
  // 3. Cualquier link que no sea la API
  const any = all.find(u => !u.includes('api-yosoyyo'))
  return any || null
}

function pick(obj, ...keys){
 for(const k of keys){
   if(obj?.[k] != null && obj[k] !== '') return obj[k]
   if(obj?.data?.[k] != null && obj.data[k] !== '') return obj.data[k]
   if(obj?.result?.[k] != null && obj.result[k] !== '') return obj.result[k]
   // Busca en cualquier nivel
   if(obj?.data && typeof obj.data === 'object'){
     for(const v of Object.values(obj.data)){
       if(v && typeof v === 'object' && v[k]) return v[k]
     }
   }
 }
 return null
}

// Respaldo: raspar mediafire directo si la API falla
async function scrapeMediafire(url){
  console.log('[MEDIAFIRE] Raspando directo:', url)
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, 'Accept': 'text/html' } })
  const html = await res.text()
  // Botón de descarga de mediafire
  const m1 = html.match(/href="(https:\/\/download[^"]+)"/)
  if(m1) return m1[1]
  const m2 = html.match(/data-href="(https:\/\/[^"]+)"/)
  if(m2) return m2[1]
  // Nombre y tamaño del HTML por si la API no los dio
  const nameM = html.match(/<div class="filename[^>]*>([^<]+)</) || html.match(/<title>([^-]+)- MediaFire/)
  const sizeM = html.match(/File size[^<]*<[^>]*>([^<]+)</)
  return null
}

handler.exec = async (sock, m) => {
 const from = m.key.remoteJid
 const body = m.message?.conversation || m.message?.extendedTextMessage?.text || ''
 const q = body.trim().split(/ +/).slice(1).join(' ').trim()
 if(!q) return sock.sendMessage(from, { text: 'Usa: .mediafire https://www.mediafire.com/file/xxx/archivo.zip' }, { quoted: m })
 if(!q.includes('mediafire.com')) return sock.sendMessage(from, { text: '❌ Manda un link válido de Mediafire' }, { quoted: m })

 const botName = config.botName || config.nombre || config.name || 'Master Clover'
 try{
   let dlUrl = null
   let data = null
   // 1. Intentar con tu API
   try{
     const apiUrl = `${MEDIAFIRE_API}?url=${encodeURIComponent(q)}&apiKey=${YOSOYYO_KEY}`
     console.log('[MEDIAFIRE] API:', apiUrl)
     const res = await fetch(apiUrl, { headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/json' } })
     const text = await res.text()
     console.log('[MEDIAFIRE] Respuesta cruda:', text.slice(0, 2000))
     try{ data = JSON.parse(text) }catch{ data = { raw: text } }
     dlUrl = findDownloadLink(data, q)
     console.log('[MEDIAFIRE] Link por API:', dlUrl)
   }catch(e){ console.log('[MEDIAFIRE] API falló:', e.message) }

   // 2. Si la API no dio link, raspar directo
   if(!dlUrl){
     console.log('[MEDIAFIRE] API no dio link, usando scrape...')
     dlUrl = await scrapeMediafire(q)
     console.log('[MEDIAFIRE] Link por scrape:', dlUrl)
   }
   if(!dlUrl) throw new Error('La API no devolvió link de descarga. Revisa consola [MEDIAFIRE] Respuesta cruda:')

   const nombre = pick(data, 'filename', 'fileName', 'name', 'title', 'file') || q.split('/').pop() || 'Archivo Mediafire'
   const tipo = pick(data, 'type', 'mimetype', 'mime', 'extension', 'ext') || ''
   const tamano = pick(data, 'size', 'filesize', 'sizeFormatted', 'fileSize') || 'N/A'
   const publicado = pick(data, 'date', 'uploaded', 'created', 'published', 'uploadDate') || 'N/A'

   let tipoBonito = tipo
   if(nombre.includes('.')) tipoBonito = `${tipo ? tipo + ' ' : 'Archivo '} (.${nombre.split('.').pop().toUpperCase()})`
   if(!tipoBonito) tipoBonito = 'Archivo'

   const infoText = `ㅤ    ─̷̸─꯭━─̷̸─꯭━────────꯭━─̷̸─꯭━─̷̸

ㅤㅤㅤ⠟ ׂ ⭐⃞፝֟͝ꭷ ׂ  𝙈𝙀𝘿𝙄𝘼𝙁𝙄𝙍𝙀
              𝘿𝙊𝙒𝙉𝙇𝙊𝘼𝘿

▒⃞⃝֟🍄᪶̫᪲̇ Nombre › ${nombre}
▒⃞⃝֟🪴᪶̫᪲̇ Tipo › ${tipoBonito}
▒⃞⃝֟🌴 Tamaño › ${tamano}
▒⃞⃝֟🌱᪶̫᪲̇ Publicado › ${publicado}
▒⃞⃝֟🌾᪶̫᪲̇ Enlace › ${q}

> ↻ Descargando archivo`

   const canalId = config.canalId || config.channelId || config.newsletterJid || ''
   const canalNombre = config.canalNombre || config.channelName || config.newsletterName || config.canal || ''

   let linkPreview = null
   try{
     const { imageMessage } = await prepareWAMessageMedia(
       { image: { url: MEDIAFIRE_ICON } },
       { upload: sock.waUploadToServer || sock.updateMediaMessage, mediaTypeOverride: 'thumbnail-link' }
     )
     linkPreview = {
       'canonical-url': q,
       'matched-text': q,
       title: `🍃 Descargando: ${nombre}`,
       description: `Mediafire • ${tamano} • ${tipoBonito}`,
       jpegThumbnail: imageMessage?.jpegThumbnail ? Buffer.from(imageMessage.jpegThumbnail) : undefined,
       highQualityThumbnail: imageMessage || undefined
     }
   }catch(e){ console.log('[MEDIAFIRE PREVWEB]', e.message) }

   const contextInfo = {
     isForwarded: true,
     forwardedNewsletterMessageInfo: { newsletterJid: canalId, serverMessageId: '0', newsletterName: canalNombre }
   }

   await sock.sendMessage(from, { text: infoText, linkPreview: linkPreview || undefined, contextInfo }, { quoted: m })

   const fileRes = await fetch(dlUrl, {
     headers: { 'User-Agent': USER_AGENT, 'Accept': '*/*', 'Referer': 'https://www.mediafire.com/', 'Origin': 'https://www.mediafire.com' },
     redirect: 'follow'
   })
   if(!fileRes.ok) throw new Error(`Error descargando archivo: HTTP ${fileRes.status}`)
   const buffer = Buffer.from(await fileRes.arrayBuffer())
   if(buffer.length < 1000) throw new Error('Archivo vacío')
   const mimetype = fileRes.headers.get('content-type') || 'application/octet-stream'
   console.log(`[MEDIAFIRE] Archivo descargado: ${(buffer.length/1024/1024).toFixed(2)} MB`)

   await sock.sendMessage(from, {
     document: buffer,
     mimetype,
     fileName: nombre,
     caption: `✅ *${nombre}*\n> Descargado por ${botName}`,
     contextInfo
   }, { quoted: m })

 }catch(e){
   console.log('[MEDIAFIRE]', e)
   await sock.sendMessage(from, { text: `❌ Mediafire error: ${e.message}` }, { quoted: m })
 }
}
export default handler