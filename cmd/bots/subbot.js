import fs from 'fs'

const PATH = './db/sub_enabled.json'

// Opcional: agrega aquí los números o LID de los owners
const OWNER_IDS = []

function load() {
  try {
    if (fs.existsSync(PATH)) {
      const data = JSON.parse(fs.readFileSync(PATH, 'utf-8'))
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        return data
      }
    }
  } catch (e) {
    console.error('[BOT CONTROL] Error al cargar:', e)
  }
  return {}
}

function save(data) {
  try {
    fs.mkdirSync('./db', { recursive: true })
    fs.writeFileSync(PATH, JSON.stringify(data, null, 2))
    return true
  } catch (e) {
    console.error('[BOT CONTROL] Error al guardar:', e)
    return false
  }
}

function cleanNumber(raw) {
  if (!raw) return ''
  return String(raw)
    .split('@')[0]
    .split(':')[0]
    .replace(/\D/g, '')
}

function normalizeId(value) {
  if (typeof value !== 'string' &&
      typeof value !== 'number') return ''

  const raw = String(value).trim()
  if (!raw) return ''

  const num = cleanNumber(raw)
  if (!num) return ''

  if (raw.includes('@lid')) return `lid:${num}`

  if (
    raw.includes('@') &&
    !/@(?:s\.whatsapp\.net|c\.us)$/i.test(raw)
  ) return ''

  return `pn:${num}`
}

function getSenderIds(m) {
  return new Set([
    m.sender,
    m.senderPn,
    m.participant,
    m.participantPn,
    m.key?.participant,
    m.key?.participantAlt,
    m.key?.senderPn
  ].map(normalizeId).filter(Boolean))
}

function getOwnerValues(value) {
  if (!value) return []

  if (Array.isArray(value)) {
    return value.flatMap(getOwnerValues)
  }

  if (typeof value === 'object') {
    return [
      value.id,
      value.jid,
      value.number,
      value.phone,
      value.lid
    ].flatMap(getOwnerValues)
  }

  if (typeof value === 'string') {
    return value.split(/[,;\s]+/).filter(Boolean)
  }

  return []
}

function isOwner(m, extra = {}) {
  if (
    extra.isOwner === true ||
    extra.isROwner === true ||
    extra.isSelf === true ||
    extra.isBotOwner === true ||
    m.key?.fromMe === true
  ) return true

  const owners = [
    OWNER_IDS,
    process.env.OWNER_NUMBER,
    process.env.OWNER_NUMBERS,
    extra.owner,
    extra.owners,
    extra.config?.owner,
    extra.config?.owners,
    globalThis.owner,
    globalThis.owners
  ]

  const ownerIds = new Set(
    owners
      .flatMap(getOwnerValues)
      .map(normalizeId)
      .filter(Boolean)
  )

  const senderIds = getSenderIds(m)

  return [...senderIds].some(id => ownerIds.has(id))
}

async function isGroupAdmin(sock, m, extra = {}) {
  if (
    extra.isAdmin === true ||
    extra.isGroupAdmin === true ||
    m.isAdmin === true
  ) return true

  const jid = m.key?.remoteJid

  try {
    const metadata = await sock.groupMetadata(jid)

    const senderIds = getSenderIds(m)

    if (!senderIds.size) return false

    return metadata.participants.some(p => {
      const admin = p.admin === 'admin' ||
                    p.admin === 'superadmin'

      if (!admin) return false

      const participantIds = [
        p.id,
        p.jid,
        p.phoneNumber,
        p.lid
      ].map(normalizeId).filter(Boolean)

      return participantIds.some(id => senderIds.has(id))
    })
  } catch (e) {
    console.error('[BOT CONTROL] Error de administradores:', e)
    return false
  }
}

export const handler = {}

handler.name = 'sbot'
handler.alias = ['bot', 'subbot', 'boton', 'botoff']
handler.category = 'sub'
handler.description = 'Activa o desactiva el bot en un grupo'
handler.exec = async (sock, m, args = [], extra = {}) => {
  const jid = m.key?.remoteJid

  if (!jid) return

  if (!jid.endsWith('@g.us')) {
    return await sock.sendMessage(jid, {
      text: '❌ Este comando solo funciona en grupos.'
    }, { quoted: m })
  }

  const owner = isOwner(m, extra)

  const admin = owner
    ? false
    : await isGroupAdmin(sock, m, extra)

  if (!owner && !admin) {
    return await sock.sendMessage(jid, {
      text:
        '❌ *ACCESO DENEGADO*\n\n' +
        'Este comando solo está disponible para:\n\n' +
        '• Owner del bot\n' +
        '• Administradores del grupo'
    }, { quoted: m })
  }

  const myNum = cleanNumber(
    sock.user?.id ||
    sock.user?.jid ||
    sock.user?.lid ||
    ''
  )

  if (!myNum) {
    return await sock.sendMessage(jid, {
      text: '❌ No se pudo identificar el bot.'
    }, { quoted: m })
  }

  const data = load()

  if (!data[myNum] || typeof data[myNum] !== 'object') {
    data[myNum] = {}
  }

  const argv = Array.isArray(args)
    ? args
    : String(args || '').trim().split(/\s+/)

  let action = String(argv[0] || '').toLowerCase()

  const messageText = String(
    m.text ||
    m.body ||
    m.message?.conversation ||
    m.message?.extendedTextMessage?.text ||
    ''
  ).trim()

  const command = messageText
    .split(/\s+/)[0]
    ?.replace(/^[^\w]+/, '')
    ?.toLowerCase()

  if (!action && command === 'boton') action = 'on'
  if (!action && command === 'botoff') action = 'off'

  const onActions = [
    'on', 'enable', 'activar', 'encender'
  ]

  const offActions = [
    'off', 'disable', 'desactivar', 'apagar'
  ]

  if (onActions.includes(action)) {
    data[myNum][jid] = true

    if (!save(data)) {
      return await sock.sendMessage(jid, {
        text: '❌ No se pudo guardar el estado.'
      }, { quoted: m })
    }

    return await sock.sendMessage(jid, {
      text:
        '╭─ *BOT CONTROL*\n' +
        '│ ✅ BOT ACTIVADO\n' +
        '│ Estado: ON\n' +
        '╰──────────────\n\n' +
        'El bot está habilitado en este grupo.\n\n' +
        'Para desactivarlo: *.bot off*'
    }, { quoted: m })
  }

  if (offActions.includes(action)) {
    data[myNum][jid] = false

    if (!save(data)) {
      return await sock.sendMessage(jid, {
        text: '❌ No se pudo guardar el estado.'
      }, { quoted: m })
    }

    return await sock.sendMessage(jid, {
      text:
        '╭─ *BOT CONTROL*\n' +
        '│ ❌ BOT DESACTIVADO\n' +
        '│ Estado: OFF\n' +
        '╰──────────────\n\n' +
        'El bot fue deshabilitado en este grupo.\n\n' +
        'Para activarlo: *.bot on*'
    }, { quoted: m })
  }

  const enabled = data[myNum][jid] !== false

  return await sock.sendMessage(jid, {
    text:
      '╭─ *BOT CONTROL*\n' +
      `│ Estado: ${enabled ? '✅ ON' : '❌ OFF'}\n` +
      '│ Permisos: Owner / Admins\n' +
      '╰──────────────\n\n' +
      '*.bot on* — Activar\n' +
      '*.bot off* — Desactivar\n\n' +
      'También puedes usar:\n' +
      '*.boton*\n' +
      '*.botoff*'
  }, { quoted: m })
}