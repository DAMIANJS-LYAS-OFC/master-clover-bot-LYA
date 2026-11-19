import fs from 'fs'
import path from 'path'
import { pathToFileURL } from 'url'
import { saveSubConfig, getSubs } from '../../lib/jadi.js'
import { savePrincipalConfig, getPrincipals } from '../../lib/principals.js'

let config = null
try {
 const p = path.join(process.cwd(), 'config.js')
 if (fs.existsSync(p)) {
 const mod = await import(pathToFileURL(p).href + '?v=' + Date.now())
 config = mod.default || mod
 }
} catch {}

export const handler = {}
handler.name = 'setbanner'
handler.alias = ['setimg', 'setvideo', 'setgif']
handler.category = 'subbots'

function getExtFromUrl(url){
 const clean = String(url).split('?')[0].toLowerCase()
 if(clean.endsWith('.gif')) return '.gif'
 if(clean.endsWith('.mp4')) return '.mp4'
 if(clean.endsWith('.webp')) return '.webp'
 if(clean.endsWith('.jpg') || clean.endsWith('.jpeg')) return '.jpg'
 if(clean.endsWith('.png')) return '.png'
 return null
}
function getExtFromMimetype(mime, gifPlayback){
 if(gifPlayback) return '.mp4'
 if(!mime) return '.jpg'
 if(mime.includes('gif')) return '.gif'
 if(mime.includes('mp4') || mime.includes('video')) return '.mp4'
 if(mime.includes('webp')) return '.webp'
 if(mime.includes('png')) return '.png'
 return '.jpg'
}
function getMsgContent(msg){
 if(!msg) return null
 // Desarma viewOnce / viewOnceV2 / documentWithCaption
 if(msg.viewOnceMessage) return getMsgContent(msg.viewOnceMessage.message)
 if(msg.viewOnceMessageV2) return getMsgContent(msg.viewOnceMessageV2.message)
 if(msg.viewOnceMessageV2Extension) return getMsgContent(msg.viewOnceMessageV2Extension.message)
 if(msg.documentWithCaptionMessage) return getMsgContent(msg.documentWithCaptionMessage.message)
 return msg
}

handler.exec = async (sock, m, args) => {
 const jid = m.key.remoteJid

 // ===== VERIFICACION - LEE config.js bot.owner =====
 let rawSender = m.key.participant || m.key.remoteJid || ''
 let senderNum = String(rawSender).split('@')[0].split(':')[0].replace(/\D/g,'')
 let botNum = String(sock.principalNumber || sock.subNumber || sock?.user?.id?.split(':')[0] || '').replace(/\D/g,'')

 if (rawSender.includes('@lid') && jid.endsWith('@g.us')) {
 try {
 const meta = await sock.groupMetadata(jid)
 const p = meta.participants.find(x => x.id === rawSender || x.lid === rawSender)
 if (p?.jid) senderNum = String(p.jid).split('@')[0].split(':')[0].replace(/\D/g,'')
 else if (p?.phoneNumber) senderNum = String(p.phoneNumber).replace(/\D/g,'')
 } catch {}
 }

 const ownersRaw = [
 ...(config?.bot?.owner || []),
 ...(global.owner || []),
 ...(config?.owner || []),
 ]
 const ownersNum = ownersRaw.map(n => String(n).split('@')[0].split(':')[0].replace(/\D/g,''))
 const ownersLid = ownersRaw.map(n => String(n))

 const isBotMismo = senderNum === botNum || m.key.fromMe === true
 const isOwner = ownersNum.includes(senderNum) || ownersLid.includes(rawSender) || ownersLid.includes(senderNum + '@lid')

 if (!isBotMismo && !isOwner) {
 return sock.sendMessage(jid, { text: '⛔ Solo el dueño del bot puede cambiar el banner.' }, { quoted: m })
 }

 let url = args[0]?.trim()
 let buffer = null
 let ext = '.jpg'
 let tipo = 'foto'

 try{
 const {downloadMediaMessage} = await import('baileys')
 // 1. Mensaje directo: foto / video / gif / documento
 let content = getMsgContent(m.message)
 let direct = content?.imageMessage || content?.videoMessage || content?.documentMessage

 // 2. Si no hay directo, busca citado
 let quoted = null
 let quotedContent = null
 if(!direct){
 const ctx = m.message?.extendedTextMessage?.contextInfo || content?.extendedTextMessage?.contextInfo
 if(ctx?.quotedMessage){
 quotedContent = getMsgContent(ctx.quotedMessage)
 quoted = { message: ctx.quotedMessage, key: { remoteJid: jid, id: ctx.stanzaId, participant: ctx.participant } }
 direct = quotedContent?.imageMessage || quotedContent?.videoMessage || quotedContent?.documentMessage
 }
 }

 if(direct){
 let msgToDownload = quoted || m
 // Si es citado, hay que armar el objeto como lo espera downloadMediaMessage
 if(quoted){
 // Baileys necesita el quotedMessage completo
 msgToDownload = { key: quoted.key, message: { ...quotedContent, ...(quotedContent?.imageMessage ? {imageMessage: quotedContent.imageMessage} : {}), ...(quotedContent?.videoMessage ? {videoMessage: quotedContent.videoMessage} : {}), ...(quotedContent?.documentMessage ? {documentMessage: quotedContent.documentMessage} : {}) } }
 // Forma mas simple que si funciona en la mayoria de bots:
 msgToDownload = { message: quotedContent, key: quoted.key }
 }
 try{
 buffer = await downloadMediaMessage(msgToDownload, 'buffer', {})
 }catch(e){
 // Fallback: intenta con el mensaje original
 try{ buffer = await downloadMediaMessage(m, 'buffer', {}) }catch(e2){ console.log('[SETBANNER] download fail', e2.message) }
 }
 if(direct.mimetype || direct.gifPlayback){
 ext = getExtFromMimetype(direct.mimetype, direct.gifPlayback)
 if(direct.videoMessage || direct.gifPlayback || ext === '.mp4' || ext === '.gif') tipo = direct.gifPlayback ? 'gif' : 'video'
 if(direct.documentMessage && (direct.mimetype?.includes('video') || direct.mimetype?.includes('gif'))) tipo = 'gif'
 }
 // Si es document con nombre .gif / .mp4
 if(direct.fileName){
 const e2 = getExtFromUrl(direct.fileName)
 if(e2){ ext = e2; if(e2 === '.gif') tipo = 'gif'; if(e2 === '.mp4') tipo = 'video' }
 }
 }
 }catch(e){ console.log('[SETBANNER]', e) }

 let bannerToSave = ''
 // Si paso link, tiene prioridad si no hay buffer, o si el link es gif/video
 if(url && !buffer){
 // Link directo .gif / .mp4 / .webp / .jpg / .png
 if(url.startsWith('http')){
 bannerToSave = url
 const e = getExtFromUrl(url)
 if(e === '.gif') tipo = 'gif'
 else if(e === '.mp4') tipo = 'video'
 else if(e === '.webp') tipo = 'gif'
 else tipo = 'foto'
 } else {
 return sock.sendMessage(jid, {text:'❌ Ese link no es válido. Tiene que empezar con https://'}, {quoted:m})
 }
 }

 if(buffer){
 const dir = path.join(process.cwd(), 'db')
 if(!fs.existsSync(dir)) fs.mkdirSync(dir, {recursive:true})
 let numTmp = sock.principalNumber || sock.subNumber || sock?.user?.id?.split(':')[0]?.replace(/\D/g,'') || 'main'
 // Guarda con la extension correcta: .jpg / .png / .gif / .mp4 / .webp
 const filePath = path.join(dir, `banner_${numTmp}${ext}`)
 fs.writeFileSync(filePath, buffer)
 bannerToSave = filePath
 }

 if(!bannerToSave) return sock.sendMessage(jid, {text:'❌ Usa:\n• `.setbanner <link>`\n• Manda una foto / video / gif con caption `.setbanner`\n• Responde a una foto / video / gif con `.setbanner`'}, {quoted:m})

 let num = sock.principalNumber || sock.subNumber || sock?.user?.id?.split(':')[0]?.split('@')[0]?.replace(/\D/g,'') || ''
 num = String(num).replace(/\D/g,'')

 if(sock.isPrincipal){
 savePrincipalConfig(num, { banner: bannerToSave })
 const pri = getPrincipals().get(num)
 if(pri) pri.config.banner = bannerToSave
 } else if(sock.isSubBot){
 saveSubConfig(num, { banner: bannerToSave })
 const sub = getSubs().get(num)
 if(sub) sub.config.banner = bannerToSave
 } else {
 savePrincipalConfig(num, { banner: bannerToSave })
 }
 if(sock.subConfig) sock.subConfig.banner = bannerToSave
 if(sock.principalConfig) sock.principalConfig.banner = bannerToSave

 let emoji = tipo === 'gif' ? '🎞️' : tipo === 'video' ? '🎥' : '🌱'
 let textoTipo = tipo === 'gif' ? 'GIF' : tipo === 'video' ? 'Video' : 'Foto'
 await sock.sendMessage(jid, {text:`${emoji} Banner cambiado y guardado como ${textoTipo}\n📁 ${bannerToSave}\n\nAhora usa .menu para verlo`}, {quoted:m})
}
export default handler
