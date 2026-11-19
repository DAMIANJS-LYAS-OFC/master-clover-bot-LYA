import fs from 'fs'
import path from 'path'
import config from '../../config.js'
import { saveSubConfig, getSubs } from '../../lib/jadi.js'
import { savePrincipalConfig, getPrincipals } from '../../lib/principals.js'

export const handler = {}
handler.name = 'setname'
handler.alias = ['setbotname', 'cambiarnombre']
handler.category = 'subbots'

// ===== MISMO CANDADO QUE setmenu =====
function getOwners(){ return (config?.bot?.owner||[]).map(n=>String(n).split('@')[0].replace(/\D/g,'')).filter(Boolean) }
function cleanId(v){ return String(v||'').split('@')[0].split(':')[0].replace(/\D/g,'') }
function getBotNum(sock){ return cleanId(sock?.user?.id?.split(':')[0] || sock?.principalNumber || sock?.subNumber || '') }
function getSender(sock,m){
 if(m.key?.fromMe) return getBotNum(sock)
 if(m.key?.remoteJid?.endsWith('@g.us')) return cleanId(m.key?.participant || '')
 return cleanId(m.key?.participant || m.key?.remoteJid || '')
}

handler.exec = async (sock, m, args) => {
 const jid = m.key.remoteJid

 // ===== VERIFICACION =====
 let botNum = getBotNum(sock)
 let sender = getSender(sock,m)
 let owners = getOwners()
 let botLid = cleanId(sock?.user?.lid || '')
 let isOwner = owners.includes(sender)
 let isMismoBot = sender === botNum || (botLid && sender === botLid)

 // Si es LID, intentar resolverlo con el grupo como hace setmenu
 if (!isOwner && !isMismoBot && m.key?.participant?.includes('@lid') && jid.endsWith('@g.us')) {
 try {
 const meta = await sock.groupMetadata(jid)
 const p = meta.participants.find(x => x.id === m.key.participant || x.lid === m.key.participant)
 if (p?.jid) {
 let real = cleanId(p.jid)
 if (owners.includes(real) || real === botNum) { isOwner = true; isMismoBot = true }
 } else if (p?.phoneNumber) {
 let real = cleanId(p.phoneNumber)
 if (owners.includes(real) || real === botNum) { isOwner = true; isMismoBot = true }
 }
 } catch {}
 }

 if(!isOwner && !isMismoBot){
 return sock.sendMessage(jid,{text:`⚠️ Solo el mismo bot o el owner puede cambiar el nombre`},{quoted:m})
 }
 // ===== FIN VERIFICACION =====

 const text = args.join(' ').trim()
 if(!text) return sock.sendMessage(jid, { text:'❌ Usa: .setname Nuevo Nombre' }, { quoted:m })

 const esSubBot = sock.isSubBot === true
 const esPrincipal = sock.isPrincipal === true
 let num = sock.principalNumber || sock.subNumber || sock?.user?.id?.split(':')[0]?.replace(/\D/g,'') || ''
 num = String(num).replace(/\D/g,'')

 const tipo = esSubBot ? 'SUBBOT 🤖' : 'PRINCIPAL 👑'

 if(esSubBot){
 saveSubConfig(num, { name: text, botName: text })
 if(sock.subConfig){ sock.subConfig.name = text; sock.subConfig.botName = text }
 const sub = getSubs().get(num)
 if(sub){ sub.config.name = text; sub.config.botName = text }
 } else if(esPrincipal){
 savePrincipalConfig(num, { name: text, botName: text })
 if(sock.principalConfig){ sock.principalConfig.name = text; sock.principalConfig.botName = text }
 if(sock.subConfig){ sock.subConfig.name = text; sock.subConfig.botName = text }
 const pri = getPrincipals().get(num)
 if(pri){ pri.config.name = text; pri.config.botName = text }
 } else {
 global.botName = text
 }

 await sock.sendMessage(jid, { text:`⭐ Nombre cambiado correctamente ahora el bot se llamara: *${text}*\n📌 Tipo: ${tipo}` }, { quoted:m })
}
export default handler
