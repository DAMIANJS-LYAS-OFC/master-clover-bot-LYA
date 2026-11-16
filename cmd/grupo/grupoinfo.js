import fs from 'fs'
import path from 'path'
import sharp from 'sharp'

export const handler = {}
handler.name = 'grupoinfo'
handler.alias = ['groupinfo', 'infogrupo', 'ginfo', 'info grupo']
handler.category = 'info'

handler.exec = async (sock, m, args) => {
 const chat = m.key.remoteJid
 if (!chat.endsWith('@g.us')) return sock.sendMessage(chat, { text: '❌ Este comando solo se usa en grupos' }, { quoted: m })

 let metadata = null
 try { metadata = await sock.groupMetadata(chat) } catch {}
 if (!metadata) return sock.sendMessage(chat, { text: '❌ No pude sacar la info del grupo' }, { quoted: m })

 let num = sock.principalNumber || sock.subNumber || sock?.user?.id?.split(':')[0]?.replace(/\D/g, '') || ''
 num = String(num).replace(/\D/g, '')

 const botName =
 sock.subConfig?.botName ||
 sock.subConfig?.name ||
 sock.principalConfig?.botName ||
 sock.principalConfig?.name ||
 global.botName ||
 'Master Clover'

 // ===== DATOS DEL GRUPO =====
 const owner = metadata.owner || metadata.participants.find(p => p.admin === 'superadmin')?.id || ''
 const ownerClean = String(owner).split('@')[0].split(':')[0].replace(/\D/g, '')
 const botClean = num || String(sock.user?.id || '').split('@')[0].split(':')[0].replace(/\D/g, '')

 // ===== FUNCIONES ACTIVAS DESDE LA DB =====
 let db = global.db?.data || {}
 if (!db.chats) db.chats = {}
 let chatCfg = db.chats[chat] || {}

 // Si no esta definido, por defecto es true en tu bot (welcome / bye prendidos)
 let welcome = chatCfg.welcome !== false ? '✓' : '✘'
 let bye = (chatCfg.bye !== false && chatCfg.despe !== false) ? '✓' : '✘'
 let antilink = chatCfg.antilink ? '✓' : '✘'
 let antispam = chatCfg.antispam ? '✓' : '✘'

 const text = `ㅤ ─̷̸─꯭━─̷̸─꯭━────────꯭━─̷̸─꯭━─̷̸

ㅤㅤㅤ⠟ ׂ ⭐⃞፝֟͝ꭷ ׂ 𝙂𝙍𝙐𝙋𝙊𝙄𝙉𝙁𝙊
 𝙇𝙔𝘼

▒⃞⃝᪶̫֟᪲̇ Nombre › ${metadata.subject}
▒⃞⃝᪶̫֟᪲̇ Creado por › @${ownerClean}
▒⃞⃝᪶̫֟᪲̇ Usuario › @${botClean}
▒⃞⃝᪶̫֟᪲̇ Miembros › ${metadata.participants.length}+
▒⃞⃝᪶̫֟᪲̇ Bot › ${botName}

> ↻ Cargando funciones...

ㅤ ─̷̸─꯭━─̷̸─꯭━────────꯭━─̷̸─꯭━─̷̸

ㅤㅤㅤ⠟ ׂ ⭐⃞፝֟͝ꭷ ׂ 𝙁𝙐𝙉𝘾𝙄𝙊𝙉𝙀𝙎
 𝘿𝙀𝙇 𝙂𝙍𝙐𝙋𝙊

> ❐ Bienvenida › ${welcome}
> ❐ Despedida › ${bye}
> ❐ Antilink › ${antilink}
> ❐ Antispam › ${antispam}

> ↻ Toda la información del grupo`.trim()

 // ===== ICON - MISMA FUNCION QUE TU test =====
 const dbIconDir = path.join(process.cwd(), 'db', 'icon')
 const posibles = [
 sock.subConfig?.icon,
 sock.principalConfig?.icon,
 path.join(dbIconDir, `${num}.jpg`),
 path.join(dbIconDir, 'main.jpg'),
 path.join(process.cwd(), 'db', 'icon.jpg')
 ]

 let iconPath = null
 for (const p of posibles) {
 if (!p) continue
 if (String(p).startsWith('http')) continue
 const full = path.isAbsolute(p) ? p : path.join(process.cwd(), p)
 if (fs.existsSync(full)) { iconPath = full; break }
 }

 if (!iconPath && fs.existsSync(dbIconDir)) {
 const files = fs.readdirSync(dbIconDir).filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f))
 if (files.length) iconPath = path.join(dbIconDir, files[0])
 }

 let mentions = []
 if (owner) mentions.push(owner)
 if (botClean) mentions.push(botClean + '@s.whatsapp.net')

 if (!iconPath) {
 return sock.sendMessage(chat, { text, mentions }, { quoted: m })
 }

 try {
 const original = fs.readFileSync(iconPath)
 const preview = await sharp(original)
 .rotate()
 .resize(160, 160, { fit: 'inside', withoutEnlargement: true })
 .jpeg({ quality: 65 })
 .toBuffer({ resolveWithObject: true })

 const metadataImg = await sharp(original).metadata()
 const formatos = {
 jpeg: ['jpg', 'image/jpeg'],
 png: ['png', 'image/png'],
 webp: ['webp', 'image/webp'],
 gif: ['gif', 'image/gif'],
 avif: ['avif', 'image/avif'],
 tiff: ['tiff', 'image/tiff']
 }
 const [extension, mimetype] = formatos[metadataImg.format] || [
 path.extname(iconPath).slice(1).toLowerCase() || 'bin',
 'application/octet-stream'
 ]

 return await sock.sendMessage(chat, {
 document: original,
 fileName: `${String(botName).replace(/[\\/:*?"<>|\r\n]/g, '').trim() || 'Bot'}-icon.${extension}`,
 mimetype,
 jpegThumbnail: preview.data.toString('base64'),
 thumbnailWidth: preview.info.width,
 thumbnailHeight: preview.info.height,
 caption: text,
 mentions
 }, { quoted: m })
 } catch (e) {
 console.error('[grupoinfo] Error:', e)
 return sock.sendMessage(chat, { text, mentions }, { quoted: m })
 }
}

export default handler
