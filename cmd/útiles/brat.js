import axios from 'axios'
import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'
import webpmux from 'node-webpmux'
import config from '../../config.js'

const tempFolder = path.join(process.cwd(), 'temp')
if (!fs.existsSync(tempFolder)) fs.mkdirSync(tempFolder, { recursive: true })

function cleanId(v){ return String(v||'').split('@')[0].split(':')[0].replace(/\D/g,'') }
function getBotNum(sock){ return cleanId(sock?.principalNumber || sock?.subNumber || sock?.user?.id?.split(':')[0] || '') }
function getBotName(sock, botNum){
 if(sock.principalConfig?.name) return sock.principalConfig.name
 if(sock.subConfig?.name) return sock.subConfig.name
 for(let p of [path.join(process.cwd(),'principals',botNum,'config.json'), path.join(process.cwd(),'subbots',botNum,'config.json'), path.join(process.cwd(),'jadiBots',botNum,'config.json')]){
 if(fs.existsSync(p)){ try{ let j=JSON.parse(fs.readFileSync(p,'utf8')); if(j.name) return j.name }catch{} }
 }
 return config?.bot?.name || 'Master Clover'
}

// ===== FUNCION DEL DOCUMENTO ICON, IGUAL QUE LA DEL SETMENU =====
async function sendIconDoc(sock, jid, m, captionText, botName, botNum){
 try{
 const dbIconDir = path.join(process.cwd(), 'db', 'icon')
 const posibles = [sock.subConfig?.icon, sock.principalConfig?.icon, path.join(dbIconDir, `${botNum}.jpg`), path.join(dbIconDir, `${botNum}.png`), path.join(dbIconDir, 'main.jpg')]
 let iconPath = null
 for(const p of posibles){ if(!p) continue; if(String(p).startsWith('http')) continue; const full = path.isAbsolute(p) ? p : path.join(process.cwd(), p); if(fs.existsSync(full)){ iconPath = full; break } }
 if(!iconPath && fs.existsSync(dbIconDir)){ const files = fs.readdirSync(dbIconDir).filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f)); if(files.length) iconPath = path.join(dbIconDir, files[0]) }
 if(!iconPath) return sock.sendMessage(jid, { text: captionText }, { quoted: m })
 const original = fs.readFileSync(iconPath)
 let cleanName = String(botName || 'Bot').replace(/[\\/:*?"<>|\r\n]/g, '').trim() || 'Bot'
 let ext = path.extname(iconPath).slice(1).toLowerCase() || 'jpg'
 let mimetype = 'image/jpeg'; if(ext==='png') mimetype='image/png'; if(ext==='webp') mimetype='image/webp'
 let thumbOpts = {}
 try{ const sharp = (await import('sharp')).default; const preview = await sharp(original).rotate().resize(160,160,{fit:'inside',withoutEnlargement:true}).jpeg({quality:65}).toBuffer({resolveWithObject:true}); thumbOpts = { jpegThumbnail: preview.data.toString('base64'), thumbnailWidth: preview.info.width, thumbnailHeight: preview.info.height } }catch{}
 return await sock.sendMessage(jid, { document: original, fileName: `${cleanName}.${ext}`, mimetype, ...thumbOpts, caption: captionText }, { quoted: m })
 }catch{ return sock.sendMessage(jid, { text: captionText }, { quoted: m }) }
}

async function convertToWebp(buffer){
 return new Promise((resolve, reject) => {
 const tempId = Date.now() + Math.random().toString(36).substring(7)
 const inputPath = path.join(tempFolder, `brat_input_${tempId}.png`)
 const outputPath = path.join(tempFolder, `brat_output_${tempId}.webp`)
 try{
 fs.writeFileSync(inputPath, buffer)
 const ffmpeg = spawn('ffmpeg', ['-i', inputPath, '-vcodec', 'libwebp', '-vf', 'scale=512:512:force_original_aspect_ratio=decrease,format=rgba,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=#00000000', '-lossless', '0', '-compression_level', '6', '-q:v', '80', '-loop', '0', '-an', '-vsync', '0', '-s', '512:512', '-f', 'webp', outputPath])
 let timer = setTimeout(() => { try{ ffmpeg.kill() }catch{}; reject(new Error('FFmpeg timeout')) }, 30000)
 ffmpeg.on('close', (code) => { clearTimeout(timer); try{ if(code !== 0) throw new Error(`FFmpeg falló ${code}`); const b = fs.readFileSync(outputPath); try{ fs.unlinkSync(inputPath) }catch{}; try{ fs.unlinkSync(outputPath) }catch{}; resolve(b) }catch(e){ reject(e) } })
 ffmpeg.on('error', (err) => { clearTimeout(timer); reject(err) })
 }catch(e){ reject(e) }
 })
}
async function addExif(webpBuffer, metadata){
 const tmpIn = path.join(tempFolder, `brat_exif_in_${Date.now()}.webp`)
 const tmpOut = path.join(tempFolder, `brat_exif_out_${Date.now()}.webp`)
 fs.writeFileSync(tmpIn, webpBuffer)
 let author = metadata.author || ''
 if(author.length > 340) author = author.slice(0, 340)
 const json = { "sticker-pack-id": "itsuki.bot", "sticker-pack-name": metadata.packname || 'Itsuki Bot', "sticker-pack-publisher": author || 'Usuario', "emojis": ["🌱"] }
 const exifAttr = Buffer.from([0x49,0x49,0x2A,0x00,0x08,0x00,0x00,0x00,0x01,0x00,0x41,0x57,0x07,0x00,0x00,0x00,0x00,0x00,0x16,0x00,0x00,0x00])
 const jsonBuff = Buffer.from(JSON.stringify(json), 'utf-8')
 const exif = Buffer.concat([exifAttr, jsonBuff]); exif.writeUIntLE(jsonBuff.length, 14, 4)
 const img = new webpmux.Image(); await img.load(tmpIn); img.exif = exif; await img.save(tmpOut)
 const result = fs.readFileSync(tmpOut); try{ fs.unlinkSync(tmpIn) }catch{}; try{ fs.unlinkSync(tmpOut) }catch{}; return result
}
function isValidImage(buffer){
 if(!buffer || buffer.length < 4) return false
 const hex = buffer.toString('hex', 0, 4).toUpperCase()
 return ['89504E47', 'FFD8FF', '47494638', '52494646'].some(sig => hex.startsWith(sig))
}
async function makeBrat(sock, m, text, delay){
 const apiUrl = `https://api.siputzx.my.id/api/m/brat?text=${encodeURIComponent(text)}&delay=${delay}`
 const response = await axios.get(apiUrl, { responseType: 'arraybuffer', timeout: 30000, headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'image/webp,image/png,image/jpeg,*/*' } })
 if(!response.data || response.data.length === 0) throw new Error('No se pudo generar la imagen')
 const imageBuffer = Buffer.from(response.data)
 if(!isValidImage(imageBuffer)) throw new Error('La API no devolvió una imagen válida')
 let stickerBuffer
 try{ stickerBuffer = await convertToWebp(imageBuffer) }catch{ stickerBuffer = imageBuffer }
 let botNum = getBotNum(sock); let botName = getBotName(sock, botNum); let pushName = m.pushName || 'Usuario'
 try{
 stickerBuffer = await addExif(stickerBuffer, {
 packname: `─꯭━─̷̸─꯭━─̷̸─̷̸─꯭━─̷̸─꯭━─\n⠟ ׂ ⭐⃞፝֟͝ꭷUsuario: ${pushName}\n⠟ ׂ ⭐⃞፝֟͝ꭷBot: ${botName}`,
 author: 'Dev Damián '
 })
 }catch{}
 return stickerBuffer
}

// ===== USEPREFIX = EL PREFIJO QUE USO EL USUARIO, NO TODOS =====
function getUsePrefix(m){
 // 1. Si tu loader ya te lo pasa, usalo
 if(m?.usedPrefix) return m.usedPrefix
 if(m?.usedprefix) return m.usedprefix
 if(m?.prefix) return m.prefix

 // 2. Si no, lo sacamos del texto original del mensaje
 let raw = m?.body || m?.text || m?.caption ||
 m?.message?.conversation ||
 m?.message?.extendedTextMessage?.text ||
 m?.message?.imageMessage?.caption ||
 m?.message?.videoMessage?.caption || ''

 // Prefijos de tu bot
 let all = config?.bot?.prefixes || config?.bot?.prefixList || config?.bot?.prefix || ['.', '#', '/', '!']
 if(!Array.isArray(all)) all = [all]
 // Ordenar por largo para que no falle si hay prefijos de 2 caracteres
 let sorted = [...all].sort((a,b) => String(b).length - String(a).length)
 for(let p of sorted){
 if(raw.startsWith(p)) return p
 }
 // 3. Si no se detecto, usa el primero
 return sorted[0] || '.'
}

export const handler = {}
handler.name = 'brat'
handler.alias = []
handler.category = 'utils'
handler.description = 'Crea sticker estilo brat con texto'

handler.exec = async (sock, m, args) => {
 const jid = m.key.remoteJid
 const useprefix = getUsePrefix(m)
 let textArgs = [...args]
 let delay = 500
 if(textArgs.length > 1 && !isNaN(textArgs[textArgs.length - 1])){
 const last = Number(textArgs[textArgs.length - 1])
 if(last >= 100 && last <= 1000){ delay = last; textArgs = textArgs.slice(0, -1) }
 }
 let text = textArgs.join(' ').trim()

 // ===== EJEMPLO / USO - SIN CUADROS, TEXTO PLANO + ICON DOC =====
 if(!text){
 let botNum = getBotNum(sock)
 let botName = getBotName(sock, botNum)
 let txt = `Por favor, ingresa un texto para crear el Sticker.\n\nEjemplo: ${useprefix}brat Hola mundo\nEjemplo: ${useprefix}brat soy brat\nEjemplo: ${useprefix}brat hola mundo 800`
 return sendIconDoc(sock, jid, m, txt, botName, botNum)
 }

 try{
 try{ await sock.sendMessage(jid, { react: { text: '🕒', key: m.key } }) }catch{}
 let stickerBuffer = await makeBrat(sock, m, text, delay)
 await sock.sendMessage(jid, { sticker: stickerBuffer }, { quoted: m })
 try{ await sock.sendMessage(jid, { react: { text: '✅', key: m.key } }) }catch{}
 }catch(error){
 console.error('❌ Error en brat:', error)
 try{ await sock.sendMessage(jid, { react: { text: '❌', key: m.key } }) }catch{}
 let errorMsg = `⚠︎ Error: ${error.message}`
 if(error.response?.status === 404) errorMsg = `⚠︎ La API no está disponible temporalmente`
 else if(error.message?.includes('ECONNREFUSED')) errorMsg = `⚠︎ No se pudo conectar con la API`
 return sock.sendMessage(jid, { text: errorMsg }, { quoted: m })
 }
}
export default handler
