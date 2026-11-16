import config from '../../config.js'
export const handler = {}
handler.name = 'ccodigo'
handler.alias = ['como']
handler.category = 'owner'
handler.owner = true
function getOwners(){return (config?.bot?.owner||[]).map(n=>n.toString().split('@')[0].replace(/\D/g,'')).filter(Boolean)}
function isOwner(m){let r=m.key?.participant||m.key?.remoteJid||'';let c=r.split('@')[0].split(':')[0].replace(/\D/g,'');if(m.key?.fromMe)return true;return getOwners().includes(c)}
handler.exec = async (...args) => {
 let sock,m,a
 if(args[0]?.key){m=args[0];sock=args[1]?.conn||global.conn;a=args[1]?.args||[]}
 else{sock=args[0];m=args[1];a=args[2]||[]}
 if(!isOwner(m)) return sock.sendMessage(m.key.remoteJid,{text:'Solo owners'},{quoted:m})
 let jid=m.key.remoteJid
 let ctx=m.message?.extendedTextMessage?.contextInfo||m.message?.imageMessage?.contextInfo||m.message?.videoMessage?.contextInfo||m.message?.documentMessage?.contextInfo
 let q=ctx?.quotedMessage
 if(!q) return sock.sendMessage(jid,{text:'Responde a un mensaje con .ccodigo'},{quoted:m})
 let tipo=Object.keys(q)[0]
 let d=q.documentMessage||q.imageMessage||q.videoMessage||{}
 let thumb=q.documentMessage?.jpegThumbnail?'SI':'NO'
 let info=`Tipo: ${tipo}\nNombre: ${d.fileName||'-'}\nMimetype: ${d.mimetype||'-'}\nThumb: ${thumb}\nCaption: ${d.caption||'-'}`
 let code=`document: buffer,\nfileName: '${d.fileName||''}',\nmimetype: '${d.mimetype||''}',\njpegThumbnail: buffer`
 if(tipo==='imageMessage') code=`image: buffer, caption: '${d.caption||''}'`
 if(tipo==='extendedTextMessage'||tipo==='conversation') code=`text: '${q.extendedTextMessage?.text||q.conversation||''}'`
 await sock.sendMessage(jid,{text:`Como lo hizo:\n\n${info}\n\nCodigo:\n${code}`},{quoted:m})
}
export default handler