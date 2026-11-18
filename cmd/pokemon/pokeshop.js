import fs from 'fs'
import path from 'path'
import sharp from 'sharp'
import { loadDB, saveDB, senderCanon, learnLid, getUser } from '../../lib/poke.js'

export const handler = {}
handler.name = 'pokeshop'
handler.alias = ['tienda', 'shop']
handler.category = 'pokemon'

const PRECIOS = {
 pokeball: 50,
 superball: 150,
 ultraball: 300,
 masterball: 1000
}

const NOMBRES = {
 pokeball: 'Poké Ball',
 superball: 'Súper Ball',
 ultraball: 'Ultra Ball',
 masterball: 'Master Ball'
}

const EMOJIS = {
 pokeball: '🔴',
 superball: '🔵',
 ultraball: '🟡',
 masterball: '🟣'
}

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

// ─── Comando ───

handler.exec = async (sock, m, args) => {
 learnLid(m)

 const jid = m.key.remoteJid
 const me = senderCanon(m)
 const db = loadDB()
 const user = getUser(db, me)
 const prefix = (m.message?.conversation || m.message?.extendedTextMessage?.text || '').trim().charAt(0) || '.'

 // ─── Sin argumentos: mostrar tienda ───

 if (!args[0]) {
 const texto =
 `*ֺ𖹭 ׁ🍓 〫࣫⊹ׁ┄ POKÉSHOP ┄⊹ׁ🍓*\n` +
 `─ׁ─ׁ─ׁ┉ׅ─ׁ─ׁ─ׁ┉ׅ─˳ּ𖹭─ׁ─ׁ┉ׅ─ׁ─ׁ─ׁ┉ׅ─ׁ─ׁ─ׁ─\n\n` +

 `> ꒰ᐢ..ᐢ꒱ 🪙 *Tus PokéCoins:*\n` +
 `> ꒰ᐢ..ᐢ꒱ 💰 *${user.pokeCoins}*\n\n` +

 `> ꒰ᐢ..ᐢ꒱ 🎒 *Tu Mochila:*\n` +
 `> 🔴 Poké Ball: *${user.balls.pokeball}*\n` +
 `> 🔵 Súper Ball: *${user.balls.superball}*\n` +
 `> 🟡 Ultra Ball: *${user.balls.ultraball}*\n` +
 `> 🟣 Master Ball: *${user.balls.masterball}*\n\n` +

 `─ׁ─ׁ─ׁ┉ׅ─ׁ─ׁ─ׁ┉ׅ─˳ּ𖹭─ׁ─ׁ┉ׅ─ׁ─ׁ─ׁ┉ׅ─ׁ─ׁ─ׁ─ִ\n\n` +

 `> ꒰ᐢ..ᐢ꒱ 🛒 *Precios:*\n\n` +
 `> 🔴 Poké Ball\n` +
 `> ꒰ᐢ..ᐢ꒱ 💰 *50 PokéCoins*\n\n` +
 `> 🔵 Súper Ball\n` +
 `> ꒰ᐢ..ᐢ꒱ 💰 *150 PokéCoins*\n\n` +
 `> 🟡 Ultra Ball\n` +
 `> ꒰ᐢ..ᐢ꒱ 💰 *300 PokéCoins*\n\n` +
 `> 🟣 Master Ball\n` +
 `> ꒰ᐢ..ᐢ꒱ 💰 *1000 PokéCoins*\n` +
 `> ꒰ᐢ..ᐢ꒱ ✨ *¡100% de captura!*\n\n` +

 `─ׁ─ׁ─ׁ┉ׅ─ׁ─ׁ─ׁ┉ׅ─˳ּ𖹭─ׁ─ׁ┉ׅ─ׁ─ׁ─ׁ┉ׅ─ׁ─ׁ─ׁ─ִ\n\n` +
 `> ꒰ᐢ..ᐢ꒱ 📝 *Uso:*\n` +
 `> *${prefix}pokeshop pokeball*\n` +
 `> *${prefix}pokeshop ultraball 2*\n\n` +
 `> ꒰ᐢ..ᐢ꒱ 💡 *Tip:*\n` +
 `> Ganas PokéCoins por cada Pokémon\n` +
 `> que atrapas, según su valor y rareza.\n\n` +
 `ε(´｡•·•｡\`)っ ⏤͟͟͞͞by locos y asociados`

 return sendIconDoc(sock, jid, m, texto)
 }

 // ─── Normalizar nombre ───

 let ball = args[0].toLowerCase()
 if (ball === 'super') ball = 'superball'
 if (ball === 'ultra') ball = 'ultraball'
 if (ball === 'master') ball = 'masterball'
 if (ball === 'poke') ball = 'pokeball'

 if (!PRECIOS[ball]) {
 return sendIconDoc(sock, jid, m,
 `> 𐙚₊˚⊹ Esa Poké Ball no existe\n` +
 `> ejemplo: ${prefix}pokeshop pokeball`
 )
 }

 // ─── Cantidad ───

 let cant = parseInt(args[1] || '1') || 1

 if (cant < 1) {
 return sendIconDoc(sock, jid, m,
 `> 𐙚₊˚⊹ La cantidad tiene que ser mayor a 0\n` +
 `> ejemplo: ${prefix}pokeshop pokeball 2`
 )
 }

 if (cant > 100) {
 return sendIconDoc(sock, jid, m,
 `> 𐙚₊˚⊹ Máximo 100 por compra\n` +
 `> ejemplo: ${prefix}pokeshop pokeball 10`
 )
 }

 const costo = PRECIOS[ball] * cant

 // ─── Sin plata ───

 if (user.pokeCoins < costo) {
 return sendIconDoc(sock, jid, m,
 `*ֺ𖹭 ׁ🍓 〫࣫⊹ׁ┄ SIN POKÉCOINS ┄⊹ׁ🍓*\n` +
 `─ׁ─ׁ─ׁ┉ׅ─ׁ─ׁ─ׁ┉ׅ─˳ּ𖹭─ׁ─ׁ┉ׅ─ׁ─ׁ─ׁ┉ׅ─ׁ─ׁ─ׁ─\n\n` +
 `> ꒰ᐢ..ᐢ꒱ 🪙 Tienes: *${user.pokeCoins}*\n` +
 `> ꒰ᐢ..ᐢ꒱ 💰 Necesitas: *${costo}*\n` +
 `> ꒰ᐢ..ᐢ꒱ ❌ Te faltan: *${costo - user.pokeCoins}*\n\n` +
 `> ꒰ᐢ..ᐢ꒱ 💡 Atrapa más Pokémon para ganar PokéCoins.`
 )
 }

 // ─── Comprar ───

 user.pokeCoins -= costo
 user.balls[ball] = (user.balls[ball] || 0) + cant
 saveDB(db)

 const textoCompra =
 `*ֺ𖹭 ׁ🍓 〫࣫⊹ׁ┄ COMPRA EXITOSA ┄⊹ׁ🍓*\n` +
 `─ׁ─ׁ─ׁ┉ׅ─ׁ─ׁ─ׁ┉ׅ─˳ּ𖹭─ׁ─ׁ┉ׅ─ׁ─ׁ─ׁ┉ׅ─ׁ─ׁ─ׁ─\n\n` +
 `> ꒰ᐢ..ᐢ꒱ ✅ Compraste:\n` +
 `> ${EMOJIS[ball]} *${cant}x ${NOMBRES[ball]}*\n\n` +
 `> ꒰ᐢ..ᐢ꒱ 💰 Pagaste: *${costo} PokéCoins*\n` +
 `> ꒰ᐢ..ᐢ꒱ 🪙 Te quedan: *${user.pokeCoins} PokéCoins*\n\n` +
 `> ꒰ᐢ..ᐢ꒱ 🎒 Ahora tienes:\n` +
 `> ${EMOJIS[ball]} *${user.balls[ball]} ${NOMBRES[ball]}*\n\n` +
 `─ׁ─ׁ─ׁ┉ׅ─ׁ─ׁ─ׁ┉ׅ─˳ּ𖹭─ׁ─ׁ┉ׅ─ׁ─ׁ─ׁ┉ׅ─ׁ─ׁ─ׁ─ִ\n` +
 `ε(´｡•·•｡\`)っ ⏤͟͟͞͞by locos y asociados`

 await sendIconDoc(sock, jid, m, textoCompra)
}

export default handler
