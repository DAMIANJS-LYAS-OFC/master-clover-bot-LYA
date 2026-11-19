import fs from 'fs'
import path from 'path'
import sharp from 'sharp'

export const handler = {}
handler.name = 'canalreaccion'
handler.alias = ['reactcanal', 'reaccioncanal', 'canalreact']
handler.category = 'owner'

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

// ─── TU MISMA FUNCIÓN DE bots.js ───

function cleanNum(v) {
 if (!v) return null
 const s = String(v).split(':')[0].split('@')[0].replace(/\D/g, '')
 if (s.length < 7) return null
 return s
}

function findCreds(dir, depth = 0) {
 if (depth > 3 || !fs.existsSync(dir)) return null
 try {
 for (const f of fs.readdirSync(dir)) {
 const full = path.join(dir, f)
 try {
 const st = fs.statSync(full)
 if (st.isFile() && f === 'creds.json') return full
 if (st.isDirectory() && !f.startsWith('.')) {
 const r = findCreds(full, depth + 1)
 if (r) return r
 }
 } catch {}
 }
 } catch {}
 return null
}

function getNum(full, cfg) {
 for (const k of ['number', 'num', 'botNumber', 'phone', 'jid', 'id', 'owner']) {
 const n = cleanNum(Array.isArray(cfg?.[k]) ? cfg[k][0] : cfg?.[k])
 if (n) return n
 }
 const credsPath = findCreds(full)
 if (credsPath) {
 try {
 const c = JSON.parse(fs.readFileSync(credsPath, 'utf8'))
 const n = cleanNum(c?.me?.id || c?.me?.jid || c?.id)
 if (n) return n
 } catch {}
 }
 return cleanNum(path.basename(full))
}

function getAllBots() {
 const out = []
 const seen = new Set()
 const scan = (base, tipo) => {
 if (!fs.existsSync(base)) return
 for (const folder of fs.readdirSync(base)) {
 const full = path.join(base, folder)
 try { if (!fs.statSync(full).isDirectory()) continue } catch { continue }
 const cfgPath = path.join(full, 'config.json')
 let cfg = {}
 if (fs.existsSync(cfgPath)) {
 try { cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8')) } catch {}
 }
 const num = getNum(full, cfg)
 if (!num || seen.has(num)) continue
 const credsPath = findCreds(full)
 if (!credsPath) continue
 try {
 const c = JSON.parse(fs.readFileSync(credsPath, 'utf8'))
 if (!c?.me?.id && !c?.id) continue
 } catch { continue }
 seen.add(num)
 out.push({ num, jid: num + '@s.whatsapp.net', name: cfg.name || cfg.botName || 'MASTER CLOVER', tipo })
 }
 }
 scan(path.join(process.cwd(), 'principals'), 'Principal')
 scan(path.join(process.cwd(), 'subbots'), 'Sub-bot')
 scan(path.join(process.cwd(), 'jadiBots'), 'Sub-bot')
 return out
}

// ─── ARREGLO CLAVE: SI NO ENCUENTRA VIVOS, USA AL QUE EJECUTA ───
function getLiveBots(sock, lista) {
 const porNum = new Map()
 const push = (v) => {
 if (!v) return
 if (Array.isArray(v)) { for (let k of v) push(k); return }
 if (typeof v === 'object') {
 if (typeof v.newsletterReact === 'function') {
 const n = cleanNum(v.user?.id)
 if (n) porNum.set(n, v)
 return
 }
 for (let val of Object.values(v)) {
 if (val?.sock) push(val.sock)
 else if (val?.conn) push(val.conn)
 else if (val && typeof val.newsletterReact === 'function') push(val)
 }
 return
 }
 }
 push(global.liveBots); push(globalThis.liveBots)
 push(global.bots); push(global.subbots); push(global.subBots)
 push(globalThis.bots); push(globalThis.subBots); push(globalThis.subbots)
 push(global.conns); push(global.jadiBots); push(global.subbotsList)
 push(global.connections); push(globalThis.connections)
 push(sock.subBots); push(sock.bots); push(sock.conns)

 // SIEMPRE registrar el que ejecuta, aunque no esté en la lista
 const miNum = cleanNum(sock?.user?.id)
 if (miNum) porNum.set(miNum, sock)

 // Si la lista de carpetas está vacía, crear lista solo con el que ejecuta
 let listaUsar = lista && lista.length ? lista : []
 if (!listaUsar.find(b => b.num === miNum) && miNum) {
 listaUsar = [{ num: miNum, jid: miNum + '@s.whatsapp.net', name: 'Yo', tipo: 'Principal' }, ...listaUsar]
 }

 const ordenados = []
 for (let b of listaUsar) {
 const s = porNum.get(b.num)
 if (s) ordenados.push({ ...b, sock: s, vivo: true })
 else ordenados.push({ ...b, sock: null, vivo: false })
 }
 // Si aún así no hay vivos, forzar al que ejecuta como vivo
 if (!ordenados.some(b => b.vivo) && miNum) {
 ordenados.unshift({ num: miNum, jid: miNum + '@s.whatsapp.net', name: 'Yo', tipo: 'Principal', sock, vivo: true })
 }
 return ordenados
}

async function resolverCanal(sock, input) {
 let code = String(input).trim()
 if (code.includes('whatsapp.com/channel/')) code = code.split('/channel/')[1].split('?')[0].split('/')[0]
 code = code.replace('@newsletter', '').trim()
 if (/^120\d+$/.test(code)) return code + '@newsletter'
 try {
 const meta = await sock.newsletterMetadata('invite', code)
 const jid = meta?.id || meta?.jid || meta?.newsletterJid || meta?.thread_metadata?.jid
 if (jid) return String(jid).includes('@') ? String(jid) : String(jid) + '@newsletter'
 } catch {}
 return code + '@newsletter'
}

async function getUltimoMensaje(sock, canalJid) {
 try {
 if (typeof sock.newsletterFetchMessages === 'function') {
 const res = await sock.newsletterFetchMessages(canalJid, 5)
 const msgs = res?.messages || res?.data || res || []
 const arr = Array.isArray(msgs) ? msgs : [msgs]
 for (let i = arr.length - 1; i >= 0; i--) {
 const u = arr[i]
 if (!u) continue
 const serverId = u?.key?.id || u?.serverMessageId || u?.id
 const texto = u?.message?.conversation || u?.message?.extendedTextMessage?.text || u?.message?.imageMessage?.caption || ''
 if (serverId && String(serverId) !== '-1' && String(serverId) !== '0') {
 return { serverId: String(serverId), texto: String(texto).slice(0, 80), fuente: 'fetchMessages' }
 }
 }
 }
 } catch {}
 try {
 const meta = await sock.newsletterMetadata('jid', canalJid)
 const preview = meta?.thread_metadata?.preview
 const serverId = preview?.id || preview?.key?.id || meta?.thread_metadata?.last_message_id
 const texto = preview?.message?.conversation || preview?.message?.extendedTextMessage?.text || ''
 if (serverId && String(serverId) !== '-1') {
 return { serverId: String(serverId), texto: String(texto).slice(0, 80), fuente: 'metadata-preview' }
 }
 } catch {}
 return null
}

async function intentarReaccionar(botSock, canalJid, serverId, emoji) {
 let ultimoError = 'sin error'
 const formas = [
 () => botSock.newsletterReact(canalJid, serverId, emoji),
 () => botSock.newsletterReact(canalJid, serverId, { emoji }),
 () => botSock.newsletterReact({ jid: canalJid, serverMessageId: serverId, reaction: emoji }),
 ]
 for (let fn of formas) {
 try {
 await fn()
 return { ok: true }
 } catch (e) {
 ultimoError = (e?.message || String(e) || 'error vacío') + ' | ' + (e?.stack ? String(e.stack).slice(0, 120) : '')
 console.log('[REACT FAIL]', ultimoError)
 }
 }
 return { ok: false, error: ultimoError }
}

handler.exec = async (sock, m, args) => {
 const chatId = m.key.remoteJid
 const prefix = (m.message?.conversation || m.message?.extendedTextMessage?.text || '').trim().charAt(0) || '.'
 const SEP = `─ׁ─ׁ─ׁ┉ׅ─ׁ─ׁ─ׁ┉ׅ─˳ּ𖹭─ׁ─ׁ┉ׅ─ׁ─ׁ─ׁ┉ׅ─ׁ─ׁ─ׁ─`
 const SEP2 = `─ׁ─ׁ─ׁ┉ׅ─ׁ─ׁ─ׁ┉ׅ─˳ּ𖹭─ׁ─ׁ┉ׅ─ׁ─ׁ─ׁ┉ׅ─ׁ─ׁ─ׁ─ִ`
 const FOOT = `\n\nε(´｡•·•｡\`)っ ⏤͟͟͞͞by locos y asociados`

 if (!args || args.length < 2) {
 return sendIconDoc(sock, chatId, m,
 `*ֺ𖹭 ׁ🍓 〫࣫⊹ׁ┄ CANALREACCIÓN ┄⊹ׁ🍓*\n` +
 `${SEP}\n\n` +
 `> ꒰ᐢ..ᐢ꒱ ❌ Te faltan datos\n\n` +
 `${SEP2}\n\n` +
 `> ꒰ᐢ..ᐢ꒱ 📚 *Uso:*\n` +
 `> *${prefix}canalreaccion <link> 👀 🔥 🐿️*\n\n` +
 `${SEP2}` + FOOT
 )
 }

 let canalInput = args[0]
 let resto = args.slice(1)
 let emojis = []
 for (let a of resto) {
 if (a.includes(',')) {
 for (let p of a.split(',').map(x => x.trim()).filter(Boolean)) if (emojis.length < 3) emojis.push(p)
 continue
 }
 if (emojis.length < 3) emojis.push(a)
 }
 if (!emojis.length) {
 return sendIconDoc(sock, chatId, m,
 `*ֺ𖹭 ׁ🍓 〫࣫⊹ׁ┄ CANALREACCIÓN ┄⊹ׁ🍓*\n` +
 `${SEP}\n\n` +
 `> ꒰ᐢ..ᐢ꒱ ❌ Pon al menos 1 emoji\n\n` +
 `${SEP2}` + FOOT
 )
 }

 const listaBots = getAllBots()
 const bots = getLiveBots(sock, listaBots)
 const vivos = bots.filter(b => b.vivo)
 const canalJid = await resolverCanal(sock, canalInput)

 let seguidos = []
 let erroresFollow = []
 for (let b of vivos) {
 try {
 await b.sock.newsletterFollow(canalJid)
 seguidos.push(b.num)
 } catch (e) {
 erroresFollow.push(`@${b.num}: ${e?.message || String(e)}`)
 }
 await new Promise(r => setTimeout(r, 500))
 }
 await new Promise(r => setTimeout(r, 1500))

 let ultimo = await getUltimoMensaje(sock, canalJid)
 if (!ultimo) {
 for (let b of vivos) {
 if (b.sock === sock) continue
 ultimo = await getUltimoMensaje(b.sock, canalJid)
 if (ultimo) break
 }
 }

 if (!ultimo) {
 return sendIconDoc(sock, chatId, m,
 `*ֺ𖹭 ׁ🍓 〫࣫⊹ׁ┄ CANALREACCIÓN ┄⊹ׁ🍓*\n` +
 `${SEP}\n\n` +
 `> ꒰ᐢ..ᐢ꒱ ❌ No pude agarrar lo último REAL\n` +
 `> ꒰ᐢ..ᐢ꒱ 📢 Canal: *${canalJid}*\n` +
 `> ꒰ᐢ..ᐢ꒱ 📦 Bots en carpetas: *${listaBots.length}*\n` +
 `> ꒰ᐢ..ᐢ꒱ 🤖 Bots vivos: *${vivos.length}*\n` +
 `> ꒰ᐢ..ᐢ꒱ 👣 Bots que siguieron: *${seguidos.length}/${vivos.length}*\n` +
 (erroresFollow.length ? `\n> ꒰ᐢ..ᐢ꒱ ❌ Errores follow:\n> ${erroresFollow.join('\n> ')}` : ``) +
 `\n\n${SEP2}` + FOOT
 )
 }

 let resultados = []
 let okCount = 0
 let erroresReact = []
 for (let i = 0; i < emojis.length; i++) {
 const b = vivos[i] || vivos[0]
 if (!b) break
 const r = await intentarReaccionar(b.sock, canalJid, ultimo.serverId, emojis[i])
 if (r.ok) {
 resultados.push(`> ꒰ᐢ..ᐢ꒱ ✅ @${b.num} -> *${emojis[i]}*`)
 okCount++
 } else {
 resultados.push(`> ꒰ᐢ..ᐢ꒱ ❌ @${b.num} -> *${emojis[i]}*`)
 erroresReact.push(`@${b.num} ${emojis[i]}: ${r.error}`)
 }
 await new Promise(r => setTimeout(r, 800))
 }

 if (!okCount) {
 return sendIconDoc(sock, chatId, m,
 `*ֺ𖹭 ׁ🍓 〫࣫⊹ׁ┄ CANALREACCIÓN ┄⊹ׁ🍓*\n` +
 `${SEP}\n\n` +
 `> ꒰ᐢ..ᐢ꒱ ❌ No pude reaccionar\n` +
 `> ꒰ᐢ..ᐢ꒱ 📢 Canal: *${canalJid}*\n` +
 `> ꒰ᐢ..ᐢ꒱ 📝 Último: *${ultimo.texto || 'sin texto'}*\n` +
 `> ꒰ᐢ..ᐢ꒱ 🆔 ID: *${ultimo.serverId}*\n` +
 `> ꒰ᐢ..ᐢ꒱ 📦 Fuente: *${ultimo.fuente}*\n` +
 `> ꒰ᐢ..ᐢ꒱ 👣 Seguido: *${seguidos.length}/${vivos.length}*\n` +
 `> ꒰ᐢ..ᐢ꒱ 🤖 Vivos: *${vivos.length}*\n` +
 `\n> ꒰ᐢ..ᐢ꒱ ❌ Error real:\n> ${erroresReact.join('\n> ')}\n\n` +
 `${SEP2}` + FOOT
 )
 }

 return sendIconDoc(sock, chatId, m,
 `*ֺ𖹭 ׁ🍓 〫࣫⊹ׁ┄ CANALREACCIÓN ┄⊹ׁ🍓*\n` +
 `${SEP}\n\n` +
 `> ꒰ᐢ..ᐢ꒱ ✅ Reacción lista\n` +
 `> ꒰ᐢ..ᐢ꒱ 📢 Canal: *${canalJid}*\n` +
 `> ꒰ᐢ..ᐢ꒱ 👣 Todos siguieron: *${seguidos.length}/${vivos.length}*\n` +
 `> ꒰ᐢ..ᐢ꒱ 📝 Último: *${ultimo.texto || 'sin texto'}*\n` +
 `> ꒰ᐢ..ᐢ꒱ 🆔 ID: *${ultimo.serverId}*\n` +
 `> ꒰ᐢ..ᐢ꒱ 🤖 Bots vivos: *${vivos.length}*\n` +
 `> ꒰ᐢ..ᐢ꒱ ${emojis.join(' ')} Reacciones: *${emojis.join(' ')}* (${okCount}/${emojis.length})\n\n` +
 `${SEP2}\n\n` +
 `> ꒰ᐢ..ᐢ꒱ 📊 *Detalle:*\n` +
 resultados.join('\n') +
 `\n\n${SEP2}` + FOOT,
 vivos.map(b => b.jid)
 )
}

export default handler
