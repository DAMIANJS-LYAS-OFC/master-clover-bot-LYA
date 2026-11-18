import fs from 'fs'
import path from 'path'
import sharp from 'sharp'
import { loadDB, senderCanon, learnLid, getUser } from '../../lib/poke.js'

export const handler = {}
handler.name = 'pokedex'
handler.alias = ['dex', 'mis pokemons', 'mispokemon', 'coleccion', 'mispokes', 'mis pokes', 'mochila']
handler.category = 'pokemon'

const POR_PAGINA = 10

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

function norm(str) {
 return String(str || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]/g, '').trim()
}

handler.exec = async (sock, m, args) => {
 learnLid(m)
 const chatId = m.key.remoteJid
 // ─── MISMO QUE TU POKEDEX VIEJO ───
 const me = senderCanon(m)
 const db = loadDB()
 const user = getUser(db, me)
 const prefix = (m.message?.conversation || m.message?.extendedTextMessage?.text || '').trim().charAt(0) || '.'
 const nombreUser = m.pushName || 'Entrenador'

 // ─── TUS CAMPOS REALES, NO LOS DE CHAT_USERS ───
 const pokesRaw = Array.isArray(user.pokes) ? user.pokes : []
 const coins = Number(user.pokeCoins ?? 0) || 0
 const wins = Number(user.wins ?? 0) || 0
 const loses = Number(user.losses ?? user.loses ?? 0) || 0
 const balls = user.balls || { pokeball: 0, superball: 0, ultraball: 0, masterball: 0 }
 const equipo = user.equipo || user.team || []

 if (!pokesRaw.length) {
 return sendIconDoc(sock, chatId, m,
 `*ֺ𖹭 ׁ🍓 〫࣫⊹ׁ┄ POKÉDEX VACÍA ┄⊹ׁ🍓*\n` +
 `─ׁ─ׁ─ׁ┉ׅ─ׁ─ׁ─ׁ┉ׅ─˳ּ𖹭─ׁ─ׁ┉ׅ─ׁ─ׁ─ׁ┉ׅ─ׁ─ׁ─ׁ─\n\n` +
 `> ꒰ᐢ..ᐢ꒱ 😿 Todavía no tienes ningún Pokémon\n\n` +
 `> ꒰ᐢ..ᐢ꒱ 💡 Atrapa uno con *${prefix}poke*`
 )
 }

 // Normalizar con TUS nombres: name, id, tipo, rare, hp, atk, def, valor
 const todos = pokesRaw.map(p => ({
 nombre: p.name || p.nombre || '???',
 id: p.id ?? '?',
 tipo: p.tipo || p.type || '',
 rareza: p.rare || p.rareza || p.rarity || 'común',
 hp: Number(p.hp ?? 0) || 0,
 atk: Number(p.atk ?? p.attack ?? 0) || 0,
 def: Number(p.def ?? p.defense ?? 0) || 0,
 valor: Number(p.valor ?? p.value ?? 0) || 0,
 shiny: p.shiny || false,
 key: p.key
 }))

 // ─── Parsear: .pokedex [categoria] [pagina] ───
 let categoriaInput = null
 let pagina = 1
 const a = (args || []).map(x => String(x).toLowerCase())

 if (a.length === 1) {
 if (/^\d+$/.test(a[0])) pagina = parseInt(a[0])
 else categoriaInput = a[0]
 } else if (a.length >= 2) {
 categoriaInput = a[0]
 if (/^\d+$/.test(a[1])) pagina = parseInt(a[1])
 else {
 categoriaInput = a[0] + ' ' + a[1]
 if (/^\d+$/.test(a[2] || '')) pagina = parseInt(a[2])
 }
 }
 if (pagina < 1) pagina = 1

 let filtrados = todos
 let tituloCategoria = 'Todos'

 if (categoriaInput) {
 tituloCategoria = categoriaInput.charAt(0).toUpperCase() + categoriaInput.slice(1)
 // Rareza primero: comun, raro, epico, legendario, mitico
 const porRareza = todos.filter(p => norm(p.rareza) === norm(categoriaInput))
 const porTipo = todos.filter(p => norm(p.tipo).includes(norm(categoriaInput)))
 filtrados = porRareza.length ? porRareza : porTipo

 if (!filtrados.length) {
 return sendIconDoc(sock, chatId, m,
 `*ֺ𖹭 ׁ🍓 〫࣫⊹ׁ┄ POKÉDEX ┄⊹ׁ🍓*\n` +
 `─ׁ─ׁ─ׁ┉ׅ─ׁ─ׁ─ׁ┉ׅ─˳ּ𖹭─ׁ─ׁ┉ׅ─ׁ─ׁ─ׁ┉ׅ─ׁ─ׁ─ׁ─\n\n` +
 `> ꒰ᐢ..ᐢ꒱ 😿 No tienes ningún Pokémon de *${tituloCategoria}*\n\n` +
 `> ꒰ᐢ..ᐢ꒱ 📚 Prueba:\n` +
 `> *${prefix}pokedex comun* | *${prefix}pokedex raro*\n` +
 `> *${prefix}pokedex epico* | *${prefix}pokedex legendario*`
 )
 }
 }

 const totalPaginas = Math.ceil(filtrados.length / POR_PAGINA)

 if (pagina > totalPaginas) {
 return sendIconDoc(sock, chatId, m,
 `*ֺ𖹭 ׁ🍓 〫࣫⊹ׁ┄ PÁGINA NO EXISTE ┄⊹ׁ🍓*\n` +
 `─ׁ─ׁ─ׁ┉ׅ─ׁ─ׁ─ׁ┉ׅ─˳ּ𖹭─ׁ─ׁ┉ׅ─ׁ─ׁ─ׁ┉ׅ─ׁ─ׁ─ׁ─\n\n` +
 `> ꒰ᐢ..ᐢ꒱ ❌ La página *${pagina}* no existe\n\n` +
 `> ꒰ᐢ..ᐢ꒱ 📚 Categoría: *${tituloCategoria}*\n` +
 `> ꒰ᐢ..ᐢ꒱ 📦 Tienes: *${filtrados.length}* Pokémon\n` +
 `> ꒰ᐢ..ᐢ꒱ 📄 Páginas disponibles: *1 - ${totalPaginas}*`
 )
 }

 const inicio = (pagina - 1) * POR_PAGINA
 const paginaActual = filtrados.slice(inicio, inicio + POR_PAGINA)

 const valorTotal = todos.reduce((s, p) => s + Number(p.valor || 0), 0)
 const contar = (r) => todos.filter(p => norm(p.rareza) === norm(r)).length
 const masValioso = [...todos].sort((a, b) => Number(b.valor) - Number(a.valor))[0]

 const EMOJI_RAREZA = {
 'comun': '⚪', 'poco comun': '🟢', 'raro': '🔵',
 'epico': '🟣', 'legendario': '🟡', 'mitico': '🌟', 'ultra': '🟠'
 }

 let texto =
 `*ֺ𖹭 ׁ🍓 〫࣫⊹ׁ┄ POKÉDEX ┄⊹ׁ🍓*\n` +
 `─ׁ─ׁ─ׁ┉ׅ─ׁ─ׁ─ׁ┉ׅ─˳ּ𖹭─ׁ─ׁ┉ׅ─ׁ─ׁ─ׁ┉ׅ─ׁ─ׁ─ׁ─\n\n` +
 `> ꒰ᐢ..ᐢ꒱ 👤 Entrenador: *${nombreUser}*\n` +
 `> ꒰ᐢ..ᐢ꒱ 🪙 Coins: *${coins}*\n` +
 `> ꒰ᐢ..ᐢ꒱ 📦 Pokémon: *${todos.length}*\n` +
 `> ꒰ᐢ..ᐢ꒱ 💰 Valor total: *${valorTotal.toLocaleString('es-MX')} PokéCoins*\n` +
 `> ꒰ᐢ..ᐢ꒱ 🏆 Victorias: *${wins}* | 💀 Derrotas: *${loses}*\n\n` +
 `> ꒰ᐢ..ᐢ꒱ 🎒 Balls:\n` +
 `> 🔴 Poké: *${balls.pokeball || 0}* | 🔵 Súper: *${balls.superball || 0}*\n` +
 `> 🟡 Ultra: *${balls.ultraball || 0}* | 🟣 Master: *${balls.masterball || 0}*\n\n` +
 `─ׁ─ׁ─ׁ┉ׅ─ׁ─ׁ─ׁ┉ׅ─˳ּ𖹭─ׁ─ׁ┉ׅ─ׁ─ׁ─ׁ┉ׅ─ׁ─ׁ─ׁ─ִ\n\n` +
 `> ꒰ᐢ..ᐢ꒱ 📊 *Colección:*\n` +
 `> 🟡 Legendario: *${contar('legendario')}* | 🌟 Mítico: *${contar('mitico')}*\n` +
 `> 🟣 Épico: *${contar('epico')}* | 🔵 Raro: *${contar('raro')}*\n` +
 `> 🟢 Poco Común: *${contar('poco comun')}* | ⚪ Común: *${contar('comun')}*\n\n` +
 `> ꒰ᐢ..ᐢ꒱ 💎 Más valioso: *${masValioso?.nombre || '???'}* (${Number(masValioso?.valor || 0).toLocaleString('es-MX')})\n\n` +
 `─ׁ─ׁ─ׁ┉ׅ─ׁ─ׁ─ׁ┉ׅ─˳ּ𖹭─ׁ─ׁ┉ׅ─ׁ─ׁ─ׁ┉ׅ─ׁ─ׁ─ׁ─ִ\n\n` +
 `> ꒰ᐢ..ᐢ꒱ 📚 Mostrando: *${tituloCategoria}*\n` +
 `> ꒰ᐢ..ᐢ꒱ 📄 Página: *${pagina}/${totalPaginas}*\n\n`

 paginaActual.forEach((p, i) => {
 const numGlobal = inicio + i + 1
 const emojiR = EMOJI_RAREZA[norm(p.rareza)] || '⚪'
 const enEquipo = equipo.includes(p.key) || equipo.includes(p.nombre) || equipo.includes(String(p.id))

 texto +=
 `> *${numGlobal}.* ${emojiR} *${p.nombre}* #${p.id}${enEquipo ? ' ⭐' : ''}${p.shiny ? ' ✨' : ''}\n` +
 `> ꒰ᐢ..ᐢ꒱ ${p.tipo ? p.tipo + ' | ' : ''}${p.rareza}\n` +
 `> ꒰ᐢ..ᐢ꒱ ❤️ ${p.hp} | ⚔️ ${p.atk} | 🛡️ ${p.def}\n` +
 `> ꒰ᐢ..ᐢ꒱ 💰 ${Number(p.valor).toLocaleString('es-MX')} PokéCoins\n\n`
 })

 texto +=
 `─ׁ─ׁ─ׁ┉ׅ─ׁ─ׁ─ׁ┉ׅ─˳ּ𖹭─ׁ─ׁ┉ׅ─ׁ─ׁ─ׁ┉ׅ─ׁ─ׁ─ׁ─ִ\n\n` +
 `> ꒰ᐢ..ᐢ꒱ 📄 *Páginas:*\n` +
 `> *${prefix}pokedex ${categoriaInput ? categoriaInput + ' ' : ''}${pagina > 1 ? pagina - 1 : 1}* ⬅️ Anterior\n` +
 `> *${prefix}pokedex ${categoriaInput ? categoriaInput + ' ' : ''}${pagina < totalPaginas ? pagina + 1 : totalPaginas}* ➡️ Siguiente\n\n` +
 `> ꒰ᐢ..ᐢ꒱ 📚 *Categorías:*\n` +
 `> *${prefix}pokedex comun* | *${prefix}pokedex raro*\n` +
 `> *${prefix}pokedex epico* | *${prefix}pokedex legendario*\n\n` +
 `> ꒰ᐢ..ᐢ꒱ ❏ Vende con *${prefix}venderpoke <numero>*\n` +
 `> ꒰ᐢ..ᐢ꒱ ❏ Equipo con *${prefix}pokequipo 1 2 3*\n\n` +
 `ε(´｡•·•｡\`)っ ⏤͟͟͞͞by locos y asociados`

 await sendIconDoc(sock, chatId, m, texto)
}

export default handler
