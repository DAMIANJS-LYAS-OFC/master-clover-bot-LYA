export const handler = {}
handler.name = 'mute'
handler.alias = ['mute']
handler.category = 'admin'
handler.description = 'Mutear a un usuario'
handler.group = true
handler.exec = async (sock, m, args, extra) => {
 const chatId = m.key.remoteJid || extra?.jid
 if (!chatId.endsWith('@g.us')) return sock.sendMessage(chatId, { text: `❌ Solo en grupos` }, { quoted: m })
 let metadata = await sock.groupMetadata(chatId)
 let senderIds = [m.key.participant, m.key.participantAlt, m.participant, m.sender].filter(Boolean)
 let senderP = metadata.participants.find(p => senderIds.includes(p.id) || senderIds.includes(p.lid) || senderIds.includes(p.phoneNumber))
 let isSenderAdmin = senderP && (senderP.admin === 'admin' || senderP.admin === 'superadmin')
 if (!isSenderAdmin) return sock.sendMessage(chatId, { text: `《✧》 Solo admins pueden mutear.` }, { quoted: m })
 let db = global.db?.data || {}
 if (!db.chats) db.chats = {}
 if (!db.chats[chatId]) db.chats[chatId] = {}
 if (!db.chats[chatId].mutedUsers) db.chats[chatId].mutedUsers = []
 let target = null
 let mentioned = m.message?.extendedTextMessage?.contextInfo?.mentionedJid
 if (mentioned?.length) target = mentioned[0]
 if (!target) { let quoted = m.message?.extendedTextMessage?.contextInfo?.participant; if (quoted) target = quoted }
 if (!target && args[0]) { let num = args[0].replace(/[^0-9]/g, ''); if (num) target = num + '@s.whatsapp.net' }
 if (!target) return sock.sendMessage(chatId, { text: `🔇 *Mute*\n\nUso:\n• *.mute @usuario*` }, { quoted: m })
 let targetP = metadata.participants.find(p => p.id === target || p.lid === target || p.phoneNumber === target)
 let isTargetAdmin = targetP && (targetP.admin === 'admin' || targetP.admin === 'superadmin')
 if (isTargetAdmin) return sock.sendMessage(chatId, { text: `❌ No puedes mutear a un admin.` }, { quoted: m })
 // GUARDA LOS 3 IDS: id, lid y telefono, para que el eventos siempre lo encuentre
 let clean = s => String(s||'').split('@')[0].split(':')[0].replace(/\D/g,'')
 let toSave = []
 if (targetP) { if (targetP.id) toSave.push(targetP.id); if (targetP.lid) toSave.push(targetP.lid); if (targetP.phoneNumber) toSave.push(targetP.phoneNumber) }
 else toSave.push(target)
 let ya = db.chats[chatId].mutedUsers.some(u => toSave.some(t => clean(u) === clean(t)))
 if (ya) return sock.sendMessage(chatId, { text: `⚠️ @${clean(target)} ya está muteado.`, mentions: [target] }, { quoted: m })
 db.chats[chatId].mutedUsers.push(...toSave)
 extra?.saveDB?.(); global.saveDB?.()
 return sock.sendMessage(chatId, { text: `🔇 *MUTEADO*\n\n@${clean(target)} fue muteado.`, mentions: [target] }, { quoted: m })
}
