export const handler = {}
handler.name = 'bye'
handler.alias = ['despedida', 'goodbye']
handler.category = 'admin'
handler.description = 'Prender/apagar Despedida'
handler.group = true
handler.exec = async (sock, m, args, extra) => {
 const chatId = m.key.remoteJid || extra?.jid
 if (!chatId.endsWith('@g.us')) return sock.sendMessage(chatId, { text: `❌ Solo en grupos` }, { quoted: m })
 let metadata = await sock.groupMetadata(chatId)
 let senderIds = [m.key.participant, m.key.participantAlt, m.participant, m.sender].filter(Boolean)
 let senderP = metadata.participants.find(p => senderIds.includes(p.id) || senderIds.includes(p.lid) || senderIds.includes(p.phoneNumber))
 let isSenderAdmin = senderP && (senderP.admin === 'admin' || senderP.admin === 'superadmin')
 if (!isSenderAdmin) return sock.sendMessage(chatId, { text: `《✧》 Solo admins pueden cambiar la Despedida.` }, { quoted: m })
 let db = global.db?.data || {}
 if (!db.chats) db.chats = {}
 if (!db.chats[chatId]) db.chats[chatId] = {}
 if (typeof db.chats[chatId].bye === 'undefined') db.chats[chatId].bye = true
 let text = args.join(' ').toLowerCase()
 let isEnable = text.includes('on') || text.includes('encender') || text.includes('enable') || text.includes('activar')
 let isDisable = text.includes('off') || text.includes('apagar') || text.includes('disable') || text.includes('desactivar')
 if (!isEnable && !isDisable) {
 db.chats[chatId].bye = !db.chats[chatId].bye
 extra?.saveDB?.(); global.saveDB?.()
 return sock.sendMessage(chatId, { text: `👋 Bye ${db.chats[chatId].bye ? 'ACTIVADO ✅' : 'DESACTIVADO ❌'}` }, { quoted: m })
 }
 db.chats[chatId].bye = isEnable
 extra?.saveDB?.(); global.saveDB?.()
 return sock.sendMessage(chatId, { text: `👋 Bye ${isEnable ? 'ACTIVADO ✅' : 'DESACTIVADO ❌'}` }, { quoted: m })
}
