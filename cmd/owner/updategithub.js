import config from '../../config.js'
import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import sharp from 'sharp'

export const handler = {}
handler.name = 'updategithub'
handler.alias = ['upgit', 'gitpush']
handler.category = 'owner'
handler.owner = true

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

const BLOCKED = ['session', 'jadiBots', 'subbots', 'node_modules', '.npm', '.env', 'temp', 'ver_temp', 'principals', '.git']

function isBlocked(path) {
 return BLOCKED.some(b => path.includes(b)) || path.startsWith('.env') || path === 'db' || path.startsWith('db/')
}

// ──── MISMO TRUCO DE DOCUMENTO DEL PING / .s ────
function cleanId(v){ return String(v||'').split('@')[0].split(':')[0].replace(/\D/g,'') }
function getBotNum(sock){ return cleanId(sock?.principalNumber || sock?.subNumber || sock?.user?.id?.split(':')[0] || '') }

function getBotName(sock, botNum){
 if(sock.principalConfig?.name) return sock.principalConfig.name
 if(sock.subConfig?.name) return sock.subConfig.name
 for(let p of [
 path.join(process.cwd(),'principals',botNum,'config.json'),
 path.join(process.cwd(),'subbots',botNum,'config.json'),
 path.join(process.cwd(),'jadiBots',botNum,'config.json'),
 ]){
 if(fs.existsSync(p)){ try{ let j=JSON.parse(fs.readFileSync(p,'utf8')); if(j.name) return j.name }catch{} }
 }
 return 'Master Clover'
}

async function sendIconDoc(sock, jid, m, captionText){
 try{
 let num = getBotNum(sock)
 const botName = getBotName(sock, num)
 const dbIconDir = path.join(process.cwd(), 'db', 'icon')
 const posibles = [
 sock.subConfig?.icon,
 sock.principalConfig?.icon,
 path.join(dbIconDir, num + '.jpg'),
 path.join(dbIconDir, num + '.png'),
 path.join(dbIconDir, num + '.webp'),
 path.join(dbIconDir, 'main.jpg')
 ]
 let iconPath = null
 for(const p of posibles){
 if(!p) continue
 if(String(p).startsWith('http')) continue
 const full = path.isAbsolute(p) ? p : path.join(process.cwd(), p)
 if(fs.existsSync(full)){ iconPath = full; break }
 }
 if(!iconPath && fs.existsSync(dbIconDir)){
 const files = fs.readdirSync(dbIconDir).filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f))
 if(files.length) iconPath = path.join(dbIconDir, files[0])
 }
 if(!iconPath) return sock.sendMessage(jid, { text: captionText }, { quoted: m })
 const original = fs.readFileSync(iconPath)
 const preview = await sharp(original).rotate().resize(160,160,{fit:'inside',withoutEnlargement:true}).jpeg({quality:65}).toBuffer({resolveWithObject:true})
 const metadataImg = await sharp(original).metadata()
 const formatos = {
 jpeg: ['jpg','image/jpeg'],
 png: ['png','image/png'],
 webp: ['webp','image/webp'],
 gif: ['gif','image/gif'],
 avif: ['avif','image/avif'],
 tiff: ['tiff','image/tiff']
 }
 let cleanName = String(botName).replace(/[\\/:*?"<>|\r\n]/g,'').trim() || 'Bot'
 const extInfo = formatos[metadataImg.format] || [path.extname(iconPath).slice(1).toLowerCase() || 'jpg','image/jpeg']
 return await sock.sendMessage(jid, {
 document: original,
 fileName: cleanName + '.' + extInfo[0],
 mimetype: extInfo[1],
 jpegThumbnail: preview.data.toString('base64'),
 thumbnailWidth: preview.info.width,
 thumbnailHeight: preview.info.height,
 caption: captionText
 }, { quoted: m })
 }catch(e){
 return sock.sendMessage(jid, { text: captionText }, { quoted: m })
 }
}

handler.exec = async (sock, m, args) => {
 const jid = m.key.remoteJid
 const q = { quoted: m }
 const send = (txt) => sendIconDoc(sock, jid, m, txt)

 if (!isOwnerDirect(m)) return await send(`╭─⛔ *ACCESO DENEGADO* ─╮\n│\n│ ⚠️ Solo el owner puede usar esto.\n│\n╰──────────────────────╯`)
 if (!fs.existsSync('.git')) return await send(`╭─❌ *ERROR* ─╮\n│ No es repo git\n╰─────────────╯`)

 if (args[0] === 'token' || args[0] === '--token') {
 const t = args[1]
 if (!t) return await send(getToken() ? `╭─✅ *TOKEN* ─╮\n│ Ya tienes token guardado.\n╰───────────────╯` : `╭─❌ *TOKEN* ─╮\n│ Usa: .updategithub token ghp_xxx\n╰────────────────╯`)
 if (!t.startsWith('ghp_') && !t.startsWith('github_pat_')) return await send(`╭─❌ *TOKEN INVÁLIDO* ─╮\n│ El token no es válido.\n╰─────────────────────╯`)
 saveToken(t)
 return await send(`╭─✅ *TOKEN GUARDADO* ─╮\n│ 🔑 Token guardado con éxito.\n│ 🔒 Guardado en db/github.json\n╰───────────────────────╯`)
 }

 if (args[0] === 'check') {
 let target = args[1] || ''
 let out = exec(`git check-ignore -v "${target}" 2>&1`)
 return await send(`╭─🔍 *CHECK* ─╮\n│ 📄 ${target}\n│\n│ ${out || '✅ No ignorado'}\n╰──────────────╯`)
 }

 if (args.length === 0) {
 return await send(
`╭─⛩️ *UPDATE GITHUB* ─╮
│
│ 📄 *SUBIR 1 ARCHIVO:*
│ ✦ .updategithub cmd/owner/ping.js
│
│ 📁 *SUBIR 1 CARPETA:*
│ ✦ .updategithub cmd
│ ✦ .updategithub cmd/owner
│
│ 💬 *CON MENSAJE:*
│ ✦ .updategithub cmd/owner/ping.js fix ping
│
│ ❌ *BLOQUEADO:*
│ ✗ .updategithub todo
│ ✗ .updategithub .
│ ✗ .updategithub --force
│
╰───────────────────╯`)
 }

 let raw = args[0]
 if (['todo', '.', './', '--force', '-f', '--all', '-A', '*', 'all'].includes(raw)) {
 return await send(
`╭─🚫 *BLOQUEADO* ─╮
│
│ ❌ "${raw}" está PROHIBIDO.
│ ✅ Solo 1 archivo o 1 carpeta
│
╰─────────────────╯`)
 }

 let target = raw
 let commitMsg = args.slice(1).join(' ') || `update ${target}`

 if (!fs.existsSync(target)) {
 return await send(`╭─❌ *NO EXISTE* ─╮\n│ 📄 ${target}\n│ No encontré ese archivo / carpeta.\n╰─────────────────╯`)
 }

 if (isBlocked(target)) {
 return await send(`╭─🚫 *BLOQUEADO POR SEGURIDAD* ─╮\n│ 🔒 "${target}" es sensible.\n╰─────────────────────────────╯`)
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

 await send(
`╭─⛩️ *SUBIENDO...* ─╮
│
│ ${icon} *${tipo}:* ${target}
│ 🌿 Branch: ${branch}
│ 🔄 Sincronizando con GitHub primero...
│ ⏳ Espera un momento...
│
╰───────────────────╯`)

 exec(`git config user.email "bot@clover.com"`)
 exec(`git config user.name "Clover Bot"`)

 exec(`git stash push -m "updategithub-auto"`)
 exec(`git fetch origin`)
 let pull = exec(`git pull --rebase origin ${branch} 2>&1`)
 let pop = exec(`git stash pop 2>&1`)

 if (pull.toLowerCase().includes('conflict') || pull.toLowerCase().includes('error: cannot pull') || pop.toLowerCase().includes('conflict')) {
 exec(`git rebase --abort 2>&1`)
 return await send(
`╭─❌ *CONFLICTO* ─╮
│
│ GitHub y tu bot tocaron el mismo archivo.
│ Arreglalo en la PC con:
│ git status
│ git add .
│ git rebase --continue
│
│ Pull: ${pull.slice(0, 800)}
│ Pop: ${pop.slice(0, 800)}
│
╰──────────────────╯`)
 }

 exec(`git reset`)
 exec(`git add -- "${target}"`)

 let stagedList = exec(`git diff --cached --name-only -- "${target}"`).split('\n').filter(Boolean)
 stagedList = stagedList.filter(f => !isBlocked(f))

 if (stagedList.length === 0) {
 return await send(
`╭─✅ *NADA PARA SUBIR* ─╮
│
│ ${icon} ${target}
│ Ya estaba todo subido.
│ Lo demás quedó en tu PC, no se subió.
│
╰──────────────────────╯`)
 }

 exec(`git commit -m "${commitMsg.replace(/"/g, '\\"')}" -- "${target}"`)
 let push = pushUrl ? exec(`git push ${pushUrl} ${branch} 2>&1`) : exec(`git push origin ${branch} 2>&1`)
 if (token) push = push.split(token).join('***TOKEN***')

 if (push.toLowerCase().includes('error') || push.toLowerCase().includes('failed') || push.toLowerCase().includes('rejected')) {
 await send(`╭─❌ *ERROR PUSH* ─╮\n│\n│ ${push.slice(0, 2500)}\n│\n╰──────────────────╯`)
 } else {
 await send(
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
╰────────────────────╯`)
 }
}

export default handler
