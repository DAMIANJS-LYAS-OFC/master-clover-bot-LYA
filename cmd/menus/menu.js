import fs from 'fs'; import path from 'path'; import { pathToFileURL } from 'url'
import { getBotUptimeMs } from '../../lib/startTime.js'
import { prepareWAMessageMedia } from 'baileys'
const BANNER_DEFAULT='https://raw.githubusercontent.com/starlyn-chann/Mistic-star/main/tourl/1791658575065-D6ufbDFJC7Mv.jpg'
const PREWEB_LINK='https://locos-y-asociados-cdn.onrender.com'
let config=null; for(const p of [path.join(process.cwd(),'config.js')]){ if(fs.existsSync(p)){ try{ const mod=await import(pathToFileURL(p).href+'?v='+Date.now()); config=mod.default||mod; break }catch(e){ console.log('MENU config error', e.message) } } }
if(!config) config={bot:{prefix:['.'],name:'MASTER CLOVER',banner:BANNER_DEFAULT},channels:{id:'',cname:''}}
async function loadDiseño(name){
 const p = path.join(process.cwd(),'core','menudiseños.js')
 if(!fs.existsSync(p)){ console.log('[MENU] NO EXISTE core/menudiseños.js'); return null }
 try{ const mod = await import(pathToFileURL(p).href+'?t='+Date.now()); const fn = mod.getDiseño||mod.default?.getDiseño; return fn ? fn(name) : null }catch(e){ console.log('[MENU] error load diseño', e); return null }
}
export const handler={}; handler.name='menu'; handler.alias=['help','comandos']; handler.category='menus'
function getBotType(sock){
 if(sock.isSubBot === true) return 'SUBBOT'
 if(sock.isPrincipal === true) return 'PRINCIPAL'
 if(sock.principalNumber) return 'PRINCIPAL'
 return 'MAIN'
}
function readPrincipalsConfig(wantedNum){
 const base = path.join(process.cwd(),'principals')
 if(!fs.existsSync(base)) return null
 const exact = path.join(base, wantedNum, 'config.json')
 if(fs.existsSync(exact)){ try{ return {num:wantedNum, j:JSON.parse(fs.readFileSync(exact,'utf8')), path:exact} }catch{} }
 // FIX: NO buscar en otras carpetas. Antes agarraba el primer principal con tema y te lo ponia a vos.
 // Solo el exacto de este bot. Si no hay exacto, null.
 return null
}
function getTemaCentralPorBot(num){
 try{
 const p = path.join(process.cwd(),'db','subbotThemes.json')
 if(!fs.existsSync(p)) return null
 const c = JSON.parse(fs.readFileSync(p,'utf8'))
 if(c[num]) return c[num]
 }catch{}
 return null
}
function getMyData(sock){
 try{
 let num = String(sock.principalNumber || sock.subNumber || sock?.user?.id?.split(':')[0] || 'main').replace(/\D/g,'')
 let type = getBotType(sock)
 let isSub = type==='SUBBOT'
 let isPrincipal = type!=='SUBBOT'
 let theme='normal', customName=null, customBanner=null
 let found = null
 // 1. Sock = lo mas bajo, puede venir en 'normal' de jadi.js
 if(sock.principalConfig?.theme) theme=sock.principalConfig.theme
 if(sock.subConfig?.theme && type==='SUBBOT') theme=sock.subConfig.theme
 if(sock.principalConfig?.name) customName=sock.principalConfig.name
 if(sock.subConfig?.name && type==='SUBBOT') customName=sock.subConfig.name
 if(sock.principalConfig?.banner) customBanner=sock.principalConfig.banner
 // 2. Archivo de ESTE bot
 if(type!=='SUBBOT'){
 found = readPrincipalsConfig(num)
 if(found){
 if(found.j.theme) theme=found.j.theme
 if(found.j.name) customName=found.j.name
 if(found.j.banner) customBanner=found.j.banner
 num = found.num
 }
 // GLOBAL DESACTIVADO - no pisa el tema por bot, si no cambia a todos
 // const pGlobal = path.join(process.cwd(),'db','theme-global.json')
 // if(fs.existsSync(pGlobal)){ try{ const j=JSON.parse(fs.readFileSync(pGlobal,'utf8')); if(j.theme) theme=j.theme }catch{} }
 } else {
 for(let base of ['subbots','jadiBots']){
 const p = path.join(process.cwd(), base, num, 'config.json')
 if(fs.existsSync(p)){ try{ const j=JSON.parse(fs.readFileSync(p,'utf8')); if(j.theme) theme=j.theme; if(j.name) customName=j.name; if(j.banner) customBanner=j.banner }catch{} }
 }
 }
 // 3. CENTRAL POR BOT - gana siempre, solo para este num
 const central = getTemaCentralPorBot(num)
 if(central) theme = central
 if(!customBanner && config?.bot?.banner) customBanner=config.bot.banner
 return {isSub, isPrincipal, theme, customName, customBanner, type, num}
 }catch(e){ return {isSub:false, isPrincipal:true, theme:'normal', customName:null, customBanner:BANNER_DEFAULT, type:'MAIN', num:'main'} }
}
const ZONAS={'51':'America/Lima','52':'America/Mexico_City','54':'America/Argentina/Buenos_Aires','57':'America/Bogota','34':'Europe/Madrid','1':'America/New_York'}
function getHour(tz){ try{ return Number(new Intl.DateTimeFormat('en-US',{hour:'numeric',hour12:false,timeZone:tz}).format(new Date())) }catch{ return new Date().getHours() } }
function detectTZ(n){ let num=String(n).replace(/\D/g,''); for(let c of Object.keys(ZONAS).sort((a,b)=>b.length-a.length)){ if(num.startsWith(c)) return ZONAS[c] } return 'America/Lima' }
function getSaludo(h){ if(h>=5&&h<12) return 'buen Amanecer 🌅'; if(h>=12&&h<19) return 'buena tarde 🌇'; return 'buena noche 🌌' }
function countPlugins(){ try{ let root=path.join(process.cwd(),'cmd'); let total=0; function walk(d){ for(let f of fs.readdirSync(d)){ for(let f2 of [0]){} } }; walk(root); return total }catch{ return 0 } }
function getTotalUsers(){ try{ if(fs.existsSync('./db/database.json')){ let db=JSON.parse(fs.readFileSync('./db/database.json','utf-8')); let data=db.data||db; if(data.allUsers) return Object.keys(data.allUsers).length; else if(data.users){ let s=new Set(); for(let g in data.users) for(let u in data.users[g]) s.add(u); return s.size } } }catch{} return 0 }
function getUserStats(id){ try{ if(global.db?.data?.users?.[id]){ let u=global.db.data.users[id]; return {level:u.level||1, exp:u.exp||0} } }catch{ return {level:1, exp:0} } }
function fmtUptime(ms){ const s=Math.floor(ms/1000); const d=Math.floor(s/86400),h=Math.floor(s%86400/3600),m=Math.floor(s%3600/60); return `${d>0?d+'d ':''}${h}h ${m}m`.trim() }
function scanByFolder(){ try{ const categories=new Map(); const cmdRoot=path.join(process.cwd(),'cmd'); if(!fs.existsSync(cmdRoot)) return categories; const folders=fs.readdirSync(cmdRoot).filter(f=>{ try{ return fs.statSync(path.join(cmdRoot,f)).isDirectory() }catch{ return false } }); for(const folder of folders){ const fullFolder=path.join(cmdRoot,folder); const files=fs.readdirSync(fullFolder).filter(f=>f.endsWith('.js')); if(files.length===0) continue; const catName=folder.toLowerCase(); if(!categories.has(catName)) categories.set(catName,[]); for(const file of files){ const name=path.basename(file,'.js'); if(!categories.get(catName).some(c=>c.name===name)) categories.get(catName).push({name}) } categories.get(catName).sort((a,b)=>a.name.localeCompare(b.name)) } return categories }catch{ return new Map() } }
async function sendMenu(sock, jid, m, txt, bannerToUse, botName, sender){
 const clean = String(bannerToUse).split('?')[0].toLowerCase()
 const isGif = clean.endsWith('.mp4') || clean.endsWith('.gif') || clean.endsWith('.webp')
 if(isGif){
 const media = fs.existsSync(bannerToUse) ? fs.readFileSync(bannerToUse) : { url: bannerToUse }
 return sock.sendMessage(jid, { video: media, gifPlayback: true, caption: txt, mentions: [sender] }, {quoted:m})
 }
 const canalId = config.channels?.id || config.canalId || config.channelId || config.newsletterJid || ''
 const canalNombre = config.channels?.cname || config.canalNombre || config.channelName || config.newsletterName || config.canal || ''
 let linkPreview = null
 if(bannerToUse && sock.waUploadToServer){
 try{
 const { imageMessage } = await prepareWAMessageMedia(
 { image: { url: bannerToUse } },
 { upload: sock.waUploadToServer, mediaTypeOverride: 'thumbnail-link' }
 )
 linkPreview = {
 'canonical-url': PREWEB_LINK,
 'matched-text': PREWEB_LINK,
 title: botName,
 description: `—͟͟͞͞© Powered by Damian OFC | ${botName}`,
 jpegThumbnail: imageMessage?.jpegThumbnail ? Buffer.from(imageMessage.jpegThumbnail) : undefined,
 highQualityThumbnail: imageMessage || undefined
 }
 }catch(e){ console.log('[MENU PREWEB]', e.message) }
 }
 const contextInfo = {
 isForwarded: true,
 forwardedNewsletterMessageInfo: { newsletterJid: canalId, serverMessageId: '0', newsletterName: canalNombre }
 }
 return sock.sendMessage(jid, { text: txt, linkPreview: linkPreview || undefined, contextInfo, mentions: [sender] }, {quoted:m})
}
handler.exec=async(sock,m,args,extra)=>{ try{
 const {isSub, isPrincipal, theme:savedTheme, customName, customBanner, type:botType, num:botNum}=getMyData(sock);
 const jid=m.key.remoteJid; const sender=m.key.participant||jid; const rawNum=(m.key.participant||m.key.remoteJid||'').split('@')[0]; const tz=detectTZ(rawNum); const hour=getHour(tz); const saludo=getSaludo(hour);
 if(args[0]==='debug'){ return sock.sendMessage(jid,{text:`🔍 DEBUG\nTipo: ${botType}\nNum usado: ${botNum}\nTheme: ${savedTheme}\nBanner: ${customBanner}`},{quoted:m}) }
 const temaName=(savedTheme||'normal').toLowerCase(); const temaPreview=args[0]?args[0].toLowerCase():null; const tema=await loadDiseño(temaPreview||temaName) || await loadDiseño(temaName) || await loadDiseño('normal'); const botName=customName||config.bot.name||'MASTER CLOVER'; let type='Principal'; if(isPrincipal) type='Principal'; else if(isSub) type='Sub-bot'; const usermcn=`@${sender.split('@')[0]}`; const prefix=config.bot.prefix?.[0]||'.'; const cmds=countPlugins(); const users=getTotalUsers(); const {level,exp}=getUserStats(sender); const uptime=fmtUptime(getBotUptimeMs()); const fecha=new Date().toLocaleDateString('es-PE',{timeZone:tz}); const hora=new Date().toLocaleTimeString('es-PE',{timeZone:tz}); let categories=scanByFolder(); if(categories.size===0){ categories=new Map(); for(let [,cmd] of (extra?.commands||[])){ if(!cmd?.category) continue; let cat=String(cmd.category).toLowerCase().trim(); if(!categories.has(cat)) categories.set(cat,[]); if(!categories.get(cat).some(c=>c.name===cmd.name)) categories.get(cat).push(cmd) } } let all=[...categories.entries()]; let menus=all.find(([k])=>k==='menus'); let others=all.filter(([k])=>k!=='menus').sort((a,b)=>b[1].length-a[1].length); if(menus) all=[menus,...others]; else all=others; categories=new Map(all);
 let txt = 'Menu no cargado'
 if(tema && tema.render){ txt=tema.render({usermcn, botName, type, saludo, cmds, users, categories, prefix, uptime, level, exp, fecha, hora}) } else { txt=`Hola ${usermcn} Soy ${botName}\nComandos: ${cmds}\n${PREWEB_LINK}` }
 if(!txt.includes(PREWEB_LINK)) txt = txt.trim() + `\n\n${PREWEB_LINK}`
 let bannerToUse=customBanner||BANNER_DEFAULT
 try{ await sendMenu(sock, jid, m, txt, bannerToUse, botName, sender) }catch(e){ console.log('[MENU] sendMenu error', e); await sock.sendMessage(jid,{text:txt,mentions:[sender]},{quoted:m}) }
 }catch(e){ console.log('ERROR MENU',e); try{ await sock.sendMessage(m.key.remoteJid,{text:'Error en menu: '+e.message},{quoted:m}) }catch{} } }
handler.execute = handler.exec
export default handler
