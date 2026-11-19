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
handler.name = 'seticon'
handler.category = 'subbots'

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
 return sock.sendMessage(jid, { text: '⛔ Solo el dueño del bot puede cambiar el icon.' }, { quoted: m })
 }

 let url = args[0]?.trim()
 let buffer = null
 try{
 if(m.message?.imageMessage){
 const {downloadMediaMessage} = await import('baileys')
 buffer = await downloadMediaMessage(m, 'buffer', {})
 } else if(m.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage){
 const {downloadMediaMessage} = await import('baileys')
 const qmsg = m.message.extendedTextMessage.contextInfo.quotedMessage
 const q = { message: qmsg, key: { remoteJid: jid, id: m.message.extendedTextMessage.contextInfo.stanzaId } }
 buffer = await downloadMediaMessage(q, 'buffer', {})
 }
 }catch(e){ console.log(e) }

 let iconToSave = url || ''
 if(buffer){
 const dir = path.join(process.cwd(), 'db', 'icon')
 if(!fs.existsSync(dir)) fs.mkdirSync(dir, {recursive:true})
 let numTmp = sock.principalNumber || sock.subNumber || sock?.user?.id?.split(':')[0]?.replace(/\D/g,'') || 'main'
 const filePath = path.join(dir, `${numTmp}.jpg`)
 fs.writeFileSync(filePath, buffer)
 iconToSave = filePath
 }
 if(!iconToSave) return sock.sendMessage(jid, {text:'❌ Usa .seticon <link> o responde a una foto'}, {quoted:m})

 let num = sock.principalNumber || sock.subNumber || sock?.user?.id?.split(':')[0]?.split('@')[0]?.replace(/\D/g,'') || ''
 num = String(num).replace(/\D/g,'')

 if(sock.isPrincipal){
 savePrincipalConfig(num, { icon: iconToSave })
 const pri = getPrincipals().get(num)
 if(pri) pri.config.icon = iconToSave
 } else if(sock.isSubBot){
 saveSubConfig(num, { icon: iconToSave })
 const sub = getSubs().get(num)
 if(sub) sub.config.icon = iconToSave
 } else {
 savePrincipalConfig(num, { icon: iconToSave })
 }
 if(sock.subConfig) sock.subConfig.icon = iconToSave
 if(sock.principalConfig) sock.principalConfig.icon = iconToSave
 await sock.sendMessage(jid, {text:`🌱 Icon cambiado y guardado en db/icon/${num}.jpg`}, {quoted:m})
}
export default handler
