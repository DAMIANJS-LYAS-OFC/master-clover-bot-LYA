import fs from 'fs'
import path from 'path'
import sharp from 'sharp'

export const handler = {}
handler.name = 'pokedaily'
handler.alias = ['daily', 'diario', 'recompensa', 'reclamar']
handler.category = 'pokemon'

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

// ─── FIX LID + TU DB REAL - igual que tu atrapar ───

function getSenderIds(m) {
 const p = m.key?.participant || ''
 const alt = m.key?.participantAlt || ''
 const remote = m.key?.remoteJid || ''
 return [...new Set([p, alt, remote].filter(Boolean))]
}

function getUserKey(m) {
 return m.key?.participantAlt || m.key?.participant || m.key?.remoteJid
}

function sameUser(a, b) {
 if (!a || !b) return false
 if (a === b) return true
 return String(a).split('@')[0].split(':')[0] === String(b).split('@')[0].split(':')[0]
}

function getChatUser(db, chatId, m) {
 if (!db.chat_users) db.chat_users = {}
 if (!db.chat_users[chatId]) db.chat_users[chatId] = {}

 let userKey = getUserKey(m)
 // Si ya existía con el otro formato (lid vs número), usar ese para no duplicar
 if (!db.chat_users[chatId][userKey]) {
 const myIds = getSenderIds(m)
 for (let k of Object.keys(db.chat_users[chatId])) {
 if (myIds.some(id => sameUser(id, k))) { userKey = k; break }
 }
 }
 if (!db.chat_users[chatId][userKey]) db.chat_users[chatId][userKey] = { pokes: [], coins: 0 }
 const user = db.chat_users[chatId][userKey]
 if (!Array.isArray(user.pokes)) user.pokes = []
 if (typeof user.coins !== 'number') user.coins = 0
 if (!user.balls) user.balls = { pokeball: 0, superball: 0, ultraball: 0, masterball: 0 }
 return user
}

async function saveDB(extra) {
 try { await extra?.saveDB?.() } catch {}
 try { await global.saveDB?.() } catch {}
}

// ─── Fecha 00:00 ───

function hoyStr() {
 const d = new Date()
 const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
 return local.toISOString().slice(0, 10)
}

function ayerStr() {
 const d = new Date()
 d.setDate(d.getDate() - 1)
 const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
 return local.toISOString().slice(0, 10)
}

function random(min, max) {
 return Math.floor(Math.random() * (max - min + 1)) + min
}

function pick(arr) {
 return arr[Math.floor(Math.random() * arr.length)]
}

handler.exec = async (sock, m, args, extra) => {
 const chatId = m.key.remoteJid
 const db = global.db?.data || {}
 const prefix = (m.message?.conversation || m.message?.extendedTextMessage?.text || '').trim().charAt(0) || '.'
 const nombreUser = m.pushName || 'Entrenador'

 // ─── AQUÍ EL FIX: ya no usa loadDB() / getUser() ───
 const user = getChatUser(db, chatId, m)

 const hoy = hoyStr()
 const ayer = ayerStr()

 if (user.dailyStreak == null) user.dailyStreak = 0

 if (user.lastDaily === hoy) {
 return sendIconDoc(sock, chatId, m,
 `*ֺ𖹭 ׁ🍓 〫࣫⊹ׁ┄ DAILY YA RECLAMADO ┄⊹ׁ🍓*\n` +
 `─ׁ─ׁ─ׁ┉ׅ─ׁ─ׁ─ׁ┉ׅ─˳ּ𖹭─ׁ─ׁ┉ׅ─ׁ─ׁ─ׁ┉ׅ─ׁ─ׁ─ׁ─\n\n` +
 `> ꒰ᐢ..ᐢ꒱ 😿 Ya reclamaste tu daily de hoy, *${nombreUser}*\n\n` +
 `> ꒰ᐢ..ᐢ꒱ 🔥 Racha actual: *${user.dailyStreak} días*\n` +
 `> ꒰ᐢ..ᐢ꒱ 🪙 Tus Coins: *${user.coins}*\n\n` +
 `> ꒰ᐢ..ᐢ꒱ ⏰ Vuelve mañana a las *00:00*`
 )
 }

 let nuevaRacha = 1
 let rachaPerdida = false
 if (user.lastDaily === ayer) {
 nuevaRacha = (user.dailyStreak || 0) + 1
 } else if (user.lastDaily && user.lastDaily !== hoy) {
 if ((user.dailyStreak || 0) >= 3) rachaPerdida = true
 nuevaRacha = 1
 }

 const coinsBase = Math.min(100 + (nuevaRacha - 1) * 20, 500)
 const coinsBonus = random(0, 50)
 let coinsTotal = coinsBase + coinsBonus

 let ballsGanadas = []
 if (nuevaRacha % 30 === 0) {
 ballsGanadas.push({ nombre: 'Master Ball', emoji: '🟣', key: 'masterball', cant: 1 })
 ballsGanadas.push({ nombre: 'Ultra Ball', emoji: '🟡', key: 'ultraball', cant: 3 })
 coinsTotal += 2000
 } else if (nuevaRacha % 7 === 0) {
 ballsGanadas.push({ nombre: 'Ultra Ball', emoji: '🟡', key: 'ultraball', cant: 2 })
 ballsGanadas.push({ nombre: 'Súper Ball', emoji: '🔵', key: 'superball', cant: 3 })
 coinsTotal += 500
 } else if (nuevaRacha % 3 === 0) {
 ballsGanadas.push({ nombre: 'Súper Ball', emoji: '🔵', key: 'superball', cant: 2 })
 ballsGanadas.push({ nombre: 'Poké Ball', emoji: '🔴', key: 'pokeball', cant: 2 })
 } else {
 const tipo = pick(['pokeball', 'pokeball', 'superball'])
 const cant = random(1, 3)
 const nombres = { pokeball: 'Poké Ball', superball: 'Súper Ball', ultraball: 'Ultra Ball' }
 const emojis = { pokeball: '🔴', superball: '🔵', ultraball: '🟡' }
 ballsGanadas.push({ nombre: nombres[tipo], emoji: emojis[tipo], key: tipo, cant })
 }

 let premioExtra = null
 const suerte = Math.random()
 if (suerte < 0.10) premioExtra = { nombre: 'Ultra Ball', emoji: '🟡', key: 'ultraball', cant: 1, texto: '¡Premio de la suerte! 🍀' }
 else if (suerte < 0.13) premioExtra = { nombre: 'Master Ball', emoji: '🟣', key: 'masterball', cant: 1, texto: '¡PREMIO LEGENDARIO! 🌟' }

 // ─── FIX: coins, no pokeCoins ───
 user.coins = (user.coins || 0) + coinsTotal
 for (const b of ballsGanadas) user.balls[b.key] = (user.balls[b.key] || 0) + b.cant
 if (premioExtra) user.balls[premioExtra.key] = (user.balls[premioExtra.key] || 0) + premioExtra.cant

 user.dailyStreak = nuevaRacha
 user.lastDaily = hoy
 user.totalDaily = (user.totalDaily || 0) + 1
 await saveDB(extra)

 let textoBalls = ''
 for (const b of ballsGanadas) textoBalls += `> ${b.emoji} *${b.cant}x ${b.nombre}*\n`

 let titulo = 'RECOMPENSA DIARIA'
 if (nuevaRacha % 30 === 0) titulo = '🏆 RECOMPENSA MENSUAL - 30 DÍAS'
 else if (nuevaRacha % 7 === 0) titulo = '🎁 RECOMPENSA SEMANAL - 7 DÍAS'

 let texto =
 `*ֺ𖹭 ׁ🍓 〫࣫⊹ׁ┄ ${titulo} ┄⊹ׁ🍓*\n` +
 `─ׁ─ׁ─ׁ┉ׅ─ׁ─ׁ─ׁ┉ׅ─˳ּ𖹭─ׁ─ׁ┉ׅ─ׁ─ׁ─ׁ┉ׅ─ׁ─ׁ─ׁ─\n\n` +
 `> ꒰ᐢ..ᐢ꒱ 👤 *${nombreUser}*\n` +
 `> ꒰ᐢ..ᐢ꒱ 🔥 Racha: *${nuevaRacha} días*` + (rachaPerdida ? ` (perdiste tu racha anterior 😿)` : ``) + `\n` +
 `> ꒰ᐢ..ᐢ꒱ 📅 Total de dailys: *${user.totalDaily}*\n\n` +
 `─ׁ─ׁ─ׁ┉ׅ─ׁ─ׁ─ׁ┉ׅ─˳ּ𖹭─ׁ─ׁ┉ׅ─ׁ─ׁ─ׁ┉ׅ─ׁ─ׁ─ׁ─ִ\n\n` +
 `> ꒰ᐢ..ᐢ꒱ 🎁 *Ganaste:*\n\n` +
 `> 🪙 *${coinsTotal} PokéCoins*\n` +
 `> ꒰ᐢ..ᐢ꒱ Base: ${coinsBase} + Suerte: ${coinsBonus}` +
 (nuevaRacha % 7 === 0 ? ` + Bonus semanal: 500` : '') +
 (nuevaRacha % 30 === 0 ? ` + Bonus mensual: 2000` : '') + `\n\n` +
 textoBalls + `\n`

 if (premioExtra) {
 texto += `> ꒰ᐢ..ᐢ꒱ ${premioExtra.texto}\n> ${premioExtra.emoji} *${premioExtra.cant}x ${premioExtra.nombre}*\n\n`
 }

 texto +=
 `> ꒰ᐢ..ᐢ꒱ 💰 Ahora tienes: *${user.coins} PokéCoins*\n` +
 `> ꒰ᐢ..ᐢ꒱ 🎒 Mochila:\n` +
 `> 🔴 ${user.balls.pokeball} | 🔵 ${user.balls.superball} | 🟡 ${user.balls.ultraball} | 🟣 ${user.balls.masterball}\n\n` +
 `─ׁ─ׁ─ׁ┉ׅ─ׁ─ׁ─ׁ┉ׅ─˳ּ𖹭─ׁ─ׁ┉ׅ─ׁ─ׁ─ׁ┉ׅ─ׁ─ׁ─ׁ─ִ\n\n` +
 `> ꒰ᐢ..ᐢ꒱ ⏰ Vuelve mañana a las *00:00*\n` +
 `> ꒰ᐢ..ᐢ꒱ 💡 No faltes o pierdes tu racha\n\n` +
 `ε(´｡•·•｡\`)っ ⏤͟͟͞͞by locos y asociados`

 await sendIconDoc(sock, chatId, m, texto)
}

export default handler
