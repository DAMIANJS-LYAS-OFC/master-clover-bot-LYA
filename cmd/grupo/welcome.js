export const handler = {}
handler.name = 'welcome'
handler.alias = ['bienvenida']
handler.category = 'admin'
handler.description = 'Prender/apagar Welcome'
handler.group = true
handler.exec = async (sock, m, args, extra) => {
 const chatId = m.key.remoteJid || extra?.jid
 if (!chatId.endsWith('@g.us')) return sock.sendMessage(chatId, { text: `❌ Solo en grupos` }, { quoted: m })
 let metadata = await sock.groupMetadata(chatId)
 let senderIds = [m.key.participant, m.key.participantAlt, m.participant, m.sender].filter(Boolean)
 let senderP = metadata.participants.find(p => senderIds.includes(p.id) || senderIds.includes(p.lid) || senderIds.includes(p.phoneNumber))
 let isSenderAdmin = senderP && (senderP.admin === 'admin' || senderP.admin === 'superadmin')
 if (!isSenderAdmin) return sock.sendMessage(chatId, { text: `《✧》 Solo admins pueden cambiar el Welcome.` }, { quoted: m })
 let db = global.db?.data || {}
 if (!db.chats) db.chats = {}
 if (!db.chats[chatId]) db.chats[chatId] = {}
 if (typeof db.chats[chatId].welcome === 'undefined') db.chats[chatId].welcome = true
 let text = args.join(' ').toLowerCase()
 let isEnable = text.includes('on') || text.includes('encender') || text.includes('enable') || text.includes('activar')
 let isDisable = text.includes('off') || text.includes('apagar') || text.includes('disable') || text.includes('desactivar')
 if (!isEnable && !isDisable) {
 db.chats[chatId].welcome = !db.chats[chatId].welcome
 extra?.saveDB?.(); global.saveDB?.()
 return sock.sendMessage(chatId, { text: `👋 Welcome ${db.chats[chatId].welcome ? 'ACTIVADO ✅' : 'DESACTIVADO ❌'}` }, { quoted: m })
 }
 db.chats[chatId].welcome = isEnable
 extra?.saveDB?.(); global.saveDB?.()
 return sock.sendMessage(chatId, { text: `👋 Welcome ${isEnable ? 'ACTIVADO ✅' : 'DESACTIVADO ❌'}` }, { quoted: m })
}
