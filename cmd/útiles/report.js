export const handler = {}
handler.name = 'report'
handler.alias = ['reporte', 'bug', 'error']
handler.category = 'Info'
handler.description = 'Reportar un comando con fallas al staff'

const STAFF_GROUP = '120363430570438631@g.us'

// ===== TRADUCTOR LID -> NUMERO REAL =====
function lidToNumber(senderLid, metadata, m){
 // 1. El participantAlt casi siempre ya es el numero real @s.whatsapp.net
 const alt = m.key.participantAlt || m.participantAlt
 if(alt && alt.endsWith('@s.whatsapp.net')){
 return { jid: alt, number: alt.split('@')[0] }
 }

 // 2. Buscar en el grupo: p.id es el LID, p.phoneNumber es el numero real
 if(metadata?.participants){
 const p = metadata.participants.find(x => 
 x.id === senderLid || x.lid === senderLid || x.phoneNumber === senderLid
 )
 if(p){
 // Baileys nuevo: p.phoneNumber = "549xxx@s.whatsapp.net"
 if(p.phoneNumber && p.phoneNumber.endsWith('@s.whatsapp.net')){
 return { jid: p.phoneNumber, number: p.phoneNumber.split('@')[0] }
 }
 // Baileys viejo: p.id ya es el numero
 if(p.id && p.id.endsWith('@s.whatsapp.net')){
 return { jid: p.id, number: p.id.split('@')[0] }
 }
 // A veces viene p.jid
 if(p.jid && p.jid.endsWith('@s.whatsapp.net')){
 return { jid: p.jid, number: p.jid.split('@')[0] }
 }
 }
 }

 // 3. Si no se pudo traducir, devolvemos el LID tal cual para que no crashee
 return { jid: senderLid, number: senderLid.split('@')[0], isLid: true }
}

handler.exec = async (sock, m, args) => {
 const from = m.key.remoteJid
 const texto = args.join(' ').trim()

 if(!texto){
 return sock.sendMessage(from, { text: `《✧》 Escribe qué comando falla.\n\nEjemplo:\n.report play no me descarga el audio` }, { quoted: m })
 }

 const isGroup = from.endsWith('@g.us')
 let groupName = 'Privado / DM'
 let groupId = from
 let metadata = null
 if(isGroup){
 try{
 metadata = await sock.groupMetadata(from)
 groupName = metadata.subject || 'Sin nombre'
 groupId = from
 }catch{}
 }

 // ===== ACÁ ESTABA EL ERROR, ANTES USABAS m.sender DIRECTO =====
 const senderRaw = m.key.participant || m.key.participantAlt || m.sender || m.key.remoteJid
 const { jid: senderJid, number, isLid } = lidToNumber(senderRaw, metadata, m)

 const pushName = m.pushName || 'Sin nombre'
 const fecha = new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })

 const paraUsuario = `╭───────────────╮\n│ ❒ Reporte ☞ ${texto.slice(0, 40)}\n│ ❀ Grupo ☞ ${groupName}\n╰───────────────╯\n> 🍃 Gracias por tu reporte, tu reporte se enviara al grupo de soporte privado del bot`
 await sock.sendMessage(from, { text: paraUsuario }, { quoted: m })

 const paraStaff = `╭───────────────╮\n│ 📛 Reporte: ${texto}\n│ 🏷️ Grupo: ${groupName}\n│ 🍃 Usuario: ${pushName}\n│ 🍁 Numero: wa.me/${number}${isLid ? ' (LID sin traducir)' : ''}\n│ 🖥️ Fecha: ${fecha}\n╰───────────────╯\n\n> ID Grupo: ${groupId}\n> ID Usuario: ${senderJid}`

 try{
 await sock.sendMessage(STAFF_GROUP, { text: paraStaff })
 }catch(e){
 console.log('[REPORT]', e.message)
 }
}

export default handler
