import fs from 'fs'
import path from 'path'
import sharp from 'sharp'

export const handler = {}
handler.name = 'ping'
handler.alias = ['p']
handler.category = 'general'

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

async function sendIconDoc(sock, jid, m, captionText){
 try{
 let num = getBotNum(sock)
 const botName = getBotName(sock, num)
 const dbIconDir = path.join(process.cwd(), 'db', 'icon')
 const posibles = [
 sock.subConfig?.icon,
 sock.principalConfig?.icon,
 path.join(dbIconDir, num + '.jpg'),
 path.join(dbIconDir, num + '.png'),
 path.join(dbIconDir, num + '.webp'),
 path.join(dbIconDir, 'main.jpg')
 ]
 let iconPath = null
 for(const p of posibles){
 if(!p) continue
 if(String(p).startsWith('http')) continue
 const full = path.isAbsolute(p) ? p : path.join(process.cwd(), p)
 if(fs.existsSync(full)){ iconPath = full; break }
 }
 if(!iconPath && fs.existsSync(dbIconDir)){
 const files = fs.readdirSync(dbIconDir).filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f))
 if(files.length) iconPath = path.join(dbIconDir, files[0])
 }
 if(!iconPath) return sock.sendMessage(jid, { text: captionText }, { quoted: m })
 const original = fs.readFileSync(iconPath)
 const preview = await sharp(original).rotate().resize(160,160,{fit:'inside',withoutEnlargement:true}).jpeg({quality:65}).toBuffer({resolveWithObject:true})
 const metadataImg = await sharp(original).metadata()
 const formatos = {
 jpeg: ['jpg','image/jpeg'],
 png: ['png','image/png'],
 webp: ['webp','image/webp'],
 gif: ['gif','image/gif'],
 avif: ['avif','image/avif'],
 tiff: ['tiff','image/tiff']
 }
 let cleanName = String(botName).replace(/[\\/:*?"<>|\r\n]/g,'').trim() || 'Bot'
 const extInfo = formatos[metadataImg.format] || [path.extname(iconPath).slice(1).toLowerCase() || 'jpg','image/jpeg']
 return await sock.sendMessage(jid, {
 document: original,
 fileName: cleanName + '.' + extInfo[0],
 mimetype: extInfo[1],
 jpegThumbnail: preview.data.toString('base64'),
 thumbnailWidth: preview.info.width,
 thumbnailHeight: preview.info.height,
 caption: captionText
 }, { quoted: m })
 }catch(e){
 return sock.sendMessage(jid, { text: captionText }, { quoted: m })
 }
}

handler.exec = async (sock, m) => {
 // 1. Marcamos el tiempo justo antes de enviar al servidor de WhatsApp
 const t0 = performance.now()
 // 2. Este sendMessage va SERVIDOR -> WHATSAPP, el await espera que WhatsApp lo confirme
 try{ await sock.sendMessage(m.key.remoteJid, { react: { text: '🍓', key: m.key } }) }catch{}
 // 3. Cuando el await termina, ya sabemos cuanto tardó servidor -> WhatsApp
 const latency = Math.max(1, Math.round(performance.now() - t0))
 const txt = 'ε(´｡•·•｡`)っ─ *¡Pong!*\n> Velocidad: ' + latency + 'ms'
 return sendIconDoc(sock, m.key.remoteJid, m, txt)
}

export default handler
