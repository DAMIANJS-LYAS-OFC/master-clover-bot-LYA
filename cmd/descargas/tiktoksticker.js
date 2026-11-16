import axios from 'axios'
import config from '../../config.js'

export const handler = {}
handler.name = 'tiktokstiker'
handler.alias = ['ttstiker', 'ttsticker', 'ttpack', 'tiktokpack']
handler.category = 'sticker'
handler.owner = false
handler.cooldown = 30

// ── LÍMITE FIJO 15, SI FUNCIONA NO LO TOQUES 🌾 ──
const API_COMMENT = 'https://www.tiktok.com/api/comment/list/'
const API_REPLY = 'https://www.tiktok.com/api/comment/list/reply/'
const COUNT = 50
const DEFAULT_PACK = 15
const HARD_MAX_PACK = 15  // <─ AQUÍ ESTÁ EL LÍMITE, NO LO SUBAS
const MAX_ROOT_PAGES = 8
const MAX_REPLY_THREADS = 12
const SCAN_BUDGET_MS = 15000
const REQUEST_DELAY = 80
const LIMIT_STATIC = 900_000
const LIMIT_ANIM = 500_000
const HARD_BYTES = 1_000_000
const BACKOFF = [0, 300, 800, 1500]
const UA_POOL = ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36']
const activeChats = new Set()
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const pickUa = () => UA_POOL[0]
function mkHeaders(ua, referer) { return { 'User-Agent': ua, 'Accept': 'application/json', 'Referer': referer || 'https://www.tiktok.com/' } }
let _sharp
async function getSharp() { if (_sharp !== undefined) return _sharp; try { const mod = await import('sharp'); _sharp = mod.default || mod } catch { _sharp = null } return _sharp }
async function httpJson(url, params, referer, attempts = 2) {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await axios.get(url, { params, headers: mkHeaders(pickUa(), referer), timeout: 12000, validateStatus: () => true })
      if (res.status === 200 && res.data && typeof res.data === 'object' && ('comments' in res.data || 'has_more' in res.data)) return res.data
    } catch {}
    await sleep(BACKOFF[Math.min(i + 1, BACKOFF.length - 1)])
  }
  return null
}
async function downloadAsset(url, attempts = 2) {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await axios.get(url, { headers: mkHeaders(pickUa(), 'https://www.tiktok.com/'), timeout: 15000, responseType: 'arraybuffer', validateStatus: () => true })
      if (res.status === 200 && res.data?.length > 0) return Buffer.from(res.data)
    } catch {}
  }
  return null
}
function extractVideoId(text) {
  if (!text) return null
  const patterns = [/(?:video|photo|v)\/(\d{6,})/, /item_id=(\d{6,})/, /aweme_id=(\d{6,})/, /\/(\d{15,})/]
  for (const p of patterns) { const m = String(text).match(p); if (m) return m[1] }
  return null
}
async function resolveTikTokUrl(input) {
  let u = new URL(/^https?:\/\//i.test(input) ? input : 'https://' + input)
  let videoId = extractVideoId(u.pathname) || extractVideoId(u.search)
  let author = (u.pathname.match(/\/@([^/]+)/) || [])[1] || null
  if (!videoId || !/\/(video|photo)\//.test(u.pathname)) {
    try {
      const res = await axios.get(u.toString(), { headers: mkHeaders(pickUa(), 'https://www.tiktok.com/'), timeout: 15000, maxRedirects: 8, validateStatus: () => true, responseType: 'text' })
      const finalUrl = res.request?.res?.responseUrl || ''
      videoId = videoId || extractVideoId(finalUrl)
      author = author || (finalUrl.match(/\/@([^/?]+)/) || [])[1] || null
    } catch {}
  }
  if (!videoId) throw new Error('no videoId')
  return { videoId, author, canonical: `https://www.tiktok.com/@${author || 'user'}/video/${videoId}` }
}
function eachResolution(bucket) {
  const out = []
  if (!bucket || typeof bucket !== 'object') return out
  for (const k of ['high_resolution_url', 'mid_resolution_url', 'low_resolution_url']) {
    const node = bucket[k]
    if (node && typeof node === 'object' && Array.isArray(node.url_list) && typeof node.url_list[0] === 'string') out.push({ url: node.url_list[0] })
  }
  return out
}
function collectAssets(node, out, depth, originKey) {
  if (!node || typeof node !== 'object' || depth > 4) return
  if (Array.isArray(node)) { for (const v of node) collectAssets(v, out, depth + 1, originKey); return }
  for (const k of Object.keys(node)) {
    if (node[k] == null) continue
    let hitKey = originKey
    if (k === 'animated_url' || k === 'animation_url') hitKey = 'animated'
    else if (['static_url', 'image_url', 'webp_url', 'high_resolution_url'].includes(k)) hitKey = originKey === 'animated' ? 'animated' : 'static'
    if (Array.isArray(node[k])) { const urls = node[k].filter(u => typeof u === 'string' && /^https?:\/\//i.test(u)); if (urls.length) { out.push({ url: urls[0], via: hitKey || k }); continue } }
    else if (typeof node[k] === 'string' && /^https?:\/\//i.test(node[k])) { out.push({ url: node[k], via: hitKey || k }); continue }
    else if (typeof node[k] === 'object') { const rs = eachResolution(node[k]); if (rs.length) { for (const r of rs) out.push({ url: r.url, via: hitKey || k }); continue } }
    collectAssets(node[k], out, depth + 1, hitKey)
  }
}
function extractStickerFromComment(c) {
  const holder = c.cmt_sticker_struct || c.composer_sticker || c.cmt_emote_struct || c.sticker || c.composer_emote || c.emote || c.gif_sticker || null
  if (!holder || typeof holder !== 'object') return null
  const assets = []
  collectAssets(holder, assets, 0, null)
  if (!assets.length) return null
  const animated = assets.filter(a => a.via === 'animated' || /\.awebp|\.lottie/i.test(a.url))
  const statics = assets.filter(a => a.via !== 'animated' && !/\.awebp/i.test(a.url))
  const best = (animated.length ? animated : statics)[0]
  if (!best?.url) return null
  const id = String(holder.id ?? holder.sticker_id ?? holder.emote_id ?? '') || null
  return { id, url: best.url, animatedHint: animated.length > 0 }
}
async function scrapeCommentStickers(inputUrl, { cap, scanReplies }) {
  const t0 = Date.now()
  const timeUp = () => Date.now() - t0 > SCAN_BUDGET_MS
  const resolved = await resolveTikTokUrl(inputUrl)
  const referer = resolved.canonical
  const found = new Map(), seen = new Set(), threads = []
  let scanned = 0, verification = false
  const inspect = (c, parentCid) => {
    if (!c || c.cid == null) return
    const cid = String(c.cid); if (seen.has(cid)) return; seen.add(cid); scanned++
    if (parentCid == null && Number(c.reply_comment_total) > 0) threads.push(cid)
    const st = extractStickerFromComment(c); if (!st) return
    const key = st.id || st.url; if (!found.has(key)) found.set(key, { url: st.url, animatedHint: st.animatedHint })
  }
  let cursor = 0, hasMore = true, pages = 0
  while (hasMore && pages < MAX_ROOT_PAGES && found.size < cap && !timeUp()) {
    const page = await httpJson(API_COMMENT, { aid: 1988, aweme_id: resolved.videoId, count: COUNT, cursor }, referer)
    if (!page) break
    if (page.status_code === 10204) { verification = true; break }
    for (const c of (page.comments || [])) inspect(c, null)
    pages++
    const nc = Number(page.cursor); cursor = Number.isFinite(nc) && nc > cursor ? nc : cursor + COUNT
    hasMore = page.has_more === 1 || page.has_more === true
    if (!(page.comments || []).length) break
    await sleep(REQUEST_DELAY)
  }
  if (scanReplies && !verification) {
    for (let i = 0; i < Math.min(threads.length, MAX_REPLY_THREADS); i++) {
      if (found.size >= cap || timeUp()) break
      let rc = 0, more = true, jail = 0
      while (more && jail < 2 && found.size < cap && !timeUp()) {
        const page = await httpJson(API_REPLY, { aid: 1988, item_id: resolved.videoId, comment_id: threads[i], count: COUNT, cursor: rc }, referer, 2)
        if (!page) { jail++; rc += COUNT; continue }
        for (const c of (page.comments || [])) inspect(c, threads[i])
        const n = Number(page.cursor); rc = Number.isFinite(n) && n > rc ? n : rc + COUNT
        more = page.has_more === 1 || page.has_more === true
        if (!(page.comments || []).length) break
      }
    }
  }
  return { video: { id: resolved.videoId, url: resolved.canonical, author: resolved.author }, stickers: [...found.values()], scanned, verification }
}
function isWebp(b) { return b.length >= 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP' }
function isAnimatedWebp(b) {
  if (!isWebp(b)) return false
  let off = 12
  while (off < b.length - 8) { const tag = b.toString('ascii', off, off + 4); const size = b.readUInt32LE(off + 4); if ((tag === 'VP8X' && (b[off + 8] & 0x02) !== 0) || tag === 'ANIM' || tag === 'ANMF') return true; off += 8 + size + (size % 2) }
  return false
}
function sniff(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 16) return { format: 'unknown', animated: false }
  if (isWebp(buf)) return { format: 'webp', animated: isAnimatedWebp(buf) }
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return { format: 'gif', animated: true }
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return { format: 'png', animated: buf.includes(Buffer.from('acTL')) }
  if (buf[0] === 0xff && buf[1] === 0xd8) return { format: 'jpeg', animated: false }
  return { format: 'unknown', animated: false }
}
async function toStickerWebp(buf) {
  const det = sniff(buf)
  if (det.format === 'unknown') return null
  if (det.format === 'webp' && buf.length <= HARD_BYTES) return { buf, animated: det.animated }
  const sharp = await getSharp()
  if (!sharp) return null
  try {
    const out = await sharp(buf, { animated: det.animated }).resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).webp({ quality: det.animated ? 60 : 75, effort: 2 }).toBuffer()
    if (out.length <= HARD_BYTES) return { buf: out, animated: isAnimatedWebp(out) }
  } catch {}
  return null
}
function parseInput(args) {
  const out = { url: null, limit: DEFAULT_PACK, mode: 'auto' }
  for (const raw of args) {
    const t = String(raw).trim(); if (!t) continue
    if (/^https?:\/\//i.test(t) || /tiktok\.com/i.test(t)) { if (!out.url) out.url = t; continue }
    // ── AQUÍ CAPAMOS: aunque pongan 30, queda en 15 ──
    if (/^\d{1,3}$/.test(t)) { out.limit = Math.max(1, Math.min(HARD_MAX_PACK, Number(t))); continue }
    const low = t.toLowerCase()
    if (['anim', 'animated', 'gif'].includes(low)) out.mode = 'anim'
    else if (['static', 'statis', 'png'].includes(low)) out.mode = 'static'
  }
  return out
}

handler.exec = async (...args) => {
  let sock, m, a
  if (args[0]?.key) { m = args[0]; sock = args[1]?.conn || global.conn; a = args[1]?.args || [] }
  else { sock = args[0]; m = args[1]; a = args[2] || [] }
  let jid = m.key.remoteJid
  const reply = (text) => sock.sendMessage(jid, { text }, { quoted: m })
  const react = (emoji) => sock.sendMessage(jid, { react: { text: emoji, key: m.key } }).catch(() => {})
  const { url, limit, mode } = parseInput(a)
  if (!url) return reply(`📦 *TIKTOK STIKER PACK* 🌾\n\n> .tiktokstiker <link> [max 15] [anim|static]\n> Ej: .tiktokstiker https://vt.tiktok.com/xxxx\n> Máximo 15 stickers por pedido`)
  if (activeChats.has(jid)) return reply('⏳ Ya hay un proceso en este chat, espera tantito.')
  activeChats.add(jid)
  await reply('⏳ *Buscando stickers...* 🌾\n> Max 15, tarda 5-10 seg.')
  await react('⏳')
  try {
    const cap = Math.min(limit * 2, 30)
    const scraped = await scrapeCommentStickers(url, { cap, scanReplies: true })
    if (!scraped.stickers.length) { await react('❌'); return reply(scraped.verification ? '❌ TikTok pidió verificación. Intenta en unos minutos.' : `❌ No hay stickers 😪\n> Escaneé ${scraped.scanned} comentarios.`) }
    const rawList = []
    for (let i = 0; i < scraped.stickers.length; i += 5) {
      const chunk = scraped.stickers.slice(i, i + 5)
      const results = await Promise.all(chunk.map(s => downloadAsset(s.url)))
      for (const r of results) if (r) rawList.push(r)
    }
    const items = []
    for (const raw of rawList) { const conv = await toStickerWebp(raw); if (conv) items.push(conv) }
    if (!items.length) { await react('❌'); return reply('❌ Falló la conversión.') }
    const anim = items.filter(x => x.animated), stat = items.filter(x => !x.animated)
    let chosen = mode === 'anim' ? anim : mode === 'static' ? stat : (anim.length >= stat.length ? anim : stat)
    if (!chosen.length) { await react('❌'); return reply(`❌ No hay stickers ${mode} en este video.`) }
    const final = chosen.slice(0, 15)
    await reply(`📦 *Encontré ${final.length} stickers*\n> Enviando... 🌾`)
    for (const s of final) { try { await sock.sendMessage(jid, { sticker: s.buf }, { quoted: m }); await sleep(350) } catch {} }
    await react('✅')
    await reply(`✅ *Listo!* ${final.length} stickers 🌾`)
  } catch (e) { console.log('[TTSTIKER]', e); await react('❌'); return reply('❌ Error, TikTok pidió verificación o el link no sirve.') }
  finally { activeChats.delete(jid) }
}
export default handler