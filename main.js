import 'dotenv/config'
import fs from 'fs'
import path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import config from './config.js'
import { connectDB, registerUser, syncUserName, addExp } from './lib/db.js'
import { handleEventos } from './core/eventos.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export const commands = new Map()
global.plugins = commands
global.corruptedPlugins = []

const DB_PATH = './db/database.json'
const SETTINGS_PATH = './db/settings.json'
const GROUPS_PATH = './db/groups.json'
const PRIMARY_PATH = './db/primary.json'
const BOT_ENABLED_PATH = './db/sub_enabled.json'

if (!global.afkUsers) global.afkUsers = new Map()

let settingsCache = { mode: 'prefix', time: 0 }
let groupsCache = { data: {}, time: 0 }
let primaryCache = { data: {}, time: 0 }
let lastSave = 0

const pendingExp = new Map()
let expSaveTimeout = null

async function processPendingExp() {
 if (pendingExp.size === 0) {
  expSaveTimeout = null
  return
 }
 const entries = Array.from(pendingExp.entries())
 pendingExp.clear()
 for (const [number, data] of entries) {
  try {
   const result = await addExp(number, data.amount, data.name)
   if (result?.leveledUp && data.jid) {
    console.log(`[LVL UP] ${number} subió a nivel ${result.lvl}`)
   }
  } catch (e) {}
 }
 expSaveTimeout = null
}

export async function start() {
 await connectDB()
 return true
}

function queueExp(number, amount, name, jid) {
 if (!pendingExp.has(number)) pendingExp.set(number, { amount: 0, name, jid })
 const data = pendingExp.get(number)
 data.amount += amount
 data.name = name
 data.jid = jid
 if (!expSaveTimeout) expSaveTimeout = setTimeout(processPendingExp, 120000)
 if (pendingExp.size >= 10) processPendingExp()
}

function cleanNumber(raw) {
 if (!raw) return ''
 let s = String(raw)
 if (s.includes('@')) s = s.split('@')[0]
 if (s.includes(':')) s = s.split(':')[0]
 return s.replace(/\D/g, '')
}

function normalizeJid(raw) {
 if (!raw) return ''
 const num = cleanNumber(raw)
 return num ? num + '@s.whatsapp.net' : ''
}

function loadPrimary() {
 if (Date.now() - primaryCache.time < 5000) return primaryCache.data
 try {
  if (fs.existsSync(PRIMARY_PATH)) {
   primaryCache = { data: JSON.parse(fs.readFileSync(PRIMARY_PATH, 'utf-8')), time: Date.now() }
  } else {
   primaryCache = { data: {}, time: Date.now() }
  }
 } catch { primaryCache = { data: {}, time: Date.now() } }
 return primaryCache.data
}

async function resolveJid(jid, sock, groupId) {
 if (!jid) return ''
 const clean = cleanNumber(jid)
 if (!String(jid).endsWith('@lid')) return clean
 try {
  if (groupId && sock?.groupMetadata) {
   const meta = await sock.groupMetadata(groupId)
   for (const p of meta?.participants || []) {
    const lidBase = p.lid?.split('@')[0]
    const idBase = p.id?.split('@')[0]
    if (lidBase === clean || idBase === clean) {
     if (p.phoneNumber) return cleanNumber(p.phoneNumber)
     if (p.id && !p.id.endsWith('@lid')) return cleanNumber(p.id)
    }
   }
  }
  const lm = sock?.signalRepository?.lidMapping
  if (lm?.getPNForLID) {
   const pn = await Promise.race([
    lm.getPNForLID(jid),
    new Promise(r => setTimeout(() => r(null), 2000))
   ])
   if (pn) return cleanNumber(pn)
  }
 } catch {}
 return clean
}

// El comando .bot y main usan exactamente la misma clave por cuenta y grupo.
function getBotNumber(sock) {
 return cleanNumber(sock.user?.id || sock.user?.jid || sock.user?.lid || '')
}

// Sin cache: .bot on/off debe reflejarse en el siguiente mensaje.
function botEnabledInGroup(sock, jid) {
 const botNumber = getBotNumber(sock)
 if (!botNumber) {
  console.warn('[BOT CONTROL] No se pudo identificar la cuenta para consultar el estado')
  return true
 }
 try {
  if (!fs.existsSync(BOT_ENABLED_PATH)) return true
  const data = JSON.parse(fs.readFileSync(BOT_ENABLED_PATH, 'utf-8'))
  return data?.[botNumber]?.[jid] !== false
 } catch (e) {
  console.error('[BOT CONTROL] No se pudo leer sub_enabled.json:', e.message)
  return true
 }
}

// Conserva separadas las identidades de teléfono y LID.
function identity(raw) {
 if (typeof raw !== 'string' && typeof raw !== 'number') return ''
 const value = String(raw).trim().toLowerCase()
 const number = cleanNumber(value)
 if (!number) return ''
 if (value.endsWith('@lid')) return `lid:${number}`
 if (value.includes('@') && !/@(?:s\.whatsapp\.net|c\.us)$/.test(value)) return ''
 return `pn:${number}`
}

function ownerValues(value) {
 if (!value) return []
 if (Array.isArray(value)) return value.flatMap(ownerValues)
 if (typeof value === 'object') {
  return [value.id, value.jid, value.number, value.phone, value.lid].flatMap(ownerValues)
 }
 if (typeof value === 'string') return value.split(/[,;\s]+/).filter(Boolean)
 if (typeof value === 'number') return [String(value)]
 return []
}

function getSenderIdentities(msg, senderRaw, senderResolved) {
 const rawIds = [
  senderRaw,
  msg.key?.participant,
  msg.key?.participantAlt,
  msg.key?.senderPn,
  msg.participant,
  msg.sender
 ].filter(Boolean)
 const result = new Set(rawIds.map(identity).filter(Boolean))
 // Agregar el número resuelto solo si es distinto al LID original.
 const resolved = cleanNumber(senderResolved)
 const original = cleanNumber(senderRaw)
 if (resolved && (!String(senderRaw).endsWith('@lid') || resolved !== original)) {
  result.add(`pn:${resolved}`)
 }
 return result
}

function getPermissions(sock, msg, senderRaw, senderResolved) {
 const senderIds = getSenderIdentities(msg, senderRaw, senderResolved)
 const botId = identity(sock.user?.id || sock.user?.jid || '')
 const isSelf = msg.key?.fromMe === true || (botId && senderIds.has(botId))
 const configuredOwners = [config.bot?.owner, config.owner]
 const owners = new Set(configuredOwners.flatMap(ownerValues).map(identity).filter(Boolean))
 const isOwner = Boolean(isSelf || [...senderIds].some(id => owners.has(id)))
 return { isOwner, isSelf, senderIds }
}

async function isGroupAdmin(sock, jid, senderIds) {
 if (!senderIds.size) return false
 try {
  const meta = await sock.groupMetadata(jid)
  return (meta?.participants || []).some(p => {
   if (p.admin !== 'admin' && p.admin !== 'superadmin') return false
   const ids = [p.id, p.jid, p.lid, p.phoneNumber]
    .map(identity)
    .filter(Boolean)
   return ids.some(id => senderIds.has(id))
  })
 } catch (e) {
  console.warn('[BOT CONTROL] No se pudo verificar los admins:', e.message)
  return false
 }
}

function loadDB() {
 try {
  if (fs.existsSync(DB_PATH)) {
   let raw = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'))
   global.db = { data: raw.data || raw }
  } else {
   global.db = { data: { users: {}, codes: {}, chats: {}, settings: { prefixMode: 'prefix' } } }
  }
 } catch {
  global.db = { data: { users: {}, codes: {}, chats: {}, settings: { prefixMode: 'prefix' } } }
 }
 if (!global.db.data) global.db.data = { users: {}, codes: {}, chats: {}, settings: { prefixMode: 'prefix' } }
 if (!global.db.data.users) global.db.data.users = {}
 if (!global.db.data.codes) global.db.data.codes = {}
 if (!global.db.data.chats) global.db.data.chats = {}
 if (!global.db.data.settings) global.db.data.settings = { prefixMode: 'prefix' }
}

function saveDB(force = false) {
 if (!force && Date.now() - lastSave < 15000) return
 lastSave = Date.now()
 try { fs.writeFileSync(DB_PATH, JSON.stringify(global.db.data)) } catch {}
}

loadDB()
global.saveDB = () => saveDB(true)
setInterval(() => saveDB(true), 30000)

function getSettings() {
 if (Date.now() - settingsCache.time < 15000) return settingsCache.mode
 try {
  if (fs.existsSync(SETTINGS_PATH)) {
   let s = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf-8'))
   settingsCache = { mode: s.prefixMode || 'prefix', time: Date.now() }
  } else {
   settingsCache = { mode: global.db?.data?.settings?.prefixMode || 'prefix', time: Date.now() }
  }
 } catch { settingsCache = { mode: 'prefix', time: Date.now() } }
 return settingsCache.mode
}

function getGroups() {
 if (Date.now() - groupsCache.time < 20000) return groupsCache.data
 try {
  if (fs.existsSync(GROUPS_PATH)) groupsCache = { data: JSON.parse(fs.readFileSync(GROUPS_PATH, 'utf-8')), time: Date.now() }
  else groupsCache = { data: {}, time: Date.now() }
 } catch { groupsCache = { data: {}, time: Date.now() } }
 return groupsCache.data
}

function saveGroups(groups) {
 groupsCache = { data: groups, time: Date.now() }
 try { fs.writeFileSync(GROUPS_PATH, JSON.stringify(groups)) } catch {}
}

export async function loadPlugins() {
 commands.clear()
 global.corruptedPlugins = []
 const folder = path.join(__dirname, 'cmd')
 if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true })
 function getAllJsFiles(dir, fileList = []) {
  try {
   const files = fs.readdirSync(dir)
   for (const file of files) {
    const full = path.join(dir, file)
    try {
     const stat = fs.statSync(full)
     if (stat.isDirectory()) getAllJsFiles(full, fileList)
     else if (file.endsWith('.js')) fileList.push(full)
    } catch {}
   }
  } catch {}
  return fileList
 }
 const files = getAllJsFiles(folder).sort()
 let ok = 0, fail = 0
 let corrupted = []
 console.log(`───────────────────────────────────`)
 for (const fullPath of files) {
  const rel = path.relative(folder, fullPath)
  try {
   const mod = await import(pathToFileURL(fullPath).href + `?t=${Date.now()}`)
   const h = mod.default || mod.handler
   if (!h?.name || !h?.exec) throw new Error('sin handler.name o handler.exec')
   commands.set(h.name.toLowerCase(), h)
   if (h.alias) for (const a of h.alias) commands.set(a.toLowerCase(), h)
   console.log(`🍭 Cargado › ${rel}`)
   ok++
  } catch (e) {
   console.log(`🏮 Error cmd › ${rel} - ${e.message}`)
   corrupted.push({ file: rel, error: e.message })
   fail++
  }
 }
 console.log(`───────────────────────────────────`)
 console.log(`✔ ${ok} comandos | ✖ ${fail} errores\n`)
 global.corruptedPlugins = corrupted
 return ok
}

function getContentType(message) {
 if (!message) return ''
 const keys = Object.keys(message)
 return keys.find(k => k.endsWith('Message')) || keys[0] || ''
}

function extractBody(message) {
 if (!message) return ''
 if (message.conversation) return message.conversation
 if (message.extendedTextMessage?.text) return message.extendedTextMessage.text
 if (message.imageMessage?.caption) return message.imageMessage.caption
 if (message.videoMessage?.caption) return message.videoMessage.caption
 if (message.buttonsResponseMessage?.selectedButtonId) return message.buttonsResponseMessage.selectedButtonId
 if (message.listResponseMessage?.singleSelectReply?.selectedRowId) return message.listResponseMessage.singleSelectReply.selectedRowId
 if (message.templateButtonReplyMessage?.selectedId) return message.templateButtonReplyMessage.selectedId
 if (message.interactiveResponseMessage) {
  let native = message.interactiveResponseMessage.nativeFlowResponseMessage
  if (native?.paramsJson) {
   try {
    let json = JSON.parse(native.paramsJson)
    if (json.id) return json.id
    if (json.params_v2) {
     try {
      let p2 = JSON.parse(json.params_v2)
      if (Array.isArray(p2) && p2[0]?.id) return p2[0].id
     } catch {}
    }
   } catch {}
   try {
    let j = JSON.parse(native.paramsJson)
    if (j.id) return j.id
   } catch {
    return native.paramsJson
   }
  }
  if (message.interactiveResponseMessage.body?.text) return message.interactiveResponseMessage.body.text
 }
 return ''
}

function parseCommand(body) {
 const mode = getSettings()
 if (mode === 'no') {
  const parts = body.trim().split(/ +/)
  const name = parts.shift()?.toLowerCase() || ''
  return { cmdName: name, args: parts }
 }
 const prefixes = [].concat(config.bot?.prefix || ['.', '#', '/', '!'])
 const prefixUsed = prefixes.find(p => typeof p === 'string' && p && body.startsWith(p))
 if (!prefixUsed) return { cmdName: '', args: [] }
 const parts = body.slice(prefixUsed.length).trim().split(/ +/)
 const name = parts.shift()?.toLowerCase() || ''
 return { cmdName: name, args: parts }
}

export async function handleMessages(sock, upsert) {
 try {
  if (upsert.type !== 'notify') return
  const msg = upsert.messages?.[0]
  if (!msg?.message) return
  const jid = msg.key.remoteJid
  if (!jid) return
  const isGroup = jid.endsWith('@g.us')
  const senderRaw = msg.key.participant || jid
  const senderClean = cleanNumber(senderRaw)
  const body = extractBody(msg.message)
  if (!body) return
  const pushName = msg.pushName || 'Usuario'
  const type = getContentType(msg.message)

  const senderResolved = await resolveJid(senderRaw, sock, isGroup ? jid : null)
  const who = senderResolved || senderClean
  const where = isGroup ? jid : 'privado'
  const preview = body.slice(0, 80) + (body.length > 80 ? '...' : '')
  console.log(`[${type}] ${pushName} (${who}) en ${where}: ${preview}`)

  // Leer el comando antes de eventos, para permitir .bot on aunque esté OFF.
  const { cmdName, args } = parseCommand(body)
  const cmd = cmdName ? commands.get(cmdName) : null
  const isBotControl = Boolean(cmd && String(cmd.name).toLowerCase() === 'sbot')

  // Mantener la selección de bot principal que ya existía.
  if (isGroup) {
   const primaryData = loadPrimary()
   const primaryForGroup = primaryData[jid]
   const isSetPrimaryCmd = /^\.(setprimary|setbot|primary)(?:\s|$)/i.test(body.trim())
   if (primaryForGroup && !isSetPrimaryCmd) {
    const myNumber = cleanNumber(sock.user?.id || sock.principalNumber || sock.subNumber || sock.authState?.creds?.me?.id || '')
    const primaryClean = cleanNumber(primaryForGroup)
    if (myNumber && primaryClean && myNumber !== primaryClean) return
   }
  }

  // APAGADO REAL: antes de eventos, respuestas automáticas y comandos.
  // .bot/.sbot y sus alias siguen disponibles para volver a encenderlo.
  if (isGroup && !botEnabledInGroup(sock, jid) && !isBotControl) return

  registerUser(who, pushName).catch(() => {})
  syncUserName(who, pushName).catch(() => {})

  // Los comandos de control no deben quedar bloqueados por antispam/mute.
  if (!isBotControl) {
   const bloqueado = await handleEventos(sock, msg, body, {
    jid, commands, senderJid: senderRaw
   })
   if (bloqueado) return
  }

  const isAfkCmd = body.toLowerCase().startsWith('.afk')
  if (global.afkUsers.has(who) && !isAfkCmd) {
   global.afkUsers.delete(who)
   try {
    await sock.sendMessage(jid, {
     text: `> @${who} volvió`,
     mentions: [normalizeJid(who)]
    }, { quoted: msg })
   } catch {}
  }

  if (!cmdName || !cmd) return
  let groups = getGroups()
  if (isGroup && groups[jid] === undefined) {
   groups[jid] = true
   saveGroups(groups)
  }

  const { isOwner, isSelf, senderIds } = getPermissions(sock, msg, senderRaw, senderResolved)
  if (cmd.owner && !isOwner) return

  // La consulta es real: no confiar en el nombre visible ni en el tipo de bot.
  const isAdmin = isGroup && isBotControl
   ? await isGroupAdmin(sock, jid, senderIds)
   : false

  console.log(`[CMD] ${cmdName} de ${pushName} (${who}) en ${jid}`)

  let users = global.db.data.users
  let groupId = isGroup ? jid : 'global'
  if (!users[groupId]) users[groupId] = {}
  const senderKey = who
  if (!users[groupId][senderKey]) {
   users[groupId][senderKey] = { coins: 0, bank: 0, totalCommands: 0, commands: {}, exp: 0, harem: [], cmds: 0 }
  }
  let u = users[groupId][senderKey]
  if (!u.commands) u.commands = {}
  if (pushName) u.name = pushName
  u.totalCommands = (u.totalCommands || 0) + 1
  u.cmds = (u.cmds || 0) + 1
  u.commands[cmdName] = (u.commands[cmdName] || 0) + 1
  u.lastCmd = cmdName
  u.lastCmdTime = Date.now()
  saveDB()

  queueExp(who, 3, pushName, jid)

  await cmd.exec(sock, msg, args, {
   commands,
   groups,
   saveGroups: () => saveGroups(groups),
   groupsPath: GROUPS_PATH,
   db: global.db,
   users,
   saveDB: () => saveDB(true),
   sender: who,
   senderJid: senderRaw,
   pushName,
   isGroup,
   jid,
   body,
   cleanNumber,
   isOwner,
   isROwner: isOwner,
   isSelf,
   isAdmin,
   isGroupAdmin: isAdmin
  })
 } catch (e) {
  if (e?.output?.statusCode === 428) return
  console.log('[HANDLE]', e.message, e.stack)
 }
}