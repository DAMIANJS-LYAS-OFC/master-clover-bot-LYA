import fs from 'fs'
import path from 'path'
import { pathToFileURL } from 'url'

export const handler = {}
handler.name = 'bots'
handler.alias = ['subbots', 'listbots', 'botslist']
handler.category = 'general'

let config = null
try{
 const p = path.join(process.cwd(), 'config.js')
 if(fs.existsSync(p)){
 const mod = await import(pathToFileURL(p).href + '?v=' + Date.now())
 config = mod.default || mod
 }
}catch{}
if(!config) config = { bot: { name: 'MASTER CLOVER', banner: '' }, channels: { id: '', cname: '' } }

function getBannerPayload(banner, text, mentions, channelInfo){
 const clean = String(banner).split('?')[0].toLowerCase()
 const isLocal = fs.existsSync(banner)
 const media = isLocal ? fs.readFileSync(banner) : { url: banner }
 const base = { caption: text, mentions, contextInfo: channelInfo }
 if(clean.endsWith('.mp4')) return { video: media, gifPlayback: true, ...base }
 if(clean.endsWith('.gif') || clean.endsWith('.webp')) return { video: media, gifPlayback: true, ...base }
 return { image: media, ...base }
}

function cleanNum(v){
 if(!v) return null
 const s = String(v).split(':')[0].split('@')[0].replace(/\D/g,'')
 if(s.length < 7) return null
 return s
}

function findCreds(dir, depth = 0){
 if(depth > 3 || !fs.existsSync(dir)) return null
 try{
 for(const f of fs.readdirSync(dir)){
 const full = path.join(dir, f)
 try{
 const st = fs.statSync(full)
 if(st.isFile() && f === 'creds.json') return full
 if(st.isDirectory() && !f.startsWith('.')){
 const r = findCreds(full, depth + 1)
 if(r) return r
 }
 }catch{}
 }
 }catch{}
 return null
}

function getNum(full, cfg){
 for(const k of ['number','num','botNumber','phone','jid','id','owner']){
 const n = cleanNum(Array.isArray(cfg?.[k]) ? cfg[k][0] : cfg?.[k])
 if(n) return n
 }
 const credsPath = findCreds(full)
 if(credsPath){
 try{
 const c = JSON.parse(fs.readFileSync(credsPath,'utf8'))
 const n = cleanNum(c?.me?.id || c?.me?.jid || c?.id)
 if(n) return n
 }catch{}
 }
 return cleanNum(path.basename(full))
}

function getAllBots(){
 const out = []
 const seen = new Set()
 const scan = (base, tipo) => {
 if(!fs.existsSync(base)) return
 for(const folder of fs.readdirSync(base)){
 const full = path.join(base, folder)
 try{ if(!fs.statSync(full).isDirectory()) continue }catch{ continue }
 const cfgPath = path.join(full, 'config.json')
 let cfg = {}
 if(fs.existsSync(cfgPath)){
 try{ cfg = JSON.parse(fs.readFileSync(cfgPath,'utf8')) }catch{}
 }
 const num = getNum(full, cfg)
 if(!num || seen.has(num)) continue
 // Filtro silencioso: sin sesion valida no entra, sin avisar nada
 const credsPath = findCreds(full)
 if(!credsPath) continue
 try{
 const c = JSON.parse(fs.readFileSync(credsPath,'utf8'))
 if(!c?.me?.id && !c?.id) continue
 }catch{ continue }
 seen.add(num)
 out.push({ num, jid: num + '@s.whatsapp.net', name: cfg.name || cfg.botName || config.bot?.name || 'MASTER CLOVER', tipo })
 }
 }
 scan(path.join(process.cwd(),'principals'), 'Principal')
 scan(path.join(process.cwd(),'subbots'), 'Sub-bot')
 scan(path.join(process.cwd(),'jadiBots'), 'Sub-bot')
 return out
}

handler.exec = async (sock, m) => {
 const jid = m.key.remoteJid
 const isGroup = jid.endsWith('@g.us')
 const bots = getAllBots()

 const total = bots.length
 const totalSub = bots.filter(b => b.tipo === 'Sub-bot').length
 const totalPri = bots.filter(b => b.tipo === 'Principal').length

 let groupNums = new Set()
 if(isGroup){
 try{
 const meta = await sock.groupMetadata(jid)
 for(const p of meta.participants){
 if(p.id) groupNums.add(cleanNum(p.id))
 if(p.lid) groupNums.add(cleanNum(p.lid))
 }
 }catch{}
 }

 const inGroup = bots.filter(b => groupNums.has(b.num))
 const notInGroup = bots.filter(b => !groupNums.has(b.num))
 const mentions = bots.map(b => b.jid)
 const channelInfo = { forwardingScore: 999, isForwarded: true, forwardedNewsletterMessageInfo: { newsletterJid: config.channels?.id, newsletterName: config.channels?.cname, serverMessageId: -1 } }

 let text = `╭───────────────────╮
│ 🖥️ 𝐒𝐘𝐓𝐄𝐌 𝐒𝐔𝐁𝐁𝐎𝐓𝐒
│ 🍃 𝐓𝐨𝐭𝐚𝐥 𝐛𝐨𝐭𝐬: ( ${total} )
│───────────────────╯
│❀ 𝐒𝐮𝐛𝐛𝐨𝐭𝐬: ( ${totalSub} )
│❀ 𝐏𝐫𝐢𝐧𝐜𝐢𝐩𝐚𝐥𝐞𝐬: ( ${totalPri} )
╰───────────────────╯`

 if(bots.length === 0){
 text += `\n\n> ⚠️ No hay bots conectados ahora.`
 } else if(isGroup){
 text += `\n╭───────────────────╮`
 if(inGroup.length === 0){
 text += `\n> ❏ 𝐍𝐢𝐧𝐠𝐮𝐧 𝐛𝐨𝐭 𝐞𝐬𝐭𝐚 𝐞𝐧 𝐞𝐬𝐭𝐞 𝐠𝐫𝐮𝐩𝐨`
 } else {
 for(const b of inGroup){
 text += `\n> ❏ 𝐁𝐨𝐭𝐬 𝐄𝐧 𝐞𝐬𝐭𝐞 𝐠𝐫𝐮𝐩𝐨
> 🍃 𝐮𝐬𝐞𝐫: @${b.num}
> 🍁 𝐛𝐨𝐭𝐧𝐚𝐦𝐞: ${b.name}
> 📛 𝐭𝐢𝐩𝐨: ${b.tipo}
────────────────────`
 }
 }
 text += `\n╰───────────────────╯`
 if(notInGroup.length > 0){
 text += `\n╭───────────────────╮`
 for(const b of notInGroup){
 text += `\n> 🍃 𝐮𝐬𝐞𝐫: @${b.num}
> 🍁 𝐛𝐨𝐭𝐧𝐚𝐦𝐞: ${b.name}
> 📛 𝐭𝐢𝐩𝐨: ${b.tipo}
────────────────────`
 }
 text += `\n╰───────────────────╯`
 }
 } else {
 text += `\n╭───────────────────╮`
 for(const b of bots){
 text += `\n> 🍃 𝐮𝐬𝐞𝐫: @${b.num}
> 🍁 𝐛𝐨𝐭𝐧𝐚𝐦𝐞: ${b.name}
> 📛 𝐭𝐢𝐩𝐨: ${b.tipo}
────────────────────`
 }
 text += `\n╰───────────────────╯`
 }

 let customBanner = null
 try{
 const myNum = cleanNum(sock?.user?.id)
 const files = [
 path.join(process.cwd(),'principals',myNum,'config.json'),
 path.join(process.cwd(),'subbots',myNum,'config.json'),
 path.join(process.cwd(),'jadiBots',myNum,'config.json')
 ]
 for(const f of files){
 if(fs.existsSync(f)){
 try{ const j = JSON.parse(fs.readFileSync(f,'utf8')); if(j.banner) customBanner = j.banner }catch{}
 }
 }
 if(sock.principalConfig?.banner) customBanner = sock.principalConfig.banner
 if(sock.subConfig?.banner) customBanner = sock.subConfig.banner
 }catch{}
 const bannerToUse = customBanner || config.bot?.banner || config.bot?.foto || null

 try{
 if(bannerToUse){
 await sock.sendMessage(jid, getBannerPayload(bannerToUse, text, mentions, channelInfo), { quoted: m })
 } else {
 await sock.sendMessage(jid, { text, mentions, contextInfo: channelInfo }, { quoted: m })
 }
 }catch{
 await sock.sendMessage(jid, { text, mentions }, { quoted: m })
 }
}

export default handler
