import fs from 'fs'
let clean = s => String(s||'').split('@')[0].split(':')[0].replace(/\D/g,'')

function normJid(p) {
 if (!p) return null
 if (typeof p === 'string') return p
 return p.id || p.jid || p.participant || p.user || p.lid || null
}

// ================= WELCOME / BYE =================
export const DEFAULT_WELCOME = `ㅤ ─̷̸─꯭━─̷̸─꯭━────────꯭━─̷̸─꯭━─̷̸

ㅤㅤㅤ⠟ ׂ ⭐⃞፝֟͝ꭷ ׂ 𝙒𝙀𝙇𝘾𝙊𝙈𝙀
 𝙐𝙎𝙀𝙍
❏ *Bienvenido/a* › $user
❐ *Grupo* › $grupo
❐ *Bot ›* $bot
❐ *usuarios ›* $miembros

> ↻ Disfruta tu estadia

ㅤ ─̷̸─꯭━─̷̸─꯭━────────꯭━─̷̸─꯭━─̷̸`

export const DEFAULT_BYE = `ㅤ ─̷̸─꯭━─̷̸─꯭━────────꯭━─̷̸─꯭━─̷̸

ㅤㅤㅤ⠟ ׂ ⭐⃞፝֟͝ꭷ ׂ 𝘽𝙔𝙀
 𝙐𝙎𝙀𝙍
❏ *Se fue* › $user
❐ *Grupo* › $grupo
❐ *Bot ›* $bot
❐ *usuarios ›* $miembros

> ↻ Que te vaya bien

ㅤ ─̷̸─꯭━─̷̸─꯭━────────꯭━─̷̸─꯭━─̷̸`

export function replaceWelcomeVars(text, data) {
 let now = new Date()
 return String(text || '')
 .replaceAll('$user', `@${data.userClean}`)
 .replaceAll('$usuario', `@${data.userClean}`)
 .replaceAll('$grupo', data.groupName || 'Grupo')
 .replaceAll('$descripcion', data.groupDesc || 'Sin descripción')
 .replaceAll('$desc', data.groupDesc || 'Sin descripción')
 .replaceAll('$bot', data.botName || 'MASTER CLOVER')
 .replaceAll('$miembros', String(data.members || 0))
 .replaceAll('$usuarios', String(data.members || 0))
 .replaceAll('$fecha', now.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' }))
 .replaceAll('$hora', now.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }))
}

async function getBotName(sock) {
 let botName = 'MASTER CLOVER'
 try {
 let config = (await import('../config.js').catch(() => null))?.default
 if (config?.bot?.name) botName = config.bot.name
 } catch {}
 if (sock.subConfig?.name) botName = sock.subConfig.name
 if (sock.principalConfig?.name) botName = sock.principalConfig.name
 return botName
}

async function getBotBanner(sock) {
 let botBanner = null
 try {
 let config = (await import('../config.js').catch(() => null))?.default
 botBanner = config?.bot?.banner || config?.bot?.foto || null
 } catch {}
 if (sock.subConfig?.banner) botBanner = sock.subConfig.banner
 if (sock.principalConfig?.banner) botBanner = sock.principalConfig.banner
 return botBanner
}

async function sendWelcomeBye(sock, chatId, userJid, template, metadata, botName) {
 let userClean = String(userJid).split('@')[0].split(':')[0].replace(/\D/g, '')
 let text = replaceWelcomeVars(template, {
 userClean,
 groupName: metadata?.subject || 'Grupo',
 groupDesc: metadata?.desc || '',
 botName,
 members: metadata?.participants?.length || 0
 })
 let mentions = [userJid]
 console.log('[WELCOME DEBUG] mandando welcome/bye a', userClean, 'en', chatId)
 try {
 let pfp = await sock.profilePictureUrl(userJid, 'image').catch(() => null)
 if (pfp) {
 await sock.sendMessage(chatId, { image: { url: pfp }, caption: text, mentions })
 console.log('[WELCOME DEBUG] enviado con foto')
 return
 }
 } catch (e) { console.log('[WELCOME DEBUG] foto fallo, mando texto', e.message) }
 try {
 let botBanner = await getBotBanner(sock)
 if (botBanner) {
 let isLocal = fs.existsSync(botBanner)
 let media = isLocal ? fs.readFileSync(botBanner) : { url: botBanner }
 await sock.sendMessage(chatId, { image: media, caption: text, mentions })
 console.log('[WELCOME DEBUG] enviado con banner')
 return
 }
 } catch (e) { console.log('[WELCOME DEBUG] banner fallo', e.message) }
 await sock.sendMessage(chatId, { text, mentions })
 console.log('[WELCOME DEBUG] enviado solo texto')
}

export async function handleWelcome(sock, update) {
 try {
 console.log('[WELCOME DEBUG] handleWelcome llamado', JSON.stringify(update))
 let chatId = update.id
 if (!chatId?.endsWith('@g.us')) return console.log('[WELCOME DEBUG] no es grupo, es', chatId)
 if (update.action !== 'add') return console.log('[WELCOME DEBUG] no es add, es', update.action)
 let db = global.db?.data || {}
 if (!db.chats) db.chats = {}
 if (!db.chats[chatId]) db.chats[chatId] = {}
 let chat = db.chats[chatId]
 if (chat.welcome === false) return console.log('[WELCOME DEBUG] welcome apagado en DB')
 let metadata = await sock.groupMetadata(chatId).catch(e => { console.log('[WELCOME DEBUG] groupMetadata fallo', e.message); return null })
 if (!metadata) metadata = { subject: 'Grupo', participants: [] }
 let botName = await getBotName(sock)
 for (let userJid of update.participants || []) {
 await sendWelcomeBye(sock, chatId, userJid, chat.welcomeText || DEFAULT_WELCOME, metadata, botName)
 }
 console.log('[WELCOME DEBUG] welcome terminado')
 } catch (e) { console.log('[WELCOME DEBUG] error welcome', e) }
}

export async function handleBye(sock, update) {
 try {
 console.log('[BYE DEBUG] handleBye llamado', JSON.stringify(update))
 let chatId = update.id
 if (!chatId?.endsWith('@g.us')) return console.log('[BYE DEBUG] no es grupo')
 if (update.action !== 'remove' && update.action !== 'leave') return console.log('[BYE DEBUG] no es remove/leave, es', update.action)
 let db = global.db?.data || {}
 if (!db.chats) db.chats = {}
 if (!db.chats[chatId]) db.chats[chatId] = {}
 let chat = db.chats[chatId]
 if (chat.bye === false) return console.log('[BYE DEBUG] bye apagado en DB')
 let metadata = await sock.groupMetadata(chatId).catch(e => { console.log('[BYE DEBUG] groupMetadata fallo', e.message); return null })
 if (!metadata) metadata = { subject: 'Grupo', participants: [] }
 let botName = await getBotName(sock)
 for (let userJid of update.participants || []) {
 await sendWelcomeBye(sock, chatId, userJid, chat.byeText || DEFAULT_BYE, metadata, botName)
 }
 console.log('[BYE DEBUG] bye terminado')
 } catch (e) { console.log('[BYE DEBUG] error bye', e) }
}

export async function handleGroupParticipants(sock, update) {
 console.log('[WELCOME DEBUG] handleGroupParticipants', JSON.stringify(update))
 if (Array.isArray(update.participants)) {
 update.participants = update.participants.map(normJid).filter(Boolean)
 console.log('[WELCOME DEBUG] participants normalizados:', update.participants)
 }
 await handleWelcome(sock, update)
 await handleBye(sock, update)
}

// ================= ANTISPAM / ANTILINK / MUTE =================
let primaryCache = { data: {}, time: 0 }
function loadPrimary() {
 if (Date.now() - primaryCache.time < 5000) return primaryCache.data
 try {
 if (fs.existsSync('./db/primary.json')) primaryCache = { data: JSON.parse(fs.readFileSync('./db/primary.json','utf-8')), time: Date.now() }
 else primaryCache = { data: {}, time: Date.now() }
 } catch { primaryCache = { data: {}, time: Date.now() } }
 return primaryCache.data
}
let spamMap = new Map()
function isSpam(chatId, senderClean, text) {
 let key = chatId + ':' + senderClean
 let now = Date.now()
 let arr = (spamMap.get(key) || []).filter(x => now - x.time < 10000)
 arr.push({ time: now, text: text.slice(0,100) })
 spamMap.set(key, arr)
 if (arr.length >= 6) { spamMap.set(key, []); return 'flood' }
 if (arr.filter(x => x.text === text.slice(0,100)).length >= 4) { spamMap.set(key, []); return 'repetido' }
 return null
}
export async function handleEventos(sock, m, body, extra) {
 try {
 let chatId = m.key.remoteJid || extra?.jid
 if (!chatId || !chatId.endsWith('@g.us')) return false
 let myClean = clean(sock.user?.id || '')
 let primaryData = loadPrimary()
 let primaryForGroup = primaryData[chatId]
 let textEarly = body || ''
 let isSetPrimaryCmd = /^\.(setprimary|setbot|primary)/i.test(textEarly.trim())
 if (primaryForGroup && !isSetPrimaryCmd) {
 let primaryClean = clean(primaryForGroup)
 if (primaryClean && myClean && primaryClean !== myClean) return true
 }
 let db = global.db?.data || {}
 if (!db.chats) db.chats = {}
 if (!db.chats[chatId]) db.chats[chatId] = {}
 let chat = db.chats[chatId]
 if (typeof chat.antilink === 'undefined') chat.antilink = false
 if (typeof chat.antispam === 'undefined') chat.antispam = false
 if (!chat.mutedUsers) chat.mutedUsers = []
 if (!chat.warns) chat.warns = {}
 let mutedList = [...(chat.mutedUsers||[]), ...(chat.muted||[]), ...(chat.mute||[])]
 let metadata = await sock.groupMetadata(chatId).catch(()=>null)
 if (!metadata) return false
 let sender = m.key.participant || m.key.participantAlt || m.participant || m.sender || extra?.senderJid
 let senderClean = clean(sender)
 let senderP = metadata.participants.find(p => clean(p.id) === senderClean || clean(p.lid) === senderClean || clean(p.phoneNumber) === senderClean)
 let senderIds = new Set([clean(sender), clean(senderP?.id), clean(senderP?.lid), clean(senderP?.phoneNumber)].filter(Boolean))
 if (senderP?.phoneNumber) senderClean = clean(senderP.phoneNumber)
 let isAdmin = senderP && (senderP.admin === 'admin' || senderP.admin === 'superadmin')
 let msgType = Object.keys(m.message || {})[0] || ''
 let text = body || ''
 if (!text) {
 if (msgType === 'stickerMessage') text = '[STICKER]'
 else if (msgType === 'imageMessage') text = '[IMAGEN]'
 else if (msgType === 'videoMessage') text = '[VIDEO]'
 else if (msgType === 'audioMessage') text = '[AUDIO]'
 else if (msgType) text = '[' + msgType.toUpperCase() + ']'
 }
 let isAdminCmd = /^\.(mute|unmute|mutelist|antilink|antispam|kick|nsfw|setprimary|warn|unwarn|warns|welcome|setwelcome|bye|setbye)/i.test(text.trim())
 async function borrar(msgKey, senderJid) {
 let r1 = await sock.sendMessage(chatId, { delete: msgKey }).catch(()=>null)
 if (r1) return true
 let key2 = { remoteJid: chatId, fromMe: false, id: msgKey.id, participant: senderJid }
 let r2 = await sock.sendMessage(chatId, { delete: key2 }).catch(()=>null)
 if (r2) return true
 let key3 = { remoteJid: chatId, fromMe: false, id: msgKey.id, participant: msgKey.participantAlt || msgKey.participant }
 let r3 = await sock.sendMessage(chatId, { delete: key3 }).catch(()=>null)
 return !!r3
 }
 async function darWarnAntispam(motivo) {
 let cur = (chat.warns[senderClean] || 0) + 1
 chat.warns[senderClean] = cur
 if (global.saveDB) global.saveDB()
 if (cur >= 4) {
 delete chat.warns[senderClean]
 if (global.saveDB) global.saveDB()
 await sock.sendMessage(chatId, { text: `🚫 *EXPULSADO POR SPAM*\n\n@${senderClean} ya tenía 3 advertencias y siguió con spam.\nFue sacado del grupo.`, mentions: [sender] })
 await sock.groupParticipantsUpdate(chatId, [sender], 'remove').catch(()=>{})
 return true
 }
 await sock.sendMessage(chatId, { text: `⚠️ *ADVERTENCIA ${cur}/3 - ANTISPAM*\n\n@${senderClean} no hagas spam (${motivo}).\nA la 3ra advertencia te saco.\nLlevas: ${cur}/3`, mentions: [sender] })
 return false
 }
 let isMuted = mutedList.some(u => senderIds.has(clean(u)))
 if (isMuted && !isAdminCmd) { await borrar(m.key, sender); return true }
 if (chat.antispam && !isAdminCmd) {
 let spamTipo = isSpam(chatId, senderClean, text)
 if (spamTipo) {
 await borrar(m.key, sender)
 await darWarnAntispam(spamTipo)
 return true
 }
 }
 let hasLink = /(chat\.whatsapp\.com\/|whatsapp\.com\/(channel|community|group)\/)/i.test(text)
 if (text.includes('locos-y-asociados-cdn.onrender.com')) hasLink = false
 if (chat.antilink && hasLink && !isAdmin && !isAdminCmd) {
 await borrar(m.key, sender)
 await sock.sendMessage(chatId, { text: `🔗 *ANTILINK*\n\n@${senderClean} mandó un link de canal / grupo / comunidad y fue eliminado.`, mentions: [sender] })
 await sock.groupParticipantsUpdate(chatId, [sender], 'remove').catch(()=>{})
 return true
 }
 return false
 } catch(e) { console.log('eventos error', e); return false }
}
