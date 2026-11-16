export const handler = {}
handler.name = 'mutelist'
handler.alias = ['mutelist']
handler.category = 'admin'
handler.description = 'Ver muteados del grupo'
handler.group = true

handler.exec = async (sock, m, args, extra) => {
 const chatId = m.key.remoteJid || extra?.jid
 if (!chatId.endsWith('@g.us')) return sock.sendMessage(chatId, { text: `❌ Solo en grupos` }, { quoted: m })

 // --- VERIFICACION ADMIN IGUAL QUE KICK ---
 let metadata = await sock.groupMetadata(chatId)
 let senderIds = [m.key.participant, m.key.participantAlt, m.participant, m.sender].filter(Boolean)
 let senderP = metadata.participants.find(p =>
 senderIds.includes(p.id) || senderIds.includes(p.lid) || senderIds.includes(p.phoneNumber)
 )
 let isSenderAdmin = senderP && (senderP.admin === 'admin' || senderP.admin === 'superadmin')

 if (!isSenderAdmin) {
 return sock.sendMessage(chatId, { text: `《✧》 Solo admins pueden ver la lista.` }, { quoted: m })
 }
 // --- FIN VERIFICACION ---

 let db = global.db?.data || {}
 if (!db.chats) db.chats = {}
 if (!db.chats[chatId]) db.chats[chatId] = {}
 if (!db.chats[chatId].mutedUsers) db.chats[chatId].mutedUsers = []

 let list = db.chats[chatId].mutedUsers
 if (!list.length) return sock.sendMessage(chatId, { text: `🔊 *Mutelist*\n\nNadie está muteado en este grupo.` }, { quoted: m })

 let txt = `🔇 *Mutelist - ${metadata.subject}*\n\n`
 txt += list.map((u, i) => `${i+1}. @${u.split('@')[0]}`).join('\n')
 txt += `\n\nTotal: *${list.length}*`
 return sock.sendMessage(chatId, { text: txt, mentions: list }, { quoted: m })
}
