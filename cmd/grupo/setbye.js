import { DEFAULT_BYE } from '../../core/eventos.js'
export const handler = {}
handler.name = 'setbye'
handler.alias = ['setdespedida', 'setgoodbye']
handler.category = 'admin'
handler.description = 'Cambiar texto de la Despedida'
handler.group = true
handler.exec = async (sock, m, args, extra) => {
 const chatId = m.key.remoteJid || extra?.jid
 if (!chatId.endsWith('@g.us')) return sock.sendMessage(chatId, { text: `❌ Solo en grupos` }, { quoted: m })
 let metadata = await sock.groupMetadata(chatId)
 let senderIds = [m.key.participant, m.key.participantAlt, m.participant, m.sender].filter(Boolean)
 let senderP = metadata.participants.find(p => senderIds.includes(p.id) || senderIds.includes(p.lid) || senderIds.includes(p.phoneNumber))
 let isSenderAdmin = senderP && (senderP.admin === 'admin' || senderP.admin === 'superadmin')
 if (!isSenderAdmin) return sock.sendMessage(chatId, { text: `《✧》 Solo admins pueden cambiar la Despedida.` }, { quoted: m })
 let full = m.message?.extendedTextMessage?.text || m.message?.conversation || args.join(' ')
 let newText = full.replace(/^\.setbye\s*/i, '').trim()
 let db = global.db?.data || {}
 if (!db.chats) db.chats = {}
 if (!db.chats[chatId]) db.chats[chatId] = {}
 if (!newText || newText.toLowerCase() === 'reset' || newText.toLowerCase() === 'default') {
 db.chats[chatId].byeText = DEFAULT_BYE
 extra?.saveDB?.(); global.saveDB?.()
 return sock.sendMessage(chatId, { text: `✅ Bye reseteado al de por defecto.\n\n${DEFAULT_BYE.replaceAll('$user', '@ejemplo')}` }, { quoted: m })
 }
 if (newText.toLowerCase() === 'ver' || newText.toLowerCase() === 'show') {
 let cur = db.chats[chatId].byeText || DEFAULT_BYE
 return sock.sendMessage(chatId, { text: `👋 *Bye actual:*\n\n${cur}` }, { quoted: m })
 }
 db.chats[chatId].byeText = newText
 if (typeof db.chats[chatId].bye === 'undefined') db.chats[chatId].bye = true
 extra?.saveDB?.(); global.saveDB?.()
 return sock.sendMessage(chatId, { text: `✅ *Bye actualizado*\n\nVariables:\n• $user - menciona al que se fue\n• $grupo - nombre del grupo\n• $descripcion - descripción del grupo\n• $bot - nombre del bot\n• $miembros - cantidad de miembros\n• $fecha - fecha\n• $hora - hora\n\n*Vista previa:*\n${newText.replaceAll('$user', '@' + (m.sender?.split('@')[0] || 'tu'))}` }, { quoted: m })
}
