import fs from 'fs'
import path from 'path'

const cacheDir = path.join(process.cwd(), 'ver_temp')
if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true })

const DOS_HORAS = 2 * 60 * 60 * 1000
let listenerPuesto = false
let limpiezaActiva = false

function unwrap(q) {
 if (!q) return null
 let msg = q
 for (let i = 0; i < 5; i++) {
 if (msg.ephemeralMessage?.message) { msg = msg.ephemeralMessage.message; continue }
 if (msg.viewOnceMessage?.message) { msg = msg.viewOnceMessage.message; continue }
 if (msg.viewOnceMessageV2?.message) { msg = msg.viewOnceMessageV2.message; continue }
 if (msg.viewOnceMessageV2Extension?.message) { msg = msg.viewOnceMessageV2Extension.message; continue }
 break
 }
 return msg
}

function limpiarCache() {
 try {
 for (const f of fs.readdirSync(cacheDir)) {
 const p = path.join(cacheDir, f)
 if (f.endsWith('.json')) {
 const info = JSON.parse(fs.readFileSync(p, 'utf8'))
 if (Date.now() - info.time > DOS_HORAS) {
 const id = f.replace('.json', '')
 for (const ext of ['jpg', 'mp4', 'mp3']) {
 const file = path.join(cacheDir, `${id}.${ext}`)
 if (fs.existsSync(file)) fs.unlinkSync(file)
 }
 fs.unlinkSync(p)
 }
 }
 }
 } catch {}
}

async function getDownload() {
 const nombres = ['baileys', '@whiskeysockets/baileys', 'WhiskeySockets-locosyasociados', '@adiwajshing/baileys']
 for (const n of nombres) {
 try {
 const mod = await import(n)
 if (mod.downloadMediaMessage) return mod.downloadMediaMessage
 } catch {}
 }
 return null
}

function activarEscucha(sock) {
 if (listenerPuesto) return
 listenerPuesto = true
 if (!limpiezaActiva) {
 limpiezaActiva = true
 setInterval(() => limpiarCache(), DOS_HORAS)
 }
 sock.ev.on('messages.upsert', async ({ messages }) => {
 for (const m of messages) {
 try {
 if (!m?.message) continue
 const inner = unwrap(m.message)
 if (!inner) continue
 const type = inner.imageMessage ? 'image' : inner.videoMessage ? 'video' : inner.audioMessage ? 'audio' : null
 if (!type) continue
 const downloadMediaMessage = await getDownload()
 if (!downloadMediaMessage) continue
 const buffer = await downloadMediaMessage({ key: m.key, message: m.message }, 'buffer', {}, { logger: { level: 'silent' }, reuploadRequest: sock.updateMediaMessage })
 if (!buffer?.length) continue
 const ext = type === 'image' ? 'jpg' : type === 'video' ? 'mp4' : 'mp3'
 fs.writeFileSync(path.join(cacheDir, `${m.key.id}.${ext}`), buffer)
 fs.writeFileSync(path.join(cacheDir, `${m.key.id}.json`), JSON.stringify({ type, jid: m.key.remoteJid, time: Date.now() }))
 } catch {}
 }
 })
}

export const handler = {}
handler.name = 'ver'
handler.alias = ['veruna', 'viewonce', 'vv', 'revelar']
handler.category = 'utils'

handler.exec = async (sock, m) => {
 const jid = m.key.remoteJid
 if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true })
 activarEscucha(sock)

 const ctx = m.message?.extendedTextMessage?.contextInfo
 const quotedMsg = ctx?.quotedMessage
 const quotedStanzaId = ctx?.stanzaId

 if (!quotedMsg) {
 return sock.sendMessage(jid, { text: '🌱 Escucha activada, ahora mandame la foto de ver una sola vez y respondela con .ver' }, { quoted: m })
 }

 if (quotedStanzaId) {
 const jsonPath = path.join(cacheDir, `${quotedStanzaId}.json`)
 if (fs.existsSync(jsonPath)) {
 const info = JSON.parse(fs.readFileSync(jsonPath, 'utf8'))
 if (Date.now() - info.time <= DOS_HORAS) {
 const ext = info.type === 'image' ? 'jpg' : info.type === 'video' ? 'mp4' : 'mp3'
 const file = path.join(cacheDir, `${quotedStanzaId}.${ext}`)
 if (fs.existsSync(file)) {
 const buffer = fs.readFileSync(file)
 const tipoTxt = info.type === 'image' ? 'Foto' : info.type === 'video' ? 'Video' : 'Audio'
 if (info.type === 'image') return sock.sendMessage(jid, { image: buffer, caption: `ฅ^•ﻌ•^ฅ ${tipoTxt}` }, { quoted: m })
 if (info.type === 'video') return sock.sendMessage(jid, { video: buffer, caption: `ฅ^•ﻌ•^ฅ ${tipoTxt}` }, { quoted: m })
 if (info.type === 'audio') return sock.sendMessage(jid, { audio: buffer, mimetype: 'audio/mp4' }, { quoted: m })
 }
 }
 }
 }

 try {
 const inner = unwrap(quotedMsg)
 const downloadMediaMessage = await getDownload()
 if (!downloadMediaMessage) throw new Error('no download')
 const type = inner?.imageMessage ? 'image' : inner?.videoMessage ? 'video' : 'audio'
 const buffer = await downloadMediaMessage({ key: { remoteJid: jid, id: quotedStanzaId, fromMe: false, participant: ctx?.participant }, message: quotedMsg }, 'buffer', {}, { logger: { level: 'silent' }, reuploadRequest: sock.updateMediaMessage })
 if (!buffer?.length) throw new Error('sin buffer')
 const tipoTxt = type === 'image' ? 'Foto' : type === 'video' ? 'Video' : 'Audio'
 if (type === 'image') await sock.sendMessage(jid, { image: buffer, caption: `ฅ^•ﻌ•^ฅ ${tipoTxt}` }, { quoted: m })
 if (type === 'video') await sock.sendMessage(jid, { video: buffer, caption: `ฅ^•ﻌ•^ฅ ${tipoTxt}` }, { quoted: m })
 if (type === 'audio') await sock.sendMessage(jid, { audio: buffer, mimetype: 'audio/mp4' }, { quoted: m })
 } catch {
 await sock.sendMessage(jid, { text: '🌱 Error al obtener este multimedia\n> ❀ Intenta de nuevo dentro de 8 segundos' }, { quoted: m })
 }
}
export default handler
