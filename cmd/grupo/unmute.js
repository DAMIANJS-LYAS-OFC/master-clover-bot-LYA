export const handler = {}
handler.name = 'unmute'
handler.alias = ['unmute']
handler.category = 'admin'
handler.description = 'Desmutear a un usuario'
handler.group = true
handler.exec = async (sock, m, args, extra) => {
 const chatId = m.key.remoteJid || extra?.jid
 if (!chatId.endsWith('@g.us')) return sock.sendMessage(chatId, { text: `❌ Solo en grupos` }, { quoted: m })
 let metadata = await sock.groupMetadata(chatId)
 let senderIds = [m.key.participant, m.key.participantAlt, m.participant, m.sender].filter(Boolean)
 let senderP = metadata.participants.find(p => senderIds.includes(p.id) || senderIds.includes(p.lid) || senderIds.includes(p.phoneNumber))
 let isSenderAdmin = senderP && (senderP.admin === 'admin' || senderP.admin === 'superadmin')
 if (!isSenderAdmin) return sock.sendMessage(chatId, { text: `《✧》 Solo admins pueden desmutear.` }, { quoted: m })
 let db = global.db?.data || {}
 if (!db.chats) db.chats = {}
 if (!db.chats[chatId]) db.chats[chatId] = {}
 if (!db.chats[chatId].mutedUsers) db.chats[chatId].mutedUsers = []
 let target = null
 let mentioned = m.message?.extendedTextMessage?.contextInfo?.mentionedJid
 if (mentioned?.length) target = mentioned[0]
 if (!target) { let quoted = m.message?.extendedTextMessage?.contextInfo?.participant; if (quoted) target = quoted }
 if (!target && args[0]) { let num = args[0].replace(/[^0-9]/g, ''); if (num) target = num + '@s.whatsapp.net' }
 if (!target) return sock.sendMessage(chatId, { text: `🔊 *Unmute*\n\nUso: *.unmute @usuario*` }, { quoted: m })
 let clean = s => String(s||'').split('@')[0].split(':')[0].replace(/\D/g,'')
 // TODAS LAS FORMAS DEL TARGET: id, lid, telefono
 let targetP = metadata.participants.find(p => p.id === target || p.lid === target || p.phoneNumber === target || clean(p.id) === clean(target) || clean(p.lid) === clean(target) || clean(p.phoneNumber) === clean(target))
 let targetIds = new Set([clean(target), clean(targetP?.id), clean(targetP?.lid), clean(targetP?.phoneNumber)].filter(Boolean))
 let antes = db.chats[chatId].mutedUsers.length
 // BORRA CUALQUIERA QUE COINCIDA CON CUALQUIERA DE SUS IDS
 db.chats[chatId].mutedUsers = db.chats[chatId].mutedUsers.filter(u => !targetIds.has(clean(u)))
 extra?.saveDB?.(); global.saveDB?.()
 if (db.chats[chatId].mutedUsers.length === antes) return sock.sendMessage(chatId, { text: `⚠️ @${clean(target)} no estaba muteado. Lista: ${JSON.stringify(db.chats[chatId].mutedUsers)}`, mentions: [target] }, { quoted: m })
 return sock.sendMessage(chatId, { text: `🔊 *DESMUTEADO*\n\n@${clean(target)} ya puede hablar.`, mentions: [target] }, { quoted: m })
}
