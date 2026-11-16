import fs from 'fs'
import path from 'path'

export const handler = {}
handler.name = 'gethtml'
handler.alias = ['gethtml', 'webcode', 'ghtml']
handler.category = 'útiles'
handler.description = 'Descarga el HTML de una web y te lo pasa como documento'

function isPrivateIp(host){
 // Bloquea localhost / red interna / metadata de la nube
 if(['localhost','0.0.0.0'].includes(host)) return true
 if(host.startsWith('10.') || host.startsWith('192.168.') || host.startsWith('172.16.') || host.startsWith('172.17.') || host.startsWith('172.18.') || host.startsWith('172.19.') || host.startsWith('172.2') || host.startsWith('172.30.') || host.startsWith('172.31.')) return true
 if(host.startsWith('127.') || host === '169.254.169.254') return true
 return false
}

handler.exec = async (sock, m, args) => {
 let jid = m.key.remoteJid
 let url = (args[0] || '').trim()

 if(!url) return sock.sendMessage(jid, { text: `❒ *Uso:* .html https://ejemplo.com\n\nTe mando el código completo como documento .html` }, { quoted: m })

 if(!/^https?:\/\//i.test(url)) url = 'https://' + url

 let parsed
 try { parsed = new URL(url) } catch {
 return sock.sendMessage(jid, { text: `⚠️ Link inválido: ${url}` }, { quoted: m })
 }

 if(parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return sock.sendMessage(jid, { text: `⚠️ Solo http / https` }, { quoted: m })
 if(isPrivateIp(parsed.hostname)) return sock.sendMessage(jid, { text: `⚠️ No puedo descargar IPs privadas / localhost` }, { quoted: m })

 try {
 await sock.sendMessage(jid, { react: { text: '🕒', key: m.key } })

 // Timeout de 20s para que no se cuelgue el bot
 let ctrl = new AbortController()
 let timer = setTimeout(() => ctrl.abort(), 20000)

 let res = await fetch(url, {
 signal: ctrl.signal,
 redirect: 'follow',
 headers: {
 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
 'Accept': 'text/html,application/xhtml+xml,*/*',
 'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8'
 }
 })
 clearTimeout(timer)

 if(!res.ok) return sock.sendMessage(jid, { text: `⚠️ La web respondió: ${res.status} ${res.statusText}` }, { quoted: m })

 let contentType = res.headers.get('content-type') || ''
 // Si no es HTML, igual te lo mando pero te aviso
 let isHtml = contentType.includes('html') || contentType.includes('text')

 let text = await res.text()

 // Límite 15MB para no matar el bot
 if(text.length > 15 * 1024 * 1024) return sock.sendMessage(jid, { text: `⚠️ Esa web pesa más de 15MB (${(text.length/1024/1024).toFixed(1)}MB), no la puedo bajar` }, { quoted: m })

 // Nombre: ejemplo.com.html
 let cleanName = parsed.hostname.replace(/[^a-z0-9.-]/gi, '_') + '.html'
 let tmpPath = path.join(process.cwd(), 'temp', `html_${Date.now()}_${cleanName}`)
 fs.mkdirSync(path.join(process.cwd(), 'temp'), { recursive: true })
 fs.writeFileSync(tmpPath, text)

 let caption = `╭─̷̸─꯭──━─̷̸─꯭━──────╮\n┃ 🍃 *HTML descargado*\n┃─̷̸─꯭──━─̷̸─꯭━──────╯\n┃─̷̸─꯭──━─̷̸─꯭━──────╮\n┃❒ \`Web: ${url}\`\n┃❀ \`Peso: ${(text.length/1024).toFixed(1)} KB\`\n┃❀ \`Líneas: ${text.split('\\n').length}\`\n┃❀ \`Tipo: ${contentType || 'desconocido'}\`\n╰─̷̸─꯭──━─̷̸─꯭━──────╯`

 // Si es chiquito (< 3000 caracteres) te lo manda también en texto para verlo rápido
 if(text.length < 3000) {
 await sock.sendMessage(jid, { text: caption + `\n\n\`\`\`html\n${text.slice(0, 3000)}\n\`\`\`` }, { quoted: m })
 }

 await sock.sendMessage(jid, {
 document: fs.readFileSync(tmpPath),
 fileName: cleanName,
 mimetype: 'text/html',
 caption
 }, { quoted: m })

 try { fs.unlinkSync(tmpPath) } catch {}
 await sock.sendMessage(jid, { react: { text: '✔️', key: m.key } })

 } catch(e) {
 await sock.sendMessage(jid, { react: { text: '✖️', key: m.key } })
 let msg = e.name === 'AbortError' ? 'La web tardó más de 20s en responder' : e.message
 return sock.sendMessage(jid, { text: `⚠️ Error bajando la web: ${msg}` }, { quoted: m })
 }
}
export default handler
