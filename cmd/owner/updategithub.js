import config from '../../config.js'
import { execSync } from 'child_process'
import fs from 'fs'

// ╔══════════════════════════════════╗
// ║ ⛩️ UPDATE GITHUB ║
// ║ 👑 Dueño: DAMIANJS-LYAS-OFC ║
// ║ 📦 Sube SOLO lo que elijas ║
// ║ ❌ NUNCA sube todo el bot ║
// ╚══════════════════════════════════╝

export const handler = {}
handler.name = 'updategithub'
handler.alias = ['upgit', 'gitpush']
handler.category = 'owner'
handler.owner = true

// ──── 🛠️ HELPERS ────
function getOwners() {
 return (config?.bot?.owner || [])
 .map(n => n.toString().split('@')[0].replace(/\D/g, ''))
 .filter(Boolean)
}

function isOwnerDirect(m) {
 let raw = m.key?.participant || m.key?.remoteJid || ''
 let clean = raw.split('@')[0].split(':')[0].replace(/\D/g, '')
 if (m.key?.fromMe) return true
 return getOwners().includes(clean) || config.bot.owner.includes(raw)
}

function exec(cmd) {
 try {
 return execSync(cmd, { encoding: 'utf-8', stdio: 'pipe', timeout: 60000 }).trim()
 } catch (e) {
 return ((e.stdout?.toString() || '') + '\n' + (e.stderr?.toString() || e.message)).trim()
 }
}

function getToken() {
 if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN
 if (fs.existsSync('./db/github.json')) {
 try { return JSON.parse(fs.readFileSync('./db/github.json', 'utf-8')).token } catch {}
 }
 return null
}

function saveToken(token) {
 if (!fs.existsSync('./db')) fs.mkdirSync('./db', { recursive: true })
 fs.writeFileSync('./db/github.json', JSON.stringify({ token, savedAt: Date.now() }))
}

// 🚫 BLOQUEADOS SIEMPRE
const BLOCKED = ['session', 'jadiBots', 'subbots', 'node_modules', '.npm', '.env', 'temp', 'ver_temp', 'principals', '.git']

function isBlocked(path) {
 return BLOCKED.some(b => path.includes(b)) || path.startsWith('.env') || path === 'db' || path.startsWith('db/')
}

// ═══════════════════════════════════════════
// 🚀 COMANDO PRINCIPAL
// ═══════════════════════════════════════════
handler.exec = async (sock, m, args) => {
 const jid = m.key.remoteJid
 const q = { quoted: m }

 // 👑 Solo owner
 if (!isOwnerDirect(m)) return await sock.sendMessage(jid, { text: `╭─⛔ *ACCESO DENEGADO* ─╮\n│\n│ ⚠️ Solo el owner puede usar esto.\n│ 👑 @DAMIANJS-LYAS-OFC\n│\n╰──────────────────────╯` }, q)
 if (!fs.existsSync('.git')) return await sock.sendMessage(jid, { text: `╭─❌ *ERROR* ─╮\n│ No es repo git\n╰─────────────╯` }, q)

 // 🔑 Guardar token
 if (args[0] === 'token' || args[0] === '--token') {
 const t = args[1]
 if (!t) return await sock.sendMessage(jid, { text: getToken() ? `╭─✅ *TOKEN* ─╮\n│ Ya tienes token guardado.\n╰───────────────╯` : `╭─❌ *TOKEN* ─╮\n│ Usa: .updategithub token ghp_xxx\n╰────────────────╯` }, q)
 if (!t.startsWith('ghp_') && !t.startsWith('github_pat_')) return await sock.sendMessage(jid, { text: `╭─❌ *TOKEN INVÁLIDO* ─╮\n│ El token no es válido.\n╰─────────────────────╯` }, q)
 saveToken(t)
 return await sock.sendMessage(jid, { text: `╭─✅ *TOKEN GUARDADO* ─╮\n│ 🔑 Token guardado con éxito.\n│ 🔒 Guardado en db/github.json\n╰───────────────────────╯` }, q)
 }

 // 🔍 Check
 if (args[0] === 'check') {
 let target = args[1] || ''
 let out = exec(`git check-ignore -v "${target}" 2>&1`)
 return await sock.sendMessage(jid, { text: `╭─🔍 *CHECK* ─╮\n│ 📄 ${target}\n│\n│ ${out || '✅ No ignorado'}\n╰──────────────╯` }, q)
 }

 // 📖 Ayuda
 if (args.length === 0) {
 return await sock.sendMessage(jid, { text:
`╭─⛩️ *UPDATE GITHUB* ─╮
│
│ 📄 *SUBIR 1 ARCHIVO:*
│ ✦ .updategithub cmd/owner/ping.js
│ ✦ .updategithub config.js
│
│ 📁 *SUBIR 1 CARPETA:*
│ ✦ .updategithub cmd
│ ✦ .updategithub cmd/owner
│ ✦ .updategithub plugins
│
│ 💬 *CON MENSAJE:*
│ ✦ .updategithub cmd fix cmd
│ ✦ .updategithub cmd/owner/ping.js fix ping
│
│ ───────────────
│ ❌ *BLOQUEADO:*
│ ✗ .updategithub todo
│ ✗ .updategithub .
│ ✗ .updategithub --force
│ ✗ .updategithub -f
│
│ 🔑 *OTROS:*
│ ✦ .updategithub token ghp_xxx
│ ✦ .updategithub check cmd/owner/ping.js
│
╰───────────────────╯` }, q)
 }

 // 🚫 BLOQUEAR todo, ., --force
 let raw = args[0]
 if (['todo', '.', './', '--force', '-f', '--all', '-A', '*', 'all'].includes(raw)) {
 return await sock.sendMessage(jid, { text:
`╭─🚫 *BLOQUEADO* ─╮
│
│ ❌ "${raw}" está PROHIBIDO.
│
│ ✅ Solo 1 archivo o 1 carpeta:
│ ✦ .updategithub cmd
│ ✦ .updategithub cmd/owner/ping.js
│
╰─────────────────╯` }, q)
 }

 let target = raw
 let commitMsg = args.slice(1).join(' ') || `update ${target}`

 if (!fs.existsSync(target)) {
 return await sock.sendMessage(jid, { text:
`╭─❌ *NO EXISTE* ─╮
│
│ 📄 ${target}
│ No encontré ese archivo / carpeta.
│
│ ✅ Ejemplo:
│ ✦ .updategithub cmd
│ ✦ .updategithub cmd/owner/ping.js
│
╰─────────────────╯` }, q)
 }

 if (isBlocked(target)) {
 return await sock.sendMessage(jid, { text:
`╭─🚫 *BLOQUEADO POR SEGURIDAD* ─╮
│
│ 🔒 "${target}" es sensible.
│ No se puede subir: session, db, .env, node_modules
│
╰─────────────────────────────╯` }, q)
 }

 let isDir = fs.statSync(target).isDirectory()
 let icon = isDir ? '📁' : '📄'
 let tipo = isDir ? 'CARPETA' : 'ARCHIVO'

 const branch = exec('git branch --show-current') || 'main'
 let remoteUrl = exec('git remote get-url origin')
 let token = getToken()
 let pushUrl = null
 if (token && remoteUrl.includes('github.com') && remoteUrl.startsWith('https://')) {
 let clean = remoteUrl.replace('https://', '').replace(/^.*@/, '')
 pushUrl = `https://${token}@${clean}`
 }

 await sock.sendMessage(jid, { text:
`╭─⛩️ *SUBIENDO...* ─╮
│
│ ${icon} *${tipo}:* ${target}
│ 🌿 Branch: ${branch}
│ ⏳ Espera un momento...
│
╰───────────────────╯` }, q)

 exec(`git config user.email "bot@clover.com"`)
 exec(`git config user.name "Clover Bot"`)

 // 🧹 LIMPIAR STAGING VIEJO - ESTO ES LO QUE ANTES SUBÍA TODO
 exec(`git reset`)
 // ✅ SOLO ESTA CARPETA / ARCHIVO, sin -f, sin -A global
 exec(`git add -- "${target}"`)

 // Ver qué quedó en staging SOLO de este target
 let stagedList = exec(`git diff --cached --name-only -- "${target}"`).split('\n').filter(Boolean)
 // Filtrar si hay algo sensible que se coló
 stagedList = stagedList.filter(f => !isBlocked(f))

 if (stagedList.length === 0) {
 return await sock.sendMessage(jid, { text:
`╭─✅ *NADA PARA SUBIR* ─╮
│
│ ${icon} ${target}
│ Ya estaba todo subido.
│
╰──────────────────────╯` }, q)
 }

 exec(`git commit -m "${commitMsg.replace(/"/g, '\\"')}" -- "${target}"`)
 let push = pushUrl ? exec(`git push ${pushUrl} ${branch} 2>&1`) : exec(`git push origin ${branch} 2>&1`)

 if (push.toLowerCase().includes('error') || push.toLowerCase().includes('failed')) {
 await sock.sendMessage(jid, { text:
`╭─❌ *ERROR PUSH* ─╮
│
│ ${push.slice(0, 2500)}
│
╰──────────────────╯` }, q)
 } else {
 await sock.sendMessage(jid, { text:
`╭─✅ *PUSH EXITOSO* ─╮
│
│ ${icon} *SOLO SE SUBIÓ:*
│ 📦 ${target}
│
│ 📄 *Archivos subidos (${stagedList.length}):*
│ ${stagedList.slice(0, 20).map(f => `│ ✦ ${f}`).join('\n')}
${stagedList.length > 20 ? `│ ... y ${stagedList.length - 20} más` : ''}
│
│ 📌 ${exec('git log -1 --oneline')}
│ 🌿 Branch: ${branch}
│
╰────────────────────╯` }, q)
 }
}

export default handler
