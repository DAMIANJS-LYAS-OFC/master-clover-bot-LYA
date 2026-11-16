import axios from 'axios'
import fetch from 'node-fetch'
import fs from 'fs'
const DB='./db/ai_memory.json'; const HORA=60*60*1000
function loadDB(){ try{ if(fs.existsSync(DB)) return JSON.parse(fs.readFileSync(DB,'utf8')) }catch{}; return {} }
function saveDB(d){ if(!fs.existsSync('./db')) fs.mkdirSync('./db',{recursive:true}); fs.writeFileSync(DB, JSON.stringify(d)) }
function getHist(s){ const db=loadDB(); const k='ultra:'+s; if(!db[k]) return []; if(Date.now()-db[k].last>HORA){ delete db[k]; saveDB(db); return [] }; return db[k].history||[] }
function saveHist(s,h){ const db=loadDB(); db['ultra:'+s]={history:h.slice(-10), last:Date.now()}; saveDB(db) }
export const handler = {}
handler.name = 'chatgptultra'; handler.alias = ['ultra']; handler.category = 'IA'
handler.exec = async (sock, m, args) => {
 const jid = m.key.remoteJid; const sender = m.key?.participant || jid; const text = args.join(' ').trim()
 if(!text) return sock.sendMessage(jid, { text: 'Uso: .chatgptultra hola' }, { quoted: m })
 if(text==='--reset'){ const db=loadDB(); delete db['ultra:'+sender]; saveDB(db); return sock.sendMessage(jid, { text: '🧠 Memoria borrada.' }, { quoted: m }) }
 const hist = getHist(sender)
 const basePrompt = `Eres ChatGPT Ultra, la versión más potente, inteligente y detallada. Respondes con respuestas largas, completas, con ejemplos, paso a paso. Hablas en español, eres experto en todo. Si te piden código, lo das perfecto y optimizado.\n\nHistorial:\n${hist.map(h=>`${h.role}: ${h.content}`).join('\n')}`
 await sock.sendPresenceUpdate('composing', jid)
 let responseText = null
 try { const res = await axios.post('https://api.siputzx.my.id/api/ai/gemini', { prompt: basePrompt, content: text }, { timeout: 20000 }); if(res.data?.data) responseText = res.data.data; if(res.data?.result) responseText = res.data.result } catch(e){ console.log('ultra siputzx fail', e.message) }
 if(!responseText){ try{ const r = await fetch(`https://api.davidcyriltech.my.id/ai/gemini?text=${encodeURIComponent(basePrompt + "\n\nUsuario dice: " + text)}`); const j = await r.json(); if(j?.result || j?.response) responseText = j.result || j.response }catch(e){ console.log('ultra david fail', e.message) } }
 if(!responseText){ try{ const r = await fetch(`https://api-gohan-v1.onrender.com/ai/gemini?text=${encodeURIComponent(basePrompt + "\n\n" + text)}`); const j = await r.json(); if(j?.result?.text) responseText = j.result.text; else if(j?.result) responseText = j.result }catch(e){ console.log('ultra gohan fail', e.message) } }
 if(!responseText) return sock.sendMessage(jid, { text: '❌ No pude responder.' }, { quoted: m })
 let clean = responseText.replace(/\([^()]*\d{5,}[^()]*\)/g, '').trim()
 hist.push({role:'user',content:text},{role:'assistant',content:clean}); saveHist(sender,hist)
 await sock.sendMessage(jid, { text: clean }, { quoted: m })
}
export default handler
