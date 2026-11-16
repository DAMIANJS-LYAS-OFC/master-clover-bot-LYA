export const handler = {}
handler.name = 'antispam'
handler.alias = ['antispam']
handler.category = 'admin'
handler.description = 'Prender/apagar Antispam'
handler.group = true
handler.exec = async (sock, m, args, extra) => {
 const chatId = m.key.remoteJid || extra?.jid
 if (!chatId.endsWith('@g.us')) return sock.sendMessage(chatId, { text: `❌ Solo en grupos` }, { quoted: m })
 let metadata = await sock.groupMetadata(chatId)
 let senderIds = [m.key.participant, m.key.participantAlt, m.participant, m.sender].filter(Boolean)
 let senderP = metadata.participants.find(p => senderIds.includes(p.id) || senderIds.includes(p.lid) || senderIds.includes(p.phoneNumber))
 let isSenderAdmin = senderP && (senderP.admin === 'admin' || senderP.admin === 'superadmin')
 if (!isSenderAdmin) return sock.sendMessage(chatId, { text: `《✧》 Solo admins pueden activar/desactivar el Antispam.` }, { quoted: m })
 let db = global.db?.data || {}
 if (!db.chats) db.chats = {}
 if (!db.chats[chatId]) db.chats[chatId] = {}
 if (typeof db.chats[chatId].antispam === 'undefined') db.chats[chatId].antispam = false
 const text = (args.join(' ').toLowerCase() + ' ' + (m.message?.conversation||'').toLowerCase())
 const isEnable = text.includes('enable') || text.includes('on') || text.includes('encender')
 const isDisable = text.includes('disable') || text.includes('off') || text.includes('apagar')
 // AHORA SI: si mandas solo .antispam, hace TOGGLE
 if (!isEnable && !isDisable) {
 db.chats[chatId].antispam = !db.chats[chatId].antispam
 extra?.saveDB?.(); global.saveDB?.()
 return sock.sendMessage(chatId, { text: `🛡️ Antispam ${db.chats[chatId].antispam ? 'ACTIVADO ✅' : 'DESACTIVADO ❌'}` }, { quoted: m })
 }
 db.chats[chatId].antispam = isEnable
 extra?.saveDB?.(); global.saveDB?.()
 return sock.sendMessage(chatId, { text: `🛡️ Antispam ${isEnable ? 'ACTIVADO ✅' : 'DESACTIVADO ❌'}` }, { quoted: m })
}
