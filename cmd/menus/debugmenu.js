import fs from 'fs'
import path from 'path'

export const handler = {}
handler.name = 'debugmenu'
handler.alias = ['menudebug', 'debug']
handler.category = 'menus'

handler.exec = async (sock, m, args) => {
 try {
 const jid = m.key.remoteJid
 let lines = []
 lines.push('🔍 DEBUG MENU')
 lines.push(`isSubBot: ${sock.isSubBot}`)
 lines.push(`isPrincipal: ${sock.isPrincipal}`)
 lines.push(`principalNumber: ${sock.principalNumber || 'nada'}`)
 lines.push(`subNumber: ${sock.subNumber || 'nada'}`)
 lines.push(`user.id: ${sock.user?.id || 'nada'}`)
 lines.push(`user.lid: ${sock.user?.lid || 'nada'}`)
 lines.push(`principalConfig.theme: ${sock.principalConfig?.theme || 'nada'}`)
 lines.push(`subConfig.theme: ${sock.subConfig?.theme || 'nada'}`)

 let num = String(sock.principalNumber || sock.subNumber || sock?.user?.id?.split(':')[0] || 'main').replace(/\D/g, '')
 lines.push(`Num calculado: ${num}`)

 try {
 const base = path.join(process.cwd(), 'principals')
 lines.push(`principals existe: ${fs.existsSync(base)}`)
 if (fs.existsSync(base)) {
 const dirs = fs.readdirSync(base)
 lines.push(`Carpetas principals: ${dirs.join(', ') || 'vacio'}`)
 for (let d of dirs) {
 const p = path.join(base, d, 'config.json')
 lines.push(`principals/${d}/config.json existe: ${fs.existsSync(p)}`)
 if (fs.existsSync(p)) {
 lines.push(`Contenido ${d}: ${fs.readFileSync(p, 'utf8').slice(0, 400)}`)
 }
 }
 }
 } catch (e) {
 lines.push(`Error principals: ${e.message}`)
 }

 try {
 const base = path.join(process.cwd(), 'subbots')
 lines.push(`subbots existe: ${fs.existsSync(base)}`)
 if (fs.existsSync(base)) {
 const dirs = fs.readdirSync(base)
 lines.push(`Carpetas subbots: ${dirs.join(', ') || 'vacio'}`)
 }
 } catch (e) {
 lines.push(`Error subbots: ${e.message}`)
 }

 try {
 const p = path.join(process.cwd(), 'db', 'theme-global.json')
 lines.push(`db/theme-global.json existe: ${fs.existsSync(p)}`)
 if (fs.existsSync(p)) lines.push(`Contenido global: ${fs.readFileSync(p, 'utf8').slice(0, 400)}`)
 } catch (e) {
 lines.push(`Error global: ${e.message}`)
 }

 const txt = lines.join('\n')
 if (txt.length > 4000) {
 await sock.sendMessage(jid, { text: txt.slice(0, 4000) }, { quoted: m })
 return sock.sendMessage(jid, { text: txt.slice(4000) }, { quoted: m })
 }
 return sock.sendMessage(jid, { text: txt }, { quoted: m })
 } catch (e) {
 return sock.sendMessage(m.key.remoteJid, { text: `Error debug: ${e.message}` }, { quoted: m })
 }
}
export default handler
