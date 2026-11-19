import fs from 'fs'
import path from 'path'
import sharp from 'sharp'
import handlerBase from '../../lib/jadi.js'

export const handler = {}
handler.name = 'code'
handler.alias = ['serbot', 'jadibot', 'subbot', 'masters']
handler.category = 'jadi'

const {
 getPairingCode,
 getSub,
 getSubConfig,
 waitForSubConnection,
 isValidBotNumber
} = handlerBase

const TUTORIAL_URL = 'https://raw.githubusercontent.com/starlyn-chann/Mistic-star/main/tourl/1795058835146-uXMXqj5NvfRE.mp4'
const TUTORIAL_PATH = path.join(process.cwd(), 'db', 'code-tutorial.mp4')

const SEP = `─ׁ─ׁ─ׁ┉ׅ─ׁ─ׁ─ׁ┉ׅ─˳ּ𖹭─ׁ─ׁ┉ׅ─ׁ─ׁ─ׁ┉ׅ─ׁ─ׁ─ׁ─`
const SEP2 = `─ׁ─ׁ─ׁ┉ׅ─ׁ─ׁ─ׁ┉ׅ─˳ּ𖹭─ׁ─ׁ┉ׅ─ׁ─ׁ─ׁ┉ׅ─ׁ─ׁ─ׁ─ִ`
const FOOT = `\n\nε(´｡•·•｡\`)っ ⏤͟͟͞͞by locos y asociados`

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

// ─── Tutorial: descargar UNA sola vez ───

async function getTutorial() {
 try {
 if (fs.existsSync(TUTORIAL_PATH)) {
 const st = fs.statSync(TUTORIAL_PATH)
 if (st.size > 10000) return TUTORIAL_PATH
 try { fs.unlinkSync(TUTORIAL_PATH) } catch {}
 }
 const dir = path.dirname(TUTORIAL_PATH)
 if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
 const res = await fetch(TUTORIAL_URL)
 if (!res.ok) throw new Error('HTTP ' + res.status)
 const buf = Buffer.from(await res.arrayBuffer())
 fs.writeFileSync(TUTORIAL_PATH, buf)
 return TUTORIAL_PATH
 } catch (e) {
 console.log('[CODE TUTORIAL]', e.message)
 return null
 }
}

// ─── Video con TU texto como caption ───
async function sendTutorial(sock, jid, m, caption) {
 const local = await getTutorial()
 try {
 if (local) {
 return await sock.sendMessage(jid, {
 video: fs.readFileSync(local),
 mimetype: 'video/mp4',
 caption
 }, { quoted: m })
 }
 return await sock.sendMessage(jid, { text: caption + `\n\n> Link video: ${TUTORIAL_URL}` }, { quoted: m })
 } catch {
 return await sock.sendMessage(jid, { text: caption + `\n\n> Link video: ${TUTORIAL_URL}` }, { quoted: m })
 }
}

// ─── Sistema para obtener el número ───

const clean = (n = '') => String(n).split('@')[0].split(':')[0].replace(/\D/g, '')

function esNumeroValido(n) {
 n = clean(n)
 return n.length >= 8 && n.length <= 15
}

async function lidToPn(lid, sock) {
 let jid = String(lid)
 if (!jid.includes('@')) jid = jid + '@lid'
 try {
 let pn = await sock.signalRepository?.lidMapping?.getPNForLID?.(jid)
 if (pn) return clean(pn)
 } catch {}
 return null
}

async function resolverCandidato(raw, sock) {
 if (!raw) return null
 raw = String(raw).trim()
 if (!raw) return null
 if (raw.includes('@lid')) {
 let pn = await lidToPn(raw, sock)
 if (pn && esNumeroValido(pn)) return pn
 return null
 }
 let n = clean(raw)
 if (esNumeroValido(n)) return n
 return null
}

async function getNumber(m, sock) {
 const candidatos = []
 for (let k of [m.key?.participantPn, m.key?.remoteJidPn, m.senderPn]) {
 if (k) candidatos.push(k)
 }
 const ctx = m.message?.extendedTextMessage?.contextInfo
 if (ctx?.participant) candidatos.push(ctx.participant)
 if (ctx?.participantPn) candidatos.push(ctx.participantPn)
 if (ctx?.mentionedJid?.length) {
 for (let j of ctx.mentionedJid) candidatos.push(j)
 }
 if (m.sender) candidatos.push(m.sender)
 if (m.key?.participant) candidatos.push(m.key.participant)
 if (m.key?.remoteJid && !String(m.key.remoteJid).endsWith('@g.us')) candidatos.push(m.key.remoteJid)

 for (let c of candidatos) {
 let n = await resolverCandidato(c, sock)
 if (n) return n
 }

 try {
 const jid = m.key?.remoteJid
 if (jid?.endsWith('@g.us') && m.key?.participant) {
 const meta = await sock.groupMetadata(jid)
 const lidBuscado = String(m.key.participant).split('@')[0]
 for (let p of meta.participants || []) {
 if (String(p.id).split('@')[0] === lidBuscado || String(p.lid).split('@')[0] === lidBuscado) {
 let n = await resolverCandidato(p.id, sock) || await resolverCandidato(p.lid, sock)
 if (n) return n
 if (p.id && !String(p.id).includes('@lid')) {
 let nn = clean(p.id)
 if (esNumeroValido(nn)) return nn
 }
 }
 }
 }
 } catch {}
 return null
}

function normalizeTarget(target) {
 if (!target) return ''
 let t = clean(target)
 if (t.length === 14 && t.startsWith('54') && t.endsWith('0')) {
 t = t.slice(0, -1)
 }
 return t
}

// ─── TU texto exacto, va como caption del video ───
function buildCaption(target, code) {
 return `Sub-Bots masters\n` +
 `${SEP}\n\n` +
 `> ꒰ᐢ..ᐢ꒱ Conecta un Sub-bot para el número » *${target}*\n` +
 `> ꒰ᐢ..ᐢ꒱ Tu código es: *${code}*\n\n` +
 `${SEP2}\n\n` +
 `> ꒰ᐢ..ᐢ꒱ Como conectarlo:\n` +
 `> ꒰ᐢ..ᐢ꒱ 1. Abre WhatsApp en el número *${target}*\n` +
 `> ꒰ᐢ..ᐢ꒱ 2. Anda a *Ajustes » Dispositivos vinculados*\n` +
 `> ꒰ᐢ..ᐢ꒱ 3. Toca en *Vincular un dispositivo*\n` +
 `> ꒰ᐢ..ᐢ꒱ 4. En vez de escanear el QR, toca *Vincular con número de teléfono*\n` +
 `> ꒰ᐢ..ᐢ꒱ 5. Pega este código: *${code}*\n\n` +
 `> ꒰ᐢ..ᐢ꒱ El código dura 60 segundos, si se vence vuelve a pedirlo con *.code ${target}*\n` +
 `> ꒰ᐢ..ᐢ꒱ Abajo te dejé un video tutorial por si no sabes donde tocar\n\n` +
 `${SEP2}` + FOOT
}

handler.exec = async (sock, m) => {
 const jid = m.key.remoteJid
 const body = m.message?.conversation || m.message?.extendedTextMessage?.text || ''
 const args = body.trim().split(/\s+/).slice(1)

 let target = null
 if (args[0]) {
 let argLimpio = args.join(' ')
 target = normalizeTarget(argLimpio)
 if (!esNumeroValido(target)) target = null
 }
 if (!target) {
 target = await getNumber(m, sock)
 if (target) target = normalizeTarget(target)
 }

 if (!target || !isValidBotNumber(target)) {
 return sendIconDoc(sock, jid, m,
 `Sub-Bots masters\n` +
 `${SEP}\n\n` +
 `> ꒰ᐢ..ᐢ꒱ No pude sacar un número válido\n` +
 `> ꒰ᐢ..ᐢ꒱ Tu sender: *${m.sender || 'no disponible'}*\n\n` +
 `${SEP2}\n\n` +
 `> ꒰ᐢ..ᐢ꒱ Usa así:\n` +
 `> ꒰ᐢ..ᐢ꒱ *.code 5492645746772*\n` +
 `> ꒰ᐢ..ᐢ꒱ *.code* (solo, para tu número)\n` +
 `> ꒰ᐢ..ᐢ꒱ *Responde a alguien con .code* (para su número)\n` +
 `> ꒰ᐢ..ᐢ꒱ *.code @usuario* (para el mencionado)\n\n` +
 `${SEP2}` + FOOT
 )
 }

 const existing = getSub(target)
 if (existing?.sock?.authState?.creds?.registered === true && existing.sock.user) {
 return sendIconDoc(sock, jid, m,
 `Sub-Bots masters\n` +
 `${SEP}\n\n` +
 `> ꒰ᐢ..ᐢ꒱ *${target}* ya está vinculado\n\n` +
 `${SEP2}` + FOOT
 )
 }

 await sendIconDoc(sock, jid, m,
 `Sub-Bots masters\n` +
 `${SEP}\n\n` +
 `> ꒰ᐢ..ᐢ꒱ Generando código para *${target}*...\n` +
 `> ꒰ᐢ..ᐢ꒱ Número detectado: *${target}*\n\n` +
 `${SEP2}` + FOOT
 )

 const config = getSubConfig(target)

 try {
 const result = await getPairingCode(target, config)

 if (result.status === 'connected') {
 return sendIconDoc(sock, jid, m,
 `Sub-Bots masters\n` +
 `${SEP}\n\n` +
 `> ꒰ᐢ..ᐢ꒱ *${target}* ya está vinculado\n\n` +
 `${SEP2}` + FOOT
 )
 }

 if (result.status === 'timeout') {
 return sendIconDoc(sock, jid, m,
 `Sub-Bots masters\n` +
 `${SEP}\n\n` +
 `> ꒰ᐢ..ᐢ꒱ No se pudo generar el código a tiempo para *${target}*\n` +
 `> ꒰ᐢ..ᐢ꒱ Intenta de nuevo en unos segundos\n\n` +
 `${SEP2}` + FOOT
 )
 }

 if (result.status === 'pending' && result.code) {
 const caption = buildCaption(target, result.code)
 // 1. Video con TU texto como caption
 await sendTutorial(sock, jid, m, caption)
 // 2. Código solo, para copiar fácil
 await sock.sendMessage(jid, { text: `*${result.code}*` }, { quoted: m })

 waitForSubConnection(target, 180_000)
 .then(async (ok) => {
 if (ok) {
 try {
 await sendIconDoc(sock, jid, m,
 `Sub-Bots masters\n` +
 `${SEP}\n\n` +
 `> ꒰ᐢ..ᐢ꒱ Sub-bot *${target}* conectado!\n` +
 `> ꒰ᐢ..ᐢ꒱ Ya puedes usarlo\n\n` +
 `${SEP2}` + FOOT
 )
 } catch {}
 }
 })
 .catch(() => {})
 return
 }

 await sendIconDoc(sock, jid, m,
 `Sub-Bots masters\n` +
 `${SEP}\n\n` +
 `> ꒰ᐢ..ᐢ꒱ No se pudo generar el código para *${target}*\n` +
 `> ꒰ᐢ..ᐢ꒱ Intenta de nuevo\n\n` +
 `${SEP2}` + FOOT
 )
 } catch (e) {
 console.log('[CODE ERROR]', e)
 await sendIconDoc(sock, jid, m,
 `Sub-Bots masters\n` +
 `${SEP}\n\n` +
 `> ꒰ᐢ..ᐢ꒱ Error: *${e.message}*\n\n` +
 `> ꒰ᐢ..ᐢ꒱ Asegúrate de poner el número sin + y sin espacios\n` +
 `> ꒰ᐢ..ᐢ꒱ Ej: *.code 5492645746772*\n\n` +
 `${SEP2}` + FOOT
 )
 }
}

export default handler
