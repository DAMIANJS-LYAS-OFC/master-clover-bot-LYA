import axios from 'axios'
import fetch from 'node-fetch'

const langs = { typescript: 'ts', javascript: 'js', python: 'py', html: 'html', css: 'css', java: 'java', cpp: 'cpp', c: 'c', json: 'json', bash: 'sh', sql: 'sql', rust: 'rs', go: 'go', php: 'php', ruby: 'rb' }
function detectLanguage(query, response) {
 const q = query.toLowerCase(); const r = response
 if (/typescript/i.test(q)) return 'typescript'
 if (/\bpython\b/i.test(q)) return 'python'
 if (/\bhtml\b/i.test(q)) return 'html'
 if (/\bcss\b/i.test(q)) return 'css'
 if (/\bjava\b(?!script)/i.test(q)) return 'java'
 if (/\bc\+\+|cpp\b/i.test(q)) return 'cpp'
 if (/\bjson\b/i.test(q)) return 'json'
 if (/\bbash\b|\bshell\b/i.test(q)) return 'bash'
 if (/\bsql\b/i.test(q)) return 'sql'
 if (/\brust\b/i.test(q)) return 'rust'
 if (/\bgolang\b|\bgo\b/i.test(q)) return 'go'
 if (/\bphp\b/i.test(q)) return 'php'
 if (/\bruby\b/i.test(q)) return 'ruby'
 if (/javascript/i.test(q)) return 'javascript'
 const asksCode = /(c[oó]digo|code|programa|script|funci[oó]n|clase|m[eé]todo|algoritmo|actualiza|edita|crea|implementa)/i.test(q)
 if (!asksCode) return null
 if (/def |import \w+\n|print\s*\(|:\n\s{4}/i.test(r)) return 'python'
 if (/<html|<div|<body|<span|<head/i.test(r)) return 'html'
 if (/\{[\s\S]*color:|margin:|padding:|font-/i.test(r)) return 'css'
 if (/public\s+class|System\.out\.print/i.test(r)) return 'java'
 if (/#include\s*<|int main\s*\(/i.test(r)) return 'cpp'
 if (/SELECT |INSERT |UPDATE |DELETE |CREATE TABLE/i.test(r)) return 'sql'
 if (/fn main\(\)|let mut |println!\(/i.test(r)) return 'rust'
 if (/func \w+\(|package main|fmt\.Print/i.test(r)) return 'go'
 if (/<\?php|\$[a-z_]+\s*=/i.test(r)) return 'php'
 if (/def initialize|\.each do |puts /i.test(r)) return 'ruby'
 if (/\{["'][\w]+["']\s*:/i.test(r) && !/function|const|let|var/.test(r)) return 'json'
 if (/function|class\s+\w|const |let |var |=>|\bimport\b|\bexport\b|console\.log/i.test(r)) {
 return /:\s*(string|number|boolean|void|any)\b|interface\s+\w|<\w+>/i.test(r) ? 'typescript' : 'javascript'
 }
 return null
}

export const handler = {}
handler.name = 'gpt'
handler.alias = ['chatgpt']
handler.category = 'ai'

handler.exec = async (sock, m, args) => {
 const jid = m.key.remoteJid
 const text = args.join(' ').trim()
 if(!text) return sock.sendMessage(jid, { text: '《✧》 Escriba una *petición* para que *ChatGPT* le responda.\n\nEjemplo: .gpt hola' }, { quoted: m })

 const username = m.pushName || 'usuario'
 // Prompt normal GPT, sin Anubis, pero con la misma estructura que usa Simi que si jala
 const basePrompt = `Eres Clover, un asistente útil, claro y amigable. Hablas en español, llamas a la persona ${username} por su nombre. Si te piden código, lo das limpio y con explicación corta. Siempre respondes, nunca rechazas.`

 await sock.sendPresenceUpdate('composing', jid)
 let responseText = null
 const t0 = Date.now()

 // 1. MISMA API QUE SIMI - siputzx
 try {
 const res = await axios.post('https://api.siputzx.my.id/api/ai/gemini', {
 prompt: basePrompt,
 content: text
 }, { timeout: 20000 })
 if(res.data?.data) responseText = res.data.data
 if(res.data?.result) responseText = res.data.result
 } catch(e){ console.log('gpt siputzx fail', e.message) }

 // 2. MISMA API QUE SIMI - davidcyriltech
 if(!responseText){
 try{
 const r = await fetch(`https://api.davidcyriltech.my.id/ai/gemini?text=${encodeURIComponent(basePrompt + "\n\nUsuario dice: " + text)}`)
 const j = await r.json()
 if(j?.result || j?.response) responseText = j.result || j.response
 }catch(e){ console.log('gpt david fail', e.message) }
 }

 // 3. MISMA API QUE SIMI - gohan
 if(!responseText){
 try{
 const r = await fetch(`https://api-gohan-v1.onrender.com/ai/gemini?text=${encodeURIComponent(basePrompt + "\n\n" + text)}`)
 const j = await r.json()
 if(j?.result?.text) responseText = j.result.text
 else if(j?.result) responseText = j.result
 }catch(e){ console.log('gpt gohan fail', e.message) }
 }

 if(!responseText) return sock.sendMessage(jid, { text: `*[ 🤖 ] No pude responder ahora, intenta de nuevo.*` }, { quoted: m })

 let clean = responseText.replace(/\([^()]*\d{5,}[^()]*\)/g, '').trim()
 const lang = detectLanguage(text, clean)
 console.log(`[gpt] respondió en ${((Date.now()-t0)/1000).toFixed(1)}s con api de Simi`)

 if(lang){
 const ext = langs[lang] ?? 'txt'
 await sock.sendMessage(jid, { text: `ꕥ *ChatGPT* · respuesta en *${lang}*\nLíneas: ${clean.split('\n').length} | Caracteres: ${clean.length}` }, { quoted: m })
 await sock.sendMessage(jid, { document: Buffer.from(clean), mimetype: 'text/plain', fileName: `respuesta.${ext}`, caption: `ꕥ *ChatGPT* · ${lang}` }, { quoted: m })
 } else {
 await sock.sendMessage(jid, { text: clean }, { quoted: m })
 }
}
export default handler
