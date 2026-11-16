import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import sharp from 'sharp'
import googleTTS from 'google-tts-api'

export const handler = {}
handler.name = 'voz'
handler.alias = ['tts', 'audio', 'vozes']
handler.category = 'fun'
handler.owner = false

function exec(cmd) {
 try { return execSync(cmd, { encoding: 'utf-8', stdio: 'pipe', timeout: 60000 }).trim() }
 catch (e) { return (e.stdout?.toString() || '') + '\n' + (e.stderr?.toString() || e.message) }
}

// ══ MISMA FUNCIÓN QUE EL .s - ICON COMO DOCUMENTO ══
function cleanId(v){ return String(v||'').split('@')[0].split(':')[0].replace(/\D/g,'') }
function getBotNum(sock){ return cleanId(sock?.principalNumber || sock?.subNumber || sock?.user?.id?.split(':')[0] || '') }

function getBotName(sock, botNum){
 if(sock.principalConfig?.name) return sock.principalConfig.name
 if(sock.subConfig?.name) return sock.subConfig.name
 for(let p of [
 path.join(process.cwd(),'principals',botNum,'config.json'),
 path.join(process.cwd(),'subbots',botNum,'config.json'),
 path.join(process.cwd(),'jadiBots',botNum,'config.json'),
 ]){
 if(fs.existsSync(p)){ try{ let j=JSON.parse(fs.readFileSync(p,'utf8')); if(j.name) return j.name }catch{} }
 }
 return 'Master Clover'
}

async function sendIconDoc(sock, jid, m, captionText) {
 try {
 let num = getBotNum(sock)
 const botName = getBotName(sock, num)
 const dbIconDir = path.join(process.cwd(), 'db', 'icon')
 const posibles = [
 sock.subConfig?.icon,
 sock.principalConfig?.icon,
 path.join(dbIconDir, `${num}.jpg`),
 path.join(dbIconDir, `${num}.png`),
 path.join(dbIconDir, `${num}.webp`),
 path.join(dbIconDir, 'main.jpg')
 ]
 let iconPath = null
 for (const p of posibles) {
 if (!p) continue
 if (String(p).startsWith('http')) continue
 const full = path.isAbsolute(p) ? p : path.join(process.cwd(), p)
 if (fs.existsSync(full)) { iconPath = full; break }
 }
 if (!iconPath && fs.existsSync(dbIconDir)) {
 const files = fs.readdirSync(dbIconDir).filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f))
 if (files.length) iconPath = path.join(dbIconDir, files[0])
 }
 if (!iconPath) {
 return sock.sendMessage(jid, { text: captionText }, { quoted: m })
 }
 const original = fs.readFileSync(iconPath)
 const preview = await sharp(original).rotate().resize(160, 160, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 65 }).toBuffer({ resolveWithObject: true })
 const metadataImg = await sharp(original).metadata()
 const formatos = {
 jpeg: ['jpg', 'image/jpeg'],
 png: ['png', 'image/png'],
 webp: ['webp', 'image/webp'],
 gif: ['gif', 'image/gif'],
 avif: ['avif', 'image/avif'],
 tiff: ['tiff', 'image/tiff']
 }
 let cleanName = String(botName).replace(/[\\/:*?"<>|\r\n]/g, '').trim() || 'Bot'
 const [extension, mimetype] = formatos[metadataImg.format] || [path.extname(iconPath).slice(1).toLowerCase() || 'jpg', 'image/jpeg']
 return await sock.sendMessage(jid, {
 document: original,
 fileName: `${cleanName}.${extension}`,
 mimetype,
 jpegThumbnail: preview.data.toString('base64'),
 thumbnailWidth: preview.info.width,
 thumbnailHeight: preview.info.height,
 caption: captionText
 }, { quoted: m })
 } catch (e) {
 return sock.sendMessage(jid, { text: captionText }, { quoted: m })
 }
}

handler.exec = async (sock, m, args) => {
 const jid = m.key.remoteJid
 const q = { quoted: m }

 // ✅ MÁS LENTO: todo 10% más lento para que se entienda
 const estilos = {
 mickey: 'asetrate=44100*1.25,aresample=44100,atempo=0.72',
 ardilla: 'asetrate=44100*1.45,aresample=44100,atempo=0.62',
 grave: 'asetrate=44100*0.85,aresample=44100,atempo=1.05',
 daddy: 'asetrate=44100*0.90,aresample=44100,atempo=1.00',
 badbunny: 'asetrate=44100*0.92,aresample=44100,atempo=0.97',
 robot: 'asetrate=44100*0.95,aresample=44100,atempo=0.94,aecho=0.8:0.7:40:0.3',
 bebe: 'asetrate=44100*1.15,aresample=44100,atempo=0.78',
 normal: 'atempo=0.90'
 }

 if (!args[0] || !estilos[args[0].toLowerCase()] || !args[1]) {
 return await sendIconDoc(sock, jid, m,
`╭─🎙️ *VOCES TTS* ─╮
│
│ ❌ Uso incorrecto.
│
│ ✅ *Ejemplo:*
│ ✦ .voz mickey Hola amigos
│ ✦ .voz grave Hola hermosa
│ ✦ .voz ardilla Holaa
│
│ 🎭 *Estilos:*
│ ✦ mickey, ardilla, grave, daddy
│ ✦ badbunny, robot, bebe, normal
│
╰───────────────────╯`)
 }

 const estilo = args[0].toLowerCase()
 const texto = args.slice(1).join(' ')

 if (texto.length > 200) {
 return await sendIconDoc(sock, jid, m,
`╭─⚠️ *TEXTO MUY LARGO* ─╮
│ Máximo 200 caracteres.
│ El tuyo tiene ${texto.length}.
╰───────────────────────╯`)
 }

 await sendIconDoc(sock, jid, m,
`╭─🎙️ *GENERANDO VOZ...* ─╮
│
│ 🎭 Estilo: ${estilo}
│ 💬 Texto: ${texto.slice(0, 80)}
│ ⏳ Espera un momento...
│
╰───────────────────────╯`)

 try {
 if (!fs.existsSync('./temp')) fs.mkdirSync('./temp', { recursive: true })
 const id = Date.now()
 const inputPath = path.join('./temp', `voz_in_${id}.mp3`)
 const outputPath = path.join('./temp', `voz_out_${id}.ogg`)

 const url = googleTTS.getAudioUrl(texto, { lang: 'es', slow: false, host: 'https://translate.google.com' })
 const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
 if (!res.ok) throw new Error('Google TTS falló')
 const buf = Buffer.from(await res.arrayBuffer())
 fs.writeFileSync(inputPath, buf)

 const filter = estilos[estilo]
 exec(`ffmpeg -y -i "${inputPath}" -af "${filter}" -vn -c:a libopus -b:a 64k -ar 48000 "${outputPath}"`)
 if (!fs.existsSync(outputPath)) throw new Error('FFmpeg no generó audio')

 await sock.sendMessage(jid, {
 audio: fs.readFileSync(outputPath),
 mimetype: 'audio/ogg; codecs=opus',
 ptt: true
 }, q)

 if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath)
 if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath)

 } catch (e) {
 console.log('Error voz:', e)
 await sendIconDoc(sock, jid, m,
`╭─❌ *ERROR* ─╮
│ No pude generar la voz.
│ Error: ${String(e.message || e).slice(0, 150)}
╰──────────────╯`)
 }
}

export default handler
