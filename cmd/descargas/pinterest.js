import fs from 'fs'
import path from 'path'
import sharp from 'sharp'

export const handler = {}
handler.name = 'pinterest'
handler.alias = ['pin', 'pinteres']
handler.category = 'buscador'

const KEY = 'russellxz'
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36'

const APIS_SEARCH = [
 'https://api.neoxr.eu/api/pinterest',
 'https://api.neoxr.eu/api/pin',
 'https://api.neoxr.eu/api/pinterest-search'
]

const APIS_PIN = [
 'https://api.neoxr.eu/api/pin',
 'https://api.neoxr.eu/api/pinterest'
]

const RETRIES = 3
const VUELTAS = 2
const DELAY = 1200

// ─── Truco del documento ───

function cleanId(v) {
 return String(v || '').split('@')[0].split(':')[0].replace(/\D/g, '')
}

function getBotNum(s) {
 return cleanId(s?.principalNumber || s?.subNumber || s?.user?.id?.split(':')[0] || '')
}

function getBotName(s, n) {
 if (s.principalConfig?.name) return s.principalConfig.name
 if (s.subConfig?.name) return s.subConfig.name

 for (let p of [
 path.join(process.cwd(), 'principals', n, 'config.json'),
 path.join(process.cwd(), 'subbots', n, 'config.json'),
 path.join(process.cwd(), 'jadiBots', n, 'config.json')
 ]) {
 if (fs.existsSync(p)) {
 try {
 let j = JSON.parse(fs.readFileSync(p, 'utf8'))
 if (j.name) return j.name
 } catch {}
 }
 }

 return 'Master Clover'
}

async function sendIconDoc(sock, jid, m, txt, mentions = []) {
 try {
 let num = getBotNum(sock)
 let botName = getBotName(sock, num)
 let dir = path.join(process.cwd(), 'db', 'icon')

 const pos = [
 sock.subConfig?.icon,
 sock.principalConfig?.icon,
 path.join(dir, num + '.jpg'),
 path.join(dir, num + '.png'),
 path.join(dir, num + '.webp'),
 path.join(dir, 'main.jpg')
 ]

 let icon = null

 for (const p of pos) {
 if (!p || String(p).startsWith('http')) continue
 const f = path.isAbsolute(p) ? p : path.join(process.cwd(), p)
 if (fs.existsSync(f)) { icon = f; break }
 }

 if (!icon && fs.existsSync(dir)) {
 const f = fs.readdirSync(dir).filter(x => /\.(jpg|jpeg|png|webp)$/i.test(x))
 if (f.length) icon = path.join(dir, f[0])
 }

 if (!icon) return sock.sendMessage(jid, { text: txt, mentions }, { quoted: m })

 const orig = fs.readFileSync(icon)

 const prev = await sharp(orig)
 .rotate()
 .resize(160, 160, { fit: 'inside', withoutEnlargement: true })
 .jpeg({ quality: 65 })
 .toBuffer({ resolveWithObject: true })

 const meta = await sharp(orig).metadata()

 const fmt = {
 jpeg: ['jpg', 'image/jpeg'],
 png: ['png', 'image/png'],
 webp: ['webp', 'image/webp'],
 gif: ['gif', 'image/gif'],
 avif: ['avif', 'image/avif'],
 tiff: ['tiff', 'image/tiff']
 }

 let name = String(botName).replace(/[\\/:*?"<>|\r\n]/g, '').trim() || 'Bot'
 const ext = fmt[meta.format] || [path.extname(icon).slice(1).toLowerCase() || 'jpg', 'image/jpeg']

 return sock.sendMessage(jid, {
 document: orig,
 fileName: name + '.' + ext[0],
 mimetype: ext[1],
 jpegThumbnail: prev.data.toString('base64'),
 thumbnailWidth: prev.info.width,
 thumbnailHeight: prev.info.height,
 caption: txt,
 mentions
 }, { quoted: m })

 } catch {
 return sock.sendMessage(jid, { text: txt, mentions }, { quoted: m })
 }
}

// ─── Reintentos igual que el play ───

const sleep = ms => new Promise(r => setTimeout(r, ms))

async function retry(fn) {
 let last = null

 for (let i = 1; i <= RETRIES; i++) {
 try {
 return await fn()
 } catch (e) {
 last = e
 if (i < RETRIES) await sleep(DELAY)
 }
 }

 throw last
}

async function fetchPinApi(base, q, isLink) {
 const url = isLink
 ? `${base}?url=${encodeURIComponent(q)}&apikey=${KEY}`
 : `${base}?q=${encodeURIComponent(q)}&apikey=${KEY}`

 const c = new AbortController()
 const t = setTimeout(() => c.abort(), 30000)

 try {
 const r = await fetch(url, {
 signal: c.signal,
 headers: { 'User-Agent': UA, 'Accept': 'application/json' }
 })

 if (!r.ok) throw new Error(`HTTP ${r.status}`)

 const json = await r.json()

 if (json.status === false || json.success === false) {
 throw new Error(json?.message || 'Sin resultados')
 }

 const data = json.data || json.result

 const raw = Array.isArray(data)
 ? data
 : Array.isArray(data?.media)
 ? data.media
 : data
 ? [data]
 : []

 const list = raw
 .map(v => typeof v === 'string' ? { image: v } : v)
 .filter(v => v)

 if (!list.length) throw new Error('Sin resultados')

 return list

 } finally {
 clearTimeout(t)
 }
}

async function buscarPinterest(q, isLink, sock, from, m) {
 const apis = isLink ? APIS_PIN : APIS_SEARCH
 let last = null

 for (let v = 1; v <= VUELTAS; v++) {
 for (const base of apis) {
 try {
 return await retry(() => fetchPinApi(base, q, isLink))
 } catch (e) {
 last = e
 continue
 }
 }

 if (v < VUELTAS) {
 await sock.sendMessage(from, {
 text: `🔄 *Vuelta ${v} falló, intentando de nuevo...*`
 }, { quoted: m })
 }
 }

 throw new Error(`Todas las APIs fallaron. Último: ${last?.message}`)
}

// ─── Intentar sacar datos reales del pin ───

function getVal(v, ...keys) {
 for (const k of keys) {
 if (v?.[k] != null && v[k] !== '') return v[k]
 }
 return null
}

function fmtNum(n) {
 if (n == null || n === '' || isNaN(Number(n))) return 'N/A'
 return Number(n).toLocaleString('es-MX')
}

function fmtDate(v) {
 if (!v) return 'N/A'
 const d = new Date(v)
 if (isNaN(d)) return String(v)
 return d.toLocaleDateString('es-MX', {
 day: '2-digit',
 month: 'short',
 year: 'numeric'
 })
}

// Si la búsqueda trae link del pin, lo consulta para sacar autor / likes / fecha
async function enriquecer(v) {
 const pinUrl = getVal(v, 'pin', 'pinUrl', 'pin_url', 'link', 'source', 'postUrl')

 // Si no hay link del pin, no se puede sacar más datos
 if (!pinUrl || !pinUrl.includes('pinterest')) return v

 try {
 const list = await fetchPinApi(APIS_PIN[0], pinUrl, true)
 const extra = list[0] || {}
 return { ...extra, ...v, image: v.image || extra.image || extra.url }
 } catch {
 return v
 }
}

// ─── Comando ───

handler.exec = async (sock, m) => {
 const from = m.key.remoteJid
 const body = m.message?.conversation || m.message?.extendedTextMessage?.text || ''
 const prefix = body.trim().charAt(0) || '.'
 const q = body.trim().split(/ +/).slice(1).join(' ').trim()

 if (!q) {
 return sendIconDoc(sock, from, m,
 `> 𐙚₊˚⊹ Por favor menciona algo para buscar\n> ejemplo: ${prefix}pinterest gatos`
 )
 }

 try {
 await sendIconDoc(sock, from, m, `₍ᐢ..ᐢ₎ 𓆩 Buscando contenido espere 𓆪`)

 const isLink = /^https?:\/\/(?:[a-z0-9-]+\.)*(?:pinterest\.[a-z.]+|pin\.it)\//i.test(q)

 let list = (await buscarPinterest(q, isLink, sock, from, m)).slice(0, 5)

 // Solo enriquecer si es búsqueda, no si es link directo
 if (!isLink) {
 const conDatos = []
 for (const v of list) {
 conDatos.push(await enriquecer(v))
 }
 list = conDatos
 }

 const medias = []

 for (const v of list) {
 const imgUrl = v.imageProxy || v.image || v.url || v.download || v.video
 const mediaUrl = typeof imgUrl === 'string' ? imgUrl : imgUrl?.url
 if (!mediaUrl) continue

 const isVideo = v.type === 'video' || /\.mp4(?:\?|$)/i.test(mediaUrl)

 medias.push({
 url: mediaUrl,
 isVideo,
 title: getVal(v, 'title', 'alt', 'description', 'caption') || q,
 author: getVal(v?.author, 'name', 'username')
 || getVal(v, 'author', 'username', 'user', 'owner', 'creator')
 || 'N/A',
 likes: getVal(v, 'like', 'likes', 'likeCount', 'likesCount', 'reaction')
 || getVal(v?.stats, 'likes')
 || 'N/A',
 date: getVal(v, 'created_at', 'createdAt', 'date', 'published', 'publishDate', 'timestamp')
 || 'N/A'
 })
 }

 if (!medias.length) throw new Error('Sin archivos para enviar')

 // ─── Caption ÚNICO para todo el álbum ───
 // En álbum no se puede poner caption por foto, por eso va 1 solo con la lista

 let caption = `*ֺ𖹭 ׁ🍓 〫࣫⊹ׁ┄ PINTEREST BÚSQUEDA*\n`
 caption += `─ׁ─ׁ─ׁ┉ׅ─ׁ─ׁ─ׁ┉ׅ─˳ּ𖹭─ׁ─ׁ┉ׅ─ׁ─ׁ─ׁ┉ׅ─ׁ─ׁ─ׁ─\n`
 caption += `> ꒰ᐢ..ᐢ꒱ 🍪 Búsqueda: *${q}*\n\n`

 medias.forEach((item, i) => {
 caption += `*${i + 1}. ${String(item.title).slice(0, 50)}*\n`
 caption += `> ꒰ᐢ..ᐢ꒱ 🍫 Autor: *${item.author}*\n`
 caption += `> ꒰ᐢ..ᐢ꒱ 🍬 Me gusta: *${fmtNum(item.likes)}*\n`
 caption += `> ꒰ᐢ..ᐢ꒱ 🧃 Publicado: *${fmtDate(item.date)}*\n\n`
 })

 caption += `─ׁ─ׁ─ׁ┉ׅ─ׁ─ׁ─ׁ┉ׅ─˳ּ𖹭─ׁ─ׁ┉ׅ─ׁ─ׁ─ׁ┉ׅ─ׁ─ׁ─ׁ─ִ\n`
 caption += `ε(´｡•·•｡\`)っ ⏤͟͟͞͞by locos y asociados\n`
 caption += `*⚔️ Resultado: ${medias.length}/${medias.length}*`

 // Si solo es 1, lo manda normal
 if (medias.length === 1) {
 const solo = medias[0]
 if (solo.isVideo) {
 await sock.sendMessage(from, { video: { url: solo.url }, caption }, { quoted: m })
 } else {
 await sock.sendMessage(from, { image: { url: solo.url }, caption }, { quoted: m })
 }
 return
 }

 // Si son varias, en álbum todo junto
 const album = await sock.sendMessage(from, {
 album: {
 expectedImageCount: medias.filter(x => !x.isVideo).length,
 expectedVideoCount: medias.filter(x => x.isVideo).length
 }
 }, { quoted: m })

 if (!album?.key) throw new Error('No se pudo crear el álbum')

 for (let i = 0; i < medias.length; i++) {
 const item = medias[i]
 const esPrimera = i === 0

 if (item.isVideo) {
 await sock.sendMessage(from, {
 video: { url: item.url },
 caption: esPrimera ? caption : undefined,
 albumParentKey: album.key
 })
 } else {
 await sock.sendMessage(from, {
 image: { url: item.url },
 caption: esPrimera ? caption : undefined,
 albumParentKey: album.key
 })
 }
 }

 } catch (e) {
 await sendIconDoc(sock, from, m,
 `> 𐙚₊˚⊹ Error: ${e.message}\n> ejemplo: ${prefix}pinterest gatos`
 )
 }
}

export default handler
