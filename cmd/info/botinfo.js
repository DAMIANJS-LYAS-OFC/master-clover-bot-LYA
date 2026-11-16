import fs from 'fs'
import path from 'path'
import os from 'os'
import { pathToFileURL } from 'url'
import { getBotStartTime, getBotUptimeMs } from '../../lib/startTime.js'

export const handler = {}
handler.name = 'botinfo'
handler.alias = ['info', 'infobot', 'bot']
handler.category = 'general'

let config = null
try{
 const p = path.join(process.cwd(), 'config.js')
 if(fs.existsSync(p)){
 const mod = await import(pathToFileURL(p).href + '?v=' + Date.now())
 config = mod.default || mod
 }
}catch{}
if(!config) config = { bot: { prefix: ['.'], name: 'MASTER CLOVER' }, economy: { coin: 'Gemas 💎' }, channels: { id: '', cname: '' } }

function getMyData(sock){
 try{
 let num = sock?.user?.id?.split(':')[0]?.replace(/\D/g,'') || 'main'
 let isSub = false, isPrincipal = false, customName = null, customBanner = null
 const pPrincipal = path.join(process.cwd(),'principals',num,'config.json')
 const pSub1 = path.join(process.cwd(),'subbots',num,'config.json')
 const pSub2 = path.join(process.cwd(),'jadiBots',num,'config.json')
 if(fs.existsSync(pPrincipal)){
 try{ const j=JSON.parse(fs.readFileSync(pPrincipal,'utf8')); if(j.name) customName=j.name; if(j.banner) customBanner=j.banner; isPrincipal=true }catch{}
 } else if(fs.existsSync(pSub1) || fs.existsSync(pSub2)){
 const p = fs.existsSync(pSub1) ? pSub1 : pSub2
 try{ const j=JSON.parse(fs.readFileSync(p,'utf8')); if(j.name) customName=j.name; if(j.banner) customBanner=j.banner; isSub=true }catch{}
 }
 if(sock.principalConfig){ if(sock.principalConfig.name) customName=sock.principalConfig.name; if(sock.principalConfig.banner) customBanner=sock.principalConfig.banner; if(sock.isPrincipal) isPrincipal=true }
 if(sock.subConfig && !isPrincipal){ if(sock.subConfig.name) customName=sock.subConfig.name; if(sock.subConfig.banner) customBanner=sock.subConfig.banner; if(sock.isSubBot) isSub=true }
 return { isSub, isPrincipal, customName, customBanner }
 }catch{ return { isSub:false, isPrincipal:false, customName:null, customBanner:null } }
}

function fmtUptime(ms){
 const t = Math.floor(ms/1000)
 const d=Math.floor(t/86400), h=Math.floor(t%86400/3600), m=Math.floor(t%3600/60), s=Math.floor(t%60)
 if(d>0) return `${d}d ${h}h ${m}m ${s}s`
 if(h>0) return `${h}h ${m}m ${s}s`
 return `${m}m ${s}s`
}

function getBannerPayload(banner, text, channelInfo){
 const clean = String(banner).split('?')[0].toLowerCase()
 const isLocal = fs.existsSync(banner)
 const media = isLocal ? fs.readFileSync(banner) : { url: banner }
 const base = { caption: text, contextInfo: channelInfo }
 if(clean.endsWith('.mp4')) return { video: media, gifPlayback: true, ...base }
 if(clean.endsWith('.gif') || clean.endsWith('.webp')) return { video: media, gifPlayback: true, ...base }
 return { image: media, ...base }
}

handler.exec = async (sock, m) => {
 const jid = m.key.remoteJid
 const { isSub, isPrincipal, customName, customBanner } = getMyData(sock)
 const botName = customName || config.bot?.name || 'MASTER CLOVER'
 const moneda = config.economy?.coin || 'Gemas 💎'
 const prefixes = config.bot?.prefix || ['.']
 const prefixTxt = prefixes.map(p => `\`${p}\``).join(', ')

 let tipo = config.bot?.tipo || 'Principal'
 if(isPrincipal) tipo = 'Principal'
 else if(isSub) tipo = 'Sub-bot'

 const plataforma = os.platform() === 'win32' ? 'Windows' : os.platform() === 'darwin' ? 'macOS' : 'Linux'
 const nodeV = process.version
 // AHORA USA EL ARCHIVO, NO process.uptime()
 const startTime = getBotStartTime()
 const uptime = fmtUptime(getBotUptimeMs())
 const startDate = startTime.toLocaleString('es-PE', { timeZone: 'America/Lima', day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })

 const channelInfo = { forwardingScore: 999, isForwarded: true, forwardedNewsletterMessageInfo: { newsletterJid: config.channels?.id, newsletterName: config.channels?.cname, serverMessageId: -1 } }

 const text = `🍃 ☞ Información del bot *(${botName})*

❀ *𝐍𝐨𝐦𝐛𝐫𝐞 ›* ${botName}
✿ *𝐌𝐨𝐧𝐞𝐝𝐚 ›* ${moneda}
✿ *𝐏𝐫𝐞𝐟𝐢𝐣𝐨𝐬 ›* ${prefixTxt}

💻 𝐒𝐈𝐒𝐓𝐄𝐌𝐀

❒ *𝐓𝐢𝐩𝐨 ›* *(${tipo})*
❒ *𝐏𝐥𝐚𝐭𝐚𝐟𝐨𝐫𝐦𝐚 ☞* ${plataforma}
❒ *𝐍𝐨𝐝𝐞𝐉𝐬 ☞* ${nodeV}
❒ *𝐀𝐜𝐭𝐢𝐯𝐨 𝐝𝐞𝐬 𝐝𝐞 ☞* ${startDate}
❒ *𝐬𝐢𝐬𝐭𝐞𝐦𝐚 𝐚𝐜𝐭𝐢𝐯𝐨 ☞* ${uptime}
❒ *𝐃𝐞𝐯𝐞𝐥𝐨𝐩𝐞𝐫 ☞* 𐚁ᴅᴀᴍɪᴀɴᴊs-ᴏғᴄ

> \`𝐋𝐢𝐧𝐤:\` ${config.channels?.oficial || 'https://whatsapp.com/channel/0029VbDi2fiFnSz7Ibth1C1s'}`.trim()

 const bannerToUse = customBanner || config.bot?.banner || config.bot?.foto || null
 try{
 if(bannerToUse){
 await sock.sendMessage(jid, getBannerPayload(bannerToUse, text, channelInfo), { quoted: m })
 } else {
 await sock.sendMessage(jid, { text, contextInfo: channelInfo }, { quoted: m })
 }
 }catch{
 await sock.sendMessage(jid, { text }, { quoted: m })
 }
}

export default handler