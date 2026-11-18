import fs from 'fs'
import path from 'path'
import sharp from 'sharp'
import { loadDB } from '../../lib/poke.js'

export const handler = {}
handler.name = 'pokeranking'
handler.alias = ['poketop', 'top poke', 'rankingpoke', 'toppoke', 'rankpoke']
handler.category = 'pokemon'

const POR_PAGINA = 10

const CATEGORIAS = {
 'pokes': { key: 'pokes', titulo: 'POKES', emoji: '📦', unidad: 'pokes' },
 'pokemon': { key: 'pokes', titulo: 'POKES', emoji: '📦', unidad: 'pokes' },
 'coins': { key: 'coins', titulo: 'POKÉCOINS', emoji: '🪙', unidad: 'coins' },
 'coin': { key: 'coins', titulo: 'POKÉCOINS', emoji: '🪙', unidad: 'coins' },
 'wins': { key: 'wins', titulo: 'VICTORIAS', emoji: '🏆', unidad: 'victorias' },
 'victorias': { key: 'wins', titulo: 'VICTORIAS', emoji: '🏆', unidad: 'victorias' },
 'valor': { key: 'valor', titulo: 'VALOR TOTAL', emoji: '💎', unidad: 'PokéCoins' },
 'racha': { key: 'racha', titulo: 'RACHA DAILY', emoji: '🔥', unidad: 'días' },
 'daily': { key: 'racha', titulo: 'RACHA DAILY', emoji: '🔥', unidad: 'días' }
}

const MEDALLAS = { 1: '🥇', 2: '🥈', 3: '🥉' }

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

function normCat(s) {
 return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
}

function medalla(pos) {
 return MEDALLAS[pos] || `${pos}.`
}

handler.exec = async (sock, m, args) => {
 const chatId = m.key.remoteJid
 const prefix = (m.message?.conversation || m.message?.extendedTextMessage?.text || '').trim().charAt(0) || '.'
 // Tu pokedex usa senderCanon(m) como key, usamos lo mismo
 const meRaw = m.key?.participantAlt || m.key?.participant || m.sender || ''
 const me = String(meRaw).split('@')[0].split(':')[0]

 let categoriaKey = 'pokes'
 let pagina = 1
 let categoriaInput = null

 const a = (args || []).map(x => String(x).toLowerCase())
 if (a.length === 1) {
 if (/^\d+$/.test(a[0])) pagina = parseInt(a[0])
 else categoriaInput = a[0]
 } else if (a.length >= 2) {
 categoriaInput = a[0]
 if (/^\d+$/.test(a[1])) pagina = parseInt(a[1])
 }
 if (pagina < 1) pagina = 1

 if (categoriaInput) {
 const cat = CATEGORIAS[categoriaInput] || CATEGORIAS[normCat(categoriaInput)]
 if (!cat) {
 return sendIconDoc(sock, chatId, m,
 `*ֺ𖹭 ׁ🍓 〫࣫⊹ׁ┄ CATEGORÍA NO EXISTE ┄⊹ׁ🍓*\n` +
 `─ׁ─ׁ─ׁ┉ׅ─ׁ─ׁ─ׁ┉ׅ─˳ּ𖹭─ׁ─ׁ┉ׅ─ׁ─ׁ─ׁ┉ׅ─ׁ─ׁ─ׁ─\n\n` +
 `> ꒰ᐢ..ᐢ꒱ ❌ La categoría *${categoriaInput}* no existe\n\n` +
 `> 📦 *${prefix}pokeranking pokes*\n> 🪙 *${prefix}pokeranking coins*\n> 🏆 *${prefix}pokeranking wins*\n> 💎 *${prefix}pokeranking valor*`
 )
 }
 categoriaKey = cat.key
 }

 const catInfo = Object.values(CATEGORIAS).find(c => c.key === categoriaKey) || CATEGORIAS['pokes']

 // ─── MISMA DB QUE TU POKEDEX ───
 const db = loadDB()

 // loadDB puede devolver { users: {...} } o directo { jid: user }
 // Probamos las 2 formas, igual que hace getUser()
 let rawUsers = {}
 if (db.users && typeof db.users === 'object') rawUsers = db.users
 else if (db.pokeUsers && typeof db.pokeUsers === 'object') rawUsers = db.pokeUsers
 else if (db.pokemon && typeof db.pokemon === 'object' && !Array.isArray(db.pokemon)) rawUsers = db.pokemon
 else rawUsers = db

 const entries = []

 for (const [rawKey, u] of Object.entries(rawUsers)) {
 if (!u || typeof u !== 'object') continue
 if (Array.isArray(u)) continue

 // ─── EXACTO COMO TU POKEDEX: user.pokes ───
 const pokes = Array.isArray(u.pokes) ? u.pokes : []
 // Si no tiene pokes, NO lo contamos - este era tu bug original
 if (pokes.length === 0) continue

 const key = String(rawKey).split('@')[0].split(':')[0]
 if (!key || key === 'chats' || key === 'pokeChars' || key === 'chat_users') continue

 // ─── EXACTO COMO TU POKEDEX: user.pokeCoins, wins, losses ───
 const coins = Number(u.pokeCoins ?? u.coins ?? 0) || 0
 const wins = Number(u.wins ?? u.victorias ?? 0) || 0
 const loses = Number(u.losses ?? u.loses ?? u.derrotas ?? 0) || 0
 const racha = Number(u.dailyStreak ?? u.racha ?? 0) || 0
 // Valor: tu pokedex usa p.valor
 const valor = pokes.reduce((s, p) => s + Number(p?.valor ?? p?.value ?? 0), 0)

 entries.push({
 jid: String(rawKey).includes('@') ? String(rawKey) : String(rawKey) + '@s.whatsapp.net',
 key,
 pokes: pokes.length,
 coins,
 wins,
 loses,
 valor,
 racha
 })
 }

 if (!entries.length) {
 return sendIconDoc(sock, chatId, m, `> 𐙚₊˚⊹ Todavía no hay nadie en el ranking\n> Atrapa un Pokémon con ${prefix}poke`)
 }

 for (const e of entries) {
 if (categoriaKey === 'pokes') e.valorCat = e.pokes
 else if (categoriaKey === 'coins') e.valorCat = e.coins
 else if (categoriaKey === 'wins') e.valorCat = e.wins
 else if (categoriaKey === 'valor') e.valorCat = e.valor
 else if (categoriaKey === 'racha') e.valorCat = e.racha
 }

 entries.sort((a, b) => b.valorCat - a.valorCat)
 const totalPaginas = Math.ceil(entries.length / POR_PAGINA)

 if (pagina > totalPaginas) {
 return sendIconDoc(sock, chatId, m,
 `*ֺ𖹭 ׁ🍓 〫࣫⊹ׁ┄ PÁGINA NO EXISTE ┄⊹ׁ🍓*\n` +
 `─ׁ─ׁ─ׁ┉ׅ─ׁ─ׁ─ׁ┉ׅ─˳ּ𖹭─ׁ─ׁ┉ׅ─ׁ─ׁ─ׁ┉ׅ─ׁ─ׁ─ׁ─\n\n` +
 `> ꒰ᐢ..ᐢ꒱ ❌ La página *${pagina}* no existe\n` +
 `> ꒰ᐢ..ᐢ꒱ 📚 Categoría: *${catInfo.titulo}*\n` +
 `> ꒰ᐢ..ᐢ꒱ 👥 Jugadores: *${entries.length}*\n` +
 `> ꒰ᐢ..ᐢ꒱ 📄 Páginas disponibles: *1 - ${totalPaginas}*`
 )
 }

 const inicio = (pagina - 1) * POR_PAGINA
 const paginaActual = entries.slice(inicio, inicio + POR_PAGINA)
 const miIndex = entries.findIndex(e => e.key === me)
 const miPuesto = miIndex >= 0 ? miIndex + 1 : null
 const miValor = miIndex >= 0 ? entries[miIndex].valorCat : 0
 const mentions = paginaActual.map(e => e.jid)

 let texto =
 `*ֺ𖹭 ׁ🍓 〫࣫⊹ׁ┄ POKERANKING ┄⊹ׁ🍓*\n` +
 `─ׁ─ׁ─ׁ┉ׅ─ׁ─ׁ─ׁ┉ׅ─˳ּ𖹭─ׁ─ׁ┉ׅ─ׁ─ׁ─ׁ┉ׅ─ׁ─ׁ─ׁ─\n\n` +
 `> ꒰ᐢ..ᐢ꒱ ${catInfo.emoji} Categoría: *${catInfo.titulo}*\n` +
 `> ꒰ᐢ..ᐢ꒱ 👥 Jugadores con Pokémon: *${entries.length}*\n` +
 `> ꒰ᐢ..ᐢ꒱ 📄 Página: *${pagina}/${totalPaginas}*\n\n`

 if (miPuesto) texto += `> ꒰ᐢ..ᐢ꒱ 👤 Tu puesto: *#${miPuesto}* - *${miValor.toLocaleString('es-MX')} ${catInfo.unidad}*\n\n`
 else texto += `> ꒰ᐢ..ᐢ꒱ 👤 Tú todavía no estás en el ranking\n\n`

 texto += `─ׁ─ׁ─ׁ┉ׅ─ׁ─ׁ─ׁ┉ׅ─˳ּ𖹭─ׁ─ׁ┉ׅ─ׁ─ׁ─ׁ┉ׅ─ׁ─ׁ─ׁ─ִ\n\n`

 paginaActual.forEach((e, i) => {
 const pos = inicio + i + 1
 const esYo = e.key === me
 const marcaYo = esYo ? ' 👈 *TÚ*' : ''
 if (pos <= 3 && pagina === 1) {
 texto +=
 `> ${medalla(pos)} @${e.key}\n` +
 `> ꒰ᐢ..ᐢ꒱ ${catInfo.emoji} *${e.valorCat.toLocaleString('es-MX')} ${catInfo.unidad}*${marcaYo}\n` +
 `> ꒰ᐢ..ᐢ꒱ 📦 ${e.pokes} pokes | 🪙 ${e.coins.toLocaleString('es-MX')} | 🏆 ${e.wins} wins\n\n`
 } else {
 texto +=
 `> ${medalla(pos)} @${e.key}${marcaYo}\n` +
 `> ꒰ᐢ..ᐢ꒱ ${catInfo.emoji} *${e.valorCat.toLocaleString('es-MX')} ${catInfo.unidad}*\n\n`
 }
 })

 texto +=
 `─ׁ─ׁ─ׁ┉ׅ─ׁ─ׁ─ׁ┉ׅ─ׁ─ׁ─ׁ┉ׅ─ׁ─ׁ─ׁ─ִ\n\n` +
 `> ꒰ᐢ..ᐢ꒱ 📚 *Categorías:*\n` +
 `> 📦 *${prefix}pokeranking pokes*\n` +
 `> 🪙 *${prefix}pokeranking coins*\n` +
 `> 🏆 *${prefix}pokeranking wins*\n` +
 `> 💎 *${prefix}pokeranking valor*\n` +
 `> 🔥 *${prefix}pokeranking racha*\n\n` +
 `> ꒰ᐢ..ᐢ꒱ 📄 *Páginas:*\n` +
 `> *${prefix}pokeranking ${categoriaInput || 'pokes'} ${pagina > 1 ? pagina - 1 : 1}* ⬅️ Anterior\n` +
 `> *${prefix}pokeranking ${categoriaInput || 'pokes'} ${pagina < totalPaginas ? pagina + 1 : totalPaginas}* ➡️ Siguiente\n\n` +
 `ε(´｡•·•｡\`)っ ⏤͟͟͞͞by locos y asociados`

 await sendIconDoc(sock, chatId, m, texto, mentions)
}

export default handler
