import fs from 'fs'
import path from 'path'
import config from '../../config.js'
import { diseños } from '../../core/menudiseños.js'
export const handler = {}
handler.name = 'setmenu'
handler.alias = ['tema', 'theme']
handler.category = 'subbots'
function cleanId(v){ return String(v||'').split('@')[0].split(':')[0].replace(/\D/g,'') }
function getBotNum(sock){ return cleanId(sock?.principalNumber || sock?.subNumber || sock?.user?.id?.split(':')[0] || '') }
function getSender(sock,m){
 if(m.key?.fromMe) return getBotNum(sock)
 if(m.key?.remoteJid?.endsWith('@g.us')) return cleanId(m.key?.participant || '')
 return cleanId(m.key?.participant || m.key?.remoteJid || '')
}
function getOwners(){ return (config?.bot?.owner||[]).map(n=>cleanId(n)).filter(Boolean) }
function getBotType(sock, botNum){
 if(fs.existsSync(path.join(process.cwd(),'principals',botNum,'config.json'))){
 let mainNum = cleanId(config?.bot?.number || config?.bot?.owner?.[0] || '')
 if(mainNum && botNum === mainNum) return 'MAIN'
 return 'PRINCIPAL'
 }
 if(sock.isSubBot === true) return 'SUBBOT'
 if(fs.existsSync(path.join(process.cwd(),'subbots',botNum,'config.json'))) return 'SUBBOT'
 if(fs.existsSync(path.join(process.cwd(),'jadiBots',botNum,'config.json'))) return 'SUBBOT'
 return 'MAIN'
}
function getBotName(sock, botNum, type){
 if(type!=='SUBBOT' && sock.principalConfig?.name) return sock.principalConfig.name
 if(type==='SUBBOT' && sock.subConfig?.name) return sock.subConfig.name
 let files = type==='SUBBOT' ? [path.join(process.cwd(),'subbots',botNum,'config.json'), path.join(process.cwd(),'jadiBots',botNum,'config.json')] : [path.join(process.cwd(),'principals',botNum,'config.json')]
 for(let p of files){ if(fs.existsSync(p)){ try{ let j=JSON.parse(fs.readFileSync(p,'utf8')); if(j.name) return j.name }catch{} } }
 return config?.bot?.name || 'MASTER CLOVER'
}
function getThemeBot(sock, botNum, type){
 try{ const _c = JSON.parse(fs.readFileSync(path.join(process.cwd(),'db','subbotThemes.json'),'utf8')); if(_c[botNum]) return _c[botNum] }catch{}
 if(type!=='SUBBOT' && sock.principalConfig?.theme) return sock.principalConfig.theme
 if(type==='SUBBOT' && sock.subConfig?.theme) return sock.subConfig.theme
 let files = type==='SUBBOT' ? [path.join(process.cwd(),'subbots',botNum,'config.json'), path.join(process.cwd(),'jadiBots',botNum,'config.json')] : [path.join(process.cwd(),'principals',botNum,'config.json')]
 for(let p of files){ if(fs.existsSync(p)){ try{ let j=JSON.parse(fs.readFileSync(p,'utf8')); if(j.theme) return j.theme }catch{} } }
 return 'normal'
}
async function sendIconDoc(sock, jid, m, captionText, botName, botNum){
 try{
 const dbIconDir = path.join(process.cwd(), 'db', 'icon')
 const posibles = [sock.subConfig?.icon, sock.principalConfig?.icon, path.join(dbIconDir, `${botNum}.jpg`), path.join(dbIconDir, `${botNum}.png`), path.join(dbIconDir, 'main.jpg')]
 let iconPath = null
 for(const p of posibles){ if(!p) continue; if(String(p).startsWith('http')) continue; const full = path.isAbsolute(p) ? p : path.join(process.cwd(), p); if(fs.existsSync(full)){ iconPath = full; break } }
 if(!iconPath && fs.existsSync(dbIconDir)){ const files = fs.readdirSync(dbIconDir).filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f)); if(files.length) iconPath = path.join(dbIconDir, files[0]) }
 if(!iconPath) return sock.sendMessage(jid, { text: captionText }, { quoted: m })
 const original = fs.readFileSync(iconPath)
 let cleanName = String(botName || 'Bot').replace(/[\\/:*?"<>|\r\n]/g, '').trim() || 'Bot'
 let ext = path.extname(iconPath).slice(1).toLowerCase() || 'jpg'
 let mimetype = 'image/jpeg'; if(ext==='png') mimetype='image/png'; if(ext==='webp') mimetype='image/webp'
 let thumbOpts = {}
 try{ const sharp = (await import('sharp')).default; const preview = await sharp(original).rotate().resize(160,160,{fit:'inside',withoutEnlargement:true}).jpeg({quality:65}).toBuffer({resolveWithObject:true}); thumbOpts = { jpegThumbnail: preview.data.toString('base64'), thumbnailWidth: preview.info.width, thumbnailHeight: preview.info.height } }catch{}
 return await sock.sendMessage(jid, { document: original, fileName: `${cleanName}.${ext}`, mimetype, ...thumbOpts, caption: captionText }, { quoted: m })
 }catch{ return sock.sendMessage(jid, { text: captionText }, { quoted: m }) }
}
function prettyName(n){ return n.charAt(0).toUpperCase() + n.slice(1) }
handler.exec = async (sock, m, args) => {
 let botNum = getBotNum(sock)
 let sender = getSender(sock, m)
 let owners = getOwners()
 let botLid = cleanId(sock?.user?.lid || '')
 let isOwner = owners.includes(sender)
 let isMismoBot = sender === botNum || (botLid && sender === botLid)
 if(!isOwner && !isMismoBot && m.key?.participant?.includes('@lid') && m.key?.remoteJid?.endsWith('@g.us')){
 try{ const meta = await sock.groupMetadata(m.key.remoteJid); const p = meta.participants.find(x => x.id===m.key.participant || x.lid===m.key.participant); let real = cleanId(p?.jid || p?.phoneNumber || ''); if(owners.includes(real) || real===botNum){ isOwner=true; isMismoBot=true } }catch{}
 }
 if(!isOwner && !isMismoBot) return sock.sendMessage(m.key.remoteJid, { text: `⚠️ Solo el mismo bot o el owner puede cambiar este tema` }, { quoted: m })
 let type = getBotType(sock, botNum)
 let botName = getBotName(sock, botNum, type)
 let temas = Object.keys(diseños)
 let t = (args[0]||'').toLowerCase()
 let actual = getThemeBot(sock, botNum, type)

 // ===== LISTA CON TU DISEÑO =====
 if(!t || !temas.includes(t)){
 let lista = temas.map(x => `┃🎋 ${prettyName(x)}${x===actual ? ' ☞ 𝗮𝗰𝘁𝘂𝗮𝗹' : ''}`).join('\n')
 let txt = `╭─̷̸─꯭──━─̷̸─꯭━──────╮\n┃ 🍃 *Tema de menu*\n┃─̷̸─꯭──━─̷̸─꯭━──────╯\n┃─̷̸─꯭──━─̷̸─꯭━──────╮\n${lista}\n╰─̷̸─꯭──━─̷̸─꯭━──────╯\n╭─̷̸─꯭──━─̷̸─꯭━──────╮\n┃❒ \`Usa: .setmenu (tema)\`\n┃❀ \`Bot: ${botName}\`\n┃❀ \`Tipo: ${type}\`\n╰─̷̸─꯭──━─̷̸─꯭━──────╯`
 return sendIconDoc(sock, m.key.remoteJid, m, txt, botName, botNum)
 }

 // ===== GUARDADO PERMANENTE - en todos lados + central =====
 let label = 'permanente'
 // 1. Central - este es el que lee jadi.js y nunca se borra
 try{
 const centralPath = path.join(process.cwd(),'db','subbotThemes.json')
 fs.mkdirSync(path.dirname(centralPath), { recursive: true })
 let central = {}
 if(fs.existsSync(centralPath)){ try{ central = JSON.parse(fs.readFileSync(centralPath,'utf8')) }catch{} }
 central[botNum] = t
 fs.writeFileSync(centralPath, JSON.stringify(central, null, 2))
 }catch{}
 // 2. Todos los config.json - para que cualquier loader lo encuentre
 const todosLosPaths = type==='SUBBOT'
 ? [path.join(process.cwd(),'subbots',botNum,'config.json'), path.join(process.cwd(),'jadiBots',botNum,'config.json')]
 : [path.join(process.cwd(),'principals',botNum,'config.json')]
 for(const filePath of todosLosPaths){
 try{
 fs.mkdirSync(path.dirname(filePath), { recursive: true })
 let j = {}
 if(fs.existsSync(filePath)){ try{ j = JSON.parse(fs.readFileSync(filePath,'utf8')) }catch{} }
 j.theme = t; if(!j.name) j.name = botName; if(!j.type) j.type = type==='SUBBOT' ? 'subbot' : 'principal'
 j.themeUpdatedAt = Date.now()
 fs.writeFileSync(filePath, JSON.stringify(j, null, 2))
 }catch{}
 }
 label = type==='SUBBOT' ? `subbots/${botNum} + jadiBots/${botNum} + db/subbotThemes.json` : `principals/${botNum} + db/subbotThemes.json`
 if(!sock.principalConfig) sock.principalConfig = {}
 if(!sock.subConfig) sock.subConfig = {}
 if(type==='SUBBOT') sock.subConfig.theme = t; else { sock.principalConfig.theme = t; sock.subConfig.theme = t }
 let check = getThemeBot(sock, botNum, type)
 // ===== CONFIRMACION CON EL MISMO DISEÑO =====
 let txt2 = `╭─̷̸─꯭──━─̷̸─꯭━──────╮\n┃ 🍃 *Tema cambiado*\n┃─̷̸─꯭──━─̷̸─꯭━──────╯\n┃─̷̸─꯭──━─̷̸─꯭━──────╮\n┃🎋 ${prettyName(t)} ☞ 𝗮𝗰𝘁𝘂𝗮𝗹\n╰─̷̸─꯭──━─̷̸─꯭━──────╯\n╭─̷̸─꯭──━─̷̸─꯭━──────╮\n┃❒ \`Archivo: ${label}\`\n┃❀ \`Bot: ${botName}\`\n┃❀ \`Tipo: ${type}\`\n┃❀ \`Verificado: ${check}\`\n╰─̷̸─꯭──━─̷̸─꯭━──────╯`
 return sendIconDoc(sock, m.key.remoteJid, m, txt2, botName, botNum)
}
export default handler
