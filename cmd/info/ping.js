import os from 'os'
import fs from 'fs'
import path from 'path'
import { createCanvas } from '@napi-rs/canvas'
import { getBotUptimeMs } from '../../lib/startTime.js'

export const handler = {}
handler.name = 'ping'
handler.alias = ['p']
handler.category = 'general'

function getBotName(sock){
 try{
 let num = sock?.user?.id?.split(':')[0]?.replace(/\D/g,'') || 'main'
 let customName = null
 const pPrincipal = path.join(process.cwd(),'principals',num,'config.json')
 const pSub1 = path.join(process.cwd(),'subbots',num,'config.json')
 const pSub2 = path.join(process.cwd(),'jadiBots',num,'config.json')
 if(fs.existsSync(pPrincipal)){
 try{ const j=JSON.parse(fs.readFileSync(pPrincipal,'utf8')); if(j.name) customName=j.name }catch{}
 } else if(fs.existsSync(pSub1) || fs.existsSync(pSub2)){
 const p = fs.existsSync(pSub1) ? pSub1 : pSub2
 try{ const j=JSON.parse(fs.readFileSync(p,'utf8')); if(j.name) customName=j.name }catch{}
 }
 if(sock.principalConfig?.name) customName = sock.principalConfig.name
 if(sock.subConfig?.name) customName = sock.subConfig.name
 return customName || 'MASTER CLOVER'
 }catch{ return 'MASTER CLOVER' }
}

function formatBytes(b){
 if(!b) return '0 B'
 const k=1024
 const sizes=['B','KB','MB','GB']
 const i=Math.floor(Math.log(b)/Math.log(k))
 return parseFloat((b/Math.pow(k,i)).toFixed(1))+' '+sizes[i]
}
function fmtUptime(ms){
 const t=Math.floor(ms/1000)
 const d=Math.floor(t/86400), h=Math.floor(t%86400/3600), m=Math.floor(t%3600/60), s=Math.floor(t%60)
 if(d>0) return `${d}d ${h}h ${m}m`
 if(h>0) return `${h}h ${m}m`
 return `${m}m ${s}s`
}
function getTotalUsers(){
 try{
 if(fs.existsSync('./db/database.json')){
 let db = JSON.parse(fs.readFileSync('./db/database.json','utf-8'))
 let data = db.data || db
 if(data.allUsers) return Object.keys(data.allUsers).length
 if(data.users){
 let s = new Set()
 for(let g in data.users) for(let u in data.users[g]) s.add(u)
 return s.size
 }
 }
 }catch{}
 try{
 if(global.db?.data?.allUsers) return Object.keys(global.db.data.allUsers).length
 if(global.db?.data?.users) return Object.keys(global.db.data.users).length
 }catch{}
 return 0
}

handler.exec = async (sock, m) => {
 const jid = m.key.remoteJid
 const start = Date.now()
 const botName = getBotName(sock)

 const totalMem = os.totalmem()
 const freeMem = os.freemem()
 const usedMem = totalMem - freeMem
 const memPercent = usedMem / totalMem * 100
 const host = os.hostname()
 const botUptime = fmtUptime(getBotUptimeMs())
 const cpus = os.cpus()
 const cpuModel = cpus[0]?.model?.replace(/\s+/g,' ').slice(0,28) || 'Unknown'
 const cores = cpus.length
 const load = os.loadavg()[0].toFixed(2)
 const usersCount = getTotalUsers()
 const latency = Date.now() - start

 let diskTotal='N/A', diskFree='N/A', diskUsed='N/A'
 try{
 const s = fs.statfsSync(process.cwd())
 diskTotal = formatBytes(s.blocks * s.bsize)
 diskFree = formatBytes(s.bfree * s.bsize)
 diskUsed = formatBytes((s.blocks - s.bfree) * s.bsize)
 }catch{}

 const W=800, H=460
 const canvas = createCanvas(W,H)
 const ctx = canvas.getContext('2d')
 ctx.fillStyle='#0c101e'; ctx.fillRect(0,0,W,H)
 ctx.strokeStyle='rgba(80,100,140,0.08)'; ctx.lineWidth=1
 for(let i=0;i<W;i+=28){ ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i,H); ctx.stroke() }
 for(let i=0;i<H;i+=28){ ctx.beginPath(); ctx.moveTo(0,i); ctx.lineTo(W,i); ctx.stroke() }

 ctx.textAlign='left'; ctx.textBaseline='alphabetic'
 ctx.fillStyle='#4ec9ff'; ctx.font='bold 32px sans-serif'
 ctx.fillText('SYSTEM DIAGNOSTICS',30,52)
 ctx.fillStyle='#aab4c8'; ctx.font='bold 14px sans-serif'
 ctx.fillText(`${botName.toUpperCase()} | ${latency}ms | ${usersCount} users`,30,76)

 const cx=400, cy=250, r=90
 ctx.lineCap='round'
 ctx.strokeStyle='rgba(255,255,255,0.10)'; ctx.lineWidth=16
 ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.stroke()
 ctx.strokeStyle='#4eff8a'; ctx.lineWidth=16
 ctx.beginPath(); ctx.arc(cx,cy,r,-Math.PI/2, -Math.PI/2 + (Math.PI*2*memPercent/100)); ctx.stroke()

 ctx.textAlign='center'; ctx.textBaseline='middle'
 ctx.fillStyle='#ffffff'; ctx.font='bold 40px sans-serif'
 ctx.fillText(`${memPercent.toFixed(1)}%`, cx, cy-8)
 ctx.fillStyle='#4eff8a'; ctx.font='bold 13px sans-serif'
 ctx.fillText('RAM USAGE', cx, cy+28)

 ctx.textAlign='left'
 ctx.fillStyle='rgba(255,255,255,0.10)'; ctx.fillRect(60,390,680,12)
 ctx.fillStyle='#4ec9ff'; ctx.fillRect(60,390,680 * (memPercent/100),12)
 ctx.fillStyle='#aab4c8'; ctx.font='bold 12px sans-serif'
 ctx.fillText(`${formatBytes(usedMem)} / ${formatBytes(totalMem)}`, 60, 425)
 ctx.textAlign='right'
 ctx.fillText(`${cores} CORES | LOAD ${load}`, 740, 425)
 ctx.textAlign='left'

 const img = await canvas.encode('png')

 const text = `*◥ Estado del bot ◤*
❏ Host: *${host}*
❏ SO: *Linux*
❏ Uptime: *${botUptime}*
❏ Ping: *${latency}ms*
────────────────
*◥ RAM ◤*
✠ Total: *${formatBytes(totalMem)}*
✠ Usada: *${formatBytes(usedMem)} (${memPercent.toFixed(1)}%)*
✠ Libre: *${formatBytes(freeMem)}*
────────────────
*◥ INFO BOT ◤*
仝 Usuarios: *${usersCount}*
仝 Bot: *${botName}*
────────────────
*◥ CPU ◤*
❍ Modelo: *${cpuModel}*
❍ Núcleos: *${cores}*
❍ Carga: *${load}*
────────────────
*◥ Disco ◤*
❅ Total: *${diskTotal}*
❅ Usado: *${diskUsed}*
❅ Libre: *${diskFree}*`.trim()

 await sock.sendMessage(jid, { image: img, caption: text }, { quoted: m })
}

export default handler
