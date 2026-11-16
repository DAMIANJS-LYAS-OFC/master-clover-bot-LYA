import config from '../../config.js'

export const handler={}
handler.name='creador'
handler.alias=['owner','contacto','dev']
handler.category='info'

handler.exec=async(sock,m,args,extra)=>{
 const jid = m.key.remoteJid
 const ownerNumber = (config?.bot?.owner?.[0] || '5492645746772').split('@')[0].replace(/\D/g,'')
 const ownerName = 'DamianJS-ofc'

 await sock.sendMessage(jid, {
 contacts: {
 displayName: ownerName,
 contacts: [{
 vcard: `BEGIN:VCARD\nVERSION:3.0\nFN:${ownerName}\nTEL;type=CELL;type=VOICE;waid=${ownerNumber}:+${ownerNumber}\nEND:VCARD`
 }]
 }
 }, { quoted: m })

 return sock.sendMessage(jid, {
 text: `*CONTACTO CREADOR*\n\n> 👤 Nombre: ${ownerName}\n> 📞 Numero: +${ownerNumber}\n\nSi tienes dudas o sugerencias, habla directo al contacto de arriba.`
 }, { quoted: m })
}
export default handler
