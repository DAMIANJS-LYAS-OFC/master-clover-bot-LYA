import fs from 'fs'
import path from 'path'
import { pathToFileURL } from 'url'

export const handler = {}
handler.name = 'delsesion'
handler.alias = ['delsession', 'borrarsesion', 'logout', 'desvincular']
handler.category = 'subbots'

let config = null
try{
 const p = path.join(process.cwd(), 'config.js')
 if(fs.existsSync(p)){
 const mod = await import(pathToFileURL(p).href + '?v=' + Date.now())
 config = mod.default || mod
 }
}catch{}
if(!config) config = { bot: { owner: [] } }

function cleanNum(v){
 if(!v) return null
 const s = String(v).split(':')[0].split('@')[0].replace(/\D/g,'')
 if(s.length < 7) return null
 return s
}

const MSG_NO_SESION = `⚠️ No eres un subbot para poder desvincular tu bot\nsi esto es un error reportalo con el comando #report`

function readJson(p){
 try{ return JSON.parse(fs.readFileSync(p,'utf8')) }catch{ return null }
}

function findFolderByNums(nums){
 const bases = ['principals','subbots','jadiBots']
 // 1. Carpeta con el mismo nombre = numero
 for(const n of nums){
 if(!n) continue
 for(const b of bases){
 const full = path.join(process.cwd(), b, n)
 if(fs.existsSync(full)) return full
 }
 for(const b of ['sessions','auth']){
 const full = path.join(process.cwd(), b, n)
 if(fs.existsSync(full)) return full
 }
 }
 // 2. Buscar adentro de cada carpeta: config.json + creds.json (id y lid)
 for(const b of bases){
 const base = path.join(process.cwd(), b)
 if(!fs.existsSync(base)) continue
 for(const folder of fs.readdirSync(base)){
 const full = path.join(base, folder)
 try{ if(!fs.statSync(full).isDirectory()) continue }catch{ continue }
 const cfg = readJson(path.join(full, 'config.json'))
 if(cfg && nums.some(n => n && JSON.stringify(cfg).includes(n))) return full
 // creds adentro
 const credsCandidates = [path.join(full,'creds.json'), path.join(full,'session','creds.json'), path.join(full,'auth','creds.json')]
 for(const cp of credsCandidates){
 if(!fs.existsSync(cp)) continue
 const c = readJson(cp)
 if(!c) continue
 const meId = cleanNum(c?.me?.id)
 const meLid = cleanNum(c?.me?.lid)
 const meJid = cleanNum(c?.me?.jid)
 if(nums.includes(meId) || nums.includes(meLid) || nums.includes(meJid)) return full
 }
 // sessions/ con mismo nombre de carpeta
 for(const sb of ['sessions','auth']){
 const sp = path.join(process.cwd(), sb, folder, 'creds.json')
 if(fs.existsSync(sp)){
 const c = readJson(sp)
 const meId = cleanNum(c?.me?.id)
 const meLid = cleanNum(c?.me?.lid)
 if(nums.includes(meId) || nums.includes(meLid)) return full
 }
 }
 }
 }
 return null
}

handler.exec = async (sock, m, args) => {
 const jid = m.key.remoteJid
 const isGroup = jid.endsWith('@g.us')

 // --- RESOLVER SENDER: LID -> NUMERO REAL ---
 const rawParticipant = m.key.participant || m.key.remoteJid
 const rawAlt = m.key.participantAlt || m.message?.extendedTextMessage?.contextInfo?.participantAlt
 let senderNums = [cleanNum(rawParticipant), cleanNum(rawAlt)].filter(Boolean)

 // En grupo, buscar en groupMetadata el jid real (telefono) de ese LID
 if(isGroup){
 try{
 const meta = await sock.groupMetadata(jid)
 for(const p of meta.participants || []){
 const pId = cleanNum(p.id)
 const pJid = cleanNum(p.jid)
 const pLid = cleanNum(p.lid)
 if(senderNums.includes(pId) || senderNums.includes(pLid) || senderNums.includes(pJid)){
 if(pJid) senderNums.push(pJid)
 if(pId) senderNums.push(pId)
 if(pLid) senderNums.push(pLid)
 }
 }
 }catch{}
 }
 senderNums = [...new Set(senderNums)]
 const sender = senderNums[0]

 const myNums = [cleanNum(sock?.user?.id), cleanNum(sock?.user?.lid)].filter(Boolean)
 const myNum = myNums[0]
 const myName = sock?.user?.name || config.bot?.name || 'BOT'

 // A quien borrar? Por defecto: el que uso el comando
 let targetNums = [...senderNums]
 const mentioned = m.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]
 const quoted = m.message?.extendedTextMessage?.contextInfo?.participant
 if(mentioned) targetNums = [cleanNum(mentioned)]
 else if(quoted && args[0]?.toLowerCase() !== 'yo') targetNums = [cleanNum(quoted)]
 else if(args[0]) targetNums = [cleanNum(args[0])]

 const target = targetNums[0]
 if(!target){
 return sock.sendMessage(jid, { text: MSG_NO_SESION }, { quoted: m })
 }

 // Solo el dueño de esa sesion o un owner principal puede borrarla
 const owners = (config.bot?.owner || []).map(o => cleanNum(o)).filter(Boolean)
 const isOwner = targetNums.some(n => owners.includes(n)) || senderNums.some(n => owners.includes(n)) || targetNums.some(n => senderNums.includes(n))
 if(!isOwner){
 return sock.sendMessage(jid, { text: MSG_NO_SESION }, { quoted: m })
 }

 const isMe = targetNums.some(n => myNums.includes(n)) || myNums.some(n => targetNums.includes(n))

 // DEBUG para ver que esta buscando (borralo si queres)
 console.log('[DELSESION]', { rawParticipant, rawAlt, senderNums, targetNums, myNums, isMe })

 const folder = findFolderByNums(targetNums)
 if(!folder){
 return sock.sendMessage(jid, { text: MSG_NO_SESION }, { quoted: m })
 }

 // CASO 1: El bot mismo ejecuto el comando, si se borra a si mismo
 if(isMe){
 await sock.sendMessage(jid, { text: `> 🗑️ Borrando mi sesión... @${target}\n> Adios, me desconecto.`, mentions: [target + '@s.whatsapp.net'] }, { quoted: m }).catch(()=>{})
 try{
 fs.rmSync(folder, { recursive: true, force: true })
 for(const b of ['principals','subbots','jadiBots','sessions','auth']){
 for(const n of targetNums){
 const p = path.join(process.cwd(), b, n)
 if(fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true })
 }
 }
 }catch{}
 try{ await sock.logout() }catch{}
 try{ await sock.end() }catch{}
 try{ sock.ws?.close() }catch{}
 setTimeout(()=> process.exit(0), 1000)
 return
 }

 // CASO 2: Otro bot responde, NO se borra a si mismo, solo borra la sesion del que uso el comando
 try{
 const globals = [globalThis.bots, globalThis.subBots, globalThis.connections, globalThis.sockets, globalThis.allSocks]
 for(const g of globals){
 if(!g) continue
 const list = g instanceof Map ? [...g.values()] : Array.isArray(g) ? g : Object.values(g)
 for(const s of list){
 const sNums = [cleanNum(s?.user?.id), cleanNum(s?.sock?.user?.id), cleanNum(s?.user?.lid)].filter(Boolean)
 if(sNums.some(n => targetNums.includes(n)) && !sNums.some(n => myNums.includes(n))){
 try{ await s.logout?.() }catch{}
 try{ await s.end?.() }catch{}
 try{ s.ws?.close() }catch{}
 }
 }
 }

 fs.rmSync(folder, { recursive: true, force: true })
 for(const b of ['principals','subbots','jadiBots','sessions','auth']){
 for(const n of targetNums){
 const p = path.join(process.cwd(), b, n)
 if(fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true })
 }
 }

 await sock.sendMessage(jid, { text: `> ✅ Sesión de @${target} borrada.\n> Yo (${myName}) sigo vivo, no me borré.`, mentions: [target + '@s.whatsapp.net'] }, { quoted: m })
 }catch(e){
 console.log('ERROR DELSESION', e)
 await sock.sendMessage(jid, { text: MSG_NO_SESION }, { quoted: m })
 }
}

export default handler
